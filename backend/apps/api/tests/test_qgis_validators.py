"""Tests for QGIS upload-time validators."""

import os
import sqlite3
import struct
import tempfile
import xml.etree.ElementTree as ET
from unittest.mock import patch

import pytest
from apps.api.qgis_validators import (
    ValidationResult,
    _parse_gpkg_envelope,
    smoke_test_get_capabilities,
    validate_geopackage,
    validate_qgis_project,
    validate_qgis_upload,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_gpkg(
    tables: list[dict] | None = None,
    include_spatial_ref: bool = True,
) -> str:
    """Create a minimal GeoPackage file and return its path.

    Args:
        tables: List of dicts with keys: table_name, min_x, min_y, max_x,
            max_y, srs_id. If None, creates one valid table.
        include_spatial_ref: Whether to populate gpkg_spatial_ref_sys.
    """
    fd, path = tempfile.mkstemp(suffix=".gpkg")
    os.close(fd)
    conn = sqlite3.connect(path)
    cursor = conn.cursor()

    cursor.execute(
        "CREATE TABLE gpkg_contents ("
        "  table_name TEXT PRIMARY KEY,"
        "  data_type TEXT,"
        "  identifier TEXT,"
        "  description TEXT,"
        "  last_change TEXT,"
        "  min_x REAL, min_y REAL, max_x REAL, max_y REAL,"
        "  srs_id INTEGER"
        ")"
    )
    cursor.execute(
        "CREATE TABLE gpkg_spatial_ref_sys ("
        "  srs_name TEXT, srs_id INTEGER PRIMARY KEY,"
        "  organization TEXT, organization_coordsys_id INTEGER,"
        "  definition TEXT, description TEXT"
        ")"
    )
    cursor.execute(
        "CREATE TABLE gpkg_geometry_columns ("
        "  table_name TEXT, column_name TEXT, geometry_type_name TEXT,"
        "  srs_id INTEGER, z INTEGER, m INTEGER"
        ")"
    )

    if include_spatial_ref:
        cursor.execute(
            "INSERT INTO gpkg_spatial_ref_sys (srs_name, srs_id, organization, "
            "organization_coordsys_id, definition) "
            "VALUES ('ETRS89 / UTM zone 32N', 25832, 'EPSG', 25832, '')"
        )

    if tables is None:
        tables = [
            {
                "table_name": "test_layer",
                "min_x": 400000,
                "min_y": 5700000,
                "max_x": 500000,
                "max_y": 5800000,
                "srs_id": 25832,
            }
        ]

    for t in tables:
        cursor.execute(
            "INSERT INTO gpkg_contents (table_name, data_type, min_x, min_y, "
            "max_x, max_y, srs_id) VALUES (?, 'features', ?, ?, ?, ?, ?)",
            (
                t["table_name"],
                t["min_x"],
                t["min_y"],
                t["max_x"],
                t["max_y"],
                t["srs_id"],
            ),
        )

    conn.commit()
    conn.close()
    return path


def _make_gpkg_with_geometry(
    table_name: str = "test_layer",
    srs_id: int = 25832,
    bbox: tuple[float, float, float, float] = (float("inf"), 0, float("-inf"), 0),
    geom_points: list[tuple[float, float]] | None = None,
) -> str:
    """Create a GeoPackage with bad bbox metadata but valid geometry blobs."""
    fd, path = tempfile.mkstemp(suffix=".gpkg")
    os.close(fd)
    conn = sqlite3.connect(path)
    cursor = conn.cursor()

    cursor.execute(
        "CREATE TABLE gpkg_contents ("
        "  table_name TEXT PRIMARY KEY, data_type TEXT, identifier TEXT,"
        "  description TEXT, last_change TEXT,"
        "  min_x REAL, min_y REAL, max_x REAL, max_y REAL, srs_id INTEGER"
        ")"
    )
    cursor.execute(
        "CREATE TABLE gpkg_spatial_ref_sys ("
        "  srs_name TEXT, srs_id INTEGER PRIMARY KEY,"
        "  organization TEXT, organization_coordsys_id INTEGER,"
        "  definition TEXT, description TEXT"
        ")"
    )
    cursor.execute(
        "CREATE TABLE gpkg_geometry_columns ("
        "  table_name TEXT, column_name TEXT, geometry_type_name TEXT,"
        "  srs_id INTEGER, z INTEGER, m INTEGER"
        ")"
    )
    cursor.execute(
        "INSERT INTO gpkg_spatial_ref_sys VALUES ('ETRS89 / UTM zone 32N', 25832, 'EPSG', 25832, '', '')"
    )
    cursor.execute(
        "INSERT INTO gpkg_contents VALUES (?, 'features', NULL, NULL, NULL, ?, ?, ?, ?, ?)",
        (table_name, bbox[0], bbox[1], bbox[2], bbox[3], srs_id),
    )
    cursor.execute(
        "INSERT INTO gpkg_geometry_columns VALUES (?, 'geom', 'POINT', ?, 0, 0)",
        (table_name, srs_id),
    )
    cursor.execute(f'CREATE TABLE "{table_name}" (fid INTEGER PRIMARY KEY, geom BLOB)')

    if geom_points is None:
        geom_points = [(450000, 5750000), (460000, 5760000)]

    for x, y in geom_points:
        blob = _make_point_blob(x, y, srs_id)
        cursor.execute(f'INSERT INTO "{table_name}" (geom) VALUES (?)', (blob,))

    conn.commit()
    conn.close()
    return path


def _make_point_blob(x: float, y: float, srs_id: int = 25832) -> bytes:
    """Create a GeoPackage binary geometry blob for a 2D point with envelope."""
    # GeoPackage header: "GP", version=0, flags=0x03 (little-endian, envelope type 1)
    header = b"GP"
    header += struct.pack("B", 0)  # version
    header += struct.pack("B", 0x03)  # flags: little-endian + envelope type 1
    header += struct.pack("<i", srs_id)  # srs_id

    # Envelope type 1: min_x, max_x, min_y, max_y
    envelope = struct.pack("<4d", x, x, y, y)

    # WKB point (little-endian)
    wkb = struct.pack("<Bi2d", 1, 1, x, y)

    return header + envelope + wkb


def _make_qgs_xml(
    layers: list[dict] | None = None,
    version: str = "3.44.7-Sketsketched",
) -> bytes:
    """Create minimal QGS XML content.

    Each layer dict has keys: name, provider, datasource.
    """
    root = ET.Element("qgis", version=version)
    project_layers = ET.SubElement(root, "projectlayers")

    if layers is None:
        layers = [
            {
                "name": "trench",
                "provider": "postgres",
                "datasource": "service='qonnectra'",
            },
        ]

    for layer in layers:
        ml = ET.SubElement(project_layers, "maplayer")
        ln = ET.SubElement(ml, "layername")
        ln.text = layer["name"]
        prov = ET.SubElement(ml, "provider")
        prov.text = layer["provider"]
        ds = ET.SubElement(ml, "datasource")
        ds.text = layer["datasource"]

    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


# ---------------------------------------------------------------------------
# ValidationResult
# ---------------------------------------------------------------------------


class TestValidationResult:
    def test_ok_when_no_errors(self):
        r = ValidationResult()
        assert r.ok

    def test_not_ok_with_errors(self):
        r = ValidationResult(errors=["bad"])
        assert not r.ok

    def test_merge(self):
        a = ValidationResult(errors=["e1"], warnings=["w1"])
        b = ValidationResult(errors=["e2"], repaired=["r1"])
        a.merge(b)
        assert a.errors == ["e1", "e2"]
        assert a.warnings == ["w1"]
        assert a.repaired == ["r1"]


# ---------------------------------------------------------------------------
# GeoPackage validation
# ---------------------------------------------------------------------------


class TestValidateGeopackage:
    def test_valid_gpkg(self, tmp_path):
        path = _make_gpkg()
        try:
            result = validate_geopackage(path)
            assert result.ok
            assert not result.warnings
        finally:
            os.unlink(path)

    def test_file_not_found(self):
        result = validate_geopackage("/nonexistent/file.gpkg")
        assert not result.ok
        assert "not found" in result.errors[0]

    def test_inf_bbox_detected(self):
        path = _make_gpkg(
            tables=[
                {
                    "table_name": "broken",
                    "min_x": float("-inf"),
                    "min_y": 0,
                    "max_x": float("inf"),
                    "max_y": 0,
                    "srs_id": 25832,
                }
            ]
        )
        try:
            result = validate_geopackage(path)
            assert not result.ok or result.repaired
        finally:
            os.unlink(path)

    def test_nan_bbox_detected(self):
        path = _make_gpkg(
            tables=[
                {
                    "table_name": "broken",
                    "min_x": float("nan"),
                    "min_y": 0,
                    "max_x": 500000,
                    "max_y": 5800000,
                    "srs_id": 25832,
                }
            ]
        )
        try:
            result = validate_geopackage(path)
            assert not result.ok or result.repaired
        finally:
            os.unlink(path)

    def test_inverted_bbox_detected(self):
        path = _make_gpkg(
            tables=[
                {
                    "table_name": "inverted",
                    "min_x": 500000,
                    "min_y": 5800000,
                    "max_x": 400000,
                    "max_y": 5700000,
                    "srs_id": 25832,
                }
            ]
        )
        try:
            result = validate_geopackage(path)
            assert not result.ok or result.repaired
        finally:
            os.unlink(path)

    def test_missing_srs_detected(self):
        path = _make_gpkg(
            tables=[
                {
                    "table_name": "no_srs",
                    "min_x": 400000,
                    "min_y": 5700000,
                    "max_x": 500000,
                    "max_y": 5800000,
                    "srs_id": 99999,
                }
            ],
        )
        try:
            result = validate_geopackage(path)
            assert not result.ok
            assert any("srs_id 99999" in e for e in result.errors)
        finally:
            os.unlink(path)

    def test_bbox_outside_crs_domain_warns(self):
        path = _make_gpkg(
            tables=[
                {
                    "table_name": "far_away",
                    "min_x": 9_000_000,
                    "min_y": 5700000,
                    "max_x": 15_000_000,
                    "max_y": 5800000,
                    "srs_id": 25832,
                }
            ]
        )
        try:
            result = validate_geopackage(path)
            assert result.ok
            assert any("outside valid domain" in w for w in result.warnings)
        finally:
            os.unlink(path)

    def test_auto_repair_from_geometry(self):
        path = _make_gpkg_with_geometry(
            bbox=(float("inf"), 0, float("-inf"), 0),
            geom_points=[(450000, 5750000), (460000, 5760000)],
        )
        try:
            result = validate_geopackage(path)
            assert result.ok, f"Expected OK after repair, got errors: {result.errors}"
            assert len(result.repaired) == 1

            conn = sqlite3.connect(path)
            cursor = conn.cursor()
            cursor.execute("SELECT min_x, min_y, max_x, max_y FROM gpkg_contents")
            row = cursor.fetchone()
            conn.close()

            assert row[0] == pytest.approx(450000)
            assert row[1] == pytest.approx(5750000)
            assert row[2] == pytest.approx(460000)
            assert row[3] == pytest.approx(5760000)
        finally:
            os.unlink(path)

    def test_not_a_geopackage(self, tmp_path):
        bad_file = tmp_path / "not_a.gpkg"
        bad_file.write_text("this is not a geopackage")
        result = validate_geopackage(str(bad_file))
        assert not result.ok


# ---------------------------------------------------------------------------
# GeoPackage envelope parsing
# ---------------------------------------------------------------------------


class TestParseGpkgEnvelope:
    def test_valid_envelope(self):
        blob = _make_point_blob(450000, 5750000)
        env = _parse_gpkg_envelope(blob)
        assert env is not None
        assert env[0] == pytest.approx(450000)

    def test_none_for_empty(self):
        assert _parse_gpkg_envelope(b"") is None
        assert _parse_gpkg_envelope(None) is None

    def test_none_for_non_gpkg(self):
        assert _parse_gpkg_envelope(b"XX\x00\x00\x00\x00\x00\x00") is None

    def test_no_envelope_type_zero(self):
        blob = b"GP\x00\x01" + struct.pack("<i", 25832)
        assert _parse_gpkg_envelope(blob) is None


# ---------------------------------------------------------------------------
# QGIS project validation
# ---------------------------------------------------------------------------


class TestValidateQgisProject:
    def test_valid_postgres_layers(self):
        xml = _make_qgs_xml(
            layers=[
                {
                    "name": "trench",
                    "provider": "postgres",
                    "datasource": "service='qonnectra'",
                },
            ]
        )
        result = validate_qgis_project(xml)
        assert result.ok

    def test_local_windows_path_rejected(self):
        xml = _make_qgs_xml(
            layers=[
                {
                    "name": "bad_layer",
                    "provider": "ogr",
                    "datasource": "C:/Users/john/data.gpkg|layername=test",
                },
            ]
        )
        result = validate_qgis_project(xml)
        assert not result.ok
        assert any("local path" in e for e in result.errors)

    def test_unc_path_rejected(self):
        xml = _make_qgs_xml(
            layers=[
                {
                    "name": "bad_layer",
                    "provider": "ogr",
                    "datasource": "\\\\server\\share\\data.gpkg|layername=test",
                },
            ]
        )
        result = validate_qgis_project(xml)
        assert not result.ok
        assert any("local path" in e for e in result.errors)

    def test_relative_path_rejected(self):
        xml = _make_qgs_xml(
            layers=[
                {
                    "name": "bad_layer",
                    "provider": "ogr",
                    "datasource": "./geopackages/data.gpkg|layername=test",
                },
            ]
        )
        result = validate_qgis_project(xml)
        assert not result.ok
        assert any("local path" in e for e in result.errors)

    def test_container_data_path_accepted(self):
        xml = _make_qgs_xml(
            layers=[
                {
                    "name": "ok_layer",
                    "provider": "ogr",
                    "datasource": "/data/myproject/data.gpkg|layername=test",
                },
            ]
        )
        result = validate_qgis_project(xml)
        assert result.ok

    def test_missing_data_file_warns(self):
        xml = _make_qgs_xml(
            layers=[
                {
                    "name": "missing",
                    "provider": "ogr",
                    "datasource": "/some/path/extra.gpkg|layername=test",
                },
            ]
        )
        result = validate_qgis_project(xml, uploaded_data_filenames=["schema.gpkg"])
        assert any("not uploaded" in w for w in result.warnings)

    def test_schema_gpkg_skipped(self):
        xml = _make_qgs_xml(
            layers=[
                {
                    "name": "schema",
                    "provider": "ogr",
                    "datasource": "./schema.gpkg|layername=trench",
                },
            ]
        )
        result = validate_qgis_project(xml)
        assert result.ok

    def test_wms_layer_accepted(self):
        xml = _make_qgs_xml(
            layers=[
                {
                    "name": "basemap",
                    "provider": "wms",
                    "datasource": "url=https://wms.example.com",
                },
            ]
        )
        result = validate_qgis_project(xml)
        assert result.ok

    @patch("apps.api.qgis_validators.QGIS_SERVER_VERSION", "3.44.7")
    def test_version_skew_warning(self):
        xml = _make_qgs_xml(version="3.46.0-FutureMajor")
        result = validate_qgis_project(xml)
        assert any("3.46.0" in w for w in result.warnings)

    @patch("apps.api.qgis_validators.QGIS_SERVER_VERSION", "3.44.7")
    def test_same_version_no_warning(self):
        xml = _make_qgs_xml(version="3.44.7-Sketched")
        result = validate_qgis_project(xml)
        assert not result.warnings

    @patch("apps.api.qgis_validators.QGIS_SERVER_VERSION", "3.44.7")
    def test_older_version_no_warning(self):
        xml = _make_qgs_xml(version="3.42.0-OldVersion")
        result = validate_qgis_project(xml)
        assert not result.warnings

    @patch("apps.api.qgis_validators.QGIS_SERVER_VERSION", "")
    def test_version_check_skipped_when_not_configured(self):
        xml = _make_qgs_xml(version="3.99.0-Future")
        result = validate_qgis_project(xml)
        assert not result.warnings

    def test_invalid_xml_errors(self):
        result = validate_qgis_project(b"not xml at all")
        assert not result.ok
        assert any("Cannot parse" in e for e in result.errors)

    def test_gdal_local_path_rejected(self):
        xml = _make_qgs_xml(
            layers=[
                {
                    "name": "raster",
                    "provider": "gdal",
                    "datasource": "C:/Users/john/raster.tif",
                },
            ]
        )
        result = validate_qgis_project(xml)
        assert not result.ok
        assert any("local path" in e for e in result.errors)

    def test_gdal_container_path_accepted(self):
        xml = _make_qgs_xml(
            layers=[
                {
                    "name": "raster",
                    "provider": "gdal",
                    "datasource": "/data/myproject/raster.tif",
                },
            ]
        )
        result = validate_qgis_project(xml)
        assert result.ok


# ---------------------------------------------------------------------------
# GetCapabilities smoke test
# ---------------------------------------------------------------------------


class TestSmokeTestGetCapabilities:
    @patch("apps.api.qgis_validators.requests.get")
    def test_successful_capabilities(self, mock_get):
        mock_get.return_value.status_code = 200
        mock_get.return_value.headers = {"Content-Type": "text/xml"}
        mock_get.return_value.text = (
            '<WMS_Capabilities version="1.3.0"></WMS_Capabilities>'
        )
        mock_get.return_value.content = mock_get.return_value.text.encode()

        result = smoke_test_get_capabilities("/projects/test.qgz")
        assert result.ok

    @patch("apps.api.qgis_validators.requests.get")
    def test_server_error_500(self, mock_get):
        mock_get.return_value.status_code = 500

        result = smoke_test_get_capabilities("/projects/test.qgz")
        assert not result.ok
        assert any("500" in e for e in result.errors)

    @patch("apps.api.qgis_validators.requests.get")
    def test_service_exception(self, mock_get):
        body = (
            "<ServiceExceptionReport>"
            "<ServiceException>Layer has invalid extent</ServiceException>"
            "</ServiceExceptionReport>"
        )
        mock_get.return_value.status_code = 200
        mock_get.return_value.headers = {"Content-Type": "text/xml"}
        mock_get.return_value.text = body
        mock_get.return_value.content = body.encode()

        result = smoke_test_get_capabilities("/projects/test.qgz")
        assert not result.ok
        assert any("invalid extent" in e for e in result.errors)

    @patch("apps.api.qgis_validators.requests.get")
    def test_connection_error_is_warning(self, mock_get):
        import requests as req

        mock_get.side_effect = req.ConnectionError("refused")

        result = smoke_test_get_capabilities("/projects/test.qgz")
        assert result.ok
        assert any("not reachable" in w for w in result.warnings)

    @patch("apps.api.qgis_validators.requests.get")
    def test_timeout_is_error(self, mock_get):
        import requests as req

        mock_get.side_effect = req.Timeout("timed out")

        result = smoke_test_get_capabilities("/projects/test.qgz")
        assert not result.ok
        assert any("timed out" in e for e in result.errors)


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------


class TestValidateQgisUpload:
    def test_valid_project_no_data_files(self):
        xml = _make_qgs_xml()
        with patch(
            "apps.api.qgis_validators.smoke_test_get_capabilities"
        ) as mock_smoke:
            mock_smoke.return_value = ValidationResult()
            result = validate_qgis_upload(
                project_file_content=xml,
                project_filename="test.qgs",
                map_path="/projects/test.qgs",
                run_smoke_test=True,
            )
        assert result.ok

    def test_gpkg_validation_runs_on_data_files(self):
        gpkg_path = _make_gpkg(
            tables=[
                {
                    "table_name": "bad",
                    "min_x": float("inf"),
                    "min_y": 0,
                    "max_x": float("-inf"),
                    "max_y": 0,
                    "srs_id": 25832,
                }
            ]
        )
        xml = _make_qgs_xml()

        try:
            with patch(
                "apps.api.qgis_validators.smoke_test_get_capabilities"
            ) as mock_smoke:
                mock_smoke.return_value = ValidationResult()
                result = validate_qgis_upload(
                    project_file_content=xml,
                    project_filename="test.qgs",
                    data_file_paths=[gpkg_path],
                    data_filenames=["data.gpkg"],
                    map_path="/projects/test.qgs",
                    run_smoke_test=True,
                )
            assert not result.ok or result.repaired
        finally:
            os.unlink(gpkg_path)

    def test_smoke_test_skipped_when_disabled(self):
        xml = _make_qgs_xml()
        with patch(
            "apps.api.qgis_validators.smoke_test_get_capabilities"
        ) as mock_smoke:
            result = validate_qgis_upload(
                project_file_content=xml,
                project_filename="test.qgs",
                map_path="/projects/test.qgs",
                run_smoke_test=False,
            )
        mock_smoke.assert_not_called()
        assert result.ok

    def test_smoke_test_skipped_without_map_path(self):
        xml = _make_qgs_xml()
        with patch(
            "apps.api.qgis_validators.smoke_test_get_capabilities"
        ) as mock_smoke:
            validate_qgis_upload(
                project_file_content=xml,
                project_filename="test.qgs",
                run_smoke_test=True,
            )
        mock_smoke.assert_not_called()

    def test_errors_merged_from_all_sources(self):
        xml = _make_qgs_xml(
            layers=[
                {
                    "name": "bad",
                    "provider": "ogr",
                    "datasource": "C:/bad/path.gpkg|layername=x",
                },
            ]
        )
        smoke_result = ValidationResult(errors=["Server crash"])

        with patch(
            "apps.api.qgis_validators.smoke_test_get_capabilities",
            return_value=smoke_result,
        ):
            result = validate_qgis_upload(
                project_file_content=xml,
                project_filename="test.qgs",
                map_path="/projects/test.qgs",
                run_smoke_test=True,
            )
        assert len(result.errors) >= 2
        assert any("local path" in e for e in result.errors)
        assert any("crash" in e for e in result.errors)
