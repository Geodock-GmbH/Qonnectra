"""Planner persona: works in the network schema and the conduit table.

Opening the schema runs ten parallel Django loads on the server. Then the
planner inspects nodes and cables with their fibers, and sometimes pages
through the conduit table.
"""

import random

from qonnectra_loadtest.client import Browser
from qonnectra_loadtest.fixtures import Project

ACTIONS = {"node": 5, "cable": 3, "conduits": 2}


def schema_session(browser: Browser, projects: list[Project]):
    """Run one planning session in a random project.

    Args:
        browser: The user's browser.
        projects: Projects of the run.
    """
    project = random.choice(projects)
    project_id = str(project.id)
    schema_path = f"/project/{project.id}/network-schema"
    browser.page(schema_path, "page:network-schema")

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
