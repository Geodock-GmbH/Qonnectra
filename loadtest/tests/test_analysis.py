"""Checks the parsers for docker stats, nginx and Postgres logs, and Server-Timing."""

from qonnectra_loadtest.analysis import (
    parse_container_stat,
    parse_size,
    percentile,
    server_timing,
    short_container,
    slow_statements,
    sparkline,
    summarise_nginx,
)

NGINX = [
    '10.0.0.1 - - [14/Oct/2026:10:00:00 +0000] "GET /api/v1/ol_trench_tiles/16/1/2.mvt?project=1 HTTP/1.1" '
    '200 512 "-" "locust" "-" cache_status=MISS rt=0.120 urt=0.118',
    '10.0.0.1 - - [14/Oct/2026:10:00:01 +0000] "GET /api/v1/ol_trench_tiles/16/1/2.mvt?project=1 HTTP/1.1" '
    '200 512 "-" "locust" "-" cache_status=HIT rt=0.001 urt=-',
    '10.0.0.1 - - [14/Oct/2026:10:00:02 +0000] "GET /api/v1/wms-proxy/3/?BBOX=1 HTTP/1.1" '
    '200 9000 "-" "locust" "-" cache_status=MISS rt=0.400 urt=0.390',
    '10.0.0.1 - - [14/Oct/2026:10:00:03 +0000] "GET /api/v1/trench/ HTTP/1.1" '
    '200 10 "-" "locust" "-" cache_status= rt=0.050 urt=0.049',
    "a line without the timing fields",
]


def test_percentile_interpolates():
    """Verify the linear-interpolated percentile."""
    assert percentile([1, 2, 3, 4], 50) == 2.5
    assert percentile([], 95) == 0.0
    assert percentile([7], 99) == 7


def test_sparkline_scales_to_its_maximum_and_width():
    """Verify the sparkline uses the full range and is thinned to the width."""
    assert sparkline([0, 5, 10]) == "▁▄█"
    assert len(sparkline(list(range(1000)), width=60)) <= 60


def test_container_names_and_sizes():
    """Verify docker stats rows are shortened and converted to MiB."""
    assert short_container("qonnectra_backend_wms_prod") == "backend_wms"
    assert parse_size("1.5GiB") == 1536
    assert parse_size("512kB") == 0.5
    assert parse_container_stat(
        {"Name": "qonnectra_db_prod", "CPUPerc": "250.5%", "MemUsage": "2GiB / 6GiB"}
    ) == ("db", 250.5, 2048)
    assert parse_container_stat({"Name": "other_app", "CPUPerc": "1%"}) is None


def test_nginx_groups_cache_status_and_upstream_time():
    """Verify requests are grouped by route with HIT/MISS and Django time."""
    groups = summarise_nginx(NGINX)

    assert groups["vector tiles"]["requests"] == 2
    assert groups["vector tiles"]["cache"] == {"MISS": 1, "HIT": 1}
    assert round(groups["vector tiles"]["urt_p95"]) == 118
    assert groups["wms proxy"]["requests"] == 1
    assert groups["api (other)"]["cache"] == {"-": 1}


def test_slow_statements_are_sorted_slowest_first():
    """Verify slow-query and auto_explain lines are collected."""
    lines = [
        "LOG:  duration: 812.204 ms  statement: SELECT 1",
        "LOG:  duration: 1204.1 ms  execute <unnamed>: SELECT ST_AsMVT(x)",
        "LOG:  connection received",
    ]

    slow = slow_statements(lines)

    assert slow["count"] == 2
    assert [entry["ms"] for entry in slow["top"]] == [1204.1, 812.204]
    assert slow["top"][0]["sql"] == "SELECT ST_AsMVT(x)"


def test_server_timing_header_is_parsed():
    """Verify the middleware's header format is read back."""
    assert server_timing("app;dur=12.5, db;dur=3.1, q;dur=4") == {
        "app": 12.5,
        "db": 3.1,
        "q": 4.0,
    }
    assert server_timing(None) == {}
    assert server_timing("garbage") == {}
