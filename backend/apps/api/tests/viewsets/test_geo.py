"""Tests for GeoJSON ViewSets: Trench, Node, Address, Area."""

import pytest
from apps.api.models import Node, Trench
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import LineString
from django.db import IntegrityError
from rest_framework import status
from rest_framework.test import APIClient

from ..factories import (
    AddressFactory,
    AreaFactory,
    ConstructionTypeFactory,
    FlagFactory,
    NodeFactory,
    NodeTypeFactory,
    PhaseFactory,
    ProjectFactory,
    StatusFactory,
    SurfaceFactory,
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

    # --- CRUD Operations ---

    def test_create_trench(self, authenticated_client):
        """Test creating a trench via API POST."""
        project = ProjectFactory()
        flag = FlagFactory()
        surface = SurfaceFactory()
        construction_type = ConstructionTypeFactory()

        data = {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [[9.45, 54.78], [9.46, 54.79]],
            },
            "properties": {
                "surface_value": surface.id,
                "construction_type_id": construction_type.id,
                "project_id": project.id,
                "flag_id": flag.id,
                "date": "2025/01/15",
            },
        }

        response = authenticated_client.post(
            "/api/v1/trench/", data=data, format="json"
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["properties"]["surface"]["id"] == surface.id
        assert (
            response.data["properties"]["construction_type"]["id"]
            == construction_type.id
        )
        assert response.data["properties"]["project"]["id"] == project.id
        assert response.data["properties"]["flag"]["id"] == flag.id
        assert float(response.data["properties"]["length"]) > 0

    def test_retrieve_trench(self, authenticated_client):
        """Test retrieving a single trench by id_trench."""
        trench = TrenchFactory()
        trench.refresh_from_db()

        response = authenticated_client.get(f"/api/v1/trench/{trench.id_trench}/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == str(trench.uuid)
        assert response.data["type"] == "Feature"
        assert response.data["geometry"]["type"] == "LineString"

    def test_update_trench(self, authenticated_client):
        """Test full update of a trench via PUT."""
        trench = TrenchFactory()
        trench.refresh_from_db()

        new_surface = SurfaceFactory()
        new_construction_type = ConstructionTypeFactory()

        data = {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [[9.45, 54.78], [9.46, 54.79]],
            },
            "properties": {
                "surface_value": new_surface.id,
                "construction_type_id": new_construction_type.id,
                "project_id": trench.project.id,
                "flag_id": trench.flag.id,
                "comment": "Updated trench",
                "date": "2025/01/15",
            },
        }

        response = authenticated_client.put(
            f"/api/v1/trench/{trench.id_trench}/", data=data, format="json"
        )
        assert response.status_code == status.HTTP_200_OK

        trench.refresh_from_db()
        assert trench.surface == new_surface
        assert trench.construction_type == new_construction_type
        assert trench.comment == "Updated trench"

    def test_partial_update_trench(self, authenticated_client):
        """Test partial update of a trench via PATCH."""
        trench = TrenchFactory()
        trench.refresh_from_db()
        original_surface = trench.surface

        data = {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [[9.45, 54.78], [9.46, 54.79]],
            },
            "properties": {
                "comment": "Patched comment",
            },
        }

        response = authenticated_client.patch(
            f"/api/v1/trench/{trench.id_trench}/", data=data, format="json"
        )
        assert response.status_code == status.HTTP_200_OK

        trench.refresh_from_db()
        assert trench.comment == "Patched comment"
        assert trench.surface == original_surface

    def test_delete_trench(self, authenticated_client):
        """Test deleting a trench."""
        trench = TrenchFactory()
        trench.refresh_from_db()

        response = authenticated_client.delete(f"/api/v1/trench/{trench.id_trench}/")
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert Trench.objects.count() == 0

    def test_geometry_persisted_with_correct_srid(self):
        """Test that geometry is stored with SRID 25832."""
        trench = TrenchFactory(
            geom=LineString((563000, 5935000), (563100, 5935100), srid=25832),
        )
        trench.refresh_from_db()

        assert trench.geom.srid == 25832
        assert trench.geom.geom_type == "LineString"
        assert trench.geom.num_coords == 2

    def test_unique_constraint_same_project(self):
        """Test that two trenches cannot have the same id_trench in the same project."""
        project = ProjectFactory()
        flag = FlagFactory()
        surface = SurfaceFactory()
        construction_type = ConstructionTypeFactory()

        Trench.objects.create(
            id_trench="TR-AAAAAAA",
            surface=surface,
            construction_type=construction_type,
            length=100.0,
            geom=LineString((0, 0), (100, 0), srid=25832),
            project=project,
            flag=flag,
        )

        with pytest.raises(IntegrityError):
            Trench.objects.create(
                id_trench="TR-AAAAAAA",
                surface=surface,
                construction_type=construction_type,
                length=100.0,
                geom=LineString((0, 0), (200, 0), srid=25832),
                project=project,
                flag=flag,
            )

    # --- Validation ---

    def test_reject_non_linestring_geometry(self, authenticated_client):
        """Test that POST with Point geometry is rejected."""
        project = ProjectFactory()
        flag = FlagFactory()
        surface = SurfaceFactory()
        construction_type = ConstructionTypeFactory()

        data = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [563000, 5935000],
            },
            "properties": {
                "surface_value": surface.id,
                "construction_type_id": construction_type.id,
                "project_id": project.id,
                "flag_id": flag.id,
            },
        }

        response = authenticated_client.post(
            "/api/v1/trench/", data=data, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_reject_missing_required_fields(self, authenticated_client):
        """Test that POST with missing required fields returns 400."""
        data = {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [[563000, 5935000], [563100, 5935100]],
            },
            "properties": {},
        }

        response = authenticated_client.post(
            "/api/v1/trench/", data=data, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    # --- Filtering ---

    def test_filter_by_uuid(self, authenticated_client):
        """Test filtering trenches by uuid query parameter."""
        trench1 = TrenchFactory()
        TrenchFactory()

        response = authenticated_client.get(f"/api/v1/trench/?uuid={trench1.uuid}")
        assert response.status_code == status.HTTP_200_OK
        features = response.data["results"]["features"]
        assert len(features) == 1
        assert features[0]["id"] == str(trench1.uuid)

    def test_filter_by_id_trench(self, authenticated_client):
        """Test filtering trenches by id_trench query parameter."""
        trench1 = TrenchFactory()
        trench1.refresh_from_db()
        TrenchFactory()

        response = authenticated_client.get(
            f"/api/v1/trench/?id_trench={trench1.id_trench}"
        )
        assert response.status_code == status.HTTP_200_OK
        features = response.data["results"]["features"]
        assert len(features) == 1
        assert features[0]["id"] == str(trench1.uuid)

    # --- Custom Action Endpoints ---

    def test_length_by_types(self, authenticated_client):
        """Test aggregation of trench lengths by construction type and surface."""
        project = ProjectFactory()
        flag = FlagFactory()
        surface1 = SurfaceFactory()
        surface2 = SurfaceFactory()
        ct1 = ConstructionTypeFactory()

        TrenchFactory(
            project=project,
            flag=flag,
            surface=surface1,
            construction_type=ct1,
            geom=LineString((0, 0), (100, 0), srid=25832),
        )
        TrenchFactory(
            project=project,
            flag=flag,
            surface=surface1,
            construction_type=ct1,
            geom=LineString((0, 0), (200, 0), srid=25832),
        )
        TrenchFactory(
            project=project,
            flag=flag,
            surface=surface2,
            construction_type=ct1,
            geom=LineString((0, 0), (50, 0), srid=25832),
        )

        response = authenticated_client.get(
            f"/api/v1/trench/length_by_types/?project={project.id}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 2
        results = response.data["results"]
        assert all(
            "bauweise" in r and "oberfläche" in r and "gesamt_länge" in r
            for r in results
        )

    def test_total_length(self, authenticated_client):
        """Test total trench length aggregation."""
        project = ProjectFactory()
        flag = FlagFactory()

        TrenchFactory(
            project=project,
            flag=flag,
            geom=LineString((0, 0), (100, 0), srid=25832),
        )
        TrenchFactory(
            project=project,
            flag=flag,
            geom=LineString((0, 0), (200, 0), srid=25832),
        )
        TrenchFactory(
            project=project,
            flag=flag,
            geom=LineString((0, 0), (300, 0), srid=25832),
        )

        response = authenticated_client.get(
            f"/api/v1/trench/total_length/?project={project.id}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert float(response.data["total_length"]) == pytest.approx(600.0, rel=0.01)
        assert response.data["count"] == 3

    def test_total_length_with_status_filter(self, authenticated_client):
        """Test total_length filtered by status."""
        project = ProjectFactory()
        flag = FlagFactory()
        status_a = StatusFactory()
        status_b = StatusFactory()

        TrenchFactory(
            project=project,
            flag=flag,
            status=status_a,
            geom=LineString((0, 0), (100, 0), srid=25832),
        )
        TrenchFactory(
            project=project,
            flag=flag,
            status=status_a,
            geom=LineString((0, 0), (200, 0), srid=25832),
        )
        TrenchFactory(
            project=project,
            flag=flag,
            status=status_b,
            geom=LineString((0, 0), (500, 0), srid=25832),
        )

        response = authenticated_client.get(
            f"/api/v1/trench/total_length/?project={project.id}&status={status_a.id}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert float(response.data["total_length"]) == pytest.approx(300.0, rel=0.01)
        assert response.data["count"] == 2

    def test_average_house_connection_length(self, authenticated_client):
        """Test average length of house connection trenches."""
        project = ProjectFactory()
        flag = FlagFactory()

        TrenchFactory(
            project=project,
            flag=flag,
            house_connection=True,
            geom=LineString((0, 0), (100, 0), srid=25832),
        )
        TrenchFactory(
            project=project,
            flag=flag,
            house_connection=True,
            geom=LineString((0, 0), (200, 0), srid=25832),
        )
        TrenchFactory(
            project=project,
            flag=flag,
            house_connection=False,
            geom=LineString((0, 0), (999, 0), srid=25832),
        )

        response = authenticated_client.get(
            f"/api/v1/trench/average_house_connection_length/?project={project.id}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert float(response.data["average_length"]) == pytest.approx(150.0, rel=0.01)
        assert response.data["count"] == 2

    def test_length_with_funding(self, authenticated_client):
        """Test total length of funded trenches."""
        project = ProjectFactory()
        flag = FlagFactory()

        TrenchFactory(
            project=project,
            flag=flag,
            funding_status=True,
            geom=LineString((0, 0), (100, 0), srid=25832),
        )
        TrenchFactory(
            project=project,
            flag=flag,
            funding_status=True,
            geom=LineString((0, 0), (200, 0), srid=25832),
        )
        TrenchFactory(
            project=project,
            flag=flag,
            funding_status=False,
            geom=LineString((0, 0), (500, 0), srid=25832),
        )

        response = authenticated_client.get(
            f"/api/v1/trench/length_with_funding/?project={project.id}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert float(response.data["total_length"]) == pytest.approx(300.0, rel=0.01)
        assert response.data["count"] == 2

    def test_length_with_internal_execution(self, authenticated_client):
        """Test total length of internally executed trenches."""
        project = ProjectFactory()
        flag = FlagFactory()

        TrenchFactory(
            project=project,
            flag=flag,
            internal_execution=True,
            geom=LineString((0, 0), (150, 0), srid=25832),
        )
        TrenchFactory(
            project=project,
            flag=flag,
            internal_execution=True,
            geom=LineString((0, 0), (250, 0), srid=25832),
        )
        TrenchFactory(
            project=project,
            flag=flag,
            internal_execution=False,
            geom=LineString((0, 0), (500, 0), srid=25832),
        )

        response = authenticated_client.get(
            f"/api/v1/trench/length_with_internal_execution/?project={project.id}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert float(response.data["total_length"]) == pytest.approx(400.0, rel=0.01)
        assert response.data["count"] == 2

    def test_length_by_status(self, authenticated_client):
        """Test trench lengths grouped by status."""
        project = ProjectFactory()
        flag = FlagFactory()
        status_a = StatusFactory(status="Planned")
        status_b = StatusFactory(status="Built")

        TrenchFactory(
            project=project,
            flag=flag,
            status=status_a,
            geom=LineString((0, 0), (100, 0), srid=25832),
        )
        TrenchFactory(
            project=project,
            flag=flag,
            status=status_b,
            geom=LineString((0, 0), (200, 0), srid=25832),
        )

        response = authenticated_client.get(
            f"/api/v1/trench/length_by_status/?project={project.id}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 2
        results = response.data["results"]
        status_names = {r["status_name"] for r in results}
        assert status_names == {"Planned", "Built"}

    def test_length_by_phase(self, authenticated_client):
        """Test trench lengths grouped by phase."""
        project = ProjectFactory()
        flag = FlagFactory()
        phase_a = PhaseFactory(phase="Phase 1")
        phase_b = PhaseFactory(phase="Phase 2")

        TrenchFactory(
            project=project,
            flag=flag,
            phase=phase_a,
            geom=LineString((0, 0), (100, 0), srid=25832),
        )
        TrenchFactory(
            project=project,
            flag=flag,
            phase=phase_b,
            geom=LineString((0, 0), (200, 0), srid=25832),
        )

        response = authenticated_client.get(
            f"/api/v1/trench/length_by_phase/?project={project.id}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 2
        results = response.data["results"]
        phase_names = {r["network_level"] for r in results}
        assert phase_names == {"Phase 1", "Phase 2"}

    def test_longest_routes(self, authenticated_client):
        """Test returning the N longest trenches."""
        project = ProjectFactory()
        flag = FlagFactory()

        for length in [50, 100, 150, 200, 250]:
            TrenchFactory(
                project=project,
                flag=flag,
                geom=LineString((0, 0), (length, 0), srid=25832),
            )

        response = authenticated_client.get(
            f"/api/v1/trench/longest_routes/?project={project.id}&limit=3"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 3
        results = response.data["results"]
        lengths = [float(r["length"]) for r in results]
        assert lengths == sorted(lengths, reverse=True)
        assert all(
            "id_trench" in r and "construction_type_name" in r and "surface_name" in r
            for r in results
        )

    def test_all_trenches_unpaginated(self, authenticated_client):
        """Test that the all endpoint returns all trenches without pagination."""
        project = ProjectFactory()
        flag = FlagFactory()

        TrenchFactory.create_batch(15, project=project, flag=flag)

        response = authenticated_client.get(f"/api/v1/trench/all/?project={project.id}")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["type"] == "FeatureCollection"
        assert len(response.data["features"]) == 15

    def test_all_trenches_search(self, authenticated_client):
        """Test that the all endpoint supports search by id_trench."""
        project = ProjectFactory()
        flag = FlagFactory()

        trench1 = TrenchFactory(project=project, flag=flag)
        trench1.refresh_from_db()
        TrenchFactory(project=project, flag=flag)

        response = authenticated_client.get(
            f"/api/v1/trench/all/?project={project.id}&search={trench1.id_trench}"
        )
        assert response.status_code == status.HTTP_200_OK
        features = response.data["features"]
        assert len(features) == 1
        assert features[0]["id"] == str(trench1.uuid)


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
