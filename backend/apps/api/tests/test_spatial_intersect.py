"""Tests for the spatial intersection endpoint.

Cover the ``POST /api/v1/spatial/intersects/`` endpoint and the underlying
``spatial_intersect`` service: geometry parsing, layer selection, project
scoping, SRID handling, and the response envelope shape.
"""

import pytest
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import LineString, Point
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.api.services import SpatialIntersectError, spatial_intersect

from .factories import (
    AddressFactory,
    AreaFactory,
    NodeFactory,
    ProjectFactory,
    TrenchFactory,
)

User = get_user_model()


# A square polygon (EPSG:25832) that covers the (0..100, 0..100) box where the
# default factory geometries live.
COVERING_POLYGON = {
    "type": "Polygon",
    "coordinates": [[[-10, -10], [110, -10], [110, 110], [-10, 110], [-10, -10]]],
}

# A polygon far away from the factory geometries — should match nothing.
DISJOINT_POLYGON = {
    "type": "Polygon",
    "coordinates": [
        [[1000, 1000], [1100, 1000], [1100, 1100], [1000, 1100], [1000, 1000]]
    ],
}


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="spatial_user",
        email="spatial_user@example.com",
        password="testpass123",
    )


@pytest.fixture
def authenticated_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def url():
    return reverse("v1:spatial-intersects")


@pytest.mark.django_db
class TestSpatialIntersectView:
    """End-to-end tests hitting the endpoint via the DRF client."""

    def test_url_reverses_under_v1_namespace(self, url):
        assert url == "/api/v1/spatial/intersects/"

    def test_requires_authentication(self, url):
        response = APIClient().post(url, {"geom": COVERING_POLYGON}, format="json")
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    def test_intersecting_trench_is_returned(self, authenticated_client, url):
        trench = TrenchFactory()

        response = authenticated_client.post(
            url, {"geom": COVERING_POLYGON, "layers": ["trench"]}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert body["srid"] == 25832
        assert body["counts"]["trench"] == 1
        assert body["total"] == 1
        fc = body["layers"]["trench"]
        assert fc["type"] == "FeatureCollection"
        returned_ids = {f["id"] for f in fc["features"]}
        assert str(trench.uuid) in returned_ids

    def test_disjoint_geometry_returns_no_features(self, authenticated_client, url):
        TrenchFactory()

        response = authenticated_client.post(
            url, {"geom": DISJOINT_POLYGON, "layers": ["trench"]}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert body["counts"]["trench"] == 0
        assert body["total"] == 0
        assert body["layers"]["trench"]["features"] == []

    def test_defaults_to_all_layers_when_layers_omitted(
        self, authenticated_client, url
    ):
        TrenchFactory()
        NodeFactory()
        AddressFactory()
        AreaFactory()

        response = authenticated_client.post(
            url, {"geom": COVERING_POLYGON}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert set(body["layers"].keys()) == {"trench", "address", "node", "area"}
        assert body["counts"] == {"trench": 1, "address": 1, "node": 1, "area": 1}
        assert body["total"] == 4

    def test_project_filter_scopes_results(self, authenticated_client, url):
        project_a = ProjectFactory()
        project_b = ProjectFactory()
        in_scope = TrenchFactory(project=project_a)
        TrenchFactory(project=project_b)

        response = authenticated_client.post(
            url,
            {
                "geom": COVERING_POLYGON,
                "layers": ["trench"],
                "project": project_a.id,
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert body["counts"]["trench"] == 1
        returned_ids = {f["id"] for f in body["layers"]["trench"]["features"]}
        assert returned_ids == {str(in_scope.uuid)}

    def test_geometry_in_other_srid_is_transformed(self, authenticated_client, url):
        """A polygon supplied in EPSG:4326 must still match 25832 features."""
        trench = TrenchFactory(
            geom=LineString((500000, 5900000), (500100, 5900000), srid=25832)
        )
        # Build a WGS84 bounding polygon around the same location.
        point = Point(500050, 5900000, srid=25832)
        point.transform(4326)
        lon, lat = point.x, point.y
        wgs84_polygon = {
            "type": "Polygon",
            "coordinates": [
                [
                    [lon - 0.01, lat - 0.01],
                    [lon + 0.01, lat - 0.01],
                    [lon + 0.01, lat + 0.01],
                    [lon - 0.01, lat + 0.01],
                    [lon - 0.01, lat - 0.01],
                ]
            ],
        }

        response = authenticated_client.post(
            url,
            {"geom": wgs84_polygon, "layers": ["trench"], "srid": 4326},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        returned_ids = {f["id"] for f in body["layers"]["trench"]["features"]}
        assert str(trench.uuid) in returned_ids

    def test_missing_geom_is_bad_request(self, authenticated_client, url):
        response = authenticated_client.post(url, {"layers": ["trench"]}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "error" in response.json()

    def test_invalid_geom_is_bad_request(self, authenticated_client, url):
        response = authenticated_client.post(
            url, {"geom": "not a geometry"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "error" in response.json()

    def test_unknown_layer_is_bad_request(self, authenticated_client, url):
        response = authenticated_client.post(
            url, {"geom": COVERING_POLYGON, "layers": ["conduit"]}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "error" in response.json()

    def test_invalid_srid_is_bad_request(self, authenticated_client, url):
        response = authenticated_client.post(
            url, {"geom": COVERING_POLYGON, "srid": "abc"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "error" in response.json()


@pytest.mark.django_db
class TestSpatialIntersectService:
    """Unit tests for the ``spatial_intersect`` service function."""

    def test_returns_queryset_per_requested_layer(self):
        TrenchFactory()
        NodeFactory()

        result = spatial_intersect(COVERING_POLYGON, layers=["trench", "node"])

        assert set(result.keys()) == {"trench", "node"}
        assert result["trench"].count() == 1
        assert result["node"].count() == 1

    def test_string_geojson_is_accepted(self):
        import json

        TrenchFactory()
        result = spatial_intersect(json.dumps(COVERING_POLYGON), layers=["trench"])
        assert result["trench"].count() == 1

    def test_empty_geom_raises(self):
        with pytest.raises(SpatialIntersectError):
            spatial_intersect(None, layers=["trench"])

    def test_unknown_layer_raises(self):
        with pytest.raises(SpatialIntersectError):
            spatial_intersect(COVERING_POLYGON, layers=["nope"])

    def test_layers_must_be_a_list(self):
        with pytest.raises(SpatialIntersectError):
            spatial_intersect(COVERING_POLYGON, layers="trench")

    def test_non_numeric_project_raises(self):
        with pytest.raises(SpatialIntersectError):
            spatial_intersect(COVERING_POLYGON, layers=["trench"], project_id="abc")
