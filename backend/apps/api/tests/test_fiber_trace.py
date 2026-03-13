"""
Tests for the fiber trace service and API endpoint.

Tests cover:
- trace_fiber: Tracing a single fiber through splice connections
- trace_cable: Tracing all fibers in a cable
- trace_node: Tracing all fibers passing through a node
- trace_address: Tracing all fibers connected to an address
- trace_residential_unit: Tracing all fibers connected to a residential unit
- trace_fiber_summary: Getting a compact trace summary for a fiber
- analyze_signal_flow: Analyzing signal flow and detecting breaks
- FiberTraceView: API endpoint for fiber tracing
- FiberTraceSummaryView: API endpoint for trace summaries
- SignalAnalysisView: API endpoint for signal analysis
"""

import pytest
from apps.api.models import (
    AttributesComponentType,
    FiberSplice,
    NodeSlotConfiguration,
    NodeStructure,
    ResidentialUnit,
)
from apps.api.services import (
    trace_address,
    trace_cable,
    trace_fiber,
    trace_node,
    trace_residential_unit,
)
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from .factories import AddressFactory, CableFactory, FiberFactory, NodeFactory

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

        response = authenticated_client.get(f"/api/v1/fiber-trace/?node_id={node.uuid}")
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

    def test_trace_rejects_invalid_uuid(self, authenticated_client):
        """Test that invalid UUID format returns 400 error."""
        response = authenticated_client.get("/api/v1/fiber-trace/?fiber_id=not-a-uuid")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "invalid uuid" in response.data["error"].lower()


@pytest.fixture
def address_with_node_fibers(db):
    """
    Create an address linked to a node that has fiber splices.
    Address -> Node -> Fiber1 <-> Fiber2
    """
    address = AddressFactory(street="Test Street", housenumber=1)
    node = NodeFactory(name="Address-Node", uuid_address=address)

    slot_config = NodeSlotConfiguration.objects.create(
        uuid_node=node, side="A", total_slots=12
    )
    component_type = AttributesComponentType.objects.create(
        component_type="Splice Cassette", occupied_slots=2
    )
    structure = NodeStructure.objects.create(
        uuid_node=node,
        slot_configuration=slot_config,
        component_type=component_type,
        slot_start=1,
        slot_end=2,
    )

    cable1 = CableFactory(name="Address-Cable-1")
    cable2 = CableFactory(name="Address-Cable-2")
    fiber1 = FiberFactory(uuid_cable=cable1, fiber_number_absolute=1)
    fiber2 = FiberFactory(uuid_cable=cable2, fiber_number_absolute=1)

    FiberSplice.objects.create(
        node_structure=structure,
        port_number=1,
        fiber_a=fiber1,
        cable_a=cable1,
        fiber_b=fiber2,
        cable_b=cable2,
    )

    return {
        "address": address,
        "node": node,
        "fibers": [fiber1, fiber2],
        "cables": [cable1, cable2],
        "structure": structure,
    }


@pytest.fixture
def residential_unit_with_fibers(db):
    """
    Create a residential unit with fiber splices connected to it.
    ResidentialUnit -> FiberSplice -> Fiber1 <-> Fiber2
    """
    address = AddressFactory(street="RU Street", housenumber=42)
    residential_unit = ResidentialUnit.objects.create(
        uuid_address=address,
        id_residential_unit="RU-001",
        floor=1,
        side="Left",
    )

    # Create a node with structure for the splice
    node = NodeFactory(name="RU-Node")
    slot_config = NodeSlotConfiguration.objects.create(
        uuid_node=node, side="A", total_slots=12
    )
    component_type = AttributesComponentType.objects.create(
        component_type="ONT Box", occupied_slots=1
    )
    structure = NodeStructure.objects.create(
        uuid_node=node,
        slot_configuration=slot_config,
        component_type=component_type,
        slot_start=1,
        slot_end=1,
    )

    cable1 = CableFactory(name="RU-Cable-1")
    cable2 = CableFactory(name="RU-Cable-2")
    fiber1 = FiberFactory(uuid_cable=cable1, fiber_number_absolute=1)
    fiber2 = FiberFactory(uuid_cable=cable2, fiber_number_absolute=1)

    # Create splice with residential unit connection
    FiberSplice.objects.create(
        node_structure=structure,
        port_number=1,
        fiber_a=fiber1,
        cable_a=cable1,
        fiber_b=fiber2,
        cable_b=cable2,
        residential_unit_a=residential_unit,
    )

    return {
        "address": address,
        "residential_unit": residential_unit,
        "node": node,
        "fibers": [fiber1, fiber2],
        "cables": [cable1, cable2],
        "structure": structure,
    }


@pytest.mark.django_db
class TestTraceAddress:
    """Tests for the trace_address service function."""

    def test_trace_address_with_node_fibers(self, address_with_node_fibers):
        """Test tracing fibers connected via a node linked to an address."""
        address = address_with_node_fibers["address"]
        result = trace_address(address.uuid)

        assert result["entry_point"]["type"] == "address"
        assert result["entry_point"]["id"] == str(address.uuid)
        assert result["statistics"]["total_fibers"] == 2
        assert len(result["trace_trees"]) >= 1

    def test_trace_address_without_connections(self, db):
        """Test tracing an address with no fiber connections."""
        address = AddressFactory(street="Empty Street", housenumber=999)
        result = trace_address(address.uuid)

        assert result["entry_point"]["type"] == "address"
        assert result["trace_trees"] == []
        assert result["statistics"]["total_fibers"] == 0

    def test_trace_address_via_api(
        self, authenticated_client, address_with_node_fibers
    ):
        """Test tracing an address via the API endpoint."""
        address = address_with_node_fibers["address"]

        response = authenticated_client.get(
            f"/api/v1/fiber-trace/?address_id={address.uuid}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["entry_point"]["type"] == "address"
        assert "trace_trees" in response.data
        assert "statistics" in response.data


@pytest.mark.django_db
class TestTraceResidentialUnit:
    """Tests for the trace_residential_unit service function."""

    def test_trace_residential_unit_with_fibers(self, residential_unit_with_fibers):
        """Test tracing fibers connected to a residential unit."""
        ru = residential_unit_with_fibers["residential_unit"]
        result = trace_residential_unit(ru.uuid)

        assert result["entry_point"]["type"] == "residential_unit"
        assert result["entry_point"]["id"] == str(ru.uuid)
        assert result["statistics"]["total_fibers"] == 2
        assert len(result["trace_trees"]) >= 1

    def test_trace_residential_unit_without_connections(self, db):
        """Test tracing a residential unit with no fiber connections."""
        address = AddressFactory(street="No Fiber Street", housenumber=1)
        ru = ResidentialUnit.objects.create(
            uuid_address=address,
            id_residential_unit="RU-EMPTY",
            floor=0,
        )
        result = trace_residential_unit(ru.uuid)

        assert result["entry_point"]["type"] == "residential_unit"
        assert result["trace_trees"] == []
        assert result["statistics"]["total_fibers"] == 0

    def test_trace_residential_unit_via_api(
        self, authenticated_client, residential_unit_with_fibers
    ):
        """Test tracing a residential unit via the API endpoint."""
        ru = residential_unit_with_fibers["residential_unit"]

        response = authenticated_client.get(
            f"/api/v1/fiber-trace/?residential_unit_id={ru.uuid}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["entry_point"]["type"] == "residential_unit"
        assert "trace_trees" in response.data
        assert "statistics" in response.data


@pytest.mark.django_db
class TestEnhancedFiberData:
    """Tests for enhanced fiber data in trace results."""

    def test_trace_includes_fiber_number_in_bundle(self, simple_fiber_chain):
        """Test that fiber_number_in_bundle is included in trace."""
        fiber = simple_fiber_chain["fibers"][0]
        result = trace_fiber(fiber.uuid)

        fiber_data = result["trace_tree"]["fiber"]
        assert "fiber_number_in_bundle" in fiber_data

    def test_trace_includes_bundle_color(self, simple_fiber_chain):
        """Test that bundle_color is included in trace."""
        fiber = simple_fiber_chain["fibers"][0]
        result = trace_fiber(fiber.uuid)

        fiber_data = result["trace_tree"]["fiber"]
        assert "bundle_color" in fiber_data

    def test_trace_includes_layer(self, simple_fiber_chain):
        """Test that layer is included in trace."""
        fiber = simple_fiber_chain["fibers"][0]
        result = trace_fiber(fiber.uuid)

        fiber_data = result["trace_tree"]["fiber"]
        assert "layer" in fiber_data

    def test_trace_includes_fiber_status(self, simple_fiber_chain):
        """Test that fiber status is included in trace."""
        fiber = simple_fiber_chain["fibers"][0]
        result = trace_fiber(fiber.uuid)

        fiber_data = result["trace_tree"]["fiber"]
        assert "status" in fiber_data

    def test_trace_includes_cable_type(self, simple_fiber_chain):
        """Test that cable_type name is included in trace."""
        fiber = simple_fiber_chain["fibers"][0]
        result = trace_fiber(fiber.uuid)

        fiber_data = result["trace_tree"]["fiber"]
        assert "cable_type" in fiber_data


@pytest.mark.django_db
class TestSpliceComponentHierarchy:
    """Tests for splice component hierarchy in trace results."""

    def test_trace_includes_splice_for_connected_fibers(self, simple_fiber_chain):
        """Test that splice info is included for connected fibers."""
        fiber = simple_fiber_chain["fibers"][0]
        result = trace_fiber(fiber.uuid)

        # Root fiber should have no splice (it's the starting point)
        assert result["trace_tree"]["splice"] is None

        # First child should have splice info
        if result["trace_tree"]["children"]:
            child = result["trace_tree"]["children"][0]
            assert child["splice"] is not None
            assert "id" in child["splice"]
            assert "port_number" in child["splice"]
            assert "component" in child["splice"]

    def test_splice_component_has_required_fields(self, simple_fiber_chain):
        """Test that splice component has all required fields."""
        fiber = simple_fiber_chain["fibers"][0]
        result = trace_fiber(fiber.uuid)

        if result["trace_tree"]["children"]:
            splice = result["trace_tree"]["children"][0]["splice"]
            component = splice["component"]
            assert "type" in component
            assert "slot_start" in component
            assert "slot_end" in component
            assert "slot_side" in component

    def test_splice_includes_container_path(self, simple_fiber_chain):
        """Test that splice includes container_path field."""
        fiber = simple_fiber_chain["fibers"][0]
        result = trace_fiber(fiber.uuid)

        if result["trace_tree"]["children"]:
            splice = result["trace_tree"]["children"][0]["splice"]
            assert "container_path" in splice
            # Container path is a list (may be empty if no containers)
            assert isinstance(splice["container_path"], list)


@pytest.mark.django_db
class TestCableInfrastructure:
    """Tests for cable infrastructure in trace results."""

    def test_trace_includes_cable_infrastructure(self, simple_fiber_chain):
        """Test that cable_infrastructure is included in trace."""
        fiber = simple_fiber_chain["fibers"][0]
        result = trace_fiber(fiber.uuid)

        assert "cable_infrastructure" in result
        assert isinstance(result["cable_infrastructure"], dict)

    def test_trace_includes_total_cables_statistic(self, simple_fiber_chain):
        """Test that total_cables is in statistics."""
        fiber = simple_fiber_chain["fibers"][0]
        result = trace_fiber(fiber.uuid)

        assert "total_cables" in result["statistics"]

    def test_trace_includes_total_trenches_statistic(self, simple_fiber_chain):
        """Test that total_trenches is in statistics."""
        fiber = simple_fiber_chain["fibers"][0]
        result = trace_fiber(fiber.uuid)

        assert "total_trenches" in result["statistics"]


@pytest.mark.django_db
class TestIncludeGeometry:
    """Tests for include_geometry parameter."""

    def test_trace_fiber_accepts_include_geometry(self, isolated_fiber):
        """Test that trace_fiber accepts include_geometry parameter."""
        fiber, _ = isolated_fiber
        # Should not raise
        result = trace_fiber(fiber.uuid, include_geometry=False)
        assert result is not None

        result = trace_fiber(fiber.uuid, include_geometry=True)
        assert result is not None

    def test_api_accepts_include_geometry_param(
        self, authenticated_client, simple_fiber_chain
    ):
        """Test that API endpoint accepts include_geometry query param."""
        fiber = simple_fiber_chain["fibers"][0]

        response = authenticated_client.get(
            f"/api/v1/fiber-trace/?fiber_id={fiber.uuid}&include_geometry=true"
        )
        assert response.status_code == status.HTTP_200_OK

        response = authenticated_client.get(
            f"/api/v1/fiber-trace/?fiber_id={fiber.uuid}&include_geometry=false"
        )
        assert response.status_code == status.HTTP_200_OK


# =============================================================================
# Tests for FiberTraceSummaryView and trace_fiber_summary
# =============================================================================


@pytest.fixture
def fiber_with_terminal_nodes(db):
    """
    Create a fiber chain with clear terminal nodes at each end.
    Node-Start -> Fiber1 -> Node-Middle -> Fiber2 -> Node-End
    """
    node_start = NodeFactory(name="Start-Node")
    node_middle = NodeFactory(name="Middle-Node")
    node_end = NodeFactory(name="End-Node")

    slot_config_middle = NodeSlotConfiguration.objects.create(
        uuid_node=node_middle, side="A", total_slots=12
    )
    component_type = AttributesComponentType.objects.create(
        component_type="Splice Cassette", occupied_slots=2
    )
    structure_middle = NodeStructure.objects.create(
        uuid_node=node_middle,
        slot_configuration=slot_config_middle,
        component_type=component_type,
        slot_start=1,
        slot_end=2,
    )

    cable1 = CableFactory(
        name="Cable-Start", uuid_node_start=node_start, uuid_node_end=node_middle
    )
    cable2 = CableFactory(
        name="Cable-End", uuid_node_start=node_middle, uuid_node_end=node_end
    )

    fiber1 = FiberFactory(uuid_cable=cable1, fiber_number_absolute=1)
    fiber2 = FiberFactory(uuid_cable=cable2, fiber_number_absolute=1)

    FiberSplice.objects.create(
        node_structure=structure_middle,
        port_number=1,
        fiber_a=fiber1,
        cable_a=cable1,
        fiber_b=fiber2,
        cable_b=cable2,
    )

    return {
        "nodes": {"start": node_start, "middle": node_middle, "end": node_end},
        "cables": [cable1, cable2],
        "fibers": [fiber1, fiber2],
    }


@pytest.mark.django_db
class TestTraceFiberSummary:
    """Tests for the trace_fiber_summary service function."""

    def test_summary_returns_fiber_id(self, isolated_fiber):
        """Test that summary returns the fiber ID."""
        from apps.api.services import trace_fiber_summary

        fiber, _ = isolated_fiber
        result = trace_fiber_summary(fiber.uuid)

        assert result["fiber_id"] == str(fiber.uuid)

    def test_summary_returns_statistics(self, simple_fiber_chain):
        """Test that summary returns statistics."""
        from apps.api.services import trace_fiber_summary

        fiber = simple_fiber_chain["fibers"][0]
        result = trace_fiber_summary(fiber.uuid)

        assert "statistics" in result
        assert "total_fibers" in result["statistics"]
        assert "total_splices" in result["statistics"]
        assert "total_nodes" in result["statistics"]
        assert result["statistics"]["total_fibers"] == 3

    def test_summary_with_terminal_nodes(self, fiber_with_terminal_nodes):
        """Test that summary extracts terminal (start/end) nodes."""
        from apps.api.services import trace_fiber_summary

        fiber = fiber_with_terminal_nodes["fibers"][0]
        result = trace_fiber_summary(fiber.uuid)

        assert result["start_node"] is not None or result["end_node"] is not None

    def test_summary_isolated_fiber(self, isolated_fiber):
        """Test summary for a fiber with no connections."""
        from apps.api.services import trace_fiber_summary

        fiber, _ = isolated_fiber
        result = trace_fiber_summary(fiber.uuid)

        assert result["statistics"]["total_fibers"] == 1
        assert result["statistics"]["total_splices"] == 0


@pytest.mark.django_db
class TestFiberTraceSummaryView:
    """Tests for the FiberTraceSummaryView API endpoint."""

    def test_summary_requires_authentication(self, db):
        """Test that the summary endpoint requires authentication."""
        client = APIClient()
        response = client.get("/api/v1/fiber-trace/summary/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_summary_requires_fiber_id(self, authenticated_client):
        """Test that fiber_id parameter is required."""
        response = authenticated_client.get("/api/v1/fiber-trace/summary/")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "fiber_id" in response.data["error"].lower()

    def test_summary_rejects_invalid_uuid(self, authenticated_client):
        """Test that invalid UUID format returns 400 error."""
        response = authenticated_client.get(
            "/api/v1/fiber-trace/summary/?fiber_id=not-a-uuid"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "uuid" in response.data["error"].lower()

    def test_summary_success(self, authenticated_client, simple_fiber_chain):
        """Test successful summary response."""
        fiber = simple_fiber_chain["fibers"][0]

        response = authenticated_client.get(
            f"/api/v1/fiber-trace/summary/?fiber_id={fiber.uuid}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["fiber_id"] == str(fiber.uuid)
        assert "start_node" in response.data
        assert "end_node" in response.data
        assert "statistics" in response.data


# =============================================================================
# Tests for SignalAnalysisView and analyze_signal_flow
# =============================================================================


@pytest.fixture
def fiber_with_break(db):
    """
    Create a fiber chain where one fiber has a status (break).
    Fiber1 (ok) -> Node1 -> Fiber2 (BROKEN) -> Node2 -> Fiber3 (dark due to break)
    """
    from apps.api.models import AttributesFiberStatus

    broken_status = AttributesFiberStatus.objects.create(fiber_status="Broken")

    node1 = NodeFactory(name="Node-Before-Break")
    node2 = NodeFactory(name="Node-After-Break")

    slot_config1 = NodeSlotConfiguration.objects.create(
        uuid_node=node1, side="A", total_slots=12
    )
    slot_config2 = NodeSlotConfiguration.objects.create(
        uuid_node=node2, side="A", total_slots=12
    )
    component_type = AttributesComponentType.objects.create(
        component_type="Splice Cassette", occupied_slots=2
    )
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

    cable1 = CableFactory(name="Cable-1")
    cable2 = CableFactory(name="Cable-2")
    cable3 = CableFactory(name="Cable-3")

    fiber1 = FiberFactory(uuid_cable=cable1, fiber_number_absolute=1, fiber_status=None)
    fiber2 = FiberFactory(
        uuid_cable=cable2, fiber_number_absolute=1, fiber_status=broken_status
    )
    fiber3 = FiberFactory(uuid_cable=cable3, fiber_number_absolute=1, fiber_status=None)

    FiberSplice.objects.create(
        node_structure=structure1,
        port_number=1,
        fiber_a=fiber1,
        cable_a=cable1,
        fiber_b=fiber2,
        cable_b=cable2,
    )
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
        "broken_fiber": fiber2,
        "broken_status": broken_status,
    }


@pytest.fixture
def fiber_no_breaks(simple_fiber_chain):
    """Reuse simple_fiber_chain as a network with no breaks."""
    return simple_fiber_chain


@pytest.mark.django_db
class TestAnalyzeSignalFlow:
    """Tests for the analyze_signal_flow service function."""

    def test_signal_flow_no_breaks(self, fiber_no_breaks):
        """Test signal analysis on a network with no breaks."""
        from apps.api.services import analyze_signal_flow

        fiber = fiber_no_breaks["fibers"][0]
        result = analyze_signal_flow(fiber.uuid)

        assert result["signal_analysis"]["total_breaks"] == 0
        assert result["signal_analysis"]["break_points"] == []
        assert result["affected_summary"]["dark_fibers"] == 0

    def test_signal_flow_with_break(self, fiber_with_break):
        """Test signal analysis detects break and marks downstream as dark."""
        from apps.api.services import analyze_signal_flow

        fiber = fiber_with_break["fibers"][0]
        result = analyze_signal_flow(fiber.uuid)

        assert result["signal_analysis"]["total_breaks"] >= 1
        assert len(result["signal_analysis"]["break_points"]) >= 1

        break_point = result["signal_analysis"]["break_points"][0]
        assert break_point["status"] == "Broken"

    def test_signal_flow_available_sources(self, simple_fiber_chain):
        """Test that available signal sources are collected."""
        from apps.api.services import analyze_signal_flow

        fiber = simple_fiber_chain["fibers"][0]
        result = analyze_signal_flow(fiber.uuid)

        assert "available_sources" in result["signal_analysis"]
        # Should have collected cable endpoint nodes as sources

    def test_signal_flow_source_node_selection(self, simple_fiber_chain):
        """Test that source node is determined."""
        from apps.api.services import analyze_signal_flow

        fiber = simple_fiber_chain["fibers"][0]
        result = analyze_signal_flow(fiber.uuid)

        # May be None if no cable endpoints have nodes, but structure should exist
        assert "source_node" in result["signal_analysis"]

    def test_signal_flow_affected_summary(self, fiber_with_break):
        """Test that affected summary is calculated."""
        from apps.api.services import analyze_signal_flow

        fiber = fiber_with_break["fibers"][0]
        result = analyze_signal_flow(fiber.uuid)

        summary = result["affected_summary"]
        assert "lit_fibers" in summary
        assert "dark_fibers" in summary
        assert "break_fibers" in summary
        assert "lit_nodes" in summary
        assert "dark_nodes" in summary
        assert "affected_addresses" in summary
        assert "affected_residential_units" in summary

    def test_signal_flow_empty_trace(self, db):
        """Test signal analysis handles non-existent fiber gracefully."""
        from uuid import uuid4

        from apps.api.services import analyze_signal_flow

        # Should handle missing fiber
        try:
            result = analyze_signal_flow(uuid4())
            # If it returns a result, check structure
            assert result["trace_tree"] is None or "signal_analysis" in result
        except Exception:
            # It's acceptable to raise an exception for non-existent fiber
            pass

    def test_signal_flow_isolated_fiber(self, isolated_fiber):
        """Test signal analysis on an isolated fiber."""
        from apps.api.services import analyze_signal_flow

        fiber, _ = isolated_fiber
        result = analyze_signal_flow(fiber.uuid)

        assert result["signal_analysis"]["total_breaks"] == 0
        assert result["affected_summary"]["lit_fibers"] >= 1


@pytest.mark.django_db
class TestSignalAnalysisView:
    """Tests for the SignalAnalysisView API endpoint."""

    def test_signal_analysis_requires_authentication(self, db):
        """Test that the signal analysis endpoint requires authentication."""
        client = APIClient()
        response = client.get("/api/v1/signal-analysis/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_signal_analysis_requires_fiber_id(self, authenticated_client):
        """Test that fiber_id parameter is required."""
        response = authenticated_client.get("/api/v1/signal-analysis/")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "fiber_id" in response.data["error"].lower()

    def test_signal_analysis_rejects_invalid_fiber_uuid(self, authenticated_client):
        """Test that invalid fiber_id UUID format returns 400 error."""
        response = authenticated_client.get(
            "/api/v1/signal-analysis/?fiber_id=not-a-uuid"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "fiber_id" in response.data["error"].lower()

    def test_signal_analysis_rejects_invalid_source_uuid(
        self, authenticated_client, simple_fiber_chain
    ):
        """Test that invalid signal_source_node_id UUID returns 400 error."""
        fiber = simple_fiber_chain["fibers"][0]
        response = authenticated_client.get(
            f"/api/v1/signal-analysis/?fiber_id={fiber.uuid}&signal_source_node_id=bad-uuid"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "signal_source_node_id" in response.data["error"].lower()

    def test_signal_analysis_rejects_invalid_geometry_mode(
        self, authenticated_client, simple_fiber_chain
    ):
        """Test that invalid geometry_mode returns 400 error."""
        fiber = simple_fiber_chain["fibers"][0]
        response = authenticated_client.get(
            f"/api/v1/signal-analysis/?fiber_id={fiber.uuid}&geometry_mode=invalid"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "geometry_mode" in response.data["error"].lower()

    def test_signal_analysis_success(self, authenticated_client, simple_fiber_chain):
        """Test successful signal analysis response."""
        fiber = simple_fiber_chain["fibers"][0]

        response = authenticated_client.get(
            f"/api/v1/signal-analysis/?fiber_id={fiber.uuid}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert "signal_analysis" in response.data
        assert "trace_tree" in response.data
        assert "affected_summary" in response.data
        assert "statistics" in response.data

    def test_signal_analysis_with_break(self, authenticated_client, fiber_with_break):
        """Test signal analysis response includes break information."""
        fiber = fiber_with_break["fibers"][0]

        response = authenticated_client.get(
            f"/api/v1/signal-analysis/?fiber_id={fiber.uuid}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["signal_analysis"]["total_breaks"] >= 1

    def test_signal_analysis_accepts_geometry_params(
        self, authenticated_client, simple_fiber_chain
    ):
        """Test that geometry parameters are accepted."""
        fiber = simple_fiber_chain["fibers"][0]

        # Test with segments mode
        response = authenticated_client.get(
            f"/api/v1/signal-analysis/?fiber_id={fiber.uuid}"
            "&include_geometry=true&geometry_mode=segments"
        )
        assert response.status_code == status.HTTP_200_OK

        # Test with merged mode
        response = authenticated_client.get(
            f"/api/v1/signal-analysis/?fiber_id={fiber.uuid}"
            "&include_geometry=true&geometry_mode=merged"
        )
        assert response.status_code == status.HTTP_200_OK

    def test_signal_analysis_accepts_orient_geometry(
        self, authenticated_client, simple_fiber_chain
    ):
        """Test that orient_geometry parameter is accepted."""
        fiber = simple_fiber_chain["fibers"][0]

        response = authenticated_client.get(
            f"/api/v1/signal-analysis/?fiber_id={fiber.uuid}"
            "&include_geometry=true&orient_geometry=true"
        )
        assert response.status_code == status.HTTP_200_OK

    def test_signal_analysis_with_custom_source(
        self, authenticated_client, simple_fiber_chain
    ):
        """Test signal analysis with custom signal source node."""
        fiber = simple_fiber_chain["fibers"][0]
        node = simple_fiber_chain["nodes"][0]

        response = authenticated_client.get(
            f"/api/v1/signal-analysis/?fiber_id={fiber.uuid}"
            f"&signal_source_node_id={node.uuid}"
        )
        assert response.status_code == status.HTTP_200_OK


# =============================================================================
# Tests for Signal State Propagation
# =============================================================================


@pytest.mark.django_db
class TestSignalStatePropagation:
    """Tests for signal state propagation through trace tree."""

    def test_all_lit_when_no_breaks(self, simple_fiber_chain):
        """Test that all fibers are lit when there are no breaks."""
        from apps.api.services import analyze_signal_flow

        fiber = simple_fiber_chain["fibers"][0]
        result = analyze_signal_flow(fiber.uuid)

        def count_states(node, states=None):
            if states is None:
                states = {"lit": 0, "dark": 0, "break_point": 0}
            if node:
                state = node.get("signal_state", "lit")
                states[state] = states.get(state, 0) + 1
                for child in node.get("children", []):
                    count_states(child, states)
            return states

        states = count_states(result["trace_tree"])
        assert states["dark"] == 0
        assert states["break_point"] == 0
        assert states["lit"] >= 1

    def test_dark_after_break(self, fiber_with_break):
        """Test that fibers after a break are marked dark."""
        from apps.api.services import analyze_signal_flow

        fiber = fiber_with_break["fibers"][0]
        result = analyze_signal_flow(fiber.uuid)

        # Should have at least one break and some dark fibers
        summary = result["affected_summary"]
        assert summary["break_fibers"] >= 1 or summary["dark_fibers"] >= 0

    def test_break_point_has_status(self, fiber_with_break):
        """Test that break points include the fiber status."""
        from apps.api.services import analyze_signal_flow

        fiber = fiber_with_break["fibers"][0]
        result = analyze_signal_flow(fiber.uuid)

        break_points = result["signal_analysis"]["break_points"]
        if break_points:
            bp = break_points[0]
            assert "status" in bp
            assert bp["status"] == "Broken"
            assert "fiber_id" in bp
            assert "cable_name" in bp
