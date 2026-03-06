from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import LineString, Point, Polygon
from django.db import IntegrityError
from django.utils import timezone

from apps.api.models import (
    Address,
    Area,
    AttributesCompany,
    AttributesConduitType,
    AttributesNodeType,
    AttributesStatus,
    Cable,
    CanvasSyncStatus,
    Conduit,
    Flags,
    Microduct,
    MicroductCableConnection,
    NetworkSchemaSettings,
    Node,
    PipeBranchSettings,
    Projects,
    Trench,
    TrenchConduitConnection,
    WMSLayer,
    WMSSource,
)

from .factories import (
    AddressFactory,
    AreaFactory,
    AreaTypeFactory,
    CableTypeFactory,
    CompanyFactory,
    ConduitTypeFactory,
    ConstructionTypeFactory,
    FlagFactory,
    NetworkLevelFactory,
    NodeFactory,
    NodeTypeFactory,
    ProjectFactory,
    StatusFactory,
    SurfaceFactory,
    TrenchFactory,
    WMSLayerFactory,
    WMSSourceFactory,
)

User = get_user_model()

# Note: 'user' fixture is defined in conftest.py


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

        # Should not be stale with 10 minute timeout
        assert sync_status.is_stale(timeout_minutes=10) is False

        # Should be stale with 2 minute timeout
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
        # Create a fresh sync
        CanvasSyncStatus.objects.create(
            sync_key="project_1",
            status="IN_PROGRESS",
            started_by=user,
            last_heartbeat=timezone.now(),
        )

        initial_count = CanvasSyncStatus.objects.count()
        CanvasSyncStatus.cleanup_stale_syncs()

        # Should remain the same
        assert CanvasSyncStatus.objects.count() == initial_count

        # Status should still be IN_PROGRESS
        sync_status = CanvasSyncStatus.objects.get(sync_key="project_1")
        assert sync_status.status == "IN_PROGRESS"

    def test_cleanup_stale_syncs_with_stale(self, user):
        """Test cleanup of stale sync operations."""
        old_time = timezone.now() - timedelta(minutes=15)

        # Create stale sync
        stale_sync = CanvasSyncStatus.objects.create(
            sync_key="project_1",
            status="IN_PROGRESS",
            started_by=user,
            last_heartbeat=old_time,
        )

        # Create fresh sync
        fresh_sync = CanvasSyncStatus.objects.create(
            sync_key="project_2",
            status="IN_PROGRESS",
            started_by=user,
            last_heartbeat=timezone.now(),
        )

        CanvasSyncStatus.cleanup_stale_syncs(timeout_minutes=10)

        # Refresh from database
        stale_sync.refresh_from_db()
        fresh_sync.refresh_from_db()

        # Stale sync should be marked as FAILED
        assert stale_sync.status == "FAILED"
        assert stale_sync.completed_at is not None
        assert stale_sync.error_message == "Sync operation timed out"

        # Fresh sync should remain IN_PROGRESS
        assert fresh_sync.status == "IN_PROGRESS"
        assert fresh_sync.completed_at is None

    def test_cleanup_stale_syncs_only_in_progress(self, user):
        """Test that cleanup only affects IN_PROGRESS syncs."""
        old_time = timezone.now() - timedelta(minutes=15)

        # Create old syncs with different statuses
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

        # Refresh from database
        completed_sync.refresh_from_db()
        failed_sync.refresh_from_db()
        in_progress_sync.refresh_from_db()

        # Only IN_PROGRESS should be affected
        assert completed_sync.status == "COMPLETED"
        assert failed_sync.status == "FAILED"
        assert in_progress_sync.status == "FAILED"  # Changed from IN_PROGRESS

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
class TestCableModel:
    """Tests for Cable model methods."""

    def test_calculate_length_single_connection(self):
        """Test length calculation with a single trench connection."""
        project = ProjectFactory()
        flag = FlagFactory()

        trench = TrenchFactory(
            project=project,
            flag=flag,
            length=150.0,
            geom=LineString((0, 0), (150, 0), srid=25832),
        )

        conduit_type = ConduitTypeFactory()
        conduit = Conduit.objects.create(
            name="Single Trench Conduit",
            conduit_type=conduit_type,
            project=project,
            flag=flag,
        )

        TrenchConduitConnection.objects.create(
            uuid_trench=trench,
            uuid_conduit=conduit,
        )

        microduct = Microduct.objects.create(
            uuid_conduit=conduit,
            number=1,
            color="rot",
        )

        cable_type = CableTypeFactory()
        cable = Cable.objects.create(
            name="Single Connection Cable",
            cable_type=cable_type,
            project=project,
            flag=flag,
        )

        MicroductCableConnection.objects.create(
            uuid_microduct=microduct,
            uuid_cable=cable,
        )

        length = cable.calculate_length_from_connections()
        assert length == 150.0

    def test_calculate_length_multiple_connections(self):
        """Test length calculation with multiple trench connections."""
        project = ProjectFactory()
        flag = FlagFactory()

        # Create multiple trenches with different lengths
        trench_lengths = [25.5, 50.0, 75.25, 100.0]
        total_expected = sum(trench_lengths)

        trenches = []
        for i, length in enumerate(trench_lengths):
            trench = TrenchFactory(
                project=project,
                flag=flag,
                length=length,
                geom=LineString((i * 100, 0), (i * 100 + length, 0), srid=25832),
            )
            trenches.append(trench)

        conduit_type = ConduitTypeFactory()
        conduits = []
        microducts = []

        for i, trench in enumerate(trenches):
            conduit = Conduit.objects.create(
                name=f"Multi Conduit {i}",
                conduit_type=conduit_type,
                project=project,
                flag=flag,
            )
            conduits.append(conduit)

            TrenchConduitConnection.objects.create(
                uuid_trench=trench,
                uuid_conduit=conduit,
            )

            microduct = Microduct.objects.create(
                uuid_conduit=conduit,
                number=1,
                color=f"color{i}",
            )
            microducts.append(microduct)

        cable_type = CableTypeFactory()
        cable = Cable.objects.create(
            name="Multi Connection Cable",
            cable_type=cable_type,
            project=project,
            flag=flag,
        )

        for microduct in microducts:
            MicroductCableConnection.objects.create(
                uuid_microduct=microduct,
                uuid_cable=cable,
            )

        length = cable.calculate_length_from_connections()
        assert length == total_expected

    def test_calculate_length_no_connections(self):
        """Test length calculation with no connections returns 0."""
        project = ProjectFactory()
        flag = FlagFactory()
        cable_type = CableTypeFactory()

        cable = Cable.objects.create(
            name="No Connection Cable",
            cable_type=cable_type,
            project=project,
            flag=flag,
        )

        length = cable.calculate_length_from_connections()
        assert length == 0.0

    def test_calculate_length_distinct_trenches(self):
        """Test that duplicate trench connections are counted once."""
        project = ProjectFactory()
        flag = FlagFactory()

        # Single trench
        trench = TrenchFactory(
            project=project,
            flag=flag,
            length=100.0,
            geom=LineString((0, 0), (100, 0), srid=25832),
        )

        conduit_type = ConduitTypeFactory()
        conduit = Conduit.objects.create(
            name="Single Trench Multiple Microducts",
            conduit_type=conduit_type,
            project=project,
            flag=flag,
        )

        TrenchConduitConnection.objects.create(
            uuid_trench=trench,
            uuid_conduit=conduit,
        )

        # Create multiple microducts in same conduit
        microduct1 = Microduct.objects.create(uuid_conduit=conduit, number=1, color="rot")
        microduct2 = Microduct.objects.create(uuid_conduit=conduit, number=2, color="grün")
        microduct3 = Microduct.objects.create(uuid_conduit=conduit, number=3, color="blau")

        cable_type = CableTypeFactory()
        cable = Cable.objects.create(
            name="Distinct Trench Test Cable",
            cable_type=cable_type,
            project=project,
            flag=flag,
        )

        # Connect cable to all microducts (same trench)
        for microduct in [microduct1, microduct2, microduct3]:
            MicroductCableConnection.objects.create(
                uuid_microduct=microduct,
                uuid_cable=cable,
            )

        # Should only count the trench once (distinct)
        length = cable.calculate_length_from_connections()
        assert length == 100.0

    def test_update_length_modifies_cable(self):
        """Test that update_length_from_connections modifies the cable length field."""
        project = ProjectFactory()
        flag = FlagFactory()

        trench = TrenchFactory(
            project=project,
            flag=flag,
            length=200.0,
            geom=LineString((0, 0), (200, 0), srid=25832),
        )

        conduit_type = ConduitTypeFactory()
        conduit = Conduit.objects.create(
            name="Update Test Conduit",
            conduit_type=conduit_type,
            project=project,
            flag=flag,
        )

        TrenchConduitConnection.objects.create(
            uuid_trench=trench,
            uuid_conduit=conduit,
        )

        microduct = Microduct.objects.create(
            uuid_conduit=conduit,
            number=1,
            color="rot",
        )

        cable_type = CableTypeFactory()
        cable = Cable.objects.create(
            name="Update Length Cable",
            cable_type=cable_type,
            project=project,
            flag=flag,
        )

        MicroductCableConnection.objects.create(
            uuid_microduct=microduct,
            uuid_cable=cable,
        )

        # The signal should have already updated it, but let's verify
        cable.refresh_from_db()
        assert cable.length == 200.0

    def test_update_length_total_includes_reserves(self):
        """Test that length_total = length + all reserves."""
        project = ProjectFactory()
        flag = FlagFactory()

        trench = TrenchFactory(
            project=project,
            flag=flag,
            length=100.0,
            geom=LineString((0, 0), (100, 0), srid=25832),
        )

        conduit_type = ConduitTypeFactory()
        conduit = Conduit.objects.create(
            name="Reserve Total Conduit",
            conduit_type=conduit_type,
            project=project,
            flag=flag,
        )

        TrenchConduitConnection.objects.create(
            uuid_trench=trench,
            uuid_conduit=conduit,
        )

        microduct = Microduct.objects.create(
            uuid_conduit=conduit,
            number=1,
            color="rot",
        )

        cable_type = CableTypeFactory()
        cable = Cable.objects.create(
            name="Reserve Total Cable",
            cable_type=cable_type,
            project=project,
            flag=flag,
            reserve_at_start=20,
            reserve_at_end=30,
            reserve_section=10,
        )

        MicroductCableConnection.objects.create(
            uuid_microduct=microduct,
            uuid_cable=cable,
        )

        cable.refresh_from_db()
        assert cable.length == 100.0
        assert cable.length_total == 160.0  # 100 + 20 + 30 + 10

    def test_update_length_total_with_none_reserves(self):
        """Test length_total handles None reserve values."""
        project = ProjectFactory()
        flag = FlagFactory()

        trench = TrenchFactory(
            project=project,
            flag=flag,
            length=50.0,
            geom=LineString((0, 0), (50, 0), srid=25832),
        )

        conduit_type = ConduitTypeFactory()
        conduit = Conduit.objects.create(
            name="None Reserve Conduit",
            conduit_type=conduit_type,
            project=project,
            flag=flag,
        )

        TrenchConduitConnection.objects.create(
            uuid_trench=trench,
            uuid_conduit=conduit,
        )

        microduct = Microduct.objects.create(
            uuid_conduit=conduit,
            number=1,
            color="rot",
        )

        cable_type = CableTypeFactory()
        cable = Cable.objects.create(
            name="None Reserve Cable",
            cable_type=cable_type,
            project=project,
            flag=flag,
            reserve_at_start=None,
            reserve_at_end=None,
            reserve_section=None,
        )

        MicroductCableConnection.objects.create(
            uuid_microduct=microduct,
            uuid_cable=cable,
        )

        cable.refresh_from_db()
        assert cable.length == 50.0
        assert cable.length_total == 50.0  # 50 + 0 + 0 + 0

    def test_update_length_partial_reserves(self):
        """Test length_total with some reserves set and others None."""
        project = ProjectFactory()
        flag = FlagFactory()

        trench = TrenchFactory(
            project=project,
            flag=flag,
            length=75.0,
            geom=LineString((0, 0), (75, 0), srid=25832),
        )

        conduit_type = ConduitTypeFactory()
        conduit = Conduit.objects.create(
            name="Partial Reserve Conduit",
            conduit_type=conduit_type,
            project=project,
            flag=flag,
        )

        TrenchConduitConnection.objects.create(
            uuid_trench=trench,
            uuid_conduit=conduit,
        )

        microduct = Microduct.objects.create(
            uuid_conduit=conduit,
            number=1,
            color="rot",
        )

        cable_type = CableTypeFactory()
        cable = Cable.objects.create(
            name="Partial Reserve Cable",
            cable_type=cable_type,
            project=project,
            flag=flag,
            reserve_at_start=15,
            reserve_at_end=None,
            reserve_section=10,
        )

        MicroductCableConnection.objects.create(
            uuid_microduct=microduct,
            uuid_cable=cable,
        )

        cable.refresh_from_db()
        assert cable.length == 75.0
        assert cable.length_total == 100.0  # 75 + 15 + 0 + 10


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


@pytest.mark.django_db
class TestNodeModel:
    """Tests for the Node model."""

    def test_node_creation(self):
        """Test creating a node with geometry."""
        project = ProjectFactory()
        flag = FlagFactory()
        node_type = NodeTypeFactory()

        node = Node.objects.create(
            name="Test Node",
            node_type=node_type,
            geom=Point(9.45, 54.78, srid=25832),
            project=project,
            flag=flag,
        )

        assert node.uuid is not None
        assert node.name == "Test Node"
        assert node.project == project

    def test_node_str_representation(self):
        """Test node string representation."""
        node = NodeFactory(name="My Node")
        assert str(node) == "My Node"

    def test_node_parent_node_relationship(self):
        """Test parent-child node relationship."""
        project = ProjectFactory()
        flag = FlagFactory()
        node_type = NodeTypeFactory()

        parent = Node.objects.create(
            name="Parent Node",
            node_type=node_type,
            geom=Point(0, 0, srid=25832),
            project=project,
            flag=flag,
        )

        child = Node.objects.create(
            name="Child Node",
            node_type=node_type,
            geom=Point(10, 10, srid=25832),
            project=project,
            flag=flag,
            parent_node=parent,
        )

        assert child.parent_node == parent
        # Verify we can find children through reverse lookup
        children = Node.objects.filter(parent_node=parent)
        assert child in children

    def test_node_canvas_coordinates(self):
        """Test setting canvas coordinates on a node."""
        node = NodeFactory()
        node.canvas_x = 100.5
        node.canvas_y = 200.75
        node.save()

        node.refresh_from_db()
        assert node.canvas_x == 100.5
        assert node.canvas_y == 200.75


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
class TestConduitModel:
    """Tests for the Conduit model."""

    def test_conduit_creation(self):
        """Test creating a conduit."""
        project = ProjectFactory()
        flag = FlagFactory()
        conduit_type = ConduitTypeFactory()

        conduit = Conduit.objects.create(
            name="Test Conduit",
            conduit_type=conduit_type,
            project=project,
            flag=flag,
        )

        assert conduit.uuid is not None
        assert conduit.name == "Test Conduit"

    def test_conduit_str_representation(self):
        """Test conduit string representation."""
        project = ProjectFactory()
        flag = FlagFactory()
        conduit_type = ConduitTypeFactory()

        conduit = Conduit.objects.create(
            name="My Conduit",
            conduit_type=conduit_type,
            project=project,
            flag=flag,
        )

        assert str(conduit) == "My Conduit"


@pytest.mark.django_db
class TestAttributeModels:
    """Tests for various attribute models."""

    def test_status_creation(self):
        """Test creating an AttributesStatus."""
        status = AttributesStatus.objects.create(status="In Progress")
        assert str(status) == "In Progress"

    def test_status_unique(self):
        """Test that status must be unique."""
        AttributesStatus.objects.create(status="Unique Status")
        with pytest.raises(IntegrityError):
            AttributesStatus.objects.create(status="Unique Status")

    def test_company_creation(self):
        """Test creating an AttributesCompany."""
        company = AttributesCompany.objects.create(
            company="Test Company",
            city="Hamburg",
            postal_code="20095",
            street="Hauptstraße",
            housenumber="1",
        )
        assert str(company) == "Test Company"
        assert company.city == "Hamburg"

    def test_node_type_creation(self):
        """Test creating an AttributesNodeType."""
        node_type = AttributesNodeType.objects.create(
            node_type="Muffe",
            dimension="100x50",
            group="Verbinder",
        )
        assert str(node_type) == "Muffe"
        assert node_type.dimension == "100x50"

    def test_conduit_type_creation(self):
        """Test creating an AttributesConduitType."""
        conduit_type = AttributesConduitType.objects.create(
            conduit_type="12x10/6",
            conduit_count=12,
        )
        assert str(conduit_type) == "12x10/6"
        assert conduit_type.conduit_count == 12


@pytest.mark.django_db
class TestNetworkSchemaSettings:
    """Tests for the NetworkSchemaSettings model."""

    def test_creation(self):
        """Test creating network schema settings."""
        project = ProjectFactory()
        settings = NetworkSchemaSettings.objects.create(project=project)

        assert settings.project == project

    def test_excluded_node_types(self):
        """Test adding excluded node types."""
        project = ProjectFactory()
        node_type1 = NodeTypeFactory()
        node_type2 = NodeTypeFactory()

        settings = NetworkSchemaSettings.objects.create(project=project)
        settings.excluded_node_types.add(node_type1, node_type2)

        assert settings.excluded_node_types.count() == 2

    def test_get_settings_for_project(self):
        """Test retrieving settings for a project."""
        project = ProjectFactory()
        NetworkSchemaSettings.objects.create(project=project)

        settings = NetworkSchemaSettings.get_settings_for_project(project.id)
        assert settings is not None
        assert settings.project == project

    def test_get_settings_for_nonexistent_project(self):
        """Test retrieving settings for non-existent project returns None."""
        settings = NetworkSchemaSettings.get_settings_for_project(99999)
        assert settings is None


@pytest.mark.django_db
class TestPipeBranchSettings:
    """Tests for the PipeBranchSettings model."""

    def test_creation(self):
        """Test creating pipe branch settings."""
        project = ProjectFactory()
        settings = PipeBranchSettings.objects.create(project=project)

        assert settings.project == project

    def test_allowed_node_types(self):
        """Test adding allowed node types."""
        project = ProjectFactory()
        node_type = NodeTypeFactory()

        settings = PipeBranchSettings.objects.create(project=project)
        settings.allowed_node_types.add(node_type)

        assert settings.allowed_node_types.count() == 1

    def test_get_allowed_type_ids(self):
        """Test getting allowed type IDs."""
        project = ProjectFactory()
        node_type1 = NodeTypeFactory()
        node_type2 = NodeTypeFactory()

        settings = PipeBranchSettings.objects.create(project=project)
        settings.allowed_node_types.add(node_type1, node_type2)

        type_ids = PipeBranchSettings.get_allowed_type_ids(project.id)
        assert type_ids is not None
        assert len(type_ids) == 2
        assert node_type1.id in type_ids
        assert node_type2.id in type_ids

    def test_get_allowed_type_ids_no_settings(self):
        """Test that None is returned when no settings exist."""
        type_ids = PipeBranchSettings.get_allowed_type_ids(99999)
        assert type_ids is None


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
        source2 = WMSSource.objects.create(
            project=project, name="B Source", url="https://b.com", sort_order=2
        )
        source1 = WMSSource.objects.create(
            project=project, name="A Source", url="https://a.com", sort_order=1
        )
        source3 = WMSSource.objects.create(
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
