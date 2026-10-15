"""The load-test UI around Locust's own runner.

``/loadtest/`` is the dashboard: checks, test data, past runs and reports.
``/loadtest/runner/`` is Locust's web UI for starting, watching and
stopping a run, with extra live tabs for containers, Django and Postgres.
Everything, Locust's routes included, is for Qonnectra superusers only.
"""

import html
import json
import logging
import re
import time
from pathlib import Path
from urllib.parse import quote, urlparse

import gevent
import requests
from flask import (
    Blueprint,
    Response,
    abort,
    g,
    jsonify,
    redirect,
    request,
    send_from_directory,
)

from qonnectra_loadtest import docker, report
from qonnectra_loadtest.auth import SuperuserGate
from qonnectra_loadtest.client import TIMING_HEADER
from qonnectra_loadtest.config import internal_api_url
from qonnectra_loadtest.jobs import Jobs
from qonnectra_loadtest.run import Run, run_cli, runs_dir

logger = logging.getLogger(__name__)

BASE = "/loadtest"
RUNNER = f"{BASE}/runner"
STATIC = Path(__file__).parent / "static"
RUN_NAME = re.compile(r"^[\w.-]+$")
RUN_FILES = {
    "report.md",
    "report.html",
    "locust.html",
    "summary.json",
    "nginx.log",
    "pg.log",
}
CHECKS_SECONDS = 30
DATA_SECONDS = 60

LIVE_TABS = [
    (
        "server",
        "Server",
        [
            ("name", "Container"),
            ("cpu", "CPU % now"),
            ("cpu_avg", "CPU % avg"),
            ("cpu_max", "CPU % max"),
            ("mem", "RAM MiB"),
        ],
    ),
    (
        "django",
        "Django",
        [
            ("name", "Endpoint"),
            ("samples", "Measured"),
            ("queries", "Queries"),
            ("db_ms", "DB ms"),
            ("app_ms", "App ms"),
        ],
    ),
    (
        "database",
        "Top SQL",
        [
            ("pct", "% of DB time"),
            ("total_ms", "Total ms"),
            ("calls", "Calls"),
            ("mean_ms", "Mean ms"),
            ("rows", "Rows"),
            ("role", "Role"),
            ("name", "Query"),
        ],
    ),
    (
        "connections",
        "Connections",
        [
            ("name", "Role"),
            ("state", "State"),
            ("wait", "Wait event"),
            ("connections", "Connections"),
        ],
    ),
]


class Cached:
    """A value that is recomputed after it expires or is dropped."""

    def __init__(self, compute, seconds: float):
        """Wrap a computation.

        Args:
            compute: Callable without arguments.
            seconds: How long a result stays valid.
        """
        self.compute = compute
        self.seconds = seconds
        self.value = None
        self.expires = 0.0

    def get(self):
        """Return the cached value, computing it when stale."""
        if time.time() >= self.expires:
            self.value = self.compute()
            self.expires = time.time() + self.seconds
        return self.value

    def drop(self):
        """Forget the value, so the next read recomputes it."""
        self.expires = 0.0


def check_rows(run: Run) -> list[dict]:
    """Check what a useful run needs and say what to fix.

    The app and tile server are checked at the URLs the start form uses.

    Args:
        run: The process's run, for its environment, Postgres connection and
            timing key.

    Returns:
        list[dict]: ``name``, ``state`` (ok, warn, fail), ``detail`` and, where
            the dashboard can fix it, an ``action``.
    """
    app_url = (run.environment.host or "").rstrip("/")
    tiles_url = str(
        getattr(run.environment.parsed_options, "tiles_url", "") or ""
    ).rstrip("/")
    api = internal_api_url()

    def postgres():
        """Check that pg_stat_statements is preloaded and offer to switch it."""
        pool = gevent.get_hub().threadpool
        libraries, changeable = pool.apply(run.postgres.preload)
        if "pg_stat_statements" in libraries:
            pool.apply(run.postgres.statements_ready)
            if not changeable:
                return "ok", "Preloaded on the db container's command line."
            return (
                "ok",
                "Top SQL and the slow-query log are on. Switch them off before "
                "removing the add-on.",
                {"state": "off", "label": "Switch off"},
            )
        if not changeable:
            return (
                "warn",
                "shared_preload_libraries is set on the db container's command "
                "line: add pg_stat_statements,auto_explain there.",
            )
        return (
            "warn",
            "Off, so the report has no top SQL and no slow-query log.",
            {"state": "on", "label": "Switch on"},
        )

    def server_timing():
        """Check that Django answers the timing key with a Server-Timing header."""
        if not run.timing_key:
            return "warn", "DJANGO_SECRET_KEY is missing in this container."
        response = requests.get(
            f"{api}config/",
            headers={TIMING_HEADER: run.timing_key},
            timeout=5,
            allow_redirects=False,
        )
        if "Server-Timing" in response.headers:
            return "ok", "Django reports queries and DB time per request."
        return "warn", "No Server-Timing header: rebuild the backend image."

    def containers():
        """Check that the Docker socket is mounted."""
        if docker.available():
            return "ok", "Container CPU and RAM are sampled."
        return "warn", "No Docker socket: the report has no container numbers."

    def app():
        """Check that the app's login page answers."""
        if not app_url:
            return "fail", "No app URL: set APP_DOMAIN or the Host field of the runner."
        response = requests.get(f"{app_url}/login", timeout=10, allow_redirects=False)
        if response.ok:
            return "ok", app_url
        return "fail", f"{app_url}/login answered HTTP {response.status_code}."

    def tiles():
        """Check the tile server's health endpoint."""
        if not tiles_url:
            return (
                "warn",
                "No tile server URL (PUBLIC_TILE_SERVER_URL): no basemap tiles.",
            )
        response = requests.head(f"{tiles_url}/health", timeout=10)
        if response.ok:
            return "ok", tiles_url
        return (
            "warn",
            f"Health check answered HTTP {response.status_code}: no basemap tiles.",
        )

    checks = [
        ("Postgres statistics", postgres),
        ("Per-endpoint DB numbers", server_timing),
        ("Container stats", containers),
        ("App", app),
        ("Tile server", tiles),
    ]

    def run_check(name, check):
        """Run one check and turn any error into a failed row."""
        try:
            state, detail, *action = check()
        except Exception as error:
            state, detail, action = "fail", str(error)[:200], []
        row = {"name": name, "state": state, "detail": detail}
        if action:
            row["action"] = action[0]
        return row

    greenlets = [gevent.spawn(run_check, name, check) for name, check in checks]
    gevent.joinall(greenlets, timeout=20)
    return [
        greenlet.value or {"name": name, "state": "fail", "detail": "Timed out"}
        for greenlet, (name, _) in zip(greenlets, checks)
    ]


def data_overview() -> dict:
    """Return seeded projects, user count and presets from the CLI."""
    try:
        return json.loads(run_cli("status", timeout=60))
    except Exception as error:
        return {"error": str(error)[:300], "projects": [], "users": 0, "presets": {}}


def run_rows() -> list[dict]:
    """List finished runs, newest first, with their headline numbers.

    Returns:
        list[dict]: Name, profile, times, personas, projects and totals per run.
    """
    rows = []
    folder = runs_dir()
    if not folder.exists():
        return rows
    for path in sorted(folder.iterdir(), reverse=True):
        summary_file = path / "summary.json"
        if not summary_file.is_file():
            continue
        try:
            summary = json.loads(summary_file.read_text())
        except (OSError, json.JSONDecodeError):
            continue
        meta, totals = summary.get("meta", {}), summary.get("totals", {})
        rows.append(
            {
                "name": path.name,
                "shape": meta.get("shape"),
                "start": meta.get("start"),
                "end": meta.get("end"),
                "personas": meta.get("personas", []),
                "projects": meta.get("projects", []),
                "users": totals.get("users_peak"),
                "rps": totals.get("rps"),
                "p95": totals.get("p95"),
                "fail_pct": totals.get("fail_pct"),
                "requests": totals.get("requests"),
            }
        )
    return rows


def load_summary(name: str) -> dict:
    """Return the summary of a run, or abort with 404.

    Args:
        name: Run folder name.

    Returns:
        dict: Content of the run's ``summary.json``.
    """
    if not RUN_NAME.match(name):
        abort(404)
    path = runs_dir() / name / "summary.json"
    if not path.is_file():
        abort(404)
    return json.loads(path.read_text())


def report_links(*items: tuple[str, str]) -> str:
    """Return the navigation line shown above a rendered report."""
    links = [
        f'<a href="{html.escape(href)}">{html.escape(label)}</a>'
        for label, href in items
    ]
    return f'<p class="note">{" · ".join(links)}</p>'


def install(environment, run: Run):
    """Add the dashboard, the access gate and the live tabs to Locust's web UI.

    Args:
        environment: Locust environment whose ``web_ui`` exists.
        run: The process's run.
    """
    web_ui = environment.web_ui
    app = web_ui.app
    gate = SuperuserGate(internal_api_url())
    jobs = Jobs()
    checks = Cached(lambda: check_rows(run), CHECKS_SECONDS)
    data = Cached(data_overview, DATA_SECONDS)

    def job_finished():
        """Recompute what a job may have changed."""
        data.drop()
        checks.drop()

    jobs.on_finish = job_finished

    @app.before_request
    def require_superuser():
        """Let only Qonnectra superusers through, refreshing their session if needed."""
        secure = request.headers.get("X-Forwarded-Proto", request.scheme) == "https"
        try:
            verdict = gate.check(request.cookies, secure=secure)
        except requests.RequestException as error:
            logger.warning("Access check failed: %s", error)
            return Response("Qonnectra's API is not reachable.", status=503)
        g.set_cookies = verdict.set_cookies
        if verdict.allowed:
            return None
        if verdict.reason == "forbidden":
            return Response("The load test is only for superusers.", status=403)
        if request.method == "GET" and request.accept_mimetypes.accept_html:
            target = quote(request.full_path.rstrip("?"), safe="/")
            login = f"/login?redirectTo={target}"
            app_url = (environment.host or "").rstrip("/")
            same_host = urlparse(app_url).netloc == request.host
            response = redirect(
                login if same_host or not app_url else f"{app_url}{login}"
            )
        else:
            response = jsonify({"error": "Sign in to Qonnectra first."})
            response.status_code = 401
        for value in verdict.set_cookies:
            response.headers.add("Set-Cookie", value)
        return response

    @app.after_request
    def pass_on_cookies(response):
        """Forward refreshed session cookies and add the live tab data."""
        for value in getattr(g, "set_cookies", []):
            response.headers.add("Set-Cookie", value)
        if request.path == f"{RUNNER}/stats/requests" and response.status_code == 200:
            try:
                payload = json.loads(response.get_data())
                payload["extended_stats"] = run.recorder.live_tables()
                response.set_data(json.dumps(payload))
            except (ValueError, TypeError):
                pass
        return response

    @app.before_request
    def refuse_cross_site_posts():
        """Reject state-changing requests that come from another site."""
        if request.method in ("POST", "PUT", "DELETE"):
            origin = request.headers.get("Origin")
            if origin and urlparse(origin).netloc != request.host:
                return Response("Cross-site request refused.", status=403)
        return None

    locust_template_args = web_ui.update_template_args

    def template_args_with_common_options():
        """Keep users and spawn rate editable whichever shape the form picks.

        Locust disables both fields for every shape when the shape active at
        page load lacks ``use_common_options``. Steady, Ramp and Spike read
        them; Check ignores them.
        """
        locust_template_args()
        web_ui.template_args["shape_use_common_options"] = True
        web_ui.template_args["hide_common_options"] = False

    web_ui.update_template_args = template_args_with_common_options

    web_ui.template_args["extended_tabs"] = [
        {"key": key, "title": title} for key, title, _ in LIVE_TABS
    ]
    web_ui.template_args["extended_tables"] = [
        {"key": key, "structure": [{"key": k, "title": t} for k, t in columns]}
        for key, _, columns in LIVE_TABS
    ]
    web_ui.template_args["extended_csv_files"] = [
        {
            "href": f"{BASE}/",
            "title": "Load-test dashboard: test data, checks and reports",
        }
    ]

    pages = Blueprint("qonnectra_loadtest", __name__, url_prefix=BASE)

    @app.route("/")
    def root():
        """Send visitors of the bare port to the dashboard."""
        return redirect(f"{BASE}/")

    @pages.route("/")
    def dashboard():
        """Serve the dashboard page."""
        return send_from_directory(STATIC, "dashboard.html")

    @pages.route("/static/<path:name>")
    def static_file(name: str):
        """Serve the dashboard's script and styles."""
        return send_from_directory(STATIC, name)

    @pages.route("/api/status")
    def status():
        """Return runner state, current run and job, polled every few seconds."""
        runner = environment.runner
        return jsonify(
            {
                "runner": {
                    "state": runner.state if runner else "missing",
                    "users": runner.user_count if runner else 0,
                    "ready": run.ready,
                    "error": run.error,
                    "notes": run.notes,
                    "last_run": run.last_run,
                },
                "job": jobs.current.snapshot() if jobs.current else None,
            }
        )

    @pages.route("/api/checks")
    def check_status():
        """Return the setup checks; ``?fresh=1`` recomputes them."""
        if request.args.get("fresh"):
            checks.drop()
        return jsonify(checks.get())

    @pages.route("/api/data")
    def data_status():
        """Return seeded projects and load-test users; ``?fresh=1`` recomputes."""
        if request.args.get("fresh"):
            data.drop()
        return jsonify(data.get())

    def start_job(label: str, args: list[str]):
        """Start a job unless a run or another job is active."""
        runner = environment.runner
        if runner and runner.state in ("spawning", "running"):
            return jsonify({"error": "Stop the running test first."}), 409
        try:
            job = jobs.start(label, args)
        except RuntimeError as error:
            return jsonify({"error": str(error)}), 409
        return jsonify(job.snapshot()), 202

    @pages.route("/api/seed", methods=["POST"])
    def seed():
        """Seed load-test projects with the chosen preset."""
        body = request.get_json(silent=True) or {}
        preset = str(body.get("preset", "small"))
        projects = int(body.get("projects", 3))
        if not re.fullmatch(r"[a-z]+", preset) or not 1 <= projects <= 20:
            return jsonify({"error": "Invalid preset or project count."}), 400
        return start_job(
            f"Seed {preset}", ["seed", "--preset", preset, "--projects", str(projects)]
        )

    @pages.route("/api/purge", methods=["POST"])
    def purge():
        """Delete load-test projects and users."""
        return start_job("Purge", ["purge"])

    @pages.route("/api/postgres-statistics", methods=["POST"])
    def postgres_statistics():
        """Switch top SQL and the slow-query log on or off; restarts the database."""
        state = (request.get_json(silent=True) or {}).get("state")
        if state not in ("on", "off"):
            return jsonify({"error": "state must be on or off."}), 400
        return start_job(f"Postgres statistics {state}", ["postgres-statistics", state])

    @pages.route("/api/runs")
    def runs():
        """List finished runs."""
        return jsonify(run_rows())

    @pages.route("/runs/<name>/")
    def run_report(name: str):
        """Render one run's report with links to its other files."""
        summary = load_summary(name)
        links = report_links(
            ("Dashboard", f"{BASE}/"),
            ("Locust report", "locust.html"),
            ("Markdown", "report.md"),
            ("summary.json", "summary.json"),
            ("nginx log", "nginx.log"),
            ("Postgres log", "pg.log"),
        )
        notes = "".join(
            f'<p class="note">{html.escape(note)}</p>'
            for note in summary.get("meta", {}).get("notes", [])
        )
        return report.to_html(
            f"Load test {name}", report.sections(summary), links + notes
        )

    @pages.route("/runs/<name>/<file>")
    def run_file(name: str, file: str):
        """Serve one recorded file of a run."""
        if not RUN_NAME.match(name) or file not in RUN_FILES:
            abort(404)
        mimetype = {
            ".md": "text/markdown; charset=utf-8",
            ".log": "text/plain; charset=utf-8",
        }.get(Path(file).suffix)
        return send_from_directory(runs_dir() / name, file, mimetype=mimetype)

    @pages.route("/compare")
    def compare():
        """Compare two runs; ``format=md`` returns Markdown."""
        before_name = request.args.get("before", "")
        after_name = request.args.get("after", "")
        before, after = load_summary(before_name), load_summary(after_name)
        title = f"Compare {before_name} → {after_name}"
        parts = report.compare_sections(before, after)
        if request.args.get("format") == "md":
            return Response(
                report.to_markdown(title, parts),
                mimetype="text/markdown; charset=utf-8",
            )
        links = report_links(
            ("Dashboard", f"{BASE}/"),
            (before_name, f"{BASE}/runs/{before_name}/"),
            (after_name, f"{BASE}/runs/{after_name}/"),
            (
                "Markdown",
                f"{BASE}/compare?before={before_name}&after={after_name}&format=md",
            ),
        )
        return report.to_html(title, parts, links)

    app.register_blueprint(pages)
