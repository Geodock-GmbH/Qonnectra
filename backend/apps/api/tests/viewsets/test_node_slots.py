"""Tests for node slot ViewSets.

Covers NodeSlotDividerViewSet, NodeSlotClipNumberViewSet (including the
``upsert`` action), and the CRUD surface of NodeSlotConfigurationViewSet.
"""

import pytest
from apps.api.models import (
    NodeSlotClipNumber,
    NodeSlotConfiguration,
    NodeSlotDivider,
)
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from ..factories import ContainerFactory, NodeFactory

User = get_user_model()


@pytest.fixture
def api_client():
    """Create API client for testing."""
    return APIClient()


@pytest.fixture
def authenticated_client(db):
    """Create an authenticated superuser API client."""
    user = User.objects.create_superuser(
        username="slot_user",
        email="slot@example.com",
        password="testpass123",
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def slot_config(db):
    """Create a node with a 20-slot configuration."""
    node = NodeFactory()
    return NodeSlotConfiguration.objects.create(
        uuid_node=node,
        side="A",
        total_slots=20,
    )


@pytest.mark.django_db
class TestNodeSlotDividerViewSet:
    """Tests for the NodeSlotDividerViewSet."""

    def test_create_divider(self, authenticated_client, slot_config):
        """POST creates a divider for a slot configuration."""
        response = authenticated_client.post(
            "/api/v1/node-slot-divider/",
            data={"slot_configuration_id": str(slot_config.uuid), "after_slot": 5},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert NodeSlotDivider.objects.filter(
            slot_configuration=slot_config, after_slot=5
        ).exists()

    def test_rejects_out_of_range_divider(self, authenticated_client, slot_config):
        """A divider beyond total_slots - 1 is rejected."""
        response = authenticated_client.post(
            "/api/v1/node-slot-divider/",
            data={"slot_configuration_id": str(slot_config.uuid), "after_slot": 99},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_filter_by_slot_configuration(self, authenticated_client, slot_config):
        """Dividers can be filtered to a single slot configuration."""
        NodeSlotDivider.objects.create(slot_configuration=slot_config, after_slot=3)
        other_node = NodeFactory()
        other_config = NodeSlotConfiguration.objects.create(
            uuid_node=other_node, side="B", total_slots=10
        )
        NodeSlotDivider.objects.create(slot_configuration=other_config, after_slot=2)

        response = authenticated_client.get(
            f"/api/v1/node-slot-divider/?slot_configuration={slot_config.uuid}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1

    def test_delete_divider(self, authenticated_client, slot_config):
        """DELETE removes a divider."""
        divider = NodeSlotDivider.objects.create(
            slot_configuration=slot_config, after_slot=4
        )
        response = authenticated_client.delete(
            f"/api/v1/node-slot-divider/{divider.uuid}/"
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not NodeSlotDivider.objects.filter(uuid=divider.uuid).exists()


@pytest.mark.django_db
class TestNodeSlotClipNumberViewSet:
    """Tests for the NodeSlotClipNumberViewSet."""

    def test_create_clip_number(self, authenticated_client, slot_config):
        """POST creates a clip number for a slot."""
        response = authenticated_client.post(
            "/api/v1/node-slot-clip-number/",
            data={
                "slot_configuration_id": str(slot_config.uuid),
                "slot_number": 3,
                "clip_number": "3A",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert NodeSlotClipNumber.objects.filter(clip_number="3A").exists()

    def test_filter_by_slot_configuration(self, authenticated_client, slot_config):
        """Clip numbers can be filtered by slot configuration."""
        NodeSlotClipNumber.objects.create(
            slot_configuration=slot_config, slot_number=1, clip_number="1"
        )
        response = authenticated_client.get(
            f"/api/v1/node-slot-clip-number/?slot_configuration={slot_config.uuid}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1

    def test_upsert_creates_new_clip_number(self, authenticated_client, slot_config):
        """The upsert action creates a clip number when none exists."""
        response = authenticated_client.post(
            "/api/v1/node-slot-clip-number/upsert/",
            data={
                "slot_configuration_id": str(slot_config.uuid),
                "slot_number": 7,
                "clip_number": "7B",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert NodeSlotClipNumber.objects.filter(
            slot_configuration=slot_config, slot_number=7
        ).exists()

    def test_upsert_updates_existing_clip_number(
        self, authenticated_client, slot_config
    ):
        """The upsert action updates an existing clip number in place."""
        NodeSlotClipNumber.objects.create(
            slot_configuration=slot_config, slot_number=7, clip_number="old"
        )
        response = authenticated_client.post(
            "/api/v1/node-slot-clip-number/upsert/",
            data={
                "slot_configuration_id": str(slot_config.uuid),
                "slot_number": 7,
                "clip_number": "new",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        clip = NodeSlotClipNumber.objects.get(
            slot_configuration=slot_config, slot_number=7
        )
        assert clip.clip_number == "new"

    def test_upsert_requires_all_fields(self, authenticated_client, slot_config):
        """A missing field in upsert yields a 400 error."""
        response = authenticated_client.post(
            "/api/v1/node-slot-clip-number/upsert/",
            data={"slot_configuration_id": str(slot_config.uuid)},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_upsert_unknown_config_returns_404(self, authenticated_client):
        """Upsert against a missing slot configuration yields a 404."""
        response = authenticated_client.post(
            "/api/v1/node-slot-clip-number/upsert/",
            data={
                "slot_configuration_id": "00000000-0000-0000-0000-000000000000",
                "slot_number": 1,
                "clip_number": "1",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestNodeSlotConfigurationViewSet:
    """Tests for the NodeSlotConfigurationViewSet CRUD surface."""

    def test_list_configurations(self, authenticated_client, slot_config):
        """Slot configurations can be listed."""
        response = authenticated_client.get("/api/v1/node-slot-configuration/")
        assert response.status_code == status.HTTP_200_OK

    def test_retrieve_configuration(self, authenticated_client, slot_config):
        """A single slot configuration can be retrieved by uuid."""
        response = authenticated_client.get(
            f"/api/v1/node-slot-configuration/{slot_config.uuid}/"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["total_slots"] == 20

    def test_by_node_action(self, authenticated_client, slot_config):
        """The by-node action returns configurations for a node."""
        node = slot_config.uuid_node
        response = authenticated_client.get(
            f"/api/v1/node-slot-configuration/by-node/{node.uuid}/"
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1

    def test_move_to_container(self, authenticated_client, slot_config):
        """move-to-container assigns a same-node container to the config."""
        container = ContainerFactory(uuid_node=slot_config.uuid_node)
        response = authenticated_client.post(
            f"/api/v1/node-slot-configuration/{slot_config.uuid}/move-to-container/",
            data={"container_id": str(container.uuid), "sort_order": 2},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        slot_config.refresh_from_db()
        assert slot_config.container_id == container.uuid
        assert slot_config.sort_order == 2

    def test_move_to_root(self, authenticated_client, slot_config):
        """move-to-container with a null container moves the config to root."""
        container = ContainerFactory(uuid_node=slot_config.uuid_node)
        slot_config.container = container
        slot_config.save()

        response = authenticated_client.post(
            f"/api/v1/node-slot-configuration/{slot_config.uuid}/move-to-container/",
            data={"container_id": None, "sort_order": 0},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        slot_config.refresh_from_db()
        assert slot_config.container_id is None

    def test_move_to_container_of_other_node_rejected(
        self, authenticated_client, slot_config
    ):
        """A container from a different node is rejected."""
        other_node = NodeFactory()
        foreign_container = ContainerFactory(uuid_node=other_node)

        response = authenticated_client.post(
            f"/api/v1/node-slot-configuration/{slot_config.uuid}/move-to-container/",
            data={"container_id": str(foreign_container.uuid)},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
