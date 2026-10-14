"""Discovers what the personas work on, once per run.

The target projects with their map extent, sample feature UUIDs to click,
configured WMS layers and the lookups the editor needs. Runs as the first
load-test user, so it sees exactly what the virtual users see.
"""

from dataclasses import dataclass, field

import requests

from qonnectra_loadtest.config import RunOptions

SAMPLE_PAGE_SIZE = 100
SEEDED_PREFIX = "loadtest-"


class FixtureError(Exception):
    """The run has nothing to work on, e.g. no project matches."""


@dataclass
class WmsLayer:
    """One enabled layer of an active WMS source."""

    source: str
    name: str
    min_zoom: float
    max_zoom: float | None


@dataclass
class Project:
    """A project the personas open, with samples to click on."""

    id: int
    name: str
    extent: tuple[float, float, float, float]
    features: dict[str, list[str]]
    trench_ids: list[str] = field(default_factory=list)
    """``id_trench`` values, the key of ``trench/<id>/``; unique per project only."""
    wms_layers: list[WmsLayer] = field(default_factory=list)

    @property
    def seeded(self) -> bool:
        """Return whether this is a seeded ``loadtest-*`` project, safe for writes.

        Returns:
            bool: True for seeded projects.
        """
        return self.name.startswith(SEEDED_PREFIX)


@dataclass
class Fixture:
    """Everything a run works on."""

    projects: list[Project]
    conduit_type_id: int | None
    flag_id: int | None


def rows(body) -> list:
    """Unwrap DRF pagination and GeoJSON feature collections into a list.

    Args:
        body: Parsed JSON of a list endpoint, or None.

    Returns:
        list: The rows; empty for anything else.
    """
    results = body.get("results", body) if isinstance(body, dict) else body
    items = results.get("features", results) if isinstance(results, dict) else results
    return items if isinstance(items, list) else []


def uuids(body) -> list[str]:
    """Extract UUIDs from list rows, which are GeoJSON features or plain objects.

    Args:
        body: Parsed JSON of a list endpoint, or None.

    Returns:
        list[str]: UUIDs in response order.
    """
    found = []
    for row in rows(body):
        value = (
            row.get("id")
            or row.get("uuid")
            or (row.get("properties") or {}).get("uuid")
        )
        if isinstance(value, str):
            found.append(value)
    return found


def trench_ids(body) -> list[str]:
    """Extract ``id_trench`` values from a trench feature collection.

    Args:
        body: Parsed JSON of ``trench/``, or None.

    Returns:
        list[str]: Trench ids in response order.
    """
    found = []
    for row in rows(body):
        value = (row.get("properties") or {}).get("id_trench")
        if isinstance(value, str):
            found.append(value)
    return found


def select_projects(projects: list[dict], selection: str) -> list[dict]:
    """Pick the projects a run targets.

    Args:
        projects: Project rows with ``id`` and ``project`` (the name).
        selection: ``all``, ``loadtest`` or comma-separated ids.

    Returns:
        list[dict]: The matching rows.
    """
    if selection == "all":
        return projects
    if selection == "loadtest":
        return [p for p in projects if p["project"].startswith(SEEDED_PREFIX)]
    ids = {int(part) for part in selection.split(",") if part.strip().isdigit()}
    return [p for p in projects if p["id"] in ids]


def discover(options: RunOptions, token: str, http=requests) -> Fixture:
    """Build the shared run fixture.

    Args:
        options: Run options with the API URL and project selection.
        token: Access token of the first load-test user.
        http: Object with a requests-compatible ``get``, for tests.

    Returns:
        Fixture: Projects to work in and the editor's lookups.

    Raises:
        FixtureError: If no project is visible or matches the selection.
    """

    def get(path: str):
        """GET and parse an API path; None on a non-2xx response."""
        response = http.get(
            f"{options.api_url}{path}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=60,
        )
        return response.json() if 200 <= response.status_code < 300 else None

    project_rows = rows(get("projects/?active=1&page_size=100"))
    if not project_rows:
        raise FixtureError(
            "No projects visible to the load-test users. Check the API URL."
        )

    projects = []
    for row in select_projects(project_rows, options.projects):
        extent = (get(f"layer-extent/?layer=trench&project={row['id']}") or {}).get(
            "extent"
        )
        if not extent:
            continue
        samples = {
            kind: get(f"{kind}/?project={row['id']}&page_size={SAMPLE_PAGE_SIZE}")
            for kind in ("trench", "node", "address", "cable")
        }
        wms_layers = []
        if options.wms:
            for source in rows(get(f"wms-sources/?project={row['id']}")):
                if not source.get("is_active"):
                    continue
                for layer in source.get("layers") or []:
                    if layer.get("is_enabled"):
                        wms_layers.append(
                            WmsLayer(
                                source=str(source["id"]),
                                name=layer["name"],
                                min_zoom=layer.get("min_zoom") or 8,
                                max_zoom=layer.get("max_zoom"),
                            )
                        )
        projects.append(
            Project(
                id=row["id"],
                name=row["project"],
                extent=tuple(extent),
                features={kind: uuids(body) for kind, body in samples.items()},
                trench_ids=trench_ids(samples["trench"]),
                wms_layers=wms_layers,
            )
        )
    if not projects:
        raise FixtureError(
            f"No project with trenches matches '{options.projects}'. "
            "Seed test data or pick other projects."
        )

    return Fixture(
        projects=projects,
        conduit_type_id=next(
            iter(row.get("id") for row in rows(get("attributes_conduit_type/"))), None
        ),
        flag_id=next(iter(row.get("id") for row in rows(get("flags/"))), None),
    )
