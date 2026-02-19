from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import LineString
from django.db import IntegrityError
from django.utils import timezone

from apps.api.models import (
    Cable,
    CanvasSyncStatus,
    Conduit,
    Microduct,
    MicroductCableConnection,
    TrenchConduitConnection,
)

from .factories import (
    CableTypeFactory,
    ConduitTypeFactory,
    FlagFactory,
    ProjectFactory,
    TrenchFactory,
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
