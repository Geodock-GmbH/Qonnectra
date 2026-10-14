"""Search persona: types into the map's search panel, then opens a result.

The panel is debounced, so there is one call per typing pause, and each call
fans out to five Django searches on the server.
"""

import random

from qonnectra_loadtest.client import Browser
from qonnectra_loadtest.fixtures import Project

TERMS = [
    "Lastweg 1",
    "Teststraße 4",
    "HA Lastweg",
    "K003",
    "Haupt",
    "Schul",
    "Berg",
    "NVt",
    "12",
]
"""Terms that hit seeded data (streets, house connections, manholes) and real data."""


def search_session(browser: Browser, projects: list[Project]):
    """Run one search session in a random project.

    Args:
        browser: The user's browser.
        projects: Projects of the run.
    """
    project = random.choice(projects)
    page_path = f"/project/{project.id}/map"
    project_id = str(project.id)
    term = random.choice(TERMS)

    pauses = random.randint(1, 3)
    for index in range(1, pauses + 1):
        typed = term[: max(2, -(-len(term) * index // pauses))]
        browser.remote(
            "searchFeatures", {"searchQuery": typed, "projectId": project_id}, page_path
        )
        browser.think(0.4, 1.5)

    kind = random.choice(["trench", "node", "address"])
    uuids = project.features.get(kind) or []
    if uuids:
        browser.remote(
            "getFeatureDetails",
            {
                "featureType": kind,
                "featureUuid": random.choice(uuids),
                "projectId": project_id,
            },
            page_path,
        )
    browser.think(3, 8)
