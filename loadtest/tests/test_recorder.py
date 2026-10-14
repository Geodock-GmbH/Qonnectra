"""Checks how the recorder buckets a run and condenses it for the report."""

from qonnectra_loadtest.recorder import Recorder

START = 1_000_000.0


def recorder() -> Recorder:
    """Return a recorder whose run started at START."""
    rec = Recorder()
    rec.reset(START)
    return rec


def test_requests_land_in_their_minute():
    """Verify per-minute counts, failures and the feature-tile p95."""
    rec = recorder()
    rec.request("tile:trench", 100, False, START + 5)
    rec.request("tile:trench", 300, True, START + 10)
    rec.request("tile:basemap", 5000, False, START + 20)
    rec.request("remote:searchFeatures", 50, False, START + 70)
    rec.users(4, START + 30)
    rec.users(9, START + 75)

    first, second = rec.timeline()

    assert (first["minute"], first["users"]) == (0, 4)
    assert round(first["rps"] * 60) == 3
    assert round(first["err_pct"]) == 33
    assert first["tile_p95"] == 290
    assert (second["minute"], second["users"], second["tile_p95"]) == (1, 9, None)


def test_container_and_connection_samples_feed_timeline_and_summary():
    """Verify CPU and connection samples show up per minute and overall."""
    rec = recorder()
    rec.container_sample(START + 1, [("db", 200.0, 1024.0), ("backend", 50.0, 300.0)])
    rec.container_sample(START + 6, [("db", 400.0, 1100.0), ("backend", 70.0, 310.0)])
    rec.activity_sample(
        START + 2,
        [
            {
                "role": "app",
                "state": "active",
                "wait_event_type": "IO",
                "wait_event": "DataFileRead",
                "connections": 3,
            },
            {
                "role": "app",
                "state": "idle",
                "wait_event_type": "",
                "wait_event": "",
                "connections": 5,
            },
            {
                "role": "qgis",
                "state": "active",
                "wait_event_type": "",
                "wait_event": "",
                "connections": 1,
            },
        ],
    )

    [minute] = rec.timeline()
    summary = rec.summary({"name": "x"}, [], {})

    assert minute["cpu"] == {"db": 300.0, "backend": 60.0}
    assert minute["pg_conns"] == 9
    assert [c["name"] for c in summary["containers"]] == ["db", "backend"]
    assert summary["containers"][0]["mem_max"] == 1100.0
    assert summary["postgres"]["max_active"] == 4
    assert summary["postgres"]["roles"] == {"app": 8, "qgis": 1}
    assert summary["postgres"]["wait_events"] == {"IO:DataFileRead": 100.0}


def test_server_timing_is_merged_into_endpoint_rows():
    """Verify Django's numbers join Locust's endpoint stats by name."""
    rec = recorder()
    rec.server_timing("tile:trench", {"q": 2, "db": 10.0, "app": 30.0})
    rec.server_timing("tile:trench", {"q": 4, "db": 20.0, "app": 50.0})
    endpoints = [
        {"name": "page:map", "total_s": 1.0},
        {"name": "tile:trench", "total_s": 9.0},
    ]

    rows = rec.summary({}, endpoints, {})["endpoints"]

    assert [row["name"] for row in rows] == ["tile:trench", "page:map"]
    assert (rows[0]["queries"], rows[0]["db_ms"], rows[0]["app_ms"]) == (3, 15.0, 40.0)
    assert rows[1]["queries"] is None


def test_live_tables_have_one_entry_per_tab():
    """Verify the runner's extra tabs get rows keyed like their columns."""
    rec = recorder()
    rec.container_sample(START, [("db", 120.0, 900.0)])
    rec.server_timing("trench", {"q": 3, "db": 1.0, "app": 2.0})
    rec.top_sql = [
        {
            "query": "SELECT 1",
            "pct": 50.0,
            "total_ms": 10.0,
            "calls": 2,
            "mean_ms": 5.0,
            "rows": 2,
            "role": "app",
        }
    ]

    tables = {table["key"]: table["data"] for table in rec.live_tables()}

    assert tables["server"] == [
        {"name": "db", "cpu": 120, "cpu_avg": 120, "cpu_max": 120, "mem": 900}
    ]
    assert tables["django"][0]["queries"] == 3
    assert tables["database"][0]["name"] == "SELECT 1"
    assert tables["connections"] == []


def test_reset_forgets_the_previous_run():
    """Verify a new run starts empty."""
    rec = recorder()
    rec.request("tile:trench", 1, False, START)
    rec.reset(START + 600)

    assert rec.timeline() == []
