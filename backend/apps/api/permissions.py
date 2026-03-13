"""Role-based permission classes for API access control.

Provide DRF permission classes that check :model:`api.ModelPermission`
and helper functions for retrieving effective user permissions.
"""

from django.core.cache import cache
from rest_framework.permissions import BasePermission


class RoleBasedPermission(BasePermission):
    """Check :model:`api.ModelPermission` for role-based access control.

    Access levels:
    - none: No access (403)
    - view: GET, HEAD, OPTIONS
    - edit: GET, HEAD, OPTIONS, POST, PUT, PATCH
    - full: All methods including DELETE

    Superusers bypass all checks.
    Users with no group get 'none' access by default.
    """

    ACCESS_LEVELS = {
        "none": [],
        "view": ["GET", "HEAD", "OPTIONS"],
        "edit": ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH"],
        "full": ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"],
    }

    def has_permission(self, request, view):
        """Check if the request method is allowed for the user's access level.

        Args:
            request: DRF request object.
            view: The DRF view being accessed.

        Returns:
            bool: True if the user has permission for the requested method.
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
        allowed_methods = self.ACCESS_LEVELS.get(access_level, [])

        return request.method in allowed_methods

    def _get_model_name(self, view):
        """Extract lowercase model name from a ViewSet or view.

        Args:
            view: DRF view, typically a ModelViewSet with a queryset.

        Returns:
            str | None: Lowercase model name, or None if not determinable.
        """
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
        """Return the highest access level for a user on a model, with caching.

        Args:
            user: Django User instance.
            model_name: Lowercase model name to check permissions for.

        Returns:
            str: Access level string ('none', 'view', 'edit', or 'full').
        """
        cache_key = f"user_permissions:{user.pk}"
        permissions = cache.get(cache_key)

        if permissions is None:
            permissions = self._load_permissions(user)
            cache.set(cache_key, permissions, timeout=300)

        return permissions.get(model_name, "none")

    def _load_permissions(self, user):
        """Load all :model:`api.ModelPermission` entries for a user's groups.

        When a user belongs to multiple groups, the highest access level
        wins for each model.

        Args:
            user: Django User instance.

        Returns:
            dict[str, str]: Mapping of model name to highest access level.
        """
        from .models import ModelPermission

        group_ids = list(user.groups.values_list("id", flat=True))
        if not group_ids:
            return {}

        perms = ModelPermission.objects.filter(group_id__in=group_ids)

        result = {}
        level_order = ["none", "view", "edit", "full"]

        for perm in perms:
            current = result.get(perm.model_name, "none")
            if level_order.index(perm.access_level) > level_order.index(current):
                result[perm.model_name] = perm.access_level

        return result


def get_user_permissions(user):
    """Return effective permissions for a user across models and routes.

    Aggregate :model:`api.ModelPermission` and :model:`api.RoutePermission`
    entries from all groups the user belongs to. Highest access level wins
    for models; True wins over False for routes.

    Args:
        user: Django User instance.

    Returns:
        dict: Contains 'models' (dict[str, str]), 'routes' (dict[str, bool]),
            and 'is_superuser' (bool). Superusers get wildcard full access.
    """
    from .models import ModelPermission, RoutePermission

    if user.is_superuser:
        return {
            "models": {"*": "full"},
            "routes": {"*": True},
            "is_superuser": True,
        }

    group_ids = list(user.groups.values_list("id", flat=True))
    if not group_ids:
        return {
            "models": {},
            "routes": {},
            "is_superuser": False,
        }

    model_perms = ModelPermission.objects.filter(group_id__in=group_ids)
    models = {}
    level_order = ["none", "view", "edit", "full"]

    for perm in model_perms:
        current = models.get(perm.model_name, "none")
        if level_order.index(perm.access_level) > level_order.index(current):
            models[perm.model_name] = perm.access_level

    route_perms = RoutePermission.objects.filter(group_id__in=group_ids)
    routes = {}

    for perm in route_perms:
        if perm.allowed:
            routes[perm.route_pattern] = True
        elif perm.route_pattern not in routes:
            routes[perm.route_pattern] = False

    return {
        "models": models,
        "routes": routes,
        "is_superuser": False,
    }


def invalidate_user_permission_cache(user_id=None):
    """Invalidate permission cache for a specific user or prepare for bulk invalidation.

    Args:
        user_id: User primary key to clear cache for. If None, no-op
            (bulk invalidation is handled by signals clearing specific caches).
    """
    if user_id:
        cache.delete(f"user_permissions:{user_id}")
    else:
        # Bulk invalidation is handled by signals clearing specific user caches
        pass
