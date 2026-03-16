import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIClient

User = get_user_model()


@pytest.fixture
def authenticated_client(db):
    """Return an APIClient authenticated as a test user."""
    user = User.objects.create_user(username="testuser", password="testpass")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestConfigView:
    """Tests for the /api/config/ endpoint."""

    def test_returns_srid_and_proj4(self, authenticated_client):
        """Config endpoint returns SRID and valid proj4 string."""
        response = authenticated_client.get("/api/v1/config/")
        assert response.status_code == 200
        data = response.json()
        assert data["srid"] == settings.DEFAULT_SRID
        assert isinstance(data["proj4"], str)
        assert "+proj=" in data["proj4"]

    @override_settings(DEFAULT_SRID=25833)
    def test_returns_overridden_srid(self, authenticated_client):
        """Config endpoint respects overridden DEFAULT_SRID."""
        response = authenticated_client.get("/api/v1/config/")
        assert response.status_code == 200
        data = response.json()
        assert data["srid"] == 25833
        assert "+proj=" in data["proj4"]

    def test_requires_authentication(self):
        """Config endpoint requires authentication."""
        client = APIClient()
        response = client.get("/api/v1/config/")
        assert response.status_code == 401

    @override_settings(DEFAULT_SRID=99999)
    def test_invalid_srid_returns_500(self, authenticated_client):
        """Config endpoint returns 500 for invalid EPSG code."""
        response = authenticated_client.get("/api/v1/config/")
        assert response.status_code == 500
        assert "error" in response.json()
