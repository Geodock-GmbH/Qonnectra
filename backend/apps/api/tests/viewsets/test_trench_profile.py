"""Tests for TrenchConduitCanvas ViewSet."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from apps.api.tests.factories import (
    ConduitFactory,
    TrenchConduitCanvasFactory,
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
    user = User.objects.create_superuser(
        username="testuser",
        email="test@example.com",
        password="testpass123",
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestTrenchConduitCanvasViewSet:
    """Tests for the TrenchConduitCanvasViewSet."""

    def test_list_requires_authentication(self, api_client):
        """Test that listing canvas positions requires authentication."""
        response = api_client.get("/api/v1/trench-conduit-canvas/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_canvas_positions(self, authenticated_client):
        """Test listing trench conduit canvas positions."""
        TrenchConduitCanvasFactory()
        response = authenticated_client.get("/api/v1/trench-conduit-canvas/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 1

    def test_filter_by_trench(self, authenticated_client):
        """Test filtering canvas positions by trench."""
        canvas = TrenchConduitCanvasFactory()
        TrenchConduitCanvasFactory()

        response = authenticated_client.get(
            f"/api/v1/trench-conduit-canvas/?trench={canvas.trench.uuid}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1

    def test_create_canvas_position(self, authenticated_client):
        """Test creating a canvas position."""
        trench = TrenchFactory()
        conduit = ConduitFactory()

        data = {
            "trench": str(trench.uuid),
            "conduit": str(conduit.uuid),
            "canvas_x": 100.0,
            "canvas_y": 200.0,
            "canvas_width": 80.0,
            "canvas_height": 80.0,
        }

        response = authenticated_client.post(
            "/api/v1/trench-conduit-canvas/",
            data=data,
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED

    def test_profile_endpoint(self, authenticated_client):
        """Test the profile endpoint returns conduits with positions."""
        trench = TrenchFactory()
        conduit = ConduitFactory()
        TrenchConduitConnectionFactory(uuid_trench=trench, uuid_conduit=conduit)
        TrenchConduitCanvasFactory(
            trench=trench, conduit=conduit, canvas_x=50, canvas_y=100
        )

        response = authenticated_client.get(
            f"/api/v1/trench-conduit-canvas/profile/{trench.uuid}/"
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["conduit_uuid"] == str(conduit.uuid)
        assert response.data[0]["canvas_x"] == 50
        assert response.data[0]["has_saved_position"] is True

    def test_profile_endpoint_without_saved_position(self, authenticated_client):
        """Test profile endpoint for conduit without saved position."""
        trench = TrenchFactory()
        conduit = ConduitFactory()
        TrenchConduitConnectionFactory(uuid_trench=trench, uuid_conduit=conduit)

        response = authenticated_client.get(
            f"/api/v1/trench-conduit-canvas/profile/{trench.uuid}/"
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["has_saved_position"] is False
        assert response.data[0]["canvas_x"] is None

    def test_bulk_save(self, authenticated_client):
        """Test bulk saving canvas positions."""
        trench = TrenchFactory()
        conduit1 = ConduitFactory()
        conduit2 = ConduitFactory()

        data = {
            "trench": str(trench.uuid),
            "positions": [
                {"conduit": str(conduit1.uuid), "canvas_x": 10, "canvas_y": 20},
                {"conduit": str(conduit2.uuid), "canvas_x": 100, "canvas_y": 200},
            ],
        }

        response = authenticated_client.post(
            "/api/v1/trench-conduit-canvas/bulk-save/",
            data=data,
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2

    def test_cascade_delete_on_trench_delete(self, authenticated_client):
        """Test canvas positions are deleted when trench is deleted."""
        from apps.api.models import TrenchConduitCanvas

        canvas = TrenchConduitCanvasFactory()
        trench_uuid = canvas.trench.uuid

        canvas.trench.delete()

        assert not TrenchConduitCanvas.objects.filter(trench__uuid=trench_uuid).exists()

    def test_cascade_delete_on_conduit_delete(self, authenticated_client):
        """Test canvas positions are deleted when conduit is deleted."""
        from apps.api.models import TrenchConduitCanvas

        canvas = TrenchConduitCanvasFactory()
        conduit_uuid = canvas.conduit.uuid

        canvas.conduit.delete()

        assert not TrenchConduitCanvas.objects.filter(
            conduit__uuid=conduit_uuid
        ).exists()
