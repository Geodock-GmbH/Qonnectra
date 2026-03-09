"""Tests for Cable, Fiber, and FiberSplice models."""

import pytest
from django.contrib.gis.geos import LineString

from apps.api.models import (
    AttributesComponentType,
    Cable,
    Conduit,
    Fiber,
    FiberSplice,
    Microduct,
    MicroductCableConnection,
    NodeSlotConfiguration,
    NodeStructure,
    TrenchConduitConnection,
)

from ..factories import (
    CableFactory,
    CableTypeFactory,
    ConduitTypeFactory,
    FiberColorFactory,
    FiberFactory,
    FlagFactory,
    NodeFactory,
    ProjectFactory,
    TrenchFactory,
)


@pytest.mark.django_db
class TestCableModel:
    """Tests for Cable model methods."""

    def test_calculate_length_single_connection(self):
        """Test length calculation with a single trench connection."""
        project = ProjectFactory()
        flag = FlagFactory()

        trench = TrenchFactory(
            project=project,
            flag=flag,
            length=150.0,
            geom=LineString((0, 0), (150, 0), srid=25832),
        )

        conduit_type = ConduitTypeFactory()
        conduit = Conduit.objects.create(
            name="Single Trench Conduit",
            conduit_type=conduit_type,
            project=project,
            flag=flag,
        )

        TrenchConduitConnection.objects.create(
            uuid_trench=trench,
            uuid_conduit=conduit,
        )

        microduct = Microduct.objects.create(
            uuid_conduit=conduit,
            number=1,
            color="rot",
        )

        cable_type = CableTypeFactory()
        cable = Cable.objects.create(
            name="Single Connection Cable",
            cable_type=cable_type,
            project=project,
            flag=flag,
        )

        MicroductCableConnection.objects.create(
            uuid_microduct=microduct,
            uuid_cable=cable,
        )

        length = cable.calculate_length_from_connections()
        assert length == 150.0

    def test_calculate_length_multiple_connections(self):
        """Test length calculation with multiple trench connections."""
        project = ProjectFactory()
        flag = FlagFactory()

        trench_lengths = [25.5, 50.0, 75.25, 100.0]
        total_expected = sum(trench_lengths)

        trenches = []
        for i, length in enumerate(trench_lengths):
            trench = TrenchFactory(
                project=project,
                flag=flag,
                length=length,
                geom=LineString((i * 100, 0), (i * 100 + length, 0), srid=25832),
            )
            trenches.append(trench)

        conduit_type = ConduitTypeFactory()
        conduits = []
        microducts = []

        for i, trench in enumerate(trenches):
            conduit = Conduit.objects.create(
                name=f"Multi Conduit {i}",
                conduit_type=conduit_type,
                project=project,
                flag=flag,
            )
            conduits.append(conduit)

            TrenchConduitConnection.objects.create(
                uuid_trench=trench,
                uuid_conduit=conduit,
            )

            microduct = Microduct.objects.create(
                uuid_conduit=conduit,
                number=1,
                color=f"color{i}",
            )
            microducts.append(microduct)

        cable_type = CableTypeFactory()
        cable = Cable.objects.create(
            name="Multi Connection Cable",
            cable_type=cable_type,
            project=project,
            flag=flag,
        )

        for microduct in microducts:
            MicroductCableConnection.objects.create(
                uuid_microduct=microduct,
                uuid_cable=cable,
            )

        length = cable.calculate_length_from_connections()
        assert length == total_expected

    def test_calculate_length_no_connections(self):
        """Test length calculation with no connections returns 0."""
        project = ProjectFactory()
        flag = FlagFactory()
        cable_type = CableTypeFactory()

        cable = Cable.objects.create(
            name="No Connection Cable",
            cable_type=cable_type,
            project=project,
            flag=flag,
        )

        length = cable.calculate_length_from_connections()
        assert length == 0.0

    def test_calculate_length_distinct_trenches(self):
        """Test that duplicate trench connections are counted once."""
        project = ProjectFactory()
        flag = FlagFactory()

        trench = TrenchFactory(
            project=project,
            flag=flag,
            length=100.0,
            geom=LineString((0, 0), (100, 0), srid=25832),
        )

        conduit_type = ConduitTypeFactory()
        conduit = Conduit.objects.create(
            name="Single Trench Multiple Microducts",
            conduit_type=conduit_type,
            project=project,
            flag=flag,
        )

        TrenchConduitConnection.objects.create(
            uuid_trench=trench,
            uuid_conduit=conduit,
        )

        microduct1 = Microduct.objects.create(uuid_conduit=conduit, number=1, color="rot")
        microduct2 = Microduct.objects.create(uuid_conduit=conduit, number=2, color="grün")
        microduct3 = Microduct.objects.create(uuid_conduit=conduit, number=3, color="blau")

        cable_type = CableTypeFactory()
        cable = Cable.objects.create(
            name="Distinct Trench Test Cable",
            cable_type=cable_type,
            project=project,
            flag=flag,
        )

        for microduct in [microduct1, microduct2, microduct3]:
            MicroductCableConnection.objects.create(
                uuid_microduct=microduct,
                uuid_cable=cable,
            )

        length = cable.calculate_length_from_connections()
        assert length == 100.0

    def test_update_length_modifies_cable(self):
        """Test that update_length_from_connections modifies the cable length field."""
        project = ProjectFactory()
        flag = FlagFactory()

        trench = TrenchFactory(
            project=project,
            flag=flag,
            length=200.0,
            geom=LineString((0, 0), (200, 0), srid=25832),
        )

        conduit_type = ConduitTypeFactory()
        conduit = Conduit.objects.create(
            name="Update Test Conduit",
            conduit_type=conduit_type,
            project=project,
            flag=flag,
        )

        TrenchConduitConnection.objects.create(
            uuid_trench=trench,
            uuid_conduit=conduit,
        )

        microduct = Microduct.objects.create(
            uuid_conduit=conduit,
            number=1,
            color="rot",
        )

        cable_type = CableTypeFactory()
        cable = Cable.objects.create(
            name="Update Length Cable",
            cable_type=cable_type,
            project=project,
            flag=flag,
        )

        MicroductCableConnection.objects.create(
            uuid_microduct=microduct,
            uuid_cable=cable,
        )

        cable.refresh_from_db()
        assert cable.length == 200.0

    def test_update_length_total_includes_reserves(self):
        """Test that length_total = length + all reserves."""
        project = ProjectFactory()
        flag = FlagFactory()

        trench = TrenchFactory(
            project=project,
            flag=flag,
            length=100.0,
            geom=LineString((0, 0), (100, 0), srid=25832),
        )

        conduit_type = ConduitTypeFactory()
        conduit = Conduit.objects.create(
            name="Reserve Total Conduit",
            conduit_type=conduit_type,
            project=project,
            flag=flag,
        )

        TrenchConduitConnection.objects.create(
            uuid_trench=trench,
            uuid_conduit=conduit,
        )

        microduct = Microduct.objects.create(
            uuid_conduit=conduit,
            number=1,
            color="rot",
        )

        cable_type = CableTypeFactory()
        cable = Cable.objects.create(
            name="Reserve Total Cable",
            cable_type=cable_type,
            project=project,
            flag=flag,
            reserve_at_start=20,
            reserve_at_end=30,
            reserve_section=10,
        )

        MicroductCableConnection.objects.create(
            uuid_microduct=microduct,
            uuid_cable=cable,
        )

        cable.refresh_from_db()
        assert cable.length == 100.0
        assert cable.length_total == 160.0

    def test_update_length_total_with_none_reserves(self):
        """Test length_total handles None reserve values."""
        project = ProjectFactory()
        flag = FlagFactory()

        trench = TrenchFactory(
            project=project,
            flag=flag,
            length=50.0,
            geom=LineString((0, 0), (50, 0), srid=25832),
        )

        conduit_type = ConduitTypeFactory()
        conduit = Conduit.objects.create(
            name="None Reserve Conduit",
            conduit_type=conduit_type,
            project=project,
            flag=flag,
        )

        TrenchConduitConnection.objects.create(
            uuid_trench=trench,
            uuid_conduit=conduit,
        )

        microduct = Microduct.objects.create(
            uuid_conduit=conduit,
            number=1,
            color="rot",
        )

        cable_type = CableTypeFactory()
        cable = Cable.objects.create(
            name="None Reserve Cable",
            cable_type=cable_type,
            project=project,
            flag=flag,
            reserve_at_start=None,
            reserve_at_end=None,
            reserve_section=None,
        )

        MicroductCableConnection.objects.create(
            uuid_microduct=microduct,
            uuid_cable=cable,
        )

        cable.refresh_from_db()
        assert cable.length == 50.0
        assert cable.length_total == 50.0

    def test_update_length_partial_reserves(self):
        """Test length_total with some reserves set and others None."""
        project = ProjectFactory()
        flag = FlagFactory()

        trench = TrenchFactory(
            project=project,
            flag=flag,
            length=75.0,
            geom=LineString((0, 0), (75, 0), srid=25832),
        )

        conduit_type = ConduitTypeFactory()
        conduit = Conduit.objects.create(
            name="Partial Reserve Conduit",
            conduit_type=conduit_type,
            project=project,
            flag=flag,
        )

        TrenchConduitConnection.objects.create(
            uuid_trench=trench,
            uuid_conduit=conduit,
        )

        microduct = Microduct.objects.create(
            uuid_conduit=conduit,
            number=1,
            color="rot",
        )

        cable_type = CableTypeFactory()
        cable = Cable.objects.create(
            name="Partial Reserve Cable",
            cable_type=cable_type,
            project=project,
            flag=flag,
            reserve_at_start=15,
            reserve_at_end=None,
            reserve_section=10,
        )

        MicroductCableConnection.objects.create(
            uuid_microduct=microduct,
            uuid_cable=cable,
        )

        cable.refresh_from_db()
        assert cable.length == 75.0
        assert cable.length_total == 100.0


@pytest.mark.django_db
class TestFiberModel:
    """Tests for the Fiber model."""

    def test_fiber_creation(self):
        """Test creating a fiber."""
        cable = CableFactory()
        project = ProjectFactory()
        flag = FlagFactory()
        fiber = Fiber.objects.create(
            uuid_cable=cable,
            bundle_number=1,
            bundle_color="rot",
            fiber_number_absolute=1,
            fiber_number_in_bundle=1,
            fiber_color="blau",
            project=project,
            flag=flag,
        )
        assert fiber.uuid is not None
        assert fiber.uuid_cable == cable
        assert fiber.fiber_number_absolute == 1

    def test_fiber_using_factory(self):
        """Test creating a fiber using the factory."""
        fiber = FiberFactory()
        assert fiber.uuid is not None
        assert fiber.uuid_cable is not None
        assert fiber.bundle_number is not None
        assert fiber.fiber_color is not None

    def test_fiber_with_color_reference(self):
        """Test fiber with color reference from factory."""
        cable = CableFactory()
        project = ProjectFactory()
        flag = FlagFactory()
        fiber_color = FiberColorFactory()
        fiber = Fiber.objects.create(
            uuid_cable=cable,
            bundle_number=1,
            bundle_color="rot",
            fiber_number_absolute=1,
            fiber_number_in_bundle=1,
            fiber_color=fiber_color.name_de,
            project=project,
            flag=flag,
        )
        assert fiber.fiber_color == fiber_color.name_de

    def test_fiber_active_default(self):
        """Test that fiber is active by default."""
        fiber = FiberFactory()
        assert fiber.active is True

    def test_multiple_fibers_in_cable(self):
        """Test creating multiple fibers in the same cable."""
        cable = CableFactory()
        project = ProjectFactory()
        flag = FlagFactory()
        fibers = []
        for i in range(1, 13):
            fiber = Fiber.objects.create(
                uuid_cable=cable,
                bundle_number=1,
                bundle_color="rot",
                fiber_number_absolute=i,
                fiber_number_in_bundle=i,
                fiber_color=f"color_{i}",
                project=project,
                flag=flag,
            )
            fibers.append(fiber)

        cable_fibers = Fiber.objects.filter(uuid_cable=cable)
        assert cable_fibers.count() == 12
        for fiber in fibers:
            assert fiber in cable_fibers


@pytest.mark.django_db
class TestFiberSpliceModel:
    """Tests for the FiberSplice model."""

    def test_fiber_splice_creation(self):
        """Test creating a fiber splice."""
        project = ProjectFactory()
        flag = FlagFactory()
        cable1 = CableFactory()
        cable2 = CableFactory()
        fiber1 = Fiber.objects.create(
            uuid_cable=cable1,
            bundle_number=1,
            bundle_color="rot",
            fiber_number_absolute=1,
            fiber_number_in_bundle=1,
            fiber_color="blau",
            project=project,
            flag=flag,
        )
        fiber2 = Fiber.objects.create(
            uuid_cable=cable2,
            bundle_number=1,
            bundle_color="rot",
            fiber_number_absolute=1,
            fiber_number_in_bundle=1,
            fiber_color="blau",
            project=project,
            flag=flag,
        )
        node = NodeFactory()

        slot_config = NodeSlotConfiguration.objects.create(
            uuid_node=node,
            side="A",
            total_slots=12,
        )

        component_type = AttributesComponentType.objects.create(
            component_type="Splice Cassette",
            occupied_slots=1,
        )

        node_structure = NodeStructure.objects.create(
            uuid_node=node,
            slot_configuration=slot_config,
            component_type=component_type,
            slot_start=1,
            slot_end=1,
        )

        splice = FiberSplice.objects.create(
            node_structure=node_structure,
            port_number=1,
            fiber_a=fiber1,
            cable_a=cable1,
            fiber_b=fiber2,
            cable_b=cable2,
        )
        assert splice.uuid is not None
        assert splice.fiber_a == fiber1
        assert splice.fiber_b == fiber2

    def test_fiber_splice_at_node_structure(self):
        """Test fiber splices are tracked at node structures."""
        project = ProjectFactory()
        flag = FlagFactory()
        cable = CableFactory()
        fiber1 = Fiber.objects.create(
            uuid_cable=cable,
            bundle_number=1,
            bundle_color="rot",
            fiber_number_absolute=1,
            fiber_number_in_bundle=1,
            fiber_color="blau",
            project=project,
            flag=flag,
        )
        fiber2 = Fiber.objects.create(
            uuid_cable=cable,
            bundle_number=1,
            bundle_color="rot",
            fiber_number_absolute=2,
            fiber_number_in_bundle=2,
            fiber_color="grün",
            project=project,
            flag=flag,
        )
        node = NodeFactory()

        slot_config = NodeSlotConfiguration.objects.create(
            uuid_node=node,
            side="A",
            total_slots=12,
        )

        component_type = AttributesComponentType.objects.create(
            component_type="Test Cassette",
            occupied_slots=1,
        )

        node_structure = NodeStructure.objects.create(
            uuid_node=node,
            slot_configuration=slot_config,
            component_type=component_type,
            slot_start=1,
            slot_end=1,
        )

        splice = FiberSplice.objects.create(
            node_structure=node_structure,
            port_number=1,
            fiber_a=fiber1,
            cable_a=cable,
            fiber_b=fiber2,
            cable_b=cable,
        )

        splices_at_structure = FiberSplice.objects.filter(node_structure=node_structure)
        assert splice in splices_at_structure

    def test_fiber_splice_partial_connection(self):
        """Test fiber splice with only one fiber connected."""
        project = ProjectFactory()
        flag = FlagFactory()
        cable = CableFactory()
        fiber = Fiber.objects.create(
            uuid_cable=cable,
            bundle_number=1,
            bundle_color="rot",
            fiber_number_absolute=1,
            fiber_number_in_bundle=1,
            fiber_color="blau",
            project=project,
            flag=flag,
        )
        node = NodeFactory()

        slot_config = NodeSlotConfiguration.objects.create(
            uuid_node=node,
            side="A",
            total_slots=12,
        )

        component_type = AttributesComponentType.objects.create(
            component_type="Partial Cassette",
            occupied_slots=1,
        )

        node_structure = NodeStructure.objects.create(
            uuid_node=node,
            slot_configuration=slot_config,
            component_type=component_type,
            slot_start=1,
            slot_end=1,
        )

        splice = FiberSplice.objects.create(
            node_structure=node_structure,
            port_number=1,
            fiber_a=fiber,
            cable_a=cable,
            fiber_b=None,
            cable_b=None,
        )
        assert splice.uuid is not None
        assert splice.fiber_a == fiber
        assert splice.fiber_b is None
