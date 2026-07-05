"""Tests for external app authentication endpoints (auth/app/*)."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()

APP_LOGIN_URL = "/api/v1/auth/app/login/"
APP_REFRESH_URL = "/api/v1/auth/app/token/refresh/"
APP_LOGOUT_URL = "/api/v1/auth/app/logout/"


@pytest.fixture(autouse=True)
def disable_throttling(monkeypatch):
    """Disable rate limiting so test ordering doesn't cause 429s."""
    from apps.api.views import AppLoginView, AppTokenRefreshView

    monkeypatch.setattr(AppLoginView, "throttle_classes", [])
    monkeypatch.setattr(AppTokenRefreshView, "throttle_classes", [])


@pytest.fixture
def api_client():
    return APIClient()


@pytest.mark.django_db
class TestAppLogin:
    def test_login_returns_tokens_in_body(self, api_client, user):
        response = api_client.post(
            APP_LOGIN_URL,
            {"username": "testuser", "password": "testpass123"},
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access" in data
        assert "refresh" in data
        assert "access_expiration" in data
        assert "refresh_expiration" in data
        assert "user" in data
        assert data["user"]["username"] == "testuser"

    def test_login_does_not_set_cookies(self, api_client, user):
        response = api_client.post(
            APP_LOGIN_URL,
            {"username": "testuser", "password": "testpass123"},
        )
        assert response.status_code == status.HTTP_200_OK
        assert "api-access-token" not in response.cookies
        assert "api-refresh-token" not in response.cookies

    def test_login_invalid_credentials(self, api_client, user):
        response = api_client.post(
            APP_LOGIN_URL,
            {"username": "testuser", "password": "wrongpassword"},
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_missing_fields(self, api_client):
        response = api_client.post(APP_LOGIN_URL, {"username": "testuser"})
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        response = api_client.post(APP_LOGIN_URL, {})
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_inactive_user(self, api_client, db):
        User.objects.create_user(
            username="inactive", password="testpass123", is_active=False
        )
        response = api_client.post(
            APP_LOGIN_URL,
            {"username": "inactive", "password": "testpass123"},
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_returns_user_details(self, api_client, user):
        response = api_client.post(
            APP_LOGIN_URL,
            {"username": "testuser", "password": "testpass123"},
        )
        user_data = response.json()["user"]
        assert "pk" in user_data
        assert "email" in user_data
        assert "is_staff" in user_data
        assert "is_superuser" in user_data


@pytest.mark.django_db
class TestBearerAuthentication:
    def test_bearer_token_authenticates(self, api_client, user):
        response = api_client.post(
            APP_LOGIN_URL,
            {"username": "testuser", "password": "testpass123"},
        )
        access_token = response.json()["access"]

        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        response = api_client.get("/api/v1/auth/permissions/")
        assert response.status_code == status.HTTP_200_OK

    def test_invalid_bearer_token_rejected(self, api_client):
        api_client.credentials(HTTP_AUTHORIZATION="Bearer invalid-token")
        response = api_client.get("/api/v1/auth/permissions/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestAppTokenRefresh:
    def test_refresh_returns_new_tokens(self, api_client, user):
        login_response = api_client.post(
            APP_LOGIN_URL,
            {"username": "testuser", "password": "testpass123"},
        )
        refresh_token = login_response.json()["refresh"]

        response = api_client.post(
            APP_REFRESH_URL, {"refresh": refresh_token}
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access" in data

    def test_refresh_with_blacklisted_token(self, api_client, user):
        refresh = RefreshToken.for_user(user)
        refresh.blacklist()

        response = api_client.post(
            APP_REFRESH_URL, {"refresh": str(refresh)}
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_refresh_with_invalid_token(self, api_client):
        response = api_client.post(
            APP_REFRESH_URL, {"refresh": "invalid-token"}
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestAppLogout:
    def test_logout_blacklists_refresh_token(self, api_client, user):
        login_response = api_client.post(
            APP_LOGIN_URL,
            {"username": "testuser", "password": "testpass123"},
        )
        tokens = login_response.json()
        access_token = tokens["access"]
        refresh_token = tokens["refresh"]

        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        response = api_client.post(
            APP_LOGOUT_URL, {"refresh": refresh_token}
        )
        assert response.status_code == status.HTTP_200_OK

        api_client.credentials()
        response = api_client.post(
            APP_REFRESH_URL, {"refresh": refresh_token}
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_logout_requires_authentication(self, api_client):
        response = api_client.post(
            APP_LOGOUT_URL, {"refresh": "some-token"}
        )
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    def test_logout_missing_refresh_token(self, api_client, user):
        api_client.force_authenticate(user=user)
        response = api_client.post(APP_LOGOUT_URL, {})
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_logout_invalid_refresh_token(self, api_client, user):
        api_client.force_authenticate(user=user)
        response = api_client.post(
            APP_LOGOUT_URL, {"refresh": "invalid-token"}
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
