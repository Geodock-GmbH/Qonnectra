"""
Unit tests for ViewSets in apps/api/views.py.

Tests cover CRUD operations, authentication, filtering, and error handling
for the main ViewSets.
"""

import pytest
from apps.api.models import (
    Area,
    Cable,
    Conduit,
    Node,
    Trench,
)
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from .factories import (
    AddressFactory,
    AreaFactory,
    AreaTypeFactory,
    CableFactory,
    CableTypeFactory,
    CompanyFactory,
    ConduitFactory,
    ConduitTypeFactory,
    ConstructionTypeFactory,
    FlagFactory,
    MicroductFactory,
    NetworkLevelFactory,
    NodeFactory,
    NodeTypeFactory,
    ProjectFactory,
    StatusFactory,
    SurfaceFactory,
    TrenchFactory,
    WMSLayerFactory,
    WMSSourceFactory,
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
class TestProjectsViewSet:
    """Tests for the ProjectsViewSet."""

    def test_list_projects_requires_authentication(self, api_client):
        """Test that listing projects requires authentication."""
        response = api_client.get("/api/v1/projects/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_projects(self, authenticated_client):
        """Test listing all projects."""
        ProjectFactory.create_batch(3)

        response = authenticated_client.get("/api/v1/projects/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 3

    def test_retrieve_project(self, authenticated_client):
        """Test retrieving a single project."""
        project = ProjectFactory(project="Test Project", description="Test description")

        response = authenticated_client.get(f"/api/v1/projects/{project.id}/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["project"] == "Test Project"
        assert response.data["description"] == "Test description"


@pytest.mark.django_db
class TestFlagsViewSet:
    """Tests for the FlagsViewSet."""

    def test_list_flags_requires_authentication(self, api_client):
        """Test that listing flags requires authentication."""
        response = api_client.get("/api/v1/flags/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_flags(self, authenticated_client):
        """Test listing all flags."""
        FlagFactory.create_batch(3)

        response = authenticated_client.get("/api/v1/flags/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 3


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

        response = authenticated_client.get(f"/api/v1/trench/?project={trench.project.id}")
        assert response.status_code == status.HTTP_200_OK
        # Response is paginated with results containing the feature collection
        assert "results" in response.data
        assert "features" in response.data["results"]

    def test_trench_list_returns_geojson(self, authenticated_client):
        """Test that trench list returns paginated GeoJSON format."""
        TrenchFactory.create_batch(2)

        response = authenticated_client.get("/api/v1/trench/")
        assert response.status_code == status.HTTP_200_OK
        # Response is paginated with results containing the feature collection
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
class TestWMSSourceViewSet:
    """Tests for the WMSSourceViewSet."""

    def test_list_wms_sources_requires_authentication(self, api_client):
        """Test that listing WMS sources requires authentication."""
        response = api_client.get("/api/v1/wms-sources/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_wms_sources(self, authenticated_client):
        """Test listing WMS sources."""
        WMSSourceFactory.create_batch(2)

        response = authenticated_client.get("/api/v1/wms-sources/")
        assert response.status_code == status.HTTP_200_OK

    def test_retrieve_wms_source(self, authenticated_client):
        """Test retrieving a single WMS source."""
        source = WMSSourceFactory(name="Test WMS")

        response = authenticated_client.get(f"/api/v1/wms-sources/{source.id}/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "Test WMS"


@pytest.mark.django_db
class TestWMSLayerViewSet:
    """Tests for the WMSLayerViewSet."""

    def test_list_wms_layers_requires_authentication(self, api_client):
        """Test that listing WMS layers requires authentication."""
        response = api_client.get("/api/v1/wms-layers/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_wms_layers(self, authenticated_client):
        """Test listing WMS layers."""
        WMSLayerFactory.create_batch(2)

        response = authenticated_client.get("/api/v1/wms-layers/")
        assert response.status_code == status.HTTP_200_OK


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
