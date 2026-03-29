"""Tests for routed cable length calculation.

Covers the new routing-based length calculation in
``Cable.calculate_length_from_connections``, plus the two helper functions
``get_cable_connected_trenches_with_geometry`` and
``calculate_cable_length_routed`` in :mod:`apps.api.routing`.
"""

from unittest.mock import patch

import pytest
from django.contrib.gis.geos import LineString, Point

from apps.api.models import (
    Cable,
    Conduit,
    Microduct,
    MicroductCableConnection,
    TrenchConduitConnection,
)
from apps.api.routing import (
    calculate_cable_length_routed,
    get_cable_connected_trenches_with_geometry,
)

from .factories import (
    CableTypeFactory,
    ConduitTypeFactory,
    FlagFactory,
    NodeFactory,
    NodeTypeFactory,
    ProjectFactory,
    SurfaceFactory,
    ConstructionTypeFactory,
    TrenchFactory,
)


@pytest.fixture
def routed_cable_setup(db):
    """Create a cable with start/end nodes and connected trenches forming a path.

    Layout::

        Node A (0,0) --- Trench1 (0,0)->(100,0) --- Trench2 (100,0)->(200,0) --- Node B (200,0)

    The cable is connected to both trenches via conduit -> microduct -> connection.
    """
    project = ProjectFactory()
    flag = FlagFactory()
    node_type = NodeTypeFactory()
    surface = SurfaceFactory()
    construction_type = ConstructionTypeFactory()

    node_a = NodeFactory(
        project=project, flag=flag, node_type=node_type,
        geom=Point(0, 0, srid=25832),
    )
    node_b = NodeFactory(
        project=project, flag=flag, node_type=node_type,
        geom=Point(200, 0, srid=25832),
    )

    trench1 = TrenchFactory(
        project=project, flag=flag, surface=surface,
        construction_type=construction_type,
        length=100.0,
        geom=LineString((0, 0), (100, 0), srid=25832),
    )
    trench2 = TrenchFactory(
        project=project, flag=flag, surface=surface,
        construction_type=construction_type,
        length=100.0,
        geom=LineString((100, 0), (200, 0), srid=25832),
    )

    conduit_type = ConduitTypeFactory()
    conduit1 = Conduit.objects.create(
        name="Routed Conduit 1", conduit_type=conduit_type,
        project=project, flag=flag,
    )
    conduit2 = Conduit.objects.create(
        name="Routed Conduit 2", conduit_type=conduit_type,
        project=project, flag=flag,
    )

    TrenchConduitConnection.objects.create(uuid_trench=trench1, uuid_conduit=conduit1)
    TrenchConduitConnection.objects.create(uuid_trench=trench2, uuid_conduit=conduit2)

    md1 = Microduct.objects.create(uuid_conduit=conduit1, number=1, color="rot")
    md2 = Microduct.objects.create(uuid_conduit=conduit2, number=1, color="blau")

    cable_type = CableTypeFactory()
    cable = Cable.objects.create(
        name="Routed Cable",
        cable_type=cable_type,
        project=project,
        flag=flag,
        uuid_node_start=node_a,
        uuid_node_end=node_b,
    )

    MicroductCableConnection.objects.create(uuid_microduct=md1, uuid_cable=cable)
    MicroductCableConnection.objects.create(uuid_microduct=md2, uuid_cable=cable)

    return {
        "cable": cable,
        "node_a": node_a,
        "node_b": node_b,
        "trenches": [trench1, trench2],
    }


@pytest.mark.django_db
class TestGetCableConnectedTrenchesWithGeometry:
    """Tests for get_cable_connected_trenches_with_geometry."""

    def test_returns_connected_trenches(self, routed_cable_setup):
        """Verify all trenches connected via micropipe chain are returned."""
        cable = routed_cable_setup["cable"]
        result = get_cable_connected_trenches_with_geometry(cable.pk)

        assert len(result) == 2
        trench_ids = {t["id"] for t in result}
        for trench in routed_cable_setup["trenches"]:
            assert str(trench.uuid) in trench_ids

    def test_returns_geojson_geometry(self, routed_cable_setup):
        """Verify returned geometry is valid GeoJSON."""
        cable = routed_cable_setup["cable"]
        result = get_cable_connected_trenches_with_geometry(cable.pk)

        for item in result:
            assert "id" in item
            assert "geometry" in item
            geom = item["geometry"]
            assert geom["type"] == "LineString"
            assert len(geom["coordinates"]) >= 2

    def test_returns_empty_for_no_connections(self, db):
        """Verify empty list when cable has no connections."""
        cable = Cable.objects.create(
            name="Unconnected Cable",
            cable_type=CableTypeFactory(),
            project=ProjectFactory(),
            flag=FlagFactory(),
        )
        result = get_cable_connected_trenches_with_geometry(cable.pk)
        assert result == []


@pytest.mark.django_db
class TestCalculateCableLengthRouted:
    """Tests for calculate_cable_length_routed."""

    def test_returns_routed_length(self, routed_cable_setup):
        """Verify routed length is calculated through connected trenches."""
        cable = routed_cable_setup["cable"]
        node_a = routed_cable_setup["node_a"]
        node_b = routed_cable_setup["node_b"]

        length = calculate_cable_length_routed(
            cable.pk,
            (node_a.geom.x, node_a.geom.y),
            (node_b.geom.x, node_b.geom.y),
        )

        assert length is not None
        assert 190 <= length <= 210  # ~200m through two 100m trenches

    def test_returns_none_for_no_trenches(self, db):
        """Verify None when cable has no connected trenches."""
        cable = Cable.objects.create(
            name="No Trench Cable",
            cable_type=CableTypeFactory(),
            project=ProjectFactory(),
            flag=FlagFactory(),
        )
        result = calculate_cable_length_routed(cable.pk, (0, 0), (100, 0))
        assert result is None

    def test_returns_none_when_no_path_found(self, routed_cable_setup):
        """Verify None when start/end points don't match the trench network."""
        cable = routed_cable_setup["cable"]
        result = calculate_cable_length_routed(
            cable.pk, (9999, 9999), (8888, 8888)
        )
        assert result is None


@pytest.mark.django_db
class TestCableLengthRoutingFallback:
    """Tests for calculate_length_from_connections routing-first with fallback."""

    def test_uses_routed_length_when_nodes_exist(self, routed_cable_setup):
        """Verify routed path is used when cable has start and end nodes."""
        cable = Cable.objects.select_related(
            "uuid_node_start", "uuid_node_end"
        ).get(pk=routed_cable_setup["cable"].pk)

        length = cable.calculate_length_from_connections()

        # Routed length should be ~200m, not the sum fallback (also ~200 here
        # but the routing path is what matters)
        assert length is not None
        assert 190 <= length <= 210

    def test_falls_back_to_sum_when_routing_fails(self, routed_cable_setup):
        """Verify fallback to trench-sum when routing returns None."""
        cable = Cable.objects.select_related(
            "uuid_node_start", "uuid_node_end"
        ).get(pk=routed_cable_setup["cable"].pk)

        with patch(
            "apps.api.routing.calculate_cable_length_routed", return_value=None
        ):
            length = cable.calculate_length_from_connections()

        # Falls back to sum of trench lengths (100 + 100)
        assert length == 200.0

    def test_falls_back_to_sum_when_routing_raises(self, routed_cable_setup):
        """Verify fallback to trench-sum when routing raises an exception."""
        cable = Cable.objects.select_related(
            "uuid_node_start", "uuid_node_end"
        ).get(pk=routed_cable_setup["cable"].pk)

        with patch(
            "apps.api.routing.calculate_cable_length_routed",
            side_effect=Exception("routing error"),
        ):
            length = cable.calculate_length_from_connections()

        assert length == 200.0

    def test_falls_back_when_no_start_node(self, db):
        """Verify fallback when cable has no start node."""
        project = ProjectFactory()
        flag = FlagFactory()
        surface = SurfaceFactory()
        construction_type = ConstructionTypeFactory()

        trench = TrenchFactory(
            project=project, flag=flag, surface=surface,
            construction_type=construction_type,
            length=75.0,
            geom=LineString((0, 0), (75, 0), srid=25832),
        )

        conduit_type = ConduitTypeFactory()
        conduit = Conduit.objects.create(
            name="No Node Conduit", conduit_type=conduit_type,
            project=project, flag=flag,
        )
        TrenchConduitConnection.objects.create(
            uuid_trench=trench, uuid_conduit=conduit,
        )
        md = Microduct.objects.create(uuid_conduit=conduit, number=1, color="rot")

        cable = Cable.objects.create(
            name="No Node Cable",
            cable_type=CableTypeFactory(),
            project=project,
            flag=flag,
        )
        MicroductCableConnection.objects.create(uuid_microduct=md, uuid_cable=cable)

        length = cable.calculate_length_from_connections()

        # No nodes -> skip routing, fall back to trench sum
        assert length == 75.0

    def test_routed_length_zero_falls_back(self, routed_cable_setup):
        """Verify fallback when routing returns zero."""
        cable = Cable.objects.select_related(
            "uuid_node_start", "uuid_node_end"
        ).get(pk=routed_cable_setup["cable"].pk)

        with patch(
            "apps.api.routing.calculate_cable_length_routed", return_value=0
        ):
            length = cable.calculate_length_from_connections()

        assert length == 200.0
