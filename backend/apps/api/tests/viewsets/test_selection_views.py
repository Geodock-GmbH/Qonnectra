"""Tests for trench/conduit/micropipe selection and utility views.

Covers:
- FrontendLogView: frontend log submission
- LayerExtentView: PostGIS bounding-box extent per layer
- ConduitsByTrenchesView: deduplicated conduits for selected trenches
- MicropipesByConduitsView: micropipe availability across conduits
- CableMicropipeConnectionsView: create/delete cable-micropipe connections
"""

import pytest
from apps.api.models import LogEntry, MicroductCableConnection
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import LineString
from rest_framework import status
from rest_framework.test import APIClient

from ..factories import (
    CableFactory,
    ConduitFactory,
    MicroductCableConnectionFactory,
    MicroductColorFactory,
    MicroductFactory,
    NodeFactory,
    TrenchConduitConnectionFactory,
    TrenchFactory,
)

User = get_user_model()

UTM_X = 535000
UTM_Y = 6070000


@pytest.fixture
def api_client():
    """Create API client for testing."""
    return APIClient()


@pytest.fixture
def authenticated_client(db):
    """Create an authenticated superuser API client."""
    user = User.objects.create_superuser(
        username="selection_user",
        email="selection@example.com",
        password="testpass123",
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestFrontendLogView:
    """Tests for the FrontendLogView."""

    def test_creates_log_entry(self, authenticated_client, project):
        """A valid payload creates a frontend log entry."""
        response = authenticated_client.post(
            "/api/v1/logs/frontend/",
            data={
                "level": "ERROR",
                "message": "Something broke",
                "path": "/map",
                "project": str(project.id),
            },
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        entry = LogEntry.objects.get(source="frontend")
        assert entry.level == "ERROR"
        assert entry.message == "Something broke"
        assert entry.project_id == project.id

    def test_invalid_level_falls_back_to_info(self, authenticated_client):
        """An unrecognised level is stored as INFO."""
        response = authenticated_client.post(
            "/api/v1/logs/frontend/",
            data={"level": "BOGUS", "message": "hi"},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert LogEntry.objects.get(source="frontend").level == "INFO"

    def test_unknown_project_is_ignored(self, authenticated_client):
        """A non-existent project id is dropped rather than erroring."""
        response = authenticated_client.post(
            "/api/v1/logs/frontend/",
            data={"message": "hi", "project": "999999"},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert LogEntry.objects.get(source="frontend").project_id is None

    def test_requires_authentication(self, api_client):
        """Anonymous access is rejected."""
        response = api_client.post(
            "/api/v1/logs/frontend/", data={"message": "hi"}, format="json"
        )
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )


@pytest.mark.django_db
class TestLayerExtentView:
    """Tests for the LayerExtentView."""

    def test_requires_layer_and_project(self, authenticated_client):
        """Both layer and project parameters are required."""
        response = authenticated_client.get("/api/v1/layer-extent/?layer=trench")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_rejects_invalid_layer(self, authenticated_client, project):
        """An unknown layer type is rejected."""
        response = authenticated_client.get(
            f"/api/v1/layer-extent/?layer=bogus&project={project.id}"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_rejects_non_numeric_project(self, authenticated_client):
        """A non-numeric project id is rejected."""
        response = authenticated_client.get(
            "/api/v1/layer-extent/?layer=trench&project=abc"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_returns_extent_for_seeded_trench(
        self, authenticated_client, project, flag
    ):
        """A project with a trench returns a 4-element extent."""
        TrenchFactory(
            project=project,
            flag=flag,
            geom=LineString((UTM_X, UTM_Y), (UTM_X + 100, UTM_Y), srid=25832),
        )
        response = authenticated_client.get(
            f"/api/v1/layer-extent/?layer=trench&project={project.id}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["layer"] == "trench"
        assert len(response.data["extent"]) == 4

    def test_returns_null_extent_when_empty(self, authenticated_client, project):
        """A project with no features returns a null extent."""
        response = authenticated_client.get(
            f"/api/v1/layer-extent/?layer=node&project={project.id}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["extent"] is None


@pytest.mark.django_db
class TestConduitsByTrenchesView:
    """Tests for the ConduitsByTrenchesView."""

    def test_empty_trench_ids_returns_empty(self, authenticated_client):
        """No trench_ids yields an empty list."""
        response = authenticated_client.get("/api/v1/conduits/by-trenches/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    def test_rejects_invalid_trench_uuid(self, authenticated_client):
        """A malformed trench UUID is rejected."""
        response = authenticated_client.get(
            "/api/v1/conduits/by-trenches/?trench_ids=not-a-uuid"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_rejects_invalid_cable_id(self, authenticated_client):
        """A malformed cable_id is rejected."""
        response = authenticated_client.get(
            "/api/v1/conduits/by-trenches/?cable_id=not-a-uuid"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_returns_deduplicated_conduits(self, authenticated_client, project, flag):
        """Conduits shared across trenches are returned once."""
        trench1 = TrenchFactory(
            project=project,
            flag=flag,
            geom=LineString((0, 0), (10, 0), srid=25832),
        )
        trench2 = TrenchFactory(
            project=project,
            flag=flag,
            geom=LineString((10, 0), (20, 0), srid=25832),
        )
        conduit = ConduitFactory(project=project, flag=flag)
        TrenchConduitConnectionFactory(uuid_trench=trench1, uuid_conduit=conduit)
        TrenchConduitConnectionFactory(uuid_trench=trench2, uuid_conduit=conduit)

        response = authenticated_client.get(
            f"/api/v1/conduits/by-trenches/?trench_ids={trench1.uuid},{trench2.uuid}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["uuid"] == str(conduit.uuid)

    def test_flags_cable_linkage(self, authenticated_client, project, flag):
        """A conduit linked to the context cable is flagged."""
        trench = TrenchFactory(
            project=project,
            flag=flag,
            geom=LineString((0, 0), (10, 0), srid=25832),
        )
        conduit = ConduitFactory(project=project, flag=flag)
        TrenchConduitConnectionFactory(uuid_trench=trench, uuid_conduit=conduit)
        microduct = MicroductFactory(uuid_conduit=conduit)
        cable = CableFactory(project=project, flag=flag)
        MicroductCableConnectionFactory(uuid_microduct=microduct, uuid_cable=cable)

        response = authenticated_client.get(
            f"/api/v1/conduits/by-trenches/?trench_ids={trench.uuid}"
            f"&cable_id={cable.uuid}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data[0]["has_cable_linkage"] is True


@pytest.mark.django_db
class TestMicropipesByConduitsView:
    """Tests for the MicropipesByConduitsView."""

    def test_empty_conduit_ids_returns_empty(self, authenticated_client):
        """No conduit_ids yields an empty list."""
        response = authenticated_client.get("/api/v1/micropipes/by-conduits/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    def test_rejects_invalid_conduit_uuid(self, authenticated_client):
        """A malformed conduit UUID is rejected."""
        response = authenticated_client.get(
            "/api/v1/micropipes/by-conduits/?conduit_ids=bad"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_groups_micropipes_with_availability(
        self, authenticated_client, project, flag
    ):
        """Micropipes are grouped by (number, color) with availability info."""
        MicroductColorFactory(name_de="rot", hex_code="#dc2626")
        conduit1 = ConduitFactory(project=project, flag=flag)
        conduit2 = ConduitFactory(project=project, flag=flag)
        MicroductFactory(uuid_conduit=conduit1, number=1, color="rot")
        MicroductFactory(uuid_conduit=conduit2, number=1, color="rot")

        response = authenticated_client.get(
            f"/api/v1/micropipes/by-conduits/"
            f"?conduit_ids={conduit1.uuid},{conduit2.uuid}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        group = response.data[0]
        assert group["number"] == 1
        assert group["color_name"] == "rot"
        assert group["color_hex"] == "#dc2626"
        assert group["available_in_all"] is True

    def test_reports_missing_conduits(self, authenticated_client, project, flag):
        """A micropipe present in only one conduit is not available in all."""
        conduit1 = ConduitFactory(project=project, flag=flag)
        conduit2 = ConduitFactory(project=project, flag=flag)
        MicroductFactory(uuid_conduit=conduit1, number=2, color="blau")

        response = authenticated_client.get(
            f"/api/v1/micropipes/by-conduits/"
            f"?conduit_ids={conduit1.uuid},{conduit2.uuid}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data[0]["available_in_all"] is False
        assert len(response.data[0]["missing_in"]) == 1


@pytest.mark.django_db
class TestCableMicropipeConnectionsView:
    """Tests for the CableMicropipeConnectionsView."""

    def test_create_connections(self, authenticated_client, project, flag):
        """POST creates connections for matching microducts."""
        conduit = ConduitFactory(project=project, flag=flag)
        MicroductFactory(uuid_conduit=conduit, number=1, color="rot")
        cable = CableFactory(project=project, flag=flag)

        response = authenticated_client.post(
            f"/api/v1/cables/{cable.uuid}/micropipe-connections/",
            data={
                "micropipe_number": 1,
                "color": "rot",
                "conduit_ids": [str(conduit.uuid)],
            },
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 1
        assert MicroductCableConnection.objects.filter(uuid_cable=cable).count() == 1

    def test_create_requires_all_fields(self, authenticated_client, project, flag):
        """A missing field yields a 400 error."""
        cable = CableFactory(project=project, flag=flag)
        response = authenticated_client.post(
            f"/api/v1/cables/{cable.uuid}/micropipe-connections/",
            data={"micropipe_number": 1},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_delete_connections(self, authenticated_client, project, flag):
        """DELETE removes connections for the matching micropipe."""
        conduit = ConduitFactory(project=project, flag=flag)
        microduct = MicroductFactory(uuid_conduit=conduit, number=1, color="rot")
        cable = CableFactory(project=project, flag=flag)
        MicroductCableConnectionFactory(uuid_microduct=microduct, uuid_cable=cable)

        response = authenticated_client.delete(
            f"/api/v1/cables/{cable.uuid}/micropipe-connections/",
            data={"micropipe_number": 1, "conduit_ids": [str(conduit.uuid)]},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["deleted"] == 1
        assert MicroductCableConnection.objects.filter(uuid_cable=cable).count() == 0
