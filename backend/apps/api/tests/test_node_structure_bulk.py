"""Tests for NodeStructure bulk-create endpoint."""

import pytest
from apps.api.models import (
    AttributesComponentType,
    NodeSlotConfiguration,
    NodeStructure,
)
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from .factories import NodeFactory

User = get_user_model()


@pytest.fixture
def authenticated_client(db):
    """Create an authenticated API client."""
    user = User.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="testpass123",
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def node_with_slots(db):
    """Create a node with slot configuration."""
    node = NodeFactory()
    slot_config = NodeSlotConfiguration.objects.create(
        uuid_node=node,
        side="A",
        total_slots=20,
    )
    component_type = AttributesComponentType.objects.create(
        component_type="Test Component",
        occupied_slots=2,
    )
    return node, slot_config, component_type


@pytest.mark.django_db
class TestNodeStructureBulkCreate:
    """Tests for the bulk-create endpoint."""

    def test_bulk_create_requires_authentication(self, db):
        """Test that bulk-create requires authentication."""
        client = APIClient()
        response = client.post("/api/v1/node-structure/bulk-create/", {})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_bulk_create_all_succeed(self, authenticated_client, node_with_slots):
        """Test creating multiple structures successfully."""
        node, slot_config, component_type = node_with_slots

        response = authenticated_client.post(
            "/api/v1/node-structure/bulk-create/",
            {
                "node_uuid": str(node.uuid),
                "slot_configuration_uuid": str(slot_config.uuid),
                "component_type_id": component_type.id,
                "slot_start": 1,
                "count": 3,
                "occupied_slots_per_component": 2,
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["created"]) == 3
        assert len(data["failed"]) == 0

        # Verify structures in database
        structures = NodeStructure.objects.filter(slot_configuration=slot_config)
        assert structures.count() == 3
        assert structures.filter(slot_start=1, slot_end=2).exists()
        assert structures.filter(slot_start=3, slot_end=4).exists()
        assert structures.filter(slot_start=5, slot_end=6).exists()

    def test_bulk_create_partial_success_occupied_slots(
        self, authenticated_client, node_with_slots
    ):
        """Test partial success when some slots are occupied."""
        node, slot_config, component_type = node_with_slots

        # Pre-occupy slots 3-4
        NodeStructure.objects.create(
            uuid_node=node,
            slot_configuration=slot_config,
            component_type=component_type,
            slot_start=3,
            slot_end=4,
        )

        response = authenticated_client.post(
            "/api/v1/node-structure/bulk-create/",
            {
                "node_uuid": str(node.uuid),
                "slot_configuration_uuid": str(slot_config.uuid),
                "component_type_id": component_type.id,
                "slot_start": 1,
                "count": 3,
                "occupied_slots_per_component": 2,
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["created"]) == 2  # slots 1-2 and 5-6
        assert len(data["failed"]) == 1  # slots 3-4 occupied
        assert "occupied" in data["failed"][0]["error"]

    def test_bulk_create_exceeds_total_slots(
        self, authenticated_client, node_with_slots
    ):
        """Test failure when structures would exceed total slots."""
        node, slot_config, component_type = node_with_slots

        response = authenticated_client.post(
            "/api/v1/node-structure/bulk-create/",
            {
                "node_uuid": str(node.uuid),
                "slot_configuration_uuid": str(slot_config.uuid),
                "component_type_id": component_type.id,
                "slot_start": 18,
                "count": 3,
                "occupied_slots_per_component": 2,
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # slots 18-19 and 20-21 (exceeds), 22-23 (exceeds)
        assert len(data["created"]) == 1
        assert len(data["failed"]) == 2

    def test_bulk_create_invalid_node(self, authenticated_client, node_with_slots):
        """Test error when node doesn't exist."""
        _, slot_config, component_type = node_with_slots

        response = authenticated_client.post(
            "/api/v1/node-structure/bulk-create/",
            {
                "node_uuid": "00000000-0000-0000-0000-000000000000",
                "slot_configuration_uuid": str(slot_config.uuid),
                "component_type_id": component_type.id,
                "slot_start": 1,
                "count": 1,
                "occupied_slots_per_component": 2,
            },
            format="json",
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in response.json()["error"]
