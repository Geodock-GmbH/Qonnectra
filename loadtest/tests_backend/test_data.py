"""Tests for the load-test data: seeded networks, users and the timing key.

They run in the backend suite (see the root pytest.ini), so a model change
that breaks the seeder fails in the same change.
"""

import random

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.contrib.gis.geos import LineString, Point
from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.api.management.commands.warm_wms_cache import lat_lon_to_tile
from apps.api.middleware import server_timing_key
from apps.api.models import (
    Cable,
    Conduit,
    Fiber,
    Microduct,
    Node,
    Projects,
    Trench,
    TrenchConduitConnection,
)
from qonnectra_loadtest import accounts, seeding
from qonnectra_loadtest.config import timing_key

User = get_user_model()


@pytest.mark.django_db
class TestAccounts:
    """Tests for creating and purging load-test users."""

    def test_creates_regular_users_in_loadtest_role(self):
        """Verify users are non-superusers and members of the load-test role."""
        payload = accounts.create_users(3, hours=3)

        usernames = [entry["username"] for entry in payload["users"]]
        assert usernames == ["loadtest_001", "loadtest_002", "loadtest_003"]
        for user in User.objects.filter(username__in=usernames):
            assert not user.is_superuser
            assert not user.has_usable_password()
            assert user.groups.filter(name="loadtest").exists()

    def test_token_outlives_default_lifetime(self):
        """Verify the minted token expires after the requested hours."""
        payload = accounts.create_users(1, hours=3)

        token = AccessToken(payload["users"][0]["token"])
        remaining = token["exp"] - timezone.now().timestamp()
        assert 2.9 * 3600 < remaining <= 3 * 3600

    def test_token_passes_role_based_permission(self):
        """Verify the token authenticates via cookie on a role-checked endpoint."""
        payload = accounts.create_users(1, hours=1)
        client = APIClient()
        client.cookies["api-access-token"] = payload["users"][0]["token"]

        response = client.get(reverse("v1:trench-list"))

        assert response.status_code == 200

    def test_rerun_reuses_users(self):
        """Verify running twice does not duplicate users."""
        accounts.create_users(2, hours=1)
        accounts.create_users(2, hours=1)

        assert accounts.count_users() == 2

    def test_purge_removes_users_and_role_only(self):
        """Verify purge deletes load-test users and role but nobody else."""
        other = User.objects.create_user("planner", password="x")
        admin = User.objects.create_superuser("loadtest_999", password="x")
        accounts.create_users(2, hours=1)

        assert accounts.purge_users() == 2

        assert accounts.count_users() == 0
        assert not Group.objects.filter(name="loadtest").exists()
        assert User.objects.filter(pk__in=[other.pk, admin.pk]).count() == 2


class TestStreetGrid:
    """Tests for the pure grid planning of the seeder."""

    def test_grid_size_matches_requested_length(self):
        """Verify the planned block edges add up to roughly the requested km."""
        size = seeding.grid_size_for_km(50)
        km = 2 * size * (size - 1) * seeding.BLOCK_SPACING_M / 1000

        assert 50 <= km < 60

    def test_same_seed_gives_same_grid(self):
        """Verify the plan is reproducible from its seed."""
        first = seeding.build_street_grid(random.Random(3), (0, 0), 4, 4)
        second = seeding.build_street_grid(random.Random(3), (0, 0), 4, 4)

        assert first.intersections == second.intersections
        assert [s.coords for s in first.streets] == [s.coords for s in second.streets]

    def test_streets_are_valid_simple_lines(self):
        """Verify every street passes the trench geometry validation trigger rules."""
        grid = seeding.build_street_grid(random.Random(1), (0, 0), 5, 6)

        assert len(grid.streets) == 2 * 5 * 4
        for street in grid.streets:
            line = LineString(street.coords)
            assert line.valid and line.simple
            assert len(street.houses) == 6


@pytest.fixture
def seeded(db):
    """Load the default lookups and seed one tiny load-test project."""
    from io import StringIO

    call_command("load_initial_data", stdout=StringIO())
    seeding.seed(preset="tiny", projects=1, random_seed=5, log=lambda _line: None)
    return Projects.objects.get(project="loadtest-01")


@pytest.mark.django_db
class TestSeeding:
    """Tests for seeding against the database."""

    def test_seeds_consistent_network(self, seeded):
        """Verify trenches, conduits, microducts and fibers are linked up."""
        trenches = Trench.objects.filter(project=seeded)
        assert trenches.filter(house_connection=False).count() > 0
        assert trenches.filter(house_connection=True).count() > 0
        assert not trenches.filter(length__lte=0).exists()
        assert (
            TrenchConduitConnection.objects.filter(uuid_trench__project=seeded).count()
            == trenches.count()
        )

        for conduit in Conduit.objects.filter(project=seeded)[:5]:
            expected = conduit.conduit_type.conduit_count
            assert Microduct.objects.filter(uuid_conduit=conduit).count() == expected

        cables = Cable.objects.filter(project=seeded)
        assert cables.exists()
        assert not cables.filter(uuid_node_start__isnull=True).exists()
        assert Fiber.objects.filter(project=seeded).count() == 144 * cables.count()
        assert Node.objects.filter(project=seeded, uuid_address__isnull=False).exists()

    def test_trench_tile_serves_seeded_data(self, seeded):
        """Verify the seeded trenches come back from the trench MVT endpoint."""
        center = Trench.objects.filter(project=seeded).first().geom.centroid
        wgs84 = Point(center.x, center.y, srid=25832).transform(4326, clone=True)
        x, y = lat_lon_to_tile(wgs84.y, wgs84.x, 16)
        payload = accounts.create_users(1, hours=1)
        client = APIClient()
        client.cookies["api-access-token"] = payload["users"][0]["token"]

        response = client.get(
            reverse("v1:ol_trench_tiles", kwargs={"z": 16, "x": x, "y": y}),
            {"project": seeded.pk},
        )

        assert response.status_code == 200
        assert len(response.content) > 0

    def test_status_lists_seeded_projects(self, seeded):
        """Verify the dashboard overview counts the seeded features."""
        [overview] = seeding.seeded_projects()

        assert overview["name"] == "loadtest-01"
        assert overview["trenches"] == Trench.objects.filter(project=seeded).count()
        assert overview["addresses"] > 0
        assert overview["nodes"] > 0

    def test_refuses_to_seed_twice(self, seeded):
        """Verify a second seed run fails instead of duplicating projects."""
        with pytest.raises(seeding.SeedError):
            seeding.seed(preset="tiny", log=lambda _line: None)

    def test_purge_removes_only_loadtest_data(self, seeded):
        """Verify purge deletes the projects and their rows without history."""
        history_before = Trench.history.count()

        assert seeding.purge(log=lambda _line: None) == ["loadtest-01"]

        assert not Projects.objects.filter(project__startswith="loadtest-").exists()
        assert not Trench.objects.filter(project_id=seeded.pk).exists()
        assert not Node.objects.filter(project_id=seeded.pk).exists()
        assert Projects.objects.filter(project="Default").exists()
        assert Trench.history.count() == history_before


def test_timing_key_matches_the_middleware():
    """Verify the load test sends exactly the key Django's middleware expects."""
    assert timing_key(settings.SECRET_KEY) == server_timing_key(settings.SECRET_KEY)
    assert timing_key("") == server_timing_key("") == ""
