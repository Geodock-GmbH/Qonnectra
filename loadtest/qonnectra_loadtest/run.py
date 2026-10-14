"""Lifecycle of one load-test run inside the Locust process.

At test start it mints tokens for the load-test users, discovers the projects
to work on, resets ``pg_stat_statements`` and starts sampling containers and
Postgres. At test stop it collects top SQL and logs and writes
``runs/<name>/`` with ``summary.json``, ``report.md``, ``report.html`` and
Locust's own ``locust.html``.
"""

import dataclasses
import itertools
import json
import logging
import os
import subprocess
import sys
import time
from datetime import UTC, datetime
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path

import gevent
from locust.html import get_html_report

from qonnectra_loadtest import docker, report
from qonnectra_loadtest.analysis import slow_statements, summarise_nginx
from qonnectra_loadtest.config import RunOptions, timing_key
from qonnectra_loadtest.fixtures import Fixture, discover
from qonnectra_loadtest.postgres import Postgres, counter_delta
from qonnectra_loadtest.recorder import Recorder

logger = logging.getLogger(__name__)

MAX_ACCOUNTS = 500
TOKEN_HOURS = 12
CONTAINER_SAMPLE_SECONDS = 5
POSTGRES_SAMPLE_SECONDS = 2
TOP_SQL_SECONDS = 15

current: "Run | None" = None
"""The run of this process, set by the locustfile on Locust's ``init`` event."""


def runs_dir() -> Path:
    """Return the directory that holds one folder per finished run."""
    return Path(os.environ.get("LOADTEST_RUNS", "/loadtest/runs"))


def run_cli(*args: str, timeout: float = 600) -> str:
    """Run ``python -m qonnectra_loadtest`` and return its stdout.

    Args:
        *args: Sub-command and its arguments.
        timeout: Seconds before giving up.

    Returns:
        str: Standard output.

    Raises:
        RuntimeError: If the command fails, with the last line of its output
            (the exception message of a traceback); the full output is logged.
    """
    result = subprocess.run(
        [sys.executable, "-m", "qonnectra_loadtest", *args],
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )
    if result.returncode != 0:
        output = (result.stderr.strip() or result.stdout.strip()).splitlines()
        logger.warning("%s failed:\n%s", " ".join(args), "\n".join(output))
        raise RuntimeError(output[-1] if output else f"exit code {result.returncode}")
    return result.stdout


def host_memory_kb() -> int:
    """Return the host's total memory in kB, 0 when unknown."""
    try:
        for line in Path("/proc/meminfo").read_text().splitlines():
            if line.startswith("MemTotal:"):
                return int(line.split()[1])
    except OSError:
        pass
    return 0


def backend_version() -> str:
    """Return the Qonnectra backend version installed in the image."""
    try:
        return version("backend")
    except PackageNotFoundError:
        return "?"


class Run:
    """State of the current or last run, shared by personas, samplers and UI."""

    def __init__(self, environment):
        """Prepare an idle run.

        Args:
            environment: Locust environment.
        """
        self.environment = environment
        self.recorder = Recorder()
        self.postgres = Postgres()
        self.timing_key = timing_key(os.environ.get("DJANGO_SECRET_KEY", ""))
        self.options: RunOptions | None = None
        self.fixture: Fixture | None = None
        self.tokens: list[str] = []
        self.error: str | None = None
        self.notes: list[str] = []
        self.ready = False
        self.started_at: datetime | None = None
        self.last_run: str | None = None
        self.samplers: list[gevent.Greenlet] = []
        self.counters_before: dict = {}
        self._token_index = itertools.count()

    @property
    def once(self) -> bool:
        """Return whether every user runs a single session (the Check profile).

        Returns:
            bool: True for profiles with ``once``.
        """
        return bool(getattr(self.environment.shape_class, "once", False))

    def next_token(self) -> str:
        """Hand out the load-test tokens round-robin, one per new user.

        Returns:
            str: An access token.
        """
        return self.tokens[next(self._token_index) % len(self.tokens)]

    def planned_users(self) -> int:
        """Return how many users the run will reach at most."""
        shape = self.environment.shape_class
        if shape is not None and hasattr(shape, "peak"):
            return shape.peak()
        return int(getattr(self.environment.parsed_options, "num_users", 1) or 1)

    def begin(self):
        """Prepare users, fixture and recording; called on ``test_start``.

        A failure stops the run again and is shown on the dashboard.
        """
        self.ready = False
        self.error = None
        self.notes = []
        self.started_at = datetime.now(UTC)
        self.recorder.reset(time.time())
        self._token_index = itertools.count()
        try:
            self.options = RunOptions.from_parsed(
                self.environment.parsed_options, self.environment.host
            )
            accounts = min(MAX_ACCOUNTS, max(1, self.planned_users()))
            payload = json.loads(
                run_cli("users", "--count", str(accounts), "--hours", str(TOKEN_HOURS))
            )
            self.tokens = [user["token"] for user in payload["users"]]
            self.fixture = discover(self.options, self.tokens[0])
        except Exception as error:
            self.error = str(error)
            logger.error("Run cannot start: %s", error)
            gevent.spawn_later(0.5, self.environment.runner.stop)
            return

        if not self.timing_key:
            self.notes.append("No DJANGO_SECRET_KEY, so no per-endpoint DB numbers.")
        try:
            if self._pg(self.postgres.statements_ready):
                self._pg(self.postgres.reset_statements)
            else:
                self.notes.append(
                    "pg_stat_statements is not preloaded; restart the db container."
                )
            self.counters_before = self._pg(self.postgres.counters)
        except Exception as error:
            self.notes.append(f"Postgres statistics unavailable: {error}")
        self.samplers = [
            gevent.spawn(self._sample_containers),
            gevent.spawn(self._sample_postgres),
        ]
        self.ready = True
        logger.info(
            "Run ready: %d projects, %d accounts",
            len(self.fixture.projects),
            len(self.tokens),
        )

    def _pg(self, call, *args):
        """Run a blocking Postgres call in gevent's thread pool."""
        return gevent.get_hub().threadpool.apply(call, args)

    def _sample_containers(self):
        """Sample container CPU and memory until the run ends."""
        while True:
            rows = docker.stats()
            if rows:
                self.recorder.container_sample(time.time(), rows)
            gevent.sleep(CONTAINER_SAMPLE_SECONDS)

    def _sample_postgres(self):
        """Sample connections, users and (less often) top SQL until the run ends."""
        last_top = 0.0
        while True:
            now = time.time()
            runner = self.environment.runner
            if runner is not None:
                self.recorder.users(runner.user_count, now)
            try:
                self.recorder.activity_sample(now, self._pg(self.postgres.activity))
                if now - last_top >= TOP_SQL_SECONDS:
                    self.recorder.top_sql = self._pg(self.postgres.top_sql, 25)
                    last_top = now
            except Exception as error:
                logger.debug("Postgres sample failed: %s", error)
            gevent.sleep(POSTGRES_SAMPLE_SECONDS)

    def finish(self):
        """Stop sampling and write the run directory; called on ``test_stop``."""
        restore = getattr(self.environment.shape_class, "restore", None)
        if restore:
            restore()
        gevent.killall(self.samplers)
        self.samplers = []
        if not self.ready:
            return
        self.ready = False
        ended = datetime.now(UTC)
        try:
            self.last_run = self._write(ended)
            logger.info("Report written to %s", runs_dir() / self.last_run)
        except Exception:
            logger.exception("Writing the report failed")

    def _collect_server(
        self, start: str, end: str
    ) -> tuple[dict, list[str], list[str]]:
        """Collect top SQL, counters and logs at the end of a run."""
        extra: dict = {}
        try:
            extra["top_sql"] = self._pg(self.postgres.top_sql, 50)
            extra["db_delta"] = counter_delta(
                self.counters_before, self._pg(self.postgres.counters)
            )
        except Exception as error:
            logger.warning("Postgres statistics unavailable: %s", error)
        names = docker.container_names()
        nginx_name = docker.find_container("nginx", names)
        db_name = docker.find_container("db", names)
        nginx_lines = docker.logs(nginx_name, start, end) if nginx_name else []
        pg_lines = docker.logs(db_name, start, end) if db_name else []
        extra["nginx"] = summarise_nginx(nginx_lines)
        extra["slow_sql"] = slow_statements(pg_lines)
        return extra, nginx_lines, pg_lines

    def endpoint_stats(self) -> tuple[list[dict], dict]:
        """Return per-endpoint and total statistics from Locust."""
        stats = self.environment.runner.stats
        endpoints = []
        for entry in stats.entries.values():
            if not entry.num_requests:
                continue
            endpoints.append(
                {
                    "name": entry.name,
                    "method": entry.method,
                    "count": entry.num_requests,
                    "failures": entry.num_failures,
                    "fail_pct": 100 * entry.fail_ratio,
                    "total_s": entry.total_response_time / 1000,
                    "avg": entry.avg_response_time,
                    "p50": entry.get_response_time_percentile(0.5),
                    "p95": entry.get_response_time_percentile(0.95),
                    "p99": entry.get_response_time_percentile(0.99),
                    "max": entry.max_response_time,
                }
            )
        total = stats.total
        totals = {
            "requests": total.num_requests,
            "rps": total.total_rps,
            "fail_pct": 100 * total.fail_ratio,
            "p95": total.get_response_time_percentile(0.95),
            "bytes_in": total.total_content_length,
            "users_peak": max(
                (minute["users"] for minute in self.recorder.minutes.values()),
                default=0,
            ),
        }
        return endpoints, totals

    def _write(self, ended: datetime) -> str:
        """Write all files of the finished run and return its folder name."""
        started = self.started_at or ended
        shape = self.environment.shape_class
        name = f"{started:%Y%m%d-%H%M%S}-{type(shape).__name__.lower() if shape else 'manual'}"
        folder = runs_dir() / name
        folder.mkdir(parents=True, exist_ok=True)

        start_text = started.strftime("%Y-%m-%dT%H:%M:%SZ")
        end_text = ended.strftime("%Y-%m-%dT%H:%M:%SZ")
        extra, nginx_lines, pg_lines = self._collect_server(start_text, end_text)
        endpoints, totals = self.endpoint_stats()
        options = dataclasses.asdict(self.options) if self.options else {}
        options.pop("viewport", None)
        meta = {
            "name": name,
            "shape": type(shape).__name__ if shape else "manual",
            "personas": sorted(c.__name__ for c in self.environment.user_classes),
            "options": options,
            "projects": [p.name for p in self.fixture.projects] if self.fixture else [],
            "version": backend_version(),
            "start": start_text,
            "end": end_text,
            "host_cpus": os.cpu_count() or 0,
            "host_mem_kb": host_memory_kb(),
            "notes": self.notes,
        }
        summary = self.recorder.summary(meta, endpoints, totals, extra)

        (folder / "summary.json").write_text(json.dumps(summary, indent=1))
        parts = report.sections(summary)
        title = f"Load test {name}"
        (folder / "report.md").write_text(report.to_markdown(title, parts))
        (folder / "report.html").write_text(report.to_html(title, parts))
        (folder / "locust.html").write_text(
            get_html_report(self.environment, show_download_link=False)
        )
        (folder / "nginx.log").write_text("\n".join(nginx_lines))
        (folder / "pg.log").write_text("\n".join(pg_lines))
        return name
