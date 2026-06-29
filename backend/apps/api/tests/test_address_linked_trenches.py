import uuid
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import LineString, Point
from rest_framework import status
from rest_framework.test import APIClient

from apps.api.models import Conduit, Microduct

from .factories import (
    AddressFactory,
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
    """Create a conduit bypassing the post_save microduct auto-creation signal."""
    conduit_type = ConduitTypeFactory()
    return Conduit.objects.create(
        name=f"Conduit-{conduit_type.pk}",
        conduit_type=conduit_type,
        project=project,
        flag=flag,
    )


def _make_trace_result(cables):
    """Build a minimal trace_address return dict.

    Args:
        cables: dict mapping cable_id (str) to a GeoJSON geometry dict
            (in EPSG:25832) or ``None``.
    """
    infra = {}
    for cable_id, geojson in cables.items():
        infra[cable_id] = {"merged_geometry": geojson}
    return {
        "entry_point": {},
        "trace_trees": [],
        "cable_infrastructure": infra,
        "statistics": {},
    }


TRACE_PATH = "apps.api.views.trace_address"


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

    @patch(TRACE_PATH, return_value=None)
    def test_address_with_no_trenches_returns_empty(
        self, mock_trace, authenticated_client, test_project, test_flag
    ):
        address = AddressFactory(project=test_project, flag=test_flag)
        url = self.endpoint.format(uuid=address.uuid)
        response = authenticated_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["type"] == "FeatureCollection"
        assert data["features"] == []


class TestAddressLinkedTrenchesTrace:
    """Tests for trace_address-based cable geometry path."""

    endpoint = "/api/v1/address/{uuid}/linked-trenches/"

    def test_trace_returns_cable_features_in_epsg_3857(
        self, authenticated_client, test_project, test_flag
    ):
        """Trace with merged geometry produces features keyed by cable ID in EPSG:3857."""
        address = AddressFactory(
            project=test_project,
            flag=test_flag,
            geom=Point(428530, 5703804, srid=25832),
        )
        cable_id = str(uuid.uuid4())
        geojson_25832 = {
            "type": "LineString",
            "coordinates": [[428500, 5703804], [428560, 5703804]],
        }
        trace = _make_trace_result({cable_id: geojson_25832})

        with patch(TRACE_PATH, return_value=trace):
            url = self.endpoint.format(uuid=address.uuid)
            response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["type"] == "FeatureCollection"
        assert len(data["features"]) == 1

        feature = data["features"][0]
        assert feature["id"] == cable_id
        assert feature["properties"]["id_cable"] == cable_id
        assert feature["geometry"]["type"] == "LineString"
        coords = feature["geometry"]["coordinates"]
        assert len(coords) >= 2
        # EPSG:3857 x-coords are in the millions range (Web Mercator meters)
        assert all(abs(c[0]) > 100_000 for c in coords)

    def test_trace_multiple_cables(
        self, authenticated_client, test_project, test_flag
    ):
        """Multiple cables in trace each produce a separate feature."""
        address = AddressFactory(project=test_project, flag=test_flag)
        cable_a = str(uuid.uuid4())
        cable_b = str(uuid.uuid4())
        geojson_a = {
            "type": "LineString",
            "coordinates": [[428500, 5703804], [428560, 5703804]],
        }
        geojson_b = {
            "type": "LineString",
            "coordinates": [[428560, 5703804], [428620, 5703804]],
        }
        trace = _make_trace_result({cable_a: geojson_a, cable_b: geojson_b})

        with patch(TRACE_PATH, return_value=trace):
            url = self.endpoint.format(uuid=address.uuid)
            response = authenticated_client.get(url)

        data = response.json()
        assert len(data["features"]) == 2
        returned_ids = {f["id"] for f in data["features"]}
        assert returned_ids == {cable_a, cable_b}

    def test_trace_skips_cable_with_no_merged_geometry(
        self, authenticated_client, test_project, test_flag
    ):
        """Cables without merged_geometry are excluded from features."""
        address = AddressFactory(project=test_project, flag=test_flag)
        cable_with = str(uuid.uuid4())
        cable_without = str(uuid.uuid4())
        geojson = {
            "type": "LineString",
            "coordinates": [[428500, 5703804], [428560, 5703804]],
        }
        trace = _make_trace_result({cable_with: geojson, cable_without: None})

        with patch(TRACE_PATH, return_value=trace):
            url = self.endpoint.format(uuid=address.uuid)
            response = authenticated_client.get(url)

        data = response.json()
        assert len(data["features"]) == 1
        assert data["features"][0]["id"] == cable_with

    def test_trace_calls_with_correct_args(
        self, authenticated_client, test_project, test_flag
    ):
        """trace_address is called with the address PK and correct kwargs."""
        address = AddressFactory(project=test_project, flag=test_flag)
        trace = _make_trace_result({})

        with patch(TRACE_PATH, return_value=trace) as mock_trace:
            url = self.endpoint.format(uuid=address.uuid)
            authenticated_client.get(url)

        mock_trace.assert_called_once_with(
            str(address.pk),
            include_geometry=True,
            geometry_mode="routed",
            orient_geometry=False,
        )


class TestAddressLinkedTrenchesFallback:
    """Tests for FK-based fallback when trace returns no features."""

    endpoint = "/api/v1/address/{uuid}/linked-trenches/"

    @patch(TRACE_PATH, return_value=None)
    def test_trace_none_falls_back_to_fk_trenches(
        self, mock_trace, authenticated_client, test_project, test_flag
    ):
        """When trace_address returns None, fallback queries trench FK chain."""
        address = AddressFactory(project=test_project, flag=test_flag)
        node = NodeFactory(project=test_project, flag=test_flag, uuid_address=address)
        conduit = _create_conduit_without_signal(test_project, test_flag)
        Microduct.objects.create(
            uuid_conduit=conduit, uuid_node=node, number=1, color="rot"
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
        assert len(data["features"]) == 1
        feature = data["features"][0]
        assert feature["id"] == str(trench.uuid)
        trench.refresh_from_db()
        assert feature["properties"]["id_trench"] == trench.id_trench

    def test_trace_exception_falls_back_to_fk_trenches(
        self, authenticated_client, test_project, test_flag
    ):
        """When trace_address raises, fallback queries trench FK chain."""
        address = AddressFactory(project=test_project, flag=test_flag)
        node = NodeFactory(project=test_project, flag=test_flag, uuid_address=address)
        conduit = _create_conduit_without_signal(test_project, test_flag)
        Microduct.objects.create(
            uuid_conduit=conduit, uuid_node=node, number=1, color="rot"
        )
        trench = TrenchFactory(
            project=test_project,
            flag=test_flag,
            geom=LineString((428500, 5703804), (428560, 5703804), srid=25832),
        )
        TrenchConduitConnectionFactory(uuid_trench=trench, uuid_conduit=conduit)

        with patch(TRACE_PATH, side_effect=Exception("trace boom")):
            url = self.endpoint.format(uuid=address.uuid)
            response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["features"]) == 1
        assert data["features"][0]["id"] == str(trench.uuid)

    def test_trace_empty_infrastructure_falls_back(
        self, authenticated_client, test_project, test_flag
    ):
        """Trace returns successfully but with no cable_infrastructure — fallback activates."""
        address = AddressFactory(project=test_project, flag=test_flag)
        node = NodeFactory(project=test_project, flag=test_flag, uuid_address=address)
        conduit = _create_conduit_without_signal(test_project, test_flag)
        Microduct.objects.create(
            uuid_conduit=conduit, uuid_node=node, number=1, color="rot"
        )
        trench = TrenchFactory(
            project=test_project,
            flag=test_flag,
            geom=LineString((428500, 5703804), (428560, 5703804), srid=25832),
        )
        TrenchConduitConnectionFactory(uuid_trench=trench, uuid_conduit=conduit)

        trace = _make_trace_result({})
        with patch(TRACE_PATH, return_value=trace):
            url = self.endpoint.format(uuid=address.uuid)
            response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["features"]) == 1
        trench.refresh_from_db()
        assert data["features"][0]["properties"]["id_trench"] == trench.id_trench
