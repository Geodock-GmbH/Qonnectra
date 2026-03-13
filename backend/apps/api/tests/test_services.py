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
from apps.api.models import Conduit, FeatureFiles, Microduct, Node
from apps.api.services import (
    _build_postgres_datasource,
    _extract_layer_name_from_gpkg_source,
    _postgres_type_to_pandas,
    convert_qgs_to_postgres,
    generate_conduit_import_template,
    handle_qgis_file,
    import_conduits_from_excel,
    move_file_to_feature,
    rename_feature_folder,
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
    NodeFactory,
    ProjectFactory,
    StatusFactory,
    StoragePreferencesFactory,
    TrenchFactory,
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
        ProjectFactory(project="TestProject2")
        FlagFactory(flag="TestFlag2")

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


@pytest.mark.django_db
class TestRenameFeatureFolder:
    """Tests for the rename_feature_folder service function."""

    @patch("apps.api.services.LocalMediaStorage")
    def test_rename_folder_success(self, mock_storage_class):
        """Test successful folder rename when folder exists."""
        project = ProjectFactory(project="TestProject")
        StoragePreferencesFactory(folder_structure={"node": {"default": "nodes"}})
        node = NodeFactory(name="OldNodeName", project=project)

        mock_storage = MagicMock()
        mock_storage.rename_folder.return_value = True
        mock_storage_class.return_value = mock_storage

        rename_feature_folder(node, "OldNodeName", "NewNodeName")

        mock_storage.rename_folder.assert_called_once()
        call_args = mock_storage.rename_folder.call_args[0]
        assert "OldNodeName" in call_args[0]
        assert "NewNodeName" in call_args[1]

    @patch("apps.api.services.LocalMediaStorage")
    def test_rename_folder_not_found(self, mock_storage_class):
        """Test rename when source folder doesn't exist (no files uploaded yet)."""
        project = ProjectFactory(project="TestProject")
        StoragePreferencesFactory(folder_structure={"node": {"default": "nodes"}})
        node = NodeFactory(name="NodeWithoutFiles", project=project)

        mock_storage = MagicMock()
        mock_storage.rename_folder.return_value = False
        mock_storage_class.return_value = mock_storage

        rename_feature_folder(node, "NodeWithoutFiles", "NewNodeName")

        mock_storage.rename_folder.assert_called_once()

    @patch("apps.api.services.LocalMediaStorage")
    def test_rename_folder_updates_file_paths(self, mock_storage_class):
        """Test that file paths are updated in database when folder is renamed."""
        from apps.api.models import FeatureFiles, Node
        from django.contrib.contenttypes.models import ContentType

        project = ProjectFactory(project="TestProject")
        StoragePreferencesFactory(folder_structure={"node": {"default": "nodes"}})
        node = NodeFactory(name="OldNodeName", project=project)
        content_type = ContentType.objects.get_for_model(Node)

        file_record = FeatureFiles.objects.create(
            content_type=content_type,
            object_id=node.pk,
            file_name="test_file",
            file_type="pdf",
        )
        file_record.file_path.name = "TestProject/nodes/OldNodeName/test_file.pdf"
        file_record.save()

        mock_storage = MagicMock()
        mock_storage.rename_folder.return_value = True
        mock_storage_class.return_value = mock_storage

        rename_feature_folder(node, "OldNodeName", "NewNodeName")

        file_record.refresh_from_db()
        assert "NewNodeName" in file_record.file_path.name
        assert "OldNodeName" not in file_record.file_path.name

    @patch("apps.api.services.LocalMediaStorage")
    def test_rename_folder_without_preferences(self, mock_storage_class):
        """Test folder rename when no storage preferences exist."""
        project = ProjectFactory(project="TestProject")
        node = NodeFactory(name="OldNodeName", project=project)

        mock_storage = MagicMock()
        mock_storage.rename_folder.return_value = True
        mock_storage_class.return_value = mock_storage

        rename_feature_folder(node, "OldNodeName", "NewNodeName")

        mock_storage.rename_folder.assert_called_once()
        call_args = mock_storage.rename_folder.call_args[0]
        assert "nodes" in call_args[0]

    @patch("apps.api.services.LocalMediaStorage")
    def test_rename_folder_for_trench(self, mock_storage_class):
        """Test folder rename for Trench model uses id_trench path."""
        project = ProjectFactory(project="TestProject")
        StoragePreferencesFactory(folder_structure={"trench": {"default": "trenches"}})
        trench = TrenchFactory(id_trench="TR-001", project=project)

        mock_storage = MagicMock()
        mock_storage.rename_folder.return_value = True
        mock_storage_class.return_value = mock_storage

        rename_feature_folder(trench, "TR-001", "TR-002")

        mock_storage.rename_folder.assert_called_once()
        call_args = mock_storage.rename_folder.call_args[0]
        assert "TR-001" in call_args[0]
        assert "TR-002" in call_args[1]


@pytest.mark.django_db
class TestMoveFileToFeature:
    """Tests for the move_file_to_feature service function."""

    @patch("apps.api.services.LocalMediaStorage")
    def test_move_file_success(self, mock_storage_class):
        """Test successful file move to another feature."""
        from django.contrib.contenttypes.models import ContentType

        project = ProjectFactory(project="TestProject")
        StoragePreferencesFactory(folder_structure={"node": {"default": "nodes"}})

        source_node = NodeFactory(name="SourceNode", project=project)
        target_node = NodeFactory(name="TargetNode", project=project)
        content_type = ContentType.objects.get_for_model(Node)

        file_record = FeatureFiles.objects.create(
            content_type=content_type,
            object_id=source_node.pk,
            file_name="test_file",
            file_type="pdf",
        )
        file_record.file_path.name = "TestProject/nodes/SourceNode/test_file.pdf"
        file_record.save()

        mock_file = MagicMock()
        mock_file.read.return_value = b"file content"

        mock_storage = MagicMock()
        mock_storage.exists.side_effect = (
            lambda path: path == "TestProject/nodes/SourceNode/test_file.pdf"
        )
        mock_storage.open.return_value = mock_file
        mock_storage.save.return_value = "TestProject/nodes/TargetNode/test_file.pdf"
        mock_storage.delete.return_value = None
        mock_storage_class.return_value = mock_storage

        success, new_path, error = move_file_to_feature(
            file_record, target_node, content_type
        )

        assert success is True
        assert new_path is not None
        assert "TargetNode" in new_path
        assert error is None

    @patch("apps.api.services.LocalMediaStorage")
    def test_move_file_source_not_found(self, mock_storage_class):
        """Test move when source file doesn't exist on disk."""
        from django.contrib.contenttypes.models import ContentType

        project = ProjectFactory(project="TestProject")
        StoragePreferencesFactory(folder_structure={"node": {"default": "nodes"}})

        source_node = NodeFactory(name="SourceNode", project=project)
        target_node = NodeFactory(name="TargetNode", project=project)
        content_type = ContentType.objects.get_for_model(Node)

        file_record = FeatureFiles.objects.create(
            content_type=content_type,
            object_id=source_node.pk,
            file_name="nonexistent_file",
            file_type="pdf",
        )
        file_record.file_path.name = "TestProject/nodes/SourceNode/nonexistent_file.pdf"
        file_record.save()

        mock_storage = MagicMock()
        mock_storage.exists.return_value = False
        mock_storage_class.return_value = mock_storage

        success, new_path, error = move_file_to_feature(
            file_record, target_node, content_type
        )

        assert success is True
        assert new_path is not None
        mock_storage.save.assert_not_called()
        mock_storage.delete.assert_not_called()

    @patch("apps.api.services.LocalMediaStorage")
    def test_move_file_target_exists(self, mock_storage_class):
        """Test move fails when file already exists at target path."""
        from django.contrib.contenttypes.models import ContentType

        project = ProjectFactory(project="TestProject")
        StoragePreferencesFactory(folder_structure={"node": {"default": "nodes"}})

        source_node = NodeFactory(name="SourceNode", project=project)
        target_node = NodeFactory(name="TargetNode", project=project)
        content_type = ContentType.objects.get_for_model(Node)

        file_record = FeatureFiles.objects.create(
            content_type=content_type,
            object_id=source_node.pk,
            file_name="test_file",
            file_type="pdf",
        )
        file_record.file_path.name = "TestProject/nodes/SourceNode/test_file.pdf"
        file_record.save()

        mock_storage = MagicMock()
        mock_storage.exists.return_value = True
        mock_storage_class.return_value = mock_storage

        success, new_path, error = move_file_to_feature(
            file_record, target_node, content_type
        )

        assert success is False
        assert new_path is None
        assert "already exists" in error

    @patch("apps.api.services.LocalMediaStorage")
    def test_move_file_storage_error(self, mock_storage_class):
        """Test move handles storage errors gracefully."""
        from django.contrib.contenttypes.models import ContentType

        project = ProjectFactory(project="TestProject")
        StoragePreferencesFactory(folder_structure={"node": {"default": "nodes"}})

        source_node = NodeFactory(name="SourceNode", project=project)
        target_node = NodeFactory(name="TargetNode", project=project)
        content_type = ContentType.objects.get_for_model(Node)

        file_record = FeatureFiles.objects.create(
            content_type=content_type,
            object_id=source_node.pk,
            file_name="test_file",
            file_type="pdf",
        )
        file_record.file_path.name = "TestProject/nodes/SourceNode/test_file.pdf"
        file_record.save()

        mock_storage = MagicMock()
        mock_storage.exists.side_effect = [False, True]
        mock_storage.open.side_effect = Exception("Storage error")
        mock_storage_class.return_value = mock_storage

        success, new_path, error = move_file_to_feature(
            file_record, target_node, content_type
        )

        assert success is False
        assert new_path is None
        assert "Storage error" in error

    @patch("apps.api.services.LocalMediaStorage")
    def test_move_file_to_trench(self, mock_storage_class):
        """Test move file to a trench feature uses id_trench."""
        from django.contrib.contenttypes.models import ContentType
        from apps.api.models import Trench

        project = ProjectFactory(project="TestProject")
        StoragePreferencesFactory(folder_structure={"trench": {"default": "trenches"}})

        source_node = NodeFactory(name="SourceNode", project=project)
        target_trench = TrenchFactory(id_trench="TR-001", project=project)
        node_content_type = ContentType.objects.get_for_model(Node)
        trench_content_type = ContentType.objects.get_for_model(Trench)

        file_record = FeatureFiles.objects.create(
            content_type=node_content_type,
            object_id=source_node.pk,
            file_name="test_file",
            file_type="pdf",
        )
        file_record.file_path.name = "TestProject/nodes/SourceNode/test_file.pdf"
        file_record.save()

        mock_file = MagicMock()
        mock_file.read.return_value = b"file content"

        mock_storage = MagicMock()
        mock_storage.exists.side_effect = (
            lambda path: path == "TestProject/nodes/SourceNode/test_file.pdf"
        )
        mock_storage.open.return_value = mock_file
        mock_storage.save.return_value = "TestProject/trenches/TR-001/test_file.pdf"
        mock_storage.delete.return_value = None
        mock_storage_class.return_value = mock_storage

        success, new_path, error = move_file_to_feature(
            file_record, target_trench, trench_content_type
        )

        assert success is True
        assert new_path is not None
        assert "TR-001" in new_path
        assert error is None
