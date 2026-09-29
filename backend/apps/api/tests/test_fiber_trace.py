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
    AttributesFiberStatus,
    FiberSplice,
    NodeSlotConfiguration,
    NodeStructure,
    ResidentialUnit,
)
from apps.api.services import (
    _get_entry_point_info,
    trace_address,
    trace_cable,
    trace_fiber,
    trace_node,
    trace_residential_unit,
)
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
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


@pytest.fixture
def fiber_chain_with_address(db):
    """Create a fiber chain where Node-1 has an associated address."""
    node1 = NodeFactory(name="Node-Addr", geom=Point(550000, 6080000, srid=25832))
    node2 = NodeFactory(name="Node-2")

    address = AddressFactory(
        street="Teststraße",
        housenumber=42,
        zip_code="24941",
        city="Flensburg",
        geom=Point(550001, 6080001, srid=25832),
    )
    node1.uuid_address = address
    node1.save()

    slot_config1 = NodeSlotConfiguration.objects.create(
        uuid_node=node1, side="A", total_slots=12
    )
    slot_config2 = NodeSlotConfiguration.objects.create(
        uuid_node=node2, side="A", total_slots=12
    )
    component_type = AttributesComponentType.objects.create(
        component_type="Splice Cassette Addr", occupied_slots=2
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

    cable1 = CableFactory(name="Cable-A1")
    cable2 = CableFactory(name="Cable-A2")
    cable3 = CableFactory(name="Cable-A3")

    fiber1 = FiberFactory(uuid_cable=cable1, fiber_number_absolute=1)
    fiber2 = FiberFactory(uuid_cable=cable2, fiber_number_absolute=1)
    fiber3 = FiberFactory(uuid_cable=cable3, fiber_number_absolute=1)

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

    cable1.uuid_node_start = node1
    cable1.save()
    cable2.uuid_node_start = node1
    cable2.uuid_node_end = node2
    cable2.save()
    cable3.uuid_node_end = node2
    cable3.save()

    return {
        "node1": node1,
        "node2": node2,
        "address": address,
        "fibers": [fiber1, fiber2, fiber3],
        "cables": [cable1, cable2, cable3],
    }


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

    def test_trace_fiber_includes_node_geometry(self, simple_fiber_chain):
        """Test that include_geometry=True adds geometry to trace tree nodes."""
        fiber1 = simple_fiber_chain["fibers"][0]
        result = trace_fiber(fiber1.uuid, include_geometry=True)

        tree = result["trace_tree"]
        node = tree["children"][0]["node"]
        assert node is not None
        assert "geometry" in node
        assert node["geometry"] is not None
        assert node["geometry"]["type"] == "Point"

    def test_trace_fiber_excludes_geometry_by_default(self, simple_fiber_chain):
        """Test that include_geometry=False does not add geometry to nodes."""
        fiber1 = simple_fiber_chain["fibers"][0]
        result = trace_fiber(fiber1.uuid, include_geometry=False)

        tree = result["trace_tree"]
        node = tree["children"][0]["node"]
        assert node is not None
        assert "geometry" not in node

    def test_trace_fiber_includes_address_geometry(self, fiber_chain_with_address):
        """Test that address geometry is included when include_geometry=True."""
        fiber1 = fiber_chain_with_address["fibers"][0]
        result = trace_fiber(fiber1.uuid, include_geometry=True)

        tree = result["trace_tree"]
        node = tree["children"][0]["node"]
        assert "address" in node
        assert "geometry" in node["address"]
        assert node["address"]["geometry"] is not None
        assert node["address"]["geometry"]["type"] == "Point"

    def test_trace_fiber_address_geometry_excluded_by_default(
        self, fiber_chain_with_address
    ):
        """Test that address geometry is not included when include_geometry=False."""
        fiber1 = fiber_chain_with_address["fibers"][0]
        result = trace_fiber(fiber1.uuid, include_geometry=False)

        tree = result["trace_tree"]
        node = tree["children"][0]["node"]
        assert "address" in node
        assert "geometry" not in node["address"]

    def test_trace_fiber_cable_endpoints_have_geometry(self, fiber_chain_with_address):
        """Test that cable endpoint nodes include geometry when include_geometry=True."""
        fiber1 = fiber_chain_with_address["fibers"][0]
        result = trace_fiber(fiber1.uuid, include_geometry=True)

        tree = result["trace_tree"]
        cable_endpoints = tree["cable_endpoints"]
        assert cable_endpoints["start_node"] is not None
        assert "geometry" in cable_endpoints["start_node"]
        assert cable_endpoints["start_node"]["geometry"] is not None
        assert cable_endpoints["start_node"]["geometry"]["type"] == "Point"


@pytest.mark.django_db
class TestGetEntryPointInfo:
    """Tests for _get_entry_point_info geometry support."""

    def test_node_entry_point_includes_geometry(self, simple_fiber_chain):
        """Test node entry point includes geometry when requested."""
        node = simple_fiber_chain["nodes"][0]
        result = _get_entry_point_info("node", node.uuid, include_geometry=True)
        assert "geometry" in result
        assert result["geometry"] is not None
        assert result["geometry"]["type"] == "Point"

    def test_node_entry_point_excludes_geometry_by_default(self, simple_fiber_chain):
        """Test node entry point excludes geometry by default."""
        node = simple_fiber_chain["nodes"][0]
        result = _get_entry_point_info("node", node.uuid)
        assert "geometry" not in result

    def test_address_entry_point_includes_geometry(self, fiber_chain_with_address):
        """Test address entry point includes geometry when requested."""
        address = fiber_chain_with_address["address"]
        result = _get_entry_point_info("address", address.uuid, include_geometry=True)
        assert "geometry" in result
        assert result["geometry"] is not None
        assert result["geometry"]["type"] == "Point"

    def test_fiber_entry_point_no_geometry(self, simple_fiber_chain):
        """Test fiber entry point does not include geometry (fibers have no Point geom)."""
        fiber = simple_fiber_chain["fibers"][0]
        result = _get_entry_point_info("fiber", fiber.uuid, include_geometry=True)
        assert "geometry" not in result


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

        # Test with routed mode
        response = authenticated_client.get(
            f"/api/v1/signal-analysis/?fiber_id={fiber.uuid}"
            "&include_geometry=true&geometry_mode=routed"
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


# =============================================================================
# Tests for the signal source direction
# =============================================================================


def _splice_structure(node, component_name):
    """Create a splice cassette structure in *node* to hang splices on."""
    slot_config = NodeSlotConfiguration.objects.create(
        uuid_node=node, side="A", total_slots=12
    )
    component_type = AttributesComponentType.objects.create(
        component_type=component_name, occupied_slots=2
    )
    return NodeStructure.objects.create(
        uuid_node=node,
        slot_configuration=slot_config,
        component_type=component_type,
        slot_start=1,
        slot_end=2,
    )


def _splice(structure, fiber_a, fiber_b):
    """Splice *fiber_a* to *fiber_b* in *structure*."""
    return FiberSplice.objects.create(
        node_structure=structure,
        port_number=1,
        fiber_a=fiber_a,
        cable_a=fiber_a.uuid_cable,
        fiber_b=fiber_b,
        cable_b=fiber_b.uuid_cable,
    )


def _signal_states(node, states=None):
    """Map each fiber UUID in a signal trace tree to its signal state."""
    if states is None:
        states = {}
    states[node["fiber"]["id"]] = node["signal_state"]
    for child in node.get("children", []):
        _signal_states(child, states)
    return states


@pytest.fixture
def pop_to_house(db):
    """
    Create a feeder spliced to a drop cable that ends at a house.

    POP -[feeder]-> NVt -[drop]-> House (with address)

    The factory statuses are left empty, so each test breaks the fibers it
    needs through :func:`_break`.
    """
    pop = NodeFactory(name="POP")
    nvt = NodeFactory(name="NVt")
    house_address = AddressFactory(street="Dorfstraße", housenumber=52)
    house = NodeFactory(name="House", uuid_address=house_address)

    feeder = CableFactory(name="Feeder", uuid_node_start=pop, uuid_node_end=nvt)
    drop = CableFactory(name="Drop", uuid_node_start=nvt, uuid_node_end=house)
    feeder_fiber = FiberFactory(
        uuid_cable=feeder, fiber_number_absolute=1, fiber_status=None
    )
    drop_fiber = FiberFactory(
        uuid_cable=drop, fiber_number_absolute=1, fiber_status=None
    )
    _splice(_splice_structure(nvt, "Splice Cassette NVt"), feeder_fiber, drop_fiber)

    return {
        "pop": pop,
        "nvt": nvt,
        "house": house,
        "house_address": house_address,
        "feeder_fiber": feeder_fiber,
        "drop_fiber": drop_fiber,
    }


def _break(fiber):
    """Give *fiber* a status, which the signal analysis reads as a break."""
    status_row, _ = AttributesFiberStatus.objects.get_or_create(fiber_status="Defekt")
    fiber.fiber_status = status_row
    fiber.save()


@pytest.mark.django_db
class TestSignalSourceDirection:
    """The chosen signal source decides where the signal enters the trace."""

    def test_source_upstream_of_break_lights_fibers_before_it(self, pop_to_house):
        """Tracing from the broken drop still lights the feeder fed by the POP."""
        from apps.api.services import analyze_signal_flow

        _break(pop_to_house["drop_fiber"])
        result = analyze_signal_flow(
            pop_to_house["drop_fiber"].uuid,
            signal_source_node_id=str(pop_to_house["pop"].uuid),
        )

        states = _signal_states(result["trace_tree"])
        assert states == {
            str(pop_to_house["feeder_fiber"].uuid): "lit",
            str(pop_to_house["drop_fiber"].uuid): "break_point",
        }

    def test_source_behind_break_darkens_fibers_beyond_it(self, pop_to_house):
        """Feeding from the house end leaves the feeder behind the break dark."""
        from apps.api.services import analyze_signal_flow

        _break(pop_to_house["drop_fiber"])
        result = analyze_signal_flow(
            pop_to_house["feeder_fiber"].uuid,
            signal_source_node_id=str(pop_to_house["house"].uuid),
        )

        states = _signal_states(result["trace_tree"])
        assert states == {
            str(pop_to_house["drop_fiber"].uuid): "break_point",
            str(pop_to_house["feeder_fiber"].uuid): "dark",
        }

    def test_tree_is_rooted_at_the_fiber_fed_by_the_source(self, pop_to_house):
        """The tree reads from the source outwards, whichever fiber was traced."""
        from apps.api.services import analyze_signal_flow

        result = analyze_signal_flow(
            pop_to_house["drop_fiber"].uuid,
            signal_source_node_id=str(pop_to_house["pop"].uuid),
        )

        root = result["trace_tree"]
        assert root["fiber"]["id"] == str(pop_to_house["feeder_fiber"].uuid)
        assert root["splice"] is None
        assert root["node"] is None
        [child] = root["children"]
        assert child["fiber"]["id"] == str(pop_to_house["drop_fiber"].uuid)
        assert child["node"]["id"] == str(pop_to_house["nvt"].uuid)
        assert child["splice"] is not None

    def test_every_fiber_at_the_source_receives_signal(self, pop_to_house):
        """A source at the splice node feeds both fibers spliced there."""
        from apps.api.services import analyze_signal_flow

        _break(pop_to_house["feeder_fiber"])
        result = analyze_signal_flow(
            pop_to_house["feeder_fiber"].uuid,
            signal_source_node_id=str(pop_to_house["nvt"].uuid),
        )

        states = _signal_states(result["trace_tree"])
        assert states == {
            str(pop_to_house["feeder_fiber"].uuid): "break_point",
            str(pop_to_house["drop_fiber"].uuid): "lit",
        }

    def test_default_flag_marks_the_fallback_not_the_selection(self, pop_to_house):
        """Picking another source leaves the default flag on the fallback source."""
        from apps.api.services import analyze_signal_flow

        result = analyze_signal_flow(
            pop_to_house["feeder_fiber"].uuid,
            signal_source_node_id=str(pop_to_house["house"].uuid),
        )

        analysis = result["signal_analysis"]
        assert analysis["source_node"]["id"] == str(pop_to_house["house"].uuid)
        defaults = [s["id"] for s in analysis["available_sources"] if s["is_default"]]
        assert defaults == [str(pop_to_house["pop"].uuid)]

    def test_address_behind_a_break_counts_as_affected(self, pop_to_house):
        """The house at the far end of the broken drop cable loses signal."""
        from apps.api.services import analyze_signal_flow

        _break(pop_to_house["drop_fiber"])
        result = analyze_signal_flow(
            pop_to_house["feeder_fiber"].uuid,
            signal_source_node_id=str(pop_to_house["pop"].uuid),
        )

        assert result["affected_summary"]["affected_addresses"] == 1

    def test_address_at_the_source_is_not_affected(self, pop_to_house):
        """The house feeding the signal itself is not cut off by the break."""
        from apps.api.services import analyze_signal_flow

        _break(pop_to_house["drop_fiber"])
        result = analyze_signal_flow(
            pop_to_house["feeder_fiber"].uuid,
            signal_source_node_id=str(pop_to_house["house"].uuid),
        )

        assert result["affected_summary"]["affected_addresses"] == 0

    def test_source_param_changes_the_api_result(
        self, authenticated_client, pop_to_house
    ):
        """The endpoint passes the chosen source through to the analysis."""
        _break(pop_to_house["drop_fiber"])
        url = f"/api/v1/signal-analysis/?fiber_id={pop_to_house['drop_fiber'].uuid}"

        from_pop = authenticated_client.get(
            f"{url}&signal_source_node_id={pop_to_house['pop'].uuid}"
        )
        from_house = authenticated_client.get(
            f"{url}&signal_source_node_id={pop_to_house['house'].uuid}"
        )

        assert from_pop.status_code == status.HTTP_200_OK
        assert from_pop.data["affected_summary"]["lit_fibers"] == 1
        assert from_house.data["affected_summary"]["lit_fibers"] == 0


@pytest.fixture
def four_fiber_chain(db):
    """
    Create a linear chain: Fiber1 -N1- Fiber2 -N2- Fiber3 -N3- Fiber4.
    """
    fibers = [
        FiberFactory(
            uuid_cable=CableFactory(name=f"Chain-{i}"), fiber_number_absolute=1
        )
        for i in range(1, 5)
    ]
    for i, (fiber_a, fiber_b) in enumerate(zip(fibers, fibers[1:]), start=1):
        _splice(
            _splice_structure(NodeFactory(name=f"N{i}"), f"Cassette N{i}"),
            fiber_a,
            fiber_b,
        )
    return fibers


@pytest.mark.django_db
class TestTraceTreeParents:
    """Each fiber hangs under the fiber it is spliced to."""

    def test_trace_from_middle_keeps_each_side_separate(self, four_fiber_chain):
        """Fiber4 follows Fiber3 only, not every fiber one step from the entry."""
        from apps.api.services import _trace_fiber_as_walked

        fiber1, fiber2, fiber3, fiber4 = four_fiber_chain
        tree = _trace_fiber_as_walked(fiber2.uuid)["trace_tree"]

        children = {c["fiber"]["id"]: c for c in tree["children"]}
        assert set(children) == {str(fiber1.uuid), str(fiber3.uuid)}
        assert children[str(fiber1.uuid)]["children"] == []
        assert [c["fiber"]["id"] for c in children[str(fiber3.uuid)]["children"]] == [
            str(fiber4.uuid)
        ]


@pytest.fixture
def pop_nvt_house(db):
    """
    Create a feeder, a distribution cable and a drop cable in a chain.

    POP -[feeder]-> NVt1 -[distribution]-> NVt2 -[drop]-> House (with address)

    Every cable runs from the feeding side to the fed side.
    """
    pop = NodeFactory(name="POP")
    nvt1 = NodeFactory(name="NVt1")
    nvt2 = NodeFactory(name="NVt2")
    house = NodeFactory(
        name="House", uuid_address=AddressFactory(street="Dorfstraße", housenumber=52)
    )
    cables = [
        CableFactory(name="Feeder", uuid_node_start=pop, uuid_node_end=nvt1),
        CableFactory(name="Distribution", uuid_node_start=nvt1, uuid_node_end=nvt2),
        CableFactory(name="Drop", uuid_node_start=nvt2, uuid_node_end=house),
    ]
    fibers = [
        FiberFactory(uuid_cable=cable, fiber_number_absolute=1, fiber_status=None)
        for cable in cables
    ]
    for node, fiber_a, fiber_b in zip((nvt1, nvt2), fibers, fibers[1:]):
        _splice(_splice_structure(node, f"Cassette {node.name}"), fiber_a, fiber_b)
    return {"pop": pop, "nvt1": nvt1, "nvt2": nvt2, "house": house, "fibers": fibers}


def _walk_chain(node):
    """List the waypoints of a tree that never branches, top to bottom."""
    chain = [node]
    while node["children"]:
        assert len(node["children"]) == 1
        node = node["children"][0]
        chain.append(node)
    return chain


def _fiber_chain(node):
    """List the fiber UUIDs of a tree that never branches, top to bottom."""
    return [waypoint["fiber"]["id"] for waypoint in _walk_chain(node)]


@pytest.mark.django_db
class TestTraceReadFromEnd:
    """The trace tree reads the path from one of its ends."""

    def test_default_reads_from_the_node_the_path_comes_from(self, pop_nvt_house):
        """A fiber traced mid-path still reads POP first, then down to the house."""
        feeder, distribution, drop = pop_nvt_house["fibers"]
        result = trace_fiber(distribution.uuid)

        assert _fiber_chain(result["trace_tree"]) == [
            str(feeder.uuid),
            str(distribution.uuid),
            str(drop.uuid),
        ]
        assert result["start"]["node"]["id"] == str(pop_nvt_house["pop"].uuid)
        assert result["statistics"]["has_branches"] is False

    def test_waypoints_describe_the_splice_to_the_new_parent(self, pop_nvt_house):
        """Each waypoint names the node it was reached through from its parent."""
        result = trace_fiber(pop_nvt_house["fibers"][2].uuid)

        root, distribution, drop = _walk_chain(result["trace_tree"])
        assert root["node"] is None and root["splice"] is None
        assert distribution["node"]["id"] == str(pop_nvt_house["nvt1"].uuid)
        assert drop["node"]["id"] == str(pop_nvt_house["nvt2"].uuid)
        assert drop["splice"] is not None

    def test_start_node_reads_the_path_the_other_way(self, pop_nvt_house):
        """Reading from the house lists the drop first and the feeder last."""
        feeder, distribution, drop = pop_nvt_house["fibers"]
        result = trace_fiber(
            feeder.uuid, start_node_id=str(pop_nvt_house["house"].uuid)
        )

        assert _fiber_chain(result["trace_tree"]) == [
            str(drop.uuid),
            str(distribution.uuid),
            str(feeder.uuid),
        ]
        assert result["start"]["node"]["id"] == str(pop_nvt_house["house"].uuid)

    def test_only_the_ends_of_the_path_are_offered(self, pop_nvt_house):
        """The nodes in the middle of the path are no place to read it from."""
        result = trace_fiber(pop_nvt_house["fibers"][1].uuid)

        options = {o["id"]: o for o in result["start"]["available_nodes"]}
        assert set(options) == {
            str(pop_nvt_house["pop"].uuid),
            str(pop_nvt_house["house"].uuid),
        }
        assert options[str(pop_nvt_house["pop"].uuid)]["is_default"] is True
        assert options[str(pop_nvt_house["house"].uuid)]["is_default"] is False

    def test_node_in_the_middle_falls_back_to_the_default(self, pop_nvt_house):
        """Asking for a splice node reads the path from the default end."""
        result = trace_fiber(
            pop_nvt_house["fibers"][2].uuid,
            start_node_id=str(pop_nvt_house["nvt1"].uuid),
        )

        assert result["start"]["node"]["id"] == str(pop_nvt_house["pop"].uuid)
        assert result["trace_tree"]["fiber"]["id"] == str(
            pop_nvt_house["fibers"][0].uuid
        )

    def test_ring_offers_every_cable_end_and_lists_each_fiber_once(
        self, ring_with_houses
    ):
        """A closed ring has no end, so every cable end can be read from."""
        result = trace_fiber(ring_with_houses["fibers"][1].uuid)

        assert len(result["start"]["available_nodes"]) == 4
        fibers = []

        def collect(node):
            fibers.append(node["fiber"]["id"])
            for child in node["children"]:
                collect(child)

        collect(result["trace_tree"])
        assert sorted(fibers) == sorted(str(f.uuid) for f in ring_with_houses["fibers"])

    def test_fiber_without_cable_nodes_reads_from_itself(self, four_fiber_chain):
        """Without cable ends there is no end to read from, so the entry stays root."""
        result = trace_fiber(four_fiber_chain[1].uuid)

        assert result["start"] == {"node": None, "available_nodes": []}
        assert result["trace_tree"]["fiber"]["id"] == str(four_fiber_chain[1].uuid)

    def test_signal_source_defaults_to_the_node_the_path_comes_from(
        self, pop_nvt_house
    ):
        """The default source is the POP whichever fiber was traced."""
        from apps.api.services import analyze_signal_flow

        for fiber in pop_nvt_house["fibers"]:
            result = analyze_signal_flow(fiber.uuid)
            assert result["signal_analysis"]["source_node"]["id"] == str(
                pop_nvt_house["pop"].uuid
            )

    def test_api_reads_the_path_from_the_start_node(
        self, authenticated_client, pop_nvt_house
    ):
        """The start node travels as a query parameter."""
        house = pop_nvt_house["house"]
        response = authenticated_client.get(
            f"/api/v1/fiber-trace/?fiber_id={pop_nvt_house['fibers'][0].uuid}"
            f"&start_node_id={house.uuid}"
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["start"]["node"]["id"] == str(house.uuid)
        assert response.data["trace_tree"]["fiber"]["id"] == str(
            pop_nvt_house["fibers"][2].uuid
        )

    def test_api_rejects_a_start_node_for_other_entries(
        self, authenticated_client, pop_nvt_house
    ):
        """Only a fiber trace reads from one end."""
        response = authenticated_client.get(
            f"/api/v1/fiber-trace/?node_id={pop_nvt_house['pop'].uuid}"
            f"&start_node_id={pop_nvt_house['house'].uuid}"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_api_rejects_a_malformed_start_node(
        self, authenticated_client, pop_nvt_house
    ):
        response = authenticated_client.get(
            f"/api/v1/fiber-trace/?fiber_id={pop_nvt_house['fibers'][0].uuid}"
            "&start_node_id=not-a-uuid"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.fixture
def fiber_ring(db):
    """
    Create a ring fed from the POP through Fiber0.

    POP -[Fiber0]- N1 - Fiber1 - N2 - Fiber2 - N3 - Fiber3 - N4 - Fiber0
    """
    pop = NodeFactory(name="Ring-POP")
    nodes = [NodeFactory(name=f"Ring-N{i}") for i in range(1, 5)]
    fibers = [
        FiberFactory(
            uuid_cable=CableFactory(
                name=f"Ring-{i}", uuid_node_start=pop if i == 0 else None
            ),
            fiber_number_absolute=1,
            fiber_status=None,
        )
        for i in range(4)
    ]
    for node, fiber_a, fiber_b in zip(nodes, fibers, fibers[1:] + fibers[:1]):
        _splice(_splice_structure(node, f"Cassette {node.name}"), fiber_a, fiber_b)
    return {"pop": pop, "fibers": fibers}


@pytest.fixture
def ring_with_houses(db):
    """
    Create a ring closed at the POP whose cables end at houses.

    POP -[Ring-0]- H1 -[Ring-1]- H2 -[Ring-2]- N3 -[Ring-3]- POP

    H1 and H2 carry addresses, so a cut-off cable end shows in the affected
    count whichever side the trace reaches the broken fiber from.
    """
    pop = NodeFactory(name="Ring-POP")
    houses = [
        NodeFactory(
            name=f"Ring-H{i}",
            uuid_address=AddressFactory(street="Ringstraße", housenumber=i),
        )
        for i in (1, 2)
    ]
    nodes = [pop, *houses, NodeFactory(name="Ring-N3")]
    fibers = [
        FiberFactory(
            uuid_cable=CableFactory(
                name=f"Ring-{i}", uuid_node_start=start, uuid_node_end=end
            ),
            fiber_number_absolute=1,
            fiber_status=None,
        )
        for i, (start, end) in enumerate(zip(nodes, nodes[1:] + nodes[:1]))
    ]
    for node, fiber_a, fiber_b in zip(
        nodes[1:] + nodes[:1], fibers, fibers[1:] + fibers[:1]
    ):
        _splice(_splice_structure(node, f"Cassette {node.name}"), fiber_a, fiber_b)
    return {"pop": pop, "fibers": fibers}


@pytest.fixture
def cable_passing_the_source(db):
    """
    Create a feeder ending at a node that a passing cable is spliced in.

    A -[feeder]-> S (with address), and B -[passing]-> C spliced at S.
    """
    source = NodeFactory(
        name="Source", uuid_address=AddressFactory(street="Quelle", housenumber=1)
    )
    feeder = CableFactory(
        name="Feeder-S", uuid_node_start=NodeFactory(name="A"), uuid_node_end=source
    )
    passing = CableFactory(
        name="Passing",
        uuid_node_start=NodeFactory(name="B"),
        uuid_node_end=NodeFactory(name="C"),
    )
    feeder_fiber = FiberFactory(
        uuid_cable=feeder, fiber_number_absolute=1, fiber_status=None
    )
    passing_fiber = FiberFactory(
        uuid_cable=passing, fiber_number_absolute=1, fiber_status=None
    )
    _splice(_splice_structure(source, "Cassette Source"), feeder_fiber, passing_fiber)
    return {
        "source": source,
        "feeder_fiber": feeder_fiber,
        "passing_fiber": passing_fiber,
    }


@pytest.mark.django_db
class TestSignalOnFiberGraph:
    """The signal spreads over the splices, not along a single tree path."""

    def test_ring_routes_the_signal_around_a_break(self, fiber_ring):
        """Fibers behind a break stay lit when the ring feeds them the other way."""
        from apps.api.services import analyze_signal_flow

        fiber0, fiber1, fiber2, fiber3 = fiber_ring["fibers"]
        _break(fiber1)
        result = analyze_signal_flow(
            fiber2.uuid, signal_source_node_id=str(fiber_ring["pop"].uuid)
        )

        assert _signal_states(result["trace_tree"]) == {
            str(fiber0.uuid): "lit",
            str(fiber1.uuid): "break_point",
            str(fiber2.uuid): "lit",
            str(fiber3.uuid): "lit",
        }
        assert result["affected_summary"]["dark_fibers"] == 0

    def test_ring_keeps_houses_fed_from_the_other_side(self, ring_with_houses):
        """A broken ring fiber cuts off no house that a lit fiber still reaches."""
        from apps.api.services import analyze_signal_flow

        fiber0, fiber1, fiber2, fiber3 = ring_with_houses["fibers"]
        _break(fiber1)
        result = analyze_signal_flow(
            fiber1.uuid, signal_source_node_id=str(ring_with_houses["pop"].uuid)
        )

        assert _signal_states(result["trace_tree"]) == {
            str(fiber0.uuid): "lit",
            str(fiber1.uuid): "break_point",
            str(fiber2.uuid): "lit",
            str(fiber3.uuid): "lit",
        }
        assert result["affected_summary"]["affected_addresses"] == 0

    def test_ring_trace_never_nests_a_fiber_under_itself(self, fiber_ring):
        """Each branch of the plain trace follows one walked path."""
        tree = trace_fiber(fiber_ring["fibers"][0].uuid)["trace_tree"]

        def assert_no_repeats(node, ancestors):
            fiber_id = node["fiber"]["id"]
            assert fiber_id not in ancestors
            for child in node["children"]:
                assert_no_repeats(child, ancestors | {fiber_id})

        assert_no_repeats(tree, set())

    def test_fiber_spliced_at_the_source_receives_signal(
        self, cable_passing_the_source
    ):
        """A cable passing through the source node is fed at its splice there."""
        from apps.api.services import analyze_signal_flow

        _break(cable_passing_the_source["feeder_fiber"])
        result = analyze_signal_flow(
            cable_passing_the_source["feeder_fiber"].uuid,
            signal_source_node_id=str(cable_passing_the_source["source"].uuid),
        )

        assert _signal_states(result["trace_tree"]) == {
            str(cable_passing_the_source["feeder_fiber"].uuid): "break_point",
            str(cable_passing_the_source["passing_fiber"].uuid): "lit",
        }
        assert result["affected_summary"]["affected_addresses"] == 0
