"""
Tests that API versioning is enforced, not cosmetic.

The `/api/v1/` prefix is wired to DRF ``NamespaceVersioning`` with an
``ALLOWED_VERSIONS`` allow-list. These tests fail if versioning is removed or
downgraded to a bare URL prefix that carries no version awareness.
"""

import pytest
from django.urls import NoReverseMatch, reverse
from rest_framework import status
from rest_framework.test import APIClient


@pytest.fixture
def authenticated_client(user):
    """Return an API client authenticated as the shared test user."""
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_v1_namespace_reverses_to_versioned_path():
    """Router viewnames resolve through the ``v1`` namespace."""
    assert reverse("v1:trench-list") == "/api/v1/trench/"


def test_unknown_version_namespace_does_not_resolve():
    """A version outside ALLOWED_VERSIONS has no registered namespace."""
    with pytest.raises(NoReverseMatch):
        reverse("v2:trench-list")


@pytest.mark.django_db
def test_request_version_is_resolved_to_v1(authenticated_client):
    """DRF resolves ``request.version`` to ``v1`` for a request under /api/v1/.

    The value is read off the DRF request captured on the rendered response's
    renderer context, proving versioning ran rather than merely that the URL
    contained the string ``v1``.
    """
    response = authenticated_client.get("/api/v1/projects/")
    assert response.status_code == status.HTTP_200_OK
    assert response.renderer_context["request"].version == "v1"


@pytest.mark.django_db
def test_request_under_unknown_version_path_is_not_found(authenticated_client):
    """No route exists outside the registered ``v1`` namespace."""
    response = authenticated_client.get("/api/v2/projects/")
    assert response.status_code == status.HTTP_404_NOT_FOUND
