"""Tests for migrations 0075 and 0076, which hand canvas placement over to the node trigger."""

import pytest
from django.contrib.gis.geos import Point
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

BEFORE = [("api", "0074_usersettings")]
AFTER = [("api", "0075_network_schema_canvas_placement")]
MAJORITY_CENTER = [("api", "0076_canvas_center_from_placed_nodes")]


def _migrate(target):
    """Migrate the test database to ``target`` and return the historical apps."""
    executor = MigrationExecutor(connection)
    executor.migrate(target)
    executor.loader.build_graph()
    return executor.loader.project_state(target).apps


@pytest.fixture
def restore_latest_schema(transactional_db):
    """Migrate back to the latest schema before the database is flushed."""
    yield
    executor = MigrationExecutor(connection)
    executor.migrate(executor.loader.graph.leaf_nodes())


@pytest.mark.usefixtures("restore_latest_schema")
class TestCanvasPlacementMigration:
    """Existing projects keep their layout and unplaced nodes join it."""

    def _node(self, apps, project, x, y, canvas=(None, None)):
        """Create a historical node at a geo coordinate with an optional canvas position."""
        return apps.get_model("api", "Node").objects.create(
            name=f"Node {x} {y}",
            node_type=self.node_type,
            flag=self.flag,
            project=project,
            geom=Point(x, y, srid=25832),
            canvas_x=canvas[0],
            canvas_y=canvas[1],
        )

    def _setup(self, apps):
        """Create the shared lookups and return a synced and a never-synced project."""
        self.node_type = apps.get_model("api", "AttributesNodeType").objects.create(
            node_type="Migration Type"
        )
        self.flag = apps.get_model("api", "Flags").objects.create(flag="Migration Flag")
        projects = apps.get_model("api", "Projects").objects
        return projects.create(project="Synced"), projects.create(
            project="Never synced"
        )

    def test_synced_project_keeps_its_center_and_places_new_nodes_with_it(self):
        old_apps = _migrate(BEFORE)
        synced, _ = self._setup(old_apps)
        old_apps.get_model("api", "NetworkSchemaSettings").objects.create(
            project=synced
        )
        old_apps.get_model("api", "CanvasSyncStatus").objects.create(
            sync_key=f"project_{synced.id}", center_x=1000.0, center_y=2000.0, scale=0.5
        )
        placed = self._node(old_apps, synced, 1100.0, 2000.0, canvas=(-7.0, 3.0))
        unplaced = self._node(old_apps, synced, 5000.0, 2000.0)

        new_apps = _migrate(AFTER)

        settings = new_apps.get_model("api", "NetworkSchemaSettings").objects.get(
            project_id=synced.id
        )
        assert settings.configured is True
        assert (settings.canvas_center_x, settings.canvas_center_y) == (1000.0, 2000.0)
        assert settings.canvas_scale == 0.5
        nodes = new_apps.get_model("api", "Node").objects
        assert (nodes.get(pk=placed.pk).canvas_x, nodes.get(pk=placed.pk).canvas_y) == (
            -7.0,
            3.0,
        )
        assert (
            nodes.get(pk=unplaced.pk).canvas_x,
            nodes.get(pk=unplaced.pk).canvas_y,
        ) == (
            2000.0,
            0.0,
        )

    def test_never_synced_project_is_centered_on_its_nodes_and_stays_unconfigured(self):
        old_apps = _migrate(BEFORE)
        _, never_synced = self._setup(old_apps)
        west = self._node(old_apps, never_synced, 0.0, 0.0)
        east = self._node(old_apps, never_synced, 400.0, 200.0)

        new_apps = _migrate(AFTER)

        settings = new_apps.get_model("api", "NetworkSchemaSettings").objects.get(
            project_id=never_synced.id
        )
        assert settings.configured is False
        assert (settings.canvas_center_x, settings.canvas_center_y) == (200.0, 100.0)
        nodes = new_apps.get_model("api", "Node").objects
        assert (nodes.get(pk=west.pk).canvas_x, nodes.get(pk=west.pk).canvas_y) == (
            -100.0,
            50.0,
        )
        assert (nodes.get(pk=east.pk).canvas_x, nodes.get(pk=east.pk).canvas_y) == (
            100.0,
            -50.0,
        )


@pytest.mark.usefixtures("restore_latest_schema")
class TestCanvasCenterFromPlacedNodes:
    """The stored center is the one that most placed nodes were laid out with."""

    def _project_with_center(self, apps, center):
        """Create a project whose settings hold ``center`` at scale 0.5."""
        self.node_type = apps.get_model("api", "AttributesNodeType").objects.create(
            node_type="Center Type"
        )
        self.flag = apps.get_model("api", "Flags").objects.create(flag="Center Flag")
        project = apps.get_model("api", "Projects").objects.create(project="Drifted")
        apps.get_model("api", "NetworkSchemaSettings").objects.update_or_create(
            project=project,
            defaults={"canvas_center_x": center[0], "canvas_center_y": center[1]},
        )
        return project

    def _placed(self, apps, project, geo, canvas):
        """Create a node and give it a stored canvas position, as an older sync did."""
        nodes = apps.get_model("api", "Node").objects
        node = nodes.create(
            name=f"Node {geo}",
            node_type=self.node_type,
            flag=self.flag,
            project=project,
            geom=Point(*geo, srid=25832),
        )
        nodes.filter(pk=node.pk).update(canvas_x=canvas[0], canvas_y=canvas[1])
        return node

    def _center(self, apps, project):
        settings = apps.get_model("api", "NetworkSchemaSettings").objects.get(
            project_id=project.id
        )
        return (settings.canvas_center_x, settings.canvas_center_y)

    def test_center_moves_to_the_one_most_nodes_were_placed_with(self):
        apps = _migrate(AFTER)
        project = self._project_with_center(apps, (1000.0, 2000.0))
        majority = [
            self._placed(apps, project, (1000.0, 2000.0), (0.0, 200.0)),
            self._placed(apps, project, (1100.0, 2000.0), (50.0, 200.0)),
            self._placed(apps, project, (1000.0, 2100.0), (0.0, 150.0)),
        ]
        self._placed(apps, project, (1200.0, 2000.0), (100.0, 0.0))
        self._placed(apps, project, (1300.0, 2000.0), (150.0, 0.0))
        self._placed(apps, project, (1400.0, 2000.0), (-333.0, 77.0))

        new_apps = _migrate(MAJORITY_CENTER)

        assert self._center(new_apps, project) == (1000.0, 2400.0)
        stored = new_apps.get_model("api", "Node").objects.get(pk=majority[1].pk)
        assert (stored.canvas_x, stored.canvas_y) == (50.0, 200.0)

    def test_center_stays_when_no_other_center_explains_more_nodes(self):
        apps = _migrate(AFTER)
        project = self._project_with_center(apps, (1000.0, 2000.0))
        self._placed(apps, project, (1200.0, 2000.0), (100.0, 0.0))
        self._placed(apps, project, (1300.0, 2000.0), (150.0, 0.0))
        self._placed(apps, project, (1000.0, 2000.0), (0.0, 200.0))
        self._placed(apps, project, (1100.0, 2000.0), (50.0, 200.0))
        self._placed(apps, project, (1400.0, 2000.0), (-333.0, 77.0))

        new_apps = _migrate(MAJORITY_CENTER)

        assert self._center(new_apps, project) == (1000.0, 2000.0)
