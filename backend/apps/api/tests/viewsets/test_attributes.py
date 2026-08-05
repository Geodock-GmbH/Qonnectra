"""Tests for read-only attribute ViewSets."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from ..factories import (
    AreaTypeFactory,
    CompanyFactory,
    ComponentStructureFactory,
    ComponentTypeFactory,
    ConduitTypeFactory,
    ConstructionTypeFactory,
    FiberColorFactory,
    MicroductColorFactory,
    MicroductStatusFactory,
    NetworkLevelFactory,
    NodeTypeFactory,
    ResidentialUnitStatusFactory,
    ResidentialUnitTypeFactory,
    StatusDevelopmentFactory,
    StatusFactory,
    SurfaceFactory,
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
class TestAttributeViewSets:
    """Tests for read-only attribute ViewSets."""

    def test_list_node_types(self, authenticated_client):
        """Test listing node types."""
        NodeTypeFactory.create_batch(3)

        response = authenticated_client.get("/api/v1/attributes_node_type/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 3

    def test_list_conduit_types(self, authenticated_client):
        """Test listing conduit types."""
        ConduitTypeFactory.create_batch(2)

        response = authenticated_client.get("/api/v1/attributes_conduit_type/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2

    def test_list_statuses(self, authenticated_client):
        """Test listing statuses."""
        StatusFactory.create_batch(2)

        response = authenticated_client.get("/api/v1/attributes_status/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2

    def test_list_network_levels(self, authenticated_client):
        """Test listing network levels."""
        NetworkLevelFactory.create_batch(2)

        response = authenticated_client.get("/api/v1/attributes_network_level/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2

    def test_list_companies(self, authenticated_client):
        """Test listing companies."""
        CompanyFactory.create_batch(2)

        response = authenticated_client.get("/api/v1/attributes_company/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2

    def test_list_surfaces(self, authenticated_client):
        """Test listing surfaces."""
        SurfaceFactory.create_batch(2)

        response = authenticated_client.get("/api/v1/attributes_surface/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2

    def test_list_construction_types(self, authenticated_client):
        """Test listing construction types."""
        ConstructionTypeFactory.create_batch(2)

        response = authenticated_client.get("/api/v1/attributes_construction_type/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2

    def test_list_area_types(self, authenticated_client):
        """Test listing area types."""
        AreaTypeFactory.create_batch(2)

        response = authenticated_client.get("/api/v1/attributes_area_type/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2

    def test_filter_node_types_by_exclude_group(self, authenticated_client):
        """Test filtering node types by excluding a group."""
        NodeTypeFactory(node_type="Type 1", group="GroupA")
        NodeTypeFactory(node_type="Type 2", group="GroupA")
        NodeTypeFactory(node_type="Type 3", group="GroupB")

        response = authenticated_client.get(
            "/api/v1/attributes_node_type/?exclude_group=GroupA"
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["node_type"] == "Type 3"

    def test_retrieve_node_type(self, authenticated_client):
        """Test retrieving a single node type by id."""
        node_type = NodeTypeFactory(node_type="Retrievable Type")

        response = authenticated_client.get(
            f"/api/v1/attributes_node_type/{node_type.id}/"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["node_type"] == "Retrievable Type"

    def test_list_requires_authentication(self, api_client):
        """Test that anonymous access to an attribute list is rejected."""
        response = api_client.get("/api/v1/attributes_node_type/")
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )


@pytest.mark.django_db
class TestNetworkAttributeViewSets:
    """Tests for the microduct/fiber/component/residential attribute ViewSets."""

    def test_list_microduct_statuses(self, authenticated_client):
        """Test listing microduct statuses."""
        MicroductStatusFactory.create_batch(2)

        response = authenticated_client.get("/api/v1/attributes_microduct_status/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2

    def test_list_microduct_colors(self, authenticated_client):
        """Test listing microduct colors."""
        MicroductColorFactory.create_batch(3)

        response = authenticated_client.get("/api/v1/attributes_microduct_color/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 3

    def test_list_fiber_colors(self, authenticated_client):
        """Test listing fiber colors."""
        FiberColorFactory.create_batch(2)

        response = authenticated_client.get("/api/v1/attributes_fiber_color/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2

    def test_list_component_types(self, authenticated_client):
        """Test listing component types."""
        ComponentTypeFactory.create_batch(2)

        response = authenticated_client.get("/api/v1/attributes_component_type/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2

    def test_list_component_structures(self, authenticated_client):
        """Test listing component structures."""
        component_type = ComponentTypeFactory()
        ComponentStructureFactory(component_type=component_type, port=1)
        ComponentStructureFactory(component_type=component_type, port=2)

        response = authenticated_client.get(
            "/api/v1/attributes_component_structure/"
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2

    def test_list_status_developments(self, authenticated_client):
        """Test listing status developments."""
        StatusDevelopmentFactory.create_batch(2)

        response = authenticated_client.get("/api/v1/attributes_status_development/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2

    def test_list_residential_unit_types(self, authenticated_client):
        """Test listing residential unit types."""
        ResidentialUnitTypeFactory.create_batch(2)

        response = authenticated_client.get(
            "/api/v1/attributes_residential_unit_type/"
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2

    def test_list_residential_unit_statuses(self, authenticated_client):
        """Test listing residential unit statuses."""
        ResidentialUnitStatusFactory.create_batch(2)

        response = authenticated_client.get(
            "/api/v1/attributes_residential_unit_status/"
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2
