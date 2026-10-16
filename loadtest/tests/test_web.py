"""Checks the load-test UI: who gets in, the dashboard API, reports and the live tabs."""

import json
from types import SimpleNamespace

import locust
import pytest
import requests
from locust.argument_parser import parse_options
from locust.env import Environment

import qonnectra_loadtest.locustfile  # noqa: F401  (registers the start-form fields)

from qonnectra_loadtest import auth, jobs, run, web
from qonnectra_loadtest.auth import Verdict
from qonnectra_loadtest.personas import MapUser
from tests.test_report import SUMMARY


@pytest.fixture
def ui(monkeypatch, tmp_path):
    """Return a Flask test client of Locust's web UI with the dashboard installed.

    Locust reads the start-form defaults from ``sys.argv``, which holds
    pytest's arguments here.
    """
    monkeypatch.setattr("sys.argv", ["locust"])
    monkeypatch.setenv("LOADTEST_RUNS", str(tmp_path))
    monkeypatch.setenv("APP_DOMAIN", "app.example.com")
    verdicts = {"value": Verdict(True)}
    monkeypatch.setattr(
        auth.SuperuserGate,
        "check",
        lambda self, cookies, secure=True: verdicts["value"],
    )
    environment = Environment(
        user_classes=[MapUser],
        events=locust.events,
        host="https://app.example.com",
        parsed_options=parse_options(args=["--web-base-path", web.RUNNER]),
    )
    environment.create_local_runner()
    environment.create_web_ui(
        host="127.0.0.1", port=0, web_base_path=web.RUNNER, delayed_start=True
    )
    current = run.Run(environment)
    web.install(environment, current)
    client = environment.web_ui.app.test_client()
    return SimpleNamespace(
        client=client,
        verdicts=verdicts,
        runs=tmp_path,
        run=current,
        environment=environment,
    )


def write_run(folder, name: str, summary: dict | None = None):
    """Put a finished run with a summary into the runs folder."""
    path = folder / name
    path.mkdir()
    (path / "summary.json").write_text(json.dumps(summary or SUMMARY))
    (path / "report.md").write_text("# report")
    return path


def test_visitors_without_session_are_sent_to_the_app_login(ui):
    """Verify a page request without a session redirects to the login with a way back."""
    ui.verdicts["value"] = Verdict(False, "login")

    page = ui.client.get("/loadtest/", headers={"Accept": "text/html"})
    data = ui.client.get("/loadtest/api/status", headers={"Accept": "application/json"})
    runner = ui.client.get(
        "/loadtest/runner/stats/requests", headers={"Accept": "application/json"}
    )

    assert page.status_code == 302
    assert (
        page.headers["Location"]
        == "https://app.example.com/login?redirectTo=/loadtest/"
    )
    assert data.status_code == 401
    assert runner.status_code == 401


def test_non_superusers_are_refused(ui):
    """Verify a signed-in regular user gets 403 everywhere, Locust's routes included."""
    ui.verdicts["value"] = Verdict(False, "forbidden")

    assert ui.client.get("/loadtest/").status_code == 403
    assert ui.client.get("/loadtest/runner/").status_code == 403
    assert ui.client.post("/loadtest/runner/swarm").status_code == 403


def test_refreshed_cookies_reach_the_browser(ui):
    """Verify cookies from a token refresh are set on the response."""
    ui.verdicts["value"] = Verdict(True, set_cookies=["api-access-token=new; Path=/"])

    response = ui.client.get("/loadtest/api/status")

    assert response.headers.getlist("Set-Cookie") == ["api-access-token=new; Path=/"]


def test_dashboard_and_status(ui):
    """Verify the dashboard page and the runner status for a superuser."""
    page = ui.client.get("/loadtest/")
    status = ui.client.get("/loadtest/api/status").get_json()

    assert page.status_code == 200 and b"Load test" in page.data
    assert ui.client.get("/loadtest/static/dashboard.js").status_code == 200
    assert status["runner"]["state"] == "ready"
    assert status["job"] is None
    assert ui.client.get("/").headers["Location"] == "/loadtest/"


def test_runs_are_listed_newest_first(ui):
    """Verify finished runs show up with their headline numbers."""
    write_run(ui.runs, "20261014-100000-check")
    write_run(ui.runs, "20261014-120000-ramp")
    (ui.runs / "not-a-run").mkdir()

    runs = ui.client.get("/loadtest/api/runs").get_json()

    assert [r["name"] for r in runs] == [
        "20261014-120000-ramp",
        "20261014-100000-check",
    ]
    assert runs[0]["users"] == 60 and runs[0]["p95"] == 812


def test_report_and_files_of_a_run(ui):
    """Verify a run's report renders and only its known files are served."""
    write_run(ui.runs, "20261014-120000-ramp")
    (ui.runs / "secret.txt").write_text("nope")

    page = ui.client.get("/loadtest/runs/20261014-120000-ramp/")
    markdown = ui.client.get("/loadtest/runs/20261014-120000-ramp/report.md")

    assert page.status_code == 200 and b"Top SQL by total time" in page.data
    assert markdown.data == b"# report"
    assert (
        ui.client.get("/loadtest/runs/20261014-120000-ramp/secret.txt").status_code
        == 404
    )
    assert ui.client.get("/loadtest/runs/..%2Fsecret.txt/").status_code == 404
    assert ui.client.get("/loadtest/runs/missing/").status_code == 404


def test_compare_two_runs(ui):
    """Verify the comparison page and its Markdown version."""
    write_run(ui.runs, "a")
    write_run(ui.runs, "b")

    page = ui.client.get("/loadtest/compare?before=a&after=b")
    markdown = ui.client.get("/loadtest/compare?before=a&after=b&format=md")

    assert page.status_code == 200 and b"Compare a" in page.data
    assert markdown.data.startswith(b"# Compare a")


def test_jobs_are_refused_while_a_test_runs(ui, monkeypatch):
    """Verify seeding cannot start during a run, and bad input is rejected."""
    monkeypatch.setattr(ui.environment.runner, "state", "running")

    busy = ui.client.post("/loadtest/api/seed", json={"preset": "small"})
    monkeypatch.setattr(ui.environment.runner, "state", "ready")
    invalid = ui.client.post(
        "/loadtest/api/seed", json={"preset": "x; rm", "projects": 3}
    )

    assert busy.status_code == 409
    assert invalid.status_code == 400


def test_cross_site_posts_are_refused(ui):
    """Verify a POST from another origin cannot start a job."""
    response = ui.client.post(
        "/loadtest/api/purge", headers={"Origin": "https://evil.example"}
    )

    assert response.status_code == 403


def test_start_form_has_the_run_options(ui):
    """Verify the Qonnectra fields reach Locust's start form with their defaults."""
    ui.client.get("/loadtest/runner/")

    extra = ui.environment.web_ui.template_args["extra_options"]

    assert set(extra) >= {
        "projects",
        "cache",
        "wms",
        "basemap",
        "tile_factor",
        "think",
        "viewport",
        "api_url",
        "tiles_url",
        "limit_tile_ms",
        "limit_err_pct",
    }
    assert extra["cache"]["choices"] == ["on", "bypass"]
    assert extra["wms"]["default_value"] is True
    assert extra["tile_factor"]["default_value"] == 1


def test_start_form_keeps_users_and_spawn_rate_for_every_shape(ui):
    """Verify picking a shape in the form does not disable users and spawn rate.

    Locust decides this once per page from the shape active at load time, not
    per shape, so without the override Ramp, Steady and Spike start with 0.
    """
    ui.client.get("/loadtest/runner/")

    template_args = ui.environment.web_ui.template_args

    assert template_args["shape_use_common_options"] is True
    assert not template_args["hide_common_options"]


def test_runner_page_offers_the_live_tabs(ui):
    """Verify Locust's page gets the extra tabs and its stats carry their rows."""
    ui.run.recorder.container_sample(0, [("db", 10.0, 100.0)])

    page = ui.client.get("/loadtest/runner/")
    stats = ui.client.get("/loadtest/runner/stats/requests").get_json()

    assert page.status_code == 200
    template_args = ui.environment.web_ui.template_args
    assert [tab["key"] for tab in template_args["extended_tabs"]] == [
        "server",
        "django",
        "database",
        "connections",
    ]
    tables = {table["key"]: table["data"] for table in stats["extended_stats"]}
    assert tables["server"][0]["name"] == "db"


def postgres_check(ui, monkeypatch, libraries: list[str], changeable: bool) -> dict:
    """Return the Postgres row of the checks for a given preload state."""
    monkeypatch.setattr(ui.run.postgres, "preload", lambda: (libraries, changeable))
    monkeypatch.setattr(ui.run.postgres, "statements_ready", lambda: True)
    monkeypatch.setattr(web.docker, "available", lambda: False)

    def offline(*_args, **_kwargs):
        """Fail like an unreachable host, so the other checks end fast."""
        raise requests.ConnectionError("offline")

    monkeypatch.setattr(web.requests, "get", offline)
    monkeypatch.setattr(web.requests, "head", offline)
    checks = ui.client.get("/loadtest/api/checks?fresh=1").get_json()
    return next(row for row in checks if row["name"] == "Postgres statistics")


def test_postgres_check_offers_the_matching_switch(ui, monkeypatch):
    """Verify the check offers Switch on when off, Switch off when on."""
    off = postgres_check(ui, monkeypatch, [], True)
    on = postgres_check(ui, monkeypatch, ["pg_stat_statements", "auto_explain"], True)

    assert off["state"] == "warn" and off["action"]["state"] == "on"
    assert on["state"] == "ok" and on["action"]["state"] == "off"


def test_postgres_check_has_no_switch_for_a_command_line_preload(ui, monkeypatch):
    """Verify no switch is offered where ALTER SYSTEM cannot win."""
    row = postgres_check(ui, monkeypatch, ["pg_stat_statements"], False)

    assert row["state"] == "ok" and "action" not in row


def test_postgres_switch_runs_as_a_job(ui, monkeypatch):
    """Verify the switch starts the CLI job, and only with a valid state when idle."""
    started = []
    monkeypatch.setattr(jobs.Jobs, "_run", lambda self, job: started.append(job.args))

    accepted = ui.client.post("/loadtest/api/postgres-statistics", json={"state": "on"})
    invalid = ui.client.post(
        "/loadtest/api/postgres-statistics", json={"state": "restart"}
    )

    assert accepted.status_code == 202
    assert accepted.get_json()["label"] == "Postgres statistics on"
    assert started == [["postgres-statistics", "on"]]
    assert invalid.status_code == 400


def test_postgres_switch_is_refused_while_a_test_runs(ui, monkeypatch):
    """Verify the database is never restarted under a running test."""
    started = []
    monkeypatch.setattr(jobs.Jobs, "_run", lambda self, job: started.append(job.args))
    monkeypatch.setattr(ui.environment.runner, "state", "running")

    response = ui.client.post(
        "/loadtest/api/postgres-statistics", json={"state": "off"}
    )

    assert response.status_code == 409
    assert started == []
