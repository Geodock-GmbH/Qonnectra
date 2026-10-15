"""HTTP Basic authentication for Caddy's ``forward_auth`` checks.

WebDAV and QGIS clients send their credentials with every request, and
Caddy asks Django about each one. Checking the password means a full
password hash (PBKDF2 with a million iterations), so a file manager listing
folders or QGIS loading map tiles would keep the workers busy hashing. A
successful check is therefore remembered for a few minutes: later requests
with the same header cost one indexed lookup that still sees a password
change or a deactivated account at once.
"""

import base64
import hashlib
import hmac
import logging

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.core.cache import cache

logger = logging.getLogger(__name__)

CACHE_SECONDS = 300
CACHE_PREFIX = "basic-auth:"


class MalformedBasicAuth(ValueError):
    """The header is not ``Basic`` followed by base64 of ``username:password``."""


def _digest(value: str) -> str:
    """Return a keyed hash of ``value``, so neither credentials nor password hashes sit in the cache."""
    return hmac.new(
        settings.SECRET_KEY.encode(), value.encode(), hashlib.sha256
    ).hexdigest()


def _credentials(header: str) -> tuple[str, str]:
    """Decode a ``Basic`` Authorization header.

    Args:
        header: The full header value, including ``Basic``.

    Returns:
        tuple[str, str]: Username and password.

    Raises:
        MalformedBasicAuth: If the header cannot be decoded.
    """
    try:
        username, password = (
            base64.b64decode(header[len("Basic ") :]).decode("utf-8").split(":", 1)
        )
    except ValueError as error:
        raise MalformedBasicAuth(str(error)) from error
    return username, password


def authenticate_basic(header: str):
    """Return who a ``Basic`` Authorization header claims to be and whether it holds.

    A header that authenticated an active user within the last
    :data:`CACHE_SECONDS` skips the password hash, as long as that user is
    still active and still has the same password. Failed checks are never
    remembered.

    Args:
        header: The full header value, including ``Basic``.

    Returns:
        tuple[str, User | None]: The username from the header and the user,
            possibly inactive, or None for wrong credentials.

    Raises:
        MalformedBasicAuth: If the header cannot be decoded.
    """
    key = CACHE_PREFIX + _digest(header)
    remembered = cache.get(key)
    if remembered:
        user_id, password_digest = remembered
        user = get_user_model().objects.filter(pk=user_id, is_active=True).first()
        if user and hmac.compare_digest(_digest(user.password), password_digest):
            return user.get_username(), user
        cache.delete(key)

    username, password = _credentials(header)
    logger.debug(f"Checking Basic auth password for user: {username}")
    user = authenticate(username=username, password=password)
    if user is not None and user.is_active:
        cache.set(key, (user.pk, _digest(user.password)), CACHE_SECONDS)
    return username, user
