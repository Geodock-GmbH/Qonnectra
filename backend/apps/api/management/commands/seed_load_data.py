"""
Management command to seed reproducible, realistically sized network data.

Each project gets a jittered street grid around ``--center`` (EPSG:25832):
one street trench per block edge, a manhole node per intersection (with
NVt cabinets on a coarser grid and one POP), houses along both street sides
with house-connection trench, conduit and node, one multi-duct conduit and
one cable per street line, and area polygons. Microducts and fibers come
from the same color mappings the post_save signals use.

Everything lives in projects named ``loadtest-NN`` so ``--purge`` can
remove it without touching real data. Inserts use ``bulk_create``, so no
history rows are written; DB triggers (trench id, length, canvas placement)
still run.

Usage:
    python manage.py seed_load_data --preset medium
    python manage.py seed_load_data --preset small --projects 1 --seed 7
    python manage.py seed_load_data --purge
"""

import math
import random
from dataclasses import dataclass, field

from django.contrib.gis.geos import LineString, Point, Polygon
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.test.utils import override_settings

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

PROJECT_PREFIX = "loadtest-"

PRESET_KM = {"tiny": 2, "small": 50, "medium": 500, "large": 2000}

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


def lookup(model, field_name: str, value: str | None = None):
    """Return the lookup row named ``value``, or the first row as a fallback.

    Args:
        model: Attribute model, e.g. :model:`api.AttributesNodeType`.
        field_name: Name of the field that holds the display value.
        value: Preferred display value from the default fixtures.

    Returns:
        Model: The matching or first row.

    Raises:
        CommandError: If the table is empty (``load_initial_data`` not run).
    """
    row = None
    if value is not None:
        row = model.objects.filter(**{field_name: value}).first()
    row = row or model.objects.order_by("pk").first()
    if row is None:
        raise CommandError(
            f"{model.__name__} is empty. Run `python manage.py load_initial_data` first."
        )
    return row


class Command(BaseCommand):
    """Seed ``loadtest-NN`` projects with a synthetic FTTH network, or purge them."""

    help = "Seed reproducible load-test network data (or --purge it)"

    def add_arguments(self, parser):
        """Define CLI arguments for the command.

        Args:
            parser: ArgumentParser instance to register arguments on.
        """
        parser.add_argument(
            "--preset",
            choices=sorted(PRESET_KM),
            default="small",
            help="Total street trench length: "
            + ", ".join(f"{k}={v} km" for k, v in PRESET_KM.items()),
        )
        parser.add_argument(
            "--km", type=float, help="Total street trench km, overrides --preset"
        )
        parser.add_argument(
            "--projects", type=int, default=3, help="Number of projects (default: 3)"
        )
        parser.add_argument(
            "--houses-per-street",
            type=int,
            default=6,
            help="Houses per block edge, both sides together (default: 6)",
        )
        parser.add_argument(
            "--seed", type=int, default=1, help="Random seed (default: 1)"
        )
        parser.add_argument(
            "--center",
            default="534000,5685000",
            help="Center of the first project in EPSG:25832 (default: Kassel)",
        )
        parser.add_argument(
            "--purge",
            action="store_true",
            help=f"Delete all '{PROJECT_PREFIX}*' projects and their features",
        )

    def handle(self, *args, **options):
        """Seed the requested projects, or purge all load-test projects.

        Args:
            *args: Positional arguments (unused).
            **options: Parsed command options.
        """
        if options["purge"]:
            self._purge()
            return

        if Projects.objects.filter(project__startswith=PROJECT_PREFIX).exists():
            raise CommandError(
                "Load-test projects already exist. Run with --purge first."
            )

        km_total = options["km"] or PRESET_KM[options["preset"]]
        project_count = max(1, options["projects"])
        size = grid_size_for_km(km_total / project_count)
        center_x, center_y = (float(v) for v in options["center"].split(","))
        extent = (size - 1) * BLOCK_SPACING_M
        rng = random.Random(options["seed"])
        self.refs = self._load_references()

        for index in range(project_count):
            origin = (
                center_x - extent / 2 + index * (extent + 1000),
                center_y - extent / 2,
            )
            grid = build_street_grid(rng, origin, size, options["houses_per_street"])
            with transaction.atomic():
                project = Projects.objects.create(
                    project=f"{PROJECT_PREFIX}{index + 1:02d}",
                    description="Synthetic data for load tests (seed_load_data)",
                )
                counts = self._seed_project(project, grid)
            self.stdout.write(
                f"{project.project}: "
                + ", ".join(f"{count} {name}" for name, count in counts.items())
            )

    def _load_references(self) -> dict:
        """Resolve every lookup row the seeded features point to.

        Returns:
            dict: Lookup instances plus the precomputed microduct and fiber
                layouts per type.
        """
        street_conduit = lookup(
            AttributesConduitType, "conduit_type", STREET_CONDUIT_TYPE
        )
        house_conduit = lookup(
            AttributesConduitType, "conduit_type", HOUSE_CONDUIT_TYPE
        )
        cable_type = lookup(AttributesCableType, "cable_type", STREET_CABLE_TYPE)
        return {
            "flag": lookup(Flags, "flag"),
            "surface": lookup(AttributesSurface, "surface"),
            "construction_type": lookup(
                AttributesConstructionType, "construction_type"
            ),
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

    def _seed_project(self, project: Projects, grid: StreetGrid) -> dict[str, int]:
        """Insert all features of one planned grid into ``project``.

        Args:
            project: The freshly created load-test project.
            grid: Geometry plan from :func:`build_street_grid`.

        Returns:
            dict[str, int]: Inserted row count per feature kind.
        """
        refs = self.refs
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
            links.append(
                TrenchConduitConnection(uuid_trench=trench, uuid_conduit=conduit)
            )
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
                geom=self._block_polygon(grid, (0, 0), (grid.size - 1, grid.size - 1)),
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
                        geom=self._block_polygon(grid, (i, j), upper),
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

    @staticmethod
    def _block_polygon(
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

    def _purge(self):
        """Delete every load-test project and all features that belong to it.

        Runs through the ORM so every cascade is honoured, with history
        disabled so the purge does not write a history row per deleted row.
        """
        projects = Projects.objects.filter(project__startswith=PROJECT_PREFIX)
        if not projects.exists():
            self.stdout.write("No load-test projects found.")
            return

        names = list(projects.values_list("project", flat=True))
        with override_settings(SIMPLE_HISTORY_ENABLED=False), transaction.atomic():
            for model in (Fiber, Cable, Conduit, Trench, Node, Address, Area):
                deleted, _ = model.objects.filter(project__in=projects).delete()
                self.stdout.write(f"{model.__name__}: {deleted} rows")
            projects.delete()
        self.stdout.write(f"Purged {', '.join(names)}")
