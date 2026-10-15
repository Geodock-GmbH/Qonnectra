"""Tests for the Basic-auth check behind Caddy's forward_auth (WebDAV and QGIS)."""

import base64
from unittest import mock

import pytest
from django.contrib.auth.base_user import AbstractBaseUser
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APIClient

FORWARD_AUTH_URLS = ["/api/v1/auth/webdav-auth/", "/api/v1/auth/qgis-auth/"]


def basic(username: str, password: str) -> str:
    """Return a Basic Authorization header value."""
    return "Basic " + base64.b64encode(f"{username}:{password}".encode()).decode()


@pytest.fixture(autouse=True)
def empty_cache():
    """Start every test without remembered checks."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def password_checks():
    """Count full password checks, the expensive part of Basic auth."""
    with mock.patch.object(
        AbstractBaseUser,
        "check_password",
        autospec=True,
        side_effect=AbstractBaseUser.check_password,
    ) as spy:
        yield spy


def ask(url: str, header: str):
    """Send one forward_auth check like Caddy does."""
    return APIClient().get(url, HTTP_AUTHORIZATION=header)


@pytest.mark.django_db
@pytest.mark.parametrize("url", FORWARD_AUTH_URLS)
class TestBasicAuthCache:
    """Remembered Basic-auth checks on the WebDAV and QGIS forward_auth endpoints."""

    def test_repeated_requests_check_the_password_once(
        self, url, user, password_checks
    ):
        """Verify only the first of several identical requests pays for the password hash."""
        header = basic("testuser", "testpass123")

        answers = [ask(url, header).status_code for _ in range(5)]

        assert answers == [status.HTTP_200_OK] * 5
        assert password_checks.call_count == 1

    def test_wrong_password_is_rejected_every_time(self, url, user, password_checks):
        """Verify failed checks are never remembered."""
        header = basic("testuser", "wrong")

        first = ask(url, header)
        second = ask(url, header)

        assert first.status_code == second.status_code == status.HTTP_401_UNAUTHORIZED
        assert first["WWW-Authenticate"].startswith("Basic realm=")
        assert password_checks.call_count == 2

    def test_wrong_password_after_a_success_is_rejected(self, url, user):
        """Verify a remembered success does not admit other credentials."""
        assert ask(url, basic("testuser", "testpass123")).status_code == 200

        response = ask(url, basic("testuser", "testpass1234"))

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_password_change_ends_the_remembered_check(self, url, user):
        """Verify a new password takes effect at once."""
        old = basic("testuser", "testpass123")
        assert ask(url, old).status_code == status.HTTP_200_OK

        user.set_password("new-secret-456")
        user.save()

        assert ask(url, old).status_code == status.HTTP_401_UNAUTHORIZED
        assert (
            ask(url, basic("testuser", "new-secret-456")).status_code
            == status.HTTP_200_OK
        )

    def test_deactivation_ends_the_remembered_check(self, url, user):
        """Verify a deactivated user is locked out at once."""
        header = basic("testuser", "testpass123")
        assert ask(url, header).status_code == status.HTTP_200_OK

        user.is_active = False
        user.save()

        assert ask(url, header).status_code == status.HTTP_401_UNAUTHORIZED

    def test_malformed_header_is_rejected(self, url, user):
        """Verify an undecodable header is a 401, not a server error."""
        response = ask(url, "Basic not-base64-at-all")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert response.json() == {"error": "Invalid Authorization header format"}

    def test_cache_holds_no_credentials(self, url, user):
        """Verify neither the password nor its hash is stored in the cache."""
        ask(url, basic("testuser", "testpass123"))

        stored = repr(cache._cache)  # LocMemCache's backing dict
        assert "testpass123" not in stored
        assert user.password not in stored
