"""Tests for WMS ViewSets."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from ..factories import (
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
    user = User.objects.create_superuser(
        username="testuser",
        email="test@example.com",
        password="testpass123",
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


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
