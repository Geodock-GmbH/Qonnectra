"""Tests for FiberSplice bulk-upsert endpoint."""

import pytest
from apps.api.models import (
    AttributesComponentType,
    FiberSplice,
    NodeSlotConfiguration,
    NodeStructure,
)
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from .factories import CableFactory, FiberFactory, NodeFactory

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
def node_structure_with_fibers(db):
    """Create a node structure with a cable and fibers for testing splices."""
    node = NodeFactory()
    slot_config = NodeSlotConfiguration.objects.create(
        uuid_node=node,
        side="A",
        total_slots=20,
    )
    component_type = AttributesComponentType.objects.create(
        component_type="Test Splice Cassette",
        occupied_slots=2,
    )
    node_structure = NodeStructure.objects.create(
        uuid_node=node,
        slot_configuration=slot_config,
        component_type=component_type,
        slot_start=1,
        slot_end=2,
    )

    # Create a cable with fibers using factory
    cable = CableFactory()
    fibers = [
        FiberFactory(
            uuid_cable=cable, fiber_number_absolute=i, fiber_number_in_bundle=i
        )
        for i in range(1, 5)
    ]

    return node_structure, cable, fibers


@pytest.mark.django_db
class TestFiberSpliceBulkUpsert:
    """Tests for the bulk-upsert endpoint."""

    def test_bulk_upsert_requires_authentication(self, db):
        """Test that bulk-upsert requires authentication."""
        client = APIClient()
        response = client.post("/api/v1/fiber-splice/bulk-upsert/", {})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_bulk_upsert_all_succeed(
        self, authenticated_client, node_structure_with_fibers
    ):
        """Test creating multiple splices successfully."""
        node_structure, cable, fibers = node_structure_with_fibers

        response = authenticated_client.post(
            "/api/v1/fiber-splice/bulk-upsert/",
            {
                "splices": [
                    {
                        "node_structure_uuid": str(node_structure.uuid),
                        "port_number": 1,
                        "side": "a",
                        "fiber_uuid": str(fibers[0].uuid),
                        "cable_uuid": str(cable.uuid),
                    },
                    {
                        "node_structure_uuid": str(node_structure.uuid),
                        "port_number": 2,
                        "side": "a",
                        "fiber_uuid": str(fibers[1].uuid),
                        "cable_uuid": str(cable.uuid),
                    },
                    {
                        "node_structure_uuid": str(node_structure.uuid),
                        "port_number": 3,
                        "side": "a",
                        "fiber_uuid": str(fibers[2].uuid),
                        "cable_uuid": str(cable.uuid),
                    },
                ]
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["created"]) == 3
        assert len(data["failed"]) == 0

        # Verify splices in database
        splices = FiberSplice.objects.filter(node_structure=node_structure)
        assert splices.count() == 3
        assert splices.filter(port_number=1, fiber_a=fibers[0]).exists()
        assert splices.filter(port_number=2, fiber_a=fibers[1]).exists()
        assert splices.filter(port_number=3, fiber_a=fibers[2]).exists()

    def test_bulk_upsert_side_b(self, authenticated_client, node_structure_with_fibers):
        """Test creating splices on side B."""
        node_structure, cable, fibers = node_structure_with_fibers

        response = authenticated_client.post(
            "/api/v1/fiber-splice/bulk-upsert/",
            {
                "splices": [
                    {
                        "node_structure_uuid": str(node_structure.uuid),
                        "port_number": 1,
                        "side": "b",
                        "fiber_uuid": str(fibers[0].uuid),
                        "cable_uuid": str(cable.uuid),
                    },
                ]
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["created"]) == 1
        assert len(data["failed"]) == 0

        # Verify splice is on side B
        splice = FiberSplice.objects.get(
            node_structure=node_structure, port_number=1
        )
        assert splice.fiber_b == fibers[0]
        assert splice.cable_b == cable
        assert splice.fiber_a is None

    def test_bulk_upsert_partial_failure_invalid_fiber(
        self, authenticated_client, node_structure_with_fibers
    ):
        """Test partial failure when one fiber doesn't exist."""
        node_structure, cable, fibers = node_structure_with_fibers

        response = authenticated_client.post(
            "/api/v1/fiber-splice/bulk-upsert/",
            {
                "splices": [
                    {
                        "node_structure_uuid": str(node_structure.uuid),
                        "port_number": 1,
                        "side": "a",
                        "fiber_uuid": str(fibers[0].uuid),
                        "cable_uuid": str(cable.uuid),
                    },
                    {
                        "node_structure_uuid": str(node_structure.uuid),
                        "port_number": 2,
                        "side": "a",
                        "fiber_uuid": "00000000-0000-0000-0000-000000000000",
                        "cable_uuid": str(cable.uuid),
                    },
                ]
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["created"]) == 1
        assert len(data["failed"]) == 1
        assert "Fiber not found" in data["failed"][0]["error"]

    def test_bulk_upsert_invalid_node_structure(
        self, authenticated_client, node_structure_with_fibers
    ):
        """Test failure when node structure doesn't exist."""
        _, cable, fibers = node_structure_with_fibers

        response = authenticated_client.post(
            "/api/v1/fiber-splice/bulk-upsert/",
            {
                "splices": [
                    {
                        "node_structure_uuid": "00000000-0000-0000-0000-000000000000",
                        "port_number": 1,
                        "side": "a",
                        "fiber_uuid": str(fibers[0].uuid),
                        "cable_uuid": str(cable.uuid),
                    },
                ]
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["created"]) == 0
        assert len(data["failed"]) == 1
        assert "Node structure not found" in data["failed"][0]["error"]

    def test_bulk_upsert_update_existing(
        self, authenticated_client, node_structure_with_fibers
    ):
        """Test that bulk upsert updates existing splices."""
        node_structure, cable, fibers = node_structure_with_fibers

        # Pre-create a splice
        FiberSplice.objects.create(
            node_structure=node_structure,
            port_number=1,
            fiber_a=fibers[0],
            cable_a=cable,
        )

        # Upsert with a different fiber
        response = authenticated_client.post(
            "/api/v1/fiber-splice/bulk-upsert/",
            {
                "splices": [
                    {
                        "node_structure_uuid": str(node_structure.uuid),
                        "port_number": 1,
                        "side": "a",
                        "fiber_uuid": str(fibers[1].uuid),
                        "cable_uuid": str(cable.uuid),
                    },
                ]
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["created"]) == 1
        assert len(data["failed"]) == 0

        # Verify the splice was updated
        splice = FiberSplice.objects.get(
            node_structure=node_structure, port_number=1
        )
        assert splice.fiber_a == fibers[1]  # Updated to new fiber

    def test_bulk_upsert_empty_splices(self, authenticated_client):
        """Test that empty splices list returns empty results."""
        response = authenticated_client.post(
            "/api/v1/fiber-splice/bulk-upsert/",
            {"splices": []},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["created"]) == 0
        assert len(data["failed"]) == 0
