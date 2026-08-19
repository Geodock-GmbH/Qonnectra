"""Tests for the TrenchesNearNodeView spatial-proximity endpoint."""

import pytest
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import LineString, Point
from rest_framework import status
from rest_framework.test import APIClient

from ..factories import (
    ConduitFactory,
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
    """Create an authenticated API client."""
    user = User.objects.create_user(
        username="near_node_user",
        email="near_node@example.com",
        password="testpass123",
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def node_with_nearby_trench(db, project, flag):
    """Create a node with a trench, conduit and microduct within a metre of it."""
    node = NodeFactory(
        project=project,
        flag=flag,
        name="TargetNode",
        geom=Point(UTM_X, UTM_Y, srid=25832),
    )
    trench = TrenchFactory(
        project=project,
        flag=flag,
        geom=LineString((UTM_X, UTM_Y), (UTM_X + 50, UTM_Y), srid=25832),
    )
    conduit = ConduitFactory(project=project, flag=flag)
    TrenchConduitConnectionFactory(uuid_trench=trench, uuid_conduit=conduit)
    MicroductFactory(uuid_conduit=conduit, number=1, color="rot")
    return {"node": node, "trench": trench, "conduit": conduit}


@pytest.mark.django_db
class TestTrenchesNearNodeView:
    """Tests for the TrenchesNearNodeView."""

    def test_requires_node_name_and_project(self, authenticated_client):
        """Missing required parameters yield a 400 error."""
        response = authenticated_client.get(
            "/api/v1/trenches-near-node/?node_name=Foo"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_rejects_non_numeric_distance(self, authenticated_client, project):
        """A non-numeric distance is rejected."""
        response = authenticated_client.get(
            f"/api/v1/trenches-near-node/?node_name=Foo"
            f"&project={project.id}&distance=abc"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_returns_404_for_unknown_node(self, authenticated_client, project):
        """An unknown node name yields a 404 error."""
        response = authenticated_client.get(
            f"/api/v1/trenches-near-node/?node_name=Ghost&project={project.id}"
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_returns_nearby_trench_with_microducts(
        self, authenticated_client, node_with_nearby_trench, project
    ):
        """A trench within range is returned with its conduit and microducts."""
        trench = node_with_nearby_trench["trench"]
        trench.refresh_from_db()

        response = authenticated_client.get(
            f"/api/v1/trenches-near-node/?node_name=TargetNode"
            f"&project={project.id}&distance=5"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 1
        assert response.data["node_name"] == "TargetNode"

        returned = response.data["trenches"][0]
        assert returned["id_trench"] == trench.id_trench
        assert len(returned["conduits"]) == 1
        assert len(returned["conduits"][0]["microducts"]) == 1

    def test_excludes_far_trenches(
        self, authenticated_client, node_with_nearby_trench, project, flag
    ):
        """A trench outside the search distance is not returned."""
        far_trench = TrenchFactory(
            project=project,
            flag=flag,
            geom=LineString(
                (UTM_X + 10000, UTM_Y), (UTM_X + 10050, UTM_Y), srid=25832
            ),
        )
        far_conduit = ConduitFactory(project=project, flag=flag)
        TrenchConduitConnectionFactory(
            uuid_trench=far_trench, uuid_conduit=far_conduit
        )
        MicroductFactory(uuid_conduit=far_conduit, number=1, color="blau")

        response = authenticated_client.get(
            f"/api/v1/trenches-near-node/?node_name=TargetNode"
            f"&project={project.id}&distance=5"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 1

    def test_requires_authentication(self, api_client, project):
        """Anonymous access is rejected."""
        response = api_client.get(
            f"/api/v1/trenches-near-node/?node_name=Foo&project={project.id}"
        )
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )
