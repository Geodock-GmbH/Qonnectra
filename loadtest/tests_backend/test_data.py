"""Tests for the load-test data: seeded networks, users and the timing key.

They run in the backend suite (see the root pytest.ini), so a model change
that breaks the seeder fails in the same change.
"""

import random
import uuid

import pytest
from apps.api.management.commands.warm_wms_cache import lat_lon_to_tile
from apps.api.middleware import server_timing_key
from apps.api.models import (
    Cable,
    Conduit,
    Fiber,
    Microduct,
    NetworkSchemaSettings,
    Node,
    Projects,
    Trench,
    TrenchConduitConnection,
)
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.contrib.gis.geos import LineString, Point
from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone
from qonnectra_loadtest import accounts, seeding
from qonnectra_loadtest.config import timing_key
from rest_framework.test import APIClient
from rest_framework_simplejwt.settings import api_settings as jwt_settings
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
from rest_framework_simplejwt.tokens import AccessToken

REFRESH_URL = "/api/v1/auth/token/refresh/"

User = get_user_model()


@pytest.mark.django_db
class TestAccounts:
    """Tests for creating and purging load-test users."""

    def test_creates_regular_users_in_loadtest_role(self):
        """Verify users are non-superusers and members of the load-test role."""
        payload = accounts.create_users(3)

        usernames = [entry["username"] for entry in payload["users"]]
        assert usernames == ["loadtest_001", "loadtest_002", "loadtest_003"]
        for user in User.objects.filter(username__in=usernames):
            assert not user.is_superuser
            assert not user.has_usable_password()
            assert user.groups.filter(name="loadtest").exists()

    def test_access_token_has_the_login_lifetime(self):
        """Verify the access token expires like a real login's, so sessions must refresh."""
        payload = accounts.create_users(1)

        token = AccessToken(payload["users"][0]["access"])
        remaining = token["exp"] - timezone.now().timestamp()
        lifetime = jwt_settings.ACCESS_TOKEN_LIFETIME.total_seconds()
        assert lifetime - 60 < remaining <= lifetime

    def test_refresh_token_rotates_like_a_login(self):
        """Verify Django's refresh view, behind refreshSession, rotates the minted token once."""
        payload = accounts.create_users(1)
        refresh = payload["users"][0]["refresh"]
        client = APIClient()
        client.cookies["api-refresh-token"] = refresh

        first = client.post(REFRESH_URL)
        rotated = first.cookies["api-refresh-token"].value
        client.cookies["api-refresh-token"] = refresh
        reused = client.post(REFRESH_URL)

        assert first.status_code == 200
        assert first.cookies["api-access-token"].value
        assert rotated not in ("", refresh)
        assert reused.status_code == 401

    def test_token_passes_role_based_permission(self):
        """Verify the token authenticates via cookie on a role-checked endpoint."""
        payload = accounts.create_users(1)
        client = APIClient()
        client.cookies["api-access-token"] = payload["users"][0]["access"]

        response = client.get(reverse("v1:trench-list"))

        assert response.status_code == 200

    def test_rerun_reuses_users(self):
        """Verify running twice does not duplicate users."""
        accounts.create_users(2)
        accounts.create_users(2)

        assert accounts.count_users() == 2

    def test_rerun_keeps_only_the_current_sessions(self):
        """Verify the refresh tokens of an earlier run are dropped."""
        accounts.create_users(2)
        accounts.create_users(2)

        loadtest_tokens = OutstandingToken.objects.filter(
            user__username__startswith="loadtest_"
        )
        assert loadtest_tokens.count() == 2

    def test_purge_removes_users_and_role_only(self):
        """Verify purge deletes load-test users and role but nobody else."""
        other = User.objects.create_user("planner", password="x")
        admin = User.objects.create_superuser("loadtest_999", password="x")
        accounts.sign_in(other)
        accounts.create_users(2)

        assert accounts.purge_users() == 2

        assert accounts.count_users() == 0
        assert not Group.objects.filter(name="loadtest").exists()
        assert User.objects.filter(pk__in=[other.pk, admin.pk]).count() == 2
        assert list(OutstandingToken.objects.values_list("user", flat=True)) == [
            other.pk
        ]


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
        payload = accounts.create_users(1)
        client = APIClient()
        client.cookies["api-access-token"] = payload["users"][0]["access"]

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

    def test_purge_removes_the_history_of_loadtest_projects(self, seeded):
        """Verify history rows from edits and seeding go, those of real projects stay.

        The edit persona writes through the API, so its trench and conduit
        changes leave history rows that would outlive the projects.
        """
        default = Projects.objects.get(project="Default")
        default.save()
        trench = Trench.objects.filter(project=seeded).first()
        trench.comment = "loadtest edit"
        trench.save()
        conduit = Conduit.objects.filter(project=seeded).first()
        edited = conduit.uuid = uuid.uuid4()
        conduit.name = "loadtest-edit"
        conduit._state.adding = True
        conduit.save()
        conduit.delete()
        assert Trench.history.filter(project_id=seeded.pk).exists()
        assert Conduit.history.filter(project_id=seeded.pk).count() == 2
        assert Microduct.history.filter(uuid_conduit_id=edited).exists()
        assert Projects.history.filter(id=seeded.pk).exists()
        default_history = Projects.history.filter(id=default.pk).count()

        seeding.purge(log=lambda _line: None)

        assert not Trench.history.filter(project_id=seeded.pk).exists()
        assert not Conduit.history.filter(project_id=seeded.pk).exists()
        assert not Microduct.history.filter(uuid_conduit_id=edited).exists()
        assert not Projects.history.filter(id=seeded.pk).exists()
        assert Projects.history.filter(id=default.pk).count() == default_history


@pytest.fixture
def seeded_pair(db):
    """Seed two tiny projects: the first with a configured schema, the last without."""
    from io import StringIO

    call_command("load_initial_data", stdout=StringIO())
    seeding.seed(preset="tiny", projects=2, random_seed=5, log=lambda _line: None)
    return (
        Projects.objects.get(project="loadtest-01"),
        Projects.objects.get(project="loadtest-02"),
    )


def node_names(project, **params) -> list[str]:
    """Return the node names of a project's network schema as the app loads them."""
    payload = accounts.create_users(1)
    client = APIClient()
    client.cookies["api-access-token"] = payload["users"][0]["access"]
    response = client.get(
        reverse("v1:node-all-nodes"), {"project": project.pk, **params}
    )
    assert response.status_code == 200
    return [feature["properties"]["name"] for feature in response.data["features"]]


@pytest.mark.django_db
class TestNetworkSchemaSetup:
    """The seeded schema settings mirror the public test server's Testprojekt."""

    def test_configures_the_schema_like_the_test_server(self, seeded_pair):
        """Verify house connections and pipe branches leave the main schema."""
        configured = NetworkSchemaSettings.objects.get(project=seeded_pair[0])

        assert configured.configured
        assert set(
            configured.excluded_node_types.values_list("node_type", flat=True)
        ) == {"Hausanschluss", "Rohrabzweig"}
        assert set(
            configured.child_view_enabled_node_types.values_list("node_type", flat=True)
        ) == {"NVt 48"}

    def test_last_project_keeps_a_fresh_schema(self, seeded_pair):
        """Verify the last project shows every node, like a project nobody set up."""
        fresh = NetworkSchemaSettings.objects.get(project=seeded_pair[1])

        assert not fresh.configured
        assert not fresh.excluded_node_types.exists()
        assert not fresh.child_view_enabled_node_types.exists()

    def test_a_single_project_is_configured(self, seeded):
        """Verify a one-project seed has no unconfigured project to spare."""
        assert NetworkSchemaSettings.objects.get(project=seeded).configured

    def test_house_nodes_hang_under_an_nvt(self, seeded_pair):
        """Verify every house connection names an NVt cabinet as its parent."""
        houses = Node.objects.filter(
            project__in=seeded_pair, node_type__node_type="Hausanschluss"
        )

        assert houses.exists()
        assert not houses.exclude(parent_node__node_type__node_type="NVt 48").exists()

    def test_main_schema_shows_house_nodes_only_when_unconfigured(self, seeded_pair):
        """Verify the configured main schema holds the street nodes alone."""
        configured, fresh = seeded_pair

        configured_names = node_names(configured)
        fresh_names = node_names(fresh)

        assert configured_names
        assert not any(name.startswith("HA ") for name in configured_names)
        assert any(name.startswith("HA ") for name in fresh_names)

    def test_sub_schema_of_an_nvt_lists_its_house_nodes(self, seeded_pair):
        """Verify the child view of a cabinet opens with its house connections."""
        configured = seeded_pair[0]
        cabinet = Node.objects.filter(
            project=configured, node_type__node_type="NVt 48"
        ).first()

        names = node_names(configured, child_view_for=str(cabinet.uuid))

        assert cabinet.name in names
        assert any(name.startswith("HA ") for name in names)


def test_timing_key_matches_the_middleware():
    """Verify the load test sends exactly the key Django's middleware expects."""
    assert timing_key(settings.SECRET_KEY) == server_timing_key(settings.SECRET_KEY)
    assert timing_key("") == server_timing_key("") == ""
