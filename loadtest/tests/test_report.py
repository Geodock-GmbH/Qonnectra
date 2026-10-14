"""Checks that a run summary renders to Markdown and HTML, alone and compared."""

import copy

from qonnectra_loadtest.report import (
    change,
    compare_sections,
    sections,
    to_html,
    to_markdown,
)

SUMMARY = {
    "meta": {
        "name": "20261014-120000-ramp",
        "shape": "Ramp",
        "personas": ["MapUser", "SearchUser"],
        "options": {"projects": "loadtest", "cache": "on"},
        "version": "1.8.0",
        "start": "2026-10-14T12:00:00Z",
        "end": "2026-10-14T12:30:00Z",
        "host_cpus": 8,
        "host_mem_kb": 16 * 2**20,
    },
    "totals": {
        "users_peak": 60,
        "requests": 12345,
        "rps": 41.2,
        "fail_pct": 0.5,
        "bytes_in": 2**30,
        "p95": 812,
    },
    "timeline": [
        {
            "minute": 0,
            "users": 5,
            "rps": 10.0,
            "tile_p95": 120.0,
            "err_pct": 0.0,
            "cpu": {"db": 150.0},
            "pg_conns": 12,
        },
        {
            "minute": 1,
            "users": 10,
            "rps": 20.0,
            "tile_p95": None,
            "err_pct": 1.5,
            "cpu": {},
            "pg_conns": None,
        },
    ],
    "endpoints": [
        {
            "name": "tile:trench",
            "count": 900,
            "total_s": 90.0,
            "p50": 80,
            "p95": 400,
            "p99": 900,
            "max": 1500,
            "fail_pct": 0.0,
            "queries": 3.0,
            "db_ms": 70.0,
            "app_ms": 85.0,
        },
        {
            "name": "page:map",
            "count": 50,
            "total_s": 25.0,
            "p50": 400,
            "p95": 700,
            "p99": 800,
            "max": 900,
            "fail_pct": 2.0,
            "queries": None,
            "db_ms": None,
            "app_ms": None,
        },
    ],
    "containers": [
        {
            "name": "db",
            "cpu_avg": 300.0,
            "cpu_p95": 600.0,
            "cpu_max": 750.0,
            "cpu_spark": "▁▅█",
            "mem_max": 4000.0,
        }
    ],
    "postgres": {
        "max_connections": 40,
        "max_active": 12,
        "avg_active": 5.5,
        "roles": {"app": 38, "qgis": 2},
        "wait_events": {"IO:DataFileRead": 60.0},
    },
    "db_delta": {
        "xact_commit": 500.0,
        "blks_hit": 990.0,
        "blks_read": 10.0,
        "temp_bytes": 0.0,
    },
    "top_sql": [
        {
            "pct": 80.0,
            "total_ms": 5000.0,
            "calls": 900,
            "mean_ms": 5.5,
            "max_ms": 90.0,
            "rows": 900,
            "shared_blks_read": 3,
            "role": "app",
            "query": "SELECT ST_AsMVT(q) FROM x | y",
        }
    ],
    "slow_sql": {"count": 1, "top": [{"ms": 812.0, "sql": "SELECT 1"}]},
    "nginx": {
        "vector tiles": {
            "requests": 900,
            "cache": {"HIT": 600, "MISS": 290, "STALE": 10},
            "rt_p95": 300.0,
            "urt_p95": 280.0,
        }
    },
}


def test_markdown_has_every_section_with_its_numbers():
    """Verify the Markdown report shows each section and key values."""
    text = to_markdown("Load test x", sections(SUMMARY))

    for heading in [
        "## Run",
        "## Totals",
        "## Timeline",
        "## Endpoints",
        "## Containers",
        "## Postgres",
        "### Wait events",
        "### Database counters",
        "### Top SQL by total time",
        "### Slow statement log (1",
        "## nginx",
    ]:
        assert heading in text
    assert "| 60 | 12,345 | 41.2 | 0.50 % | 1,024 MiB | 812 ms |" in text
    assert "`SELECT ST_AsMVT(q) FROM x \\| y`" in text
    assert "| 99.00 % |" in text
    assert "| vector tiles | 900 | 600 | 290 | 10 | 300 | 280 |" in text


def test_missing_sections_are_left_out():
    """Verify a summary without server data still renders."""
    bare = {"meta": {}, "totals": {}}

    text = to_markdown("x", sections(bare))

    assert "## Totals" in text
    assert "## Containers" not in text and "## nginx" not in text


def test_html_escapes_content():
    """Verify SQL and names cannot inject markup."""
    summary = copy.deepcopy(SUMMARY)
    summary["top_sql"][0]["query"] = "<script>alert(1)</script>"

    page = to_html("Load test <x>", sections(summary))

    assert "<script>alert(1)" not in page
    assert "&lt;script&gt;" in page
    assert "<title>Load test &lt;x&gt;</title>" in page


def test_compare_shows_changes_per_endpoint_and_query():
    """Verify the comparison pairs endpoints and statements of both runs."""
    after = copy.deepcopy(SUMMARY)
    after["totals"]["p95"] = 406
    after["endpoints"][0]["p95"] = 200
    after["top_sql"] = []

    text = to_markdown("Compare", compare_sections(SUMMARY, after))

    assert "| p95 all ms | 812.0 | 406.0 | -50 % |" in text
    assert "| `tile:trench` | 400 | 200 | -50 % |" in text
    assert "| 5,000 | gone |" in text


def test_change_handles_missing_and_zero():
    """Verify relative changes never divide by zero."""
    assert change(None, 1) == "–"
    assert change(0, 1) == "–"
    assert change(100, 150) == "+50 %"
