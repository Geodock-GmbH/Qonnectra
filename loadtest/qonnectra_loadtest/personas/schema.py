"""Planner persona: works in the network schema and the conduit table.

Opening the schema runs ten parallel Django loads on the server. Planners
work in projects whose main schema leaves out the house connections, and
some open an NVt's sub schema to see them. A project whose main schema shows
every node is opened only in ``unconfigured share`` of the sessions and
named ``page:network-schema:unconfigured``, so it never skews the configured
numbers. Then the planner inspects nodes and cables with their fibers, and
sometimes pages through the conduit table.
"""

import random

from qonnectra_loadtest.client import Browser
from qonnectra_loadtest.fixtures import Project
from qonnectra_loadtest.personas.map import chance

ACTIONS = {"node": 5, "cable": 3, "conduits": 2}
SUB_SCHEMA_SHARE = 25.0
"""Percent of sessions that open a parent node's sub schema."""


def pick_project(projects: list[Project], unconfigured_share: float) -> Project:
    """Pick the project of a session by how its network schema is set up.

    Args:
        projects: Projects of the run.
        unconfigured_share: Percent of sessions in an unconfigured project.

    Returns:
        Project: A configured project, or an unconfigured one in
            ``unconfigured_share`` of the calls or when no other exists.
    """
    configured = [p for p in projects if p.schema_configured]
    unconfigured = [p for p in projects if not p.schema_configured]
    if unconfigured and (not configured or chance(unconfigured_share)):
        return random.choice(unconfigured)
    return random.choice(configured)


def open_schema(browser: Browser, project: Project) -> str:
    """Load a project's main schema, named by how it is set up.

    Args:
        browser: The user's browser.
        project: Project to open.

    Returns:
        str: The page path, for the remote calls made on it.
    """
    path = f"/project/{project.id}/network-schema"
    name = (
        "page:network-schema"
        if project.schema_configured
        else "page:network-schema:unconfigured"
    )
    browser.page(path, name)
    return path


def schema_session(browser: Browser, projects: list[Project], cover_all: bool = False):
    """Run one planning session in a random project.

    Args:
        browser: The user's browser.
        projects: Projects of the run.
        cover_all: Open the configured, the sub and the unconfigured schema
            whatever the shares say, so a Check run loads every kind.
    """
    share = 0.0 if cover_all else browser.options.unconfigured_share
    project = pick_project(projects, share)
    project_id = str(project.id)
    schema_path = open_schema(browser, project)

    if cover_all:
        other = next(
            (p for p in projects if p.schema_configured != project.schema_configured),
            None,
        )
        if other is not None:
            open_schema(browser, other)

    if project.schema_parents and (cover_all or chance(SUB_SCHEMA_SHARE)):
        browser.think(2, 6)
        parent = random.choice(project.schema_parents)
        schema_path = f"/project/{project.id}/network-schema/node/{parent}"
        browser.page(schema_path, "page:network-schema:node")

    for _ in range(random.randint(3, 8)):
        browser.think(2, 6)
        action = random.choices(list(ACTIONS), weights=list(ACTIONS.values()))[0]
        if action == "node":
            nodes = project.features.get("node") or []
            if nodes:
                browser.remote("getNodeDetails", random.choice(nodes), schema_path)
        elif action == "cable":
            cables = project.features.get("cable") or []
            if not cables:
                continue
            uuid = random.choice(cables)
            browser.remote("getCableDetails", uuid, schema_path)
            browser.remote("getFibersForCable", uuid, schema_path)
        else:
            conduit_path = f"/project/{project.id}/conduit"
            browser.page(conduit_path, "page:conduit")
            browser.remote(
                "getConduitList",
                {
                    "projectId": project_id,
                    "search": "",
                    "page": random.randint(1, 5),
                    "pageSize": 50,
                },
                conduit_path,
            )
