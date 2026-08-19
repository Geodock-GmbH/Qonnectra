"""Tests for read-only ViewSets that are not simple attribute lists.

Covers ContentTypeViewSet, ContainerTypeViewSet, and
CableTypeColorMappingViewSet.
"""

import pytest
from apps.api.models import Node
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from rest_framework import status
from rest_framework.test import APIClient

from ..factories import (
    CableTypeColorMappingFactory,
    ContainerTypeFactory,
)

User = get_user_model()


@pytest.fixture
def api_client():
    """Create API client for testing."""
    return APIClient()


@pytest.fixture
def authenticated_client(db):
    """Create an authenticated API client."""
    user = User.objects.create_user(
        username="ro_testuser",
        email="ro_test@example.com",
        password="testpass123",
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestContentTypeViewSet:
    """Tests for the ContentTypeViewSet."""

    def test_list_returns_only_file_upload_models(self, authenticated_client):
        """The list is limited to the api models that support file uploads."""
        response = authenticated_client.get("/api/v1/content-types/")
        assert response.status_code == status.HTTP_200_OK

        models = {row["model"] for row in response.data}
        assert models == {
            "trench",
            "conduit",
            "cable",
            "node",
            "address",
            "residentialunit",
            "area",
        }

    def test_list_is_ordered_by_model(self, authenticated_client):
        """Results are ordered alphabetically by model name."""
        response = authenticated_client.get("/api/v1/content-types/")
        models = [row["model"] for row in response.data]
        assert models == sorted(models)

    def test_retrieve_single_content_type(self, authenticated_client):
        """A single ContentType can be retrieved by id."""
        node_ct = ContentType.objects.get_for_model(Node)

        response = authenticated_client.get(
            f"/api/v1/content-types/{node_ct.id}/"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["model"] == "node"

    def test_requires_authentication(self, api_client):
        """Anonymous access is rejected."""
        response = api_client.get("/api/v1/content-types/")
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )


@pytest.mark.django_db
class TestContainerTypeViewSet:
    """Tests for the ContainerTypeViewSet."""

    def test_list_container_types(self, authenticated_client):
        """Test listing container types."""
        ContainerTypeFactory.create_batch(3)

        response = authenticated_client.get("/api/v1/container-type/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 3

    def test_retrieve_container_type(self, authenticated_client):
        """Test retrieving a single container type by id."""
        container_type = ContainerTypeFactory(name="Splice Box")

        response = authenticated_client.get(
            f"/api/v1/container-type/{container_type.id}/"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "Splice Box"


@pytest.mark.django_db
class TestCableTypeColorMappingViewSet:
    """Tests for the CableTypeColorMappingViewSet."""

    def test_list_color_mappings(self, authenticated_client):
        """Test listing cable-type color mappings."""
        CableTypeColorMappingFactory.create_batch(2)

        response = authenticated_client.get("/api/v1/cable_type_color_mapping/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2

    def test_retrieve_color_mapping(self, authenticated_client):
        """Test retrieving a single color mapping by uuid."""
        mapping = CableTypeColorMappingFactory()

        response = authenticated_client.get(
            f"/api/v1/cable_type_color_mapping/{mapping.uuid}/"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["uuid"] == str(mapping.uuid)
