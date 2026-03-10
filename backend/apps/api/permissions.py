"""Role-based permission classes for API access control."""

from django.core.cache import cache
from rest_framework.permissions import BasePermission


class RoleBasedPermission(BasePermission):
    """
    Permission class that checks ModelPermission table.

    Access levels:
    - none: No access (403)
    - view: GET, HEAD, OPTIONS
    - edit: GET, HEAD, OPTIONS, POST, PUT, PATCH
    - full: All methods including DELETE

    Superusers bypass all checks.
    Users with no group get 'none' access by default.
    """

    ACCESS_LEVELS = {
        'none': [],
        'view': ['GET', 'HEAD', 'OPTIONS'],
        'edit': ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH'],
        'full': ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'],
    }

    def has_permission(self, request, view):
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
        """Extract lowercase model name from ViewSet."""
        if hasattr(view, 'queryset') and view.queryset is not None:
            return view.queryset.model._meta.model_name
        if hasattr(view, 'get_queryset'):
            try:
                queryset = view.get_queryset()
                if queryset is not None:
                    return queryset.model._meta.model_name
            except Exception:
                pass
        return None

    def _get_access_level(self, user, model_name):
        """Get highest access level from user's groups with caching."""
        cache_key = f"user_permissions:{user.pk}"
        permissions = cache.get(cache_key)

        if permissions is None:
            permissions = self._load_permissions(user)
            cache.set(cache_key, permissions, timeout=300)

        return permissions.get(model_name, 'none')

    def _load_permissions(self, user):
        """Load all model permissions for user's groups."""
        from .models import ModelPermission

        group_ids = list(user.groups.values_list('id', flat=True))
        if not group_ids:
            return {}

        perms = ModelPermission.objects.filter(group_id__in=group_ids)

        result = {}
        level_order = ['none', 'view', 'edit', 'full']

        for perm in perms:
            current = result.get(perm.model_name, 'none')
            if level_order.index(perm.access_level) > level_order.index(current):
                result[perm.model_name] = perm.access_level

        return result


def get_user_permissions(user):
    """
    Get effective permissions for a user.
    Returns dict with 'models' and 'routes' keys.
    """
    from .models import ModelPermission, RoutePermission

    if user.is_superuser:
        return {
            'models': {'*': 'full'},
            'routes': {'*': True},
            'is_superuser': True,
        }

    group_ids = list(user.groups.values_list('id', flat=True))
    if not group_ids:
        return {
            'models': {},
            'routes': {},
            'is_superuser': False,
        }

    # Get model permissions (highest wins)
    model_perms = ModelPermission.objects.filter(group_id__in=group_ids)
    models = {}
    level_order = ['none', 'view', 'edit', 'full']

    for perm in model_perms:
        current = models.get(perm.model_name, 'none')
        if level_order.index(perm.access_level) > level_order.index(current):
            models[perm.model_name] = perm.access_level

    # Get route permissions (True wins over False)
    route_perms = RoutePermission.objects.filter(group_id__in=group_ids)
    routes = {}

    for perm in route_perms:
        current = routes.get(perm.route_pattern, False)
        if perm.allowed:
            routes[perm.route_pattern] = True
        elif perm.route_pattern not in routes:
            routes[perm.route_pattern] = False

    return {
        'models': models,
        'routes': routes,
        'is_superuser': False,
    }


def invalidate_user_permission_cache(user_id=None):
    """Invalidate permission cache for a user or all users."""
    if user_id:
        cache.delete(f"user_permissions:{user_id}")
    else:
        # Clear all permission caches - in production consider using cache.delete_pattern
        # For now, this is handled by the signal clearing specific caches
        pass
