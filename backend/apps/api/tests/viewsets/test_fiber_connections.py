"""Tests for the fiber-connections actions.

Covers AddressViewSet.fiber_connections and
ResidentialUnitViewSet.fiber_connections, which resolve fiber splices linked
to an address' residential units into per-unit connection payloads.
"""

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

from ..factories import (
    AddressFactory,
    CableFactory,
    FiberColorFactory,
    FiberFactory,
    NodeFactory,
    ResidentialUnitFactory,
)

User = get_user_model()


@pytest.fixture
def api_client():
    """Create API client for testing."""
    return APIClient()


@pytest.fixture
def authenticated_client(db):
    """Create an authenticated superuser API client."""
    user = User.objects.create_superuser(
        username="fiber_conn_user",
        email="fiber_conn@example.com",
        password="testpass123",
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def spliced_unit(db, project, flag):
    """Build a residential unit connected through a fiber splice.

    The splice records the unit on side B, so the endpoint resolves it to
    ``fiber_a``/``cable_a``.
    """
    address = AddressFactory(project=project, flag=flag)
    unit = ResidentialUnitFactory(uuid_address=address)

    node = NodeFactory(project=project, flag=flag, name="SpliceNode")
    slot_config = NodeSlotConfiguration.objects.create(
        uuid_node=node, side="A", total_slots=20
    )
    component_type = AttributesComponentType.objects.create(
        component_type="Splice Cassette", occupied_slots=2
    )
    node_structure = NodeStructure.objects.create(
        uuid_node=node,
        slot_configuration=slot_config,
        component_type=component_type,
        slot_start=1,
        slot_end=2,
    )

    cable = CableFactory(project=project, flag=flag, name="Cable-A")
    fiber = FiberFactory(
        uuid_cable=cable,
        fiber_number_absolute=1,
        fiber_number_in_bundle=1,
        bundle_color="rot",
        fiber_color="blau",
    )
    FiberSplice.objects.create(
        node_structure=node_structure,
        port_number=1,
        residential_unit_b=unit,
        fiber_a=fiber,
        cable_a=cable,
    )
    return {"address": address, "unit": unit, "cable": cable, "fiber": fiber}


@pytest.mark.django_db
class TestAddressFiberConnections:
    """Tests for the AddressViewSet fiber-connections action."""

    def test_empty_for_units_without_splices(
        self, authenticated_client, project, flag
    ):
        """Units with no splices map to empty connection lists."""
        address = AddressFactory(project=project, flag=flag)
        unit = ResidentialUnitFactory(uuid_address=address)

        response = authenticated_client.get(
            f"/api/v1/address/{address.uuid}/fiber-connections/"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data == {str(unit.uuid): []}

    def test_resolves_spliced_connection(self, authenticated_client, spliced_unit):
        """A spliced unit reports its cable and fiber details."""
        FiberColorFactory(name_de="rot", hex_code="#dc2626")
        address = spliced_unit["address"]
        unit = spliced_unit["unit"]

        response = authenticated_client.get(
            f"/api/v1/address/{address.uuid}/fiber-connections/"
        )
        assert response.status_code == status.HTTP_200_OK
        connections = response.data[str(unit.uuid)]
        assert len(connections) == 1
        assert connections[0]["cable_name"] == "Cable-A"
        assert connections[0]["node_name"] == "SpliceNode"
        assert connections[0]["bundle_color_hex"] == "#dc2626"


@pytest.mark.django_db
class TestResidentialUnitFiberConnections:
    """Tests for the ResidentialUnitViewSet fiber-connections action."""

    def test_empty_without_splices(self, authenticated_client, project, flag):
        """A unit with no splices returns an empty list."""
        address = AddressFactory(project=project, flag=flag)
        unit = ResidentialUnitFactory(uuid_address=address)

        response = authenticated_client.get(
            f"/api/v1/residential-unit/{unit.uuid}/fiber-connections/"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    def test_resolves_spliced_connection(self, authenticated_client, spliced_unit):
        """A spliced unit reports its fiber connection details."""
        unit = spliced_unit["unit"]

        response = authenticated_client.get(
            f"/api/v1/residential-unit/{unit.uuid}/fiber-connections/"
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["cable_name"] == "Cable-A"
        assert response.data[0]["fiber_number_absolute"] == 1

    def test_requires_authentication(self, api_client, spliced_unit):
        """Anonymous access is rejected."""
        unit = spliced_unit["unit"]
        response = api_client.get(
            f"/api/v1/residential-unit/{unit.uuid}/fiber-connections/"
        )
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )
