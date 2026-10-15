"""Load-test users, signed in with a refresh and an access token each.

Logging in through the API is throttled (5/min), so the tokens are minted
directly, with the lifetimes of a real login: the virtual users have to
refresh their sessions like the app does. The users are regular
(non-superuser) members of a dedicated role, so every request walks the real
permission path. Needs Django set up.
"""

from apps.api.models import ModelPermission, RoutePermission
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db import transaction
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

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


def sign_in(user) -> dict:
    """Mint the tokens a login would set as cookies.

    The refresh token is recorded as outstanding, so it can be rotated and
    blacklisted like one from a real login.

    Args:
        user: Django User instance.

    Returns:
        dict: ``access`` and ``refresh``, encoded JWTs.
    """
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


def loadtest_users():
    """Return the load-test users; superusers never count, whatever their name."""
    return get_user_model().objects.filter(
        username__startswith=f"{USER_PREFIX}_", is_superuser=False
    )


def create_users(count: int) -> dict:
    """Create or reuse ``loadtest_NNN`` users and sign each in.

    The refresh tokens of earlier runs are dropped first, so the token
    tables only hold the sessions of the current run.

    Args:
        count: Number of users.

    Returns:
        dict: ``users``, a list of ``{"username", "access", "refresh"}``.
    """
    user_model = get_user_model()
    with transaction.atomic():
        OutstandingToken.objects.filter(user__in=loadtest_users()).delete()
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

    return {"users": [{"username": user.username, **sign_in(user)} for user in users]}


def purge_users() -> int:
    """Delete all load-test users, their refresh tokens and the load-test role.

    Superusers are never deleted, even when their name has the prefix. The
    tokens go explicitly: deleting a user only unlinks them.

    Returns:
        int: Number of deleted users.
    """
    users = loadtest_users()
    count = users.count()
    OutstandingToken.objects.filter(user__in=users).delete()
    users.delete()
    Group.objects.filter(name=LOADTEST_GROUP).delete()
    return count


def count_users() -> int:
    """Return how many load-test users exist."""
    return loadtest_users().count()
