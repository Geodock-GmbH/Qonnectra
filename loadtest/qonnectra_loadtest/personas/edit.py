"""Editor persona: edits trench attributes and creates and deletes a conduit.

That fires the trench triggers, history rows and the microduct generation
signal. It only ever writes to seeded ``loadtest-*`` projects and deletes
what it creates. Without a seeded project in the run, an editor only reads:
it does a map session instead.
"""

import itertools
import random
import time
from datetime import UTC, datetime

from qonnectra_loadtest.client import Browser
from qonnectra_loadtest.fixtures import Fixture
from qonnectra_loadtest.personas.map import map_session

_names = itertools.count()


def edit_session(browser: Browser, fixture: Fixture):
    """Run one editing session.

    Args:
        browser: The user's browser.
        fixture: The run's projects and lookups.
    """
    seeded = [project for project in fixture.projects if project.seeded]
    if not seeded:
        map_session(browser, fixture.projects)
        return
    project = random.choice(seeded)

    trenches = project.features.get("trench") or []
    if trenches:
        browser.api_write(
            "PATCH",
            f"trench/{random.choice(trenches)}/",
            "write:trench-patch",
            {"comment": f"loadtest {datetime.now(UTC).isoformat()}"},
        )
    browser.think(5, 15)

    if fixture.conduit_type_id is None or fixture.flag_id is None:
        return
    created = browser.api_write(
        "POST",
        "conduit/",
        "write:conduit-create",
        {
            "name": f"loadtest-{next(_names)}-{int(time.time() * 1000)}",
            "conduit_type_id": fixture.conduit_type_id,
            "project_id": project.id,
            "flag_id": fixture.flag_id,
        },
    )
    try:
        body = created.json()
        uuid = body.get("uuid") or body.get("id")
    except (ValueError, TypeError, AttributeError):
        uuid = None
    browser.think(3, 10)
    if uuid:
        browser.api_write("DELETE", f"conduit/{uuid}/", "write:conduit-delete")
