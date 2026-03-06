"""Tests for Trench model."""

import pytest
from django.contrib.gis.geos import LineString

from ..factories import TrenchFactory


@pytest.mark.django_db
class TestTrenchModel:
    """Tests for the Trench model."""

    def test_trench_creation_with_factory(self):
        """Test creating a trench using factory."""
        trench = TrenchFactory()

        assert trench.uuid is not None
        assert trench.project is not None
        assert trench.flag is not None
        assert trench.length is not None

    def test_trench_length_from_factory(self):
        """Test that trench from factory has length."""
        trench = TrenchFactory(
            geom=LineString((0, 0), (100, 0), srid=25832),
            length=100.0,
        )
        trench.refresh_from_db()

        assert trench.length is not None
        assert float(trench.length) == pytest.approx(100.0, rel=0.01)

    def test_trench_id_trench_set_by_factory(self):
        """Test that id_trench is set by factory."""
        trench = TrenchFactory()

        assert trench.id_trench is not None
        assert len(trench.id_trench) > 0
