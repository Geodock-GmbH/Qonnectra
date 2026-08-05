"""Tests for the OpenLayers MVT vector-tile endpoints.

Covers OlTrenchTileViewSet, OlNodeTileViewSet, OlAddressTileViewSet and
OlAreaTileViewSet. Tile (0, 0, 0) covers the entire world in Web Mercator,
so any seeded geometry falls inside it and yields a non-empty tile.
"""

import pytest
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import LineString, Point
from rest_framework import status
from rest_framework.test import APIClient

from ..factories import (
    AddressFactory,
    AreaFactory,
    NodeFactory,
    TrenchFactory,
)

User = get_user_model()

MVT_CONTENT_TYPE = "application/vnd.mapbox-vector-tile"

# A point in the project's UTM32N working area (≈ lon 9.54, lat 54.78). At
# zoom 12 it falls inside tile x=2156, y=1299, where a 100 m feature keeps a
# non-degenerate footprint (unlike the world tile, where it collapses away).
UTM_X = 535000
UTM_Y = 6070000
TILE_Z = 12
TILE_X = 2156
TILE_Y = 1299


@pytest.fixture
def api_client():
    """Create API client for testing."""
    return APIClient()


@pytest.fixture
def authenticated_client(db):
    """Create an authenticated API client."""
    user = User.objects.create_user(
        username="mvt_user",
        email="mvt@example.com",
        password="testpass123",
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


# Each tuple is (name, url-prefix, geometry-seeding callable taking project/flag).
TILE_ENDPOINTS = [
    ("trench", "ol_trench_tiles"),
    ("node", "ol_node_tiles"),
    ("address", "ol_address_tiles"),
    ("area", "ol_area_tiles"),
]


def _seed(name, project, flag):
    """Create a single feature of the requested type inside the world tile."""
    if name == "trench":
        TrenchFactory(
            project=project,
            flag=flag,
            geom=LineString(
                (UTM_X, UTM_Y), (UTM_X + 100, UTM_Y), srid=25832
            ),
        )
    elif name == "node":
        NodeFactory(project=project, flag=flag, geom=Point(UTM_X, UTM_Y, srid=25832))
    elif name == "address":
        AddressFactory(
            project=project, flag=flag, geom=Point(UTM_X, UTM_Y, srid=25832)
        )
    elif name == "area":
        AreaFactory(
            project=project,
            flag=flag,
            geom=(
                "SRID=25832;POLYGON(("
                f"{UTM_X} {UTM_Y}, {UTM_X + 100} {UTM_Y}, "
                f"{UTM_X + 100} {UTM_Y + 100}, {UTM_X} {UTM_Y + 100}, "
                f"{UTM_X} {UTM_Y}))"
            ),
        )


@pytest.mark.django_db
class TestMvtTileViews:
    """Tests shared across the four MVT tile endpoints."""

    @pytest.mark.parametrize("name,prefix", TILE_ENDPOINTS)
    def test_requires_authentication(self, api_client, name, prefix):
        """Anonymous access to a tile endpoint is rejected."""
        response = api_client.get(f"/api/v1/{prefix}/0/0/0.mvt")
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    @pytest.mark.parametrize("name,prefix", TILE_ENDPOINTS)
    def test_returns_tile_for_seeded_geometry(
        self, authenticated_client, project, flag, name, prefix
    ):
        """A feature inside the world tile yields a non-empty MVT response."""
        _seed(name, project, flag)

        response = authenticated_client.get(
            f"/api/v1/{prefix}/{TILE_Z}/{TILE_X}/{TILE_Y}.mvt?project={project.id}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == MVT_CONTENT_TYPE
        assert len(response.content) > 0

    @pytest.mark.parametrize("name,prefix", TILE_ENDPOINTS)
    def test_returns_204_for_empty_tile(
        self, authenticated_client, project, flag, name, prefix
    ):
        """A tile with no matching geometry returns 204 No Content."""
        _seed(name, project, flag)

        # Tile (10, 0, 0) is a small tile near the antimeridian, far from the
        # seeded UTM32N geometry.
        response = authenticated_client.get(
            f"/api/v1/{prefix}/10/0/0.mvt?project={project.id}"
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT

    @pytest.mark.parametrize("name,prefix", TILE_ENDPOINTS)
    def test_rejects_invalid_project(self, authenticated_client, name, prefix):
        """A non-integer project id yields a 400 error."""
        response = authenticated_client.get(
            f"/api/v1/{prefix}/0/0/0.mvt?project=not-an-int"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
