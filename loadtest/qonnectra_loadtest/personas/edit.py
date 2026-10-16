"""Editor persona: edits seeded data through the app, like a planner at work.

It saves addresses, drags nodes in the network schema and creates, renames
and deletes a conduit in the conduit table, all through the app's remote
commands, so SvelteKit's share of a write is part of the load, including
the conduit list a write refreshes in the same request. A trench comment
goes straight to Django, like an edit from QGIS. The writes fire the
triggers, history rows and the microduct generation signal.

It only ever writes to seeded ``loadtest-*`` projects and deletes the
conduits it creates. It picks the project like a planner does, so the
unconfigured project only gets ``unconfigured share`` of the sessions. Without a seeded project in the run, an editor only
reads: it does a map session instead.
"""

import itertools
import random
import time
from datetime import UTC, datetime

from qonnectra_loadtest.client import Browser
from qonnectra_loadtest.fixtures import Fixture, Project
from qonnectra_loadtest.personas.map import map_session, weighted
from qonnectra_loadtest.personas.schema import open_schema, pick_project
from qonnectra_loadtest.remote import remote_key

TASKS = {"conduit": 3, "node": 3, "address": 2, "trench": 2}

CONDUIT_PAGE_SIZE = 50
"""The conduit table's default page size (``DEFAULT_PAGE_SIZE``)."""

NODE_NUDGE = 40
"""Largest distance a dragged node moves on the canvas, in canvas units."""

_names = itertools.count()


def edit_trench(browser: Browser, project: Project, fixture: Fixture):
    """Change a trench comment directly in Django, as QGIS does.

    Args:
        browser: The user's browser.
        project: A seeded project.
        fixture: The run's lookups (unused).
    """
    if not project.trench_ids:
        return
    browser.api_write(
        "PATCH",
        f"trench/{random.choice(project.trench_ids)}/?project={project.id}",
        "write:trench-patch",
        {"comment": f"loadtest {datetime.now(UTC).isoformat()}"},
    )


def edit_conduit(browser: Browser, project: Project, fixture: Fixture):
    """Create a conduit in the conduit table, rename it, then delete it.

    Every write refreshes the table page the user looks at, like
    ``.updates(getConduitList)`` in the app.

    Args:
        browser: The user's browser.
        project: A seeded project.
        fixture: The run's lookups.
    """
    if fixture.conduit_type_id is None or fixture.flag_id is None:
        return
    path = f"/project/{project.id}/conduit"
    browser.page(path, "page:conduit")
    shown = [
        remote_key(
            "getConduitList",
            {
                "projectId": str(project.id),
                "search": "",
                "page": 1,
                "pageSize": CONDUIT_PAGE_SIZE,
            },
        )
    ]
    fields = {"conduit_type_id": fixture.conduit_type_id, "flag_id": fixture.flag_id}
    name = f"loadtest-{next(_names)}-{int(time.time() * 1000)}"

    browser.think(5, 15)
    created = browser.command(
        "createConduit", {"projectId": project.id, "name": name, **fields}, path, shown
    )
    uuid = created.get("uuid") if isinstance(created, dict) else None
    if not uuid:
        return

    browser.think(2, 5)
    browser.remote("getConduit", uuid, path, f"?conduit={uuid}")
    browser.think(3, 10)
    browser.command(
        "updateConduit", {"uuid": uuid, "name": f"{name}-r", **fields}, path, shown
    )
    browser.think(2, 5)
    browser.command("deleteConduit", uuid, path, shown)


def canvas_position(details) -> tuple[float, float] | None:
    """Return a node's position in the network schema.

    Args:
        details: The node as ``getNodeDetails`` returns it, a GeoJSON feature.

    Returns:
        tuple[float, float] | None: ``(canvas_x, canvas_y)``, or None for a
            node that is not on the canvas.
    """
    if not isinstance(details, dict):
        return None
    properties = details.get("properties") or details
    x, y = properties.get("canvas_x"), properties.get("canvas_y")
    if isinstance(x, int | float) and isinstance(y, int | float):
        return float(x), float(y)
    return None


def edit_node(browser: Browser, project: Project, fixture: Fixture):
    """Select nodes in the network schema and drag them a little.

    Args:
        browser: The user's browser.
        project: A seeded project.
        fixture: The run's lookups (unused).
    """
    nodes = project.features.get("node") or []
    if not nodes:
        return
    path = open_schema(browser, project)
    for _ in range(random.randint(1, 3)):
        browser.think(2, 6)
        uuid = random.choice(nodes)
        position = canvas_position(browser.remote("getNodeDetails", uuid, path))
        if position is None:
            continue
        browser.think(1, 3)
        browser.command(
            "saveNodeGeometry",
            {
                "nodeId": uuid,
                "x": position[0] + random.uniform(-NODE_NUDGE, NODE_NUDGE),
                "y": position[1] + random.uniform(-NODE_NUDGE, NODE_NUDGE),
            },
            path,
        )


def address_form(address: dict) -> dict:
    """Return what the address form saves, from the address it loaded.

    Args:
        address: The address as ``getAddress`` returns it.

    Returns:
        dict: The ``updateAddress`` argument with unchanged values.
    """
    return {
        "uuid": address["uuid"],
        "street": address.get("street") or "",
        "housenumber": address.get("housenumber"),
        "house_number_suffix": address.get("house_number_suffix") or "",
        "zip_code": address.get("zip_code") or "",
        "city": address.get("city") or "",
        "district": address.get("district") or "",
        "status_development_id": (address.get("status_development") or {}).get("id"),
        "flag_id": (address.get("flag") or {}).get("id"),
        "id_address": address.get("id_address") or "",
        "id_address_2": address.get("id_address_2") or "",
    }


def edit_address(browser: Browser, project: Project, fixture: Fixture):
    """Open an address from the address list and save its form.

    Args:
        browser: The user's browser.
        project: A seeded project.
        fixture: The run's lookups (unused).
    """
    addresses = project.features.get("address") or []
    if not addresses:
        return
    list_path = f"/project/{project.id}/address"
    browser.page(list_path, "page:address")
    browser.think(2, 6)

    uuid = random.choice(addresses)
    path = f"{list_path}/{uuid}"
    address = browser.remote("getAddress", uuid, path)
    browser.remote("getAddressLinks", uuid, path)
    browser.remote("getStatusDevelopmentOptions", None, path)
    browser.remote("getFlagOptions", None, path)
    if not isinstance(address, dict) or "uuid" not in address:
        return
    browser.think(5, 15)
    browser.command("updateAddress", address_form(address), path)


TASK_STEPS = {
    "conduit": edit_conduit,
    "node": edit_node,
    "address": edit_address,
    "trench": edit_trench,
}


def edit_session(browser: Browser, fixture: Fixture, cover_all: bool = False):
    """Run one editing session of two to four tasks in one seeded project.

    Args:
        browser: The user's browser.
        fixture: The run's projects and lookups.
        cover_all: Do every task once, so a Check run sends every write.
    """
    seeded = [project for project in fixture.projects if project.seeded]
    if not seeded:
        map_session(browser, fixture.projects)
        return
    project = pick_project(seeded, browser.options.unconfigured_share)
    tasks = (
        list(TASK_STEPS)
        if cover_all
        else [weighted(TASKS) for _ in range(random.randint(2, 4))]
    )
    for task in tasks:
        TASK_STEPS[task](browser, project, fixture)
        browser.think(5, 15)
