"""Tests for the feature-export endpoint.

Cover the ``GET /api/v1/export/features/`` endpoint and the underlying
``export_features`` service: layer selection, project scoping, the response
envelope shape, nested-FK serialization, and merged trench geometry on the
relation-derived cable/conduit layers.
"""

import pytest
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import LineString
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.api.services import (
    SpatialIntersectError,
    conduit_trench_geometry,
    export_features,
)

from .factories import (
    AreaFactory,
    CableFactory,
    CompanyFactory,
    ConduitFactory,
    MicroductCableConnectionFactory,
    MicroductFactory,
    NodeFactory,
    NodeTypeFactory,
    ProjectFactory,
    TrenchConduitConnectionFactory,
    TrenchFactory,
)

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="export_user",
        email="export_user@example.com",
        password="testpass123",
    )


@pytest.fixture
def authenticated_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def url():
    return reverse("v1:export-features")


def _conduit_with_trench(project=None, geom=None):
    """Create a conduit wired to a trench so it has mergeable geometry."""
    conduit = ConduitFactory(project=project) if project else ConduitFactory()
    trench_kwargs = {}
    if project:
        trench_kwargs["project"] = project
    if geom is not None:
        trench_kwargs["geom"] = geom
    trench = TrenchFactory(**trench_kwargs)
    TrenchConduitConnectionFactory(uuid_trench=trench, uuid_conduit=conduit)
    return conduit, trench


def _cable_with_trench(project=None, geom=None):
    """Create a cable wired through microduct → conduit → trench."""
    conduit, trench = _conduit_with_trench(project=project, geom=geom)
    microduct = MicroductFactory(uuid_conduit=conduit)
    cable = CableFactory(project=project) if project else CableFactory()
    MicroductCableConnectionFactory(uuid_microduct=microduct, uuid_cable=cable)
    return cable, conduit, trench


@pytest.mark.django_db
class TestExportFeaturesView:
    """End-to-end tests hitting the endpoint via the DRF client."""

    def test_url_reverses_under_v1_namespace(self, url):
        assert url == "/api/v1/export/features/"

    def test_requires_authentication(self, url):
        response = APIClient().get(url)
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    def test_node_layer_returned_as_feature_collection(
        self, authenticated_client, url
    ):
        node = NodeFactory()

        response = authenticated_client.get(url, {"layers": "node"})

        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert body["srid"] == 25832
        assert body["counts"]["node"] == 1
        assert body["total"] == 1
        fc = body["layers"]["node"]
        assert fc["type"] == "FeatureCollection"
        returned_ids = {f["id"] for f in fc["features"]}
        assert str(node.uuid) in returned_ids

    def test_defaults_to_all_export_layers_when_layers_omitted(
        self, authenticated_client, url
    ):
        NodeFactory()
        AreaFactory()
        # One cable chain, which brings its own single conduit + trench.
        _cable_with_trench()

        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert set(body["layers"].keys()) == {"cable", "conduit", "node", "area"}
        assert body["counts"] == {"cable": 1, "conduit": 1, "node": 1, "area": 1}
        assert body["total"] == 4

    def test_node_type_serialized_as_nested_object(
        self, authenticated_client, url
    ):
        node_type = NodeTypeFactory()
        node = NodeFactory(node_type=node_type)

        response = authenticated_client.get(url, {"layers": "node"})

        feature = next(
            f
            for f in response.json()["layers"]["node"]["features"]
            if f["id"] == str(node.uuid)
        )
        nested = feature["properties"]["node_type"]
        assert nested["id"] == node_type.id
        assert set(nested.keys()) >= {"id", "node_type", "dimension", "group", "company"}

    def test_conduit_owner_serialized_as_nested_company_object(
        self, authenticated_client, url
    ):
        owner = CompanyFactory()
        conduit, _ = _conduit_with_trench()
        conduit.owner = owner
        conduit.save()

        response = authenticated_client.get(url, {"layers": "conduit"})

        feature = response.json()["layers"]["conduit"]["features"][0]
        nested = feature["properties"]["owner"]
        assert nested["id"] == owner.id
        assert nested["company"] == owner.company

    def test_conduit_feature_carries_merged_trench_geometry(
        self, authenticated_client, url
    ):
        line = LineString((0, 0), (50, 0), srid=25832)
        conduit, _ = _conduit_with_trench(geom=line)

        response = authenticated_client.get(url, {"layers": "conduit"})

        feature = response.json()["layers"]["conduit"]["features"][0]
        assert feature["type"] == "Feature"
        geom = feature["geometry"]
        assert geom is not None
        assert geom["type"] == "MultiLineString"
        assert geom["coordinates"][0][0] == [0.0, 0.0]

    def test_cable_feature_carries_merged_trench_geometry(
        self, authenticated_client, url
    ):
        line = LineString((0, 0), (50, 0), srid=25832)
        cable, _, _ = _cable_with_trench(geom=line)

        response = authenticated_client.get(url, {"layers": "cable"})

        feature = response.json()["layers"]["cable"]["features"][0]
        geom = feature["geometry"]
        assert geom is not None
        assert geom["type"] == "MultiLineString"

    def test_project_filter_scopes_results(self, authenticated_client, url):
        project_a = ProjectFactory()
        project_b = ProjectFactory()
        in_scope = NodeFactory(project=project_a)
        NodeFactory(project=project_b)

        response = authenticated_client.get(
            url, {"layers": "node", "project": project_a.id}
        )

        body = response.json()
        assert body["counts"]["node"] == 1
        returned_ids = {f["id"] for f in body["layers"]["node"]["features"]}
        assert returned_ids == {str(in_scope.uuid)}

    def test_exclude_projects_drops_listed_projects(
        self, authenticated_client, url
    ):
        project_a = ProjectFactory()
        project_b = ProjectFactory()
        keep = NodeFactory(project=project_a)
        NodeFactory(project=project_b)

        response = authenticated_client.get(
            url, {"layers": "node", "exclude_projects": f"{project_b.id}"}
        )

        body = response.json()
        assert body["counts"]["node"] == 1
        returned_ids = {f["id"] for f in body["layers"]["node"]["features"]}
        assert returned_ids == {str(keep.uuid)}

    def test_exclude_projects_accepts_comma_separated_list(
        self, authenticated_client, url
    ):
        project_a = ProjectFactory()
        project_b = ProjectFactory()
        project_c = ProjectFactory()
        keep = NodeFactory(project=project_a)
        NodeFactory(project=project_b)
        NodeFactory(project=project_c)

        response = authenticated_client.get(
            url,
            {
                "layers": "node",
                "exclude_projects": f"{project_b.id},{project_c.id}",
            },
        )

        returned_ids = {
            f["id"] for f in response.json()["layers"]["node"]["features"]
        }
        assert returned_ids == {str(keep.uuid)}

    def test_layers_accepts_comma_separated_string(
        self, authenticated_client, url
    ):
        NodeFactory()
        AreaFactory()

        response = authenticated_client.get(url, {"layers": "node,area"})

        body = response.json()
        assert set(body["layers"].keys()) == {"node", "area"}

    def test_unknown_layer_is_bad_request(self, authenticated_client, url):
        response = authenticated_client.get(url, {"layers": "trench"})
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "error" in response.json()

    def test_non_numeric_project_is_bad_request(self, authenticated_client, url):
        response = authenticated_client.get(
            url, {"layers": "node", "project": "abc"}
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "error" in response.json()


@pytest.mark.django_db
class TestExportFeaturesService:
    """Unit tests for the ``export_features`` service function."""

    def test_returns_queryset_per_requested_layer(self):
        NodeFactory()
        AreaFactory()

        result = export_features(layers=["node", "area"])

        assert set(result.keys()) == {"node", "area"}
        assert result["node"].count() == 1
        assert result["area"].count() == 1

    def test_defaults_to_all_export_layers(self):
        result = export_features()
        assert set(result.keys()) == {"cable", "conduit", "node", "area"}

    def test_unknown_layer_raises(self):
        with pytest.raises(SpatialIntersectError):
            export_features(layers=["nope"])

    def test_non_numeric_project_raises(self):
        with pytest.raises(SpatialIntersectError):
            export_features(layers=["node"], project_id="abc")

    def test_project_filter_scopes_results(self):
        project_a = ProjectFactory()
        project_b = ProjectFactory()
        NodeFactory(project=project_a)
        NodeFactory(project=project_b)

        result = export_features(layers=["node"], project_id=project_a.id)

        assert result["node"].count() == 1
        assert result["node"].first().project_id == project_a.id

    def test_exclude_project_ids_drops_features(self):
        project_a = ProjectFactory()
        project_b = ProjectFactory()
        NodeFactory(project=project_a)
        NodeFactory(project=project_b)

        result = export_features(
            layers=["node"], exclude_project_ids=[project_b.id]
        )

        assert result["node"].count() == 1
        assert result["node"].first().project_id == project_a.id

    def test_conduit_geometry_does_not_scale_queries_with_features(
        self, django_assert_max_num_queries
    ):
        """The conduit queryset prefetches trench connections (no per-feature N+1)."""
        for _ in range(5):
            _conduit_with_trench()

        result = export_features(layers=["conduit"])

        # Materialising every conduit's merged geometry must stay within a
        # small, feature-count-independent number of queries thanks to
        # prefetching (list + prefetched connections + trenches).
        with django_assert_max_num_queries(4):
            geoms = [conduit_trench_geometry(c) for c in result["conduit"]]

        assert len(geoms) == 5
        assert all(g is not None for g in geoms)
