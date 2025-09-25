import pytest
from datetime import timedelta
from unittest.mock import patch, MagicMock

from django.utils import timezone
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from rest_framework.test import APIClient
from rest_framework import status

from apps.api.models import (
    CanvasSyncStatus,
    Node,
    Projects,
    Flags,
    AttributesNodeType,
    AttributesStatus,
    AttributesNetworkLevel,
    AttributesCompany
)

User = get_user_model()


@pytest.fixture
def api_client():
    """Create API client for testing."""
    return APIClient()


@pytest.fixture
def users(db):
    """Create test users."""
    user1 = User.objects.create_user(
        username='user1',
        email='user1@example.com',
        password='testpass123'
    )
    user2 = User.objects.create_user(
        username='user2',
        email='user2@example.com',
        password='testpass123'
    )
    return {'user1': user1, 'user2': user2}


@pytest.fixture
def test_project(db):
    """Create test project."""
    return Projects.objects.create(
        id=1,
        project="Test Project",
        description="Test project for canvas sync"
    )


@pytest.fixture
def test_flag(db):
    """Create test flag."""
    return Flags.objects.create(
        id=1,
        flag="Test Flag"
    )


@pytest.fixture
def node_attributes(db):
    """Create node attribute objects."""
    node_type = AttributesNodeType.objects.create(
        id=1,
        node_type="Test Type"
    )

    status_attr = AttributesStatus.objects.create(
        id=1,
        status="Active"
    )

    network_level = AttributesNetworkLevel.objects.create(
        id=1,
        network_level="Level 1"
    )

    company = AttributesCompany.objects.create(
        id=1,
        company="Test Company"
    )

    return {
        'node_type': node_type,
        'status': status_attr,
        'network_level': network_level,
        'company': company
    }


@pytest.fixture
def test_nodes(db, test_project, test_flag, node_attributes):
    """Create test nodes with geometry."""
    nodes = []
    coordinates = [
        (1000.0, 2000.0),
        (1500.0, 2500.0),
        (2000.0, 3000.0),
        (2500.0, 3500.0)
    ]

    for i, (x, y) in enumerate(coordinates):
        node = Node.objects.create(
            name=f"Test Node {i+1}",
            project=test_project,
            flag=test_flag,
            node_type=node_attributes['node_type'],
            status=node_attributes['status'],
            network_level=node_attributes['network_level'],
            owner=node_attributes['company'],
            geom=Point(x, y, srid=25832)
        )
        nodes.append(node)

    return nodes


@pytest.mark.django_db
class TestNodeCanvasCoordinatesView:
    """Test the NodeCanvasCoordinatesView functionality."""

    def setup_method(self):
        """Set up for each test method."""
        self.url = '/api/v1/canvas-coordinates/'

        # Create API client
        self.client = APIClient()

        # Create test users
        self.user1 = User.objects.create_user(
            username='user1',
            email='user1@example.com',
            password='testpass123'
        )
        self.user2 = User.objects.create_user(
            username='user2',
            email='user2@example.com',
            password='testpass123'
        )

        # Create test project
        self.project = Projects.objects.create(
            id=1,
            project="Test Project",
            description="Test project for canvas sync"
        )

        # Create test flag
        self.flag = Flags.objects.create(
            id=1,
            flag="Test Flag"
        )

        # Create node attribute objects
        self.node_type = AttributesNodeType.objects.create(
            id=1,
            node_type="Test Type"
        )

        self.status_attr = AttributesStatus.objects.create(
            id=1,
            status="Active"
        )

        self.network_level = AttributesNetworkLevel.objects.create(
            id=1,
            network_level="Level 1"
        )

        self.company = AttributesCompany.objects.create(
            id=1,
            company="Test Company"
        )

        # Create test nodes with geometry
        self.nodes = []
        coordinates = [
            (1000.0, 2000.0),
            (1500.0, 2500.0),
            (2000.0, 3000.0),
            (2500.0, 3500.0)
        ]

        for i, (x, y) in enumerate(coordinates):
            node = Node.objects.create(
                name=f"Test Node {i+1}",
                project=self.project,
                flag=self.flag,
                node_type=self.node_type,
                status=self.status_attr,
                network_level=self.network_level,
                owner=self.company,
                geom=Point(x, y, srid=25832)
            )
            self.nodes.append(node)

    def test_get_sync_status_no_sync_needed(self):
        """Test GET when all nodes have canvas coordinates."""
        # Set canvas coordinates for all nodes
        for node in self.nodes:
            node.canvas_x = 100.0
            node.canvas_y = 200.0
            node.save()

        self.client.force_authenticate(user=self.user1)
        response = self.client.get(self.url, {'project_id': 1})

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data['total_nodes'] == 4
        assert data['nodes_with_canvas'] == 4
        assert data['nodes_missing_canvas'] == 0
        assert data['sync_needed'] is False
        assert data['sync_in_progress'] is False

    def test_get_sync_status_sync_needed(self):
        """Test GET when sync is needed."""
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(self.url, {'project_id': 1})

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data['total_nodes'] == 4
        assert data['nodes_with_canvas'] == 0
        assert data['nodes_missing_canvas'] == 4
        assert data['sync_needed'] is True
        assert data['sync_in_progress'] is False

    def test_get_sync_status_in_progress(self):
        """Test GET when sync is in progress."""
        # Create sync status in progress
        CanvasSyncStatus.objects.create(
            sync_key="project_1",
            status="IN_PROGRESS",
            started_by=self.user2,
            started_at=timezone.now(),
            last_heartbeat=timezone.now(),
            nodes_processed=2
        )

        self.client.force_authenticate(user=self.user1)
        response = self.client.get(self.url, {'project_id': 1})

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data['sync_in_progress'] is True
        assert data['sync_status'] == 'IN_PROGRESS'
        assert data['sync_progress'] == 50.0  # 2/4 * 100

    def test_get_sync_status_failed(self):
        """Test GET when sync has failed."""
        CanvasSyncStatus.objects.create(
            sync_key="project_1",
            status="FAILED",
            started_by=self.user1,
            error_message="Test error message"
        )

        self.client.force_authenticate(user=self.user1)
        response = self.client.get(self.url, {'project_id': 1})

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data['sync_in_progress'] is False
        assert data['sync_status'] == 'FAILED'
        assert data['error_message'] == 'Test error message'

    def test_get_with_flag_filter(self):
        """Test GET with project and flag filters."""
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(self.url, {'project_id': 1, 'flag_id': 1})

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data['total_nodes'] == 4  # All test nodes have the same flag

    @patch('apps.api.models.CanvasSyncStatus.cleanup_stale_syncs')
    def test_get_triggers_stale_cleanup(self, mock_cleanup):
        """Test that GET request triggers stale sync cleanup."""
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(self.url, {'project_id': 1})

        assert response.status_code == status.HTTP_200_OK
        mock_cleanup.assert_called_once()

    def test_post_start_new_sync(self):
        """Test POST to start a new sync operation."""
        self.client.force_authenticate(user=self.user1)
        response = self.client.post(self.url, {
            'project_id': 1,
            'scale': 0.2
        }, format='json')

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data['updated_count'] == 4
        assert data['scale'] == 0.2
        assert 'center' in data
        assert 'bounds' in data

        # Check that sync status was created
        sync_status = CanvasSyncStatus.objects.get(sync_key="project_1")
        assert sync_status.status == 'COMPLETED'
        assert sync_status.started_by == self.user1
        assert sync_status.nodes_processed == 4

    def test_post_concurrent_sync_conflict(self):
        """Test POST when sync is already in progress (409 conflict)."""
        # Create sync in progress
        CanvasSyncStatus.objects.create(
            sync_key="project_1",
            status="IN_PROGRESS",
            started_by=self.user2,
            started_at=timezone.now(),
            last_heartbeat=timezone.now()
        )

        self.client.force_authenticate(user=self.user1)
        response = self.client.post(self.url, {
            'project_id': 1,
            'scale': 0.2
        }, format='json')

        assert response.status_code == status.HTTP_409_CONFLICT
        data = response.json()

        assert 'message' in data
        assert data['sync_started_by'] == 'user2'
        assert 'sync_started_at' in data

    def test_post_sync_coordinate_calculation(self):
        """Test that POST correctly calculates canvas coordinates."""
        self.client.force_authenticate(user=self.user1)
        response = self.client.post(self.url, {
            'project_id': 1,
            'scale': 1.0
        }, format='json')

        assert response.status_code == status.HTTP_200_OK

        # Check calculated coordinates
        data = response.json()
        center = data['center']
        bounds = data['bounds']

        # Expected bounds based on test node coordinates
        assert bounds['min_x'] == 1000.0
        assert bounds['max_x'] == 2500.0
        assert bounds['min_y'] == 2000.0
        assert bounds['max_y'] == 3500.0

        # Expected center
        expected_center_x = (1000.0 + 2500.0) / 2  # 1750.0
        expected_center_y = (2000.0 + 3500.0) / 2  # 2750.0
        assert center['x'] == expected_center_x
        assert center['y'] == expected_center_y

        # Check that nodes have canvas coordinates
        for node in self.nodes:
            node.refresh_from_db()
            assert node.canvas_x is not None
            assert node.canvas_y is not None

    def test_post_with_scale_factor(self):
        """Test POST with different scale factors."""
        self.client.force_authenticate(user=self.user1)

        # Test with scale 0.5
        response = self.client.post(self.url, {
            'project_id': 1,
            'scale': 0.5
        }, format='json')

        assert response.status_code == status.HTTP_200_OK

        # Get first node to check scaling
        first_node = Node.objects.get(name="Test Node 1")
        expected_x = (1000.0 - 1750.0) * 0.5  # (geo_x - center_x) * scale
        expected_y = -((2000.0 - 2750.0) * 0.5)  # -((geo_y - center_y) * scale)

        assert first_node.canvas_x == expected_x
        assert first_node.canvas_y == expected_y

    def test_post_no_nodes_found(self):
        """Test POST when no nodes are found."""
        self.client.force_authenticate(user=self.user1)
        response = self.client.post(self.url, {
            'project_id': 999,  # Non-existent project
            'scale': 0.2
        }, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert 'No nodes found' in data['message']

    def test_post_nodes_without_geometry(self):
        """Test POST when nodes have no geometry."""
        # Delete all existing nodes with geometry
        Node.objects.filter(project=self.project).delete()

        # Create node with dummy geometry first, then we'll mock the queryset
        # to simulate nodes without geometry
        with patch('apps.api.models.Node.objects') as mock_node_objects:
            # Mock the filter/exclude chain to return nodes with null geometry
            mock_queryset = MagicMock()
            mock_queryset.exclude.return_value.exists.return_value = True
            mock_queryset.exclude.return_value.aggregate.return_value = {
                'min_x': None, 'max_x': None, 'min_y': None, 'max_y': None
            }
            mock_node_objects.filter.return_value = mock_queryset

            self.client.force_authenticate(user=self.user1)
            response = self.client.post(self.url, {
                'project_id': 1,
                'scale': 0.2
            }, format='json')

            assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_post_error_handling(self):
        """Test POST error handling and status cleanup."""
        self.client.force_authenticate(user=self.user1)

        # Mock an exception during sync
        with patch('apps.api.views.NodeCanvasCoordinatesView._perform_sync') as mock_sync:
            mock_sync.side_effect = Exception("Test exception")

            response = self.client.post(self.url, {
                'project_id': 1,
                'scale': 0.2
            }, format='json')

            assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR

            # Check that sync status was marked as failed
            sync_status = CanvasSyncStatus.objects.get(sync_key="project_1")
            assert sync_status.status == 'FAILED'
            assert 'Test exception' in sync_status.error_message

    def test_post_with_flag_filter(self):
        """Test POST with project and flag filters."""
        # Create additional flag and nodes
        flag2 = Flags.objects.create(id=2, flag="Flag 2")
        Node.objects.create(
            name="Other Flag Node",
            project=self.project,
            flag=flag2,
            node_type=self.node_type,
            status=self.status_attr,
            geom=Point(3000.0, 4000.0, srid=25832)
        )

        self.client.force_authenticate(user=self.user1)
        response = self.client.post(self.url, {
            'project_id': 1,
            'flag_id': 1,
            'scale': 0.2
        }, format='json')

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Should only process nodes with flag_id=1 (4 nodes)
        assert data['updated_count'] == 4

    @patch('apps.api.views.NodeCanvasCoordinatesView._perform_sync')
    def test_heartbeat_updates_during_sync(self, mock_perform_sync):
        """Test that heartbeat is updated during sync operation."""
        # Import Response here to avoid circular imports
        from rest_framework.response import Response

        # Mock _perform_sync to check sync_status updates
        def mock_sync_with_heartbeat(sync_status, project_id, flag_id, scale):
            sync_status.update_heartbeat()
            return Response({'updated_count': 4, 'scale': scale})

        mock_perform_sync.side_effect = mock_sync_with_heartbeat

        self.client.force_authenticate(user=self.user1)
        self.client.post(self.url, {
            'project_id': 1,
            'scale': 0.2
        }, format='json')

        # Verify sync was called
        mock_perform_sync.assert_called_once()

        # Check that sync status exists
        sync_status = CanvasSyncStatus.objects.get(sync_key="project_1")
        assert sync_status.last_heartbeat is not None

    def test_authentication_required(self):
        """Test that authentication is required for both GET and POST."""
        # Test GET without authentication
        response = self.client.get(self.url, {'project_id': 1})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

        # Test POST without authentication
        response = self.client.post(self.url, {'project_id': 1}, format='json')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_sync_status_atomic_lock_acquisition(self):
        """Test atomic lock acquisition using select_for_update."""
        # This test simulates concurrent access by creating a sync status
        # and then trying to acquire lock again

        sync_status = CanvasSyncStatus.objects.create(
            sync_key="project_1",
            status="IDLE",
            started_by=self.user1
        )

        self.client.force_authenticate(user=self.user2)
        response = self.client.post(self.url, {
            'project_id': 1,
            'scale': 0.2
        }, format='json')

        # Should succeed and update the existing sync status
        assert response.status_code == status.HTTP_200_OK

        sync_status.refresh_from_db()
        assert sync_status.status == 'COMPLETED'
        assert sync_status.started_by == self.user2

    def test_stale_sync_recovery(self):
        """Test recovery from stale sync operations."""
        old_time = timezone.now() - timedelta(minutes=15)

        # Create stale sync
        CanvasSyncStatus.objects.create(
            sync_key="project_1",
            status="IN_PROGRESS",
            started_by=self.user1,
            last_heartbeat=old_time
        )

        self.client.force_authenticate(user=self.user2)
        response = self.client.post(self.url, {
            'project_id': 1,
            'scale': 0.2
        }, format='json')

        # Should succeed despite stale sync existing
        assert response.status_code == status.HTTP_200_OK

        sync_status = CanvasSyncStatus.objects.get(sync_key="project_1")
        assert sync_status.status == 'COMPLETED'
        assert sync_status.started_by == self.user2