"""Runs the real personas with Locust against the local stub of Qonnectra.

This is the end-to-end check of the load generator: every persona signs in
with its token, walks its session, sends the timing key, and the run ends
with a written report. The stub refuses what the real app would refuse, so
a broken request shape shows up as a failure here.
"""

import json
from types import SimpleNamespace

import gevent
import locust
import pytest
from locust.env import Environment

import qonnectra_loadtest.locustfile  # noqa: F401  (registers the event listeners)
from qonnectra_loadtest import docker, run
from qonnectra_loadtest.personas import EditUser, MapUser, SchemaUser, SearchUser
from qonnectra_loadtest.postgres import Postgres
from qonnectra_loadtest.shapes import Check, Steady
from tests.stub_server import TOKEN_PREFIX, StubQonnectra

PERSONAS = [MapUser, SearchUser, SchemaUser, EditUser]


@pytest.fixture
def offline_server_side(monkeypatch, tmp_path):
    """Replace the Django CLI, Postgres and Docker with canned answers."""
    accounts = []

    def fake_cli(*args, timeout=600):
        assert args[0] == "users"
        count = int(args[args.index("--count") + 1])
        accounts.append(count)
        return json.dumps(
            {
                "users": [
                    {"username": f"u{n}", "token": f"{TOKEN_PREFIX}{n}"}
                    for n in range(count)
                ]
            }
        )

    monkeypatch.setattr(run, "run_cli", fake_cli)
    monkeypatch.setattr(Postgres, "statements_ready", lambda self: True)
    monkeypatch.setattr(Postgres, "reset_statements", lambda self: None)
    monkeypatch.setattr(Postgres, "counters", lambda self: {"xact_commit": 1.0})
    monkeypatch.setattr(
        Postgres,
        "activity",
        lambda self: [
            {
                "role": "app",
                "state": "active",
                "wait_event_type": "",
                "wait_event": "",
                "connections": 2,
            }
        ],
    )
    monkeypatch.setattr(Postgres, "top_sql", lambda self, limit=50: [])
    monkeypatch.setattr(docker, "stats", lambda: [("db", 150.0, 900.0)])
    monkeypatch.setattr(docker, "container_names", lambda: [])
    monkeypatch.setenv("LOADTEST_RUNS", str(tmp_path))
    return SimpleNamespace(accounts=accounts, runs=tmp_path)


def start_run(stub: StubQonnectra, shape, users: int = 1, run_time=None, **options):
    """Create a Locust environment like the web UI does and start the shape."""
    parsed = SimpleNamespace(
        **{
            "num_users": users,
            "spawn_rate": 10,
            "run_time": run_time,
            "headless": False,
            "projects": "all",
            "cache": "on",
            "wms": True,
            "basemap": True,
            "tile_factor": 2,
            "think": 0.0,
            "viewport": "1600x900",
            "api_url": f"{stub.base}/api/v1/",
            "tiles_url": f"{stub.base}/tiles",
            "limit_tile_ms": 1000,
            "limit_err_pct": 1.0,
            **options,
        }
    )
    environment = Environment(
        user_classes=list(PERSONAS),
        shape_class=shape,
        events=locust.events,
        host=stub.base,
        parsed_options=parsed,
    )
    runner = environment.create_local_runner()
    shape.runner = runner
    locust.events.init.fire(environment=environment, runner=runner, web_ui=None)
    runner.start_shape()
    return environment, runner


def wait_until_stopped(runner, seconds: float = 60):
    """Wait for the runner to stop on its own."""
    with gevent.Timeout(seconds):
        while (
            runner.state not in ("stopped", "ready")
            or runner.shape_greenlet is not None
        ):
            gevent.sleep(0.2)


@pytest.fixture
def stub(monkeypatch):
    """Start the stub with the timing key of this process."""
    from qonnectra_loadtest.config import timing_key

    monkeypatch.setenv("DJANGO_SECRET_KEY", "test-secret")
    server = StubQonnectra(timing_key("test-secret"))
    server.start()
    yield server
    server.stop()


def test_check_runs_every_persona_once_without_failures(stub, offline_server_side):
    """Verify the Check profile: one session per persona, all requests answered."""
    environment, runner = start_run(stub, Check())
    wait_until_stopped(runner)

    stats = environment.runner.stats
    names = {entry.name for entry in stats.entries.values()}
    failures = {
        e.name: e.num_failures for e in stats.entries.values() if e.num_failures
    }
    assert failures == {}, [str(error) for error in stats.errors.values()]
    assert stub.hits["unauthenticated"] == 0
    assert stub.hits["remote-error"] == 0
    assert {
        "page:map",
        "remote:getLayerStyleAttributes",
        "wms:access_token",
        "wms:sources",
        "tile:trench",
        "tile:address",
        "tile:node",
        "tile:area",
        "tile:wms",
        "basemap:health",
        "basemap:style",
        "basemap:tilejson",
        "tile:basemap",
        "remote:searchFeatures",
        "page:network-schema",
        "write:trench-patch",
        "write:conduit-create",
        "write:conduit-delete",
    } <= names
    assert stub.hits["basemap:too-deep"] == 0
    assert offline_server_side.accounts == [4]
    assert all(user_class.fixed_count == 0 for user_class in PERSONAS)


def test_feature_tiles_are_requested_tile_factor_times(stub, offline_server_side):
    """Verify each new feature tile URL is fetched twice, like the app's two sources."""
    _, runner = start_run(stub, Check())
    wait_until_stopped(runner)

    trench_tiles = [p for p in stub.paths if "ol_trench_tiles" in p]
    assert trench_tiles and not any("_lt=" in p for p in trench_tiles)
    assert len(trench_tiles) == 2 * len(set(trench_tiles))


def test_run_writes_report_with_django_numbers(stub, offline_server_side):
    """Verify the timing key works end to end and the run folder is complete."""
    environment, runner = start_run(stub, Check())
    wait_until_stopped(runner)

    [folder] = list(offline_server_side.runs.iterdir())
    summary = json.loads((folder / "summary.json").read_text())
    trench = next(row for row in summary["endpoints"] if row["name"] == "tile:trench")
    assert trench["queries"] == 3 and trench["db_ms"] == 4.0
    assert summary["meta"]["shape"] == "Check"
    assert summary["meta"]["projects"] == ["Kassel", "loadtest-01"]
    assert summary["containers"][0]["name"] == "db"
    assert summary["postgres"]["max_connections"] == 2
    assert summary["meta"]["options"]["limit_tile_ms"] == 1000
    for name in ("report.md", "report.html", "locust.html", "nginx.log", "pg.log"):
        assert (folder / name).exists(), name
    text = (folder / "report.md").read_text()
    assert "## Endpoints" in text and "## Capacity" in text
    assert run.current.last_run == folder.name


def test_editor_only_reads_without_seeded_projects(stub, offline_server_side):
    """Verify no write reaches a real project when nothing is seeded."""
    stub.seeded = False
    _, runner = start_run(stub, Check())
    wait_until_stopped(runner)

    assert not any(kind.startswith("write:") for kind in stub.hits)
    assert stub.hits["page:map"] >= 2


def test_a_run_that_cannot_prepare_stops_with_a_message(stub, offline_server_side):
    """Verify a run without matching projects stops before any user runs."""
    _, runner = start_run(stub, Steady(), users=4, run_time=30, projects="99")
    wait_until_stopped(runner, seconds=20)

    assert "99" in run.current.error
    assert not run.current.ready
    assert stub.hits["page:map"] == 0
    assert list(offline_server_side.runs.iterdir()) == []


def test_bypass_gives_every_tile_request_its_own_url(stub, offline_server_side):
    """Verify cache=bypass defeats nginx's tile cache key, duplicates included.

    nginx locks the cache per key, so a repeated URL would be a cache hit.
    """
    _, runner = start_run(stub, Check(), cache="bypass")
    wait_until_stopped(runner)

    trench_tiles = [p for p in stub.paths if "ol_trench_tiles" in p]
    assert trench_tiles and all("&_lt=" in p for p in trench_tiles)
    assert len(set(trench_tiles)) == len(trench_tiles)
    positions = {p.split("&_lt=")[0] for p in trench_tiles}
    assert len(trench_tiles) == 2 * len(positions)
