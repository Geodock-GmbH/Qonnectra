"""Tests for the login check nginx runs before serving a cached tile."""

from datetime import timedelta

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

ACCESS_COOKIE = "api-access-token"


def tile_auth_url() -> str:
    """Return the URL nginx's auth_request subrequest calls."""
    return reverse("v1:tile-auth")


def wms_token(user) -> AccessToken:
    """Return a token scoped to WMS access, as the WMS token endpoint issues it.

    Args:
        user: User the token is issued for.

    Returns:
        AccessToken: Access token carrying the ``wms_only`` claim.
    """
    token = AccessToken.for_user(user)
    token["wms_only"] = True
    return token


@pytest.mark.django_db
class TestTileAuth:
    """Allow cached tiles only for requests a tile view itself would accept."""

    def test_access_cookie_allows(self, user):
        """Verify the browser's access-token cookie is accepted."""
        client = APIClient()
        client.cookies[ACCESS_COOKIE] = str(AccessToken.for_user(user))

        response = client.get(tile_auth_url())

        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_bearer_header_allows(self, user):
        """Verify an Authorization bearer token is accepted."""
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(user)}")

        response = client.get(tile_auth_url())

        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_wms_token_allows(self, user):
        """Verify the WMS-scoped query token is accepted, as the WMS proxy does."""
        response = APIClient().get(tile_auth_url(), {"token": str(wms_token(user))})

        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_wms_token_wins_over_expired_cookie(self, user):
        """Verify a valid WMS token is enough even when the cookie has expired."""
        expired = AccessToken.for_user(user)
        expired.set_exp(lifetime=-timedelta(minutes=5))
        client = APIClient()
        client.cookies[ACCESS_COOKIE] = str(expired)

        response = client.get(tile_auth_url(), {"token": str(wms_token(user))})

        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_no_credentials_denied(self):
        """Verify a request without any login is denied."""
        response = APIClient().get(tile_auth_url())

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_empty_token_param_denied(self):
        """Verify the empty token nginx sends for vector tiles counts as no login."""
        response = APIClient().get(tile_auth_url(), {"token": ""})

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_expired_cookie_denied(self, user):
        """Verify an expired access-token cookie is denied."""
        expired = AccessToken.for_user(user)
        expired.set_exp(lifetime=-timedelta(minutes=5))
        client = APIClient()
        client.cookies[ACCESS_COOKIE] = str(expired)

        response = client.get(tile_auth_url())

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_unscoped_query_token_denied(self, user):
        """Verify a general access token is not accepted as a query parameter."""
        response = APIClient().get(
            tile_auth_url(), {"token": str(AccessToken.for_user(user))}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
