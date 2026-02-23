"""Tests for WMS views."""

import uuid as uuid_module
from datetime import timedelta

import pytest
from unittest.mock import patch, MagicMock
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.api.models import WMSSource, WMSLayer
from apps.api.tests.factories import ProjectFactory


@pytest.fixture
def api_client(user):
    """Create an authenticated API client."""
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def wms_source(project):
    """Create a test WMS source."""
    return WMSSource.objects.create(
        project=project,
        name="Test WMS",
        url="https://example.com/wms",
        is_active=True,
    )


@pytest.fixture
def wms_layer(wms_source):
    """Create a test WMS layer."""
    return WMSLayer.objects.create(
        source=wms_source,
        name="test_layer",
        title="Test Layer",
        is_enabled=True,
    )


class TestWMSSourceViewSet:
    """Tests for WMSSourceViewSet."""

    def test_list_wms_sources(self, api_client, wms_source):
        """Should list WMS sources for a project."""
        url = reverse("wms-sources-list")
        response = api_client.get(url, {"project": wms_source.project.id})

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["name"] == "Test WMS"

    def test_list_wms_sources_filters_by_project(self, api_client, wms_source):
        """Should only return sources for the specified project."""
        other_project = ProjectFactory()
        WMSSource.objects.create(
            project=other_project,
            name="Other WMS",
            url="https://other.com/wms",
        )

        url = reverse("wms-sources-list")
        response = api_client.get(url, {"project": wms_source.project.id})

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1

    def test_refresh_layers_action(self, api_client, wms_source):
        """Should refresh layers from GetCapabilities."""
        mock_layers = [
            {"name": "new_layer", "title": "New Layer"},
        ]

        with patch("apps.api.views.fetch_wms_layers", return_value=mock_layers):
            url = reverse("wms-sources-refresh-layers", args=[wms_source.id])
            response = api_client.post(url)

        assert response.status_code == status.HTTP_200_OK
        assert wms_source.layers.count() == 1
        assert wms_source.layers.first().name == "new_layer"


class TestWMSProxyView:
    """Tests for WMS proxy view."""

    def test_proxy_unauthenticated(self, wms_source):
        """Should require authentication."""
        client = APIClient()
        url = reverse("wms-proxy", args=[wms_source.id])
        response = client.get(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_proxy_invalid_source(self, api_client):
        """Should return 404 for invalid source ID."""
        url = reverse("wms-proxy", args=[uuid_module.uuid4()])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_proxy_forwards_request(self, api_client, wms_source):
        """Should forward WMS request to upstream server."""
        mock_response = MagicMock()
        mock_response.content = b"<image data>"
        mock_response.headers = {"Content-Type": "image/png"}
        mock_response.status_code = 200

        with patch("apps.api.views.requests.get", return_value=mock_response) as mock_get:
            url = reverse("wms-proxy", args=[wms_source.id])
            response = api_client.get(
                url,
                {
                    "SERVICE": "WMS",
                    "REQUEST": "GetMap",
                    "LAYERS": "test",
                    "BBOX": "0,0,1,1",
                },
            )

        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "image/png"
        mock_get.assert_called_once()


class TestWMSTokenAuthentication:
    """Tests for WMSTokenAuthentication class."""

    def test_valid_wms_scoped_token_authenticates(self, user, wms_source):
        """Should authenticate with a valid WMS-scoped token."""
        token = AccessToken.for_user(user)
        token["wms_only"] = True

        client = APIClient()
        mock_response = MagicMock()
        mock_response.content = b"<image data>"
        mock_response.headers = {"Content-Type": "image/png"}
        mock_response.status_code = 200

        with patch("apps.api.views.requests.get", return_value=mock_response):
            url = reverse("wms-proxy", args=[wms_source.id])
            response = client.get(
                url,
                {
                    "token": str(token),
                    "SERVICE": "WMS",
                    "REQUEST": "GetMap",
                    "LAYERS": "test",
                    "BBOX": "0,0,1,1",
                },
            )

        assert response.status_code == status.HTTP_200_OK

    def test_token_without_wms_only_claim_rejected(self, user, wms_source):
        """Should reject tokens without the wms_only claim."""
        token = AccessToken.for_user(user)
        # No wms_only claim set

        client = APIClient()
        url = reverse("wms-proxy", args=[wms_source.id])
        response = client.get(
            url,
            {
                "token": str(token),
                "SERVICE": "WMS",
                "REQUEST": "GetMap",
            },
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_expired_token_rejected(self, user, wms_source):
        """Should reject expired tokens."""
        token = AccessToken.for_user(user)
        token["wms_only"] = True
        # Set token to be already expired
        token.set_exp(lifetime=-timedelta(minutes=5))

        client = APIClient()
        url = reverse("wms-proxy", args=[wms_source.id])
        response = client.get(
            url,
            {
                "token": str(token),
                "SERVICE": "WMS",
                "REQUEST": "GetMap",
            },
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_invalid_token_format_rejected(self, wms_source):
        """Should reject malformed tokens."""
        client = APIClient()
        url = reverse("wms-proxy", args=[wms_source.id])
        response = client.get(
            url,
            {
                "token": "invalid.token.format",
                "SERVICE": "WMS",
                "REQUEST": "GetMap",
            },
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_token_for_nonexistent_user_rejected(self, user, wms_source):
        """Should reject tokens for users that no longer exist."""
        token = AccessToken.for_user(user)
        token["wms_only"] = True
        token_str = str(token)

        # Delete the user
        user_id = user.id
        user.delete()

        client = APIClient()
        url = reverse("wms-proxy", args=[wms_source.id])
        response = client.get(
            url,
            {
                "token": token_str,
                "SERVICE": "WMS",
                "REQUEST": "GetMap",
            },
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_no_token_falls_through_to_other_auth(self, wms_source):
        """Should return 403 when no token and no other auth."""
        client = APIClient()
        url = reverse("wms-proxy", args=[wms_source.id])
        response = client.get(
            url,
            {
                "SERVICE": "WMS",
                "REQUEST": "GetMap",
            },
        )

        # No token, no cookie auth = 403 Forbidden
        assert response.status_code == status.HTTP_403_FORBIDDEN
