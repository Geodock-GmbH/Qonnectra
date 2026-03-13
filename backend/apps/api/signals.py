"""Signal handlers for permission cache invalidation.

Listens to changes on :model:`api.ModelPermission`,
:model:`api.RoutePermission`, and user-group M2M relations to keep
the per-user permission cache in sync.
"""

from django.core.cache import cache
from django.db.models.signals import post_save, post_delete, m2m_changed
from django.dispatch import receiver
from django.contrib.auth import get_user_model


User = get_user_model()


def invalidate_all_permission_caches():
    """Delete the cached permission set for every user."""
    for user_id in User.objects.values_list("id", flat=True):
        cache.delete(f"user_permissions:{user_id}")


@receiver(post_save, sender="api.ModelPermission")
@receiver(post_delete, sender="api.ModelPermission")
def invalidate_on_model_permission_change(sender, **kwargs):
    """Invalidate all permission caches when a :model:`api.ModelPermission` is saved or deleted.

    Args:
        sender: The model class that sent the signal.
        **kwargs: Signal keyword arguments (including ``instance``).
    """
    invalidate_all_permission_caches()


@receiver(post_save, sender="api.RoutePermission")
@receiver(post_delete, sender="api.RoutePermission")
def invalidate_on_route_permission_change(sender, **kwargs):
    """Invalidate all permission caches when a :model:`api.RoutePermission` is saved or deleted.

    Args:
        sender: The model class that sent the signal.
        **kwargs: Signal keyword arguments (including ``instance``).
    """
    invalidate_all_permission_caches()


@receiver(m2m_changed, sender=User.groups.through)
def invalidate_on_user_group_change(sender, instance, **kwargs):
    """Invalidate the permission cache for a user whose group membership changed.

    Args:
        sender: The intermediary M2M model class.
        instance: The User instance whose groups changed.
        **kwargs: Signal keyword arguments.
    """
    if isinstance(instance, User):
        cache.delete(f"user_permissions:{instance.id}")
