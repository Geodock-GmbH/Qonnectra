#!/usr/bin/env python3
"""Turn one load-test run directory into report.md, or compare two runs.

Reads what ``run.sh`` recorded (k6 CSV + summary, docker stats, Postgres
activity and pg_stat_statements, nginx and Postgres logs) and answers three
questions: where did the time go (per endpoint, per SQL statement), which
container ran hot, and at how many users did latency tip over.

Usage:
    python3 report.py loadtest/runs/<run>
    python3 report.py --compare loadtest/runs/<before> loadtest/runs/<after>

Standard library only, so it runs on the VPS without a virtualenv.
"""

import argparse
import csv
import gzip
import json
import math
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

csv.field_size_limit(sys.maxsize)

SPARK = "▁▂▃▄▅▆▇█"
NGINX_LINE = re.compile(
    r'"(?P<method>\w+) (?P<path>\S+) [^"]*" (?P<status>\d{3}) .*?'
    r"cache_status=(?P<cache>\S*) rt=(?P<rt>[\d.]+) urt=(?P<urt>\S+)"
)
SLOW_LINE = re.compile(
    r"duration: (?P<ms>[\d.]+) ms\s+(?:statement|execute [^:]*|plan):\s*(?P<sql>.*)"
)


def percentile(values: list[float], pct: float) -> float:
    """Return the ``pct`` percentile (0-100) with linear interpolation.

    Args:
        values: Unsorted samples.
        pct: Percentile between 0 and 100.

    Returns:
        float: The percentile, or 0.0 for no samples.
    """
    if not values:
        return 0.0
    ordered = sorted(values)
    rank = (len(ordered) - 1) * pct / 100
    low, high = math.floor(rank), math.ceil(rank)
    return ordered[low] + (ordered[high] - ordered[low]) * (rank - low)


def sparkline(values: list[float]) -> str:
    """Render values as a unicode sparkline scaled to their own maximum.

    Args:
        values: Series to draw.

    Returns:
        str: One block character per value.
    """
    top = max(values, default=0) or 1
    return "".join(
        SPARK[min(len(SPARK) - 1, int(v / top * (len(SPARK) - 1)))] for v in values
    )


def table(headers: list[str], rows: list[list]) -> str:
    """Format a Markdown table.

    Args:
        headers: Column titles.
        rows: Cell values, converted with ``str``.

    Returns:
        str: Markdown table text.
    """
    lines = ["| " + " | ".join(headers) + " |", "|" + "---|" * len(headers)]
    lines += [
        "| " + " | ".join(str(cell).replace("|", "\\|") for cell in row) + " |"
        for row in rows
    ]
    return "\n".join(lines)


def short_container(name: str) -> str:
    """Map ``qonnectra_backend_wms_prod`` style names to ``backend_wms``.

    Args:
        name: Docker container name.

    Returns:
        str: Name without project prefix and environment suffix.
    """
    return re.sub(r"^qonnectra_|_(prod|dev)$", "", name)


def parse_size(text: str) -> float:
    """Convert a docker stats size such as ``1.2GiB`` to MiB.

    Args:
        text: Size with unit.

    Returns:
        float: Size in MiB.
    """
    match = re.match(r"([\d.]+)\s*([KMGT]?i?B)", text.strip())
    if not match:
        return 0.0
    factor = {
        "B": 1 / 2**20,
        "KiB": 1 / 1024,
        "KB": 1 / 1024,
        "MiB": 1,
        "MB": 1,
        "GiB": 1024,
        "GB": 1024,
        "TiB": 2**20,
    }
    return float(match.group(1)) * factor.get(match.group(2), 1)


def tag_value(row: dict, key: str) -> str:
    """Read a tag from a k6 CSV row, from its column or from ``extra_tags``.

    Args:
        row: One parsed CSV row.
        key: Tag name.

    Returns:
        str: The tag value, or an empty string.
    """
    if row.get(key):
        return row[key]
    for pair in (row.get("extra_tags") or "").split("&"):
        name, _, value = pair.partition("=")
        if name == key:
            return value
    return ""


class Run:
    """Everything recorded for one run, parsed into plain structures."""

    def __init__(self, path: Path):
        """Load and aggregate all files of a run directory.

        Args:
            path: Directory written by ``run.sh``.
        """
        self.path = path
        self.meta = self._json("meta.json")
        self.summary = self._json("summary.json")
        self.endpoints: dict[str, dict[str, list[float]]] = defaultdict(
            lambda: defaultdict(list)
        )
        self.minutes: dict[int, dict] = defaultdict(
            lambda: {
                "vus": 0,
                "requests": 0,
                "failed": 0,
                "tile_ms": [],
                "cpu": defaultdict(list),
                "conns": [],
            }
        )
        self.start_ts: int | None = None
        self._read_k6()
        self._read_containers()
        self._read_pg_activity()
        self.top_sql = self._csv("top_sql.csv")
        self.nginx = self._read_nginx()
        self.slow = self._read_slow_log()

    def _json(self, name: str) -> dict:
        """Return a JSON file of the run, or an empty dict when it is missing."""
        file = self.path / name
        return json.loads(file.read_text()) if file.exists() else {}

    def _csv(self, name: str) -> list[dict]:
        """Return the rows of a CSV file of the run, or an empty list when it is missing."""
        file = self.path / name
        if not file.exists():
            return []
        with file.open(newline="") as handle:
            return list(csv.DictReader(handle))

    def _minute(self, ts: float) -> int:
        """Return the minute since run start for a unix timestamp; the first call sets the start."""
        if self.start_ts is None:
            self.start_ts = int(ts)
        return max(0, int((ts - self.start_ts) // 60))

    def _read_k6(self):
        """Aggregate k6 samples into per-endpoint series and per-minute buckets."""
        file = self.path / "k6.csv.gz"
        if not file.exists():
            return
        with gzip.open(file, "rt", newline="") as handle:
            for row in csv.DictReader(handle):
                metric = row["metric_name"]
                ts = float(row["timestamp"])
                value = float(row["metric_value"])
                name = tag_value(row, "name")
                if metric == "http_req_duration":
                    minute = self.minutes[self._minute(ts)]
                    minute["requests"] += 1
                    if name.startswith("tile:") and name != "tile:wms":
                        minute["tile_ms"].append(value)
                    if name and name != "setup":
                        self.endpoints[name]["duration"].append(value)
                        self.endpoints[name]["failed"].append(
                            0.0 if row.get("expected_response") == "true" else 1.0
                        )
                elif metric == "http_req_failed" and value:
                    self.minutes[self._minute(ts)]["failed"] += 1
                elif metric == "vus":
                    minute = self.minutes[self._minute(ts)]
                    minute["vus"] = max(minute["vus"], int(value))
                elif metric in ("db_ms", "db_queries", "app_ms") and name:
                    self.endpoints[name][metric].append(value)
                elif metric == "remote_errors" and name:
                    self.endpoints[name]["remote_error"].append(value)

    def _read_containers(self):
        """Collect CPU and RAM samples per container from docker stats."""
        self.containers: dict[str, dict[str, list[float]]] = defaultdict(
            lambda: {"cpu": [], "mem": []}
        )
        for row in self._csv("containers.csv"):
            name = short_container(row["container"])
            cpu = float(row["cpu_pct"].rstrip("%") or 0)
            mem = parse_size(row["mem_usage"].split("/")[0])
            self.containers[name]["cpu"].append(cpu)
            self.containers[name]["mem"].append(mem)
            if self.start_ts is not None:
                self.minutes[self._minute(float(row["ts"]))]["cpu"][name].append(cpu)

    def _read_pg_activity(self):
        """Collect connection counts, wait events and per-role peaks from pg_stat_activity samples."""
        per_second: dict[int, dict[str, int]] = defaultdict(
            lambda: {"total": 0, "active": 0}
        )
        self.wait_events: Counter = Counter()
        self.roles: Counter = Counter()
        for row in self._csv("pg_activity.csv"):
            ts = int(row["ts"])
            count = int(row["connections"])
            per_second[ts]["total"] += count
            if row["state"] == "active":
                per_second[ts]["active"] += count
                if row["wait_event_type"]:
                    self.wait_events[
                        f"{row['wait_event_type']}:{row['wait_event']}"
                    ] += count
            self.roles[row["role"]] = max(self.roles[row["role"]], count)
        self.connections = per_second
        if self.start_ts is not None:
            for ts, value in per_second.items():
                self.minutes[self._minute(ts)]["conns"].append(value["total"])

    def _read_nginx(self) -> dict[str, dict]:
        """Group nginx access log lines by route, with cache status and timings."""
        groups: dict[str, dict] = defaultdict(
            lambda: {"cache": Counter(), "urt": [], "rt": []}
        )
        file = self.path / "nginx.log"
        if not file.exists():
            return groups
        for line in file.read_text(errors="replace").splitlines():
            match = NGINX_LINE.search(line)
            if not match:
                continue
            path = match["path"]
            if "/ol_" in path and "_tiles/" in path:
                group = "vector tiles"
            elif "/wms-proxy/" in path:
                group = "wms proxy"
            elif path.startswith("/api/"):
                group = "api (other)"
            else:
                group = "other"
            groups[group]["cache"][match["cache"] or "-"] += 1
            groups[group]["rt"].append(float(match["rt"]) * 1000)
            upstream = match["urt"].split(",")[-1].strip()
            if upstream not in ("-", ""):
                groups[group]["urt"].append(float(upstream) * 1000)
        return groups

    def _read_slow_log(self) -> list[tuple[float, str]]:
        """Return slow-statement log entries as ``(ms, sql)``, slowest first."""
        file = self.path / "pg.log"
        if not file.exists():
            return []
        found = []
        for line in file.read_text(errors="replace").splitlines():
            match = SLOW_LINE.search(line)
            if match:
                found.append((float(match["ms"]), match["sql"][:300]))
        return sorted(found, reverse=True)

    def metric(self, name: str, stat: str) -> float:
        """Read one value from the k6 summary.

        Args:
            name: Metric name, e.g. ``http_reqs``.
            stat: Stat key, e.g. ``count`` or ``p(95)``.

        Returns:
            float: The value, or 0.0 when missing.
        """
        return float(
            self.summary.get("metrics", {}).get(name, {}).get("values", {}).get(stat, 0)
            or 0
        )

    def endpoint_rows(self) -> list[dict]:
        """Aggregate per-endpoint latency, errors and DB cost.

        Returns:
            list[dict]: One dict per endpoint, most total time first.
        """
        rows = []
        for name, series in self.endpoints.items():
            durations = series["duration"]
            if not durations:
                continue
            errors = series["failed"] + series.get("remote_error", [])
            rows.append(
                {
                    "name": name,
                    "count": len(durations),
                    "total_s": sum(durations) / 1000,
                    "p50": percentile(durations, 50),
                    "p95": percentile(durations, 95),
                    "p99": percentile(durations, 99),
                    "max": max(durations),
                    "err_pct": 100 * sum(errors) / max(len(durations), 1),
                    "queries": sum(series["db_queries"]) / len(series["db_queries"])
                    if series["db_queries"]
                    else None,
                    "db_ms": sum(series["db_ms"]) / len(series["db_ms"])
                    if series["db_ms"]
                    else None,
                    "app_ms": sum(series["app_ms"]) / len(series["app_ms"])
                    if series["app_ms"]
                    else None,
                }
            )
        return sorted(rows, key=lambda r: r["total_s"], reverse=True)


def fmt(value, digits: int = 0) -> str:
    """Format a number for a table cell, ``–`` for missing values.

    Args:
        value: Number or None.
        digits: Decimal places.

    Returns:
        str: Formatted value.
    """
    return "–" if value is None else f"{value:,.{digits}f}"


def db_delta(run: Run) -> dict[str, float]:
    """Return pg_stat_database counter deltas over the run.

    Args:
        run: Parsed run.

    Returns:
        dict[str, float]: Counter name to increase during the run.
    """
    before, after = run._csv("pg_db_before.csv"), run._csv("pg_db_after.csv")
    if not before or not after:
        return {}
    return {
        key: float(after[0][key]) - float(before[0][key])
        for key in after[0]
        if key != "ts"
    }


def render(run: Run) -> str:
    """Build the Markdown report for one run.

    Args:
        run: Parsed run.

    Returns:
        str: report.md content.
    """
    meta = run.meta
    thresholds = []
    for name, metric in run.summary.get("metrics", {}).items():
        for expression, result in (metric.get("thresholds") or {}).items():
            thresholds.append(
                [name, expression, "pass" if result.get("ok") else "**FAIL**"]
            )

    out = [
        f"# Load test {run.path.name}",
        "",
        table(
            ["profile", "git", "start (UTC)", "end (UTC)", "k6 args", "host"],
            [
                [
                    meta.get("profile", "?"),
                    meta.get("git_sha", "?"),
                    meta.get("start", "?"),
                    meta.get("end", "?"),
                    meta.get("k6_args") or "–",
                    f"{meta.get('host_cpus', '?')} CPU / {round(meta.get('host_mem_kb', 0) / 2**20)} GB",
                ]
            ],
        ),
        "",
        table(
            [
                "peak users",
                "requests",
                "req/s",
                "failed",
                "data in",
                "p95 all",
                "iterations",
            ],
            [
                [
                    fmt(run.metric("vus_max", "max")),
                    fmt(run.metric("http_reqs", "count")),
                    fmt(run.metric("http_reqs", "rate"), 1),
                    f"{100 * run.metric('http_req_failed', 'rate'):.2f} %",
                    f"{run.metric('data_received', 'count') / 2**20:,.0f} MiB",
                    f"{run.metric('http_req_duration', 'p(95)'):,.0f} ms",
                    fmt(run.metric("iterations", "count")),
                ]
            ],
        ),
        "",
    ]
    if thresholds:
        out += [
            "## Thresholds",
            "",
            table(["metric", "threshold", "result"], thresholds),
            "",
        ]

    if run.minutes:
        out += [
            "## Timeline",
            "",
            "Per minute. CPU is docker's %, where 100 % is one core. Find the minute where tile p95 or errors jump: the users at that point are the knee.",
            "",
        ]
        rows = []
        for minute in sorted(run.minutes):
            data = run.minutes[minute]
            cpu = {
                name: (sum(v) / len(v) if v else 0) for name, v in data["cpu"].items()
            }
            rows.append(
                [
                    minute,
                    data["vus"],
                    fmt(data["requests"] / 60, 1),
                    fmt(percentile(data["tile_ms"], 95)),
                    f"{100 * data['failed'] / max(data['requests'], 1):.1f}",
                    fmt(cpu.get("db")),
                    fmt(cpu.get("backend")),
                    fmt(cpu.get("backend_wms")),
                    fmt(cpu.get("frontend")),
                    fmt(cpu.get("qgis_server")),
                    fmt(max(data["conns"], default=None)),
                ]
            )
        out += [
            table(
                [
                    "min",
                    "users",
                    "req/s",
                    "tile p95 ms",
                    "err %",
                    "db %",
                    "backend %",
                    "wms %",
                    "frontend %",
                    "qgis %",
                    "pg conns",
                ],
                rows,
            ),
            "",
        ]

    endpoint_rows = run.endpoint_rows()
    if endpoint_rows:
        out += [
            "## Endpoints",
            "",
            "Sorted by total time spent waiting for them. `queries` / `db ms` / `app ms` are Django's own numbers via Server-Timing (PERF_HEADERS=1). Remote calls and pages are SvelteKit, so there are none for them.",
            "",
            table(
                [
                    "endpoint",
                    "count",
                    "total s",
                    "p50",
                    "p95",
                    "p99",
                    "max",
                    "err %",
                    "queries",
                    "db ms",
                    "app ms",
                ],
                [
                    [
                        f"`{r['name']}`",
                        fmt(r["count"]),
                        fmt(r["total_s"], 1),
                        fmt(r["p50"]),
                        fmt(r["p95"]),
                        fmt(r["p99"]),
                        fmt(r["max"]),
                        f"{r['err_pct']:.1f}",
                        fmt(r["queries"], 1),
                        fmt(r["db_ms"], 1),
                        fmt(r["app_ms"], 1),
                    ]
                    for r in endpoint_rows
                ],
            ),
            "",
        ]

    if run.containers:
        cores = meta.get("host_cpus") or 0
        out += [
            "## Containers",
            "",
            f"CPU in docker % (100 % = one core{f', host has {cores * 100} %' if cores else ''}).",
            "",
            table(
                [
                    "container",
                    "avg CPU %",
                    "p95 CPU %",
                    "max CPU %",
                    "CPU over time",
                    "max RAM MiB",
                ],
                [
                    [
                        name,
                        fmt(sum(v["cpu"]) / len(v["cpu"])),
                        fmt(percentile(v["cpu"], 95)),
                        fmt(max(v["cpu"])),
                        sparkline(v["cpu"][:: max(1, len(v["cpu"]) // 60)]),
                        fmt(max(v["mem"])),
                    ]
                    for name, v in sorted(
                        run.containers.items(), key=lambda kv: -sum(kv[1]["cpu"])
                    )
                    if v["cpu"]
                ],
            ),
            "",
        ]

    out += ["## Postgres", ""]
    if run.connections:
        totals = [v["total"] for v in run.connections.values()]
        actives = [v["active"] for v in run.connections.values()]
        out += [
            table(
                [
                    "max connections",
                    "max active",
                    "avg active",
                    "connections by role (max)",
                ],
                [
                    [
                        max(totals),
                        max(actives),
                        fmt(sum(actives) / len(actives), 1),
                        ", ".join(
                            f"{k or '?'}={v}" for k, v in run.roles.most_common()
                        ),
                    ]
                ],
            ),
            "",
        ]
    if run.wait_events:
        total = sum(run.wait_events.values())
        out += [
            "Active backends by wait event (samples). `LWLock`/`Lock` means contention, `IO` means disk reads, `Client` is idle time inside a transaction.",
            "",
            table(
                ["wait event", "share"],
                [
                    [k, f"{100 * v / total:.0f} %"]
                    for k, v in run.wait_events.most_common(8)
                ],
            ),
            "",
        ]
    delta = db_delta(run)
    if delta:
        reads = delta.get("blks_read", 0) + delta.get("blks_hit", 0)
        out += [
            table(
                [
                    "commits",
                    "rows returned",
                    "rows fetched",
                    "cache hit",
                    "temp files",
                    "temp MiB",
                    "deadlocks",
                ],
                [
                    [
                        fmt(delta.get("xact_commit")),
                        fmt(delta.get("tup_returned")),
                        fmt(delta.get("tup_fetched")),
                        f"{100 * delta.get('blks_hit', 0) / reads:.2f} %"
                        if reads
                        else "–",
                        fmt(delta.get("temp_files")),
                        fmt(delta.get("temp_bytes", 0) / 2**20, 1),
                        fmt(delta.get("deadlocks")),
                    ]
                ],
            ),
            "",
        ]
    if run.top_sql:
        out += [
            "### Top SQL by total time",
            "",
            "From pg_stat_statements, reset at run start. Includes QGIS Server (its own role) and anything else that hit the DB meanwhile.",
            "",
            table(
                [
                    "%",
                    "total ms",
                    "calls",
                    "mean ms",
                    "max ms",
                    "rows",
                    "blks read",
                    "role",
                    "query",
                ],
                [
                    [
                        row["pct"],
                        fmt(float(row["total_ms"])),
                        fmt(float(row["calls"])),
                        row["mean_ms"],
                        row["max_ms"],
                        fmt(float(row["rows"])),
                        fmt(float(row["shared_blks_read"])),
                        row["role"],
                        f"`{row['query'][:240]}`",
                    ]
                    for row in run.top_sql[:15]
                ],
            ),
            "",
        ]
    if run.slow:
        out += [
            f"### Slow statement log ({len(run.slow)} over log_min_duration_statement)",
            "",
            table(
                ["ms", "statement"],
                [[fmt(ms), f"`{sql[:200]}`"] for ms, sql in run.slow[:10]],
            ),
            "",
        ]

    if run.nginx:
        out += [
            "## nginx",
            "",
            "Cache status per route group. `rt` is the time nginx spent on the request, `urt` the time waiting for Django (only for cache misses).",
            "",
            table(
                [
                    "group",
                    "requests",
                    "HIT",
                    "MISS",
                    "other",
                    "rt p95 ms",
                    "urt p95 ms",
                ],
                [
                    [
                        group,
                        sum(data["cache"].values()),
                        data["cache"].get("HIT", 0),
                        data["cache"].get("MISS", 0),
                        sum(
                            v
                            for k, v in data["cache"].items()
                            if k not in ("HIT", "MISS")
                        ),
                        fmt(percentile(data["rt"], 95)),
                        fmt(percentile(data["urt"], 95)),
                    ]
                    for group, data in sorted(run.nginx.items())
                ],
            ),
            "",
        ]
    return "\n".join(out)


def render_compare(before: Run, after: Run) -> str:
    """Build a before/after Markdown comparison of two runs.

    Args:
        before: Baseline run.
        after: Run after a change.

    Returns:
        str: Markdown comparison.
    """

    def change(a: float | None, b: float | None) -> str:
        """Format the relative change from ``a`` to ``b``."""
        if a is None or b is None or a == 0:
            return "–"
        return f"{100 * (b - a) / a:+.0f} %"

    out = [f"# Compare {before.path.name} → {after.path.name}", ""]
    totals = [
        (
            "req/s",
            before.metric("http_reqs", "rate"),
            after.metric("http_reqs", "rate"),
        ),
        (
            "p95 all ms",
            before.metric("http_req_duration", "p(95)"),
            after.metric("http_req_duration", "p(95)"),
        ),
        (
            "failed %",
            100 * before.metric("http_req_failed", "rate"),
            100 * after.metric("http_req_failed", "rate"),
        ),
    ]
    for name in ("db", "backend", "frontend"):
        a = before.containers.get(name, {}).get("cpu") or []
        b = after.containers.get(name, {}).get("cpu") or []
        totals.append(
            (
                f"{name} avg CPU %",
                sum(a) / len(a) if a else None,
                sum(b) / len(b) if b else None,
            )
        )
    out += [
        table(
            ["metric", "before", "after", "change"],
            [[n, fmt(a, 1), fmt(b, 1), change(a, b)] for n, a, b in totals],
        ),
        "",
    ]

    after_rows = {r["name"]: r for r in after.endpoint_rows()}
    rows = []
    for r in before.endpoint_rows():
        o = after_rows.get(r["name"])
        if not o:
            continue
        rows.append(
            [
                f"`{r['name']}`",
                fmt(r["p95"]),
                fmt(o["p95"]),
                change(r["p95"], o["p95"]),
                fmt(r["queries"], 1),
                fmt(o["queries"], 1),
                fmt(r["db_ms"], 1),
                fmt(o["db_ms"], 1),
            ]
        )
    if rows:
        out += [
            "## Endpoints",
            "",
            table(
                [
                    "endpoint",
                    "p95 before",
                    "p95 after",
                    "change",
                    "queries before",
                    "after",
                    "db ms before",
                    "after",
                ],
                rows,
            ),
            "",
        ]

    after_sql = {row["query"][:160]: row for row in after.top_sql}
    sql_rows = []
    for row in before.top_sql[:15]:
        other = after_sql.get(row["query"][:160])
        sql_rows.append(
            [
                fmt(float(row["total_ms"])),
                fmt(float(other["total_ms"])) if other else "gone",
                row["mean_ms"],
                other["mean_ms"] if other else "–",
                f"`{row['query'][:160]}`",
            ]
        )
    if sql_rows:
        out += [
            "## Top SQL of the baseline",
            "",
            table(
                ["total ms before", "after", "mean before", "after", "query"], sql_rows
            ),
            "",
        ]
    return "\n".join(out)


def main():
    """Parse arguments and write report.md, or print a comparison."""
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("run", type=Path, nargs="?", help="Run directory")
    parser.add_argument("--compare", type=Path, nargs=2, metavar=("BEFORE", "AFTER"))
    args = parser.parse_args()

    if args.compare:
        before, after = (Run(path) for path in args.compare)
        text = render_compare(before, after)
        target = args.compare[1] / f"compare-{args.compare[0].name}.md"
        target.write_text(text)
        print(text)
        print(f"\nWritten to {target}")
        return
    if not args.run:
        parser.error("give a run directory or --compare BEFORE AFTER")
    report = render(Run(args.run))
    (args.run / "report.md").write_text(report)
    print(report)


if __name__ == "__main__":
    main()
