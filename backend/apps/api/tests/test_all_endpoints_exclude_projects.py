"""Tests for the ``exclude_projects`` filter on the Geo ``all/`` endpoints.

Cover the ``exclude_projects`` query param (comma-separated project ids) added
to the address, node, trench, conduit, and area ``all/`` list endpoints so
callers can drop features belonging to specific projects, e.g.
``address/all/?search=teststr&exclude_projects=3,7``.

Assertions are made on the returned entity ``uuid``s rather than a serialized
project field, because the list serializers expose project data in different
shapes (flat vs nested vs omitted).
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from .factories import (
    AddressFactory,
    AreaFactory,
    CableFactory,
    ConduitFactory,
    NodeFactory,
    ProjectFactory,
    TrenchFactory,
)

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_superuser(
        username="exclude_user",
        email="exclude_user@example.com",
        password="testpass123",
    )


@pytest.fixture
def authenticated_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _feature_ids(feature_collection):
    """Collect the feature ``id`` (uuid) values from a GeoJSON response."""
    return {str(feature["id"]) for feature in feature_collection.get("features", [])}


@pytest.mark.django_db
class TestAddressAllExcludeProjects:
    def test_exclude_projects_drops_listed_project(self, authenticated_client):
        project_a = ProjectFactory()
        project_b = ProjectFactory()
        keep = AddressFactory(project=project_a)
        drop = AddressFactory(project=project_b)

        response = authenticated_client.get(
            f"/api/v1/address/all/?exclude_projects={project_b.id}"
        )

        assert response.status_code == status.HTTP_200_OK
        uuids = {row["uuid"] for row in response.json()["results"]}
        assert str(keep.uuid) in uuids
        assert str(drop.uuid) not in uuids

    def test_exclude_projects_comma_separated(self, authenticated_client):
        project_a = ProjectFactory()
        project_b = ProjectFactory()
        project_c = ProjectFactory()
        keep = AddressFactory(project=project_a)
        drop_b = AddressFactory(project=project_b)
        drop_c = AddressFactory(project=project_c)

        response = authenticated_client.get(
            f"/api/v1/address/all/?exclude_projects={project_b.id},{project_c.id}"
        )

        assert response.status_code == status.HTTP_200_OK
        uuids = {row["uuid"] for row in response.json()["results"]}
        assert str(keep.uuid) in uuids
        assert str(drop_b.uuid) not in uuids
        assert str(drop_c.uuid) not in uuids

    def test_combines_with_search(self, authenticated_client):
        """The spec's own example: ?search=...&exclude_projects=... together."""
        project_a = ProjectFactory()
        project_b = ProjectFactory()
        # Both share a street so the trigram search matches both; only the
        # project filter should separate them.
        keep = AddressFactory(project=project_a, street="Teststrasse")
        drop = AddressFactory(project=project_b, street="Teststrasse")

        response = authenticated_client.get(
            f"/api/v1/address/all/?search=Teststrasse&exclude_projects={project_b.id}"
        )

        assert response.status_code == status.HTTP_200_OK
        uuids = {row["uuid"] for row in response.json()["results"]}
        assert str(keep.uuid) in uuids
        assert str(drop.uuid) not in uuids


@pytest.mark.django_db
class TestNodeAllExcludeProjects:
    def test_exclude_projects_drops_listed_project(self, authenticated_client):
        project_a = ProjectFactory()
        project_b = ProjectFactory()
        keep = NodeFactory(project=project_a)
        drop = NodeFactory(project=project_b)

        response = authenticated_client.get(
            f"/api/v1/node/all/?exclude_projects={project_b.id}"
        )

        assert response.status_code == status.HTTP_200_OK
        uuids = _feature_ids(response.json())
        assert str(keep.uuid) in uuids
        assert str(drop.uuid) not in uuids


@pytest.mark.django_db
class TestTrenchAllExcludeProjects:
    def test_exclude_projects_drops_listed_project(self, authenticated_client):
        project_a = ProjectFactory()
        project_b = ProjectFactory()
        keep = TrenchFactory(project=project_a)
        drop = TrenchFactory(project=project_b)

        response = authenticated_client.get(
            f"/api/v1/trench/all/?exclude_projects={project_b.id}"
        )

        assert response.status_code == status.HTTP_200_OK
        uuids = _feature_ids(response.json())
        assert str(keep.uuid) in uuids
        assert str(drop.uuid) not in uuids


@pytest.mark.django_db
class TestConduitAllExcludeProjects:
    def test_exclude_projects_drops_listed_project(self, authenticated_client):
        project_a = ProjectFactory()
        project_b = ProjectFactory()
        keep = ConduitFactory(project=project_a)
        drop = ConduitFactory(project=project_b)

        response = authenticated_client.get(
            f"/api/v1/conduit/all/?exclude_projects={project_b.id}&no_pagination=true"
        )

        assert response.status_code == status.HTTP_200_OK
        uuids = {row["uuid"] for row in response.json()}
        assert str(keep.uuid) in uuids
        assert str(drop.uuid) not in uuids


@pytest.mark.django_db
class TestAreaAllExcludeProjects:
    def test_exclude_projects_drops_listed_project(self, authenticated_client):
        project_a = ProjectFactory()
        project_b = ProjectFactory()
        keep = AreaFactory(project=project_a)
        drop = AreaFactory(project=project_b)

        response = authenticated_client.get(
            f"/api/v1/area/all/?exclude_projects={project_b.id}"
        )

        assert response.status_code == status.HTTP_200_OK
        uuids = _feature_ids(response.json())
        assert str(keep.uuid) in uuids
        assert str(drop.uuid) not in uuids


@pytest.mark.django_db
class TestCableAllExcludeProjects:
    def test_exclude_projects_drops_listed_project(self, authenticated_client):
        project_a = ProjectFactory()
        project_b = ProjectFactory()
        keep = CableFactory(project=project_a)
        drop = CableFactory(project=project_b)

        response = authenticated_client.get(
            f"/api/v1/cable/all/?exclude_projects={project_b.id}"
        )

        assert response.status_code == status.HTTP_200_OK
        uuids = {row["uuid"] for row in response.json()}
        assert str(keep.uuid) in uuids
        assert str(drop.uuid) not in uuids
