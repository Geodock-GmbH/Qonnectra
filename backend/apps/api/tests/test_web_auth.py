"""Contract tests for the cookie-based web login the frontend uses."""

import json

import pytest
from rest_framework import status
from rest_framework.test import APIClient

LOGIN_URL = "/api/v1/auth/login/"
FORM_CONTENT_TYPE = "application/x-www-form-urlencoded"


@pytest.fixture(autouse=True)
def disable_login_throttling(monkeypatch):
    """Disable rate limiting so test ordering doesn't cause 429s."""
    from dj_rest_auth.views import LoginView

    monkeypatch.setattr(LoginView, "throttle_classes", [])


@pytest.fixture
def api_client():
    return APIClient()


@pytest.mark.django_db
class TestWebLogin:
    def test_form_encoded_login_sets_session_cookies(self, api_client, user):
        response = api_client.post(
            LOGIN_URL,
            {"username": "testuser", "password": "testpass123"},
            content_type=FORM_CONTENT_TYPE,
        )

        assert response.status_code == status.HTTP_200_OK
        assert "api-access-token" in response.cookies
        assert "api-refresh-token" in response.cookies

    def test_json_login_is_still_accepted(self, api_client, user):
        response = api_client.post(
            LOGIN_URL,
            data=json.dumps({"username": "testuser", "password": "testpass123"}),
            content_type="application/json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert "api-access-token" in response.cookies

    def test_wrong_password_returns_non_field_error(self, api_client, user):
        response = api_client.post(
            LOGIN_URL,
            {"username": "testuser", "password": "wrong-password"},
            content_type=FORM_CONTENT_TYPE,
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "non_field_errors" in response.json()
