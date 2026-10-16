"""Runs the real personas with Locust against the local stub of Qonnectra.

This is the end-to-end check of the load generator: every persona signs in
with its tokens, walks its session, sends the timing key, and the run ends
with a written report. The stub refuses what the real app would refuse, so
a broken request shape shows up as a failure here.
"""

import json
from collections import Counter
from types import SimpleNamespace

import gevent
import locust
import pytest
from locust.env import Environment
from locust.exception import CatchResponseError
from locust.stats import RequestStats

import qonnectra_loadtest.locustfile  # noqa: F401  (registers the event listeners)
from qonnectra_loadtest import client, docker, run
from qonnectra_loadtest.personas import EditUser, MapUser, SchemaUser, SearchUser
from qonnectra_loadtest.postgres import Postgres
from qonnectra_loadtest.remote import remote_id
from qonnectra_loadtest.shapes import Check, Steady
from tests.stub_server import StubQonnectra, decode_arg

PERSONAS = [MapUser, SearchUser, SchemaUser, EditUser]


@pytest.fixture
def offline_server_side(monkeypatch, tmp_path, stub):
    """Replace the Django CLI, Postgres and Docker with canned answers.

    The users CLI signs the accounts in at the stub, so it knows their
    refresh tokens.
    """
    accounts = []

    def fake_cli(*args, timeout=600):
        assert args[0] == "users"
        count = int(args[args.index("--count") + 1])
        accounts.append(count)
        return json.dumps({"users": [stub.sign_in(f"u{n}") for n in range(count)]})

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
            "global_share": 10.0,
            "switch_share": 10.0,
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
    for refused in ("unauthenticated", "remote-error", "remote-invalid"):
        assert stub.hits[refused] == 0, refused
    assert {
        "page:map",
        "remote:getLayerStyleAttributes",
        "wms:access_token",
        "wms:sources",
        "tile:trench",
        "tile:address",
        "tile:node",
        "tile:area",
        "tile:global:trench",
        "tile:global:area",
        "remote:getLayerExtent",
        "tile:wms",
        "basemap:health",
        "basemap:style",
        "basemap:tilejson",
        "tile:basemap",
        "remote:searchFeatures",
        "page:network-schema",
        "write:trench-patch",
        "command:createConduit",
        "command:updateConduit",
        "command:deleteConduit",
        "command:saveNodeGeometry",
        "command:updateAddress",
        "command:refreshSession",
    } <= names
    assert stub.hits["basemap:too-deep"] == 0
    assert offline_server_side.accounts == [4]
    assert all(user_class.fixed_count == 0 for user_class in PERSONAS)


def assert_fetched_per_source(tiles: Counter, factor: int):
    """Assert each tile came ``factor`` times for every source that needed it.

    The Check run's map session is the only one that loads feature tiles. Each
    project gets one source, so its tiles come exactly ``factor`` times. The
    global source is built again when the project switches after the global
    view went on, so a global tile comes ``factor`` or, if both sources needed
    it, twice ``factor`` times.

    Args:
        tiles: Count per tile URL, without any cache-bypass marker.
        factor: The run's tile factor.
    """
    project_tiles = {url: n for url, n in tiles.items() if "project=" in url}
    global_tiles = {url: n for url, n in tiles.items() if "project=" not in url}
    assert project_tiles and global_tiles, tiles
    assert set(project_tiles.values()) == {factor}, project_tiles
    assert set(global_tiles.values()) <= {factor, 2 * factor}, global_tiles


def test_feature_tiles_are_requested_tile_factor_times(stub, offline_server_side):
    """Verify each new feature tile URL is fetched tile_factor times per source."""
    environment, runner = start_run(stub, Check())
    wait_until_stopped(runner)

    trench_tiles = Counter(p for p in stub.paths if "ol_trench_tiles" in p)
    assert not any("_lt=" in p for p in trench_tiles)
    assert_fetched_per_source(trench_tiles, environment.parsed_options.tile_factor)


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
    assert {fn for fn, _, _ in stub.commands} == {"refreshSession"}
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
    environment, runner = start_run(stub, Check(), cache="bypass")
    wait_until_stopped(runner)

    trench_tiles = [p for p in stub.paths if "ol_trench_tiles" in p]
    assert trench_tiles and all("_lt=" in p for p in trench_tiles)
    assert len(set(trench_tiles)) == len(trench_tiles)
    assert_fetched_per_source(
        Counter(p.split("_lt=")[0] for p in trench_tiles),
        environment.parsed_options.tile_factor,
    )


def test_writes_go_through_commands_that_refresh_the_open_list(
    stub, offline_server_side
):
    """Verify the editor writes like the app: commands that refresh the table it shows."""
    _, runner = start_run(stub, Check())
    wait_until_stopped(runner)

    assert {kind for kind in stub.hits if kind.startswith("write:")} == {
        "write:trench-patch"
    }
    conduit_writes = [
        (fn, refreshes) for fn, _, refreshes in stub.commands if fn.endswith("Conduit")
    ]
    assert [fn for fn, _ in conduit_writes] == [
        "createConduit",
        "updateConduit",
        "deleteConduit",
    ]
    for _, refreshes in conduit_writes:
        [key] = refreshes
        head, _, payload = key.rpartition("/")
        assert head == remote_id("getConduitList")
        assert decode_arg(payload) == {
            "projectId": "7",
            "search": "",
            "page": 1,
            "pageSize": 50,
        }
    [created] = [arg for fn, arg, _ in stub.commands if fn == "createConduit"]
    assert created["projectId"] == 7


def test_session_refresh_rotates_tokens_and_requests_use_the_new_ones(
    stub, offline_server_side
):
    """Verify every account refreshes once in a Check run and then sends the new tokens."""
    _, runner = start_run(stub, Check())
    wait_until_stopped(runner)

    assert stub.hits["command:refreshSession"] == 4
    assert stub.hits["session-refused"] == 0
    assert stub.hits["stale-access"] == 0
    assert all(token.endswith("-1") for token in stub.refresh_tokens.values())


def test_users_sharing_an_account_keep_its_session_alive(
    stub, offline_server_side, monkeypatch
):
    """Verify tabs of one account refresh in turn and never reuse a spent token."""
    monkeypatch.setattr(run, "MAX_ACCOUNTS", 1)
    monkeypatch.setattr(client, "KEEP_ALIVE_SECONDS", 0.3)
    _, runner = start_run(stub, Steady(), users=3, run_time=3, think=0.05)
    wait_until_stopped(runner)

    assert stub.hits["command:refreshSession"] >= 3
    assert stub.hits["session-refused"] == 0
    assert stub.hits["unauthenticated"] == 0


def test_global_view_requests_tiles_and_searches_without_project(
    stub, offline_server_side
):
    """Verify the global view drops the project filter from tiles, search and lookups."""
    _, runner = start_run(
        stub, Steady(), users=8, run_time=3, global_share=100.0, switch_share=0.0
    )
    wait_until_stopped(runner)

    tiles = [p for p in stub.paths if "_tiles/" in p]
    assert tiles and not any("project=" in p for p in tiles)
    searches = [
        decode_arg(p.split("payload=")[1])
        for p in stub.paths
        if "/searchFeatures?" in p
    ]
    assert searches and all(arg["projectId"] == "" for arg in searches)


def test_project_switch_loads_the_other_project_without_a_page_load(
    stub, offline_server_side
):
    """Verify a switch reloads WMS sources and tiles of the other project, but no page."""
    _, runner = start_run(
        stub,
        Steady(),
        users=1,
        run_time=3,
        global_share=0.0,
        switch_share=100.0,
        **{"projects": "1,7"},
    )
    wait_until_stopped(runner)

    sources = Counter(p for p in stub.paths if p.startswith("/api/v1/wms-sources/?"))
    tiles = {p.split("project=")[1] for p in stub.paths if "_tiles/" in p}
    assert tiles == {"1", "7"}
    assert sum(sources.values()) > stub.hits["page:map"]


def test_failure_rows_count_each_message_most_frequent_first():
    """Verify the report gets every distinct failure with its count."""
    stats = RequestStats()
    for _ in range(3):
        stats.log_error("GET", "remote:searchFeatures", CatchResponseError("HTTP 502"))
    stats.log_error("GET", "page:map", CatchResponseError("HTTP 500"))

    rows = run.failure_rows(stats)

    assert rows == [
        {
            "name": "remote:searchFeatures",
            "method": "GET",
            "error": "CatchResponseError('HTTP 502')",
            "count": 3,
        },
        {
            "name": "page:map",
            "method": "GET",
            "error": "CatchResponseError('HTTP 500')",
            "count": 1,
        },
    ]
