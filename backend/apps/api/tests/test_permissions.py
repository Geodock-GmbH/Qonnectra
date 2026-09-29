"""Tests for role-based permission system."""

import pytest
from apps.api.models import ModelPermission, RoutePermission
from apps.api.permissions import RoleBasedPermission, get_user_permissions
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient

User = get_user_model()


@pytest.fixture
def admin_group(seed_permission_data):
    """Get the Admin group with all permission data seeded."""
    return seed_permission_data["admin_group"]


@pytest.fixture
def editor_group(seed_permission_data):
    """Get the Editor group with all permission data seeded."""
    return seed_permission_data["editor_group"]


@pytest.fixture
def viewer_group(seed_permission_data):
    """Get the Viewer group with all permission data seeded."""
    return seed_permission_data["viewer_group"]


@pytest.fixture
def admin_user(db, admin_group):
    """Create a user in the Admin group."""
    user = User.objects.create_user(
        username="adminuser",
        email="admin@example.com",
        password="adminpass123",
    )
    user.groups.add(admin_group)
    return user


@pytest.fixture
def editor_user(db, editor_group):
    """Create a user in the Editor group."""
    user = User.objects.create_user(
        username="editoruser",
        email="editor@example.com",
        password="editorpass123",
    )
    user.groups.add(editor_group)
    return user


@pytest.fixture
def viewer_user(db, viewer_group):
    """Create a user in the Viewer group."""
    user = User.objects.create_user(
        username="vieweruser",
        email="viewer@example.com",
        password="viewerpass123",
    )
    user.groups.add(viewer_group)
    return user


@pytest.fixture
def superuser(db):
    """Create a superuser."""
    return User.objects.create_superuser(
        username="superuser",
        email="super@example.com",
        password="superpass123",
    )


@pytest.fixture
def api_client():
    """Create an API client."""
    return APIClient()


class TestModelPermission:
    """Tests for ModelPermission model."""

    def test_model_permission_created_by_migration(self, db, admin_group):
        """Test that model permissions were created by migration."""
        assert ModelPermission.objects.filter(group=admin_group).exists()

        trench_perm = ModelPermission.objects.get(
            group=admin_group, model_name="trench"
        )
        assert trench_perm.access_level == "full"

    def test_editor_has_edit_access(self, db, editor_group):
        """Test that Editor group has edit access to models."""
        trench_perm = ModelPermission.objects.get(
            group=editor_group, model_name="trench"
        )
        assert trench_perm.access_level == "edit"

    def test_viewer_has_view_access(self, db, viewer_group):
        """Test that Viewer group has view access to models."""
        trench_perm = ModelPermission.objects.get(
            group=viewer_group, model_name="trench"
        )
        assert trench_perm.access_level == "view"


class TestRoutePermission:
    """Tests for RoutePermission model."""

    def test_admin_route_permission(self, db, admin_group):
        """Test that Admin group has access to /admin/* routes."""
        perm = RoutePermission.objects.get(group=admin_group, route_pattern="/admin/*")
        assert perm.allowed is True

    def test_editor_route_permission(self, db, editor_group):
        """Test that Editor group does not have access to /admin/* routes."""
        perm = RoutePermission.objects.get(group=editor_group, route_pattern="/admin/*")
        assert perm.allowed is False


class TestGetUserPermissions:
    """Tests for get_user_permissions function."""

    def test_superuser_gets_full_access(self, superuser):
        """Test that superusers get full access to everything."""
        permissions = get_user_permissions(superuser)
        assert permissions["is_superuser"] is True
        assert permissions["models"]["*"] == "full"
        assert permissions["routes"]["*"] is True

    def test_admin_user_permissions(self, admin_user):
        """Test that admin users get their group's permissions."""
        permissions = get_user_permissions(admin_user)
        assert permissions["is_superuser"] is False
        assert permissions["models"]["trench"] == "full"
        assert permissions["routes"]["/admin/*"] is True

    def test_editor_user_permissions(self, editor_user):
        """Test that editor users get their group's permissions."""
        permissions = get_user_permissions(editor_user)
        assert permissions["is_superuser"] is False
        assert permissions["models"]["trench"] == "edit"
        assert permissions["routes"]["/admin/*"] is False

    def test_viewer_user_permissions(self, viewer_user):
        """Test that viewer users get their group's permissions."""
        permissions = get_user_permissions(viewer_user)
        assert permissions["is_superuser"] is False
        assert permissions["models"]["trench"] == "view"


class TestRoleBasedPermissionClass:
    """Tests for RoleBasedPermission DRF permission class."""

    def test_superuser_can_list(self, api_client, superuser):
        """Test that superuser can list resources."""
        api_client.force_authenticate(user=superuser)
        response = api_client.get("/api/v1/trench/")
        assert response.status_code == 200

    def test_viewer_can_list(self, api_client, viewer_user):
        """Test that viewer can list resources."""
        api_client.force_authenticate(user=viewer_user)
        response = api_client.get("/api/v1/trench/")
        assert response.status_code == 200

    def test_viewer_cannot_create(self, api_client, viewer_user, project, flag):
        """Test that viewer cannot create resources."""
        api_client.force_authenticate(user=viewer_user)
        response = api_client.post(
            "/api/v1/trench/",
            {
                "id_trench": "TEST-001",
                "project": project.id,
                "flag": flag.id,
            },
            format="json",
        )
        assert response.status_code == 403

    def test_editor_can_access_post_method(
        self, api_client, editor_user, project, flag
    ):
        """Test that editor has permission to POST (even if data is invalid)."""
        api_client.force_authenticate(user=editor_user)
        response = api_client.post(
            "/api/v1/trench/",
            {
                "id_trench": "TEST-002",
                "project": project.id,
                "flag": flag.id,
            },
            format="json",
        )
        # 400 (Bad Request) means permissions passed but data validation failed
        # 403 would mean permission denied
        assert response.status_code != 403

    def test_admin_can_access_post_method(self, api_client, admin_user, project, flag):
        """Test that admin has permission to POST (even if data is invalid)."""
        api_client.force_authenticate(user=admin_user)
        response = api_client.post(
            "/api/v1/trench/",
            {
                "id_trench": "TEST-003",
                "project": project.id,
                "flag": flag.id,
            },
            format="json",
        )
        # 400 (Bad Request) means permissions passed but data validation failed
        # 403 would mean permission denied
        assert response.status_code != 403


class TestPermissionsEndpoint:
    """Tests for the /api/v1/auth/permissions/ endpoint."""

    def test_unauthenticated_user_cannot_access(self, api_client):
        """Test that unauthenticated users cannot access permissions endpoint."""
        response = api_client.get("/api/v1/auth/permissions/")
        assert response.status_code == 401

    def test_returns_user_permissions(self, api_client, editor_user):
        """Test that endpoint returns user's permissions."""
        api_client.force_authenticate(user=editor_user)
        response = api_client.get("/api/v1/auth/permissions/")

        assert response.status_code == 200
        data = response.json()
        assert "models" in data
        assert "routes" in data
        assert "is_superuser" in data
        assert data["is_superuser"] is False
        assert data["models"]["trench"] == "edit"


class TestMultiGroupPermissions:
    """Tests for permission aggregation across multiple groups."""

    @pytest.fixture(autouse=True)
    def clear_perm_cache(self):
        """Clear the permission cache before each test."""
        cache.clear()
        yield
        cache.clear()

    def test_viewer_and_editor_gets_edit(self, db, viewer_group, editor_group):
        """Verify user in Viewer + Editor groups gets 'edit' (highest wins)."""
        user = User.objects.create_user(
            username="multi_ve",
            email="ve@example.com",
            password="pass",
        )
        user.groups.add(viewer_group, editor_group)

        permissions = get_user_permissions(user)
        assert permissions["models"]["trench"] == "edit"

    def test_viewer_and_admin_gets_full(self, db, viewer_group, admin_group):
        """Verify user in Viewer + Admin groups gets 'full' (highest wins)."""
        user = User.objects.create_user(
            username="multi_va",
            email="va@example.com",
            password="pass",
        )
        user.groups.add(viewer_group, admin_group)

        permissions = get_user_permissions(user)
        assert permissions["models"]["trench"] == "full"

    def test_route_true_wins_over_false(self, db, viewer_group, admin_group):
        """Verify True wins for route permissions across groups."""
        user = User.objects.create_user(
            username="multi_route",
            email="route@example.com",
            password="pass",
        )
        user.groups.add(viewer_group, admin_group)

        permissions = get_user_permissions(user)
        assert permissions["routes"]["/admin/*"] is True

    def test_permission_cache_populated_and_reused(self, db, editor_group):
        """Verify permissions are cached after first access."""
        user = User.objects.create_user(
            username="cache_test",
            email="cache@example.com",
            password="pass",
        )
        user.groups.add(editor_group)

        cache_key = f"user_permissions:{user.pk}"
        assert cache.get(cache_key) is None

        perm = RoleBasedPermission()
        level = perm._get_access_level(user, "trench")
        assert level == "edit"

        cached = cache.get(cache_key)
        assert cached is not None
        assert cached["trench"] == "edit"


def _user_with_rows(username, *roles):
    """Create a user holding one fresh group per role, each with the given model rows.

    Args:
        username: Username of the new user.
        *roles: One ``{model_name: access_level}`` dict per group.

    Returns:
        User: The user, member of every created group.
    """
    from django.contrib.auth.models import Group

    user = User.objects.create_user(username=username, password="pass")
    for index, rows in enumerate(roles):
        group = Group.objects.create(name=f"{username}-role-{index}")
        for model_name, access_level in rows.items():
            ModelPermission.objects.create(
                group=group, model_name=model_name, access_level=access_level
            )
        user.groups.add(group)
    return user


@pytest.mark.django_db
class TestWildcardModelPermission:
    """A ``*`` row applies to every model without its own row."""

    @pytest.fixture(autouse=True)
    def clear_perm_cache(self):
        """Clear the permission cache around each test."""
        cache.clear()
        yield
        cache.clear()

    def test_wildcard_grants_models_without_own_row(self, api_client):
        """The API honours ``*`` like the frontend does."""
        user = _user_with_rows("wild_view", {"*": "view"})
        api_client.force_authenticate(user=user)

        assert api_client.get("/api/v1/trench/").status_code == 200
        assert get_user_permissions(user)["models"]["*"] == "view"

    def test_own_row_overrides_wildcard_within_a_role(self, api_client):
        """``*: full`` with ``cable: none`` in one role means no cable access."""
        user = _user_with_rows("wild_except", {"*": "full", "cable": "none"})
        api_client.force_authenticate(user=user)

        assert api_client.get("/api/v1/cable/").status_code == 403
        assert api_client.get("/api/v1/trench/").status_code == 200
        assert get_user_permissions(user)["models"]["cable"] == "none"

    def test_wildcard_of_another_role_still_wins_when_higher(self):
        """Across roles the highest level wins, wildcards included."""
        user = _user_with_rows("wild_multi", {"*": "view"}, {"cable": "none"})

        assert get_user_permissions(user)["models"]["cable"] == "view"
        assert RoleBasedPermission()._get_access_level(user, "cable") == "view"


@pytest.mark.django_db
class TestUnassignedUser:
    """A user without any role may open no page."""

    def test_user_without_group_is_denied_every_route(self):
        """The frontend sends such a user to the no-access notice."""
        user = User.objects.create_user(username="no_role", password="pass")

        permissions = get_user_permissions(user)

        assert permissions["routes"] == {"/*": False}
        assert permissions["models"] == {}


@pytest.mark.django_db
class TestSideDoorEndpoints:
    """Write endpoints outside the model viewsets check the same model permission."""

    @pytest.fixture(autouse=True)
    def clear_perm_cache(self):
        """Clear the permission cache around each test."""
        cache.clear()
        yield
        cache.clear()

    def test_viewer_cannot_import_conduits(self, api_client, viewer_user):
        """The Excel import creates conduits, so it needs conduit edit."""
        api_client.force_authenticate(user=viewer_user)

        assert api_client.post("/api/v1/import/conduit/").status_code == 403

    def test_editor_may_start_conduit_import(self, api_client, editor_user):
        """An editor passes the permission check (then fails on the missing file)."""
        api_client.force_authenticate(user=editor_user)

        assert api_client.post("/api/v1/import/conduit/").status_code != 403

    def test_viewer_cannot_link_cable_to_micropipe(self, api_client, viewer_user):
        """Creating cable to microduct links needs edit."""
        api_client.force_authenticate(user=viewer_user)
        url = (
            "/api/v1/cables/00000000-0000-0000-0000-000000000000/micropipe-connections/"
        )

        assert api_client.post(url, {}, format="json").status_code == 403

    def test_viewer_cannot_auto_link_cable(self, api_client, viewer_user):
        """Auto-linking creates cable to microduct links, so it needs edit."""
        api_client.force_authenticate(user=viewer_user)
        url = "/api/v1/cables/00000000-0000-0000-0000-000000000000/auto-link-micropipe/"

        assert api_client.post(url, {}, format="json").status_code == 403

    def test_editor_cannot_delete_cable_micropipe_links(self, api_client, editor_user):
        """Deleting cable to microduct links needs full access."""
        api_client.force_authenticate(user=editor_user)
        url = (
            "/api/v1/cables/00000000-0000-0000-0000-000000000000/micropipe-connections/"
        )

        assert api_client.delete(url, {}, format="json").status_code == 403

    def test_editor_cannot_clear_a_port(self, api_client, editor_user):
        """``clear_port`` deletes a splice through a POST, so it needs full access."""
        api_client.force_authenticate(user=editor_user)

        response = api_client.post(
            "/api/v1/fiber-splice/clear-port/", {}, format="json"
        )

        assert response.status_code == 403

    def test_admin_may_clear_a_port(self, api_client, admin_user):
        """Full access passes the check (then fails on the empty payload)."""
        api_client.force_authenticate(user=admin_user)

        response = api_client.post(
            "/api/v1/fiber-splice/clear-port/", {}, format="json"
        )

        assert response.status_code != 403

    def test_viewer_may_scan_wms_capabilities(self, api_client, viewer_user):
        """Scanning only reads, so view access is enough despite the POST."""
        api_client.force_authenticate(user=viewer_user)
        url = "/api/v1/wms-sources/00000000-0000-0000-0000-000000000000/scan_capabilities/"

        assert api_client.post(url).status_code == 404


@pytest.mark.django_db
class TestSeedMissingModelPermissions:
    """Migration 0078 grants the seeded roles the models 0058 missed."""

    def test_seeds_levels_without_overwriting_manual_rows(self):
        """Missing rows get the role's level; a row set by hand keeps its level."""
        import importlib

        from django.apps import apps as django_apps
        from django.contrib.auth.models import Group

        migration = importlib.import_module(
            "apps.api.migrations.0078_seed_missing_model_permissions"
        )
        editor, _ = Group.objects.get_or_create(name="Editor")
        viewer, _ = Group.objects.get_or_create(name="Viewer")
        ModelPermission.objects.filter(group__in=[editor, viewer]).delete()
        ModelPermission.objects.create(
            group=viewer, model_name="wmssource", access_level="none"
        )

        migration.seed_missing_model_permissions(django_apps, None)

        levels = dict(
            ModelPermission.objects.filter(group=editor).values_list(
                "model_name", "access_level"
            )
        )
        assert levels == {
            "nodeslotclipnumber": "edit",
            "nodeslotdivider": "edit",
            "nodetrenchselection": "edit",
            "wmssource": "edit",
        }
        assert (
            ModelPermission.objects.get(
                group=viewer, model_name="wmssource"
            ).access_level
            == "none"
        )


@pytest.mark.django_db
class TestPermissionAdminForms:
    """The admin rejects permission rows that could never take effect."""

    def test_model_permission_rejects_unknown_model(self):
        """A misspelt model name is a validation error, not a silent no-op."""
        from apps.api.admin import ModelPermissionForm
        from django.contrib.auth.models import Group

        group = Group.objects.create(name="Form Role")
        form = ModelPermissionForm(
            data={"group": group.pk, "model_name": "trenchh", "access_level": "view"}
        )

        assert not form.is_valid()
        assert "model_name" in form.errors

    @pytest.mark.parametrize("model_name", ["trench", "*", "wmssource", "logentry"])
    def test_model_permission_accepts_real_models_and_wildcard(self, model_name):
        """Real model names, including ones seeded today, and ``*`` are valid."""
        from apps.api.admin import ModelPermissionForm
        from django.contrib.auth.models import Group

        group = Group.objects.create(name=f"Form Role {model_name}")
        form = ModelPermissionForm(
            data={"group": group.pk, "model_name": model_name, "access_level": "view"}
        )

        assert form.is_valid(), form.errors

    @pytest.mark.parametrize(
        "pattern,valid",
        [
            ("/valuation", True),
            ("/network-schema/node", True),
            ("/admin/*", True),
            ("/*", True),
            ("valuation", False),
            ("/Valuation", False),
            ("/admin*", False),
            ("*", False),
        ],
    )
    def test_route_permission_validates_pattern(self, pattern, valid):
        """Only lowercase page keys and ``/*`` patterns are accepted."""
        from apps.api.admin import RoutePermissionForm
        from django.contrib.auth.models import Group

        group = Group.objects.create(name=f"Route Role {pattern}")
        form = RoutePermissionForm(
            data={"group": group.pk, "route_pattern": pattern, "allowed": True}
        )

        assert form.is_valid() is valid, form.errors


def _inline_management(prefix, total):
    """Return the management form fields an admin inline formset expects.

    Args:
        prefix: The inline formset prefix (the related name).
        total: Number of inline forms submitted.

    Returns:
        dict[str, int]: TOTAL/INITIAL/MIN/MAX form counts.
    """
    return {
        f"{prefix}-TOTAL_FORMS": total,
        f"{prefix}-INITIAL_FORMS": 0,
        f"{prefix}-MIN_NUM_FORMS": 0,
        f"{prefix}-MAX_NUM_FORMS": 1000,
    }


@pytest.mark.django_db
class TestRoleAdmin:
    """The group admin edits permission rows inline and can copy a role."""

    @pytest.fixture
    def superuser_client(self, client, superuser):
        """Return a Django test client logged in as a superuser.

        pytest-django's ``superuser_client`` would log in this module's
        ``admin_user``, who is an Admin-group member but no superuser.
        """
        client.force_login(superuser)
        return client

    def test_new_role_copies_permissions_of_the_chosen_role(
        self, superuser_client, editor_group
    ):
        """All rows are copied, and a row entered on the form wins over the copy."""
        from django.contrib.auth.models import Group

        response = superuser_client.post(
            "/admin/auth/group/add/",
            {
                "name": "Editor without cables",
                "copy_permissions_from": editor_group.pk,
                **_inline_management("model_permissions", 1),
                "model_permissions-0-model_name": "cable",
                "model_permissions-0-access_level": "none",
                **_inline_management("route_permissions", 0),
            },
        )

        assert response.status_code == 302, response.content
        role = Group.objects.get(name="Editor without cables")
        copied = dict(
            ModelPermission.objects.filter(group=role).values_list(
                "model_name", "access_level"
            )
        )
        editor = dict(
            ModelPermission.objects.filter(group=editor_group).values_list(
                "model_name", "access_level"
            )
        )
        assert copied == {**editor, "cable": "none"}
        assert set(
            RoutePermission.objects.filter(group=role).values_list(
                "route_pattern", "allowed"
            )
        ) == set(
            RoutePermission.objects.filter(group=editor_group).values_list(
                "route_pattern", "allowed"
            )
        )

    def test_new_role_without_copy_starts_empty(self, superuser_client, editor_group):
        """Leaving the copy option empty creates a role with only the entered rows."""
        from django.contrib.auth.models import Group

        response = superuser_client.post(
            "/admin/auth/group/add/",
            {
                "name": "Fresh role",
                **_inline_management("model_permissions", 1),
                "model_permissions-0-model_name": "*",
                "model_permissions-0-access_level": "view",
                **_inline_management("route_permissions", 0),
            },
        )

        assert response.status_code == 302, response.content
        role = Group.objects.get(name="Fresh role")
        assert list(
            ModelPermission.objects.filter(group=role).values_list(
                "model_name", "access_level"
            )
        ) == [("*", "view")]
        assert not RoutePermission.objects.filter(group=role).exists()

    def test_role_page_shows_its_permission_rows(self, superuser_client, editor_group):
        """The change page lists the role's rows and offers no copy option."""
        response = superuser_client.get(f"/admin/auth/group/{editor_group.pk}/change/")

        assert response.status_code == 200
        content = response.content.decode()
        assert "model_permissions-TOTAL_FORMS" in content
        assert "route_permissions-TOTAL_FORMS" in content
        assert "copy_permissions_from" not in content

    def test_add_page_offers_the_copy_option(self, superuser_client):
        """Creating a role offers to start from an existing one."""
        response = superuser_client.get("/admin/auth/group/add/")

        assert response.status_code == 200
        assert "copy_permissions_from" in response.content.decode()
