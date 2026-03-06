"""Tests for WFS3 (OGC API Features) proxy views."""

from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
from django.core.files.base import ContentFile
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.api.models import QGISProject


@pytest.fixture
def api_client(user):
    """Create an authenticated API client."""
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def qgis_project(db, user):
    """Create a test QGIS project."""
    project = QGISProject.objects.create(
        name="test-project",
        display_name="Test Project",
        description="A test project",
        created_by=user,
    )
    project.project_file.save("test-project.qgz", ContentFile(b"fake qgz content"))
    return project


class TestWFS3ProxyView:
    """Tests for WFS3 proxy view."""

    def test_proxy_unauthenticated(self, qgis_project):
        """Should require authentication."""
        client = APIClient()
        response = client.get(f"/api/v1/wfs3/{qgis_project.name}/")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_proxy_invalid_project(self, api_client):
        """Should return 404 for invalid project name."""
        response = api_client.get("/api/v1/wfs3/nonexistent-project/")

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_proxy_forwards_landing_page(self, api_client, qgis_project):
        """Should forward landing page request to QGIS Server."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "title": "WFS3 API",
            "links": [
                {"href": "http://qgis-server:80/wfs3/collections/", "rel": "data"}
            ],
        }
        mock_response.headers = {"Content-Type": "application/json"}
        mock_response.status_code = 200
        mock_response.ok = True

        with patch("apps.api.views.requests.get", return_value=mock_response) as mock_get:
            response = api_client.get(f"/api/v1/wfs3/{qgis_project.name}/")

        assert response.status_code == 200
        mock_get.assert_called_once()

        call_url = mock_get.call_args[0][0]
        assert f"MAP=/projects/{qgis_project.name}" in call_url

    def test_proxy_collections_request(self, api_client, qgis_project):
        """Should forward collections request."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"collections": []}
        mock_response.headers = {"Content-Type": "application/json"}
        mock_response.status_code = 200
        mock_response.ok = True

        with patch("apps.api.views.requests.get", return_value=mock_response):
            response = api_client.get(f"/api/v1/wfs3/{qgis_project.name}/collections/")

        assert response.status_code == 200

    def test_proxy_items_request(self, api_client, qgis_project):
        """Should forward items request with GeoJSON response."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "id": 1,
                    "geometry": {"type": "Point", "coordinates": [10.0, 50.0]},
                    "properties": {"name": "Test Feature"},
                }
            ],
        }
        mock_response.headers = {"Content-Type": "application/geo+json"}
        mock_response.status_code = 200
        mock_response.ok = True

        with patch("apps.api.views.requests.get", return_value=mock_response):
            response = api_client.get(
                f"/api/v1/wfs3/{qgis_project.name}/collections/layer/items"
            )

        assert response.status_code == 200
        assert response["Content-Type"] == "application/geo+json"

    def test_proxy_rewrites_urls_in_response(self, api_client, qgis_project):
        """Should rewrite QGIS Server URLs to proxy URLs in JSON responses."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "links": [
                {
                    "href": "http://qgis-server:80/wfs3/collections/?MAP=/projects/test-project.qgz",
                    "rel": "data",
                }
            ]
        }
        mock_response.headers = {"Content-Type": "application/json"}
        mock_response.status_code = 200
        mock_response.ok = True

        with patch("apps.api.views.requests.get", return_value=mock_response):
            response = api_client.get(f"/api/v1/wfs3/{qgis_project.name}/")

        assert response.status_code == 200
        links = response.data.get("links", [])
        if links:
            href = links[0].get("href", "")
            assert "qgis-server:80" not in href
            assert qgis_project.name in href
            assert "MAP=" not in href

    def test_proxy_forwards_query_params(self, api_client, qgis_project):
        """Should forward query parameters (except token)."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"features": []}
        mock_response.headers = {"Content-Type": "application/geo+json"}
        mock_response.status_code = 200
        mock_response.ok = True

        with patch("apps.api.views.requests.get", return_value=mock_response) as mock_get:
            response = api_client.get(
                f"/api/v1/wfs3/{qgis_project.name}/collections/layer/items",
                {"bbox": "0,0,10,10", "limit": "100"},
            )

        assert response.status_code == 200
        call_kwargs = mock_get.call_args[1]
        params = call_kwargs.get("params", {})
        assert params.get("bbox") == "0,0,10,10"
        assert params.get("limit") == "100"

    def test_proxy_excludes_token_param(self, api_client, qgis_project):
        """Should not forward the token query parameter."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"features": []}
        mock_response.headers = {"Content-Type": "application/geo+json"}
        mock_response.status_code = 200
        mock_response.ok = True

        with patch("apps.api.views.requests.get", return_value=mock_response) as mock_get:
            response = api_client.get(
                f"/api/v1/wfs3/{qgis_project.name}/collections/layer/items",
                {"token": "secret-token", "bbox": "0,0,10,10"},
            )

        assert response.status_code == 200
        call_kwargs = mock_get.call_args[1]
        params = call_kwargs.get("params", {})
        assert "token" not in params
        assert params.get("bbox") == "0,0,10,10"


class TestWFS3TokenAuthentication:
    """Tests for WFS3 token authentication (reuses WMSTokenAuthentication)."""

    def test_valid_wms_scoped_token_authenticates(self, user, qgis_project):
        """Should authenticate with a valid WMS-scoped token."""
        token = AccessToken.for_user(user)
        token["wms_only"] = True

        client = APIClient()
        mock_response = MagicMock()
        mock_response.json.return_value = {"collections": []}
        mock_response.headers = {"Content-Type": "application/json"}
        mock_response.status_code = 200
        mock_response.ok = True

        with patch("apps.api.views.requests.get", return_value=mock_response):
            response = client.get(
                f"/api/v1/wfs3/{qgis_project.name}/",
                {"token": str(token)},
            )

        assert response.status_code == status.HTTP_200_OK

    def test_token_without_wms_only_claim_rejected(self, user, qgis_project):
        """Should reject tokens without the wms_only claim."""
        token = AccessToken.for_user(user)

        client = APIClient()
        response = client.get(
            f"/api/v1/wfs3/{qgis_project.name}/",
            {"token": str(token)},
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_expired_token_rejected(self, user, qgis_project):
        """Should reject expired tokens."""
        token = AccessToken.for_user(user)
        token["wms_only"] = True
        token.set_exp(lifetime=-timedelta(minutes=5))

        client = APIClient()
        response = client.get(
            f"/api/v1/wfs3/{qgis_project.name}/",
            {"token": str(token)},
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
