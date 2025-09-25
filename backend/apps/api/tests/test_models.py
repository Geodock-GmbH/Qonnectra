import pytest
from datetime import timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.db import IntegrityError

from apps.api.models import CanvasSyncStatus

User = get_user_model()


@pytest.fixture
def user(db):
    """Create a test user."""
    return User.objects.create_user(
        username='testuser',
        email='test@example.com',
        password='testpass123'
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
            sync_key="project_1",
            status="IDLE",
            started_by=user
        )

        assert sync_status.sync_key == "project_1"
        assert sync_status.status == "IDLE"
        assert sync_status.started_by == user
        assert sync_status.started_at is None
        assert sync_status.completed_at is None

    def test_sync_key_uniqueness(self, user):
        """Test that sync_key must be unique."""
        CanvasSyncStatus.objects.create(
            sync_key="project_1",
            status="IDLE",
            started_by=user
        )

        with pytest.raises(IntegrityError):
            CanvasSyncStatus.objects.create(
                sync_key="project_1",
                status="IN_PROGRESS",
                started_by=user
            )

    def test_is_stale_no_heartbeat(self, user):
        """Test stale detection when no heartbeat is set."""
        sync_status = CanvasSyncStatus.objects.create(
            sync_key="project_1",
            status="IN_PROGRESS",
            started_by=user
        )

        assert sync_status.is_stale() is True

    def test_is_stale_fresh_heartbeat(self, user):
        """Test stale detection with fresh heartbeat."""
        sync_status = CanvasSyncStatus.objects.create(
            sync_key="project_1",
            status="IN_PROGRESS",
            started_by=user,
            last_heartbeat=timezone.now()
        )

        assert sync_status.is_stale() is False

    def test_is_stale_old_heartbeat(self, user):
        """Test stale detection with old heartbeat."""
        old_time = timezone.now() - timedelta(minutes=15)
        sync_status = CanvasSyncStatus.objects.create(
            sync_key="project_1",
            status="IN_PROGRESS",
            started_by=user,
            last_heartbeat=old_time
        )

        assert sync_status.is_stale(timeout_minutes=10) is True

    def test_is_stale_custom_timeout(self, user):
        """Test stale detection with custom timeout."""
        recent_time = timezone.now() - timedelta(minutes=5)
        sync_status = CanvasSyncStatus.objects.create(
            sync_key="project_1",
            status="IN_PROGRESS",
            started_by=user,
            last_heartbeat=recent_time
        )

        # Should not be stale with 10 minute timeout
        assert sync_status.is_stale(timeout_minutes=10) is False

        # Should be stale with 2 minute timeout
        assert sync_status.is_stale(timeout_minutes=2) is True

    def test_update_heartbeat(self, user):
        """Test heartbeat update functionality."""
        sync_status = CanvasSyncStatus.objects.create(
            sync_key="project_1",
            status="IN_PROGRESS",
            started_by=user
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
            last_heartbeat=timezone.now()
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
            last_heartbeat=old_time
        )

        # Create fresh sync
        fresh_sync = CanvasSyncStatus.objects.create(
            sync_key="project_2",
            status="IN_PROGRESS",
            started_by=user,
            last_heartbeat=timezone.now()
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
            last_heartbeat=old_time
        )

        failed_sync = CanvasSyncStatus.objects.create(
            sync_key="project_2",
            status="FAILED",
            started_by=user,
            last_heartbeat=old_time
        )

        in_progress_sync = CanvasSyncStatus.objects.create(
            sync_key="project_3",
            status="IN_PROGRESS",
            started_by=user,
            last_heartbeat=old_time
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
            sync_key="project_1_flag_5",
            status="IN_PROGRESS",
            started_by=user
        )

        expected_str = "project_1_flag_5 - IN_PROGRESS"
        assert str(sync_status) == expected_str

    def test_sync_metadata_storage(self, user):
        """Test storage of sync metadata."""
        sync_status = CanvasSyncStatus.objects.create(
            sync_key="project_1",
            status="COMPLETED",
            started_by=user,
            scale=0.2,
            center_x=1000.5,
            center_y=2000.75,
            nodes_processed=150
        )

        assert sync_status.scale == 0.2
        assert sync_status.center_x == 1000.5
        assert sync_status.center_y == 2000.75
        assert sync_status.nodes_processed == 150

    def test_status_choices_validation(self, user):
        """Test that only valid status choices are accepted."""
        valid_statuses = ['IDLE', 'IN_PROGRESS', 'COMPLETED', 'FAILED']

        for status in valid_statuses:
            sync_status = CanvasSyncStatus.objects.create(
                sync_key=f"project_{status}",
                status=status,
                started_by=user
            )
            assert sync_status.status == status