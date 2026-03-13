"""Tests for Conduit, Microduct, and connection models."""

import pytest

from apps.api.models import (
    Conduit,
    Microduct,
    MicroductConnection,
    TrenchConduitConnection,
)

from ..factories import (
    ConduitFactory,
    ConduitTypeFactory,
    FlagFactory,
    MicroductColorFactory,
    NodeFactory,
    ProjectFactory,
    TrenchFactory,
)


@pytest.mark.django_db
class TestConduitModel:
    """Tests for the Conduit model."""

    def test_conduit_creation(self):
        """Test creating a conduit."""
        project = ProjectFactory()
        flag = FlagFactory()
        conduit_type = ConduitTypeFactory()

        conduit = Conduit.objects.create(
            name="Test Conduit",
            conduit_type=conduit_type,
            project=project,
            flag=flag,
        )

        assert conduit.uuid is not None
        assert conduit.name == "Test Conduit"

    def test_conduit_str_representation(self):
        """Test conduit string representation."""
        project = ProjectFactory()
        flag = FlagFactory()
        conduit_type = ConduitTypeFactory()

        conduit = Conduit.objects.create(
            name="My Conduit",
            conduit_type=conduit_type,
            project=project,
            flag=flag,
        )

        assert str(conduit) == "My Conduit"


@pytest.mark.django_db
class TestMicroductModel:
    """Tests for the Microduct model."""

    def test_microduct_creation(self):
        """Test creating a microduct."""
        conduit = ConduitFactory()
        microduct = Microduct.objects.create(
            uuid_conduit=conduit,
            number=1,
            color="rot",
        )
        assert microduct.uuid is not None
        assert microduct.uuid_conduit == conduit
        assert microduct.number == 1

    def test_microduct_str_representation(self):
        """Test microduct string representation."""
        conduit = ConduitFactory(name="TestConduit")
        microduct = Microduct.objects.create(
            uuid_conduit=conduit,
            number=1,
            color="rot",
        )
        assert str(microduct) == "TestConduit-1"

    def test_microduct_color_from_mapping(self):
        """Test that microduct can store color name from MicroductColor."""
        conduit = ConduitFactory()
        color = MicroductColorFactory(name_de="Blau", name_en="Blue")
        microduct = Microduct.objects.create(
            uuid_conduit=conduit,
            number=1,
            color=color.name_de,
        )
        assert microduct.color == "Blau"


@pytest.mark.django_db
class TestMicroductConnectionModel:
    """Tests for the MicroductConnection model."""

    def test_microduct_connection_creation(self):
        """Test creating a microduct connection."""
        conduit1 = ConduitFactory()
        conduit2 = ConduitFactory()
        microduct1 = Microduct.objects.create(
            uuid_conduit=conduit1, number=1, color="rot"
        )
        microduct2 = Microduct.objects.create(
            uuid_conduit=conduit2, number=1, color="rot"
        )
        node = NodeFactory()
        trench1 = TrenchFactory()
        trench2 = TrenchFactory()

        connection = MicroductConnection.objects.create(
            uuid_microduct_from=microduct1,
            uuid_trench_from=trench1,
            uuid_microduct_to=microduct2,
            uuid_trench_to=trench2,
            uuid_node=node,
        )
        assert connection.uuid is not None
        assert connection.uuid_microduct_from == microduct1
        assert connection.uuid_microduct_to == microduct2

    def test_microduct_connection_at_node(self):
        """Test that microduct connections are associated with nodes."""
        conduit = ConduitFactory()
        microduct1 = Microduct.objects.create(
            uuid_conduit=conduit, number=1, color="rot"
        )
        microduct2 = Microduct.objects.create(
            uuid_conduit=conduit, number=2, color="grün"
        )
        node = NodeFactory()
        trench1 = TrenchFactory()
        trench2 = TrenchFactory()

        connection = MicroductConnection.objects.create(
            uuid_microduct_from=microduct1,
            uuid_trench_from=trench1,
            uuid_microduct_to=microduct2,
            uuid_trench_to=trench2,
            uuid_node=node,
        )

        connections_at_node = MicroductConnection.objects.filter(uuid_node=node)
        assert connection in connections_at_node


@pytest.mark.django_db
class TestTrenchConduitConnectionModel:
    """Tests for the TrenchConduitConnection model."""

    def test_trench_conduit_connection_creation(self):
        """Test creating a trench-conduit connection."""
        trench = TrenchFactory()
        conduit = ConduitFactory()

        connection = TrenchConduitConnection.objects.create(
            uuid_trench=trench,
            uuid_conduit=conduit,
        )
        assert connection.uuid is not None
        assert connection.uuid_trench == trench
        assert connection.uuid_conduit == conduit

    def test_multiple_conduits_per_trench(self):
        """Test that multiple conduits can be connected to one trench."""
        trench = TrenchFactory()
        conduit1 = ConduitFactory()
        conduit2 = ConduitFactory()

        TrenchConduitConnection.objects.create(
            uuid_trench=trench, uuid_conduit=conduit1
        )
        TrenchConduitConnection.objects.create(
            uuid_trench=trench, uuid_conduit=conduit2
        )

        connections = TrenchConduitConnection.objects.filter(uuid_trench=trench)
        assert connections.count() == 2

    def test_conduit_across_multiple_trenches(self):
        """Test that a conduit can span multiple trenches."""
        trench1 = TrenchFactory()
        trench2 = TrenchFactory()
        conduit = ConduitFactory()

        TrenchConduitConnection.objects.create(
            uuid_trench=trench1, uuid_conduit=conduit
        )
        TrenchConduitConnection.objects.create(
            uuid_trench=trench2, uuid_conduit=conduit
        )

        connections = TrenchConduitConnection.objects.filter(uuid_conduit=conduit)
        assert connections.count() == 2
