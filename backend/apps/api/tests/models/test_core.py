"""Tests for core models: Projects, Flags, Address, Area, ResidentialUnit, CanvasSyncStatus, QGISProject."""

from datetime import timedelta

import pytest
from django.core.files.base import ContentFile
from django.contrib.gis.geos import Point, Polygon
from django.db import IntegrityError
from django.utils import timezone

from apps.api.models import (
    Address,
    Area,
    AttributesResidentialUnitStatus,
    AttributesResidentialUnitType,
    CanvasSyncStatus,
    Flags,
    Projects,
    QGISProject,
    ResidentialUnit,
)

from ..factories import (
    AddressFactory,
    AreaTypeFactory,
    FlagFactory,
    ProjectFactory,
)


@pytest.mark.django_db
class TestCanvasSyncStatusModel:
    """Test the CanvasSyncStatus model functionality."""

    def test_sync_key_generation_project_only(self):
        """Test sync key generation for project-only scenarios."""
        key = CanvasSyncStatus.get_sync_key(project_id=1)
        assert key == "project_1"

    def test_sync_key_generation_project_and_flag(self):
        """Test sync key generation for project and flag combinations."""
        key = CanvasSyncStatus.get_sync_key(project_id=1, flag_id=5)
        assert key == "project_1_flag_5"

    def test_sync_key_generation_different_ids(self):
        """Test sync key generation with various ID combinations."""
        key1 = CanvasSyncStatus.get_sync_key(project_id=10)
        key2 = CanvasSyncStatus.get_sync_key(project_id=10, flag_id=20)

        assert key1 == "project_10"
        assert key2 == "project_10_flag_20"
        assert key1 != key2

    def test_sync_status_creation(self, user):
        """Test creating a CanvasSyncStatus instance."""
        sync_status = CanvasSyncStatus.objects.create(
            sync_key="project_1", status="IDLE", started_by=user
        )

        assert sync_status.sync_key == "project_1"
        assert sync_status.status == "IDLE"
        assert sync_status.started_by == user
        assert sync_status.started_at is None
        assert sync_status.completed_at is None

    def test_sync_key_uniqueness(self, user):
        """Test that sync_key must be unique."""
        CanvasSyncStatus.objects.create(
            sync_key="project_1", status="IDLE", started_by=user
        )

        with pytest.raises(IntegrityError):
            CanvasSyncStatus.objects.create(
                sync_key="project_1", status="IN_PROGRESS", started_by=user
            )

    def test_is_stale_no_heartbeat(self, user):
        """Test stale detection when no heartbeat is set."""
        sync_status = CanvasSyncStatus.objects.create(
            sync_key="project_1", status="IN_PROGRESS", started_by=user
        )

        assert sync_status.is_stale() is True

    def test_is_stale_fresh_heartbeat(self, user):
        """Test stale detection with fresh heartbeat."""
        sync_status = CanvasSyncStatus.objects.create(
            sync_key="project_1",
            status="IN_PROGRESS",
            started_by=user,
            last_heartbeat=timezone.now(),
        )

        assert sync_status.is_stale() is False

    def test_is_stale_old_heartbeat(self, user):
        """Test stale detection with old heartbeat."""
        old_time = timezone.now() - timedelta(minutes=15)
        sync_status = CanvasSyncStatus.objects.create(
            sync_key="project_1",
            status="IN_PROGRESS",
            started_by=user,
            last_heartbeat=old_time,
        )

        assert sync_status.is_stale(timeout_minutes=10) is True

    def test_is_stale_custom_timeout(self, user):
        """Test stale detection with custom timeout."""
        recent_time = timezone.now() - timedelta(minutes=5)
        sync_status = CanvasSyncStatus.objects.create(
            sync_key="project_1",
            status="IN_PROGRESS",
            started_by=user,
            last_heartbeat=recent_time,
        )

        assert sync_status.is_stale(timeout_minutes=10) is False
        assert sync_status.is_stale(timeout_minutes=2) is True

    def test_update_heartbeat(self, user):
        """Test heartbeat update functionality."""
        sync_status = CanvasSyncStatus.objects.create(
            sync_key="project_1", status="IN_PROGRESS", started_by=user
        )

        initial_heartbeat = sync_status.last_heartbeat
        sync_status.update_heartbeat()
        sync_status.refresh_from_db()

        assert sync_status.last_heartbeat is not None
        assert initial_heartbeat != sync_status.last_heartbeat

    def test_cleanup_stale_syncs_no_stale(self, user):
        """Test cleanup when no stale syncs exist."""
        CanvasSyncStatus.objects.create(
            sync_key="project_1",
            status="IN_PROGRESS",
            started_by=user,
            last_heartbeat=timezone.now(),
        )

        initial_count = CanvasSyncStatus.objects.count()
        CanvasSyncStatus.cleanup_stale_syncs()

        assert CanvasSyncStatus.objects.count() == initial_count

        sync_status = CanvasSyncStatus.objects.get(sync_key="project_1")
        assert sync_status.status == "IN_PROGRESS"

    def test_cleanup_stale_syncs_with_stale(self, user):
        """Test cleanup of stale sync operations."""
        old_time = timezone.now() - timedelta(minutes=15)

        stale_sync = CanvasSyncStatus.objects.create(
            sync_key="project_1",
            status="IN_PROGRESS",
            started_by=user,
            last_heartbeat=old_time,
        )

        fresh_sync = CanvasSyncStatus.objects.create(
            sync_key="project_2",
            status="IN_PROGRESS",
            started_by=user,
            last_heartbeat=timezone.now(),
        )

        CanvasSyncStatus.cleanup_stale_syncs(timeout_minutes=10)

        stale_sync.refresh_from_db()
        fresh_sync.refresh_from_db()

        assert stale_sync.status == "FAILED"
        assert stale_sync.completed_at is not None
        assert stale_sync.error_message == "Sync operation timed out"

        assert fresh_sync.status == "IN_PROGRESS"
        assert fresh_sync.completed_at is None

    def test_cleanup_stale_syncs_only_in_progress(self, user):
        """Test that cleanup only affects IN_PROGRESS syncs."""
        old_time = timezone.now() - timedelta(minutes=15)

        completed_sync = CanvasSyncStatus.objects.create(
            sync_key="project_1",
            status="COMPLETED",
            started_by=user,
            last_heartbeat=old_time,
        )

        failed_sync = CanvasSyncStatus.objects.create(
            sync_key="project_2",
            status="FAILED",
            started_by=user,
            last_heartbeat=old_time,
        )

        in_progress_sync = CanvasSyncStatus.objects.create(
            sync_key="project_3",
            status="IN_PROGRESS",
            started_by=user,
            last_heartbeat=old_time,
        )

        CanvasSyncStatus.cleanup_stale_syncs(timeout_minutes=10)

        completed_sync.refresh_from_db()
        failed_sync.refresh_from_db()
        in_progress_sync.refresh_from_db()

        assert completed_sync.status == "COMPLETED"
        assert failed_sync.status == "FAILED"
        assert in_progress_sync.status == "FAILED"

    def test_str_representation(self, user):
        """Test string representation of CanvasSyncStatus."""
        sync_status = CanvasSyncStatus.objects.create(
            sync_key="project_1_flag_5", status="IN_PROGRESS", started_by=user
        )

        expected_str = "project_1_flag_5 - IN_PROGRESS"
        assert str(sync_status) == expected_str

    def test_sync_metadata_storage(self, user):
        """Test storage of sync metadata."""
        sync_status = CanvasSyncStatus.objects.create(
            sync_key="project_1",
            status="COMPLETED",
            started_by=user,
            scale=0.5,
            center_x=1000.5,
            center_y=2000.75,
            nodes_processed=150,
        )

        assert sync_status.scale == 0.5
        assert sync_status.center_x == 1000.5
        assert sync_status.center_y == 2000.75
        assert sync_status.nodes_processed == 150

    def test_status_choices_validation(self, user):
        """Test that only valid status choices are accepted."""
        valid_statuses = ["IDLE", "IN_PROGRESS", "COMPLETED", "FAILED"]

        for status in valid_statuses:
            sync_status = CanvasSyncStatus.objects.create(
                sync_key=f"project_{status}", status=status, started_by=user
            )
            assert sync_status.status == status


@pytest.mark.django_db
class TestProjectsModel:
    """Tests for the Projects model."""

    def test_project_creation(self):
        """Test creating a project."""
        project = Projects.objects.create(
            project="Test Project",
            description="A test project description",
            active=True,
        )
        assert project.project == "Test Project"
        assert project.description == "A test project description"
        assert project.active is True

    def test_project_str_representation(self):
        """Test project string representation."""
        project = ProjectFactory(project="My Project")
        assert str(project) == "My Project"

    def test_project_name_unique(self):
        """Test that project name must be unique."""
        Projects.objects.create(project="Unique Project", active=True)
        with pytest.raises(IntegrityError):
            Projects.objects.create(project="Unique Project", active=True)

    def test_project_default_active(self):
        """Test that projects are active by default."""
        project = Projects.objects.create(project="Default Active")
        assert project.active is True


@pytest.mark.django_db
class TestFlagsModel:
    """Tests for the Flags model."""

    def test_flag_creation(self):
        """Test creating a flag."""
        flag = Flags.objects.create(flag="Test Flag")
        assert flag.flag == "Test Flag"

    def test_flag_str_representation(self):
        """Test flag string representation."""
        flag = FlagFactory(flag="My Flag")
        assert str(flag) == "My Flag"

    def test_flag_name_unique(self):
        """Test that flag name must be unique."""
        Flags.objects.create(flag="Unique Flag")
        with pytest.raises(IntegrityError):
            Flags.objects.create(flag="Unique Flag")


@pytest.mark.django_db
class TestAddressModel:
    """Tests for the Address model."""

    def test_address_creation(self):
        """Test creating an address."""
        project = ProjectFactory()
        flag = FlagFactory()

        address = Address.objects.create(
            zip_code="24941",
            city="Flensburg",
            street="Teststraße",
            housenumber=42,
            geom=Point(9.45, 54.78, srid=25832),
            project=project,
            flag=flag,
        )

        assert address.uuid is not None
        assert address.city == "Flensburg"
        assert address.housenumber == 42

    def test_address_with_suffix(self):
        """Test address with house number suffix."""
        address = AddressFactory(
            housenumber=10,
            house_number_suffix="a",
        )

        assert address.housenumber == 10
        assert address.house_number_suffix == "a"


@pytest.mark.django_db
class TestAreaModel:
    """Tests for the Area model."""

    def test_area_creation(self):
        """Test creating an area with polygon geometry."""
        project = ProjectFactory()
        flag = FlagFactory()
        area_type = AreaTypeFactory()

        polygon = Polygon(((0, 0), (100, 0), (100, 100), (0, 100), (0, 0)), srid=25832)

        area = Area.objects.create(
            name="Test Area",
            area_type=area_type,
            geom=polygon,
            project=project,
            flag=flag,
        )

        assert area.uuid is not None
        assert area.name == "Test Area"
        assert area.area_type == area_type


@pytest.mark.django_db
class TestResidentialUnitModel:
    """Tests for the ResidentialUnit model."""

    def test_residential_unit_creation(self):
        """Test creating a residential unit."""
        address = AddressFactory()
        unit = ResidentialUnit.objects.create(
            uuid_address=address,
            floor=2,
            side="left",
        )
        assert unit.uuid is not None
        assert unit.uuid_address == address
        assert unit.floor == 2

    def test_residential_unit_str_representation(self):
        """Test residential unit string representation."""
        address = AddressFactory(street="Teststraße", housenumber=10)
        unit = ResidentialUnit.objects.create(
            uuid_address=address,
            floor=1,
            side="right",
        )
        assert str(unit) is not None

    def test_residential_unit_with_type_and_status(self):
        """Test residential unit with type and status."""
        address = AddressFactory()
        unit_type = AttributesResidentialUnitType.objects.create(
            residential_unit_type="Wohnung"
        )
        status = AttributesResidentialUnitStatus.objects.create(status="Vermietet")

        unit = ResidentialUnit.objects.create(
            uuid_address=address,
            residential_unit_type=unit_type,
            status=status,
        )
        assert unit.residential_unit_type == unit_type
        assert unit.status == status


@pytest.mark.django_db
class TestQGISProjectModel:
    """Tests for QGISProject model methods."""

    def test_get_wfs3_url(self, user):
        """Should return correct WFS3 URL."""
        project = QGISProject.objects.create(
            name="test-project",
            display_name="Test Project",
            description="A test project",
            created_by=user,
        )
        project.project_file.save("test-project.qgz", ContentFile(b"fake qgz content"))

        url = project.get_wfs3_url()
        assert url == f"/api/v1/wfs3/{project.name}/"

    def test_map_path_property(self, user):
        """Should return correct MAP path."""
        project = QGISProject.objects.create(
            name="test-project",
            display_name="Test Project",
            description="A test project",
            created_by=user,
        )
        project.project_file.save("test-project.qgz", ContentFile(b"fake qgz content"))

        map_path = project.map_path
        assert map_path == f"/projects/{project.name}.qgz"
