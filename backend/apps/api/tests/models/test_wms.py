"""Tests for WMS models."""

import pytest
from django.db import IntegrityError

from apps.api.models import WMSLayer, WMSSource

from ..factories import (
    ProjectFactory,
    WMSLayerFactory,
    WMSSourceFactory,
)


@pytest.mark.django_db
class TestWMSSourceModel:
    """Tests for the WMSSource model."""

    def test_creation(self):
        """Test creating a WMS source."""
        project = ProjectFactory()
        source = WMSSource.objects.create(
            project=project,
            name="Test WMS",
            url="https://wms.example.com/wms",
            is_active=True,
        )

        assert source.id is not None
        assert source.name == "Test WMS"

    def test_str_representation(self):
        """Test WMS source string representation."""
        source = WMSSourceFactory(name="My WMS Source")
        assert "My WMS Source" in str(source)

    def test_ordering(self):
        """Test WMS sources are ordered by sort_order and name."""
        project = ProjectFactory()
        WMSSource.objects.create(
            project=project, name="B Source", url="https://b.com", sort_order=2
        )
        WMSSource.objects.create(
            project=project, name="A Source", url="https://a.com", sort_order=1
        )
        WMSSource.objects.create(
            project=project, name="C Source", url="https://c.com", sort_order=1
        )

        sources = list(WMSSource.objects.filter(project=project))
        assert sources[0].name == "A Source"
        assert sources[1].name == "C Source"
        assert sources[2].name == "B Source"


@pytest.mark.django_db
class TestWMSLayerModel:
    """Tests for the WMSLayer model."""

    def test_creation(self):
        """Test creating a WMS layer."""
        source = WMSSourceFactory()
        layer = WMSLayer.objects.create(
            source=source,
            name="test_layer",
            title="Test Layer",
            is_enabled=True,
        )

        assert layer.id is not None
        assert layer.name == "test_layer"

    def test_str_representation_with_title(self):
        """Test WMS layer string representation uses title."""
        layer = WMSLayerFactory(name="layer_name", title="Layer Title")
        assert str(layer) == "Layer Title"

    def test_str_representation_without_title(self):
        """Test WMS layer string representation falls back to name."""
        layer = WMSLayerFactory(name="layer_name", title="")
        assert str(layer) == "layer_name"

    def test_unique_together_constraint(self):
        """Test that source + name must be unique."""
        source = WMSSourceFactory()
        WMSLayer.objects.create(source=source, name="unique_layer", title="First")

        with pytest.raises(IntegrityError):
            WMSLayer.objects.create(source=source, name="unique_layer", title="Second")

    def test_default_values(self):
        """Test default values for WMS layer."""
        source = WMSSourceFactory()
        layer = WMSLayer.objects.create(source=source, name="test_layer")

        assert layer.is_enabled is True
        assert layer.min_zoom == 8
        assert layer.max_zoom is None
        assert layer.opacity == 1.0
