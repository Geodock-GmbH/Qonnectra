"""
Management command to create load-test users with long-lived access tokens.

The k6 harness in ``loadtest/`` needs one identity per virtual user. Logging
in through the API is throttled (5/min), so this command mints the access
tokens directly instead. The users are regular (non-superuser) members of a
dedicated role, so every request walks the real permission path.

Usage:
    python manage.py create_loadtest_users --count 50 --hours 3 > tokens.json
    python manage.py create_loadtest_users --purge
"""

import json
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from rest_framework_simplejwt.tokens import AccessToken

from apps.api.models import ModelPermission, RoutePermission

LOADTEST_GROUP = "loadtest"


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


class Command(BaseCommand):
    """Create or purge ``loadtest_NNN`` users and print their tokens as JSON."""

    help = "Create load-test users and print long-lived access tokens as JSON"

    def add_arguments(self, parser):
        """Define CLI arguments for the command.

        Args:
            parser: ArgumentParser instance to register arguments on.
        """
        parser.add_argument(
            "--count", type=int, default=20, help="Number of users (default: 20)"
        )
        parser.add_argument(
            "--hours",
            type=float,
            default=3,
            help="Token lifetime in hours (default: 3)",
        )
        parser.add_argument(
            "--prefix",
            default="loadtest",
            help="Username prefix (default: loadtest)",
        )
        parser.add_argument(
            "--purge",
            action="store_true",
            help="Delete all users with the prefix and the load-test role",
        )

    def handle(self, *args, **options):
        """Create the users and write the token JSON to stdout, or purge them.

        Args:
            *args: Positional arguments (unused).
            **options: Command options including 'count', 'hours', 'prefix'
                and 'purge'.
        """
        user_model = get_user_model()
        prefix = options["prefix"]

        if options["purge"]:
            deleted, _ = user_model.objects.filter(
                username__startswith=f"{prefix}_", is_superuser=False
            ).delete()
            Group.objects.filter(name=LOADTEST_GROUP).delete()
            self.stderr.write(f"Purged {deleted} rows for prefix '{prefix}_'")
            return

        lifetime = timedelta(hours=options["hours"])
        with transaction.atomic():
            group = ensure_loadtest_group()
            users = []
            for index in range(1, options["count"] + 1):
                user, created = user_model.objects.get_or_create(
                    username=f"{prefix}_{index:03d}"
                )
                if created:
                    user.set_unusable_password()
                    user.save(update_fields=["password"])
                user.groups.add(group)
                users.append(user)

        payload = {
            "expires_at": (timezone.now() + lifetime).isoformat(),
            "users": [
                {"username": user.username, "token": mint_access_token(user, lifetime)}
                for user in users
            ],
        }
        self.stdout.write(json.dumps(payload, indent=2))
        self.stderr.write(
            f"{len(users)} users, tokens valid until {payload['expires_at']}"
        )
