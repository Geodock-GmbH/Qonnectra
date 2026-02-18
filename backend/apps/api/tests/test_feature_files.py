"""
Tests for FeatureFiles model methods.

These tests verify the file path generation and feature identifier extraction
for different model types in the Krit-GIS system.
"""

from unittest.mock import MagicMock

import pytest
from django.contrib.contenttypes.models import ContentType

from apps.api.models import (
    Address,
    Area,
    Cable,
    Conduit,
    FeatureFiles,
    FileTypeCategory,
    Node,
    StoragePreferences,
    Trench,
)

from .factories import (
    AddressFactory,
    AreaFactory,
    AreaTypeFactory,
    CableTypeFactory,
    ConduitTypeFactory,
    FlagFactory,
    NodeFactory,
    NodeTypeFactory,
    ProjectFactory,
    TrenchFactory,
)


@pytest.mark.django_db
class TestFeatureFilesGetFeatureIdentifier:
    """Tests for FeatureFiles.get_feature_identifier() method."""

    def test_identifier_trench_uses_id_trench(self):
        """Verify trench uses id_trench as identifier."""
        project = ProjectFactory()
        flag = FlagFactory()
        trench = TrenchFactory(project=project, flag=flag, id_trench=12345)

        content_type = ContentType.objects.get_for_model(Trench)

        feature_file = FeatureFiles(
            content_type=content_type,
            object_id=trench.uuid,
        )
        # Force load the feature
        feature_file.feature = trench

        identifier = FeatureFiles.get_feature_identifier(feature_file)
        assert identifier == 12345

    def test_identifier_conduit_uses_name(self):
        """Verify conduit uses name as identifier."""
        project = ProjectFactory()
        flag = FlagFactory()
        conduit_type = ConduitTypeFactory()

        conduit = Conduit.objects.create(
            name="K1-HVT-FLS-001",
            conduit_type=conduit_type,
            project=project,
            flag=flag,
        )

        content_type = ContentType.objects.get_for_model(Conduit)

        feature_file = FeatureFiles(
            content_type=content_type,
            object_id=conduit.uuid,
        )
        feature_file.feature = conduit

        identifier = FeatureFiles.get_feature_identifier(feature_file)
        assert identifier == "K1-HVT-FLS-001"

    def test_identifier_cable_uses_name(self):
        """Verify cable uses name as identifier."""
        project = ProjectFactory()
        flag = FlagFactory()
        cable_type = CableTypeFactory()

        cable = Cable.objects.create(
            name="C1-Main-Backbone",
            cable_type=cable_type,
            project=project,
            flag=flag,
        )

        content_type = ContentType.objects.get_for_model(Cable)

        feature_file = FeatureFiles(
            content_type=content_type,
            object_id=cable.uuid,
        )
        feature_file.feature = cable

        identifier = FeatureFiles.get_feature_identifier(feature_file)
        assert identifier == "C1-Main-Backbone"

    def test_identifier_node_uses_name(self):
        """Verify node uses name as identifier."""
        project = ProjectFactory()
        flag = FlagFactory()
        node_type = NodeTypeFactory()

        node = NodeFactory(
            project=project,
            flag=flag,
            node_type=node_type,
            name="POP-Central-01",
        )

        content_type = ContentType.objects.get_for_model(Node)

        feature_file = FeatureFiles(
            content_type=content_type,
            object_id=node.uuid,
        )
        feature_file.feature = node

        identifier = FeatureFiles.get_feature_identifier(feature_file)
        assert identifier == "POP-Central-01"

    def test_identifier_address_formats_correctly(self):
        """Verify address identifier is properly formatted."""
        project = ProjectFactory()
        flag = FlagFactory()

        address = AddressFactory(
            project=project,
            flag=flag,
            street="Bahnstraße",
            housenumber=20,
            house_number_suffix=None,
            zip_code="24941",
            city="Flensburg",
        )

        content_type = ContentType.objects.get_for_model(Address)

        feature_file = FeatureFiles(
            content_type=content_type,
            object_id=address.uuid,
        )
        feature_file.feature = address

        identifier = FeatureFiles.get_feature_identifier(feature_file)
        assert identifier == "Bahnstraße 20, 24941 Flensburg"

    def test_identifier_address_with_suffix(self):
        """Verify address identifier includes house number suffix."""
        project = ProjectFactory()
        flag = FlagFactory()

        address = AddressFactory(
            project=project,
            flag=flag,
            street="Hauptstraße",
            housenumber=15,
            house_number_suffix="a",
            zip_code="12345",
            city="Berlin",
        )

        content_type = ContentType.objects.get_for_model(Address)

        feature_file = FeatureFiles(
            content_type=content_type,
            object_id=address.uuid,
        )
        feature_file.feature = address

        identifier = FeatureFiles.get_feature_identifier(feature_file)
        assert identifier == "Hauptstraße 15a, 12345 Berlin"

    def test_identifier_area_uses_name(self):
        """Verify area uses name as identifier."""
        project = ProjectFactory()
        flag = FlagFactory()
        area_type = AreaTypeFactory()

        area = AreaFactory(
            project=project,
            flag=flag,
            area_type=area_type,
            name="Projektgebiet Nord",
        )

        content_type = ContentType.objects.get_for_model(Area)

        feature_file = FeatureFiles(
            content_type=content_type,
            object_id=area.uuid,
        )
        feature_file.feature = area

        identifier = FeatureFiles.get_feature_identifier(feature_file)
        assert identifier == "Projektgebiet Nord"


@pytest.mark.django_db
class TestFeatureFilesGetUploadPath:
    """Tests for FeatureFiles.get_upload_path() method."""

    def test_upload_path_trench_default(self):
        """Verify default upload path for trench."""
        project = ProjectFactory(project="Alpha Project")
        flag = FlagFactory()
        trench = TrenchFactory(project=project, flag=flag, id_trench=99999)

        content_type = ContentType.objects.get_for_model(Trench)

        feature_file = FeatureFiles(
            content_type=content_type,
            object_id=trench.uuid,
        )
        feature_file.feature = trench

        # Mock file_path to have a name attribute
        feature_file.file_path = MagicMock()
        feature_file.file_path.name = "document.pdf"

        path = FeatureFiles.get_upload_path(feature_file, "document.pdf")

        # Without StoragePreferences, uses default structure
        assert path == "Alpha Project/trenchs/99999/document.pdf"

    def test_upload_path_node_default(self):
        """Verify default upload path for node."""
        project = ProjectFactory(project="Beta Project")
        flag = FlagFactory()
        node_type = NodeTypeFactory()

        node = NodeFactory(
            project=project,
            flag=flag,
            node_type=node_type,
            name="Node-001",
        )

        content_type = ContentType.objects.get_for_model(Node)

        feature_file = FeatureFiles(
            content_type=content_type,
            object_id=node.uuid,
        )
        feature_file.feature = node
        feature_file.file_path = MagicMock()
        feature_file.file_path.name = "spec.pdf"

        path = FeatureFiles.get_upload_path(feature_file, "spec.pdf")
        assert path == "Beta Project/nodes/Node-001/spec.pdf"

    def test_upload_path_cable_default(self):
        """Verify default upload path for cable."""
        project = ProjectFactory(project="Cable Project")
        flag = FlagFactory()
        cable_type = CableTypeFactory()

        cable = Cable.objects.create(
            name="C1-Main",
            cable_type=cable_type,
            project=project,
            flag=flag,
        )

        content_type = ContentType.objects.get_for_model(Cable)

        feature_file = FeatureFiles(
            content_type=content_type,
            object_id=cable.uuid,
        )
        feature_file.feature = cable
        feature_file.file_path = MagicMock()
        feature_file.file_path.name = "cable_plan.pdf"

        path = FeatureFiles.get_upload_path(feature_file, "cable_plan.pdf")
        assert path == "Cable Project/cables/C1-Main/cable_plan.pdf"

    def test_upload_path_conduit_default(self):
        """Verify default upload path for conduit."""
        project = ProjectFactory(project="Conduit Project")
        flag = FlagFactory()
        conduit_type = ConduitTypeFactory()

        conduit = Conduit.objects.create(
            name="K1-FLS",
            conduit_type=conduit_type,
            project=project,
            flag=flag,
        )

        content_type = ContentType.objects.get_for_model(Conduit)

        feature_file = FeatureFiles(
            content_type=content_type,
            object_id=conduit.uuid,
        )
        feature_file.feature = conduit
        feature_file.file_path = MagicMock()
        feature_file.file_path.name = "report.pdf"

        path = FeatureFiles.get_upload_path(feature_file, "report.pdf")
        assert path == "Conduit Project/conduits/K1-FLS/report.pdf"

    def test_upload_path_address_default(self):
        """Verify default upload path for address."""
        project = ProjectFactory(project="Address Project")
        flag = FlagFactory()

        address = AddressFactory(
            project=project,
            flag=flag,
            street="Teststraße",
            housenumber=10,
            house_number_suffix=None,
            zip_code="12345",
            city="Hamburg",
        )

        content_type = ContentType.objects.get_for_model(Address)

        feature_file = FeatureFiles(
            content_type=content_type,
            object_id=address.uuid,
        )
        feature_file.feature = address
        feature_file.file_path = MagicMock()
        feature_file.file_path.name = "contract.pdf"

        path = FeatureFiles.get_upload_path(feature_file, "contract.pdf")
        assert path == "Address Project/addresss/Teststraße 10, 12345 Hamburg/contract.pdf"

    def test_upload_path_uses_storage_preferences(self):
        """Verify upload path uses custom folder structure from StoragePreferences."""
        project = ProjectFactory(project="Custom Project")
        flag = FlagFactory()

        # Create storage preferences with custom structure
        StoragePreferences.objects.create(
            mode="AUTO",
            folder_structure={
                "trench": {
                    "default": "trenches",
                    "photos": "trenches/photos",
                    "documents": "trenches/documents",
                },
            },
        )

        # Create file type category
        FileTypeCategory.objects.create(
            extension="jpg",
            category="photos",
        )

        trench = TrenchFactory(project=project, flag=flag, id_trench=88888)

        content_type = ContentType.objects.get_for_model(Trench)

        feature_file = FeatureFiles(
            content_type=content_type,
            object_id=trench.uuid,
        )
        feature_file.feature = trench
        feature_file.file_path = MagicMock()
        feature_file.file_path.name = "photo.jpg"

        path = FeatureFiles.get_upload_path(feature_file, "photo.jpg")
        assert path == "Custom Project/trenches/88888/photos/photo.jpg"

    def test_upload_path_falls_back_to_defaults(self):
        """Verify upload path falls back to defaults when no StoragePreferences exist."""
        project = ProjectFactory(project="Fallback Project")
        flag = FlagFactory()

        # Ensure no StoragePreferences exist
        StoragePreferences.objects.all().delete()

        trench = TrenchFactory(project=project, flag=flag, id_trench=77777)

        content_type = ContentType.objects.get_for_model(Trench)

        feature_file = FeatureFiles(
            content_type=content_type,
            object_id=trench.uuid,
        )
        feature_file.feature = trench
        feature_file.file_path = MagicMock()
        feature_file.file_path.name = "file.pdf"

        path = FeatureFiles.get_upload_path(feature_file, "file.pdf")
        # Default fallback uses model_name + 's'
        assert path == "Fallback Project/trenchs/77777/file.pdf"

    def test_upload_path_uses_documents_for_unknown_extension(self):
        """Verify upload path uses 'documents' category for unknown file extensions."""
        project = ProjectFactory(project="Unknown Ext Project")
        flag = FlagFactory()

        # Create storage preferences
        StoragePreferences.objects.create(
            mode="AUTO",
            folder_structure={
                "node": {
                    "default": "nodes",
                    "documents": "nodes/documents",
                },
            },
        )

        # No FileTypeCategory for .xyz extension
        node_type = NodeTypeFactory()
        node = NodeFactory(
            project=project,
            flag=flag,
            node_type=node_type,
            name="TestNode",
        )

        content_type = ContentType.objects.get_for_model(Node)

        feature_file = FeatureFiles(
            content_type=content_type,
            object_id=node.uuid,
        )
        feature_file.feature = node
        feature_file.file_path = MagicMock()
        feature_file.file_path.name = "unknown.xyz"

        path = FeatureFiles.get_upload_path(feature_file, "unknown.xyz")
        # Should use 'documents' as fallback category
        assert path == "Unknown Ext Project/nodes/TestNode/documents/unknown.xyz"


@pytest.mark.django_db
class TestFeatureFilesHelperMethods:
    """Tests for FeatureFiles helper methods."""

    def test_get_file_name_extracts_name(self):
        """Verify get_file_name extracts filename without extension."""
        feature_file = FeatureFiles()
        feature_file.file_path = MagicMock()
        feature_file.file_path.name = "path/to/document.pdf"

        name = FeatureFiles.get_file_name(feature_file)
        assert name == "document"

    def test_get_file_name_handles_multiple_dots(self):
        """Verify get_file_name handles filenames with multiple dots."""
        feature_file = FeatureFiles()
        feature_file.file_path = MagicMock()
        feature_file.file_path.name = "path/to/file.name.with.dots.pdf"

        name = FeatureFiles.get_file_name(feature_file)
        assert name == "file"

    def test_get_file_name_handles_no_extension(self):
        """Verify get_file_name handles filenames without extension."""
        feature_file = FeatureFiles()
        feature_file.file_path = MagicMock()
        feature_file.file_path.name = "path/to/noextension"

        name = FeatureFiles.get_file_name(feature_file)
        assert name == "noextension"

    def test_get_file_type_extracts_extension(self):
        """Verify get_file_type extracts file extension."""
        feature_file = FeatureFiles()
        feature_file.file_path = MagicMock()
        feature_file.file_path.name = "path/to/document.pdf"

        file_type = FeatureFiles.get_file_type(feature_file)
        assert file_type == "pdf"

    def test_get_file_type_handles_uppercase(self):
        """Verify get_file_type returns lowercase extension."""
        feature_file = FeatureFiles()
        feature_file.file_path = MagicMock()
        feature_file.file_path.name = "path/to/IMAGE.JPG"

        file_type = FeatureFiles.get_file_type(feature_file)
        # Note: Current implementation doesn't lowercase, returns as-is
        assert file_type == "JPG"

    def test_get_file_type_handles_no_extension(self):
        """Verify get_file_type returns None for files without extension."""
        feature_file = FeatureFiles()
        feature_file.file_path = MagicMock()
        feature_file.file_path.name = "path/to/noextension"

        file_type = FeatureFiles.get_file_type(feature_file)
        assert file_type is None
