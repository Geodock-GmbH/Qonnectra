"""
Unit tests for service functions in apps/api/services.py.

Tests cover:
- import_conduits_from_excel: Excel import validation and processing
- generate_conduit_import_template: Template generation
- rename_feature_folder: Feature folder renaming
- move_file_to_feature: File moving between features
- handle_qgis_file: QGIS file handling
- convert_qgs_to_postgres: QGS datasource conversion
"""

import io
import zipfile
from unittest.mock import MagicMock, patch

import openpyxl
import pytest
from apps.api.models import Conduit, Microduct
from apps.api.services import (
    _build_postgres_datasource,
    _extract_layer_name_from_gpkg_source,
    _postgres_type_to_pandas,
    convert_qgs_to_postgres,
    generate_conduit_import_template,
    handle_qgis_file,
    import_conduits_from_excel,
    repackage_qgz,
)
from django.utils.translation import activate

from .factories import (
    CompanyFactory,
    ConduitTypeColorMappingFactory,
    ConduitTypeFactory,
    FlagFactory,
    MicroductColorFactory,
    NetworkLevelFactory,
    ProjectFactory,
    StatusFactory,
)


@pytest.fixture
def excel_file_with_valid_data(db):
    """Create an Excel file with valid conduit data."""
    project = ProjectFactory(project="TestProject")
    flag = FlagFactory(flag="TestFlag")
    conduit_type = ConduitTypeFactory(conduit_type="12x10/6")
    status = StatusFactory(status="geplant")
    network_level = NetworkLevelFactory(network_level="Hausanschluss-Ebene")
    owner = CompanyFactory(company="Geodock")

    workbook = openpyxl.Workbook()
    sheet = workbook.active

    headers = [
        "Name",
        "Type",
        "Outer Conduit",
        "Status",
        "Network Level",
        "Owner",
        "Constructor",
        "Manufacturer",
        "Date",
        "Project",
        "Flag",
    ]
    for col, header in enumerate(headers, start=1):
        sheet.cell(row=1, column=col, value=header)

    data_row = [
        "RV1.1.1",
        "12x10/6",
        "",
        "geplant",
        "Hausanschluss-Ebene",
        "Geodock",
        "",
        "",
        "2025-01-01",
        "TestProject",
        "TestFlag",
    ]
    for col, value in enumerate(data_row, start=1):
        sheet.cell(row=2, column=col, value=value)

    file_buffer = io.BytesIO()
    workbook.save(file_buffer)
    file_buffer.seek(0)

    return {
        "file": file_buffer,
        "project": project,
        "flag": flag,
        "conduit_type": conduit_type,
        "status": status,
        "network_level": network_level,
        "owner": owner,
    }


@pytest.fixture
def conduit_type_with_colors(db):
    """Create a conduit type with color mappings for microduct creation."""
    colors = []
    color_names = [
        ("rot", "red", "#dc2626"),
        ("grün", "green", "#16a34a"),
        ("blau", "blue", "#2563eb"),
    ]
    for i, (name_de, name_en, hex_code) in enumerate(color_names, 1):
        colors.append(
            MicroductColorFactory(
                id=i,
                name_de=name_de,
                name_en=name_en,
                hex_code=hex_code,
            )
        )

    conduit_type = ConduitTypeFactory(conduit_type="3x10/6", conduit_count=3)
    for i, color in enumerate(colors, 1):
        ConduitTypeColorMappingFactory(
            conduit_type=conduit_type,
            position=i,
            color=color,
        )
    return conduit_type


@pytest.mark.django_db
class TestImportConduitsFromExcel:
    """Tests for the import_conduits_from_excel service function."""

    def test_import_valid_excel_file(self, excel_file_with_valid_data):
        """Test successful import of valid Excel file."""
        activate("en")
        result = import_conduits_from_excel(excel_file_with_valid_data["file"])

        assert result["success"] is True
        assert result["created_count"] == 1

        conduit = Conduit.objects.get(name="RV1.1.1")
        assert conduit.project == excel_file_with_valid_data["project"]
        assert conduit.flag == excel_file_with_valid_data["flag"]

    def test_import_creates_microducts_for_conduit_type_with_colors(
        self, db, conduit_type_with_colors
    ):
        """Test that microducts are created when conduit type has color mappings."""
        activate("en")
        project = ProjectFactory(project="TestProject2")
        flag = FlagFactory(flag="TestFlag2")

        workbook = openpyxl.Workbook()
        sheet = workbook.active
        headers = [
            "Name",
            "Type",
            "Outer Conduit",
            "Status",
            "Network Level",
            "Owner",
            "Constructor",
            "Manufacturer",
            "Date",
            "Project",
            "Flag",
        ]
        for col, header in enumerate(headers, start=1):
            sheet.cell(row=1, column=col, value=header)

        data_row = [
            "TestConduit",
            "3x10/6",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "TestProject2",
            "TestFlag2",
        ]
        for col, value in enumerate(data_row, start=1):
            sheet.cell(row=2, column=col, value=value)

        file_buffer = io.BytesIO()
        workbook.save(file_buffer)
        file_buffer.seek(0)

        result = import_conduits_from_excel(file_buffer)

        assert result["success"] is True
        conduit = Conduit.objects.get(name="TestConduit")
        microducts = Microduct.objects.filter(uuid_conduit=conduit)
        assert microducts.count() == 3

    def test_import_file_too_large(self, db):
        """Test rejection of file exceeding size limit."""
        activate("en")
        large_file = io.BytesIO(b"x" * (10 * 1024 * 1024 + 1))
        result = import_conduits_from_excel(large_file, max_file_size=10 * 1024 * 1024)

        assert result["success"] is False
        assert any("too large" in err.lower() for err in result["errors"])

    def test_import_invalid_excel_file(self, db):
        """Test rejection of invalid Excel file."""
        activate("en")
        invalid_file = io.BytesIO(b"not an excel file")
        result = import_conduits_from_excel(invalid_file)

        assert result["success"] is False
        assert any("invalid excel" in err.lower() for err in result["errors"])

    def test_import_missing_name_column(self, db):
        """Test rejection when required Name column is missing."""
        activate("en")
        workbook = openpyxl.Workbook()
        sheet = workbook.active
        sheet.cell(row=1, column=1, value="Type")
        sheet.cell(row=1, column=2, value="Project")

        file_buffer = io.BytesIO()
        workbook.save(file_buffer)
        file_buffer.seek(0)

        result = import_conduits_from_excel(file_buffer)

        assert result["success"] is False
        assert any("name" in err.lower() for err in result["errors"])

    def test_import_empty_headers(self, db):
        """Test rejection when no headers found."""
        activate("en")
        workbook = openpyxl.Workbook()
        sheet = workbook.active

        file_buffer = io.BytesIO()
        workbook.save(file_buffer)
        file_buffer.seek(0)

        result = import_conduits_from_excel(file_buffer)

        assert result["success"] is False
        assert any("header" in err.lower() for err in result["errors"])

    def test_import_duplicate_conduit_name(self, db):
        """Test rejection when conduit name already exists."""
        activate("en")
        project = ProjectFactory(project="TestProject3")
        flag = FlagFactory(flag="TestFlag3")
        conduit_type = ConduitTypeFactory()
        Conduit.objects.create(
            name="ExistingConduit",
            project=project,
            flag=flag,
            conduit_type=conduit_type,
        )

        workbook = openpyxl.Workbook()
        sheet = workbook.active
        headers = ["Name", "Project", "Flag"]
        for col, header in enumerate(headers, start=1):
            sheet.cell(row=1, column=col, value=header)
        sheet.cell(row=2, column=1, value="ExistingConduit")
        sheet.cell(row=2, column=2, value="TestProject3")
        sheet.cell(row=2, column=3, value="TestFlag3")

        file_buffer = io.BytesIO()
        workbook.save(file_buffer)
        file_buffer.seek(0)

        result = import_conduits_from_excel(file_buffer)

        assert result["success"] is False
        assert any("already exists" in err.lower() for err in result["errors"])

    def test_import_missing_row_name(self, db):
        """Test error when row is missing name."""
        activate("en")
        workbook = openpyxl.Workbook()
        sheet = workbook.active
        headers = ["Name", "Type"]
        for col, header in enumerate(headers, start=1):
            sheet.cell(row=1, column=col, value=header)
        sheet.cell(row=2, column=1, value="")
        sheet.cell(row=2, column=2, value="SomeType")

        file_buffer = io.BytesIO()
        workbook.save(file_buffer)
        file_buffer.seek(0)

        result = import_conduits_from_excel(file_buffer)

        assert result["success"] is False
        assert any("required" in str(err).lower() for err in result["errors"])

    def test_import_nonexistent_project(self, db):
        """Test error when project doesn't exist."""
        activate("en")
        FlagFactory(flag="TestFlag4")

        workbook = openpyxl.Workbook()
        sheet = workbook.active
        headers = ["Name", "Project", "Flag"]
        for col, header in enumerate(headers, start=1):
            sheet.cell(row=1, column=col, value=header)
        sheet.cell(row=2, column=1, value="TestConduit")
        sheet.cell(row=2, column=2, value="NonExistentProject")
        sheet.cell(row=2, column=3, value="TestFlag4")

        file_buffer = io.BytesIO()
        workbook.save(file_buffer)
        file_buffer.seek(0)

        result = import_conduits_from_excel(file_buffer)

        assert result["success"] is False
        assert any("not found" in str(err).lower() for err in result["errors"])

    def test_import_nonexistent_owner_company(self, db):
        """Test error when owner company doesn't exist."""
        activate("en")
        ProjectFactory(project="TestProject5")
        FlagFactory(flag="TestFlag5")

        workbook = openpyxl.Workbook()
        sheet = workbook.active
        headers = ["Name", "Owner", "Project", "Flag"]
        for col, header in enumerate(headers, start=1):
            sheet.cell(row=1, column=col, value=header)
        sheet.cell(row=2, column=1, value="TestConduit")
        sheet.cell(row=2, column=2, value="NonExistentCompany")
        sheet.cell(row=2, column=3, value="TestProject5")
        sheet.cell(row=2, column=4, value="TestFlag5")

        file_buffer = io.BytesIO()
        workbook.save(file_buffer)
        file_buffer.seek(0)

        result = import_conduits_from_excel(file_buffer)

        assert result["success"] is False
        assert any("not found" in str(err).lower() for err in result["errors"])

    def test_import_warns_about_unrecognized_columns(self, db):
        """Test that unrecognized columns generate warnings."""
        activate("en")
        ProjectFactory(project="TestProject6")
        FlagFactory(flag="TestFlag6")
        ConduitTypeFactory(conduit_type="TestType")

        workbook = openpyxl.Workbook()
        sheet = workbook.active
        headers = ["Name", "Type", "UnknownColumn", "Project", "Flag"]
        for col, header in enumerate(headers, start=1):
            sheet.cell(row=1, column=col, value=header)
        sheet.cell(row=2, column=1, value="TestConduit")
        sheet.cell(row=2, column=2, value="TestType")
        sheet.cell(row=2, column=3, value="SomeValue")
        sheet.cell(row=2, column=4, value="TestProject6")
        sheet.cell(row=2, column=5, value="TestFlag6")

        file_buffer = io.BytesIO()
        workbook.save(file_buffer)
        file_buffer.seek(0)

        result = import_conduits_from_excel(file_buffer)

        assert result["success"] is True
        assert "warnings" in result
        assert any("ignored" in str(w).lower() for w in result["warnings"])


@pytest.mark.django_db
class TestGenerateConduitImportTemplate:
    """Tests for the generate_conduit_import_template service function."""

    def test_generates_valid_excel_response(self):
        """Test that template generates a valid Excel HTTP response."""
        activate("en")
        response = generate_conduit_import_template()

        assert response.status_code == 200
        assert (
            response["Content-Type"]
            == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        assert "conduit_import_template.xlsx" in response["Content-Disposition"]

    def test_template_has_correct_headers(self):
        """Test that template has all required headers."""
        activate("en")
        response = generate_conduit_import_template()

        workbook = openpyxl.load_workbook(io.BytesIO(response.content))
        sheet = workbook.active

        expected_headers = [
            "Name",
            "Type",
            "Outer Conduit",
            "Status",
            "Network Level",
            "Owner",
            "Constructor",
            "Manufacturer",
            "Date",
            "Project",
            "Flag",
        ]
        actual_headers = [sheet.cell(row=1, column=i).value for i in range(1, 12)]

        assert actual_headers == expected_headers

    def test_template_has_example_row(self):
        """Test that template has an example data row."""
        activate("en")
        response = generate_conduit_import_template()

        workbook = openpyxl.load_workbook(io.BytesIO(response.content))
        sheet = workbook.active

        name_value = sheet.cell(row=2, column=1).value
        assert name_value == "RV1.1.1"


class TestHandleQgisFile:
    """Tests for the handle_qgis_file service function."""

    def test_handle_qgs_file(self):
        """Test handling of plain QGS file."""
        qgs_content = b'<?xml version="1.0"?><qgis></qgis>'
        result_content, is_qgz = handle_qgis_file(qgs_content, "test.qgs")

        assert result_content == qgs_content
        assert is_qgz is False

    def test_handle_qgz_file(self):
        """Test handling of QGZ archive file."""
        qgs_content = b'<?xml version="1.0"?><qgis></qgis>'

        qgz_buffer = io.BytesIO()
        with zipfile.ZipFile(qgz_buffer, "w") as zf:
            zf.writestr("project.qgs", qgs_content)
        qgz_buffer.seek(0)

        result_content, is_qgz = handle_qgis_file(qgz_buffer.getvalue(), "test.qgz")

        assert result_content == qgs_content
        assert is_qgz is True

    def test_handle_qgz_without_qgs_raises_error(self):
        """Test that QGZ without QGS file raises ValueError."""
        qgz_buffer = io.BytesIO()
        with zipfile.ZipFile(qgz_buffer, "w") as zf:
            zf.writestr("other.txt", b"some content")
        qgz_buffer.seek(0)

        with pytest.raises(ValueError, match="No .qgs file found"):
            handle_qgis_file(qgz_buffer.getvalue(), "test.qgz")


class TestRepackageQgz:
    """Tests for the repackage_qgz service function."""

    def test_repackage_qgz_preserves_other_files(self):
        """Test that repackage preserves non-QGS files."""
        original_qgs = b'<?xml version="1.0"?><qgis>original</qgis>'
        modified_qgs = b'<?xml version="1.0"?><qgis>modified</qgis>'
        other_content = b"other file content"

        qgz_buffer = io.BytesIO()
        with zipfile.ZipFile(qgz_buffer, "w") as zf:
            zf.writestr("project.qgs", original_qgs)
            zf.writestr("data.txt", other_content)
        qgz_buffer.seek(0)

        result = repackage_qgz(modified_qgs, qgz_buffer.getvalue())

        with zipfile.ZipFile(io.BytesIO(result), "r") as zf:
            assert zf.read("project.qgs") == modified_qgs
            assert zf.read("data.txt") == other_content


class TestConvertQgsToPostgres:
    """Tests for the convert_qgs_to_postgres service function."""

    def test_converts_gpkg_layers_to_postgres(self):
        """Test conversion of GeoPackage datasources to PostgreSQL."""
        qgs_content = b"""<?xml version="1.0"?>
        <qgis>
            <layer-tree-layer providerKey="ogr" source="./schema.gpkg|layername=trench"/>
            <maplayer>
                <provider>ogr</provider>
                <datasource>./schema.gpkg|layername=node</datasource>
            </maplayer>
        </qgis>
        """

        with patch("apps.api.services.settings") as mock_settings:
            mock_settings.QGIS_PG_SERVICE_NAME = "qonnectra"
            mock_settings.DEFAULT_SRID = 25832

            result = convert_qgs_to_postgres(qgs_content)

        assert b"postgres" in result
        assert b"service='qonnectra'" in result

    def test_preserves_non_gpkg_layers(self):
        """Test that non-GeoPackage layers are preserved."""
        qgs_content = b"""<?xml version="1.0"?>
        <qgis>
            <layer-tree-layer providerKey="wms" source="https://wms.example.com"/>
        </qgis>
        """

        with patch("apps.api.services.settings") as mock_settings:
            mock_settings.QGIS_PG_SERVICE_NAME = "qonnectra"
            mock_settings.DEFAULT_SRID = 25832

            result = convert_qgs_to_postgres(qgs_content)

        assert b'providerKey="wms"' in result


class TestExtractLayerNameFromGpkgSource:
    """Tests for the _extract_layer_name_from_gpkg_source helper."""

    def test_extracts_layer_name(self):
        """Test extraction of layer name from source string."""
        source = "./schema.gpkg|layername=address"
        result = _extract_layer_name_from_gpkg_source(source)
        assert result == "address"

    def test_returns_none_for_non_gpkg_source(self):
        """Test returns None for non-GeoPackage source."""
        source = "https://wms.example.com"
        result = _extract_layer_name_from_gpkg_source(source)
        assert result is None


class TestBuildPostgresDatasource:
    """Tests for the _build_postgres_datasource helper."""

    def test_builds_geometry_layer_datasource(self):
        """Test datasource string for geometry layer."""
        with patch("apps.api.services.settings") as mock_settings:
            mock_settings.DEFAULT_SRID = 25832

            result = _build_postgres_datasource("trench", "qonnectra", 25832)

        assert "service='qonnectra'" in result
        assert "trench" in result
        assert "LineString" in result
        assert "geom" in result

    def test_builds_non_geometry_layer_datasource(self):
        """Test datasource string for non-geometry layer."""
        result = _build_postgres_datasource("conduit", "qonnectra", 25832)

        assert "service='qonnectra'" in result
        assert "conduit" in result
        assert "geometry" not in result.lower() or "type=" not in result

    def test_returns_none_for_unknown_layer(self):
        """Test returns None for unknown layer name."""
        result = _build_postgres_datasource("unknown_layer", "qonnectra", 25832)
        assert result is None


class TestPostgresTypeToPandas:
    """Tests for the _postgres_type_to_pandas helper."""

    def test_maps_common_types(self):
        """Test mapping of common PostgreSQL types."""
        assert _postgres_type_to_pandas("uuid", "uuid") == "object"
        assert _postgres_type_to_pandas("character varying", "varchar") == "object"
        assert _postgres_type_to_pandas("integer", "int4") == "Int64"
        assert _postgres_type_to_pandas("double precision", "float8") == "float64"
        assert _postgres_type_to_pandas("boolean", "bool") == "boolean"

    def test_returns_object_for_unknown_type(self):
        """Test returns object for unknown types."""
        assert _postgres_type_to_pandas("unknown_type", "unknown") == "object"
