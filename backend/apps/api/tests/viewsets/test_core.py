"""Tests for core ViewSets: Projects, Flags, LogEntry, FeatureFiles."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from ..factories import (
    FlagFactory,
    ProjectFactory,
    TrenchFactory,
)

User = get_user_model()


@pytest.fixture
def api_client():
    """Create API client for testing."""
    return APIClient()


@pytest.fixture
def authenticated_client(db):
    """Create an authenticated API client."""
    user = User.objects.create_superuser(
        username="testuser",
        email="test@example.com",
        password="testpass123",
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestProjectsViewSet:
    """Tests for the ProjectsViewSet."""

    def test_list_projects_requires_authentication(self, api_client):
        """Test that listing projects requires authentication."""
        response = api_client.get("/api/v1/projects/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_projects(self, authenticated_client):
        """Test listing all projects."""
        ProjectFactory.create_batch(3)

        response = authenticated_client.get("/api/v1/projects/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 3

    def test_retrieve_project(self, authenticated_client):
        """Test retrieving a single project."""
        project = ProjectFactory(project="Test Project", description="Test description")

        response = authenticated_client.get(f"/api/v1/projects/{project.id}/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["project"] == "Test Project"
        assert response.data["description"] == "Test description"


@pytest.mark.django_db
class TestFlagsViewSet:
    """Tests for the FlagsViewSet."""

    def test_list_flags_requires_authentication(self, api_client):
        """Test that listing flags requires authentication."""
        response = api_client.get("/api/v1/flags/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_flags(self, authenticated_client):
        """Test listing all flags."""
        FlagFactory.create_batch(3)

        response = authenticated_client.get("/api/v1/flags/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 3


@pytest.mark.django_db
class TestLogEntryViewSet:
    """Tests for the LogEntryViewSet."""

    def test_list_logs_requires_authentication(self, api_client):
        """Test that listing logs requires authentication."""
        response = api_client.get("/api/v1/logs/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_logs(self, authenticated_client):
        """Test listing log entries."""
        response = authenticated_client.get("/api/v1/logs/")
        assert response.status_code == status.HTTP_200_OK

    def test_logs_are_read_only(self, authenticated_client):
        """Test that logs cannot be created via API."""
        data = {"level": "INFO", "message": "Test"}
        response = authenticated_client.post("/api/v1/logs/", data=data, format="json")
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED


@pytest.mark.django_db
class TestFeatureFilesViewSet:
    """Tests for the FeatureFilesViewSet."""

    def test_list_feature_files_requires_authentication(self, api_client):
        """Test that listing feature files requires authentication."""
        response = api_client.get("/api/v1/feature-files/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_feature_files(self, authenticated_client):
        """Test listing feature files."""
        response = authenticated_client.get("/api/v1/feature-files/")
        assert response.status_code == status.HTTP_200_OK

    def test_filter_by_content_type(self, authenticated_client):
        """Test filtering feature files by content type."""
        from django.contrib.contenttypes.models import ContentType

        ct = ContentType.objects.get(app_label="api", model="trench")
        response = authenticated_client.get(
            f"/api/v1/feature-files/?content_type={ct.id}"
        )
        assert response.status_code == status.HTTP_200_OK

    def test_filter_by_object_id(self, authenticated_client):
        """Test filtering feature files by object ID."""
        trench = TrenchFactory()
        response = authenticated_client.get(
            f"/api/v1/feature-files/?object_id={trench.uuid}"
        )
        assert response.status_code == status.HTTP_200_OK
