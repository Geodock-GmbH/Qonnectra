import pytest
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import LineString, Point
from rest_framework import status
from rest_framework.test import APIClient

from apps.api.models import Conduit, Microduct, MicroductCableConnection

from .factories import (
    AddressFactory,
    CableFactory,
    ConduitTypeFactory,
    FlagFactory,
    NodeFactory,
    ProjectFactory,
    TrenchConduitConnectionFactory,
    TrenchFactory,
)

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def authenticated_client(api_client, user, seed_permission_data):
    user.groups.add(seed_permission_data["admin_group"])
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def test_project(db):
    return ProjectFactory()


@pytest.fixture
def test_flag(db):
    return FlagFactory()


def _create_conduit_without_signal(project, flag):
    """Create a conduit bypassing the post_save microduct auto-creation signal.

    Args:
        project: :model:`api.Project` instance to assign.
        flag: :model:`api.Flag` instance to assign.

    Returns:
        Conduit: The newly created conduit (no auto-generated microducts).
    """
    conduit_type = ConduitTypeFactory()
    return Conduit.objects.create(
        name=f"Conduit-{conduit_type.pk}",
        conduit_type=conduit_type,
        project=project,
        flag=flag,
    )


class TestAddressLinkedTrenches:
    """Tests for GET /api/address/{uuid}/linked-trenches/."""

    endpoint = "/api/v1/address/{uuid}/linked-trenches/"

    def test_unauthenticated_returns_401(self, api_client, test_project, test_flag):
        address = AddressFactory(project=test_project, flag=test_flag)
        url = self.endpoint.format(uuid=address.uuid)
        response = api_client.get(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_nonexistent_address_returns_404(self, authenticated_client):
        url = self.endpoint.format(uuid="00000000-0000-0000-0000-000000000000")
        response = authenticated_client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_address_with_no_trenches_returns_empty(
        self, authenticated_client, test_project, test_flag
    ):
        address = AddressFactory(project=test_project, flag=test_flag)
        url = self.endpoint.format(uuid=address.uuid)
        response = authenticated_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["type"] == "FeatureCollection"
        assert data["features"] == []

    def test_full_chain_returns_trench_geometry(
        self, authenticated_client, test_project, test_flag
    ):
        address = AddressFactory(
            project=test_project,
            flag=test_flag,
            geom=Point(428530, 5703804, srid=25832),
        )
        node = NodeFactory(
            project=test_project,
            flag=test_flag,
            uuid_address=address,
            geom=Point(428530, 5703804, srid=25832),
        )
        conduit = _create_conduit_without_signal(test_project, test_flag)
        Microduct.objects.create(
            uuid_conduit=conduit,
            uuid_node=node,
            number=1,
            color="rot",
        )
        trench = TrenchFactory(
            project=test_project,
            flag=test_flag,
            geom=LineString((428500, 5703804), (428560, 5703804), srid=25832),
        )
        TrenchConduitConnectionFactory(uuid_trench=trench, uuid_conduit=conduit)

        url = self.endpoint.format(uuid=address.uuid)
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["type"] == "FeatureCollection"
        assert len(data["features"]) == 1

        feature = data["features"][0]
        assert feature["id"] == str(trench.uuid)
        assert feature["properties"]["id_trench"].startswith("TR-")
        assert feature["geometry"]["type"] == "LineString"
        assert len(feature["geometry"]["coordinates"]) >= 2

    def test_multiple_trenches_returned(
        self, authenticated_client, test_project, test_flag
    ):
        address = AddressFactory(project=test_project, flag=test_flag)
        node = NodeFactory(project=test_project, flag=test_flag, uuid_address=address)

        conduit1 = _create_conduit_without_signal(test_project, test_flag)
        conduit2 = _create_conduit_without_signal(test_project, test_flag)

        Microduct.objects.create(
            uuid_conduit=conduit1, uuid_node=node, number=1, color="rot"
        )
        Microduct.objects.create(
            uuid_conduit=conduit2, uuid_node=node, number=1, color="blau"
        )

        trench1 = TrenchFactory(
            project=test_project,
            flag=test_flag,
            geom=LineString((0, 0), (100, 0), srid=25832),
        )
        trench2 = TrenchFactory(
            project=test_project,
            flag=test_flag,
            geom=LineString((100, 0), (200, 0), srid=25832),
        )

        TrenchConduitConnectionFactory(uuid_trench=trench1, uuid_conduit=conduit1)
        TrenchConduitConnectionFactory(uuid_trench=trench2, uuid_conduit=conduit2)

        url = self.endpoint.format(uuid=address.uuid)
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["features"]) == 2
        returned_uuids = {f["id"] for f in data["features"]}
        assert returned_uuids == {str(trench1.uuid), str(trench2.uuid)}

    def test_duplicate_trenches_deduplicated(
        self, authenticated_client, test_project, test_flag
    ):
        address = AddressFactory(project=test_project, flag=test_flag)
        node = NodeFactory(project=test_project, flag=test_flag, uuid_address=address)
        conduit = _create_conduit_without_signal(test_project, test_flag)
        trench = TrenchFactory(
            project=test_project,
            flag=test_flag,
            geom=LineString((0, 0), (100, 0), srid=25832),
        )
        TrenchConduitConnectionFactory(uuid_trench=trench, uuid_conduit=conduit)

        Microduct.objects.create(
            uuid_conduit=conduit, uuid_node=node, number=1, color="rot"
        )
        Microduct.objects.create(
            uuid_conduit=conduit, uuid_node=node, number=2, color="blau"
        )

        url = self.endpoint.format(uuid=address.uuid)
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["features"]) == 1
        assert data["features"][0]["id"] == str(trench.uuid)


class TestAddressLinkedTrenchesRouting:
    """Tests for routing-based trench filtering when a cable exists."""

    endpoint = "/api/v1/address/{uuid}/linked-trenches/"

    def test_with_cable_returns_only_routed_trenches(
        self, authenticated_client, test_project, test_flag
    ):
        """When a cable exists with start/end nodes, only path-relevant trenches are returned.

        Layout:
            Main:    (0,0) --- (50,0) --- (100,0)
            Spur A:  (50,0) --- (50,50)   <- this address
            Spur B:  (50,0) --- (50,-50)  <- other address (should be excluded)

        Cable routes from (0,0) to (50,50): main + spur A only.
        """
        address_a = AddressFactory(
            project=test_project,
            flag=test_flag,
            geom=Point(50, 50, srid=25832),
        )
        node_start = NodeFactory(
            project=test_project,
            flag=test_flag,
            geom=Point(0, 0, srid=25832),
        )
        node_a = NodeFactory(
            project=test_project,
            flag=test_flag,
            uuid_address=address_a,
            geom=Point(50, 50, srid=25832),
        )

        conduit = _create_conduit_without_signal(test_project, test_flag)

        microduct = Microduct.objects.create(
            uuid_conduit=conduit, uuid_node=node_a, number=1, color="rot"
        )

        cable = CableFactory(
            project=test_project,
            flag=test_flag,
            uuid_node_start=node_start,
            uuid_node_end=node_a,
        )
        MicroductCableConnection.objects.create(
            uuid_microduct=microduct, uuid_cable=cable
        )

        trench_main = TrenchFactory(
            project=test_project,
            flag=test_flag,
            geom=LineString((0, 0), (50, 0), (100, 0), srid=25832),
        )
        trench_spur_a = TrenchFactory(
            project=test_project,
            flag=test_flag,
            geom=LineString((50, 0), (50, 50), srid=25832),
        )
        trench_spur_b = TrenchFactory(
            project=test_project,
            flag=test_flag,
            geom=LineString((50, 0), (50, -50), srid=25832),
        )

        TrenchConduitConnectionFactory(uuid_trench=trench_main, uuid_conduit=conduit)
        TrenchConduitConnectionFactory(uuid_trench=trench_spur_a, uuid_conduit=conduit)
        TrenchConduitConnectionFactory(uuid_trench=trench_spur_b, uuid_conduit=conduit)

        url = self.endpoint.format(uuid=address_a.uuid)
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        returned_uuids = {f["id"] for f in data["features"]}
        assert str(trench_main.uuid) in returned_uuids
        assert str(trench_spur_a.uuid) in returned_uuids
        assert str(trench_spur_b.uuid) not in returned_uuids
        assert len(data["features"]) == 2

    def test_without_cable_falls_back_to_all_trenches(
        self, authenticated_client, test_project, test_flag
    ):
        """Without a cable, all conduit-connected trenches are returned (fallback)."""
        address = AddressFactory(project=test_project, flag=test_flag)
        node = NodeFactory(project=test_project, flag=test_flag, uuid_address=address)
        conduit = _create_conduit_without_signal(test_project, test_flag)
        Microduct.objects.create(
            uuid_conduit=conduit, uuid_node=node, number=1, color="rot"
        )

        trench1 = TrenchFactory(
            project=test_project,
            flag=test_flag,
            geom=LineString((0, 0), (50, 0), srid=25832),
        )
        trench2 = TrenchFactory(
            project=test_project,
            flag=test_flag,
            geom=LineString((50, 0), (50, -50), srid=25832),
        )
        TrenchConduitConnectionFactory(uuid_trench=trench1, uuid_conduit=conduit)
        TrenchConduitConnectionFactory(uuid_trench=trench2, uuid_conduit=conduit)

        url = self.endpoint.format(uuid=address.uuid)
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["features"]) == 2

    def test_cable_without_start_end_nodes_falls_back(
        self, authenticated_client, test_project, test_flag
    ):
        """Cable exists but has no start/end nodes — falls back to FK-based approach."""
        address = AddressFactory(project=test_project, flag=test_flag)
        node = NodeFactory(project=test_project, flag=test_flag, uuid_address=address)
        conduit = _create_conduit_without_signal(test_project, test_flag)
        microduct = Microduct.objects.create(
            uuid_conduit=conduit, uuid_node=node, number=1, color="rot"
        )

        cable = CableFactory(project=test_project, flag=test_flag)
        MicroductCableConnection.objects.create(
            uuid_microduct=microduct, uuid_cable=cable
        )

        trench = TrenchFactory(
            project=test_project,
            flag=test_flag,
            geom=LineString((0, 0), (100, 0), srid=25832),
        )
        TrenchConduitConnectionFactory(uuid_trench=trench, uuid_conduit=conduit)

        url = self.endpoint.format(uuid=address.uuid)
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["features"]) == 1

    def test_routing_failure_falls_back(
        self, authenticated_client, test_project, test_flag
    ):
        """Cable with start/end nodes but disconnected trenches — routing fails, falls back."""
        address = AddressFactory(
            project=test_project,
            flag=test_flag,
            geom=Point(500, 500, srid=25832),
        )
        node_start = NodeFactory(
            project=test_project,
            flag=test_flag,
            geom=Point(0, 0, srid=25832),
        )
        node_end = NodeFactory(
            project=test_project,
            flag=test_flag,
            uuid_address=address,
            geom=Point(500, 500, srid=25832),
        )
        conduit = _create_conduit_without_signal(test_project, test_flag)
        microduct = Microduct.objects.create(
            uuid_conduit=conduit, uuid_node=node_end, number=1, color="rot"
        )

        cable = CableFactory(
            project=test_project,
            flag=test_flag,
            uuid_node_start=node_start,
            uuid_node_end=node_end,
        )
        MicroductCableConnection.objects.create(
            uuid_microduct=microduct, uuid_cable=cable
        )

        trench1 = TrenchFactory(
            project=test_project,
            flag=test_flag,
            geom=LineString((0, 0), (100, 0), srid=25832),
        )
        trench2 = TrenchFactory(
            project=test_project,
            flag=test_flag,
            geom=LineString((400, 400), (500, 500), srid=25832),
        )
        TrenchConduitConnectionFactory(uuid_trench=trench1, uuid_conduit=conduit)
        TrenchConduitConnectionFactory(uuid_trench=trench2, uuid_conduit=conduit)

        url = self.endpoint.format(uuid=address.uuid)
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["features"]) == 2
