"""Reproducible, realistically sized network data for load tests.

Each project gets a jittered street grid around ``center`` (EPSG:25832):
one street trench per block edge, a manhole node per intersection (with
NVt cabinets on a coarser grid and one POP), houses along both street sides
with house-connection trench, conduit and node, one multi-duct conduit and
one cable per street line, and area polygons. Microducts and fibers come
from the same color mappings the post_save signals use.

Everything lives in projects named ``loadtest-NN``, so :func:`purge` removes
it without touching real data. Inserts use ``bulk_create``, so no history
rows are written; DB triggers (trench id, length, canvas placement) still
run. Needs Django set up.
"""

import math
import random
from collections.abc import Callable
from dataclasses import dataclass, field

from apps.api.models import (
    Address,
    Area,
    AttributesAreaType,
    AttributesCableType,
    AttributesConduitType,
    AttributesConstructionType,
    AttributesNodeType,
    AttributesSurface,
    Cable,
    Conduit,
    Fiber,
    Flags,
    Microduct,
    Node,
    Projects,
    Trench,
    TrenchConduitConnection,
    fiber_layout,
    microduct_layout,
)
from django.contrib.gis.geos import LineString, Point, Polygon
from django.db import transaction
from django.db.models import Count, Q
from django.test.utils import override_settings

PROJECT_PREFIX = "loadtest-"

PRESET_KM = {"tiny": 2, "small": 50, "medium": 500, "large": 2000}
DEFAULT_CENTER = (534000.0, 5685000.0)
"""Center of the first project: Kassel."""

BLOCK_SPACING_M = 120.0
JITTER_FRACTION = 0.15
HOUSE_OFFSET_M = 14.0
NVT_EVERY = 6
BATCH_SIZE = 2000

STREET_CONDUIT_TYPE = "12x10/6"
HOUSE_CONDUIT_TYPE = "10/6"
STREET_CABLE_TYPE = "LTMC144(12x12)"


@dataclass
class House:
    """One address with its house connection, in grid coordinates."""

    street_point: tuple[float, float]
    address_point: tuple[float, float]
    street_name: str
    housenumber: int


@dataclass
class Street:
    """One block edge between two neighbouring intersections."""

    start: tuple[int, int]
    end: tuple[int, int]
    coords: list[tuple[float, float]]
    line_key: str
    houses: list[House] = field(default_factory=list)


@dataclass
class StreetGrid:
    """Geometry plan for one project, independent of the database."""

    intersections: dict[tuple[int, int], tuple[float, float]]
    streets: list[Street]
    size: int


def grid_size_for_km(km: float) -> int:
    """Return the intersections per side whose block edges add up to ``km``.

    An n x n grid has ``2 * n * (n - 1)`` edges of ``BLOCK_SPACING_M``.

    Args:
        km: Target street trench length in kilometres.

    Returns:
        int: Intersections per grid side, at least 2.
    """
    edges = km * 1000 / BLOCK_SPACING_M
    return max(2, math.ceil((1 + math.sqrt(1 + 2 * edges)) / 2))


def build_street_grid(
    rng: random.Random,
    origin: tuple[float, float],
    size: int,
    houses_per_street: int,
) -> StreetGrid:
    """Plan a jittered street grid with houses along both sides of each street.

    Args:
        rng: Seeded random source, so the same seed yields the same grid.
        origin: Lower-left corner in EPSG:25832.
        size: Intersections per grid side.
        houses_per_street: Houses per block edge, split across both sides.

    Returns:
        StreetGrid: Intersections, streets and houses in EPSG:25832.
    """
    jitter = BLOCK_SPACING_M * JITTER_FRACTION
    intersections = {
        (i, j): (
            origin[0] + i * BLOCK_SPACING_M + rng.uniform(-jitter, jitter),
            origin[1] + j * BLOCK_SPACING_M + rng.uniform(-jitter, jitter),
        )
        for i in range(size)
        for j in range(size)
    }

    streets = []
    housenumbers: dict[str, int] = {}
    for (i, j), start in intersections.items():
        for di, dj, line_key in ((1, 0, f"H{j:03d}"), (0, 1, f"V{i:03d}")):
            end_key = (i + di, j + dj)
            if end_key not in intersections:
                continue
            end = intersections[end_key]
            dx, dy = end[0] - start[0], end[1] - start[1]
            length = math.hypot(dx, dy)
            normal = (-dy / length, dx / length)
            bend = rng.uniform(-8, 8)
            mid = (
                (start[0] + end[0]) / 2 + normal[0] * bend,
                (start[1] + end[1]) / 2 + normal[1] * bend,
            )
            street = Street((i, j), end_key, [start, mid, end], line_key)

            street_name = (
                f"Lastweg {j + 1}" if line_key[0] == "H" else f"Teststraße {i + 1}"
            )
            for index in range(houses_per_street):
                side = 1 if index % 2 == 0 else -1
                fraction = (index // 2 + 1) / (houses_per_street // 2 + 2)
                on_street = LineString(street.coords).interpolate_normalized(fraction)
                housenumbers[street_name] = housenumbers.get(street_name, 0) + 1
                street.houses.append(
                    House(
                        street_point=(on_street.x, on_street.y),
                        address_point=(
                            on_street.x + normal[0] * side * HOUSE_OFFSET_M,
                            on_street.y + normal[1] * side * HOUSE_OFFSET_M,
                        ),
                        street_name=street_name,
                        housenumber=housenumbers[street_name],
                    )
                )
            streets.append(street)

    return StreetGrid(intersections=intersections, streets=streets, size=size)


class SeedError(Exception):
    """Seeding cannot start, e.g. because seeded projects already exist."""


def lookup(model, field_name: str, value: str | None = None):
    """Return the lookup row named ``value``, or the first row as a fallback.

    Args:
        model: Attribute model, e.g. :model:`api.AttributesNodeType`.
        field_name: Name of the field that holds the display value.
        value: Preferred display value from the default fixtures.

    Returns:
        Model: The matching or first row.

    Raises:
        SeedError: If the table is empty (``load_initial_data`` not run).
    """
    row = None
    if value is not None:
        row = model.objects.filter(**{field_name: value}).first()
    row = row or model.objects.order_by("pk").first()
    if row is None:
        raise SeedError(
            f"{model.__name__} is empty. Run `python manage.py load_initial_data` first."
        )
    return row


def load_references() -> dict:
    """Resolve every lookup row the seeded features point to.

    Returns:
        dict: Lookup instances plus the precomputed microduct and fiber
            layouts per type.
    """
    street_conduit = lookup(AttributesConduitType, "conduit_type", STREET_CONDUIT_TYPE)
    house_conduit = lookup(AttributesConduitType, "conduit_type", HOUSE_CONDUIT_TYPE)
    cable_type = lookup(AttributesCableType, "cable_type", STREET_CABLE_TYPE)
    return {
        "flag": lookup(Flags, "flag"),
        "surface": lookup(AttributesSurface, "surface"),
        "construction_type": lookup(AttributesConstructionType, "construction_type"),
        "manhole": lookup(AttributesNodeType, "node_type", "Schacht"),
        "cabinet": lookup(AttributesNodeType, "node_type", "NVt 48"),
        "pop": lookup(AttributesNodeType, "node_type", "POP"),
        "house_node": lookup(AttributesNodeType, "node_type", "Hausanschluss"),
        "project_area": lookup(AttributesAreaType, "area_type", "Projektgebiet"),
        "cabinet_area": lookup(AttributesAreaType, "area_type", "NVt-Gebiet"),
        "street_conduit": street_conduit,
        "house_conduit": house_conduit,
        "cable_type": cable_type,
        "street_microducts": microduct_layout(street_conduit),
        "house_microducts": microduct_layout(house_conduit),
        "fibers": fiber_layout(cable_type),
    }


def seed_project(project: Projects, grid: StreetGrid, refs: dict) -> dict[str, int]:
    """Insert all features of one planned grid into ``project``.

    Args:
        project: The freshly created load-test project.
        grid: Geometry plan from :func:`build_street_grid`.
        refs: Lookup rows from :func:`load_references`.

    Returns:
        dict[str, int]: Inserted row count per feature kind.
    """
    common = {"project": project, "flag": refs["flag"]}
    trench_defaults = {
        "id_trench": "LT",
        "surface": refs["surface"],
        "construction_type": refs["construction_type"],
        **common,
    }
    center = (grid.size // 2, grid.size // 2)

    def node_type_at(key):
        """Return the node type of the intersection at grid index ``key``."""
        if key == center:
            return refs["pop"]
        if key[0] % NVT_EVERY == 0 and key[1] % NVT_EVERY == 0:
            return refs["cabinet"]
        return refs["manhole"]

    nodes = {
        key: Node(
            name=f"{project.project}-K{key[0]:03d}-{key[1]:03d}",
            node_type=node_type_at(key),
            geom=Point(*xy, srid=25832),
            **common,
        )
        for key, xy in grid.intersections.items()
    }

    trenches, addresses, house_nodes, conduits, links = [], [], [], [], []
    line_conduits: dict[str, Conduit] = {}
    line_ends: dict[str, list[tuple[int, int]]] = {}
    for street in grid.streets:
        geom = LineString(street.coords, srid=25832)
        trench = Trench(geom=geom, length=geom.length, **trench_defaults)
        trenches.append(trench)

        conduit = line_conduits.get(street.line_key)
        if conduit is None:
            conduit = Conduit(
                name=f"{project.project}-{street.line_key}",
                conduit_type=refs["street_conduit"],
                **common,
            )
            line_conduits[street.line_key] = conduit
            conduits.append(conduit)
        links.append(TrenchConduitConnection(uuid_trench=trench, uuid_conduit=conduit))
        line_ends.setdefault(street.line_key, []).extend([street.start, street.end])

        for house in street.houses:
            address = Address(
                zip_code="34117",
                city="Lastheim",
                street=house.street_name,
                housenumber=house.housenumber,
                geom=Point(*house.address_point, srid=25832),
                **common,
            )
            addresses.append(address)
            house_nodes.append(
                Node(
                    name=f"HA {house.street_name} {house.housenumber}",
                    node_type=refs["house_node"],
                    geom=Point(*house.address_point, srid=25832),
                    uuid_address=address,
                    **common,
                )
            )
            house_geom = LineString(
                [house.street_point, house.address_point], srid=25832
            )
            house_trench = Trench(
                geom=house_geom,
                length=house_geom.length,
                house_connection=True,
                **trench_defaults,
            )
            trenches.append(house_trench)
            house_conduit = Conduit(
                name=f"HA {house.street_name} {house.housenumber}",
                conduit_type=refs["house_conduit"],
                **common,
            )
            conduits.append(house_conduit)
            links.append(
                TrenchConduitConnection(
                    uuid_trench=house_trench, uuid_conduit=house_conduit
                )
            )

    microducts = [
        Microduct(uuid_conduit=conduit, number=number, color=color)
        for conduit in conduits
        for number, color in refs[
            "street_microducts"
            if conduit.conduit_type_id == refs["street_conduit"].pk
            else "house_microducts"
        ]
    ]

    cables = []
    for line_key, ends in line_ends.items():
        first, last = min(ends), max(ends)
        cables.append(
            Cable(
                name=f"{project.project}-{line_key}",
                cable_type=refs["cable_type"],
                uuid_node_start=nodes[first],
                uuid_node_end=nodes[last],
                **common,
            )
        )
    fibers = [
        Fiber(uuid_cable=cable, active=True, **common, **fiber)
        for cable in cables
        for fiber in refs["fibers"]
    ]

    areas = [
        Area(
            name=f"{project.project} Projektgebiet",
            area_type=refs["project_area"],
            geom=block_polygon(grid, (0, 0), (grid.size - 1, grid.size - 1)),
            **common,
        )
    ]
    for i in range(0, grid.size - 1, NVT_EVERY):
        for j in range(0, grid.size - 1, NVT_EVERY):
            upper = (
                min(i + NVT_EVERY, grid.size - 1),
                min(j + NVT_EVERY, grid.size - 1),
            )
            areas.append(
                Area(
                    name=f"{project.project} NVt {i:03d}-{j:03d}",
                    area_type=refs["cabinet_area"],
                    geom=block_polygon(grid, (i, j), upper),
                    **common,
                )
            )

    Node.objects.bulk_create(nodes.values(), batch_size=BATCH_SIZE)
    Address.objects.bulk_create(addresses, batch_size=BATCH_SIZE)
    Node.objects.bulk_create(house_nodes, batch_size=BATCH_SIZE)
    Trench.objects.bulk_create(trenches, batch_size=BATCH_SIZE)
    Conduit.objects.bulk_create(conduits, batch_size=BATCH_SIZE)
    TrenchConduitConnection.objects.bulk_create(links, batch_size=BATCH_SIZE)
    Microduct.objects.bulk_create(microducts, batch_size=BATCH_SIZE)
    Cable.objects.bulk_create(cables, batch_size=BATCH_SIZE)
    Fiber.objects.bulk_create(fibers, batch_size=BATCH_SIZE)
    Area.objects.bulk_create(areas, batch_size=BATCH_SIZE)

    return {
        "trenches": len(trenches),
        "nodes": len(nodes) + len(house_nodes),
        "addresses": len(addresses),
        "conduits": len(conduits),
        "microducts": len(microducts),
        "cables": len(cables),
        "fibers": len(fibers),
        "areas": len(areas),
    }


def block_polygon(
    grid: StreetGrid, lower: tuple[int, int], upper: tuple[int, int]
) -> Polygon:
    """Return the axis-aligned box around a block range, padded by 30 m.

    Args:
        grid: Planned grid whose intersections bound the box.
        lower: Lower-left intersection index.
        upper: Upper-right intersection index.

    Returns:
        Polygon: Box in EPSG:25832.
    """
    corners = [
        grid.intersections[(i, j)]
        for i in range(lower[0], upper[0] + 1)
        for j in range(lower[1], upper[1] + 1)
    ]
    min_x = min(x for x, _ in corners) - 30
    max_x = max(x for x, _ in corners) + 30
    min_y = min(y for _, y in corners) - 30
    max_y = max(y for _, y in corners) + 30
    polygon = Polygon.from_bbox((min_x, min_y, max_x, max_y))
    polygon.srid = 25832
    return polygon


def seed(
    preset: str = "small",
    km: float | None = None,
    projects: int = 3,
    houses_per_street: int = 6,
    random_seed: int = 1,
    center: tuple[float, float] = DEFAULT_CENTER,
    log: Callable[[str], None] = print,
) -> list[str]:
    """Seed ``loadtest-NN`` projects with a synthetic FTTH network.

    Args:
        preset: Key of :data:`PRESET_KM`, the total street trench length.
        km: Total street trench km, overrides ``preset``.
        projects: Number of projects the length is split across.
        houses_per_street: Houses per block edge, both sides together.
        random_seed: Seed of the geometry, so a run is reproducible.
        center: Center of the first project in EPSG:25832.
        log: Receives one progress line per project.

    Returns:
        list[str]: Names of the created projects.

    Raises:
        SeedError: If seeded projects exist already or lookups are missing.
    """
    if Projects.objects.filter(project__startswith=PROJECT_PREFIX).exists():
        raise SeedError("Load-test projects already exist. Purge them first.")

    km_total = km or PRESET_KM[preset]
    project_count = max(1, projects)
    size = grid_size_for_km(km_total / project_count)
    extent = (size - 1) * BLOCK_SPACING_M
    rng = random.Random(random_seed)
    refs = load_references()

    names = []
    for index in range(project_count):
        origin = (
            center[0] - extent / 2 + index * (extent + 1000),
            center[1] - extent / 2,
        )
        grid = build_street_grid(rng, origin, size, houses_per_street)
        with transaction.atomic():
            project = Projects.objects.create(
                project=f"{PROJECT_PREFIX}{index + 1:02d}",
                description="Synthetic data for load tests (qonnectra_loadtest)",
            )
            counts = seed_project(project, grid, refs)
        names.append(project.project)
        log(
            f"{project.project}: "
            + ", ".join(f"{count} {name}" for name, count in counts.items())
        )
    return names


def purge(log: Callable[[str], None] = print) -> list[str]:
    """Delete every load-test project, its features and their history.

    Runs through the ORM so every cascade is honoured, with history
    disabled so the purge does not write a history row per deleted row.
    The history the editor persona and the seeder wrote goes as well, so
    no rows of the projects outlive them.

    Args:
        log: Receives one line per deleted feature kind.

    Returns:
        list[str]: Names of the deleted projects.
    """
    projects = Projects.objects.filter(project__startswith=PROJECT_PREFIX)
    names = list(projects.values_list("project", flat=True))
    if not names:
        log("No load-test projects found.")
        return []
    project_ids = list(projects.values_list("pk", flat=True))

    with override_settings(SIMPLE_HISTORY_ENABLED=False), transaction.atomic():
        # Microduct history only knows its conduit, which may already be gone,
        # so it goes first, matched against live and historical conduits.
        history = Microduct.history.filter(
            Q(
                uuid_conduit_id__in=Conduit.objects.filter(
                    project__in=project_ids
                ).values("uuid")
            )
            | Q(
                uuid_conduit_id__in=Conduit.history.filter(
                    project_id__in=project_ids
                ).values("uuid")
            )
        ).delete()[0]
        for model in (Fiber, Cable, Conduit, Trench, Node, Address, Area):
            history += model.history.filter(project_id__in=project_ids).delete()[0]
        history += Projects.history.filter(id__in=project_ids).delete()[0]
        log(f"History: {history} rows")

        for model in (Fiber, Cable, Conduit, Trench, Node, Address, Area):
            deleted, _ = model.objects.filter(project__in=project_ids).delete()
            log(f"{model.__name__}: {deleted} rows")
        projects.delete()
    log(f"Purged {', '.join(names)}")
    return names


def seeded_projects() -> list[dict]:
    """Describe the existing load-test projects.

    Returns:
        list[dict]: ``id``, ``name`` and feature counts per project.
    """
    projects = (
        Projects.objects.filter(project__startswith=PROJECT_PREFIX)
        .order_by("project")
        .values("id", "project")
    )
    counts = {}
    for model, key in ((Trench, "trenches"), (Address, "addresses"), (Node, "nodes")):
        for row in (
            model.objects.filter(project__project__startswith=PROJECT_PREFIX)
            .values("project_id")
            .annotate(n=Count("pk"))
        ):
            counts.setdefault(row["project_id"], {})[key] = row["n"]
    return [
        {"id": p["id"], "name": p["project"], **counts.get(p["id"], {})}
        for p in projects
    ]
