"""Tests for GeoJSON ViewSets: Trench, Node, Address, Area."""

import pytest
from apps.api.models import Node
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from ..factories import (
    AddressFactory,
    AreaFactory,
    FlagFactory,
    NodeFactory,
    NodeTypeFactory,
    ProjectFactory,
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
    user = User.objects.create_superuser(
        username="testuser",
        email="test@example.com",
        password="testpass123",
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestTrenchViewSet:
    """Tests for the TrenchViewSet."""

    def test_list_trenches_requires_authentication(self, api_client):
        """Test that listing trenches requires authentication."""
        response = api_client.get("/api/v1/trench/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_trenches(self, authenticated_client):
        """Test listing trenches."""
        TrenchFactory.create_batch(2)

        response = authenticated_client.get("/api/v1/trench/")
        assert response.status_code == status.HTTP_200_OK

    def test_retrieve_trench_by_project_filter(self, authenticated_client):
        """Test retrieving trenches by project filter."""
        trench = TrenchFactory()

        response = authenticated_client.get(
            f"/api/v1/trench/?project={trench.project.id}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert "results" in response.data
        assert "features" in response.data["results"]

    def test_trench_list_returns_geojson(self, authenticated_client):
        """Test that trench list returns paginated GeoJSON format."""
        TrenchFactory.create_batch(2)

        response = authenticated_client.get("/api/v1/trench/")
        assert response.status_code == status.HTTP_200_OK
        assert "results" in response.data
        assert "features" in response.data["results"]

    def test_filter_trenches_by_project(self, authenticated_client):
        """Test filtering trenches by project."""
        project1 = ProjectFactory()
        project2 = ProjectFactory()

        TrenchFactory(project=project1)
        TrenchFactory(project=project1)
        TrenchFactory(project=project2)

        response = authenticated_client.get(f"/api/v1/trench/?project={project1.id}")
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestNodeViewSet:
    """Tests for the NodeViewSet."""

    def test_list_nodes_requires_authentication(self, api_client):
        """Test that listing nodes requires authentication."""
        response = api_client.get("/api/v1/node/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_nodes(self, authenticated_client):
        """Test listing nodes."""
        NodeFactory.create_batch(2)

        response = authenticated_client.get("/api/v1/node/")
        assert response.status_code == status.HTTP_200_OK

    def test_create_node(self, authenticated_client):
        """Test creating a new node."""
        project = ProjectFactory()
        flag = FlagFactory()
        node_type = NodeTypeFactory()

        geom = {
            "type": "Point",
            "coordinates": [9.45, 54.78],
        }

        data = {
            "type": "Feature",
            "geometry": geom,
            "properties": {
                "name": "Test Node",
                "project_id": project.id,
                "flag_id": flag.id,
                "node_type_id": node_type.id,
            },
        }

        response = authenticated_client.post(
            "/api/v1/node/",
            data=data,
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert Node.objects.count() == 1
        assert Node.objects.first().name == "Test Node"

    def test_retrieve_node(self, authenticated_client):
        """Test retrieving a single node."""
        node = NodeFactory(name="My Node")

        response = authenticated_client.get(f"/api/v1/node/{node.uuid}/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["properties"]["name"] == "My Node"

    def test_update_node(self, authenticated_client):
        """Test updating a node."""
        node = NodeFactory(name="Original Name")

        geom = {
            "type": "Point",
            "coordinates": [9.45, 54.78],
        }

        data = {
            "type": "Feature",
            "geometry": geom,
            "properties": {
                "name": "Updated Name",
                "project_id": node.project.id,
                "flag_id": node.flag.id,
                "node_type_id": node.node_type.id,
            },
        }

        response = authenticated_client.put(
            f"/api/v1/node/{node.uuid}/",
            data=data,
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK

        node.refresh_from_db()
        assert node.name == "Updated Name"

    def test_delete_node(self, authenticated_client):
        """Test deleting a node."""
        node = NodeFactory()

        response = authenticated_client.delete(f"/api/v1/node/{node.uuid}/")
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert Node.objects.count() == 0


@pytest.mark.django_db
class TestAddressViewSet:
    """Tests for the AddressViewSet."""

    def test_list_addresses_requires_authentication(self, api_client):
        """Test that listing addresses requires authentication."""
        response = api_client.get("/api/v1/address/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_addresses(self, authenticated_client):
        """Test listing addresses."""
        AddressFactory.create_batch(2)

        response = authenticated_client.get("/api/v1/address/")
        assert response.status_code == status.HTTP_200_OK

    def test_retrieve_address(self, authenticated_client):
        """Test retrieving a single address."""
        address = AddressFactory(street="Hauptstraße", housenumber=42)

        response = authenticated_client.get(f"/api/v1/address/{address.uuid}/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["properties"]["street"] == "Hauptstraße"
        assert response.data["properties"]["housenumber"] == 42


@pytest.mark.django_db
class TestAreaViewSet:
    """Tests for the AreaViewSet."""

    def test_list_areas_requires_authentication(self, api_client):
        """Test that listing areas requires authentication."""
        response = api_client.get("/api/v1/area/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_areas(self, authenticated_client):
        """Test listing areas."""
        AreaFactory.create_batch(2)

        response = authenticated_client.get("/api/v1/area/")
        assert response.status_code == status.HTTP_200_OK

    def test_area_list_returns_data(self, authenticated_client):
        """Test that area list returns data."""
        AreaFactory.create_batch(2)

        response = authenticated_client.get("/api/v1/area/")
        assert response.status_code == status.HTTP_200_OK
