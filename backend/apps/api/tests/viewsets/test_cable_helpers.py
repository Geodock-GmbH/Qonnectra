"""Tests for cable helper endpoints and the CableLabelViewSet.

Covers:
- get_trenches_for_cable_connections: linked-trenches lookup
- get_conduits_for_cable: conduit-names lookup
- get_cable_micropipe_summary: per-project micropipe colour summary
- CableLabelViewSet: label CRUD and the ``all`` action
"""

import pytest
from apps.api.models import CableLabel
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import LineString
from rest_framework import status
from rest_framework.test import APIClient

from ..factories import (
    CableFactory,
    CableLabelFactory,
    ConduitFactory,
    MicroductCableConnectionFactory,
    MicroductColorFactory,
    MicroductFactory,
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
    """Create an authenticated superuser API client."""
    user = User.objects.create_superuser(
        username="cable_helper_user",
        email="cable_helper@example.com",
        password="testpass123",
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def connected_cable(db, project, flag):
    """Build a cable wired through a microduct/conduit/trench chain.

    Returns a dict with the cable and the conduit/trench it connects to so
    the lookup endpoints have real relations to traverse.
    """
    trench = TrenchFactory(
        project=project,
        flag=flag,
        geom=LineString((0, 0), (10, 0), srid=25832),
    )
    conduit = ConduitFactory(project=project, flag=flag, name="Conduit-X")
    TrenchConduitConnectionFactory(uuid_trench=trench, uuid_conduit=conduit)
    microduct = MicroductFactory(uuid_conduit=conduit, color="rot")
    cable = CableFactory(project=project, flag=flag)
    MicroductCableConnectionFactory(uuid_microduct=microduct, uuid_cable=cable)
    return {
        "cable": cable,
        "conduit": conduit,
        "trench": trench,
        "microduct": microduct,
    }


@pytest.mark.django_db
class TestGetTrenchesForCableConnections:
    """Tests for the linked-trenches endpoint."""

    def test_returns_linked_trench_uuids(self, authenticated_client, connected_cable):
        """The connected trench uuid is returned for a wired cable."""
        cable = connected_cable["cable"]
        trench = connected_cable["trench"]

        response = authenticated_client.get(
            f"/api/v1/cables/{cable.uuid}/linked-trenches/"
        )
        assert response.status_code == status.HTTP_200_OK
        assert str(trench.uuid) in response.data["trench_uuids"]

    def test_returns_empty_for_unconnected_cable(self, authenticated_client, cable):
        """A cable with no connections returns an empty list."""
        response = authenticated_client.get(
            f"/api/v1/cables/{cable.uuid}/linked-trenches/"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["trench_uuids"] == []


@pytest.mark.django_db
class TestGetConduitsForCable:
    """Tests for the conduit-names endpoint."""

    def test_returns_connected_conduit_names(
        self, authenticated_client, connected_cable
    ):
        """The connected conduit name is returned for a wired cable."""
        cable = connected_cable["cable"]

        response = authenticated_client.get(
            f"/api/v1/cables/{cable.uuid}/conduits/"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["conduit_names"] == ["Conduit-X"]

    def test_returns_empty_for_unconnected_cable(self, authenticated_client, cable):
        """A cable with no connections returns no conduit names."""
        response = authenticated_client.get(
            f"/api/v1/cables/{cable.uuid}/conduits/"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["conduit_names"] == []


@pytest.mark.django_db
class TestGetCableMicropipeSummary:
    """Tests for the per-project micropipe summary endpoint."""

    def test_maps_cable_to_micropipe_with_color(
        self, authenticated_client, connected_cable, project
    ):
        """Each cable maps to its micropipes with the resolved colour hex."""
        MicroductColorFactory(name_de="rot", hex_code="#dc2626")
        cable = connected_cable["cable"]

        response = authenticated_client.get(
            f"/api/v1/cables/micropipe-summary/{project.id}/"
        )
        assert response.status_code == status.HTTP_200_OK
        entries = response.data[str(cable.uuid)]
        assert entries[0]["color_name"] == "rot"
        assert entries[0]["color_hex"] == "#dc2626"

    def test_falls_back_to_default_color(
        self, authenticated_client, connected_cable, project
    ):
        """An unmapped colour falls back to the neutral default hex."""
        cable = connected_cable["cable"]

        response = authenticated_client.get(
            f"/api/v1/cables/micropipe-summary/{project.id}/"
        )
        assert response.status_code == status.HTTP_200_OK
        entries = response.data[str(cable.uuid)]
        assert entries[0]["color_hex"] == "#64748b"

    def test_empty_project_returns_empty_dict(self, authenticated_client, project):
        """A project without connections returns an empty mapping."""
        response = authenticated_client.get(
            f"/api/v1/cables/micropipe-summary/{project.id}/"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data == {}


@pytest.mark.django_db
class TestCableLabelViewSet:
    """Tests for the CableLabelViewSet."""

    def test_list_labels(self, authenticated_client, cable):
        """Test listing cable labels."""
        CableLabelFactory(cable=cable, text="Label 1", order=0)
        CableLabelFactory(cable=cable, text="Label 2", order=1)

        response = authenticated_client.get("/api/v1/cable_label/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 2

    def test_filter_labels_by_cable(self, authenticated_client, project, flag):
        """Labels can be filtered to a single cable via query param."""
        cable_a = CableFactory(project=project, flag=flag)
        cable_b = CableFactory(project=project, flag=flag)
        CableLabelFactory(cable=cable_a, text="A")
        CableLabelFactory(cable=cable_b, text="B")

        response = authenticated_client.get(
            f"/api/v1/cable_label/?cable={cable_a.uuid}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 1

    def test_create_label(self, authenticated_client, cable):
        """Test creating a new cable label."""
        data = {"cable_id": str(cable.uuid), "text": "New Label", "order": 0}

        response = authenticated_client.post(
            "/api/v1/cable_label/", data=data, format="json"
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert CableLabel.objects.filter(text="New Label").exists()

    def test_all_action_returns_unpaginated_list(self, authenticated_client, cable):
        """The ``all`` action returns every label without pagination."""
        CableLabelFactory.create_batch(3, cable=cable)

        response = authenticated_client.get("/api/v1/cable_label/all/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 3

    def test_all_action_filters_by_cable(self, authenticated_client, project, flag):
        """The ``all`` action honours the cable query filter."""
        cable_a = CableFactory(project=project, flag=flag)
        cable_b = CableFactory(project=project, flag=flag)
        CableLabelFactory(cable=cable_a)
        CableLabelFactory(cable=cable_b)

        response = authenticated_client.get(
            f"/api/v1/cable_label/all/?cable={cable_a.uuid}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
