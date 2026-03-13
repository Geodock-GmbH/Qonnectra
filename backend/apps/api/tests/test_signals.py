"""Tests for Django signal handlers.

Verify automatic behavior triggered by model saves and deletes,
including microduct creation, fiber creation, cable length updates,
and folder renaming.
"""

from unittest.mock import patch

import pytest
from apps.api.models import (
    Cable,
    CableLabel,
    Conduit,
    Fiber,
    Microduct,
    MicroductCableConnection,
    ModelPermission,
    RoutePermission,
    TrenchConduitConnection,
)
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.contrib.gis.geos import LineString
from django.core.cache import cache

from .factories import (
    CableTypeColorMappingFactory,
    CableTypeFactory,
    ConduitTypeColorMappingFactory,
    ConduitTypeFactory,
    FiberColorFactory,
    FlagFactory,
    MicroductColorFactory,
    ProjectFactory,
    TrenchFactory,
)

User = get_user_model()


@pytest.mark.django_db
class TestMicroductCreationSignal:
    """Tests for the create_microducts_for_conduit signal handler."""

    def test_conduit_creates_microducts_from_color_mapping(self):
        """Verify microducts are created when a conduit is saved with color mappings."""
        conduit_type = ConduitTypeFactory(conduit_count=3)
        colors = [MicroductColorFactory() for _ in range(3)]
        for i, color in enumerate(colors, 1):
            ConduitTypeColorMappingFactory(
                conduit_type=conduit_type,
                position=i,
                color=color,
            )

        project = ProjectFactory()
        flag = FlagFactory()

        conduit = Conduit.objects.create(
            name="Test Conduit",
            conduit_type=conduit_type,
            project=project,
            flag=flag,
        )

        microducts = Microduct.objects.filter(uuid_conduit=conduit)
        assert microducts.count() == 3

    def test_conduit_creates_correct_microduct_count(self):
        """Verify the correct number of microducts are created based on color mapping count."""
        conduit_type = ConduitTypeFactory(conduit_count=7)
        colors = [MicroductColorFactory() for _ in range(7)]
        for i, color in enumerate(colors, 1):
            ConduitTypeColorMappingFactory(
                conduit_type=conduit_type,
                position=i,
                color=color,
            )

        project = ProjectFactory()
        flag = FlagFactory()

        conduit = Conduit.objects.create(
            name="Seven Microduct Conduit",
            conduit_type=conduit_type,
            project=project,
            flag=flag,
        )

        microducts = Microduct.objects.filter(uuid_conduit=conduit)
        assert microducts.count() == 7

    def test_conduit_microducts_have_correct_colors(self):
        """Verify microducts have the correct colors from the mapping."""
        conduit_type = ConduitTypeFactory(conduit_count=3)
        colors = [
            MicroductColorFactory(name_de="rot"),
            MicroductColorFactory(name_de="grün"),
            MicroductColorFactory(name_de="blau"),
        ]
        for i, color in enumerate(colors, 1):
            ConduitTypeColorMappingFactory(
                conduit_type=conduit_type,
                position=i,
                color=color,
            )

        project = ProjectFactory()
        flag = FlagFactory()

        conduit = Conduit.objects.create(
            name="Colored Conduit",
            conduit_type=conduit_type,
            project=project,
            flag=flag,
        )

        microducts = Microduct.objects.filter(uuid_conduit=conduit).order_by("number")
        expected_colors = ["rot", "grün", "blau"]
        actual_colors = [m.color for m in microducts]
        assert actual_colors == expected_colors

    def test_conduit_microducts_have_correct_positions(self):
        """Verify microducts have the correct position numbers."""
        conduit_type = ConduitTypeFactory(conduit_count=5)
        colors = [MicroductColorFactory() for _ in range(5)]
        for i, color in enumerate(colors, 1):
            ConduitTypeColorMappingFactory(
                conduit_type=conduit_type,
                position=i,
                color=color,
            )

        project = ProjectFactory()
        flag = FlagFactory()

        conduit = Conduit.objects.create(
            name="Position Test Conduit",
            conduit_type=conduit_type,
            project=project,
            flag=flag,
        )

        microducts = Microduct.objects.filter(uuid_conduit=conduit).order_by("number")
        positions = [m.number for m in microducts]
        assert positions == [1, 2, 3, 4, 5]

    def test_conduit_without_mapping_creates_no_microducts(self):
        """Verify no microducts are created when conduit type has no color mappings."""
        conduit_type = ConduitTypeFactory(conduit_count=5)

        project = ProjectFactory()
        flag = FlagFactory()

        conduit = Conduit.objects.create(
            name="No Mapping Conduit",
            conduit_type=conduit_type,
            project=project,
            flag=flag,
        )

        microducts = Microduct.objects.filter(uuid_conduit=conduit)
        assert microducts.count() == 0

    def test_conduit_update_does_not_duplicate_microducts(self):
        """Verify updating a conduit doesn't create additional microducts."""
        conduit_type = ConduitTypeFactory(conduit_count=3)
        colors = [MicroductColorFactory() for _ in range(3)]
        for i, color in enumerate(colors, 1):
            ConduitTypeColorMappingFactory(
                conduit_type=conduit_type,
                position=i,
                color=color,
            )

        project = ProjectFactory()
        flag = FlagFactory()

        conduit = Conduit.objects.create(
            name="Update Test Conduit",
            conduit_type=conduit_type,
            project=project,
            flag=flag,
        )

        initial_count = Microduct.objects.filter(uuid_conduit=conduit).count()

        conduit.name = "Updated Conduit Name"
        conduit.save()

        final_count = Microduct.objects.filter(uuid_conduit=conduit).count()
        assert final_count == initial_count == 3


@pytest.mark.django_db
class TestFiberCreationSignal:
    """Tests for the create_fibers_for_cable signal handler."""

    def test_cable_creates_fibers_from_type_mapping(self):
        """Verify fibers are created when a cable is saved with color mappings."""
        cable_type = CableTypeFactory(
            fiber_count=12,
            bundle_count=2,
            bundle_fiber_count=6,
        )
        fiber_colors = [FiberColorFactory() for _ in range(6)]

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
                color=fiber_colors[i - 1],
            )

        project = ProjectFactory()
        flag = FlagFactory()

        cable = Cable.objects.create(
            name="Fiber Test Cable",
            cable_type=cable_type,
            project=project,
            flag=flag,
        )

        fibers = Fiber.objects.filter(uuid_cable=cable)
        assert fibers.count() == 12  # 2 bundles * 6 fibers

    def test_cable_creates_correct_fiber_count(self):
        """Verify the correct number of fibers are created based on cable type config."""
        cable_type = CableTypeFactory(
            fiber_count=24,
            bundle_count=4,
            bundle_fiber_count=6,
        )
        fiber_colors = [FiberColorFactory() for _ in range(6)]

        for i in range(1, 5):
            CableTypeColorMappingFactory(
                cable_type=cable_type,
                position_type="bundle",
                position=i,
                color=fiber_colors[(i - 1) % len(fiber_colors)],
            )

        for i in range(1, 7):
            CableTypeColorMappingFactory(
                cable_type=cable_type,
                position_type="fiber",
                position=i,
                color=fiber_colors[i - 1],
            )

        project = ProjectFactory()
        flag = FlagFactory()

        cable = Cable.objects.create(
            name="24 Fiber Cable",
            cable_type=cable_type,
            project=project,
            flag=flag,
        )

        fibers = Fiber.objects.filter(uuid_cable=cable)
        assert fibers.count() == 24  # 4 bundles * 6 fibers

    def test_cable_fibers_have_correct_bundle_numbers(self):
        """Verify fibers are assigned to the correct bundle numbers."""
        cable_type = CableTypeFactory(
            fiber_count=12,
            bundle_count=2,
            bundle_fiber_count=6,
        )
        fiber_colors = [FiberColorFactory() for _ in range(6)]

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
                color=fiber_colors[i - 1],
            )

        project = ProjectFactory()
        flag = FlagFactory()

        cable = Cable.objects.create(
            name="Bundle Test Cable",
            cable_type=cable_type,
            project=project,
            flag=flag,
        )

        bundle_1_fibers = Fiber.objects.filter(uuid_cable=cable, bundle_number=1)
        bundle_2_fibers = Fiber.objects.filter(uuid_cable=cable, bundle_number=2)

        assert bundle_1_fibers.count() == 6
        assert bundle_2_fibers.count() == 6

    def test_cable_fibers_have_correct_colors(self):
        """Verify fibers have the correct colors from the mapping."""
        cable_type = CableTypeFactory(
            fiber_count=6,
            bundle_count=1,
            bundle_fiber_count=6,
        )
        fiber_colors = [
            FiberColorFactory(name_de="rot"),
            FiberColorFactory(name_de="grün"),
            FiberColorFactory(name_de="blau"),
            FiberColorFactory(name_de="gelb"),
            FiberColorFactory(name_de="weiss"),
            FiberColorFactory(name_de="schwarz"),
        ]

        CableTypeColorMappingFactory(
            cable_type=cable_type,
            position_type="bundle",
            position=1,
            color=fiber_colors[0],
        )

        for i, color in enumerate(fiber_colors, 1):
            CableTypeColorMappingFactory(
                cable_type=cable_type,
                position_type="fiber",
                position=i,
                color=color,
            )

        project = ProjectFactory()
        flag = FlagFactory()

        cable = Cable.objects.create(
            name="Color Test Cable",
            cable_type=cable_type,
            project=project,
            flag=flag,
        )

        fibers = Fiber.objects.filter(uuid_cable=cable).order_by(
            "fiber_number_absolute"
        )
        expected_colors = ["rot", "grün", "blau", "gelb", "weiss", "schwarz"]
        actual_colors = [f.fiber_color for f in fibers]
        assert actual_colors == expected_colors

    def test_cable_without_mappings_creates_no_fibers(self):
        """Verify no fibers are created when cable type has no color mappings."""
        cable_type = CableTypeFactory(
            fiber_count=12,
            bundle_count=2,
            bundle_fiber_count=6,
        )

        project = ProjectFactory()
        flag = FlagFactory()

        cable = Cable.objects.create(
            name="No Mapping Cable",
            cable_type=cable_type,
            project=project,
            flag=flag,
        )

        fibers = Fiber.objects.filter(uuid_cable=cable)
        assert fibers.count() == 0

    def test_cable_update_does_not_duplicate_fibers(self):
        """Verify updating a cable doesn't create additional fibers."""
        cable_type = CableTypeFactory(
            fiber_count=12,
            bundle_count=2,
            bundle_fiber_count=6,
        )
        fiber_colors = [FiberColorFactory() for _ in range(6)]

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
                color=fiber_colors[i - 1],
            )

        project = ProjectFactory()
        flag = FlagFactory()

        cable = Cable.objects.create(
            name="Update Fiber Test Cable",
            cable_type=cable_type,
            project=project,
            flag=flag,
        )

        initial_count = Fiber.objects.filter(uuid_cable=cable).count()

        cable.length = 100.0
        cable.save()

        final_count = Fiber.objects.filter(uuid_cable=cable).count()
        assert final_count == initial_count == 12


@pytest.mark.django_db
class TestCableLengthUpdateSignal:
    """Tests for cable length update signals on MicroductCableConnection changes."""

    def test_connection_create_updates_cable_length(self):
        """Verify cable length is updated when a MicroductCableConnection is created."""
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
            name="Length Test Conduit",
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
            name="Length Test Cable",
            cable_type=cable_type,
            project=project,
            flag=flag,
        )

        MicroductCableConnection.objects.create(
            uuid_microduct=microduct,
            uuid_cable=cable,
        )

        cable.refresh_from_db()
        assert cable.length == 100.0

    def test_connection_delete_updates_cable_length(self):
        """Verify cable length is recalculated when a MicroductCableConnection is deleted."""
        project = ProjectFactory()
        flag = FlagFactory()

        trench1 = TrenchFactory(
            project=project,
            flag=flag,
            length=50.0,
            geom=LineString((0, 0), (50, 0), srid=25832),
        )
        trench2 = TrenchFactory(
            project=project,
            flag=flag,
            length=75.0,
            geom=LineString((50, 0), (125, 0), srid=25832),
        )

        conduit_type = ConduitTypeFactory()
        conduit1 = Conduit.objects.create(
            name="Delete Test Conduit 1",
            conduit_type=conduit_type,
            project=project,
            flag=flag,
        )
        conduit2 = Conduit.objects.create(
            name="Delete Test Conduit 2",
            conduit_type=conduit_type,
            project=project,
            flag=flag,
        )

        TrenchConduitConnection.objects.create(
            uuid_trench=trench1, uuid_conduit=conduit1
        )
        TrenchConduitConnection.objects.create(
            uuid_trench=trench2, uuid_conduit=conduit2
        )

        microduct1 = Microduct.objects.create(
            uuid_conduit=conduit1, number=1, color="rot"
        )
        microduct2 = Microduct.objects.create(
            uuid_conduit=conduit2, number=1, color="grün"
        )

        cable_type = CableTypeFactory()
        cable = Cable.objects.create(
            name="Delete Length Test Cable",
            cable_type=cable_type,
            project=project,
            flag=flag,
        )

        conn1 = MicroductCableConnection.objects.create(
            uuid_microduct=microduct1,
            uuid_cable=cable,
        )
        MicroductCableConnection.objects.create(
            uuid_microduct=microduct2,
            uuid_cable=cable,
        )

        cable.refresh_from_db()
        assert cable.length == 125.0  # 50 + 75

        conn1.delete()

        cable.refresh_from_db()
        assert cable.length == 75.0  # Only trench2 remaining

    def test_multiple_connections_sum_lengths(self):
        """Verify multiple connections sum the trench lengths correctly."""
        project = ProjectFactory()
        flag = FlagFactory()

        trenches = [
            TrenchFactory(
                project=project,
                flag=flag,
                length=30.0,
                geom=LineString((0, 0), (30, 0), srid=25832),
            ),
            TrenchFactory(
                project=project,
                flag=flag,
                length=40.0,
                geom=LineString((30, 0), (70, 0), srid=25832),
            ),
            TrenchFactory(
                project=project,
                flag=flag,
                length=50.0,
                geom=LineString((70, 0), (120, 0), srid=25832),
            ),
        ]

        conduit_type = ConduitTypeFactory()
        conduits = []
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

        microducts = []
        for i, conduit in enumerate(conduits):
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

        cable.refresh_from_db()
        assert cable.length == 120.0  # 30 + 40 + 50

    def test_no_connections_zero_length(self):
        """Verify cable with no connections has zero length."""
        project = ProjectFactory()
        flag = FlagFactory()
        cable_type = CableTypeFactory()

        cable = Cable.objects.create(
            name="No Connection Cable",
            cable_type=cable_type,
            project=project,
            flag=flag,
        )

        assert cable.length is None

        cable.update_length_from_connections()
        cable.refresh_from_db()

        assert cable.length == 0.0

    def test_length_total_includes_reserves(self):
        """Verify length_total includes reserve values."""
        project = ProjectFactory()
        flag = FlagFactory()

        trench = TrenchFactory(project=project, flag=flag, length=100.0)

        conduit_type = ConduitTypeFactory()
        conduit = Conduit.objects.create(
            name="Reserve Test Conduit",
            conduit_type=conduit_type,
            project=project,
            flag=flag,
        )

        TrenchConduitConnection.objects.create(uuid_trench=trench, uuid_conduit=conduit)

        microduct = Microduct.objects.create(
            uuid_conduit=conduit, number=1, color="rot"
        )

        cable_type = CableTypeFactory()
        cable = Cable.objects.create(
            name="Reserve Test Cable",
            cable_type=cable_type,
            project=project,
            flag=flag,
            reserve_at_start=10,
            reserve_at_end=15,
            reserve_section=5,
        )

        MicroductCableConnection.objects.create(
            uuid_microduct=microduct,
            uuid_cable=cable,
        )

        cable.refresh_from_db()
        assert cable.length == 100.0
        assert cable.length_total == 130.0  # 100 + 10 + 15 + 5


@pytest.mark.django_db
class TestCableNameChangeSignal:
    """Tests for cable name change signals (label update and folder rename)."""

    def test_cable_name_change_updates_labels(self):
        """Verify CableLabel.text is updated when cable name changes."""
        project = ProjectFactory()
        flag = FlagFactory()
        cable_type = CableTypeFactory()

        cable = Cable.objects.create(
            name="Original Cable Name",
            cable_type=cable_type,
            project=project,
            flag=flag,
        )

        label1 = CableLabel.objects.create(cable=cable, text=cable.name)
        label2 = CableLabel.objects.create(cable=cable, text=cable.name, order=1)

        cable.name = "New Cable Name"
        cable.save()

        label1.refresh_from_db()
        label2.refresh_from_db()

        assert label1.text == "New Cable Name"
        assert label2.text == "New Cable Name"

    @patch("apps.api.services.rename_feature_folder")
    def test_cable_name_change_renames_folder(self, mock_rename):
        """Verify storage folder is renamed when cable name changes."""
        project = ProjectFactory()
        flag = FlagFactory()
        cable_type = CableTypeFactory()

        cable = Cable.objects.create(
            name="Original Name",
            cable_type=cable_type,
            project=project,
            flag=flag,
        )

        cable.name = "New Name"
        cable.save()

        mock_rename.assert_called_once_with(cable, "Original Name", "New Name")

    @patch("apps.api.services.rename_feature_folder")
    def test_cable_name_unchanged_no_folder_rename(self, mock_rename):
        """Verify no folder rename when cable name is not changed."""
        project = ProjectFactory()
        flag = FlagFactory()
        cable_type = CableTypeFactory()

        cable = Cable.objects.create(
            name="Same Name",
            cable_type=cable_type,
            project=project,
            flag=flag,
        )

        cable.length = 500.0
        cable.save()

        mock_rename.assert_not_called()

    def test_new_cable_creation_no_label_update(self):
        """Verify label update signal doesn't fire on new cable creation."""
        project = ProjectFactory()
        flag = FlagFactory()
        cable_type = CableTypeFactory()

        cable = Cable.objects.create(
            name="Brand New Cable",
            cable_type=cable_type,
            project=project,
            flag=flag,
        )

        assert Cable.objects.filter(pk=cable.pk).exists()


@pytest.mark.django_db
class TestPermissionCacheInvalidation:
    """Tests for permission cache invalidation signal handlers."""

    @pytest.fixture(autouse=True)
    def clear_cache(self):
        """Clear the cache before each test."""
        cache.clear()
        yield
        cache.clear()

    @pytest.fixture
    def test_user(self, db):
        """Create a test user for permission cache tests."""
        return User.objects.create_user(
            username="perm_test_user",
            email="permtest@example.com",
            password="testpass",
        )

    @pytest.fixture
    def admin_group(self, db):
        """Get the Admin group."""
        return Group.objects.get(name="Admin")

    def test_model_permission_save_invalidates_cache(self, test_user, admin_group):
        """Verify saving a ModelPermission clears all user permission caches."""
        cache_key = f"user_permissions:{test_user.pk}"
        cache.set(cache_key, {"trench": "view"})
        assert cache.get(cache_key) is not None

        perm = ModelPermission.objects.filter(group=admin_group).first()
        perm.save()

        assert cache.get(cache_key) is None

    def test_model_permission_delete_invalidates_cache(self, test_user, admin_group):
        """Verify deleting a ModelPermission clears all user permission caches."""
        cache_key = f"user_permissions:{test_user.pk}"
        cache.set(cache_key, {"trench": "view"})

        perm = ModelPermission.objects.filter(group=admin_group).first()
        perm.delete()

        assert cache.get(cache_key) is None

    def test_route_permission_save_invalidates_cache(self, test_user, admin_group):
        """Verify saving a RoutePermission clears all user permission caches."""
        cache_key = f"user_permissions:{test_user.pk}"
        cache.set(cache_key, {"trench": "view"})

        perm = RoutePermission.objects.filter(group=admin_group).first()
        perm.save()

        assert cache.get(cache_key) is None

    def test_user_group_change_invalidates_user_cache(self, test_user, admin_group):
        """Verify changing user groups clears that user's permission cache."""
        cache_key = f"user_permissions:{test_user.pk}"
        cache.set(cache_key, {"trench": "view"})

        test_user.groups.add(admin_group)

        assert cache.get(cache_key) is None

    def test_other_user_cache_survives_group_change(self, test_user, admin_group):
        """Verify other users' caches are not affected by one user's group change."""
        other_user = User.objects.create_user(
            username="other_user",
            email="other@example.com",
            password="pass",
        )
        other_key = f"user_permissions:{other_user.pk}"
        cache.set(other_key, {"trench": "full"})

        test_user.groups.add(admin_group)

        assert cache.get(other_key) is not None
