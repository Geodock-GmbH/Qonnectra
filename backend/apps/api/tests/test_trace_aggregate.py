"""Tests for the trace aggregates that span many fibers.

Cover :func:`apps.api.services.trace_cable`, :func:`apps.api.services.trace_node`
and :func:`apps.api.services.simulate_fault` on a network with real trench
geometry. The aggregates must return what tracing each fiber on its own and
merging the results returns, while building the cable infrastructure only once.
"""

from unittest import mock

import pytest
from apps.api import services
from apps.api.models import (
    AttributesComponentType,
    FiberSplice,
    Microduct,
    MicroductCableConnection,
    NodeSlotConfiguration,
    NodeStructure,
)
from apps.api.services import (
    _sort_trace_trees,
    simulate_fault,
    trace_cable,
    trace_fiber,
    trace_node,
)
from django.conf import settings
from django.contrib.gis.geos import LineString, Point
from django.db import connection
from django.test.utils import CaptureQueriesContext

from .factories import (
    CableFactory,
    ConduitFactory,
    FiberFactory,
    FlagFactory,
    NodeFactory,
    ProjectFactory,
    TrenchConduitConnectionFactory,
    TrenchFactory,
)

GEOMETRY_OPTIONS = [
    pytest.param(False, "segments", False, id="no-geometry"),
    pytest.param(True, "segments", False, id="segments"),
    pytest.param(True, "segments", True, id="segments-oriented"),
    pytest.param(True, "merged", False, id="merged"),
    pytest.param(True, "merged", True, id="merged-oriented"),
    pytest.param(True, "routed", False, id="routed"),
    pytest.param(True, "routed", True, id="routed-oriented"),
]

SUMMED_STATISTICS = (
    "total_fibers",
    "total_nodes",
    "total_splices",
    "total_addresses",
    "total_residential_units",
    "total_cables",
    "total_trenches",
)


@pytest.fixture
def pop_network(db):
    """Create a PoP node with two outgoing cables and one onward cable.

    Layout (coordinates in the project SRID):
        - Cable A: PoP (0,0) -> Node A (100,0) through trenches A1 (0,0)->(50,0)
          and A2 (50,0)->(100,0). Its conduit also runs through the spur
          trench (50,0)->(50,50), which a routed trace leaves out.
        - Cable B: PoP (0,0) -> Node B (0,100) through trench B1.
        - Cable C: Node B (0,100) -> Node C (100,100) through trench C1.
        - Fibers A1/B1 and A2/B2 are spliced at the PoP, fiber B1 is spliced
          to C1 at Node B. Fibers A3 and B3 are not spliced.

    Returns:
        dict: Keys ``'project'``, ``'pop'``, ``'cables'``, ``'fibers'`` and
            ``'trenches'``.
    """
    project = ProjectFactory()
    flag = FlagFactory()

    def node(name, x, y):
        return NodeFactory(
            name=name,
            project=project,
            flag=flag,
            geom=Point(x, y, srid=settings.DEFAULT_SRID),
        )

    def trench(*coords):
        return TrenchFactory(
            project=project,
            flag=flag,
            geom=LineString(*coords, srid=settings.DEFAULT_SRID),
        )

    def cable(name, start, end, trenches):
        conduit = ConduitFactory(project=project, flag=flag)
        for t in trenches:
            TrenchConduitConnectionFactory(uuid_trench=t, uuid_conduit=conduit)
        microduct = Microduct.objects.create(
            uuid_conduit=conduit, number=1, color="rot"
        )
        result = CableFactory(
            name=name,
            project=project,
            flag=flag,
            uuid_node_start=start,
            uuid_node_end=end,
        )
        MicroductCableConnection.objects.create(
            uuid_microduct=microduct, uuid_cable=result
        )
        return result

    def splice_structure(at_node):
        slot_config = NodeSlotConfiguration.objects.create(
            uuid_node=at_node, side="A", total_slots=12
        )
        component_type = AttributesComponentType.objects.create(
            component_type=f"Splice Cassette {at_node.name}", occupied_slots=2
        )
        return NodeStructure.objects.create(
            uuid_node=at_node,
            slot_configuration=slot_config,
            component_type=component_type,
            slot_start=1,
            slot_end=2,
        )

    pop = node("PoP", 0, 0)
    node_a = node("Node-A", 100, 0)
    node_b = node("Node-B", 0, 100)
    node_c = node("Node-C", 100, 100)

    trench_a1 = trench((0, 0), (50, 0))
    trench_a2 = trench((50, 0), (100, 0))
    trench_spur = trench((50, 0), (50, 50))
    trench_b1 = trench((0, 0), (0, 100))
    trench_c1 = trench((0, 100), (100, 100))

    cable_a = cable("Cable-A", pop, node_a, [trench_a1, trench_a2, trench_spur])
    cable_b = cable("Cable-B", pop, node_b, [trench_b1])
    cable_c = cable("Cable-C", node_b, node_c, [trench_c1])

    fibers = {
        f"{name}{number}": FiberFactory(uuid_cable=c, fiber_number_absolute=number)
        for name, c in (("A", cable_a), ("B", cable_b))
        for number in (1, 2, 3)
    }
    fibers["C1"] = FiberFactory(uuid_cable=cable_c, fiber_number_absolute=1)

    pop_structure = splice_structure(pop)
    for port, (a, b) in enumerate((("A1", "B1"), ("A2", "B2")), start=1):
        FiberSplice.objects.create(
            node_structure=pop_structure,
            port_number=port,
            fiber_a=fibers[a],
            cable_a=fibers[a].uuid_cable,
            fiber_b=fibers[b],
            cable_b=fibers[b].uuid_cable,
        )
    FiberSplice.objects.create(
        node_structure=splice_structure(node_b),
        port_number=1,
        fiber_a=fibers["B1"],
        cable_a=cable_b,
        fiber_b=fibers["C1"],
        cable_b=cable_c,
    )

    return {
        "project": project,
        "pop": pop,
        "cables": {"A": cable_a, "B": cable_b, "C": cable_c},
        "fibers": fibers,
        "trenches": {
            "A1": trench_a1,
            "A2": trench_a2,
            "spur": trench_spur,
            "B1": trench_b1,
            "C1": trench_c1,
        },
    }


def _merge_fiber_traces(result, options):
    """Rebuild an aggregate result by tracing each of its root fibers alone.

    This is how the aggregates were assembled before they shared one cable
    infrastructure lookup: one full walk per root fiber, the first
    infrastructure per cable wins, and the statistics are summed. The walks
    stay rooted at their fibers, unlike :func:`trace_fiber`, which reads the
    path from one end.

    Args:
        result (dict): Aggregate trace result whose root fibers are retraced.
        options (tuple): ``(include_geometry, geometry_mode, orient_geometry)``.

    Returns:
        dict: ``'trace_trees'``, ``'cable_infrastructure'`` and ``'statistics'``.
    """
    traces = [
        services._trace_fiber_as_walked(tree["fiber"]["id"], *options)
        for tree in result["trace_trees"]
    ]

    infrastructure = {}
    for trace in traces:
        for cable_id, infra in trace["cable_infrastructure"].items():
            infrastructure.setdefault(cable_id, infra)

    statistics = {
        key: sum(trace["statistics"][key] for trace in traces)
        for key in SUMMED_STATISTICS
    }
    statistics["has_branches"] = any(
        trace["statistics"]["has_branches"] for trace in traces
    )

    return {
        "trace_trees": _sort_trace_trees([trace["trace_tree"] for trace in traces]),
        "cable_infrastructure": infrastructure,
        "statistics": statistics,
    }


def _trench_ids(infrastructure, cable):
    """Return the trench UUIDs a cable's infrastructure lists, as a set."""
    return {trench["id"] for trench in infrastructure[str(cable.uuid)]["trenches"]}


class TestAggregateMatchesPerFiberTraces:
    """The aggregates return exactly what the per-fiber traces add up to."""

    @pytest.mark.parametrize(
        ("include_geometry", "geometry_mode", "orient_geometry"), GEOMETRY_OPTIONS
    )
    def test_trace_node(
        self, pop_network, include_geometry, geometry_mode, orient_geometry
    ):
        options = (include_geometry, geometry_mode, orient_geometry)
        result = trace_node(pop_network["pop"].uuid, *options)

        assert result == {
            "entry_point": result["entry_point"],
            **_merge_fiber_traces(result, options),
        }

    @pytest.mark.parametrize(
        ("include_geometry", "geometry_mode", "orient_geometry"), GEOMETRY_OPTIONS
    )
    def test_trace_cable(
        self, pop_network, include_geometry, geometry_mode, orient_geometry
    ):
        options = (include_geometry, geometry_mode, orient_geometry)
        result = trace_cable(pop_network["cables"]["A"].uuid, *options)

        assert result == {
            "entry_point": result["entry_point"],
            **_merge_fiber_traces(result, options),
        }

    def test_trace_node_skips_fibers_an_earlier_trace_covered(self, pop_network):
        result = trace_node(pop_network["pop"].uuid)

        roots = [
            (tree["fiber"]["cable_name"], tree["fiber"]["fiber_number_absolute"])
            for tree in result["trace_trees"]
        ]
        assert len(roots) == 4
        assert {("Cable-A", 3), ("Cable-B", 3)} <= set(roots)
        assert sorted(number for _, number in roots) == [1, 2, 3, 3]

    def test_trace_cable_traces_every_fiber(self, pop_network):
        result = trace_cable(pop_network["cables"]["A"].uuid)

        assert sorted(
            tree["fiber"]["fiber_number_absolute"] for tree in result["trace_trees"]
        ) == [1, 2, 3]


class TestTraceFiberInfrastructure:
    """Pin the cable infrastructure of one fiber trace in each geometry mode."""

    def test_segments_lists_every_trench_of_each_cable(self, pop_network):
        cables, trenches = pop_network["cables"], pop_network["trenches"]

        result = trace_fiber(pop_network["fibers"]["A1"].uuid, include_geometry=True)
        infrastructure = result["cable_infrastructure"]

        assert set(infrastructure) == {str(c.uuid) for c in cables.values()}
        assert _trench_ids(infrastructure, cables["A"]) == {
            str(trenches[key].uuid) for key in ("A1", "A2", "spur")
        }
        assert _trench_ids(infrastructure, cables["B"]) == {str(trenches["B1"].uuid)}
        assert _trench_ids(infrastructure, cables["C"]) == {str(trenches["C1"].uuid)}
        assert all(
            t["geometry"]
            for infra in infrastructure.values()
            for t in infra["trenches"]
        )
        assert result["statistics"]["total_cables"] == 3
        assert result["statistics"]["total_trenches"] == 5

    def test_routed_leaves_out_the_spur_trench(self, pop_network):
        cables, trenches = pop_network["cables"], pop_network["trenches"]

        result = trace_fiber(
            pop_network["fibers"]["A1"].uuid,
            include_geometry=True,
            geometry_mode="routed",
        )
        infrastructure = result["cable_infrastructure"]

        assert _trench_ids(infrastructure, cables["A"]) == {
            str(trenches["A1"].uuid),
            str(trenches["A2"].uuid),
        }
        assert all(infra["merged_geometry"] for infra in infrastructure.values())
        assert result["statistics"]["total_trenches"] == 4

    def test_merged_replaces_trench_geometry_with_one_line(self, pop_network):
        result = trace_fiber(
            pop_network["fibers"]["A1"].uuid,
            include_geometry=True,
            geometry_mode="merged",
        )
        infrastructure = result["cable_infrastructure"]

        assert all(infra["merged_geometry"] for infra in infrastructure.values())
        assert not any(
            "geometry" in t
            for infra in infrastructure.values()
            for t in infra["trenches"]
        )
        assert result["statistics"]["total_trenches"] == 5

    def test_unspliced_fiber_only_lists_its_own_cable(self, pop_network):
        cables = pop_network["cables"]

        result = trace_fiber(pop_network["fibers"]["A3"].uuid, include_geometry=True)

        assert set(result["cable_infrastructure"]) == {str(cables["A"].uuid)}
        assert result["statistics"]["total_trenches"] == 3


class TestInfrastructureBuiltOnce:
    """An aggregate builds the cable infrastructure once, not once per fiber."""

    def _count_calls(self, name):
        return mock.patch.object(services, name, wraps=getattr(services, name))

    def test_trace_node(self, pop_network):
        with (
            self._count_calls("_get_cable_infrastructure") as infrastructure,
            self._count_calls("_get_entry_point_info") as entry_point,
        ):
            trace_node(pop_network["pop"].uuid, True, "routed", True)

        assert infrastructure.call_count == 1
        assert entry_point.call_count == 1

    def test_trace_cable(self, pop_network):
        with (
            self._count_calls("_get_cable_infrastructure") as infrastructure,
            self._count_calls("_get_entry_point_info") as entry_point,
        ):
            trace_cable(pop_network["cables"]["A"].uuid, True, "routed", False)

        assert infrastructure.call_count == 1
        assert entry_point.call_count == 1

    def test_simulate_fault(self, pop_network):
        with self._count_calls("_get_cable_infrastructure") as infrastructure:
            simulate_fault(point=[25, 0], project_id=str(pop_network["project"].pk))

        assert infrastructure.call_count == 1


class TestQueriesDoNotGrowWithFibers:
    """A trace walks all its fibers in one query instead of one per fiber."""

    @pytest.mark.parametrize(
        "run",
        [
            pytest.param(
                lambda net: trace_cable(net["cables"]["A"].uuid, True, "routed", True),
                id="trace_cable",
            ),
            pytest.param(
                lambda net: trace_node(net["pop"].uuid, True, "routed", True),
                id="trace_node",
            ),
            pytest.param(
                lambda net: simulate_fault(
                    point=[25, 0], project_id=str(net["project"].pk)
                ),
                id="simulate_fault",
            ),
        ],
    )
    def test_query_count_is_independent_of_fiber_count(self, pop_network, run):
        with CaptureQueriesContext(connection) as few_fibers:
            run(pop_network)
        for number in range(4, 10):
            FiberFactory(
                uuid_cable=pop_network["cables"]["A"], fiber_number_absolute=number
            )
        with CaptureQueriesContext(connection) as more_fibers:
            result = run(pop_network)

        assert len(more_fibers.captured_queries) == len(few_fibers.captured_queries)
        assert result


class TestSimulateFaultTrenches:
    """Fault simulation reports every trench the affected fibers run through."""

    def test_lists_each_trench_of_the_affected_paths_once(self, pop_network):
        trenches = pop_network["trenches"]

        result = simulate_fault(
            point=[25, 0], project_id=str(pop_network["project"].pk)
        )
        ids = [
            feature["properties"]["id"]
            for feature in result["geometry"]["affected_trenches"]["features"]
        ]

        assert sorted(ids) == sorted(str(t.uuid) for t in trenches.values())
        assert result["summary"]["total_cables_affected"] == 1
        assert result["summary"]["total_fibers_affected"] == 3
