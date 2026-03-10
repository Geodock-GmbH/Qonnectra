"""Signal handlers for permission cache invalidation."""

from django.core.cache import cache
from django.db.models.signals import post_save, post_delete, m2m_changed
from django.dispatch import receiver
from django.contrib.auth import get_user_model


User = get_user_model()


def invalidate_all_permission_caches():
    """Clear all user permission caches."""
    # Get all user IDs and clear their caches
    for user_id in User.objects.values_list('id', flat=True):
        cache.delete(f"user_permissions:{user_id}")


@receiver(post_save, sender='api.ModelPermission')
@receiver(post_delete, sender='api.ModelPermission')
def invalidate_on_model_permission_change(sender, **kwargs):
    """Invalidate caches when ModelPermission changes."""
    invalidate_all_permission_caches()


@receiver(post_save, sender='api.RoutePermission')
@receiver(post_delete, sender='api.RoutePermission')
def invalidate_on_route_permission_change(sender, **kwargs):
    """Invalidate caches when RoutePermission changes."""
    invalidate_all_permission_caches()


@receiver(m2m_changed, sender=User.groups.through)
def invalidate_on_user_group_change(sender, instance, **kwargs):
    """Invalidate cache when user's groups change."""
    if isinstance(instance, User):
        cache.delete(f"user_permissions:{instance.id}")
