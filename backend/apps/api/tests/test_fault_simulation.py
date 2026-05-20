"""Tests for the fault simulation service and API endpoint.

Cover :func:`apps.api.services.simulate_fault` and the
:class:`apps.api.views.FaultSimulationView` HTTP endpoint with unit and
integration tests.
"""

import pytest
from apps.api.models import (
    AttributesComponentType,
    FiberSplice,
    Microduct,
    MicroductCableConnection,
    NodeSlotConfiguration,
    NodeStructure,
)
from apps.api.services import simulate_fault
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import LineString, Point
from rest_framework import status
from rest_framework.test import APIClient

from .factories import (
    CableFactory,
    ConduitFactory,
    FiberFactory,
    FlagFactory,
    NodeFactory,
    ProjectFactory,
    TrenchConduitConnectionFactory,
    TrenchFactory,
)

User = get_user_model()


@pytest.fixture
def fault_simulation_infrastructure(db):
    """Create a complete infrastructure chain for fault simulation testing.

    Layout:
        - Trench1 (0,0)->(100,0) contains Conduit1 -> Microduct1 -> Cable1
          (2 fibers)
        - Trench1 also contains Conduit2 -> Microduct2 -> Cable2 (2 fibers)
        - Cable1 fiber1 is spliced to Cable2 fiber1 at Node1

    When Trench1 is damaged, both cables and all 4 fibers should be affected.

    Returns:
        dict: Keys ``'project'``, ``'flag'``, ``'trench'``, ``'cables'``,
            ``'fibers'``, ``'nodes'``.
    """
    project = ProjectFactory()
    flag = FlagFactory()

    trench = TrenchFactory(
        project=project,
        flag=flag,
        length=100.0,
        geom=LineString((0, 0), (100, 0), srid=settings.DEFAULT_SRID),
    )

    conduit1 = ConduitFactory(project=project, flag=flag)
    conduit2 = ConduitFactory(project=project, flag=flag)
    TrenchConduitConnectionFactory(uuid_trench=trench, uuid_conduit=conduit1)
    TrenchConduitConnectionFactory(uuid_trench=trench, uuid_conduit=conduit2)

    md1 = Microduct.objects.create(uuid_conduit=conduit1, number=1, color="rot")
    md2 = Microduct.objects.create(uuid_conduit=conduit2, number=1, color="blau")

    node1 = NodeFactory(
        name="Node-1",
        project=project,
        flag=flag,
        geom=Point(100, 0, srid=settings.DEFAULT_SRID),
    )
    node2 = NodeFactory(
        name="Node-2",
        project=project,
        flag=flag,
        geom=Point(0, 0, srid=settings.DEFAULT_SRID),
    )

    cable1 = CableFactory(
        name="Cable-1",
        project=project,
        flag=flag,
        uuid_node_start=node1,
        uuid_node_end=node2,
    )
    cable2 = CableFactory(
        name="Cable-2",
        project=project,
        flag=flag,
        uuid_node_start=node1,
        uuid_node_end=node2,
    )

    MicroductCableConnection.objects.create(uuid_microduct=md1, uuid_cable=cable1)
    MicroductCableConnection.objects.create(uuid_microduct=md2, uuid_cable=cable2)

    fiber1_1 = FiberFactory(uuid_cable=cable1, fiber_number_absolute=1)
    fiber1_2 = FiberFactory(uuid_cable=cable1, fiber_number_absolute=2)
    fiber2_1 = FiberFactory(uuid_cable=cable2, fiber_number_absolute=1)
    fiber2_2 = FiberFactory(uuid_cable=cable2, fiber_number_absolute=2)

    slot_config = NodeSlotConfiguration.objects.create(
        uuid_node=node1, side="A", total_slots=12
    )
    component_type = AttributesComponentType.objects.create(
        component_type="Splice Cassette", occupied_slots=2
    )
    structure = NodeStructure.objects.create(
        uuid_node=node1,
        slot_configuration=slot_config,
        component_type=component_type,
        slot_start=1,
        slot_end=2,
    )

    FiberSplice.objects.create(
        node_structure=structure,
        port_number=1,
        fiber_a=fiber1_1,
        cable_a=cable1,
        fiber_b=fiber2_1,
        cable_b=cable2,
    )

    return {
        "project": project,
        "flag": flag,
        "trench": trench,
        "cables": [cable1, cable2],
        "fibers": [fiber1_1, fiber1_2, fiber2_1, fiber2_2],
        "nodes": [node1, node2],
    }


class TestSimulateFault:
    """Unit tests for :func:`apps.api.services.simulate_fault`."""

    def test_finds_cables_in_trench_and_returns_summary(
        self, fault_simulation_infrastructure
    ):
        infra = fault_simulation_infrastructure
        result = simulate_fault(
            point=[50, 0],
            project_id=str(infra["project"].pk),
        )

        assert result["trench"]["uuid"] == str(infra["trench"].uuid)
        assert result["summary"]["total_cables_affected"] == 2
        assert result["summary"]["total_fibers_affected"] == 4
        assert len(result["cables"]) == 2

    def test_no_trench_nearby_raises(self, fault_simulation_infrastructure):
        infra = fault_simulation_infrastructure
        with pytest.raises(ValueError, match="No trench found"):
            simulate_fault(
                point=[9999, 9999],
                project_id=str(infra["project"].pk),
            )

    def test_trench_with_no_cables_returns_empty(self, db):
        project = ProjectFactory()
        flag = FlagFactory()
        TrenchFactory(
            project=project,
            flag=flag,
            length=50.0,
            geom=LineString((0, 0), (50, 0), srid=settings.DEFAULT_SRID),
        )

        result = simulate_fault(
            point=[25, 0],
            project_id=str(project.pk),
        )

        assert result["summary"]["total_cables_affected"] == 0
        assert result["cables"] == []


@pytest.fixture
def authenticated_client(db):
    """Create an authenticated API client.

    Returns:
        APIClient: DRF test client with ``force_authenticate`` applied.
    """
    user = User.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="testpass123",
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


class TestFaultSimulationView:
    """Integration tests for the ``/api/v1/fault-simulation/`` endpoint."""

    def test_returns_damage_report(
        self, authenticated_client, fault_simulation_infrastructure
    ):
        infra = fault_simulation_infrastructure
        response = authenticated_client.post(
            "/api/v1/fault-simulation/",
            {
                "point": [50, 0],
                "project_id": str(infra["project"].pk),
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["summary"]["total_cables_affected"] == 2
        assert "geometry" in data
        damage_point = data["geometry"]["damage_point"]
        if isinstance(damage_point, str):
            import json

            damage_point = json.loads(damage_point)
        assert damage_point["type"] == "Point"

    def test_returns_404_when_no_trench_nearby(
        self, authenticated_client, fault_simulation_infrastructure
    ):
        infra = fault_simulation_infrastructure
        response = authenticated_client.post(
            "/api/v1/fault-simulation/",
            {
                "point": [9999, 9999],
                "project_id": str(infra["project"].pk),
            },
            format="json",
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_returns_400_when_missing_point(
        self, authenticated_client, fault_simulation_infrastructure
    ):
        infra = fault_simulation_infrastructure
        response = authenticated_client.post(
            "/api/v1/fault-simulation/",
            {"project_id": str(infra["project"].pk)},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_returns_400_when_missing_project_id(self, authenticated_client):
        response = authenticated_client.post(
            "/api/v1/fault-simulation/",
            {"point": [50, 0]},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_requires_authentication(self, fault_simulation_infrastructure):
        client = APIClient()
        infra = fault_simulation_infrastructure
        response = client.post(
            "/api/v1/fault-simulation/",
            {
                "point": [50, 0],
                "project_id": str(infra["project"].pk),
            },
            format="json",
        )

        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )
