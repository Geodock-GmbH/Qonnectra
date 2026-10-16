"""Renders a run summary, or two of them side by side, as Markdown and HTML.

A report answers three questions: where did the time go (per endpoint, per
SQL statement), which container ran hot, and at how many users did latency
tip over. Both formats come from the same list of :class:`Section` objects.
"""

import html
from dataclasses import dataclass, field

from qonnectra_loadtest.config import DEFAULT_LIMIT_ERR_PCT, DEFAULT_LIMIT_TILE_MS

TIMELINE_CONTAINERS = [
    ("db", "db %"),
    ("backend", "backend %"),
    ("backend_wms", "wms %"),
    ("frontend", "frontend %"),
    ("qgis_server", "qgis %"),
    ("tileserver", "tiles %"),
]


@dataclass
class Section:
    """One titled table of the report."""

    title: str
    headers: list[str]
    rows: list[list[str]]
    note: str = ""
    level: int = 2
    code_columns: set[int] = field(default_factory=set)


def fmt(value, digits: int = 0) -> str:
    """Format a number for a table cell, ``–`` for missing values.

    Args:
        value: Number or None.
        digits: Decimal places.

    Returns:
        str: Formatted value.
    """
    return "–" if value is None else f"{value:,.{digits}f}"


def change(before: float | None, after: float | None) -> str:
    """Format the relative change from ``before`` to ``after``.

    Args:
        before: Baseline value.
        after: New value.

    Returns:
        str: e.g. ``-50 %``, or ``–`` when it cannot be computed.
    """
    if before is None or after is None or before == 0:
        return "–"
    return f"{100 * (after - before) / before:+.0f} %"


def _options_text(options: dict) -> str:
    """Summarise the run options in one line."""
    return ", ".join(f"{key}={value}" for key, value in options.items())


def capacity(summary: dict) -> Section | None:
    """Find the first minute of the timeline that crossed a latency or error limit.

    The limits come from the run's start form, or the defaults for runs that
    predate them. The users of the minute before are what the host carries.

    Args:
        summary: Content of ``summary.json``.

    Returns:
        Section | None: One row, or None without a timeline.
    """
    timeline = summary.get("timeline", [])
    if not timeline:
        return None
    options = summary.get("meta", {}).get("options", {})
    tile_limit = options.get("limit_tile_ms", DEFAULT_LIMIT_TILE_MS)
    err_limit = options.get("limit_err_pct", DEFAULT_LIMIT_ERR_PCT)
    headers = [
        "users within limits",
        "limit crossed at users",
        "min",
        "tile p95 ms",
        "err %",
        "busiest container",
    ]
    note = (
        f"Limits: tile p95 > {tile_limit:,} ms or errors > {err_limit:.1f} % "
        "in a minute. CPU is docker's %, where 100 % is one core."
    )
    for index, row in enumerate(timeline):
        tile_p95 = row["tile_p95"]
        if (tile_p95 is None or tile_p95 <= tile_limit) and row["err_pct"] <= err_limit:
            continue
        busiest = max(row["cpu"].items(), key=lambda item: item[1], default=None)
        return Section(
            "Capacity",
            headers,
            [
                [
                    str(timeline[index - 1]["users"]) if index else "–",
                    str(row["users"]),
                    str(row["minute"]),
                    fmt(tile_p95),
                    f"{row['err_pct']:.1f}",
                    f"{busiest[0]} {busiest[1]:.0f} %" if busiest else "–",
                ]
            ],
            note=note,
        )
    peak = max(row["users"] for row in timeline)
    return Section(
        "Capacity",
        headers,
        [[f"≥ {peak}", "not reached", "–", "–", "–", "–"]],
        note=note,
    )


def sections(summary: dict) -> list[Section]:
    """Build the report sections of one run.

    Args:
        summary: Content of ``summary.json``.

    Returns:
        list[Section]: Sections in reading order.
    """
    meta = summary.get("meta", {})
    totals = summary.get("totals", {})
    out = [
        Section(
            "Run",
            ["shape", "personas", "version", "start (UTC)", "end (UTC)", "host"],
            [
                [
                    meta.get("shape", "?"),
                    ", ".join(meta.get("personas", [])) or "–",
                    meta.get("version", "?"),
                    meta.get("start", "?"),
                    meta.get("end", "?"),
                    f"{meta.get('host_cpus', '?')} CPU / "
                    f"{round(meta.get('host_mem_kb', 0) / 2**20)} GB",
                ]
            ],
            note=_options_text(meta.get("options", {})),
        ),
        Section(
            "Totals",
            ["peak users", "requests", "req/s", "failed", "data in", "p95 all"],
            [
                [
                    fmt(totals.get("users_peak")),
                    fmt(totals.get("requests")),
                    fmt(totals.get("rps"), 1),
                    f"{totals.get('fail_pct', 0):.2f} %",
                    f"{(totals.get('bytes_in') or 0) / 2**20:,.0f} MiB",
                    f"{fmt(totals.get('p95'))} ms",
                ]
            ],
        ),
    ]

    limit = capacity(summary)
    if limit:
        out.append(limit)

    timeline = summary.get("timeline", [])
    if timeline:
        out.append(
            Section(
                "Timeline",
                ["min", "users", "req/s", "tile p95 ms", "err %"]
                + [title for _, title in TIMELINE_CONTAINERS]
                + ["pg conns"],
                [
                    [
                        str(row["minute"]),
                        str(row["users"]),
                        fmt(row["rps"], 1),
                        fmt(row["tile_p95"]),
                        f"{row['err_pct']:.1f}",
                    ]
                    + [fmt(row["cpu"].get(name)) for name, _ in TIMELINE_CONTAINERS]
                    + [fmt(row["pg_conns"])]
                    for row in timeline
                ],
                note="Per minute. CPU is docker's %, where 100 % is one core. Find the "
                "minute where tile p95 or errors jump: the users at that point are "
                "how many this host carries.",
            )
        )

    endpoints = summary.get("endpoints", [])
    if endpoints:
        out.append(
            Section(
                "Endpoints",
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
                        row["name"],
                        fmt(row["count"]),
                        fmt(row["total_s"], 1),
                        fmt(row["p50"]),
                        fmt(row["p95"]),
                        fmt(row["p99"]),
                        fmt(row["max"]),
                        f"{row['fail_pct']:.1f}",
                        fmt(row["queries"], 1),
                        fmt(row["db_ms"], 1),
                        fmt(row["app_ms"], 1),
                    ]
                    for row in endpoints
                ],
                note="Sorted by total time spent waiting for them. queries / db ms / "
                "app ms are Django's own numbers from its Server-Timing header; pages, "
                "remote calls and the tile server have none. If app ms is much higher "
                "than db ms, the cost is in Python, not SQL.",
                code_columns={0},
            )
        )

    failures = summary.get("failures", [])
    if failures:
        out.append(
            Section(
                "Failures",
                ["endpoint", "count", "error"],
                [
                    [row["name"], fmt(row["count"]), row["error"][:240]]
                    for row in failures[:20]
                ],
                note="Every distinct failure message, most frequent first. Remote "
                "calls show SvelteKit's error answer, the rest the HTTP status.",
                code_columns={0, 2},
            )
        )

    containers = summary.get("containers", [])
    if containers:
        cores = meta.get("host_cpus") or 0
        out.append(
            Section(
                "Containers",
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
                        row["name"],
                        fmt(row["cpu_avg"]),
                        fmt(row["cpu_p95"]),
                        fmt(row["cpu_max"]),
                        row["cpu_spark"],
                        fmt(row["mem_max"]),
                    ]
                    for row in containers
                ],
                note=f"CPU in docker % (100 % = one core"
                f"{f', the host has {cores * 100} %' if cores else ''}).",
            )
        )

    postgres = summary.get("postgres", {})
    if postgres.get("max_connections") is not None:
        out.append(
            Section(
                "Postgres",
                ["max connections", "max active", "avg active", "peak by role"],
                [
                    [
                        fmt(postgres["max_connections"]),
                        fmt(postgres["max_active"]),
                        fmt(postgres["avg_active"], 1),
                        ", ".join(
                            f"{role or '?'}={count}"
                            for role, count in postgres["roles"].items()
                        ),
                    ]
                ],
                note="Many short-lived connections point to no pooling (CONN_MAX_AGE).",
            )
        )
    if postgres.get("wait_events"):
        out.append(
            Section(
                "Wait events",
                ["wait event", "share"],
                [
                    [name, f"{share:.0f} %"]
                    for name, share in postgres["wait_events"].items()
                ],
                note="Active backends by wait event. LWLock/Lock means contention, IO "
                "means disk reads, Client is idle time inside a transaction.",
                level=3,
            )
        )
    delta = summary.get("db_delta") or {}
    if delta:
        reads = delta.get("blks_read", 0) + delta.get("blks_hit", 0)
        out.append(
            Section(
                "Database counters",
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
                level=3,
            )
        )
    top_sql = summary.get("top_sql", [])
    if top_sql:
        out.append(
            Section(
                "Top SQL by total time",
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
                        fmt(row["pct"], 1),
                        fmt(row["total_ms"]),
                        fmt(row["calls"]),
                        fmt(row["mean_ms"], 2),
                        fmt(row["max_ms"], 1),
                        fmt(row["rows"]),
                        fmt(row["shared_blks_read"]),
                        row["role"],
                        row["query"][:240],
                    ]
                    for row in top_sql[:15]
                ],
                note="From pg_stat_statements, reset at the start. Tile queries contain "
                "ST_AsMVT; QGIS Server runs under its own role.",
                level=3,
                code_columns={8},
            )
        )
    slow = summary.get("slow_sql") or {}
    if slow.get("top"):
        out.append(
            Section(
                f"Slow statement log ({slow['count']} over log_min_duration_statement)",
                ["ms", "statement"],
                [[fmt(entry["ms"]), entry["sql"][:200]] for entry in slow["top"][:10]],
                level=3,
                code_columns={1},
            )
        )

    nginx = summary.get("nginx") or {}
    if nginx:
        out.append(
            Section(
                "nginx",
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
                        fmt(data["requests"]),
                        fmt(data["cache"].get("HIT", 0)),
                        fmt(data["cache"].get("MISS", 0)),
                        fmt(
                            sum(
                                count
                                for status, count in data["cache"].items()
                                if status not in ("HIT", "MISS")
                            )
                        ),
                        fmt(data["rt_p95"]),
                        fmt(data["urt_p95"]),
                    ]
                    for group, data in nginx.items()
                ],
                note="rt is the time nginx spent on a request, urt the time waiting for "
                "Django (cache misses only). Basemap tiles go to the tile server "
                "directly and are not in here.",
            )
        )
    return out


def compare_sections(before: dict, after: dict) -> list[Section]:
    """Build the sections of a before/after comparison.

    Args:
        before: Summary of the baseline run.
        after: Summary of the run after a change.

    Returns:
        list[Section]: Totals, endpoints and the baseline's top SQL.
    """

    def cpu(summary: dict, name: str) -> float | None:
        """Return a container's average CPU in one run."""
        row = next(
            (c for c in summary.get("containers", []) if c["name"] == name), None
        )
        return row["cpu_avg"] if row else None

    totals = [
        ("req/s", before["totals"].get("rps"), after["totals"].get("rps")),
        ("p95 all ms", before["totals"].get("p95"), after["totals"].get("p95")),
        (
            "failed %",
            before["totals"].get("fail_pct"),
            after["totals"].get("fail_pct"),
        ),
    ] + [
        (f"{name} avg CPU %", cpu(before, name), cpu(after, name))
        for name in ("db", "backend", "frontend", "tileserver")
    ]
    out = [
        Section(
            "Totals",
            ["metric", "before", "after", "change"],
            [[name, fmt(a, 1), fmt(b, 1), change(a, b)] for name, a, b in totals],
        )
    ]

    after_rows = {row["name"]: row for row in after.get("endpoints", [])}
    rows = []
    for row in before.get("endpoints", []):
        other = after_rows.get(row["name"])
        if not other:
            continue
        rows.append(
            [
                row["name"],
                fmt(row["p95"]),
                fmt(other["p95"]),
                change(row["p95"], other["p95"]),
                fmt(row["queries"], 1),
                fmt(other["queries"], 1),
                fmt(row["db_ms"], 1),
                fmt(other["db_ms"], 1),
            ]
        )
    if rows:
        out.append(
            Section(
                "Endpoints",
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
                code_columns={0},
            )
        )

    after_sql = {row["query"][:160]: row for row in after.get("top_sql", [])}
    sql_rows = []
    for row in before.get("top_sql", [])[:15]:
        other = after_sql.get(row["query"][:160])
        sql_rows.append(
            [
                fmt(row["total_ms"]),
                fmt(other["total_ms"]) if other else "gone",
                fmt(row["mean_ms"], 2),
                fmt(other["mean_ms"], 2) if other else "–",
                row["query"][:160],
            ]
        )
    if sql_rows:
        out.append(
            Section(
                "Top SQL of the baseline",
                ["total ms before", "after", "mean before", "after", "query"],
                sql_rows,
                code_columns={4},
            )
        )
    return out


def to_markdown(title: str, parts: list[Section]) -> str:
    """Render sections as Markdown.

    Args:
        title: Top-level heading.
        parts: Sections to render.

    Returns:
        str: Markdown text.
    """
    out = [f"# {title}", ""]
    for section in parts:
        out += [f"{'#' * section.level} {section.title}", ""]
        if section.note:
            out += [section.note, ""]
        out.append("| " + " | ".join(section.headers) + " |")
        out.append("|" + "---|" * len(section.headers))
        for row in section.rows:
            cells = [
                f"`{cell}`" if index in section.code_columns else cell
                for index, cell in enumerate(row)
            ]
            out.append(
                "| " + " | ".join(cell.replace("|", "\\|") for cell in cells) + " |"
            )
        out.append("")
    return "\n".join(out)


HTML_STYLE = """
:root { color-scheme: light dark; --bg: #f7f7f8; --fg: #1d1d22; --muted: #63636e;
  --line: #dcdce2; --card: #ffffff; --accent: #2a6fdb; }
@media (prefers-color-scheme: dark) { :root { --bg: #16161a; --fg: #e8e8ee;
  --muted: #9a9aa6; --line: #2f2f38; --card: #1e1e24; --accent: #6ea2ff; } }
body { margin: 0; background: var(--bg); color: var(--fg);
  font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 1280px; margin: 0 auto; padding: 24px 16px 64px; }
h1 { font-size: 22px; margin: 0 0 4px; } h2 { font-size: 17px; margin: 28px 0 6px; }
h3 { font-size: 15px; margin: 20px 0 6px; }
p.note { color: var(--muted); margin: 0 0 8px; max-width: 900px; }
a { color: var(--accent); }
.scroll { overflow-x: auto; background: var(--card); border: 1px solid var(--line);
  border-radius: 8px; }
table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
th, td { padding: 5px 10px; border-bottom: 1px solid var(--line); text-align: right;
  white-space: nowrap; }
th { color: var(--muted); font-weight: 600; position: sticky; top: 0;
  background: var(--card); }
td:first-child, th:first-child { text-align: left; }
td.code { text-align: left; white-space: normal; min-width: 320px;
  font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }
tr:last-child td { border-bottom: 0; }
"""


def to_html(title: str, parts: list[Section], links: str = "") -> str:
    """Render sections as a standalone HTML page.

    Args:
        title: Page title and top-level heading.
        parts: Sections to render.
        links: Optional HTML shown under the heading, e.g. navigation.

    Returns:
        str: HTML document.
    """
    body = [f"<h1>{html.escape(title)}</h1>", links]
    for section in parts:
        body.append(
            f"<h{section.level}>{html.escape(section.title)}</h{section.level}>"
        )
        if section.note:
            body.append(f'<p class="note">{html.escape(section.note)}</p>')
        head = "".join(f"<th>{html.escape(h)}</th>" for h in section.headers)
        rows = "".join(
            "<tr>"
            + "".join(
                f'<td class="code">{html.escape(cell)}</td>'
                if index in section.code_columns
                else f"<td>{html.escape(cell)}</td>"
                for index, cell in enumerate(row)
            )
            + "</tr>"
            for row in section.rows
        )
        body.append(
            f'<div class="scroll"><table><thead><tr>{head}</tr></thead>'
            f"<tbody>{rows}</tbody></table></div>"
        )
    return (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        f"<title>{html.escape(title)}</title><style>{HTML_STYLE}</style></head>"
        f"<body><main>{''.join(body)}</main></body></html>"
    )
