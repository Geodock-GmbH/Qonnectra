"""Collects what happens during a run and turns it into the report summary.

Request events, Server-Timing values, container and Postgres samples all land
here. The live tabs of the runner read from it while a test runs, and
:meth:`Recorder.summary` condenses it into ``summary.json`` when it ends.
No Locust or gevent imports, so it is testable on its own.
"""

import time
from collections import Counter, defaultdict

from qonnectra_loadtest.analysis import mean, percentile, sparkline

FEATURE_TILES = {
    f"tile:{scope}{layer}"
    for scope in ("", "global:")
    for layer in ("trench", "address", "node", "area")
}
"""Requests behind the timeline's ``tile p95``: the app's own vector tiles, per project and global."""


def _new_minute() -> dict:
    """Return an empty per-minute bucket."""
    return {
        "users": 0,
        "requests": 0,
        "failed": 0,
        "tile_ms": [],
        "cpu": defaultdict(list),
        "conns": [],
    }


class Recorder:
    """In-memory recording of one run, reset at every test start."""

    def __init__(self):
        """Start with an empty recording."""
        self.reset(time.time())

    def reset(self, started: float):
        """Drop everything recorded and start a new run.

        Args:
            started: Unix time of the test start; minute 0 begins here.
        """
        self.started = started
        self.minutes: dict[int, dict] = defaultdict(_new_minute)
        self.timings: dict[str, dict[str, list[float]]] = defaultdict(
            lambda: {"q": [], "db": [], "app": []}
        )
        self.containers: dict[str, dict[str, list[float]]] = defaultdict(
            lambda: {"cpu": [], "mem": []}
        )
        self.latest_containers: dict[str, tuple[float, float]] = {}
        self.connections: list[dict] = []
        self.latest_activity: list[dict] = []
        self.wait_events: Counter = Counter()
        self.role_peaks: Counter = Counter()
        self.top_sql: list[dict] = []

    def _minute(self, ts: float) -> dict:
        """Return the bucket of the minute a unix time falls into."""
        return self.minutes[max(0, int((ts - self.started) // 60))]

    def request(self, name: str, ms: float, failed: bool, ts: float | None = None):
        """Record one finished request.

        Args:
            name: Endpoint name, e.g. ``tile:trench``.
            ms: Response time.
            failed: Whether Locust counted it as a failure.
            ts: Unix time, now by default.
        """
        minute = self._minute(time.time() if ts is None else ts)
        minute["requests"] += 1
        if failed:
            minute["failed"] += 1
        if name in FEATURE_TILES:
            minute["tile_ms"].append(ms)

    def users(self, count: int, ts: float | None = None):
        """Record the current number of running users.

        Args:
            count: Running users.
            ts: Unix time, now by default.
        """
        minute = self._minute(time.time() if ts is None else ts)
        minute["users"] = max(minute["users"], count)

    def server_timing(self, name: str, parts: dict[str, float]):
        """Record Django's own query count and timings for one response.

        Args:
            name: Endpoint name.
            parts: Parsed ``Server-Timing`` values (``q``, ``db``, ``app``).
        """
        series = self.timings[name]
        for key in ("q", "db", "app"):
            if key in parts:
                series[key].append(parts[key])

    def container_sample(self, ts: float, rows: list[tuple[str, float, float]]):
        """Record one round of container CPU and memory.

        Args:
            ts: Unix time of the sample.
            rows: ``(short name, CPU %, RAM MiB)`` per container.
        """
        minute = self._minute(ts)
        for name, cpu, memory in rows:
            self.containers[name]["cpu"].append(cpu)
            self.containers[name]["mem"].append(memory)
            self.latest_containers[name] = (cpu, memory)
            minute["cpu"][name].append(cpu)

    def activity_sample(self, ts: float, rows: list[dict]):
        """Record one ``pg_stat_activity`` round.

        Args:
            ts: Unix time of the sample.
            rows: Grouped rows with ``role``, ``state``, ``wait_event_type``,
                ``wait_event`` and ``connections``.
        """
        total = sum(row["connections"] for row in rows)
        active = 0
        per_role: Counter = Counter()
        for row in rows:
            per_role[row["role"]] += row["connections"]
            if row["state"] == "active":
                active += row["connections"]
                if row["wait_event_type"]:
                    self.wait_events[
                        f"{row['wait_event_type']}:{row['wait_event']}"
                    ] += row["connections"]
        for role, count in per_role.items():
            self.role_peaks[role] = max(self.role_peaks[role], count)
        self.connections.append({"total": total, "active": active})
        self.latest_activity = rows
        self._minute(ts)["conns"].append(total)

    def live_tables(self) -> list[dict]:
        """Return the rows of the runner's extra tabs.

        Returns:
            list[dict]: ``{"key", "data"}`` per tab, as Locust's
                ``extended_stats`` expects.
        """
        server = [
            {
                "name": name,
                "cpu": round(cpu),
                "cpu_avg": round(mean(self.containers[name]["cpu"]) or 0),
                "cpu_max": round(max(self.containers[name]["cpu"], default=0)),
                "mem": round(memory),
            }
            for name, (cpu, memory) in sorted(
                self.latest_containers.items(), key=lambda item: -item[1][0]
            )
        ]
        django = [
            {
                "name": name,
                "samples": len(series["app"]),
                "queries": round(mean(series["q"]) or 0, 1),
                "db_ms": round(mean(series["db"]) or 0, 1),
                "app_ms": round(mean(series["app"]) or 0, 1),
            }
            for name, series in sorted(self.timings.items())
            if series["app"]
        ]
        connections = [
            {
                "name": row["role"] or "?",
                "state": row["state"] or "-",
                "wait": f"{row['wait_event_type']}:{row['wait_event']}"
                if row["wait_event_type"]
                else "-",
                "connections": row["connections"],
            }
            for row in sorted(self.latest_activity, key=lambda r: -r["connections"])
        ]
        database = [
            {
                "name": row["query"][:200],
                "pct": row["pct"],
                "total_ms": row["total_ms"],
                "calls": row["calls"],
                "mean_ms": row["mean_ms"],
                "rows": row["rows"],
                "role": row["role"],
            }
            for row in self.top_sql[:25]
        ]
        return [
            {"key": "server", "data": server},
            {"key": "django", "data": django},
            {"key": "database", "data": database},
            {"key": "connections", "data": connections},
        ]

    def timeline(self) -> list[dict]:
        """Condense the minute buckets into report rows.

        Returns:
            list[dict]: Per minute: users, req/s, feature-tile p95, error
                share, average CPU per container and peak connections.
        """
        rows = []
        for index in sorted(self.minutes):
            data = self.minutes[index]
            rows.append(
                {
                    "minute": index,
                    "users": data["users"],
                    "rps": data["requests"] / 60,
                    "tile_p95": percentile(data["tile_ms"], 95)
                    if data["tile_ms"]
                    else None,
                    "err_pct": 100 * data["failed"] / max(data["requests"], 1),
                    "cpu": {name: mean(values) for name, values in data["cpu"].items()},
                    "pg_conns": max(data["conns"], default=None),
                }
            )
        return rows

    def summary(
        self,
        meta: dict,
        endpoints: list[dict],
        totals: dict,
        extra: dict | None = None,
    ) -> dict:
        """Build the run summary the report renders.

        Args:
            meta: Run metadata (name, shape, options, times, host).
            endpoints: Per-endpoint Locust stats with ``name`` and latency
                fields; Django's Server-Timing averages are merged in.
            totals: Run totals from Locust.
            extra: Collected-at-the-end sections (``top_sql``,
                ``slow_sql``, ``nginx``, ``db_delta``).

        Returns:
            dict: JSON-serialisable summary.
        """
        merged = []
        for row in endpoints:
            series = self.timings.get(row["name"], {})
            merged.append(
                {
                    **row,
                    "queries": mean(series.get("q", [])),
                    "db_ms": mean(series.get("db", [])),
                    "app_ms": mean(series.get("app", [])),
                }
            )
        merged.sort(key=lambda r: r["total_s"], reverse=True)

        containers = [
            {
                "name": name,
                "cpu_avg": mean(series["cpu"]),
                "cpu_p95": percentile(series["cpu"], 95),
                "cpu_max": max(series["cpu"]),
                "cpu_spark": sparkline(series["cpu"]),
                "mem_max": max(series["mem"]),
            }
            for name, series in sorted(
                self.containers.items(), key=lambda kv: -sum(kv[1]["cpu"])
            )
            if series["cpu"]
        ]

        actives = [sample["active"] for sample in self.connections]
        total_waits = sum(self.wait_events.values())
        postgres = {
            "max_connections": max(
                (sample["total"] for sample in self.connections), default=None
            ),
            "max_active": max(actives, default=None),
            "avg_active": mean(actives),
            "roles": dict(self.role_peaks.most_common()),
            "wait_events": {
                name: 100 * count / total_waits
                for name, count in self.wait_events.most_common(8)
            },
        }

        return {
            "meta": meta,
            "totals": totals,
            "timeline": self.timeline(),
            "endpoints": merged,
            "containers": containers,
            "postgres": postgres,
            **(extra or {}),
        }
