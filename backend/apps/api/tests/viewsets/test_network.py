"""Tests for network ViewSets: Cable, Conduit, Fiber, Microduct, connections."""

import pytest
from apps.api.models import Cable, Conduit
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from ..factories import (
    CableFactory,
    ConduitFactory,
    ConduitTypeFactory,
    ContainerFactory,
    FiberFactory,
    FiberStatusFactory,
    FlagFactory,
    MicroductCableConnectionFactory,
    MicroductConnectionFactory,
    MicroductFactory,
    NodeFactory,
    ProjectFactory,
    TrenchConduitConnectionFactory,
    TrenchFactory,
)

User = get_user_model()


@pytest.fixture
def api_client():
    """Create API client for testing."""
    return APIClient()


@pytest.fixture
def authenticated_client(db):
    """Create an authenticated API client."""
    user = User.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="testpass123",
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestConduitViewSet:
    """Tests for the ConduitViewSet."""

    def test_list_conduits_requires_authentication(self, api_client):
        """Test that listing conduits requires authentication."""
        response = api_client.get("/api/v1/conduit/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_conduits(self, authenticated_client):
        """Test listing conduits."""
        ConduitFactory.create_batch(2)

        response = authenticated_client.get("/api/v1/conduit/")
        assert response.status_code == status.HTTP_200_OK

    def test_create_conduit(self, authenticated_client):
        """Test creating a new conduit."""
        project = ProjectFactory()
        flag = FlagFactory()
        conduit_type = ConduitTypeFactory()

        data = {
            "name": "Test Conduit",
            "project_id": project.id,
            "flag_id": flag.id,
            "conduit_type_id": conduit_type.id,
        }

        response = authenticated_client.post(
            "/api/v1/conduit/",
            data=data,
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert Conduit.objects.count() == 1
        assert Conduit.objects.first().name == "Test Conduit"

    def test_retrieve_conduit(self, authenticated_client):
        """Test retrieving a single conduit."""
        conduit = ConduitFactory(name="My Conduit")

        response = authenticated_client.get(f"/api/v1/conduit/{conduit.uuid}/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "My Conduit"

    def test_update_conduit(self, authenticated_client):
        """Test updating a conduit."""
        conduit = ConduitFactory(name="Original")

        data = {
            "name": "Updated",
            "project_id": conduit.project.id,
            "flag_id": conduit.flag.id,
            "conduit_type_id": conduit.conduit_type.id,
        }

        response = authenticated_client.put(
            f"/api/v1/conduit/{conduit.uuid}/",
            data=data,
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK

        conduit.refresh_from_db()
        assert conduit.name == "Updated"

    def test_delete_conduit(self, authenticated_client):
        """Test deleting a conduit."""
        conduit = ConduitFactory()

        response = authenticated_client.delete(f"/api/v1/conduit/{conduit.uuid}/")
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert Conduit.objects.count() == 0


@pytest.mark.django_db
class TestCableViewSet:
    """Tests for the CableViewSet."""

    def test_list_cables_requires_authentication(self, api_client):
        """Test that listing cables requires authentication."""
        response = api_client.get("/api/v1/cable/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_cables(self, authenticated_client):
        """Test listing cables."""
        CableFactory.create_batch(2)

        response = authenticated_client.get("/api/v1/cable/")
        assert response.status_code == status.HTTP_200_OK

    def test_cable_list(self, authenticated_client):
        """Test cable list endpoint returns data."""
        CableFactory.create_batch(2)

        response = authenticated_client.get("/api/v1/cable/")
        assert response.status_code == status.HTTP_200_OK

    def test_retrieve_cable(self, authenticated_client):
        """Test retrieving a single cable."""
        cable = CableFactory(name="My Cable")

        response = authenticated_client.get(f"/api/v1/cable/{cable.uuid}/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "My Cable"

    def test_delete_cable(self, authenticated_client):
        """Test deleting a cable."""
        cable = CableFactory()

        response = authenticated_client.delete(f"/api/v1/cable/{cable.uuid}/")
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert Cable.objects.count() == 0

    def test_cables_in_trench(self, authenticated_client):
        """Test getting cables that pass through a trench."""
        # Create the full relationship chain:
        # Trench -> TrenchConduitConnection -> Conduit -> Microduct -> MicroductCableConnection -> Cable
        trench = TrenchFactory()
        conduit = ConduitFactory()
        TrenchConduitConnectionFactory(uuid_trench=trench, uuid_conduit=conduit)
        microduct = MicroductFactory(uuid_conduit=conduit)
        cable = CableFactory(name="Cable In Trench")
        MicroductCableConnectionFactory(uuid_microduct=microduct, uuid_cable=cable)

        response = authenticated_client.get(f"/api/v1/cable/in-trench/{trench.uuid}/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["name"] == "Cable In Trench"
        assert response.data[0]["uuid"] == str(cable.uuid)

    def test_cables_in_trench_empty(self, authenticated_client):
        """Test getting cables for a trench with no cables."""
        trench = TrenchFactory()

        response = authenticated_client.get(f"/api/v1/cable/in-trench/{trench.uuid}/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 0

    def test_cables_in_trench_multiple_cables(self, authenticated_client):
        """Test getting multiple cables that pass through a trench."""
        trench = TrenchFactory()
        conduit = ConduitFactory()
        TrenchConduitConnectionFactory(uuid_trench=trench, uuid_conduit=conduit)

        # Create two microducts with different cables
        microduct1 = MicroductFactory(uuid_conduit=conduit, number=1)
        microduct2 = MicroductFactory(uuid_conduit=conduit, number=2)
        cable1 = CableFactory(name="Cable A")
        cable2 = CableFactory(name="Cable B")
        MicroductCableConnectionFactory(uuid_microduct=microduct1, uuid_cable=cable1)
        MicroductCableConnectionFactory(uuid_microduct=microduct2, uuid_cable=cable2)

        response = authenticated_client.get(f"/api/v1/cable/in-trench/{trench.uuid}/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2
        cable_names = [c["name"] for c in response.data]
        assert "Cable A" in cable_names
        assert "Cable B" in cable_names

    def test_cables_in_trench_returns_distinct(self, authenticated_client):
        """Test that cables are returned distinctly even if in multiple microducts."""
        trench = TrenchFactory()
        conduit = ConduitFactory()
        TrenchConduitConnectionFactory(uuid_trench=trench, uuid_conduit=conduit)

        # Same cable in two microducts
        microduct1 = MicroductFactory(uuid_conduit=conduit, number=1)
        microduct2 = MicroductFactory(uuid_conduit=conduit, number=2)
        cable = CableFactory(name="Single Cable")
        MicroductCableConnectionFactory(uuid_microduct=microduct1, uuid_cable=cable)
        MicroductCableConnectionFactory(uuid_microduct=microduct2, uuid_cable=cable)

        response = authenticated_client.get(f"/api/v1/cable/in-trench/{trench.uuid}/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["name"] == "Single Cable"


@pytest.mark.django_db
class TestMicroductViewSet:
    """Tests for the MicroductViewSet."""

    def test_list_microducts_requires_authentication(self, api_client):
        """Test that listing microducts requires authentication."""
        response = api_client.get("/api/v1/microduct/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_microducts(self, authenticated_client):
        """Test listing microducts."""
        conduit = ConduitFactory()
        MicroductFactory.create_batch(2, uuid_conduit=conduit)

        response = authenticated_client.get("/api/v1/microduct/")
        assert response.status_code == status.HTTP_200_OK

    def test_filter_microducts_by_conduit(self, authenticated_client):
        """Test filtering microducts by conduit."""
        conduit1 = ConduitFactory()
        conduit2 = ConduitFactory()

        MicroductFactory(uuid_conduit=conduit1)
        MicroductFactory(uuid_conduit=conduit1)
        MicroductFactory(uuid_conduit=conduit2)

        response = authenticated_client.get(
            f"/api/v1/microduct/?conduit={conduit1.uuid}"
        )
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestFiberViewSet:
    """Tests for the FiberViewSet."""

    def test_list_fibers_requires_authentication(self, api_client):
        """Test that listing fibers requires authentication."""
        response = api_client.get("/api/v1/fiber/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_fibers(self, authenticated_client):
        """Test listing fibers."""
        cable = CableFactory()
        FiberFactory(
            uuid_cable=cable, fiber_number_absolute=1, fiber_number_in_bundle=1
        )
        FiberFactory(
            uuid_cable=cable, fiber_number_absolute=2, fiber_number_in_bundle=2
        )

        response = authenticated_client.get("/api/v1/fiber/")
        assert response.status_code == status.HTTP_200_OK

    def test_filter_fibers_by_cable(self, authenticated_client):
        """Test filtering fibers by cable."""
        cable1 = CableFactory()
        cable2 = CableFactory()
        FiberFactory(
            uuid_cable=cable1, fiber_number_absolute=1, fiber_number_in_bundle=1
        )
        FiberFactory(
            uuid_cable=cable2, fiber_number_absolute=1, fiber_number_in_bundle=1
        )

        response = authenticated_client.get(f"/api/v1/fiber/?cable={cable1.uuid}")
        assert response.status_code == status.HTTP_200_OK

    def test_patch_fiber_status(self, authenticated_client):
        """Test updating fiber status via PATCH."""
        cable = CableFactory()
        fiber = FiberFactory(
            uuid_cable=cable, fiber_number_absolute=1, fiber_number_in_bundle=1
        )
        fiber_status = FiberStatusFactory(fiber_status="Defekt")

        response = authenticated_client.patch(
            f"/api/v1/fiber/{fiber.uuid}/",
            data={"fiber_status_id": fiber_status.id},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK

        fiber.refresh_from_db()
        assert fiber.fiber_status == fiber_status

    def test_patch_fiber_status_to_null(self, authenticated_client):
        """Test clearing fiber status via PATCH."""
        fiber_status = FiberStatusFactory(fiber_status="Defekt")
        cable = CableFactory()
        fiber = FiberFactory(
            uuid_cable=cable,
            fiber_number_absolute=1,
            fiber_number_in_bundle=1,
            fiber_status=fiber_status,
        )

        response = authenticated_client.patch(
            f"/api/v1/fiber/{fiber.uuid}/",
            data={"fiber_status_id": None},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK

        fiber.refresh_from_db()
        assert fiber.fiber_status is None


@pytest.mark.django_db
class TestAttributesFiberStatusViewSet:
    """Tests for the AttributesFiberStatusViewSet."""

    def test_list_fiber_statuses_requires_authentication(self, api_client):
        """Test that listing fiber statuses requires authentication."""
        response = api_client.get("/api/v1/attributes_fiber_status/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_fiber_statuses(self, authenticated_client):
        """Test listing fiber statuses."""
        FiberStatusFactory(fiber_status="Defekt")
        FiberStatusFactory(fiber_status="Beschädigt")

        response = authenticated_client.get("/api/v1/attributes_fiber_status/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2


@pytest.mark.django_db
class TestFiberSpliceViewSet:
    """Tests for the FiberSpliceViewSet."""

    def test_list_fiber_splices_requires_authentication(self, api_client):
        """Test that listing fiber splices requires authentication."""
        response = api_client.get("/api/v1/fiber-splice/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_fiber_splices(self, authenticated_client):
        """Test listing fiber splices."""
        response = authenticated_client.get("/api/v1/fiber-splice/")
        assert response.status_code == status.HTTP_200_OK

    def test_filter_by_node(self, authenticated_client):
        """Test filtering fiber splices by node via node_structure__uuid_node."""
        node = NodeFactory()
        response = authenticated_client.get(
            f"/api/v1/fiber-splice/?node_structure__uuid_node={node.uuid}"
        )
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestContainerViewSet:
    """Tests for the ContainerViewSet."""

    def test_list_containers_requires_authentication(self, api_client):
        """Test that listing containers requires authentication."""
        response = api_client.get("/api/v1/container/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_containers(self, authenticated_client):
        """Test listing containers."""
        ContainerFactory.create_batch(2)

        response = authenticated_client.get("/api/v1/container/")
        assert response.status_code == status.HTTP_200_OK

    def test_filter_by_node(self, authenticated_client):
        """Test filtering containers by node."""
        node = NodeFactory()
        ContainerFactory(uuid_node=node)

        response = authenticated_client.get(f"/api/v1/container/?node={node.uuid}")
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestTrenchConduitConnectionViewSet:
    """Tests for the TrenchConduitConnectionViewSet."""

    def test_list_connections_requires_authentication(self, api_client):
        """Test that listing connections requires authentication."""
        response = api_client.get("/api/v1/trench_conduit_connection/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_connections(self, authenticated_client):
        """Test listing trench-conduit connections."""
        response = authenticated_client.get("/api/v1/trench_conduit_connection/")
        assert response.status_code == status.HTTP_200_OK

    def test_create_connection(self, authenticated_client):
        """Test creating a trench-conduit connection."""
        trench = TrenchFactory()
        conduit = ConduitFactory()

        data = {
            "uuid_trench": str(trench.uuid),
            "uuid_conduit": str(conduit.uuid),
        }

        response = authenticated_client.post(
            "/api/v1/trench_conduit_connection/",
            data=data,
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED

    def test_filter_by_trench(self, authenticated_client):
        """Test filtering connections by trench."""
        trench = TrenchFactory()
        TrenchConduitConnectionFactory(uuid_trench=trench)

        response = authenticated_client.get(
            f"/api/v1/trench_conduit_connection/?uuid_trench={trench.uuid}"
        )
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestMicroductConnectionViewSet:
    """Tests for the MicroductConnectionViewSet."""

    def test_list_connections_requires_authentication(self, api_client):
        """Test that listing connections requires authentication."""
        response = api_client.get("/api/v1/microduct_connection/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_connections(self, authenticated_client):
        """Test listing microduct connections."""
        response = authenticated_client.get("/api/v1/microduct_connection/")
        assert response.status_code == status.HTTP_200_OK

    def test_filter_by_node(self, authenticated_client):
        """Test filtering connections by node."""
        node = NodeFactory()
        MicroductConnectionFactory(uuid_node=node)

        response = authenticated_client.get(
            f"/api/v1/microduct_connection/?uuid_node={node.uuid}"
        )
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestMicroductCableConnectionViewSet:
    """Tests for the MicroductCableConnectionViewSet."""

    def test_list_connections_requires_authentication(self, api_client):
        """Test that listing connections requires authentication."""
        response = api_client.get("/api/v1/microduct_cable_connection/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_connections(self, authenticated_client):
        """Test listing microduct-cable connections."""
        response = authenticated_client.get("/api/v1/microduct_cable_connection/")
        assert response.status_code == status.HTTP_200_OK

    def test_filter_by_cable(self, authenticated_client):
        """Test filtering connections by cable."""
        cable = CableFactory()
        MicroductCableConnectionFactory(uuid_cable=cable)

        response = authenticated_client.get(
            f"/api/v1/microduct_cable_connection/?uuid_cable={cable.uuid}"
        )
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestNodeTrenchSelectionViewSet:
    """Tests for the NodeTrenchSelectionViewSet."""

    def test_list_selections_requires_authentication(self, api_client):
        """Test that listing selections requires authentication."""
        response = api_client.get("/api/v1/node-trench-selection/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_selections(self, authenticated_client):
        """Test listing node-trench selections."""
        response = authenticated_client.get("/api/v1/node-trench-selection/")
        assert response.status_code == status.HTTP_200_OK

    def test_filter_by_node(self, authenticated_client):
        """Test filtering selections by node."""
        node = NodeFactory()
        response = authenticated_client.get(
            f"/api/v1/node-trench-selection/?node={node.uuid}"
        )
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestResidentialUnitViewSet:
    """Tests for the ResidentialUnitViewSet."""

    def test_list_residential_units_requires_authentication(self, api_client):
        """Test that listing residential units requires authentication."""
        response = api_client.get("/api/v1/residential-unit/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_residential_units(self, authenticated_client):
        """Test listing residential units."""
        from apps.api.models import ResidentialUnit

        from ..factories import AddressFactory

        address = AddressFactory()
        ResidentialUnit.objects.create(uuid_address=address, floor=1)
        ResidentialUnit.objects.create(uuid_address=address, floor=2)

        response = authenticated_client.get("/api/v1/residential-unit/")
        assert response.status_code == status.HTTP_200_OK

    def test_create_residential_unit(self, authenticated_client):
        """Test creating a residential unit."""
        from ..factories import AddressFactory

        address = AddressFactory()

        data = {
            "uuid_address_id": str(address.uuid),
            "floor": 3,
            "side": "left",
        }

        response = authenticated_client.post(
            "/api/v1/residential-unit/",
            data=data,
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED

    def test_filter_by_address(self, authenticated_client):
        """Test filtering residential units by address."""
        from apps.api.models import ResidentialUnit

        from ..factories import AddressFactory

        address1 = AddressFactory()
        address2 = AddressFactory()

        ResidentialUnit.objects.create(uuid_address=address1, floor=1)
        ResidentialUnit.objects.create(uuid_address=address2, floor=1)

        response = authenticated_client.get(
            f"/api/v1/residential-unit/?uuid_address={address1.uuid}"
        )
        assert response.status_code == status.HTTP_200_OK
