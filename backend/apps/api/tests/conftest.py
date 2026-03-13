"""
This module provides reusable fixtures that can be used across all test modules,
built on top of Factory Boy factories for consistent test data creation.
"""

import pytest
from django.contrib.auth import get_user_model
from django.utils import translation

from .factories import (
    AddressFactory,
    CableFactory,
    CableLabelFactory,
    CableTypeColorMappingFactory,
    CableTypeFactory,
    CompanyFactory,
    ConduitFactory,
    ConduitTypeColorMappingFactory,
    ConduitTypeFactory,
    FiberColorFactory,
    FlagFactory,
    MicroductColorFactory,
    MicroductFactory,
    NetworkLevelFactory,
    NodeFactory,
    NodeTypeFactory,
    ProjectFactory,
    StatusFactory,
    StoragePreferencesFactory,
    TrenchConduitCanvasFactory,
    TrenchConduitConnectionFactory,
    TrenchFactory,
    WMSLayerFactory,
    WMSSourceFactory,
)


@pytest.fixture(autouse=True)
def use_english_locale():
    """Force English locale for all tests to get consistent error messages."""
    translation.activate("en")
    yield
    translation.deactivate()


User = get_user_model()


@pytest.fixture
def user(db):
    """Create a test user."""
    return User.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="testpass123",
    )


@pytest.fixture
def project(db):
    """Create a test project."""
    return ProjectFactory()


@pytest.fixture
def flag(db):
    """Create a test flag."""
    return FlagFactory()


@pytest.fixture
def company(db):
    """Create a test company."""
    return CompanyFactory()


@pytest.fixture
def status(db):
    """Create a test status."""
    return StatusFactory()


@pytest.fixture
def node_type(db):
    """Create a test node type."""
    return NodeTypeFactory()


@pytest.fixture
def network_level(db):
    """Create a test network level."""
    return NetworkLevelFactory()


@pytest.fixture
def conduit_type(db):
    """Create a test conduit type."""
    return ConduitTypeFactory()


@pytest.fixture
def cable_type(db):
    """Create a test cable type with fiber configuration."""
    return CableTypeFactory(
        fiber_count=12,
        bundle_count=2,
        bundle_fiber_count=6,
    )


@pytest.fixture
def microduct_colors(db):
    """Create a set of microduct colors for testing."""
    colors = []
    color_names = [
        ("rot", "red", "#dc2626"),
        ("grün", "green", "#16a34a"),
        ("blau", "blue", "#2563eb"),
        ("gelb", "yellow", "#eab308"),
        ("weiss", "white", "#ffffff"),
        ("schwarz", "black", "#000000"),
        ("orange", "orange", "#ea580c"),
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
    return colors


@pytest.fixture
def fiber_colors(db):
    """Create a set of fiber colors for testing."""
    colors = []
    color_names = [
        ("rot", "red", "#dc2626"),
        ("grün", "green", "#16a34a"),
        ("blau", "blue", "#2563eb"),
        ("gelb", "yellow", "#eab308"),
        ("weiss", "white", "#ffffff"),
        ("schwarz", "black", "#000000"),
    ]
    for i, (name_de, name_en, hex_code) in enumerate(color_names, 1):
        colors.append(
            FiberColorFactory(
                id=i,
                name_de=name_de,
                name_en=name_en,
                hex_code=hex_code,
            )
        )
    return colors


@pytest.fixture
def conduit_type_with_colors(db, microduct_colors):
    """Create a conduit type with color mappings for microduct auto-creation."""
    conduit_type = ConduitTypeFactory(conduit_count=len(microduct_colors))
    for i, color in enumerate(microduct_colors, 1):
        ConduitTypeColorMappingFactory(
            conduit_type=conduit_type,
            position=i,
            color=color,
        )
    return conduit_type


@pytest.fixture
def cable_type_with_colors(db, fiber_colors):
    """Create a cable type with color mappings for fiber auto-creation."""
    cable_type = CableTypeFactory(
        fiber_count=12,
        bundle_count=2,
        bundle_fiber_count=6,
    )
    for i in range(1, 3):
        CableTypeColorMappingFactory(
            cable_type=cable_type,
            position_type="bundle",
            position=i,
            color=fiber_colors[i - 1],
        )
    for i in range(1, 7):
        CableTypeColorMappingFactory(
            cable_type=cable_type,
            position_type="fiber",
            position=i,
            color=fiber_colors[(i - 1) % len(fiber_colors)],
        )
    return cable_type


@pytest.fixture
def trench(db, project, flag):
    """Create a test trench."""
    return TrenchFactory(project=project, flag=flag)


@pytest.fixture
def conduit(db, project, flag, conduit_type):
    """Create a test conduit without auto-creating microducts.

    Use Conduit.objects.create directly to bypass the post_save signal
    that would auto-create microducts.
    """
    conduit = ConduitFactory.build(
        project=project,
        flag=flag,
        conduit_type=conduit_type,
    )
    from apps.api.models import Conduit

    return Conduit.objects.create(
        name=conduit.name,
        conduit_type=conduit_type,
        project=project,
        flag=flag,
    )


@pytest.fixture
def conduit_with_microducts(db, project, flag, conduit_type_with_colors):
    """Create a conduit that will auto-create microducts via signal."""
    return ConduitFactory(
        project=project,
        flag=flag,
        conduit_type=conduit_type_with_colors,
    )


@pytest.fixture
def node(db, project, flag, node_type):
    """Create a test node."""
    return NodeFactory(project=project, flag=flag, node_type=node_type)


@pytest.fixture
def address(db, project, flag):
    """Create a test address."""
    return AddressFactory(project=project, flag=flag)


@pytest.fixture
def cable(db, project, flag, cable_type):
    """Create a test cable (without auto-creating fibers)."""
    from apps.api.models import Cable

    cable = CableFactory.build(
        project=project,
        flag=flag,
        cable_type=cable_type,
    )
    return Cable.objects.create(
        name=cable.name,
        cable_type=cable_type,
        project=project,
        flag=flag,
    )


@pytest.fixture
def cable_with_fibers(db, project, flag, cable_type_with_colors):
    """Create a cable that will auto-create fibers via signal."""
    return CableFactory(
        project=project,
        flag=flag,
        cable_type=cable_type_with_colors,
    )


@pytest.fixture
def cable_with_label(db, cable):
    """Create a cable with an associated label."""
    CableLabelFactory(cable=cable, text=cable.name)
    return cable


@pytest.fixture
def microduct(db, conduit):
    """Create a test microduct."""
    return MicroductFactory(uuid_conduit=conduit)


@pytest.fixture
def trench_conduit_connection(db, trench, conduit):
    """Create a trench-conduit connection."""
    return TrenchConduitConnectionFactory(
        uuid_trench=trench,
        uuid_conduit=conduit,
    )


@pytest.fixture
def storage_preferences(db):
    """Create storage preferences for file upload tests."""
    return StoragePreferencesFactory()


@pytest.fixture
def cable_with_connections(db, project, flag, cable_type):
    """Create a cable with microduct connections for length calculation tests.

    Build two trenches (50m + 75.5m), each with a conduit and microduct,
    connected to a single cable. The cable length is updated via signal.

    Returns:
        dict: Contains 'cable', 'trenches', 'conduits', 'microducts',
            and 'expected_length' (125.5).
    """
    from apps.api.models import (
        Cable,
        Microduct,
        MicroductCableConnection,
    )
    from django.contrib.gis.geos import LineString

    trench1 = TrenchFactory(
        project=project,
        flag=flag,
        length=50.0,
        geom=LineString((0, 0), (50, 0), srid=25832),
    )
    trench2 = TrenchFactory(
        project=project,
        flag=flag,
        length=75.5,
        geom=LineString((50, 0), (125.5, 0), srid=25832),
    )

    conduit1 = ConduitFactory(project=project, flag=flag)
    conduit2 = ConduitFactory(project=project, flag=flag)

    TrenchConduitConnectionFactory(uuid_trench=trench1, uuid_conduit=conduit1)
    TrenchConduitConnectionFactory(uuid_trench=trench2, uuid_conduit=conduit2)

    microduct1 = Microduct.objects.create(
        uuid_conduit=conduit1,
        number=1,
        color="rot",
    )
    microduct2 = Microduct.objects.create(
        uuid_conduit=conduit2,
        number=1,
        color="grün",
    )

    cable = Cable.objects.create(
        name="Test Cable with Connections",
        cable_type=cable_type,
        project=project,
        flag=flag,
    )

    MicroductCableConnection.objects.create(
        uuid_microduct=microduct1,
        uuid_cable=cable,
    )
    MicroductCableConnection.objects.create(
        uuid_microduct=microduct2,
        uuid_cable=cable,
    )

    cable.refresh_from_db()

    return {
        "cable": cable,
        "trenches": [trench1, trench2],
        "conduits": [conduit1, conduit2],
        "microducts": [microduct1, microduct2],
        "expected_length": 125.5,  # 50.0 + 75.5
    }


@pytest.fixture
def wms_source(db, project):
    """Create a test WMS source."""
    return WMSSourceFactory(project=project)


@pytest.fixture
def wms_layer(db, wms_source):
    """Create a test WMS layer."""
    return WMSLayerFactory(source=wms_source)


@pytest.fixture
def trench_conduit_canvas(db):
    """Create a test trench conduit canvas position."""
    return TrenchConduitCanvasFactory()
