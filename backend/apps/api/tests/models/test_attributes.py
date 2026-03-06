"""Tests for attribute models."""

import pytest
from django.db import IntegrityError

from apps.api.models import (
    AttributesCompany,
    AttributesConduitType,
    AttributesNodeType,
    AttributesStatus,
)


@pytest.mark.django_db
class TestAttributeModels:
    """Tests for various attribute models."""

    def test_status_creation(self):
        """Test creating an AttributesStatus."""
        status = AttributesStatus.objects.create(status="In Progress")
        assert str(status) == "In Progress"

    def test_status_unique(self):
        """Test that status must be unique."""
        AttributesStatus.objects.create(status="Unique Status")
        with pytest.raises(IntegrityError):
            AttributesStatus.objects.create(status="Unique Status")

    def test_company_creation(self):
        """Test creating an AttributesCompany."""
        company = AttributesCompany.objects.create(
            company="Test Company",
            city="Hamburg",
            postal_code="20095",
            street="Hauptstraße",
            housenumber="1",
        )
        assert str(company) == "Test Company"
        assert company.city == "Hamburg"

    def test_node_type_creation(self):
        """Test creating an AttributesNodeType."""
        node_type = AttributesNodeType.objects.create(
            node_type="Muffe",
            dimension="100x50",
            group="Verbinder",
        )
        assert str(node_type) == "Muffe"
        assert node_type.dimension == "100x50"

    def test_conduit_type_creation(self):
        """Test creating an AttributesConduitType."""
        conduit_type = AttributesConduitType.objects.create(
            conduit_type="12x10/6",
            conduit_count=12,
        )
        assert str(conduit_type) == "12x10/6"
        assert conduit_type.conduit_count == 12
