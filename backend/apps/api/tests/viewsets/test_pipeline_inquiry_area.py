"""Tests for PipelineInquiryArea ViewSet."""

import json

import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from ..factories import PipelineInquiryAreaFactory, PipelineRecordFactory

User = get_user_model()


@pytest.fixture
def api_client():
    """Create an unauthenticated API client."""
    return APIClient()


@pytest.fixture
def authenticated_client(db):
    """Create a superuser-authenticated API client."""
    user = User.objects.create_superuser(
        username="testuser", email="test@example.com", password="testpass123"
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


POLYGON_GEOJSON = {
    "type": "Polygon",
    "coordinates": [[[9.0, 53.0], [9.1, 53.0], [9.1, 53.1], [9.0, 53.1], [9.0, 53.0]]],
}

POLYGON_GEOJSON_ALT = {
    "type": "Polygon",
    "coordinates": [[[9.2, 53.2], [9.3, 53.2], [9.3, 53.3], [9.2, 53.3], [9.2, 53.2]]],
}

LINESTRING_GEOJSON = {
    "type": "LineString",
    "coordinates": [[9.0, 53.0], [9.1, 53.0]],
}


@pytest.mark.django_db
class TestPipelineInquiryAreaViewSet:
    """Tests for the PipelineInquiryArea API endpoint."""

    def test_list_requires_authentication(self, api_client):
        response = api_client.get("/api/v1/pipeline-inquiry-areas/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_filtered_by_pipeline_record(self, authenticated_client):
        record_a = PipelineRecordFactory()
        record_b = PipelineRecordFactory()
        PipelineInquiryAreaFactory.create_batch(2, pipeline_record=record_a)
        PipelineInquiryAreaFactory(pipeline_record=record_b)
        response = authenticated_client.get(
            f"/api/v1/pipeline-inquiry-areas/?pipeline_record={record_a.uuid}"
        )
        assert response.status_code == status.HTTP_200_OK
        features = response.json()["features"]
        assert len(features) == 2

    def test_list_without_filter_returns_all(self, authenticated_client):
        PipelineInquiryAreaFactory.create_batch(3)
        response = authenticated_client.get("/api/v1/pipeline-inquiry-areas/")
        assert response.status_code == status.HTTP_200_OK
        features = response.json()["features"]
        assert len(features) == 3

    def test_create(self, authenticated_client):
        record = PipelineRecordFactory()
        data = {
            "type": "Feature",
            "geometry": POLYGON_GEOJSON,
            "properties": {
                "pipeline_record": str(record.uuid),
                "name": "Test Area",
            },
        }
        response = authenticated_client.post(
            "/api/v1/pipeline-inquiry-areas/",
            data=json.dumps(data),
            content_type="application/json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        props = response.json()["properties"]
        assert props["name"] == "Test Area"
        assert props["pipeline_record_uuid"] == str(record.uuid)

    def test_create_without_name_assigns_default(self, authenticated_client):
        record = PipelineRecordFactory()
        data = {
            "type": "Feature",
            "geometry": POLYGON_GEOJSON,
            "properties": {"pipeline_record": str(record.uuid)},
        }
        response = authenticated_client.post(
            "/api/v1/pipeline-inquiry-areas/",
            data=json.dumps(data),
            content_type="application/json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["properties"]["name"] == "Area 1"

    def test_create_default_name_increments_per_record(self, authenticated_client):
        record = PipelineRecordFactory()

        def create():
            return authenticated_client.post(
                "/api/v1/pipeline-inquiry-areas/",
                data=json.dumps(
                    {
                        "type": "Feature",
                        "geometry": POLYGON_GEOJSON,
                        "properties": {"pipeline_record": str(record.uuid)},
                    }
                ),
                content_type="application/json",
            )

        assert create().json()["properties"]["name"] == "Area 1"
        assert create().json()["properties"]["name"] == "Area 2"
        assert create().json()["properties"]["name"] == "Area 3"

    def test_create_default_name_stable_after_delete(self, authenticated_client):
        """Deleting an earlier area must not cause the next name to collide."""
        record = PipelineRecordFactory()
        first = PipelineInquiryAreaFactory(pipeline_record=record, name="Area 1")
        PipelineInquiryAreaFactory(pipeline_record=record, name="Area 2")
        first.delete()

        response = authenticated_client.post(
            "/api/v1/pipeline-inquiry-areas/",
            data=json.dumps(
                {
                    "type": "Feature",
                    "geometry": POLYGON_GEOJSON,
                    "properties": {"pipeline_record": str(record.uuid)},
                }
            ),
            content_type="application/json",
        )
        assert response.json()["properties"]["name"] == "Area 3"

    def test_create_default_name_scoped_to_record(self, authenticated_client):
        record_a = PipelineRecordFactory()
        record_b = PipelineRecordFactory()
        PipelineInquiryAreaFactory(pipeline_record=record_a, name="Area 1")

        response = authenticated_client.post(
            "/api/v1/pipeline-inquiry-areas/",
            data=json.dumps(
                {
                    "type": "Feature",
                    "geometry": POLYGON_GEOJSON,
                    "properties": {"pipeline_record": str(record_b.uuid)},
                }
            ),
            content_type="application/json",
        )
        assert response.json()["properties"]["name"] == "Area 1"

    def test_create_keeps_provided_name(self, authenticated_client):
        record = PipelineRecordFactory()
        PipelineInquiryAreaFactory(pipeline_record=record, name="Area 1")
        data = {
            "type": "Feature",
            "geometry": POLYGON_GEOJSON,
            "properties": {"pipeline_record": str(record.uuid), "name": "Custom"},
        }
        response = authenticated_client.post(
            "/api/v1/pipeline-inquiry-areas/",
            data=json.dumps(data),
            content_type="application/json",
        )
        assert response.json()["properties"]["name"] == "Custom"

    def test_create_rejects_non_polygon(self, authenticated_client):
        record = PipelineRecordFactory()
        data = {
            "type": "Feature",
            "geometry": LINESTRING_GEOJSON,
            "properties": {
                "pipeline_record": str(record.uuid),
                "name": "Bad Geometry",
            },
        }
        response = authenticated_client.post(
            "/api/v1/pipeline-inquiry-areas/",
            data=json.dumps(data),
            content_type="application/json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_retrieve(self, authenticated_client):
        area = PipelineInquiryAreaFactory()
        response = authenticated_client.get(
            f"/api/v1/pipeline-inquiry-areas/{area.uuid}/"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["properties"]["name"] == area.name

    def test_update_name(self, authenticated_client):
        area = PipelineInquiryAreaFactory(name="Original")
        data = {
            "type": "Feature",
            "geometry": POLYGON_GEOJSON,
            "properties": {"name": "Updated"},
        }
        response = authenticated_client.patch(
            f"/api/v1/pipeline-inquiry-areas/{area.uuid}/",
            data=json.dumps(data),
            content_type="application/json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["properties"]["name"] == "Updated"

    def test_update_geometry(self, authenticated_client):
        area = PipelineInquiryAreaFactory()
        data = {
            "type": "Feature",
            "geometry": POLYGON_GEOJSON_ALT,
            "properties": {},
        }
        response = authenticated_client.patch(
            f"/api/v1/pipeline-inquiry-areas/{area.uuid}/",
            data=json.dumps(data),
            content_type="application/json",
        )
        assert response.status_code == status.HTTP_200_OK
        coords = response.json()["geometry"]["coordinates"][0]
        assert coords[0][0] != 0.0

    def test_delete(self, authenticated_client):
        area = PipelineInquiryAreaFactory()
        response = authenticated_client.delete(
            f"/api/v1/pipeline-inquiry-areas/{area.uuid}/"
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_create_without_pipeline_record_fails(self, authenticated_client):
        data = {
            "type": "Feature",
            "geometry": POLYGON_GEOJSON,
            "properties": {
                "name": "No Record",
            },
        }
        response = authenticated_client.post(
            "/api/v1/pipeline-inquiry-areas/",
            data=json.dumps(data),
            content_type="application/json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
