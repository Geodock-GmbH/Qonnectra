"""Tests for custom actions on AddressViewSet and ResidentialUnitViewSet.

Covers:
- AddressViewSet.linked_trenches: connected cable/trench geometry
- AddressViewSet.regenerate_id: Base32 address id regeneration
- ResidentialUnitViewSet.all_units: unpaginated unit listing
- ResidentialUnitViewSet.regenerate_id: Base28 unit id regeneration
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from ..factories import (
    AddressFactory,
    ResidentialUnitFactory,
)

User = get_user_model()


@pytest.fixture
def api_client():
    """Create API client for testing."""
    return APIClient()


@pytest.fixture
def authenticated_client(db):
    """Create an authenticated superuser API client."""
    user = User.objects.create_superuser(
        username="address_action_user",
        email="address_action@example.com",
        password="testpass123",
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestAddressLinkedTrenches:
    """Tests for the AddressViewSet linked-trenches action."""

    def test_returns_empty_feature_collection_without_links(
        self, authenticated_client, project, flag
    ):
        """An address with no cable/trench links returns an empty collection."""
        address = AddressFactory(project=project, flag=flag)

        response = authenticated_client.get(
            f"/api/v1/address/{address.uuid}/linked-trenches/"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["type"] == "FeatureCollection"
        assert response.data["features"] == []


@pytest.mark.django_db
class TestAddressRegenerateId:
    """Tests for the AddressViewSet regenerate-id action."""

    def test_regenerates_address_id(self, authenticated_client, project, flag):
        """Regenerating assigns a fresh non-empty id_address."""
        address = AddressFactory(project=project, flag=flag)

        response = authenticated_client.post(
            f"/api/v1/address/{address.uuid}/regenerate-id/"
        )
        assert response.status_code == status.HTTP_200_OK
        address.refresh_from_db()
        assert address.id_address


@pytest.mark.django_db
class TestResidentialUnitAllUnits:
    """Tests for the ResidentialUnitViewSet all action."""

    def test_lists_all_units_for_address(
        self, authenticated_client, project, flag
    ):
        """The all action returns every unit for an address, unpaginated."""
        address = AddressFactory(project=project, flag=flag)
        ResidentialUnitFactory.create_batch(3, uuid_address=address)

        response = authenticated_client.get(
            f"/api/v1/residential-unit/all/?uuid_address={address.uuid}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 3

    def test_filters_units_by_address(self, authenticated_client, project, flag):
        """Units of other addresses are excluded by the uuid_address filter."""
        address_a = AddressFactory(project=project, flag=flag)
        address_b = AddressFactory(project=project, flag=flag)
        ResidentialUnitFactory(uuid_address=address_a)
        ResidentialUnitFactory(uuid_address=address_b)

        response = authenticated_client.get(
            f"/api/v1/residential-unit/all/?uuid_address={address_a.uuid}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1


@pytest.mark.django_db
class TestResidentialUnitRegenerateId:
    """Tests for the ResidentialUnitViewSet regenerate-id action."""

    def test_regenerates_unit_id(self, authenticated_client, project, flag):
        """Regenerating assigns a fresh non-empty id_residential_unit."""
        address = AddressFactory(project=project, flag=flag)
        unit = ResidentialUnitFactory(uuid_address=address)

        response = authenticated_client.post(
            f"/api/v1/residential-unit/{unit.uuid}/regenerate-id/"
        )
        assert response.status_code == status.HTTP_200_OK
        unit.refresh_from_db()
        assert unit.id_residential_unit
        assert response.data["id_residential_unit"] == unit.id_residential_unit
