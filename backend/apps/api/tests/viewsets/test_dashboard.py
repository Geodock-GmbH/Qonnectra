"""Tests for the DashboardStatisticsView aggregation endpoint."""

import pytest
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import LineString, Point
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APIClient

from ..factories import (
    AddressFactory,
    AreaFactory,
    ConduitFactory,
    NodeFactory,
    TrenchConduitConnectionFactory,
    TrenchFactory,
)

User = get_user_model()


@pytest.fixture
def api_client():
    """Create API client for testing."""
    return APIClient()


@pytest.fixture(autouse=True)
def clear_dashboard_cache():
    """Clear the cache around each test so cached stats never leak between them."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def authenticated_client(db):
    """Create an authenticated superuser API client."""
    user = User.objects.create_superuser(
        username="dashboard_user",
        email="dashboard@example.com",
        password="testpass123",
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def dashboard_data(db, project, flag):
    """Populate a project with trenches, nodes, addresses, conduits and areas."""
    TrenchFactory(
        project=project,
        flag=flag,
        length=100.0,
        house_connection=True,
        funding_status=True,
        geom=LineString((0, 0), (100, 0), srid=25832),
    )
    TrenchFactory(
        project=project,
        flag=flag,
        length=50.0,
        internal_execution=True,
        geom=LineString((0, 10), (50, 10), srid=25832),
    )

    NodeFactory(project=project, flag=flag, geom=Point(10, 10, srid=25832))
    NodeFactory(project=project, flag=flag, geom=Point(20, 20, srid=25832))

    AddressFactory(project=project, flag=flag, city="Flensburg")
    AddressFactory(project=project, flag=flag, city="Flensburg")
    AddressFactory(project=project, flag=flag, city="Kiel")

    conduit = ConduitFactory(project=project, flag=flag)
    trench = TrenchFactory(
        project=project,
        flag=flag,
        length=25.0,
        geom=LineString((0, 20), (25, 20), srid=25832),
    )
    TrenchConduitConnectionFactory(uuid_trench=trench, uuid_conduit=conduit)

    AreaFactory(project=project, flag=flag)

    return {"project": project, "flag": flag}


@pytest.mark.django_db
class TestDashboardStatisticsView:
    """Tests for the DashboardStatisticsView."""

    def test_requires_project_parameter(self, authenticated_client):
        """A missing project parameter returns a 400 error."""
        response = authenticated_client.get("/api/v1/dashboard/statistics/")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "project" in response.data["error"]

    def test_requires_authentication(self, api_client, project):
        """Anonymous access is rejected."""
        response = api_client.get(
            f"/api/v1/dashboard/statistics/?project={project.id}"
        )
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    def test_returns_all_top_level_sections(self, authenticated_client, dashboard_data):
        """The response contains every expected statistics section."""
        project = dashboard_data["project"]
        response = authenticated_client.get(
            f"/api/v1/dashboard/statistics/?project={project.id}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert set(response.data.keys()) == {
            "trench",
            "node",
            "address",
            "conduit",
            "area",
        }

    def test_trench_totals(self, authenticated_client, dashboard_data):
        """Trench totals reflect the seeded lengths and counts."""
        project = dashboard_data["project"]
        response = authenticated_client.get(
            f"/api/v1/dashboard/statistics/?project={project.id}"
        )
        trench = response.data["trench"]
        assert trench["count"] == 3
        assert trench["total_length"] == 175.0
        assert trench["house_connection_count"] == 1
        assert trench["funding_count"] == 1
        assert trench["internal_execution_count"] == 1

    def test_node_statistics(self, authenticated_client, dashboard_data):
        """Node statistics count the seeded nodes."""
        project = dashboard_data["project"]
        response = authenticated_client.get(
            f"/api/v1/dashboard/statistics/?project={project.id}"
        )
        node = response.data["node"]
        total = sum(row["count"] for row in node["count_by_type"])
        assert total == 2

    def test_address_statistics(self, authenticated_client, dashboard_data):
        """Address statistics total and group by city."""
        project = dashboard_data["project"]
        response = authenticated_client.get(
            f"/api/v1/dashboard/statistics/?project={project.id}"
        )
        address = response.data["address"]
        assert address["total_addresses"] == 3
        cities = {row["city"]: row["count"] for row in address["count_by_city"]}
        assert cities["Flensburg"] == 2
        assert cities["Kiel"] == 1

    def test_area_statistics(self, authenticated_client, dashboard_data):
        """Area statistics count the seeded area."""
        project = dashboard_data["project"]
        response = authenticated_client.get(
            f"/api/v1/dashboard/statistics/?project={project.id}"
        )
        assert response.data["area"]["area_count"] == 1

    def test_flag_filter_narrows_results(self, authenticated_client, project, flag):
        """The optional flag filter restricts the aggregation."""
        from ..factories import FlagFactory

        other_flag = FlagFactory()
        TrenchFactory(
            project=project,
            flag=flag,
            length=100.0,
            geom=LineString((0, 0), (100, 0), srid=25832),
        )
        TrenchFactory(
            project=project,
            flag=other_flag,
            length=200.0,
            geom=LineString((0, 5), (200, 5), srid=25832),
        )

        response = authenticated_client.get(
            f"/api/v1/dashboard/statistics/?project={project.id}&flag={flag.id}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["trench"]["count"] == 1
        assert response.data["trench"]["total_length"] == 100.0

    def test_empty_project_returns_zeroed_stats(self, authenticated_client, project):
        """A project with no features returns zeroed totals, not errors."""
        response = authenticated_client.get(
            f"/api/v1/dashboard/statistics/?project={project.id}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["trench"]["count"] == 0
        assert response.data["trench"]["total_length"] == 0
        assert response.data["area"]["area_count"] == 0

    def test_response_is_cached(self, authenticated_client, dashboard_data):
        """A second request for the same project is served from the cache."""
        project = dashboard_data["project"]
        url = f"/api/v1/dashboard/statistics/?project={project.id}"

        first = authenticated_client.get(url)
        assert first.status_code == status.HTTP_200_OK

        # Adding a trench after the first call must not change the cached response.
        TrenchFactory(
            project=project,
            flag=dashboard_data["flag"],
            length=999.0,
            geom=LineString((0, 30), (999, 30), srid=25832),
        )
        second = authenticated_client.get(url)
        assert second.data["trench"]["total_length"] == first.data["trench"][
            "total_length"
        ]
