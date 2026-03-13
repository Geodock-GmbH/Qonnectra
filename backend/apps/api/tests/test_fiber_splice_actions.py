"""Tests for FiberSpliceViewSet custom actions: upsert, clear_port, merge_ports, unmerge_ports."""

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
    user = User.objects.create_superuser(
        username="spliceuser",
        email="splice@example.com",
        password="testpass123",
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def splice_setup(db):
    """Create a node structure with two cables and fibers for splice testing."""
    node = NodeFactory()
    slot_config = NodeSlotConfiguration.objects.create(
        uuid_node=node,
        side="A",
        total_slots=20,
    )
    component_type = AttributesComponentType.objects.create(
        component_type="Splice Cassette",
        occupied_slots=2,
    )
    node_structure = NodeStructure.objects.create(
        uuid_node=node,
        slot_configuration=slot_config,
        component_type=component_type,
        slot_start=1,
        slot_end=2,
    )

    cable_a = CableFactory()
    cable_b = CableFactory()
    fibers_a = [
        FiberFactory(
            uuid_cable=cable_a, fiber_number_absolute=i, fiber_number_in_bundle=i
        )
        for i in range(1, 5)
    ]
    fibers_b = [
        FiberFactory(
            uuid_cable=cable_b, fiber_number_absolute=i, fiber_number_in_bundle=i
        )
        for i in range(1, 5)
    ]

    return {
        "node_structure": node_structure,
        "cable_a": cable_a,
        "cable_b": cable_b,
        "fibers_a": fibers_a,
        "fibers_b": fibers_b,
    }


@pytest.mark.django_db
class TestUpsert:
    """Tests for the upsert action."""

    def test_upsert_side_a(self, authenticated_client, splice_setup):
        """Verify creating a splice on side A."""
        ns = splice_setup["node_structure"]
        fiber = splice_setup["fibers_a"][0]
        cable = splice_setup["cable_a"]

        response = authenticated_client.post(
            "/api/v1/fiber-splice/upsert/",
            {
                "node_structure": str(ns.uuid),
                "port_number": 1,
                "side": "a",
                "fiber_uuid": str(fiber.uuid),
                "cable_uuid": str(cable.uuid),
            },
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        splice = FiberSplice.objects.get(node_structure=ns, port_number=1)
        assert splice.fiber_a == fiber
        assert splice.cable_a == cable

    def test_upsert_side_b(self, authenticated_client, splice_setup):
        """Verify creating a splice on side B."""
        ns = splice_setup["node_structure"]
        fiber = splice_setup["fibers_b"][0]
        cable = splice_setup["cable_b"]

        response = authenticated_client.post(
            "/api/v1/fiber-splice/upsert/",
            {
                "node_structure": str(ns.uuid),
                "port_number": 1,
                "side": "b",
                "fiber_uuid": str(fiber.uuid),
                "cable_uuid": str(cable.uuid),
            },
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        splice = FiberSplice.objects.get(node_structure=ns, port_number=1)
        assert splice.fiber_b == fiber
        assert splice.cable_b == cable
        assert splice.fiber_a is None

    def test_upsert_updates_existing(self, authenticated_client, splice_setup):
        """Verify upserting an existing port updates the fiber."""
        ns = splice_setup["node_structure"]
        cable = splice_setup["cable_a"]
        fiber1 = splice_setup["fibers_a"][0]
        fiber2 = splice_setup["fibers_a"][1]

        FiberSplice.objects.create(
            node_structure=ns,
            port_number=1,
            fiber_a=fiber1,
            cable_a=cable,
        )

        response = authenticated_client.post(
            "/api/v1/fiber-splice/upsert/",
            {
                "node_structure": str(ns.uuid),
                "port_number": 1,
                "side": "a",
                "fiber_uuid": str(fiber2.uuid),
                "cable_uuid": str(cable.uuid),
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        splice = FiberSplice.objects.get(node_structure=ns, port_number=1)
        assert splice.fiber_a == fiber2

    def test_upsert_requires_authentication(self, db, splice_setup):
        """Verify unauthenticated request is rejected."""
        client = APIClient()
        response = client.post("/api/v1/fiber-splice/upsert/", {})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestClearPort:
    """Tests for the clear_port action."""

    def test_clear_side_a(self, authenticated_client, splice_setup):
        """Verify clearing side A of a port."""
        ns = splice_setup["node_structure"]
        cable_a = splice_setup["cable_a"]
        cable_b = splice_setup["cable_b"]
        fiber_a = splice_setup["fibers_a"][0]
        fiber_b = splice_setup["fibers_b"][0]

        FiberSplice.objects.create(
            node_structure=ns,
            port_number=1,
            fiber_a=fiber_a,
            cable_a=cable_a,
            fiber_b=fiber_b,
            cable_b=cable_b,
        )

        response = authenticated_client.post(
            "/api/v1/fiber-splice/clear-port/",
            {
                "node_structure": str(ns.uuid),
                "port_number": 1,
                "side": "a",
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        splice = FiberSplice.objects.get(node_structure=ns, port_number=1)
        assert splice.fiber_a is None
        assert splice.cable_a is None
        assert splice.fiber_b == fiber_b

    def test_clear_side_b(self, authenticated_client, splice_setup):
        """Verify clearing side B of a port."""
        ns = splice_setup["node_structure"]
        cable_a = splice_setup["cable_a"]
        cable_b = splice_setup["cable_b"]
        fiber_a = splice_setup["fibers_a"][0]
        fiber_b = splice_setup["fibers_b"][0]

        FiberSplice.objects.create(
            node_structure=ns,
            port_number=1,
            fiber_a=fiber_a,
            cable_a=cable_a,
            fiber_b=fiber_b,
            cable_b=cable_b,
        )

        response = authenticated_client.post(
            "/api/v1/fiber-splice/clear-port/",
            {
                "node_structure": str(ns.uuid),
                "port_number": 1,
                "side": "b",
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        splice = FiberSplice.objects.get(node_structure=ns, port_number=1)
        assert splice.fiber_b is None
        assert splice.cable_b is None
        assert splice.fiber_a == fiber_a

    def test_clear_both_sides_deletes_splice(self, authenticated_client, splice_setup):
        """Verify splice is deleted when both sides are cleared."""
        ns = splice_setup["node_structure"]
        fiber = splice_setup["fibers_a"][0]
        cable = splice_setup["cable_a"]

        FiberSplice.objects.create(
            node_structure=ns,
            port_number=1,
            fiber_a=fiber,
            cable_a=cable,
        )

        response = authenticated_client.post(
            "/api/v1/fiber-splice/clear-port/",
            {
                "node_structure": str(ns.uuid),
                "port_number": 1,
                "side": "a",
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert not FiberSplice.objects.filter(node_structure=ns, port_number=1).exists()

    def test_clear_nonexistent_splice(self, authenticated_client, splice_setup):
        """Verify clearing a nonexistent splice returns graceful response."""
        ns = splice_setup["node_structure"]

        response = authenticated_client.post(
            "/api/v1/fiber-splice/clear-port/",
            {
                "node_structure": str(ns.uuid),
                "port_number": 99,
                "side": "a",
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["deleted"] is False


@pytest.mark.django_db
class TestMergePorts:
    """Tests for the merge_ports action."""

    def test_merge_two_ports(self, authenticated_client, splice_setup):
        """Verify merging two ports creates a merge group."""
        ns = splice_setup["node_structure"]

        FiberSplice.objects.create(node_structure=ns, port_number=1)
        FiberSplice.objects.create(node_structure=ns, port_number=2)

        response = authenticated_client.post(
            "/api/v1/fiber-splice/merge-ports/",
            {
                "node_structure": str(ns.uuid),
                "port_numbers": [1, 2],
                "side": "a",
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["merge_group"] is not None
        assert set(data["port_numbers"]) == {1, 2}

        splices = FiberSplice.objects.filter(node_structure=ns)
        merge_groups = set(splices.values_list("merge_group_a", flat=True))
        merge_groups.discard(None)
        assert len(merge_groups) == 1

    def test_merge_ports_with_existing_fiber_becomes_shared(
        self, authenticated_client, splice_setup
    ):
        """Verify existing fiber becomes shared when ports are merged."""
        ns = splice_setup["node_structure"]
        fiber = splice_setup["fibers_a"][0]
        cable = splice_setup["cable_a"]

        FiberSplice.objects.create(
            node_structure=ns,
            port_number=1,
            fiber_a=fiber,
            cable_a=cable,
        )
        FiberSplice.objects.create(node_structure=ns, port_number=2)

        response = authenticated_client.post(
            "/api/v1/fiber-splice/merge-ports/",
            {
                "node_structure": str(ns.uuid),
                "port_numbers": [1, 2],
                "side": "a",
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK

        for splice in FiberSplice.objects.filter(node_structure=ns):
            assert splice.shared_fiber_a == fiber
            assert splice.shared_cable_a == cable

    def test_merge_on_side_b(self, authenticated_client, splice_setup):
        """Verify merging on side B uses merge_group_b."""
        ns = splice_setup["node_structure"]

        FiberSplice.objects.create(node_structure=ns, port_number=1)
        FiberSplice.objects.create(node_structure=ns, port_number=2)

        response = authenticated_client.post(
            "/api/v1/fiber-splice/merge-ports/",
            {
                "node_structure": str(ns.uuid),
                "port_numbers": [1, 2],
                "side": "b",
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        splices = FiberSplice.objects.filter(node_structure=ns)
        assert all(s.merge_group_b is not None for s in splices)
        assert all(s.merge_group_a is None for s in splices)


@pytest.mark.django_db
class TestUnmergePorts:
    """Tests for the unmerge_ports action."""

    def _merge_ports(self, client, ns, port_numbers, side="a"):
        """Helper to merge ports and return the merge group UUID."""
        for pn in port_numbers:
            FiberSplice.objects.get_or_create(
                node_structure=ns,
                port_number=pn,
            )
        response = client.post(
            "/api/v1/fiber-splice/merge-ports/",
            {
                "node_structure": str(ns.uuid),
                "port_numbers": port_numbers,
                "side": side,
            },
            format="json",
        )
        return response.json()["merge_group"]

    def test_unmerge_port_from_group(self, authenticated_client, splice_setup):
        """Verify unmerging a port removes it from the merge group."""
        ns = splice_setup["node_structure"]
        FiberSplice.objects.create(node_structure=ns, port_number=3)

        merge_group = self._merge_ports(authenticated_client, ns, [1, 2, 3], "a")

        response = authenticated_client.post(
            "/api/v1/fiber-splice/unmerge-ports/",
            {
                "merge_group": merge_group,
                "port_numbers": [3],
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert 3 in data["unmerged_ports"]
        assert data["remaining_in_group"] == 2

        unmerged = FiberSplice.objects.get(node_structure=ns, port_number=3)
        assert unmerged.merge_group_a is None

    def test_unmerge_all_dissolves_group(self, authenticated_client, splice_setup):
        """Verify unmerging all ports dissolves the entire group."""
        ns = splice_setup["node_structure"]

        merge_group = self._merge_ports(authenticated_client, ns, [1, 2], "a")

        response = authenticated_client.post(
            "/api/v1/fiber-splice/unmerge-ports/",
            {
                "merge_group": merge_group,
                "port_numbers": [1],
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        # When only 1 port remains, it should also be auto-unmerged
        splices = FiberSplice.objects.filter(node_structure=ns)
        for splice in splices:
            assert splice.merge_group_a is None
