import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from apps.api.models import UserSettings

User = get_user_model()


@pytest.fixture
def user(db):
    """Return a persisted test user."""
    return User.objects.create_user(username="settingsuser", password="testpass")


@pytest.fixture
def authenticated_client(user):
    """Return an APIClient authenticated as the test user."""
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestUserSettingsView:
    """Tests for the /api/v1/user-settings/ load/save endpoint."""

    URL = reverse("v1:user-settings")

    def test_requires_authentication_for_get(self):
        """Loading settings requires authentication."""
        response = APIClient().get(self.URL)
        assert response.status_code == 401

    def test_requires_authentication_for_put(self):
        """Saving settings requires authentication."""
        response = APIClient().put(self.URL, {"settings": {}}, format="json")
        assert response.status_code == 401

    def test_get_returns_empty_when_unsaved(self, authenticated_client):
        """A user with no saved settings gets an empty object, not a 404."""
        response = authenticated_client.get(self.URL)
        assert response.status_code == 200
        assert response.json() == {"settings": {}, "updated_at": None}

    def test_put_creates_and_get_returns_it(self, authenticated_client, user):
        """Saving settings persists them and they can be loaded back."""
        payload = {"settings": {"theme": ["dark"], "sidebarPreferences": {"hiddenRoutes": ["map"]}}}
        put_response = authenticated_client.put(self.URL, payload, format="json")
        assert put_response.status_code == 200
        assert put_response.json()["settings"] == payload["settings"]
        assert put_response.json()["updated_at"] is not None

        assert UserSettings.objects.filter(user=user).count() == 1

        get_response = authenticated_client.get(self.URL)
        assert get_response.status_code == 200
        assert get_response.json()["settings"] == payload["settings"]

    def test_put_overwrites_previous_settings(self, authenticated_client, user):
        """A second save overwrites the first without creating a new row."""
        authenticated_client.put(self.URL, {"settings": {"a": 1}}, format="json")
        authenticated_client.put(self.URL, {"settings": {"b": 2}}, format="json")

        assert UserSettings.objects.filter(user=user).count() == 1
        instance = UserSettings.objects.get(user=user)
        assert instance.settings == {"b": 2}

    def test_put_rejects_non_object_settings(self, authenticated_client):
        """Settings must be a JSON object, not a list or scalar."""
        response = authenticated_client.put(
            self.URL, {"settings": ["not", "an", "object"]}, format="json"
        )
        assert response.status_code == 400

    def test_settings_are_scoped_per_user(self, authenticated_client, user):
        """One user's saved settings are not visible to another user."""
        authenticated_client.put(self.URL, {"settings": {"owner": "first"}}, format="json")

        other = User.objects.create_user(username="otheruser", password="testpass")
        other_client = APIClient()
        other_client.force_authenticate(user=other)

        response = other_client.get(self.URL)
        assert response.status_code == 200
        assert response.json() == {"settings": {}, "updated_at": None}
