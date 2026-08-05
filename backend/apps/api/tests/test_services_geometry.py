"""
Unit tests for geometry and GeoJSON feature-building helpers in
apps/api/services.py.

Tests cover:
- _validate_and_clean_geometry: GeoJSON validation and cleaning
- _merge_trench_geometries: Merging multiple trench geometries
- _orient_geometry: Orienting geometries along a cable's flow direction
- _trim_trench_to_path_coords: Trimming a trench to a routed sub-path
- _merge_trench_geoms: Merging geometries from TrenchConduitConnection objects
- _fk_str: Foreign-key string coercion helper
- _trench_feature / _node_feature / _address_feature / _conduit_feature /
  _cable_feature / _area_feature: GeoJSON feature builders
- _valuation_projection: Multi-year net-value projection
"""

from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from apps.api.services import (
    _address_feature,
    _area_feature,
    _cable_feature,
    _conduit_feature,
    _fk_str,
    _merge_trench_geometries,
    _merge_trench_geoms,
    _node_feature,
    _orient_geometry,
    _trench_feature,
    _trim_trench_to_path_coords,
    _validate_and_clean_geometry,
    _valuation_projection,
)
from django.contrib.gis.geos import LineString, MultiLineString, Point
from shapely.geometry import Point as ShapelyPoint

from .factories import (
    AddressFactory,
    AreaFactory,
    CableFactory,
    ConduitFactory,
    MicroductCableConnectionFactory,
    MicroductFactory,
    NodeFactory,
    TrenchConduitConnectionFactory,
    TrenchFactory,
)


class TestValidateAndCleanGeometry:
    """Tests for the _validate_and_clean_geometry service function."""

    def test_returns_none_for_empty_input(self):
        """Falsy input yields None."""
        assert _validate_and_clean_geometry(None) is None
        assert _validate_and_clean_geometry({}) is None

    def test_returns_cleaned_geometry_for_valid_linestring(self):
        """A valid LineString round-trips to an equivalent GeoJSON dict."""
        geojson = {"type": "LineString", "coordinates": [[0, 0], [10, 0]]}
        result = _validate_and_clean_geometry(geojson)
        assert result["type"] == "LineString"
        assert result["coordinates"][0] == (0.0, 0.0)
        assert result["coordinates"][-1] == (10.0, 0.0)

    def test_returns_none_for_empty_geometry(self):
        """An empty geometry returns None."""
        geojson = {"type": "LineString", "coordinates": []}
        assert _validate_and_clean_geometry(geojson) is None

    def test_repairs_self_intersecting_polygon(self):
        """A self-intersecting (bowtie) polygon is made valid rather than dropped."""
        bowtie = {
            "type": "Polygon",
            "coordinates": [[[0, 0], [10, 10], [10, 0], [0, 10], [0, 0]]],
        }
        result = _validate_and_clean_geometry(bowtie)
        assert result is not None
        assert result["type"] in ("Polygon", "MultiPolygon", "GeometryCollection")

    def test_returns_none_for_malformed_input(self):
        """Malformed GeoJSON is swallowed and returns None."""
        assert _validate_and_clean_geometry({"type": "Nonsense"}) is None


class TestMergeTrenchGeometries:
    """Tests for the _merge_trench_geometries service function."""

    def test_returns_none_for_empty_list(self):
        """No trenches yields None."""
        assert _merge_trench_geometries([]) is None

    def test_returns_none_when_no_valid_geometries(self):
        """Trenches without geometry yield None."""
        trenches = [{"geometry": None}, {}]
        assert _merge_trench_geometries(trenches) is None

    def test_single_geometry_returned_as_is(self):
        """A single trench geometry is returned unchanged in shape."""
        trenches = [
            {"geometry": {"type": "LineString", "coordinates": [[0, 0], [10, 0]]}}
        ]
        result = _merge_trench_geometries(trenches)
        assert result["type"] == "LineString"

    def test_connected_geometries_merge_to_linestring(self):
        """Two connected segments linemerge into a single LineString."""
        trenches = [
            {"geometry": {"type": "LineString", "coordinates": [[0, 0], [10, 0]]}},
            {"geometry": {"type": "LineString", "coordinates": [[10, 0], [20, 0]]}},
        ]
        result = _merge_trench_geometries(trenches)
        assert result["type"] == "LineString"
        assert len(result["coordinates"]) == 3

    def test_disconnected_geometries_merge_to_multilinestring(self):
        """Two disconnected segments produce a MultiLineString."""
        trenches = [
            {"geometry": {"type": "LineString", "coordinates": [[0, 0], [10, 0]]}},
            {"geometry": {"type": "LineString", "coordinates": [[50, 0], [60, 0]]}},
        ]
        result = _merge_trench_geometries(trenches)
        assert result["type"] == "MultiLineString"


class TestOrientGeometry:
    """Tests for the _orient_geometry service function."""

    def test_returns_input_when_no_start_geom(self):
        """Missing cable start geometry short-circuits to the input."""
        geom = {"type": "LineString", "coordinates": [[0, 0], [10, 0]]}
        assert _orient_geometry(geom, None, None) is geom

    def test_keeps_orientation_when_already_aligned(self):
        """A geometry already flowing start->end is left unchanged."""
        geom = {"type": "LineString", "coordinates": [[0, 0], [10, 0]]}
        start = ShapelyPoint(0, 0)
        end = ShapelyPoint(10, 0)
        result = _orient_geometry(geom, start, end)
        assert result is geom

    def test_reverses_geometry_when_misaligned(self):
        """A geometry whose end is nearest the start node gets reversed."""
        geom = {"type": "LineString", "coordinates": [[10, 0], [0, 0]]}
        start = ShapelyPoint(0, 0)
        end = ShapelyPoint(10, 0)
        result = _orient_geometry(geom, start, end)
        assert result["coordinates"][0] == (0.0, 0.0)
        assert result["coordinates"][-1] == (10.0, 0.0)

    def test_orients_each_multilinestring_component(self):
        """Each component of a MultiLineString is oriented independently."""
        geom = {
            "type": "MultiLineString",
            "coordinates": [[[10, 0], [0, 0]], [[0, 0], [10, 0]]],
        }
        start = ShapelyPoint(0, 0)
        result = _orient_geometry(geom, start, None)
        assert result["type"] == "MultiLineString"
        for line in result["coordinates"]:
            assert line[0] == (0.0, 0.0)

    def test_returns_input_for_unhandled_geometry_type(self):
        """A Point geometry is not a line and is returned unchanged."""
        geom = {"type": "Point", "coordinates": [0, 0]}
        result = _orient_geometry(geom, ShapelyPoint(0, 0), None)
        assert result == geom


class TestTrimTrenchToPathCoords:
    """Tests for the _trim_trench_to_path_coords service function."""

    def test_returns_input_for_non_linestring(self):
        """A non-LineString geometry is returned unchanged."""
        geom = {"type": "Point", "coordinates": [0, 0]}
        assert _trim_trench_to_path_coords(geom, [(0, 0)]) == geom

    def test_returns_input_when_path_covers_full_line(self):
        """When the path spans the whole line, the original geometry is kept."""
        geom = {"type": "LineString", "coordinates": [[0, 0], [100, 0]]}
        result = _trim_trench_to_path_coords(geom, [(0, 0), (100, 0)])
        assert result["coordinates"][0] == [0, 0]
        assert result["coordinates"][-1] == [100, 0]

    def test_trims_line_to_sub_path(self):
        """A path over an interior span trims the line to that span."""
        geom = {"type": "LineString", "coordinates": [[0, 0], [100, 0]]}
        result = _trim_trench_to_path_coords(geom, [(25, 0), (75, 0)])
        xs = [c[0] for c in result["coordinates"]]
        assert min(xs) >= 24
        assert max(xs) <= 76

    def test_returns_input_for_malformed_geometry(self):
        """Malformed geometry input is swallowed and returned unchanged."""
        geom = {"type": "LineString", "coordinates": "broken"}
        assert _trim_trench_to_path_coords(geom, [(0, 0)]) == geom


class TestFkStr:
    """Tests for the _fk_str helper."""

    def test_returns_none_for_missing_attribute(self):
        """A missing attribute returns None."""
        assert _fk_str(object(), "nonexistent") is None

    def test_returns_none_for_falsy_value(self):
        """A falsy attribute value returns None."""

        class Obj:
            related = None

        assert _fk_str(Obj(), "related") is None

    def test_returns_str_for_present_value(self):
        """A present attribute is coerced to its string form."""

        class Related:
            def __str__(self):
                return "related-label"

        class Obj:
            related = Related()

        assert _fk_str(Obj(), "related") == "related-label"


class TestMergeTrenchGeoms:
    """Tests for the _merge_trench_geoms service function."""

    def test_returns_none_for_empty_connections(self):
        """No connections yields None."""
        assert _merge_trench_geoms([]) is None

    def test_returns_none_without_geometries(self):
        """Connections whose trenches have no geometry yield None."""
        conn = MagicMock()
        conn.uuid_trench.geom = None
        assert _merge_trench_geoms([conn]) is None

    @pytest.mark.django_db
    def test_builds_multilinestring_from_linestrings(self, project, flag):
        """LineString trench geometries are collected into a MultiLineString."""
        trench1 = TrenchFactory(
            project=project,
            flag=flag,
            geom=LineString((0, 0), (10, 0), srid=25832),
        )
        trench2 = TrenchFactory(
            project=project,
            flag=flag,
            geom=LineString((10, 0), (20, 0), srid=25832),
        )
        conduit = ConduitFactory(project=project, flag=flag)
        conn1 = TrenchConduitConnectionFactory(
            uuid_trench=trench1, uuid_conduit=conduit
        )
        conn2 = TrenchConduitConnectionFactory(
            uuid_trench=trench2, uuid_conduit=conduit
        )
        result = _merge_trench_geoms([conn1, conn2])
        assert result["type"] == "MultiLineString"
        assert len(result["coordinates"]) == 2

    def test_flattens_multilinestring_trench_geometry(self):
        """A MultiLineString trench geometry contributes each of its parts.

        Uses a stub connection because the Trench.geom column only accepts a
        LineString, so a real MultiLineString trench cannot be persisted.
        """
        mls = MultiLineString(
            LineString((0, 0), (10, 0), srid=25832),
            LineString((20, 0), (30, 0), srid=25832),
            srid=25832,
        )
        conn = MagicMock()
        conn.uuid_trench.geom = mls
        result = _merge_trench_geoms([conn])
        assert result["type"] == "MultiLineString"
        assert len(result["coordinates"]) == 2


@pytest.mark.django_db
class TestFeatureBuilders:
    """Tests for the per-model GeoJSON feature builders."""

    def test_trench_feature_shape(self, project, flag):
        """_trench_feature returns properties and geometry for a trench."""
        trench = TrenchFactory(
            project=project,
            flag=flag,
            geom=LineString((0, 0), (5, 0), srid=25832),
        )
        props, geom = _trench_feature(trench)
        assert props["uuid"] == str(trench.uuid)
        assert props["id_trench"] == trench.id_trench
        assert props["length"] == float(trench.length)
        assert geom["type"] == "LineString"

    def test_trench_feature_without_geometry(self):
        """A trench without geometry yields None geometry.

        Built on a stub rather than a saved Trench because the DB trigger
        nulls ``length`` for a geom-less row, which the NOT-NULL column rejects.
        """
        stub = MagicMock()
        stub.geom = None
        stub.length = None
        stub.date = None
        _, geom = _trench_feature(stub)
        assert geom is None

    def test_node_feature_shape(self, node):
        """_node_feature returns node properties and a Point geometry."""
        props, geom = _node_feature(node)
        assert props["uuid"] == str(node.uuid)
        assert props["name"] == node.name
        assert geom["type"] == "Point"

    def test_address_feature_formats_full_address(self, project, flag):
        """_address_feature composes a human-readable address string."""
        address = AddressFactory(
            project=project,
            flag=flag,
            street="Musterweg",
            housenumber=7,
            zip_code="24941",
            city="Flensburg",
        )
        props, _ = _address_feature(address)
        assert props["address"] == "Musterweg 7, 24941 Flensburg"

    def test_address_feature_includes_house_number_suffix(self, project, flag):
        """A house-number suffix is appended without a separating space."""
        address = AddressFactory(
            project=project,
            flag=flag,
            street="Musterweg",
            housenumber=7,
            house_number_suffix="a",
            zip_code="24941",
            city="Flensburg",
        )
        props, _ = _address_feature(address)
        assert props["address"] == "Musterweg 7a, 24941 Flensburg"

    def test_conduit_feature_lists_trench_ids(self, project, flag):
        """_conduit_feature reports the id_trench of each connected trench."""
        trench = TrenchFactory(
            project=project,
            flag=flag,
            geom=LineString((0, 0), (10, 0), srid=25832),
        )
        conduit = ConduitFactory(project=project, flag=flag)
        TrenchConduitConnectionFactory(uuid_trench=trench, uuid_conduit=conduit)
        trench.refresh_from_db()
        props, geom = _conduit_feature(conduit)
        assert props["trench_ids"] == [trench.id_trench]
        assert geom["type"] == "MultiLineString"

    def test_cable_feature_collects_conduit_names(self, project, flag):
        """_cable_feature aggregates the names of conduits it runs through."""
        trench = TrenchFactory(
            project=project,
            flag=flag,
            geom=LineString((0, 0), (10, 0), srid=25832),
        )
        conduit = ConduitFactory(project=project, flag=flag, name="Conduit-A")
        TrenchConduitConnectionFactory(uuid_trench=trench, uuid_conduit=conduit)
        microduct = MicroductFactory(uuid_conduit=conduit)
        cable = CableFactory(project=project, flag=flag)
        MicroductCableConnectionFactory(uuid_microduct=microduct, uuid_cable=cable)
        props, geom = _cable_feature(cable)
        assert props["conduit_names"] == ["Conduit-A"]
        assert geom["type"] == "MultiLineString"

    def test_area_feature_shape(self, project, flag):
        """_area_feature returns area properties and its polygon geometry."""
        area = AreaFactory(project=project, flag=flag)
        props, geom = _area_feature(area)
        assert props["uuid"] == str(area.uuid)
        assert geom is not None


class TestValuationProjection:
    """Tests for the _valuation_projection service function."""

    def test_flat_projection_without_correction(self):
        """A zero correction keeps every year's net value equal to total."""
        total = Decimal("1000")
        result = _valuation_projection(total, 2026, Decimal("0"), 3)
        assert [r["year"] for r in result] == [2026, 2027, 2028]
        assert all(r["net_value"] == total for r in result)

    def test_base_year_has_no_increase(self):
        """The base year's increase is None; later years carry a delta."""
        result = _valuation_projection(Decimal("1000"), 2026, Decimal("0.1"), 3)
        assert result[0]["increase"] is None
        assert result[1]["increase"] == Decimal("100.0")

    def test_compounds_annual_correction(self):
        """Each year compounds the annual correction on the base total."""
        result = _valuation_projection(Decimal("1000"), 2026, Decimal("0.1"), 3)
        assert result[1]["net_value"] == Decimal("1100.0")
        assert result[2]["net_value"] == Decimal("1210.00")

    def test_zero_years_returns_empty(self):
        """Zero projected years yields an empty projection."""
        assert _valuation_projection(Decimal("1000"), 2026, Decimal("0.1"), 0) == []
