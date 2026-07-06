"""Tests for PipelineRecord and TypeOfWork ViewSets."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from ..factories import (
    PipelineRecordFactory,
    ProjectFactory,
    RequestReasonFactory,
    TypeOfWorkFactory,
)

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def authenticated_client(db):
    user = User.objects.create_superuser(
        username="testuser", email="test@example.com", password="testpass123"
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestTypeOfWorkViewSet:
    """Tests for the TypeOfWork API endpoint."""

    def test_list_requires_authentication(self, api_client):
        response = api_client.get("/api/v1/type-of-work/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_type_of_work(self, authenticated_client):
        TypeOfWorkFactory.create_batch(3)
        response = authenticated_client.get("/api/v1/type-of-work/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 3

    def test_read_only(self, authenticated_client):
        response = authenticated_client.post(
            "/api/v1/type-of-work/", data={"name": "Test"}, format="json"
        )
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED


@pytest.mark.django_db
class TestRequestReasonViewSet:
    """Tests for the RequestReason API endpoint."""

    def test_list_requires_authentication(self, api_client):
        response = api_client.get("/api/v1/request-reasons/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_request_reasons(self, authenticated_client):
        RequestReasonFactory.create_batch(3)
        response = authenticated_client.get("/api/v1/request-reasons/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 3

    def test_read_only(self, authenticated_client):
        response = authenticated_client.post(
            "/api/v1/request-reasons/", data={"name": "Test"}, format="json"
        )
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED


@pytest.mark.django_db
class TestPipelineRecordViewSet:
    """Tests for the PipelineRecord API endpoint."""

    def test_list_requires_authentication(self, api_client):
        response = api_client.get("/api/v1/pipeline-records/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_returns_paginated_response(self, authenticated_client):
        PipelineRecordFactory.create_batch(3)
        response = authenticated_client.get("/api/v1/pipeline-records/")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "results" in data
        assert "count" in data
        assert "page" in data
        assert "page_size" in data
        assert "total_pages" in data
        assert data["count"] == 3
        assert len(data["results"]) == 3

    def test_list_pagination(self, authenticated_client):
        PipelineRecordFactory.create_batch(5)
        response = authenticated_client.get(
            "/api/v1/pipeline-records/?page=1&page_size=2"
        )
        data = response.json()
        assert data["count"] == 5
        assert len(data["results"]) == 2
        assert data["page"] == 1
        assert data["page_size"] == 2
        assert data["total_pages"] == 3

    def test_list_search_by_organisation(self, authenticated_client):
        PipelineRecordFactory(organisation="Deutsche Telekom")
        PipelineRecordFactory(organisation="Vodafone")
        response = authenticated_client.get(
            "/api/v1/pipeline-records/?search=Telekom"
        )
        data = response.json()
        assert data["count"] == 1

    def test_list_search_by_project_name(self, authenticated_client):
        project = ProjectFactory(project="Hamburg Nord")
        PipelineRecordFactory(project=project)
        PipelineRecordFactory()
        response = authenticated_client.get(
            "/api/v1/pipeline-records/?search=Hamburg"
        )
        data = response.json()
        assert data["count"] == 1

    def test_list_search_by_type_of_work(self, authenticated_client):
        tow = TypeOfWorkFactory(name="Neubau")
        PipelineRecordFactory(type_of_work=tow)
        PipelineRecordFactory()
        response = authenticated_client.get(
            "/api/v1/pipeline-records/?search=Neubau"
        )
        data = response.json()
        assert data["count"] == 1

    def test_list_search_by_contact_name(self, authenticated_client):
        PipelineRecordFactory(name="Max Mustermann")
        PipelineRecordFactory(name="Erika Musterfrau")
        response = authenticated_client.get(
            "/api/v1/pipeline-records/?search=Mustermann"
        )
        data = response.json()
        assert data["count"] == 1

    def test_list_search_by_request_reason(self, authenticated_client):
        reason = RequestReasonFactory(name="Bauanfrage")
        PipelineRecordFactory(request_reason=reason)
        PipelineRecordFactory()
        response = authenticated_client.get(
            "/api/v1/pipeline-records/?search=Bauanfrage"
        )
        data = response.json()
        assert data["count"] == 1

    def test_list_response_contains_expected_fields(self, authenticated_client):
        project = ProjectFactory(project="Test Project")
        tow = TypeOfWorkFactory(name="Neubau")
        reason = RequestReasonFactory(name="Planauskunft")
        PipelineRecordFactory(
            project=project,
            type_of_work=tow,
            request_reason=reason,
            organisation="Test Org",
            name="Test Person",
            tel="0123456789",
            mobile="0171234567",
        )
        response = authenticated_client.get("/api/v1/pipeline-records/")
        record = response.json()["results"][0]
        assert "uuid" in record
        assert record["project_name"] == "Test Project"
        assert record["type_of_work"] == "Neubau"
        assert record["request_reason"] == "Planauskunft"
        assert record["organisation"] == "Test Org"
        assert record["name"] == "Test Person"
        assert record["tel"] == "0123456789"
        assert record["mobile"] == "0171234567"
        assert "created_at" in record
        assert "modified_at" in record
        assert "building_measure" not in record

    def test_create_pipeline_record(self, authenticated_client):
        project = ProjectFactory()
        tow = TypeOfWorkFactory()
        reason = RequestReasonFactory(name="Bauanfrage")
        data = {
            "project": project.id,
            "type_of_work_value": tow.id,
            "request_reason_value": reason.id,
            "organisation": "ACME Corp",
            "name": "John Doe",
            "tel": "0123456789",
            "mobile": "0171234567",
        }
        response = authenticated_client.post(
            "/api/v1/pipeline-records/", data=data, format="json"
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["project_name"] == project.project
        assert response.data["request_reason"] == "Bauanfrage"

    def test_retrieve_pipeline_record(self, authenticated_client):
        record = PipelineRecordFactory()
        response = authenticated_client.get(
            f"/api/v1/pipeline-records/{record.uuid}/"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["uuid"] == str(record.uuid)

    def test_update_pipeline_record(self, authenticated_client):
        record = PipelineRecordFactory()
        response = authenticated_client.patch(
            f"/api/v1/pipeline-records/{record.uuid}/",
            data={"organisation": "Updated Org"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["organisation"] == "Updated Org"

    def test_delete_pipeline_record(self, authenticated_client):
        record = PipelineRecordFactory()
        response = authenticated_client.delete(
            f"/api/v1/pipeline-records/{record.uuid}/"
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_list_not_scoped_to_project(self, authenticated_client):
        project1 = ProjectFactory(project="Project A")
        project2 = ProjectFactory(project="Project B")
        PipelineRecordFactory(project=project1)
        PipelineRecordFactory(project=project2)
        response = authenticated_client.get("/api/v1/pipeline-records/")
        data = response.json()
        assert data["count"] == 2

    def test_page_size_capped_at_200(self, authenticated_client):
        PipelineRecordFactory.create_batch(3)
        response = authenticated_client.get(
            "/api/v1/pipeline-records/?page_size=500"
        )
        data = response.json()
        assert data["page_size"] == 200

    def test_invalid_page_params_default_gracefully(self, authenticated_client):
        PipelineRecordFactory.create_batch(3)
        response = authenticated_client.get(
            "/api/v1/pipeline-records/?page=abc&page_size=xyz"
        )
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 50
