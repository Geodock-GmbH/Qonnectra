"""Locust entry point for the Qonnectra load test.

Registers the start-form fields, the personas and load profiles, and hooks
the run lifecycle and the dashboard into Locust. The Dockerfile starts it as::

    locust -f qonnectra_loadtest/locustfile.py --class-picker \\
        --web-base-path /loadtest/runner
"""

import time
from pathlib import Path

from dotenv import load_dotenv
from locust import events

from qonnectra_loadtest import run, web
from qonnectra_loadtest.config import (
    DEFAULT_LIMIT_ERR_PCT,
    DEFAULT_LIMIT_TILE_MS,
    default_urls,
)
from qonnectra_loadtest.personas import EditUser, MapUser, SchemaUser, SearchUser
from qonnectra_loadtest.shapes import Check, Ramp, Spike, Steady

# Outside Docker, read the repo's deployment/.env like the backend settings do.
load_dotenv(Path(__file__).resolve().parents[2] / "deployment" / ".env")

__all__ = [
    "Check",
    "EditUser",
    "MapUser",
    "Ramp",
    "SchemaUser",
    "SearchUser",
    "Spike",
    "Steady",
]


@events.init_command_line_parser.add_listener
def add_options(parser):
    """Add the run options to Locust's command line and start form.

    Args:
        parser: Locust's argument parser.
    """
    urls = default_urls()
    parser.add_argument(
        "--projects",
        default="all",
        include_in_web_ui=True,
        help="all, loadtest (seeded only) or project ids like 1,4",
    )
    parser.add_argument(
        "--cache",
        default="on",
        choices=["on", "bypass"],
        include_in_web_ui=True,
        help="bypass gives every feature tile request a unique URL, so nginx's tile cache never hits (WMS stays cached)",
    )
    parser.add_argument(
        "--wms",
        default=True,
        action="store_true",
        include_in_web_ui=True,
        help="request WMS tiles of enabled layers",
    )
    parser.add_argument(
        "--basemap",
        default=True,
        action="store_true",
        include_in_web_ui=True,
        help="request basemap tiles from the tile server",
    )
    parser.add_argument(
        "--tile-factor",
        type=int,
        default=2,
        include_in_web_ui=True,
        help="requests per new feature tile and layer; set it from the calibration",
    )
    parser.add_argument(
        "--think",
        type=float,
        default=1.0,
        include_in_web_ui=True,
        help="multiplier on pauses; 0.5 = users act twice as fast",
    )
    parser.add_argument(
        "--viewport",
        default="1600x900",
        include_in_web_ui=True,
        help="browser window as WIDTHxHEIGHT",
    )
    parser.add_argument(
        "--api-url",
        default=urls["api"],
        include_in_web_ui=True,
        help="Django API base, e.g. https://api.example.com/api/v1/",
    )
    parser.add_argument(
        "--tiles-url",
        default=urls["tiles"],
        include_in_web_ui=True,
        help="tile server, empty to skip the basemap",
    )
    parser.add_argument(
        "--limit-tile-ms",
        type=int,
        default=DEFAULT_LIMIT_TILE_MS,
        include_in_web_ui=True,
        help="report: a minute with a feature-tile p95 above this is over the limit",
    )
    parser.add_argument(
        "--limit-err-pct",
        type=float,
        default=DEFAULT_LIMIT_ERR_PCT,
        include_in_web_ui=True,
        help="report: a minute with more failed requests than this % is over the limit",
    )


@events.init.add_listener
def on_init(environment, **_kwargs):
    """Create the run and add the dashboard to the web UI.

    Args:
        environment: Locust environment.
        **_kwargs: Other event arguments (unused).
    """
    if not environment.host:
        environment.host = default_urls()["app"]
    run.current = run.Run(environment)
    if environment.web_ui:
        web.install(environment, run.current)


@events.test_start.add_listener
def on_test_start(environment, **_kwargs):
    """Prepare users, projects and recording before the first user spawns.

    Args:
        environment: Locust environment.
        **_kwargs: Other event arguments (unused).
    """
    run.current.begin()


@events.test_stop.add_listener
def on_test_stop(environment, **_kwargs):
    """Write the run's report.

    Args:
        environment: Locust environment.
        **_kwargs: Other event arguments (unused).
    """
    run.current.finish()


@events.request.add_listener
def on_request(name, response_time, exception, **_kwargs):
    """Feed every finished request into the per-minute timeline.

    Args:
        name: Endpoint name.
        response_time: Duration in ms.
        exception: The failure, or None.
        **_kwargs: Other event arguments (unused).
    """
    if run.current is not None and run.current.ready:
        run.current.recorder.request(
            name, response_time or 0, exception is not None, time.time()
        )
