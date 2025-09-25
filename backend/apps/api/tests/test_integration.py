import threading
import time
from datetime import timedelta

import pytest
from apps.api.models import (
    AttributesCompany,
    AttributesNetworkLevel,
    AttributesNodeType,
    AttributesStatus,
    CanvasSyncStatus,
    Flags,
    Node,
    Projects,
)
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from django.utils import timezone
from rest_framework.test import APIClient

User = get_user_model()


@pytest.fixture
def integration_users(db):
    """Create test users for integration tests."""
    user1 = User.objects.create_user(
        username="user1", email="user1@example.com", password="testpass123"
    )
    user2 = User.objects.create_user(
        username="user2", email="user2@example.com", password="testpass123"
    )
    user3 = User.objects.create_user(
        username="user3", email="user3@example.com", password="testpass123"
    )
    return {"user1": user1, "user2": user2, "user3": user3}


@pytest.fixture
def integration_project(db):
    """Create test project for integration tests."""
    return Projects.objects.create(
        id=1,
        project="Integration Test Project",
        description="Project for integration testing",
    )


@pytest.fixture
def integration_flag(db):
    """Create test flag for integration tests."""
    return Flags.objects.create(id=1, flag="Integration Test Flag")


@pytest.fixture
def integration_node_attributes(db):
    """Create node attribute objects for integration tests."""
    node_type = AttributesNodeType.objects.create(id=1, node_type="Integration Type")

    status_attr = AttributesStatus.objects.create(id=1, status="Active")

    network_level = AttributesNetworkLevel.objects.create(id=1, network_level="Level 1")

    company = AttributesCompany.objects.create(id=1, company="Integration Company")

    return {
        "node_type": node_type,
        "status": status_attr,
        "network_level": network_level,
        "company": company,
    }


@pytest.fixture
def integration_nodes(
    db, integration_project, integration_flag, integration_node_attributes
):
    """Create test nodes for integration tests."""
    nodes = []
    for i in range(50):  # Create 50 nodes for more realistic testing
        x = 1000.0 + (i * 100.0)  # Spread nodes across coordinate space
        y = 2000.0 + (i * 100.0)

        node = Node.objects.create(
            name=f"Integration Node {i + 1}",
            project=integration_project,
            flag=integration_flag,
            node_type=integration_node_attributes["node_type"],
            status=integration_node_attributes["status"],
            network_level=integration_node_attributes["network_level"],
            owner=integration_node_attributes["company"],
            geom=Point(x, y, srid=25832),
        )
        nodes.append(node)

    return nodes


@pytest.fixture
def integration_url():
    """API endpoint URL for integration tests."""
    return "/api/v1/canvas-coordinates/"


def _make_api_request(url, user, method="GET", data=None):
    """Helper method to make authenticated API requests."""
    client = APIClient()
    client.force_authenticate(user=user)

    if method == "GET":
        return client.get(url, {"project_id": 1})
    elif method == "POST":
        post_data = data or {"project_id": 1, "scale": 0.2}
        return client.post(url, post_data, format="json")


@pytest.mark.django_db(transaction=True)
def test_two_users_simultaneous_sync_request(
    integration_users, integration_project, integration_nodes, integration_url
):
    """Test what happens when two users request sync simultaneously."""
    user1 = integration_users["user1"]
    user2 = integration_users["user2"]
    project = integration_project

    results = {}

    def user_sync_request(user, user_id):
        """Function to run sync request for a user."""
        try:
            response = _make_api_request(integration_url, user, "POST")
            results[user_id] = {
                "status_code": response.status_code,
                "data": response.json() if response.content else {},
            }
        except Exception as e:
            results[user_id] = {"status_code": 500, "error": str(e)}

    # Start two threads simultaneously
    thread1 = threading.Thread(target=user_sync_request, args=(user1, "user1"))
    thread2 = threading.Thread(target=user_sync_request, args=(user2, "user2"))

    thread1.start()
    thread2.start()

    thread1.join()
    thread2.join()

    # One should succeed (200), one should get conflict (409)
    status_codes = [results["user1"]["status_code"], results["user2"]["status_code"]]

    assert 200 in status_codes, "One user should succeed"
    assert 409 in status_codes, "One user should get conflict"

    # Check that only one sync operation completed
    sync_status = CanvasSyncStatus.objects.get(sync_key="project_1")
    assert sync_status.status == "COMPLETED"

    # Verify all nodes have canvas coordinates
    nodes_with_coords = Node.objects.filter(
        project=project, canvas_x__isnull=False, canvas_y__isnull=False
    ).count()
    assert nodes_with_coords == 50


@pytest.mark.django_db(transaction=True)
def test_sync_completion_detection_by_waiting_user(
    integration_users, integration_project, integration_nodes, integration_url
):
    """Test that a waiting user can detect when sync completes."""
    user1 = integration_users["user1"]
    user2 = integration_users["user2"]

    # User 1 starts sync
    response1 = _make_api_request(integration_url, user1, "POST")
    assert response1.status_code == 200

    # User 2 checks status and should see completed sync
    response2 = _make_api_request(integration_url, user2, "GET")
    assert response2.status_code == 200

    data = response2.json()
    assert not data["sync_in_progress"]
    assert data["sync_status"] == "COMPLETED"
    assert not data["sync_needed"]  # All nodes should have coordinates


@pytest.mark.django_db(transaction=True)
def test_multiple_concurrent_status_checks(
    integration_users, integration_project, integration_nodes, integration_url
):
    """Test multiple users checking status simultaneously."""
    user1 = integration_users["user1"]
    user2 = integration_users["user2"]
    user3 = integration_users["user3"]

    # Start a sync operation
    CanvasSyncStatus.objects.create(
        sync_key="project_1",
        status="IN_PROGRESS",
        started_by=user1,
        started_at=timezone.now(),
        last_heartbeat=timezone.now(),
        nodes_processed=25,  # Half complete
    )

    results = {}

    def check_status(user, user_id):
        """Function to check sync status."""
        try:
            response = _make_api_request(integration_url, user, "GET")
            results[user_id] = {
                "status_code": response.status_code,
                "data": response.json() if response.content else {},
            }
        except Exception as e:
            results[user_id] = {"status_code": 500, "error": str(e)}

    # Multiple users check status concurrently
    threads = []
    for i, user in enumerate([user1, user2, user3]):
        thread = threading.Thread(target=check_status, args=(user, f"user{i + 1}"))
        threads.append(thread)
        thread.start()

    # Wait for all threads to complete
    for thread in threads:
        thread.join()

    # All should succeed and get consistent results
    for user_id, result in results.items():
        assert result["status_code"] == 200, f"User {user_id} failed"

        data = result["data"]
        assert data["sync_in_progress"], f"User {user_id} didn't see sync in progress"
        assert data["sync_status"] == "IN_PROGRESS"
        assert data["sync_progress"] == 50.0  # 25/50 * 100


@pytest.mark.django_db(transaction=True)
def test_database_consistency_under_concurrent_access(
    integration_users, integration_project, integration_nodes, integration_url
):
    """Test that database remains consistent under concurrent access."""
    user1 = integration_users["user1"]
    project = integration_project

    # Complete a sync operation
    response = _make_api_request(integration_url, user1, "POST")
    assert response.status_code == 200

    # Get the canvas coordinates that were set
    original_coordinates = {}
    for node in Node.objects.filter(project=project):
        original_coordinates[node.uuid] = (node.canvas_x, node.canvas_y)

    # Multiple users check coordinates simultaneously
    results = {}

    def get_node_coordinates(user_id):
        """Get all node coordinates."""
        try:
            nodes = Node.objects.filter(project=project).values(
                "uuid", "canvas_x", "canvas_y"
            )
            results[user_id] = {
                node["uuid"]: (node["canvas_x"], node["canvas_y"]) for node in nodes
            }
        except Exception as e:
            results[user_id] = {"error": str(e)}

    # Run concurrent coordinate checks
    threads = []
    for i in range(5):  # 5 concurrent readers
        thread = threading.Thread(target=get_node_coordinates, args=(f"reader{i + 1}",))
        threads.append(thread)
        thread.start()

    for thread in threads:
        thread.join()

    # All readers should get identical coordinates
    for reader_id, coordinates in results.items():
        if "error" not in coordinates:
            assert coordinates == original_coordinates, (
                f"Reader {reader_id} got inconsistent coordinates"
            )


@pytest.mark.django_db(transaction=True)
def test_qgis_concurrent_node_creation_during_sync(
    integration_users,
    integration_project,
    integration_flag,
    integration_node_attributes,
    integration_nodes,
    integration_url,
):
    """Test that new nodes can be created while sync is in progress."""
    user1 = integration_users["user1"]
    project = integration_project
    flag = integration_flag
    node_attrs = integration_node_attributes

    # Start sync but don't let it complete immediately
    sync_status = CanvasSyncStatus.objects.create(
        sync_key="project_1",
        status="IN_PROGRESS",
        started_by=user1,
        started_at=timezone.now(),
        last_heartbeat=timezone.now(),
    )

    # Simulate QGIS creating new nodes during sync
    new_nodes = []
    for i in range(5):
        node = Node.objects.create(
            name=f"QGIS Node {i + 1}",
            project=project,
            flag=flag,
            node_type=node_attrs["node_type"],
            status=node_attrs["status"],
            network_level=node_attrs["network_level"],
            owner=node_attrs["company"],
            geom=Point(10000.0 + i * 100, 10000.0 + i * 100, srid=25832),
        )
        new_nodes.append(node)

    # Complete the sync
    sync_status.status = "COMPLETED"
    sync_status.completed_at = timezone.now()
    sync_status.save()

    # Verify that new nodes were created successfully
    total_nodes = Node.objects.filter(project=project).count()
    assert total_nodes == 55  # Original 50 + 5 new ones

    # New nodes should not have canvas coordinates (they were added after sync started)
    new_nodes_without_coords = Node.objects.filter(
        name__startswith="QGIS Node", canvas_x__isnull=True, canvas_y__isnull=True
    ).count()
    assert new_nodes_without_coords == 5


@pytest.mark.django_db(transaction=True)
def test_stale_sync_cleanup_during_concurrent_access(
    integration_users, integration_project, integration_nodes, integration_url
):
    """Test stale sync cleanup doesn't interfere with active operations."""
    user1 = integration_users["user1"]
    user2 = integration_users["user2"]
    user3 = integration_users["user3"]

    # Create a stale sync
    old_time = timezone.now() - timedelta(minutes=15)
    stale_sync = CanvasSyncStatus.objects.create(
        sync_key="project_1",
        status="IN_PROGRESS",
        started_by=user1,
        started_at=old_time,
        last_heartbeat=old_time,
    )

    results = {}

    def cleanup_and_new_sync(user, user_id):
        """Function that triggers cleanup and starts new sync."""
        try:
            # This should trigger cleanup and start new sync
            response = _make_api_request(integration_url, user, "POST")
            results[user_id] = {
                "status_code": response.status_code,
                "data": response.json() if response.content else {},
            }
        except Exception as e:
            results[user_id] = {"status_code": 500, "error": str(e)}

    def check_status_during_cleanup(user, user_id):
        """Function that checks status during cleanup."""
        try:
            # Add small delay to ensure this runs during cleanup
            time.sleep(0.1)
            response = _make_api_request(integration_url, user, "GET")
            results[user_id] = {
                "status_code": response.status_code,
                "data": response.json() if response.content else {},
            }
        except Exception as e:
            results[user_id] = {"status_code": 500, "error": str(e)}

    # Start both operations concurrently
    thread1 = threading.Thread(target=cleanup_and_new_sync, args=(user2, "sync_user"))
    thread2 = threading.Thread(
        target=check_status_during_cleanup, args=(user3, "status_user")
    )

    thread1.start()
    thread2.start()

    thread1.join()
    thread2.join()

    # Both operations should succeed
    assert results["sync_user"]["status_code"] == 200
    assert results["status_user"]["status_code"] == 200

    # Stale sync should be cleaned up
    stale_sync.refresh_from_db()
    assert stale_sync.status == "FAILED"

    # New sync should be completed
    current_sync = CanvasSyncStatus.objects.get(sync_key="project_1")
    assert current_sync.status == "COMPLETED"
    assert current_sync.started_by == user2


@pytest.mark.django_db(transaction=True)
def test_performance_with_large_node_set(
    integration_users,
    integration_project,
    integration_flag,
    integration_node_attributes,
    integration_nodes,
    integration_url,
):
    """Test performance characteristics with larger node sets."""
    user1 = integration_users["user1"]
    project = integration_project
    flag = integration_flag
    node_attrs = integration_node_attributes

    # Create additional nodes for performance testing
    additional_nodes = []
    for i in range(200):  # Add 200 more nodes (250 total)
        x = 20000.0 + (i * 50.0)
        y = 20000.0 + (i * 50.0)

        node = Node.objects.create(
            name=f"Performance Node {i + 1}",
            project=project,
            flag=flag,
            node_type=node_attrs["node_type"],
            status=node_attrs["status"],
            network_level=node_attrs["network_level"],
            owner=node_attrs["company"],
            geom=Point(x, y, srid=25832),
        )
        additional_nodes.append(node)

    # Measure sync time
    start_time = time.time()
    response = _make_api_request(integration_url, user1, "POST")
    end_time = time.time()

    sync_duration = end_time - start_time

    # Verify sync succeeded
    assert response.status_code == 200
    data = response.json()
    assert data["updated_count"] == 250  # 50 + 200

    # Sync should complete in reasonable time (less than 30 seconds)
    assert sync_duration < 30.0, (
        f"Sync took {sync_duration:.2f} seconds, which is too long"
    )

    # Verify all nodes have coordinates
    nodes_with_coords = Node.objects.filter(
        project=project, canvas_x__isnull=False, canvas_y__isnull=False
    ).count()
    assert nodes_with_coords == 250


@pytest.mark.django_db(transaction=True)
def test_concurrent_sync_attempts_across_projects(
    integration_users,
    integration_project,
    integration_flag,
    integration_node_attributes,
    integration_nodes,
    integration_url,
):
    """Test that syncs for different projects can run concurrently."""
    user1 = integration_users["user1"]
    user2 = integration_users["user2"]
    node_attrs = integration_node_attributes

    # Create second project
    project2 = Projects.objects.create(
        id=2,
        project="Second Project",
        description="Second project for concurrent testing",
    )

    # Create nodes in second project
    for i in range(10):
        Node.objects.create(
            name=f"Project 2 Node {i + 1}",
            project=project2,
            flag=integration_flag,
            node_type=node_attrs["node_type"],
            status=node_attrs["status"],
            network_level=node_attrs["network_level"],
            owner=node_attrs["company"],
            geom=Point(30000.0 + i * 100, 30000.0 + i * 100, srid=25832),
        )

    results = {}

    def sync_project(user, project_id, user_id):
        """Function to sync specific project."""
        try:
            client = APIClient()
            client.force_authenticate(user=user)
            response = client.post(
                integration_url, {"project_id": project_id, "scale": 0.2}, format="json"
            )
            results[user_id] = {
                "status_code": response.status_code,
                "data": response.json() if response.content else {},
            }
        except Exception as e:
            results[user_id] = {"status_code": 500, "error": str(e)}

    # Start syncs for both projects simultaneously
    thread1 = threading.Thread(target=sync_project, args=(user1, 1, "project1"))
    thread2 = threading.Thread(target=sync_project, args=(user2, 2, "project2"))

    thread1.start()
    thread2.start()

    thread1.join()
    thread2.join()

    # Both should succeed since they're different projects
    assert results["project1"]["status_code"] == 200
    assert results["project2"]["status_code"] == 200

    # Verify both sync statuses exist
    sync1 = CanvasSyncStatus.objects.get(sync_key="project_1")
    sync2 = CanvasSyncStatus.objects.get(sync_key="project_2")

    assert sync1.status == "COMPLETED"
    assert sync2.status == "COMPLETED"

    # Verify node counts
    assert results["project1"]["data"]["updated_count"] == 50
    assert results["project2"]["data"]["updated_count"] == 10
