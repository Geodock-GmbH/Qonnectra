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
