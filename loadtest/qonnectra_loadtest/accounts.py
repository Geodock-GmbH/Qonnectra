"""Load-test users with long-lived access tokens, one per virtual user.

Logging in through the API is throttled (5/min), so the tokens are minted
directly. The users are regular (non-superuser) members of a dedicated role,
so every request walks the real permission path. Needs Django set up.
"""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db import transaction
from django.utils import timezone
from rest_framework_simplejwt.tokens import AccessToken

from apps.api.models import ModelPermission, RoutePermission

LOADTEST_GROUP = "loadtest"
USER_PREFIX = "loadtest"


def ensure_loadtest_group() -> Group:
    """Return the load-test role, creating it with full access if missing.

    Returns:
        Group: Role with a ``*`` model permission of ``full`` and access to
            every frontend route.
    """
    group, _ = Group.objects.get_or_create(name=LOADTEST_GROUP)
    ModelPermission.objects.update_or_create(
        group=group, model_name="*", defaults={"access_level": "full"}
    )
    RoutePermission.objects.update_or_create(
        group=group, route_pattern="/*", defaults={"allowed": True}
    )
    return group


def mint_access_token(user, lifetime: timedelta) -> str:
    """Return a signed access token for ``user`` that lives for ``lifetime``.

    Args:
        user: Django User instance.
        lifetime: Validity from now, overriding ``ACCESS_TOKEN_LIFETIME``.

    Returns:
        str: Encoded JWT accepted by the cookie and Bearer authentication.
    """
    token = AccessToken.for_user(user)
    token.set_exp(lifetime=lifetime)
    return str(token)


def create_users(count: int, hours: float) -> dict:
    """Create or reuse ``loadtest_NNN`` users and mint a token for each.

    Args:
        count: Number of users.
        hours: Token lifetime in hours.

    Returns:
        dict: ``expires_at`` (ISO time) and ``users``, a list of
            ``{"username", "token"}``.
    """
    user_model = get_user_model()
    lifetime = timedelta(hours=hours)
    with transaction.atomic():
        group = ensure_loadtest_group()
        users = []
        for index in range(1, count + 1):
            user, created = user_model.objects.get_or_create(
                username=f"{USER_PREFIX}_{index:03d}"
            )
            if created:
                user.set_unusable_password()
                user.save(update_fields=["password"])
            user.groups.add(group)
            users.append(user)

    return {
        "expires_at": (timezone.now() + lifetime).isoformat(),
        "users": [
            {"username": user.username, "token": mint_access_token(user, lifetime)}
            for user in users
        ],
    }


def purge_users() -> int:
    """Delete all load-test users and the load-test role.

    Superusers are never deleted, even when their name has the prefix.

    Returns:
        int: Number of deleted users.
    """
    users = get_user_model().objects.filter(
        username__startswith=f"{USER_PREFIX}_", is_superuser=False
    )
    count = users.count()
    users.delete()
    Group.objects.filter(name=LOADTEST_GROUP).delete()
    return count


def count_users() -> int:
    """Return how many load-test users exist."""
    return (
        get_user_model()
        .objects.filter(username__startswith=f"{USER_PREFIX}_", is_superuser=False)
        .count()
    )
