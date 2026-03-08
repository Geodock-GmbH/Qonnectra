"""
Tests for the fiber trace service and API endpoint.

Tests cover:
- trace_fiber: Tracing a single fiber through splice connections
- trace_cable: Tracing all fibers in a cable
- trace_node: Tracing all fibers passing through a node
- FiberTraceView: API endpoint for fiber tracing
"""

import pytest
from apps.api.models import (
    AttributesComponentType,
    FiberSplice,
    NodeSlotConfiguration,
    NodeStructure,
)
from apps.api.services import trace_cable, trace_fiber, trace_node
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
def simple_fiber_chain(db):
    """
    Create a simple fiber chain: Fiber1 -> Node1 -> Fiber2 -> Node2 -> Fiber3.

    This represents a basic linear trace scenario.
    """
    # Create nodes
    node1 = NodeFactory(name="Node-1")
    node2 = NodeFactory(name="Node-2")

    # Create slot configurations for each node
    slot_config1 = NodeSlotConfiguration.objects.create(
        uuid_node=node1, side="A", total_slots=12
    )
    slot_config2 = NodeSlotConfiguration.objects.create(
        uuid_node=node2, side="A", total_slots=12
    )

    # Create component type
    component_type = AttributesComponentType.objects.create(
        component_type="Splice Cassette", occupied_slots=2
    )

    # Create node structures
    structure1 = NodeStructure.objects.create(
        uuid_node=node1,
        slot_configuration=slot_config1,
        component_type=component_type,
        slot_start=1,
        slot_end=2,
    )
    structure2 = NodeStructure.objects.create(
        uuid_node=node2,
        slot_configuration=slot_config2,
        component_type=component_type,
        slot_start=1,
        slot_end=2,
    )

    # Create cables with fibers
    cable1 = CableFactory(name="Cable-1")
    cable2 = CableFactory(name="Cable-2")
    cable3 = CableFactory(name="Cable-3")

    fiber1 = FiberFactory(uuid_cable=cable1, fiber_number_absolute=1)
    fiber2 = FiberFactory(uuid_cable=cable2, fiber_number_absolute=1)
    fiber3 = FiberFactory(uuid_cable=cable3, fiber_number_absolute=1)

    # Create splices to connect fibers
    # Fiber1 (side A) <-> Fiber2 (side B) at Node1
    FiberSplice.objects.create(
        node_structure=structure1,
        port_number=1,
        fiber_a=fiber1,
        cable_a=cable1,
        fiber_b=fiber2,
        cable_b=cable2,
    )

    # Fiber2 (side A) <-> Fiber3 (side B) at Node2
    FiberSplice.objects.create(
        node_structure=structure2,
        port_number=1,
        fiber_a=fiber2,
        cable_a=cable2,
        fiber_b=fiber3,
        cable_b=cable3,
    )

    return {
        "nodes": [node1, node2],
        "cables": [cable1, cable2, cable3],
        "fibers": [fiber1, fiber2, fiber3],
        "structures": [structure1, structure2],
    }


@pytest.fixture
def branching_fiber_network(db):
    """
    Create a branching fiber network: Fiber1 -> Node1 -> [Fiber2, Fiber3].

    This represents a splitter scenario where one fiber branches into two.
    """
    node = NodeFactory(name="Splitter-Node")
    slot_config = NodeSlotConfiguration.objects.create(
        uuid_node=node, side="A", total_slots=12
    )
    component_type = AttributesComponentType.objects.create(
        component_type="1:2 Splitter", occupied_slots=2
    )
    structure = NodeStructure.objects.create(
        uuid_node=node,
        slot_configuration=slot_config,
        component_type=component_type,
        slot_start=1,
        slot_end=2,
    )

    cable_in = CableFactory(name="Cable-In")
    cable_out1 = CableFactory(name="Cable-Out-1")
    cable_out2 = CableFactory(name="Cable-Out-2")

    fiber_in = FiberFactory(uuid_cable=cable_in, fiber_number_absolute=1)
    fiber_out1 = FiberFactory(uuid_cable=cable_out1, fiber_number_absolute=1)
    fiber_out2 = FiberFactory(uuid_cable=cable_out2, fiber_number_absolute=1)

    # Create splices for branching
    FiberSplice.objects.create(
        node_structure=structure,
        port_number=1,
        fiber_a=fiber_in,
        cable_a=cable_in,
        fiber_b=fiber_out1,
        cable_b=cable_out1,
    )
    FiberSplice.objects.create(
        node_structure=structure,
        port_number=2,
        fiber_a=fiber_in,
        cable_a=cable_in,
        fiber_b=fiber_out2,
        cable_b=cable_out2,
    )

    return {
        "node": node,
        "structure": structure,
        "fiber_in": fiber_in,
        "fibers_out": [fiber_out1, fiber_out2],
        "cables": [cable_in, cable_out1, cable_out2],
    }


@pytest.fixture
def isolated_fiber(db):
    """Create a fiber with no splice connections."""
    cable = CableFactory(name="Isolated-Cable")
    fiber = FiberFactory(uuid_cable=cable, fiber_number_absolute=1)
    return fiber, cable


@pytest.mark.django_db
class TestTraceFiber:
    """Tests for the trace_fiber service function."""

    def test_trace_isolated_fiber(self, isolated_fiber):
        """Test tracing a fiber with no connections returns just the fiber."""
        fiber, cable = isolated_fiber
        result = trace_fiber(fiber.uuid)

        assert result["entry_point"]["type"] == "fiber"
        assert result["entry_point"]["id"] == str(fiber.uuid)
        assert result["trace_tree"] is not None
        assert result["trace_tree"]["fiber"]["id"] == str(fiber.uuid)
        assert result["trace_tree"]["fiber"]["cable_name"] == cable.name
        assert result["trace_tree"]["children"] == []
        assert result["statistics"]["total_fibers"] == 1
        assert result["statistics"]["total_nodes"] == 0
        assert result["statistics"]["total_splices"] == 0
        assert result["statistics"]["has_branches"] is False

    def test_trace_fiber_chain(self, simple_fiber_chain):
        """Test tracing through a linear chain of fibers."""
        fiber1 = simple_fiber_chain["fibers"][0]
        result = trace_fiber(fiber1.uuid)

        assert result["statistics"]["total_fibers"] == 3
        assert result["statistics"]["total_nodes"] == 2
        assert result["statistics"]["total_splices"] == 2
        assert result["statistics"]["has_branches"] is False

        # Check trace tree structure
        tree = result["trace_tree"]
        assert tree["fiber"]["cable_name"] == "Cable-1"
        assert len(tree["children"]) == 1
        assert tree["children"][0]["node"]["name"] == "Node-1"

    def test_trace_fiber_from_middle(self, simple_fiber_chain):
        """Test tracing from a fiber in the middle of a chain."""
        fiber2 = simple_fiber_chain["fibers"][1]
        result = trace_fiber(fiber2.uuid)

        # Should trace in both directions
        assert result["statistics"]["total_fibers"] == 3
        assert result["statistics"]["total_nodes"] == 2

    def test_trace_branching_fiber(self, branching_fiber_network):
        """Test tracing a fiber that branches into multiple outputs."""
        fiber_in = branching_fiber_network["fiber_in"]
        result = trace_fiber(fiber_in.uuid)

        assert result["statistics"]["total_fibers"] == 3
        assert result["statistics"]["has_branches"] is True

        # Should have two children
        tree = result["trace_tree"]
        assert len(tree["children"]) == 2


@pytest.mark.django_db
class TestTraceCable:
    """Tests for the trace_cable service function."""

    def test_trace_cable_with_connected_fibers(self, simple_fiber_chain):
        """Test tracing all fibers in a cable."""
        cable1 = simple_fiber_chain["cables"][0]
        result = trace_cable(cable1.uuid)

        assert result["entry_point"]["type"] == "cable"
        assert result["entry_point"]["id"] == str(cable1.uuid)
        assert len(result["trace_trees"]) >= 1

    def test_trace_cable_with_no_fibers(self, db):
        """Test tracing a cable with no fibers."""
        cable = CableFactory(name="Empty-Cable")
        result = trace_cable(cable.uuid)

        assert result["entry_point"]["type"] == "cable"
        assert result["trace_trees"] == []
        assert result["statistics"]["total_fibers"] == 0

    def test_trace_cable_aggregates_statistics(self, db):
        """Test that cable trace aggregates statistics from all fibers."""
        cable = CableFactory(name="Multi-Fiber-Cable")
        FiberFactory(uuid_cable=cable, fiber_number_absolute=1)
        FiberFactory(uuid_cable=cable, fiber_number_absolute=2)

        result = trace_cable(cable.uuid)

        assert result["statistics"]["total_fibers"] == 2
        assert len(result["trace_trees"]) == 2


@pytest.mark.django_db
class TestTraceNode:
    """Tests for the trace_node service function."""

    def test_trace_node_with_splices(self, simple_fiber_chain):
        """Test tracing all fibers passing through a node."""
        node1 = simple_fiber_chain["nodes"][0]
        result = trace_node(node1.uuid)

        assert result["entry_point"]["type"] == "node"
        assert result["entry_point"]["id"] == str(node1.uuid)
        assert len(result["trace_trees"]) >= 1

    def test_trace_node_without_splices(self, db):
        """Test tracing a node with no splices."""
        node = NodeFactory(name="Empty-Node")
        result = trace_node(node.uuid)

        assert result["entry_point"]["type"] == "node"
        assert result["trace_trees"] == []
        assert result["statistics"]["total_fibers"] == 0


@pytest.mark.django_db
class TestFiberTraceView:
    """Tests for the FiberTraceView API endpoint."""

    def test_trace_requires_authentication(self, db):
        """Test that the trace endpoint requires authentication."""
        client = APIClient()
        response = client.get("/api/v1/fiber-trace/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_trace_requires_parameter(self, authenticated_client):
        """Test that at least one ID parameter is required."""
        response = authenticated_client.get("/api/v1/fiber-trace/")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "required" in response.data["error"].lower()

    def test_trace_rejects_multiple_parameters(
        self, authenticated_client, simple_fiber_chain
    ):
        """Test that only one ID parameter is allowed."""
        fiber = simple_fiber_chain["fibers"][0]
        cable = simple_fiber_chain["cables"][0]

        response = authenticated_client.get(
            f"/api/v1/fiber-trace/?fiber_id={fiber.uuid}&cable_id={cable.uuid}"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "only one" in response.data["error"].lower()

    def test_trace_fiber_via_api(self, authenticated_client, simple_fiber_chain):
        """Test tracing a fiber via the API endpoint."""
        fiber = simple_fiber_chain["fibers"][0]

        response = authenticated_client.get(
            f"/api/v1/fiber-trace/?fiber_id={fiber.uuid}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["entry_point"]["type"] == "fiber"
        assert "trace_tree" in response.data
        assert "statistics" in response.data

    def test_trace_cable_via_api(self, authenticated_client, simple_fiber_chain):
        """Test tracing a cable via the API endpoint."""
        cable = simple_fiber_chain["cables"][0]

        response = authenticated_client.get(
            f"/api/v1/fiber-trace/?cable_id={cable.uuid}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["entry_point"]["type"] == "cable"
        assert "trace_trees" in response.data

    def test_trace_node_via_api(self, authenticated_client, simple_fiber_chain):
        """Test tracing a node via the API endpoint."""
        node = simple_fiber_chain["nodes"][0]

        response = authenticated_client.get(
            f"/api/v1/fiber-trace/?node_id={node.uuid}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["entry_point"]["type"] == "node"

    def test_trace_response_excludes_raw_segments(
        self, authenticated_client, simple_fiber_chain
    ):
        """Test that raw segments are not included in API response."""
        fiber = simple_fiber_chain["fibers"][0]

        response = authenticated_client.get(
            f"/api/v1/fiber-trace/?fiber_id={fiber.uuid}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert "_raw_segments" not in response.data
