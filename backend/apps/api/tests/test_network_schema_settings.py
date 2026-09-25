"""Tests for how network schema settings reach the API and the admin."""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from apps.api.models import NetworkSchemaSettings, PipeBranchSettings

from .factories import NodeFactory, ProjectFactory

User = get_user_model()


@pytest.fixture
def superuser(db):
    """Create a superuser who may use the API and the admin."""
    return User.objects.create_superuser(
        username="schema_settings_admin",
        email="schema_settings_admin@example.com",
        password="testpass123",
    )


@pytest.fixture
def api_client(superuser):
    """Return an API client authenticated as the superuser."""
    client = APIClient()
    client.force_authenticate(user=superuser)
    return client


def _settings_configured(api_client, project):
    """Return the ``settings_configured`` metadata of the project's nodes."""
    response = api_client.get(f"/api/v1/node/all/?project={project.id}")
    assert response.status_code == 200
    return response.json()["metadata"]["settings_configured"]


@pytest.mark.django_db
class TestSettingsConfiguredMetadata:
    """The schema warning follows the admin's ``configured`` tick, not the row."""

    def test_settings_created_by_the_first_node_are_not_configured(self, api_client):
        project = ProjectFactory()
        NodeFactory(project=project)

        assert _settings_configured(api_client, project) is False

    def test_ticked_settings_are_configured(self, api_client):
        project = ProjectFactory()
        NodeFactory(project=project)
        NetworkSchemaSettings.objects.filter(project=project).update(configured=True)

        assert _settings_configured(api_client, project) is True


def _admin_form_html(client, url):
    """Return the rendered HTML of an admin page."""
    response = client.get(url)
    assert response.status_code == 200
    return response.content.decode()


@pytest.mark.django_db
class TestCanvasFieldsInAdmin:
    """The canvas center is never editable, the scale only before placement."""

    @pytest.fixture(autouse=True)
    def _login(self, client, superuser):
        """Log the superuser into the admin."""
        client.force_login(superuser)

    def test_scale_is_editable_while_no_node_is_placed(self, client):
        settings = NetworkSchemaSettings.objects.create(project=ProjectFactory())

        html = _admin_form_html(
            client,
            reverse("admin:api_networkschemasettings_change", args=[settings.pk]),
        )

        assert 'name="canvas_scale"' in html
        assert 'name="canvas_center_x"' not in html

    def test_scale_is_locked_once_a_node_is_placed(self, client):
        project = ProjectFactory()
        NodeFactory(project=project)

        html = _admin_form_html(
            client, reverse("admin:api_networkschemasettings_change", args=[project.pk])
        )

        assert 'name="canvas_scale"' not in html
        assert 'name="configured"' in html

    def test_project_inline_locks_the_scale_once_a_node_is_placed(self, client):
        project = ProjectFactory()
        NodeFactory(project=project)

        html = _admin_form_html(
            client, reverse("admin:api_projects_change", args=[project.pk])
        )

        assert 'name="network_schema_settings-0-canvas_scale"' not in html
        assert 'name="network_schema_settings-0-configured"' in html

    def test_project_inline_offers_the_scale_before_placement(self, client):
        project = ProjectFactory()

        html = _admin_form_html(
            client, reverse("admin:api_projects_change", args=[project.pk])
        )

        assert 'name="network_schema_settings-0-canvas_scale"' in html
        assert 'name="network_schema_settings-0-canvas_center_x"' not in html

    def test_project_list_flags_settings_that_are_not_ticked(self, client):
        project = ProjectFactory()
        NodeFactory(project=project)
        PipeBranchSettings.objects.create(project=project)

        html = _admin_form_html(client, reverse("admin:api_projects_changelist"))
        assert "⚠" in html

        NetworkSchemaSettings.objects.filter(project=project).update(configured=True)
        html = _admin_form_html(client, reverse("admin:api_projects_changelist"))
        assert "⚠" not in html
