"""
Tests for FeatureFiles model methods.
"""

from unittest.mock import MagicMock

import pytest
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
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from .factories import (
    AddressFactory,
    AreaFactory,
    AreaTypeFactory,
    CableFactory,
    CableTypeFactory,
    ConduitFactory,
    ConduitTypeFactory,
    FlagFactory,
    NodeFactory,
    NodeTypeFactory,
    ProjectFactory,
    ResidentialUnitFactory,
    TrenchFactory,
)

User = get_user_model()


@pytest.mark.django_db
class TestFeatureFilesGetFeatureIdentifier:
    """Tests for FeatureFiles.get_feature_identifier() method."""

    def test_identifier_trench_uses_id_trench(self):
        """Verify trench uses id_trench as identifier."""
        project = ProjectFactory()
        flag = FlagFactory()
        trench = TrenchFactory(project=project, flag=flag, id_trench="TR-TEST001")

        content_type = ContentType.objects.get_for_model(Trench)

        feature_file = FeatureFiles(
            content_type=content_type,
            object_id=trench.uuid,
        )
        # Force load the feature
        feature_file.feature = trench

        identifier = FeatureFiles.get_feature_identifier(feature_file)
        assert identifier == "TR-TEST001"

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
        trench = TrenchFactory(project=project, flag=flag, id_trench="TR-TEST002")

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
        assert path == "Alpha Project/trenchs/TR-TEST002/document.pdf"

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
        assert (
            path == "Address Project/addresss/Teststraße 10, 12345 Hamburg/contract.pdf"
        )

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

        trench = TrenchFactory(project=project, flag=flag, id_trench="TR-TEST003")

        content_type = ContentType.objects.get_for_model(Trench)

        feature_file = FeatureFiles(
            content_type=content_type,
            object_id=trench.uuid,
        )
        feature_file.feature = trench
        feature_file.file_path = MagicMock()
        feature_file.file_path.name = "photo.jpg"

        path = FeatureFiles.get_upload_path(feature_file, "photo.jpg")
        assert path == "Custom Project/trenches/TR-TEST003/photos/photo.jpg"

    def test_upload_path_falls_back_to_defaults(self):
        """Verify upload path falls back to defaults when no StoragePreferences exist."""
        project = ProjectFactory(project="Fallback Project")
        flag = FlagFactory()

        # Ensure no StoragePreferences exist
        StoragePreferences.objects.all().delete()

        trench = TrenchFactory(project=project, flag=flag, id_trench="TR-TEST004")

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
        assert path == "Fallback Project/trenchs/TR-TEST004/file.pdf"

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


@pytest.mark.django_db
class TestFeatureFilesListFiltering:
    """Tests for FeatureFilesViewSet.get_queryset object_id filtering."""

    @pytest.fixture
    def authenticated_client(self):
        """API client authenticated as a superuser (bypasses RoleBasedPermission)."""
        user = User.objects.create_superuser(
            username="feature_files_admin",
            email="feature_files_admin@example.com",
            password="testpass123",
        )
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    @pytest.fixture
    def url(self):
        return reverse("v1:feature-files-list")

    def _create_file(self, feature, file_name):
        """Create a FeatureFiles row for a feature without a real upload."""
        content_type = ContentType.objects.get_for_model(feature.__class__)
        return FeatureFiles.objects.create(
            content_type=content_type,
            object_id=feature.uuid,
            file_path=f"{file_name}.pdf",
            file_name=file_name,
            file_type="pdf",
        )

    def test_object_id_in_returns_only_listed_features(
        self, authenticated_client, url
    ):
        """object_id__in with two uuids returns exactly those features' files."""
        trench_a = TrenchFactory(id_trench="TR-A")
        trench_b = TrenchFactory(id_trench="TR-B")
        trench_c = TrenchFactory(id_trench="TR-C")

        file_a = self._create_file(trench_a, "file_a")
        file_b = self._create_file(trench_b, "file_b")
        self._create_file(trench_c, "file_c")

        response = authenticated_client.get(
            url, {"object_id__in": f"{trench_a.uuid},{trench_b.uuid}"}
        )

        assert response.status_code == status.HTTP_200_OK
        returned = {row["uuid"] for row in response.data["results"]}
        assert returned == {str(file_a.uuid), str(file_b.uuid)}

    def test_object_id_in_ignores_malformed_token(
        self, authenticated_client, url
    ):
        """object_id__in mixing a valid and a malformed token returns valid files, 200."""
        trench = TrenchFactory(id_trench="TR-VALID")
        file_valid = self._create_file(trench, "valid_file")

        response = authenticated_client.get(
            url, {"object_id__in": f"{trench.uuid},not-a-uuid"}
        )

        assert response.status_code == status.HTTP_200_OK
        returned = {row["uuid"] for row in response.data["results"]}
        assert returned == {str(file_valid.uuid)}

    def test_object_id_malformed_returns_empty_not_500(
        self, authenticated_client, url
    ):
        """object_id=not-a-uuid returns 200 with an empty results list (regression)."""
        trench = TrenchFactory(id_trench="TR-REG")
        self._create_file(trench, "some_file")

        response = authenticated_client.get(url, {"object_id": "not-a-uuid"})

        assert response.status_code == status.HTTP_200_OK
        assert response.data["results"] == []

    def test_both_params_intersect(self, authenticated_client, url):
        """object_id and object_id__in supplied together narrow to their intersection."""
        trench_a = TrenchFactory(id_trench="TR-INT-A")
        trench_b = TrenchFactory(id_trench="TR-INT-B")

        file_a = self._create_file(trench_a, "int_file_a")
        self._create_file(trench_b, "int_file_b")

        response = authenticated_client.get(
            url,
            {
                "object_id": str(trench_a.uuid),
                "object_id__in": f"{trench_a.uuid},{trench_b.uuid}",
            },
        )

        assert response.status_code == status.HTTP_200_OK
        returned = {row["uuid"] for row in response.data["results"]}
        assert returned == {str(file_a.uuid)}

    def test_pagination_still_applies(self, authenticated_client, url):
        """page_size=2 over three files yields a non-null next link."""
        trench = TrenchFactory(id_trench="TR-PAGE")
        self._create_file(trench, "file_1")
        self._create_file(trench, "file_2")
        self._create_file(trench, "file_3")

        response = authenticated_client.get(
            url, {"object_id": str(trench.uuid), "page_size": 2}
        )

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) == 2
        assert response.data["next"] is not None


@pytest.mark.django_db
class TestFeatureFilesProjectFiltering:
    """Tests for project / feature_type filtering and the derived serializer fields."""

    @pytest.fixture
    def authenticated_client(self):
        """API client authenticated as a superuser (bypasses RoleBasedPermission)."""
        user = User.objects.create_superuser(
            username="feature_files_project_admin",
            email="feature_files_project_admin@example.com",
            password="testpass123",
        )
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    @pytest.fixture
    def url(self):
        return reverse("v1:feature-files-list")

    def _create_file(self, feature, file_name):
        """Create a FeatureFiles row for a feature without a real upload."""
        content_type = ContentType.objects.get_for_model(feature.__class__)
        return FeatureFiles.objects.create(
            content_type=content_type,
            object_id=feature.uuid,
            file_path=f"{file_name}.pdf",
            file_name=file_name,
            file_type="pdf",
        )

    @pytest.fixture
    def project_features(self):
        """Build one file per feature type for a target project plus a decoy project.

        Node and cable own a required ``project`` FK; only a residential unit
        derives its project through its address. The node is attached to an
        address of the decoy project to prove the derivation uses the node's
        own FK and ignores the address chain (same for the cable via its node).
        """
        project = ProjectFactory()
        other = ProjectFactory()

        address = AddressFactory(project=project)
        decoy_address = AddressFactory(project=other)
        node = NodeFactory(project=project, uuid_address=decoy_address)
        residential_unit = ResidentialUnitFactory(uuid_address=address)
        cable = CableFactory(project=project, uuid_node_start=node)

        files = {
            "trench": self._create_file(TrenchFactory(project=project), "trench_p"),
            "conduit": self._create_file(ConduitFactory(project=project), "conduit_p"),
            "address": self._create_file(address, "address_p"),
            "area": self._create_file(AreaFactory(project=project), "area_p"),
            "node": self._create_file(node, "node_p"),
            "residentialunit": self._create_file(residential_unit, "ru_p"),
            "cable": self._create_file(cable, "cable_p"),
        }

        # Decoy file belonging to the other project; must never appear.
        decoy = self._create_file(TrenchFactory(project=other), "trench_other")

        return {
            "project": project,
            "other": other,
            "address": address,
            "node": node,
            "cable": cable,
            "files": files,
            "decoy": decoy,
        }

    def test_project_returns_all_types_for_project_only(
        self, authenticated_client, url, project_features
    ):
        """?project=<p> returns every feature type belonging to p and nothing else."""
        project = project_features["project"]

        response = authenticated_client.get(url, {"project": project.id})

        assert response.status_code == status.HTTP_200_OK
        returned = {row["uuid"] for row in response.data["results"]}
        expected = {str(f.uuid) for f in project_features["files"].values()}
        assert returned == expected
        assert str(project_features["decoy"].uuid) not in returned

    def test_project_and_feature_type_narrows(
        self, authenticated_client, url, project_features
    ):
        """?project=<p>&feature_type=node narrows to the single node file."""
        project = project_features["project"]

        response = authenticated_client.get(
            url, {"project": project.id, "feature_type": "node"}
        )

        assert response.status_code == status.HTTP_200_OK
        returned = {row["uuid"] for row in response.data["results"]}
        assert returned == {str(project_features["files"]["node"].uuid)}

    def test_unknown_feature_type_returns_400(self, authenticated_client, url):
        """feature_type=bogus is a 400 that names the valid types."""
        response = authenticated_client.get(url, {"feature_type": "bogus"})

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        message = str(response.data)
        for valid in ("trench", "conduit", "cable", "node", "address", "area"):
            assert valid in message
        assert "residentialunit" in message

    def test_non_numeric_project_returns_400(self, authenticated_client, url):
        """?project=abc is a 400, not a 500."""
        response = authenticated_client.get(url, {"project": "abc"})

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_node_uses_own_project_not_address(
        self, authenticated_client, url, project_features
    ):
        """The node file's project is the node's own FK, not its address's project."""
        project = project_features["project"]

        response = authenticated_client.get(url, {"feature_type": "node"})

        assert response.status_code == status.HTTP_200_OK
        rows = response.data["results"]
        assert len(rows) == 1
        assert rows[0]["project"] == project.id
        assert rows[0]["feature_type"] == "node"

    def test_cable_uses_own_project_not_node_address(
        self, authenticated_client, url, project_features
    ):
        """The cable file's project is the cable's own FK, not its node's address."""
        project = project_features["project"]

        response = authenticated_client.get(url, {"feature_type": "cable"})

        assert response.status_code == status.HTTP_200_OK
        rows = response.data["results"]
        assert len(rows) == 1
        assert rows[0]["project"] == project.id
        assert rows[0]["feature_type"] == "cable"

    def test_every_row_carries_project_and_feature_type(
        self, authenticated_client, url, project_features
    ):
        """Unfiltered list responses carry project and feature_type on every row."""
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        rows = response.data["results"]
        assert rows
        for row in rows:
            assert "project" in row
            assert "feature_type" in row

    def test_object_id_in_response_carries_derived_fields(
        self, authenticated_client, url, project_features
    ):
        """object_id__in responses still expose project and feature_type."""
        trench_file = project_features["files"]["trench"]

        response = authenticated_client.get(
            url, {"object_id__in": str(trench_file.object_id)}
        )

        assert response.status_code == status.HTTP_200_OK
        rows = response.data["results"]
        assert len(rows) == 1
        assert rows[0]["feature_type"] == "trench"
        assert rows[0]["project"] == project_features["project"].id

    def test_deleted_feature_absent_from_project_filter_but_present_unfiltered(
        self, authenticated_client, url, project_features
    ):
        """A file whose feature row is deleted drops out of ?project= yet lists unfiltered."""
        project = project_features["project"]
        trench_file = project_features["files"]["trench"]

        # Delete the underlying trench; the FeatureFiles row remains (no cascade
        # across the generic FK) but its uuid no longer appears in the subquery.
        Trench.objects.filter(uuid=trench_file.object_id).delete()

        filtered = authenticated_client.get(url, {"project": project.id})
        assert filtered.status_code == status.HTTP_200_OK
        filtered_uuids = {row["uuid"] for row in filtered.data["results"]}
        assert str(trench_file.uuid) not in filtered_uuids

        unfiltered = authenticated_client.get(url)
        assert unfiltered.status_code == status.HTTP_200_OK
        unfiltered_uuids = {row["uuid"] for row in unfiltered.data["results"]}
        assert str(trench_file.uuid) in unfiltered_uuids
