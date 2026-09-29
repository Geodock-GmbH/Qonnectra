"""Role-based permission classes for API access control.

Provide DRF permission classes that check :model:`api.ModelPermission`
and helper functions for retrieving effective user permissions.
"""

from collections import defaultdict

from django.core.cache import cache
from rest_framework.permissions import BasePermission


LEVEL_ORDER = ["none", "view", "edit", "full"]

WILDCARD = "*"


def resolve_model_levels(user):
    """Return the effective access level per model name for a user's roles.

    Within one role a model's own :model:`api.ModelPermission` row overrides
    that role's ``*`` row; across roles the highest level wins.

    Args:
        user: Django User instance.

    Returns:
        dict[str, str]: A level for every model named by any of the user's
            roles, plus a ``*`` entry that applies to every other model.
    """
    from .models import ModelPermission

    per_role = defaultdict(dict)
    rows = ModelPermission.objects.filter(group__user=user).values_list(
        "group_id", "model_name", "access_level"
    )
    for group_id, model_name, access_level in rows:
        per_role[group_id][model_name] = access_level

    names = {name for levels in per_role.values() for name in levels} | {WILDCARD}
    return {
        name: max(
            (
                levels.get(name, levels.get(WILDCARD, "none"))
                for levels in per_role.values()
            ),
            key=LEVEL_ORDER.index,
            default="none",
        )
        for name in names
    }


class RoleBasedPermission(BasePermission):
    """Check :model:`api.ModelPermission` for role-based access control.

    Access levels:
    - none: No access (403)
    - view: GET, HEAD, OPTIONS
    - edit: GET, HEAD, OPTIONS, POST, PUT, PATCH
    - full: All methods including DELETE

    The model comes from the view's queryset, or from ``permission_model`` on
    views without one. A view can require a different level for an action whose
    HTTP method misstates what it does through ``action_access_levels``, e.g. a
    POST that deletes (``full``) or a POST that only reads (``view``).

    Superusers bypass all checks.
    Users with no group get 'none' access by default.
    """

    ACCESS_LEVELS = {
        "none": [],
        "view": ["GET", "HEAD", "OPTIONS"],
        "edit": ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH"],
        "full": ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"],
    }

    def has_permission(self, request, view) -> bool:  # pyright: ignore[reportIncompatibleMethodOverride]
        """Check if the request is allowed for the user's access level.

        Args:
            request: DRF request object.
            view: The DRF view being accessed.

        Returns:
            bool: True if the user has permission for the requested method,
                or for the level the view requires for this action.
        """
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        model_name = self._get_model_name(view)
        if not model_name:
            return True

        access_level = self._get_access_level(user, model_name)
        required = getattr(view, "action_access_levels", {}).get(
            getattr(view, "action", None)
        )
        if required:
            return LEVEL_ORDER.index(access_level) >= LEVEL_ORDER.index(required)

        return request.method in self.ACCESS_LEVELS.get(access_level, [])

    def _get_model_name(self, view):
        """Extract lowercase model name from a ViewSet or view.

        Args:
            view: DRF view: a ModelViewSet with a queryset, or a view that
                names its model in ``permission_model``.

        Returns:
            str | None: Lowercase model name, or None if not determinable.
        """
        if getattr(view, "permission_model", None):
            return view.permission_model
        if hasattr(view, "queryset") and view.queryset is not None:
            return view.queryset.model._meta.model_name
        if hasattr(view, "get_queryset"):
            try:
                queryset = view.get_queryset()
                if queryset is not None:
                    return queryset.model._meta.model_name
            except Exception:
                pass
        return None

    def _get_access_level(self, user, model_name):
        """Return the effective access level for a user on a model, with caching.

        Args:
            user: Django User instance.
            model_name: Lowercase model name to check permissions for.

        Returns:
            str: Access level string ('none', 'view', 'edit', or 'full').
        """
        cache_key = f"user_permissions:{user.pk}"
        levels = cache.get(cache_key)

        if levels is None:
            levels = resolve_model_levels(user)
            cache.set(cache_key, levels, timeout=300)

        return levels.get(model_name, levels.get(WILDCARD, "none"))


def get_user_permissions(user):
    """Return effective permissions for a user across models and routes.

    Aggregate :model:`api.ModelPermission` and :model:`api.RoutePermission`
    entries from all groups the user belongs to (see
    ``resolve_model_levels`` for models; True wins over False for routes).
    A user without any group may open no page at all.

    Args:
        user: Django User instance.

    Returns:
        dict: Contains 'models' (dict[str, str]), 'routes' (dict[str, bool]),
            and 'is_superuser' (bool). Superusers get wildcard full access.
    """
    from .models import RoutePermission

    if user.is_superuser:
        return {
            "models": {WILDCARD: "full"},
            "routes": {WILDCARD: True},
            "is_superuser": True,
        }

    group_ids = list(user.groups.values_list("id", flat=True))
    if not group_ids:
        return {
            "models": {},
            "routes": {"/*": False},
            "is_superuser": False,
        }

    route_perms = RoutePermission.objects.filter(group_id__in=group_ids)
    routes = {}

    for perm in route_perms:
        if perm.allowed:
            routes[perm.route_pattern] = True
        elif perm.route_pattern not in routes:
            routes[perm.route_pattern] = False

    return {
        "models": resolve_model_levels(user),
        "routes": routes,
        "is_superuser": False,
    }
