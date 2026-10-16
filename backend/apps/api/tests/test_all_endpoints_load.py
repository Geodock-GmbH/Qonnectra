"""Tests for the query cost of the node list endpoints.

Node lists must not issue extra queries per node: each node's address nests
its own project, flag and development status.
"""

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework import status
from rest_framework.test import APIClient

from .factories import (
    AddressFactory,
    NodeFactory,
    ProjectFactory,
    StatusDevelopmentFactory,
)

User = get_user_model()


@pytest.fixture
def authenticated_client(db):
    """Create an authenticated superuser API client."""
    user = User.objects.create_superuser(
        username="load_user",
        email="load_user@example.com",
        password="testpass123",
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _seed_nodes(project, count):
    """Create nodes that each have a parent and an address with its own relations.

    Every address gets its own project, flag and development status, so a
    lookup per row would show up as extra queries.

    Args:
        project: :model:`api.Projects` the nodes belong to.
        count: Number of addressed child nodes to create.
    """
    parent = NodeFactory(project=project)
    for _ in range(count):
        address = AddressFactory(status_development=StatusDevelopmentFactory())
        NodeFactory(project=project, uuid_address=address, parent_node=parent)


def _query_count(client, url):
    """Return how many queries one GET to ``url`` runs, asserting it succeeds.

    Args:
        client: Authenticated API client.
        url: Endpoint URL including query params.

    Returns:
        int: Number of SQL queries the request executed.
    """
    with CaptureQueriesContext(connection) as queries:
        response = client.get(url)
    assert response.status_code == status.HTTP_200_OK
    return len(queries)


@pytest.mark.django_db
class TestNodeListQueryCount:
    """Node lists load each node's nested relations in the same query."""

    @pytest.mark.parametrize(
        "url",
        [
            "/api/v1/node/all/?project={project}",
            "/api/v1/node/all/?project={project}&search=Node&include_excluded=true",
            "/api/v1/node/?project={project}",
        ],
    )
    def test_query_count_does_not_grow_with_nodes(self, authenticated_client, url):
        """Eight addressed nodes cost as many queries as two."""
        small = ProjectFactory()
        large = ProjectFactory()
        _seed_nodes(small, 2)
        _seed_nodes(large, 8)

        few = _query_count(authenticated_client, url.format(project=small.id))
        many = _query_count(authenticated_client, url.format(project=large.id))

        assert many == few
