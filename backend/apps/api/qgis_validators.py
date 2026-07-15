"""Upload-time validators for QGIS project and GeoPackage data files.

Validates .gpkg bbox sanity, .qgz datasource resolution, QGIS version skew,
and runs a GetCapabilities smoke test against the QGIS Server before accepting
an upload.
"""

import logging
import math
import os
import re
import sqlite3
import struct
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import PureWindowsPath

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

QGIS_SERVER_INTERNAL_URL = getattr(
    settings, "QGIS_SERVER_INTERNAL_URL", "http://qgis-server"
)

QGIS_SERVER_VERSION = getattr(settings, "QGIS_SERVER_VERSION", "")


@dataclass
class ValidationResult:
    """Collects warnings and errors from upload validators."""

    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    repaired: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return len(self.errors) == 0

    def merge(self, other: "ValidationResult") -> None:
        self.errors.extend(other.errors)
        self.warnings.extend(other.warnings)
        self.repaired.extend(other.repaired)


# ---------------------------------------------------------------------------
# GeoPackage bbox validation
# ---------------------------------------------------------------------------

CRS_VALID_DOMAINS: dict[int, tuple[float, float, float, float]] = {
    25832: (-500_000, 3_000_000, 10_000_000, 10_000_000),
    4326: (-180, -90, 180, 90),
    3857: (-20_037_508.34, -20_048_966.10, 20_037_508.34, 20_048_966.10),
}


def _is_bad_value(v: float | None) -> bool:
    if v is None:
        return True
    if math.isinf(v) or math.isnan(v):
        return True
    return False


def validate_geopackage(file_path: str) -> ValidationResult:
    """Validate a GeoPackage file's bbox metadata and CRS.

    Checks gpkg_contents for -inf/inf/NaN and inverted bounding boxes.
    Attempts auto-repair via SQL when geometry data is intact but
    metadata is corrupt.

    Args:
        file_path: Absolute path to the .gpkg file on disk.

    Returns:
        ValidationResult with errors, warnings, and repair notes.
    """
    result = ValidationResult()

    if not os.path.exists(file_path):
        result.errors.append(f"GeoPackage file not found: {file_path}")
        return result

    try:
        conn = sqlite3.connect(file_path)
        conn.enable_load_extension(True)
    except Exception as e:
        result.errors.append(f"Cannot open GeoPackage: {e}")
        return result

    try:
        cursor = conn.cursor()

        # -- Check gpkg_contents exists
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='gpkg_contents'"
        )
        if not cursor.fetchone():
            result.errors.append("Not a valid GeoPackage: gpkg_contents table missing")
            return result

        # -- Check bboxes
        cursor.execute(
            "SELECT table_name, min_x, min_y, max_x, max_y, srs_id FROM gpkg_contents"
        )
        rows = cursor.fetchall()

        tables_needing_repair = []

        for table_name, min_x, min_y, max_x, max_y, srs_id in rows:
            bad_bbox = any(_is_bad_value(v) for v in (min_x, min_y, max_x, max_y))
            inverted = (
                not bad_bbox
                and min_x is not None
                and max_x is not None
                and min_y is not None
                and max_y is not None
                and (min_x > max_x or min_y > max_y)
            )

            if bad_bbox or inverted:
                label = "inf/NaN" if bad_bbox else "inverted"
                tables_needing_repair.append(table_name)
                logger.warning(
                    "GeoPackage table '%s' has %s bbox: (%s, %s, %s, %s)",
                    table_name,
                    label,
                    min_x,
                    min_y,
                    max_x,
                    max_y,
                )
            elif srs_id and srs_id in CRS_VALID_DOMAINS:
                domain = CRS_VALID_DOMAINS[srs_id]
                if min_x is not None and (
                    min_x < domain[0]
                    or max_x > domain[2]
                    or min_y < domain[1]
                    or max_y > domain[3]
                ):
                    result.warnings.append(
                        f"Table '{table_name}': bbox ({min_x}, {min_y}, {max_x}, {max_y}) "
                        f"is outside valid domain for EPSG:{srs_id}"
                    )

            # -- Check SRS is resolvable
            if srs_id is not None:
                cursor.execute(
                    "SELECT srs_id FROM gpkg_spatial_ref_sys WHERE srs_id = ?",
                    (srs_id,),
                )
                if not cursor.fetchone():
                    result.errors.append(
                        f"Table '{table_name}': srs_id {srs_id} not found "
                        f"in gpkg_spatial_ref_sys"
                    )

        # -- Attempt auto-repair for bad bboxes
        for table_name in tables_needing_repair:
            try:
                geom_col = _find_geometry_column(cursor, table_name)
                if not geom_col:
                    result.errors.append(
                        f"Table '{table_name}': corrupt bbox and no geometry "
                        f"column found — cannot auto-repair"
                    )
                    continue

                cursor.execute(f'SELECT Count(*) FROM "{table_name}"')
                row_count = cursor.fetchone()[0]
                if row_count == 0:
                    result.warnings.append(
                        f"Table '{table_name}': corrupt bbox but table is empty "
                        f"— setting bbox to NULL"
                    )
                    cursor.execute(
                        "UPDATE gpkg_contents SET min_x=NULL, min_y=NULL, "
                        "max_x=NULL, max_y=NULL WHERE table_name=?",
                        (table_name,),
                    )
                    conn.commit()
                    result.repaired.append(table_name)
                    continue

                bounds = _compute_extent(cursor, table_name, geom_col)
                if bounds:
                    min_x, min_y, max_x, max_y = bounds
                    cursor.execute(
                        "UPDATE gpkg_contents SET min_x=?, min_y=?, max_x=?, max_y=? "
                        "WHERE table_name=?",
                        (min_x, min_y, max_x, max_y, table_name),
                    )
                    conn.commit()
                    result.repaired.append(table_name)
                    logger.info(
                        "Auto-repaired bbox for '%s': (%s, %s, %s, %s)",
                        table_name,
                        min_x,
                        min_y,
                        max_x,
                        max_y,
                    )
                else:
                    result.errors.append(
                        f"Table '{table_name}': corrupt bbox and could not "
                        f"recompute extent from geometry"
                    )
            except Exception as e:
                result.errors.append(f"Table '{table_name}': auto-repair failed: {e}")

    except Exception as e:
        result.errors.append(f"Error reading GeoPackage metadata: {e}")
    finally:
        conn.close()

    return result


def _find_geometry_column(cursor: sqlite3.Cursor, table_name: str) -> str | None:
    """Find the geometry column for a GeoPackage table."""
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' "
        "AND name='gpkg_geometry_columns'"
    )
    if cursor.fetchone():
        cursor.execute(
            "SELECT column_name FROM gpkg_geometry_columns WHERE table_name=?",
            (table_name,),
        )
        row = cursor.fetchone()
        if row:
            return row[0]
    return None


def _compute_extent(
    cursor: sqlite3.Cursor, table_name: str, geom_col: str
) -> tuple[float, float, float, float] | None:
    """Compute bounding box from GeoPackage geometry blobs.

    Parses the GeoPackage binary header envelope directly — no SpatiaLite
    extension required.
    """
    cursor.execute(
        f'SELECT "{geom_col}" FROM "{table_name}" WHERE "{geom_col}" IS NOT NULL'
    )

    global_min_x = float("inf")
    global_min_y = float("inf")
    global_max_x = float("-inf")
    global_max_y = float("-inf")
    found_any = False

    for (blob,) in cursor:
        env = _parse_gpkg_envelope(blob)
        if env:
            # Envelope type 1 stores (min_x, max_x, min_y, max_y)
            found_any = True
            global_min_x = min(global_min_x, env[0])
            global_max_x = max(global_max_x, env[1])
            global_min_y = min(global_min_y, env[2])
            global_max_y = max(global_max_y, env[3])

    if not found_any:
        return None
    return (global_min_x, global_min_y, global_max_x, global_max_y)


def _parse_gpkg_envelope(
    blob: bytes | None,
) -> tuple[float, float, float, float] | None:
    """Parse the envelope from a GeoPackage geometry binary header.

    GeoPackage binary header:
        bytes 0-1: magic "GP"
        byte 2: version
        byte 3: flags (bits 1-3 = envelope type, bit 0 = byte order)
        bytes 4-7: srs_id
        bytes 8+: envelope (depends on envelope type)
    """
    if not blob or len(blob) < 8:
        return None
    if blob[0:2] != b"GP":
        return None

    flags = blob[3]
    byte_order = ">" if (flags & 0x01) == 0 else "<"
    envelope_type = (flags >> 1) & 0x07

    if envelope_type == 0:
        return None
    if envelope_type == 1 and len(blob) >= 40:
        vals = struct.unpack(f"{byte_order}4d", blob[8:40])
        return vals  # (min_x, max_x, min_y, max_y)
    if envelope_type == 2 and len(blob) >= 56:
        vals = struct.unpack(f"{byte_order}4d", blob[8:40])
        return vals
    if envelope_type == 3 and len(blob) >= 56:
        vals = struct.unpack(f"{byte_order}4d", blob[8:40])
        return vals
    if envelope_type == 4 and len(blob) >= 72:
        vals = struct.unpack(f"{byte_order}4d", blob[8:40])
        return vals

    return None


# ---------------------------------------------------------------------------
# QGIS project (.qgz/.qgs) validation
# ---------------------------------------------------------------------------

_LOCAL_PATH_PATTERNS = [
    re.compile(r"^[A-Za-z]:[/\\]"),  # C:\, D:/
    re.compile(r"^\\\\"),  # UNC paths \\server\share
    re.compile(r"^\./"),  # relative current-dir
    re.compile(r"^\.\./"),  # relative parent
]


def validate_qgis_project(
    qgs_content: bytes,
    uploaded_data_filenames: list[str] | None = None,
) -> ValidationResult:
    """Validate a QGIS project's datasources and metadata.

    Checks for:
    - Layers with unresolvable local/absolute paths
    - OGR layers referencing .gpkg files not present in uploaded data files
    - QGIS version skew vs. the server version

    Args:
        qgs_content: Raw QGS XML bytes (extracted from .qgz if needed).
        uploaded_data_filenames: Filenames of uploaded QGISProjectDataFiles.

    Returns:
        ValidationResult with errors and warnings.
    """
    result = ValidationResult()
    uploaded_set = set(uploaded_data_filenames or [])

    try:
        root = ET.fromstring(qgs_content)
    except ET.ParseError as e:
        result.errors.append(f"Cannot parse QGS XML: {e}")
        return result

    _check_version_skew(root, result)
    _check_datasources(root, uploaded_set, result)

    return result


def _check_version_skew(root: ET.Element, result: ValidationResult) -> None:
    """Warn if the project was saved in a newer QGIS than the server."""
    if not QGIS_SERVER_VERSION:
        return

    version_attr = root.get("version", "")
    if not version_attr:
        return

    project_version = version_attr.split("-")[0]
    try:
        proj_parts = [int(x) for x in project_version.split(".")]
        server_parts = [int(x) for x in QGIS_SERVER_VERSION.split(".")]

        if proj_parts[:2] > server_parts[:2]:
            result.warnings.append(
                f"Project saved in QGIS {project_version}, but server runs "
                f"{QGIS_SERVER_VERSION}. Minor version differences are usually "
                f"fine, but major mismatches may cause rendering issues."
            )
    except (ValueError, IndexError):
        pass


def _check_datasources(
    root: ET.Element,
    uploaded_filenames: set[str],
    result: ValidationResult,
) -> None:
    """Check that all layer datasources are resolvable on the server."""
    for maplayer in root.iter("maplayer"):
        provider_elem = maplayer.find("provider")
        datasource_elem = maplayer.find("datasource")
        layer_name_elem = maplayer.find("layername")

        if provider_elem is None or datasource_elem is None:
            continue

        provider = provider_elem.text or ""
        source = datasource_elem.text or ""
        display_name = (
            layer_name_elem.text if layer_name_elem is not None else "unknown"
        ) or "unknown"

        if provider == "postgres":
            continue

        if provider == "ogr" and source:
            # Already converted to container path — fine
            if source.startswith("/data/") or source.startswith("/projects/"):
                continue
            # Converted to postgres by convert_qgs_to_postgres — fine
            if "service=" in source:
                continue
            # Schema gpkg is handled specially
            if "schema.gpkg" in source:
                continue

            _check_ogr_source(source, display_name, uploaded_filenames, result)

        elif provider in (
            "wms",
            "wmts",
            "wfs",
            "arcgismapserver",
            "arcgisfeatureserver",
        ):
            continue

        elif provider == "gdal" and source:
            if source.startswith("/data/") or source.startswith("/projects/"):
                continue
            _check_file_path(source, display_name, result)


def _check_ogr_source(
    source: str,
    display_name: str,
    uploaded_filenames: set[str],
    result: ValidationResult,
) -> None:
    """Check a single OGR datasource for local paths and missing files."""
    path_part = source.split("|")[0]

    for pattern in _LOCAL_PATH_PATTERNS:
        if pattern.match(path_part):
            result.errors.append(
                f"Layer '{display_name}': datasource points to a local path "
                f"({path_part}) that won't exist on the server"
            )
            return

    filename = PureWindowsPath(path_part).name
    ext = os.path.splitext(filename)[1].lower()

    if ext in (".gpkg", ".dxf", ".shp", ".geojson", ".json", ".csv", ".kml", ".gml"):
        if uploaded_filenames and filename not in uploaded_filenames:
            result.warnings.append(
                f"Layer '{display_name}': references '{filename}' which was "
                f"not uploaded as a data file"
            )


def _check_file_path(source: str, display_name: str, result: ValidationResult) -> None:
    """Check a raw file path datasource for local/absolute references."""
    for pattern in _LOCAL_PATH_PATTERNS:
        if pattern.match(source):
            result.errors.append(
                f"Layer '{display_name}': datasource points to a local path "
                f"({source}) that won't exist on the server"
            )
            return


# ---------------------------------------------------------------------------
# GetCapabilities smoke test
# ---------------------------------------------------------------------------


def smoke_test_get_capabilities(map_path: str, timeout: int = 30) -> ValidationResult:
    """Issue a WMS GetCapabilities request against QGIS Server.

    This is the single most effective check: if the project crashes the
    server or returns an error, we reject the upload before it goes live.

    Args:
        map_path: The MAP parameter path (e.g. "/projects/my-project.qgz").
        timeout: HTTP request timeout in seconds.

    Returns:
        ValidationResult — errors if the request fails or returns an
        OGC ServiceException.
    """
    result = ValidationResult()

    url = (
        f"{QGIS_SERVER_INTERNAL_URL}/?"
        f"SERVICE=WMS&REQUEST=GetCapabilities&MAP={map_path}"
    )

    try:
        resp = requests.get(url, timeout=timeout)
    except requests.ConnectionError:
        result.warnings.append(
            "QGIS Server is not reachable — skipping GetCapabilities smoke test. "
            "The project will be saved but may not work until the server is available."
        )
        return result
    except requests.Timeout:
        result.errors.append(
            f"QGIS Server timed out after {timeout}s loading the project. "
            f"This usually means the project is too complex or has broken layers."
        )
        return result
    except Exception as e:
        result.warnings.append(f"GetCapabilities smoke test failed: {e}")
        return result

    if resp.status_code >= 500:
        result.errors.append(
            f"QGIS Server returned HTTP {resp.status_code} when loading the project. "
            f"This typically means a layer crashed the server (broken extent, "
            f"missing datasource, etc.)."
        )
        return result

    if resp.status_code != 200:
        result.errors.append(
            f"QGIS Server returned HTTP {resp.status_code} for GetCapabilities."
        )
        return result

    body = resp.text

    if "ServiceException" in body:
        try:
            exc_root = ET.fromstring(resp.content)
            exceptions = []
            for se in exc_root.iter("ServiceException"):
                text = (se.text or "").strip()
                if text:
                    exceptions.append(text)
            if exceptions:
                result.errors.append(
                    "QGIS Server reported OGC ServiceException(s): "
                    + "; ".join(exceptions)
                )
            else:
                result.errors.append(
                    "QGIS Server returned a ServiceException response."
                )
        except ET.ParseError:
            result.errors.append("QGIS Server returned an unparseable error response.")
        return result

    if "WMS_Capabilities" not in body and "WMT_MS_Capabilities" not in body:
        result.warnings.append(
            "GetCapabilities response does not look like a valid WMS document. "
            "The project may still work, but this is unexpected."
        )

    return result


# ---------------------------------------------------------------------------
# Orchestrator — called from admin.save_related
# ---------------------------------------------------------------------------


def validate_qgis_upload(
    project_file_content: bytes,
    project_filename: str,
    data_file_paths: list[str] | None = None,
    data_filenames: list[str] | None = None,
    map_path: str | None = None,
    run_smoke_test: bool = True,
) -> ValidationResult:
    """Run all upload-time validations for a QGIS project and its data files.

    Args:
        project_file_content: Raw bytes of the .qgs/.qgz file.
        project_filename: Original filename.
        data_file_paths: Absolute paths to uploaded .gpkg (and other) data files.
        data_filenames: Original filenames of uploaded data files.
        map_path: MAP parameter path for the smoke test.
        run_smoke_test: Whether to run the GetCapabilities smoke test
            (disabled in dev/test when QGIS Server is unavailable).

    Returns:
        Merged ValidationResult from all checks.
    """
    from .services import handle_qgis_file

    combined = ValidationResult()

    # -- Validate GeoPackage data files
    for path in data_file_paths or []:
        if path.lower().endswith(".gpkg"):
            gpkg_result = validate_geopackage(path)
            if not gpkg_result.ok or gpkg_result.warnings:
                basename = os.path.basename(path)
                gpkg_result.errors = [f"[{basename}] {e}" for e in gpkg_result.errors]
                gpkg_result.warnings = [
                    f"[{basename}] {w}" for w in gpkg_result.warnings
                ]
                gpkg_result.repaired = [
                    f"[{basename}] {t}" for t in gpkg_result.repaired
                ]
            combined.merge(gpkg_result)

    # -- Validate QGS content
    try:
        qgs_content, _is_qgz = handle_qgis_file(project_file_content, project_filename)
        project_result = validate_qgis_project(qgs_content, data_filenames)
        combined.merge(project_result)
    except Exception as e:
        combined.errors.append(f"Cannot read project file: {e}")

    # -- Smoke test GetCapabilities
    if run_smoke_test and map_path:
        smoke_result = smoke_test_get_capabilities(map_path)
        combined.merge(smoke_result)

    return combined
