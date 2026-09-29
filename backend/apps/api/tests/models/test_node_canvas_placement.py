"""Tests for the database trigger that places nodes on the network schema canvas."""

import pytest
from django.contrib.gis.geos import Point

from apps.api.models import NetworkSchemaSettings

from ..factories import NodeFactory, ProjectFactory


def _place(project, x, y, **kwargs):
    """Create a node at the given geo coordinate and return it as stored."""
    node = NodeFactory(project=project, geom=Point(x, y, srid=25832), **kwargs)
    node.refresh_from_db()
    return node


@pytest.mark.django_db
class TestNodeCanvasPlacement:
    """Nodes without a canvas position are placed from their geometry."""

    def test_first_node_becomes_the_canvas_origin(self):
        project = ProjectFactory()

        node = _place(project, 500000.0, 6000000.0)

        assert (node.canvas_x, node.canvas_y) == (0.0, 0.0)
        settings = NetworkSchemaSettings.objects.get(project=project)
        assert (settings.canvas_center_x, settings.canvas_center_y) == (
            500000.0,
            6000000.0,
        )

    def test_later_nodes_are_placed_relative_to_the_first_at_the_project_scale(self):
        project = ProjectFactory()
        _place(project, 500000.0, 6000000.0)
        NetworkSchemaSettings.objects.filter(project=project).update(canvas_scale=2.0)

        node = _place(project, 500100.0, 6000050.0)

        assert (node.canvas_x, node.canvas_y) == (200.0, -100.0)

    def test_widening_the_extent_does_not_move_the_origin(self):
        project = ProjectFactory()
        _place(project, 500000.0, 6000000.0)
        _place(project, 480000.0, 5990000.0)

        node = _place(project, 500010.0, 6000000.0)

        assert (node.canvas_x, node.canvas_y) == (5.0, 0.0)

    def test_new_settings_row_starts_unconfigured_at_the_default_scale(self):
        project = ProjectFactory()

        _place(project, 500000.0, 6000000.0)

        settings = NetworkSchemaSettings.objects.get(project=project)
        assert settings.configured is False
        assert settings.canvas_scale == 0.5

    def test_existing_settings_row_keeps_its_configuration(self):
        project = ProjectFactory()
        NetworkSchemaSettings.objects.create(
            project=project, configured=True, canvas_scale=1.0
        )

        node = _place(project, 500000.0, 6000000.0)
        second = _place(project, 500010.0, 6000000.0)

        settings = NetworkSchemaSettings.objects.get(project=project)
        assert settings.configured is True
        assert (settings.canvas_center_x, settings.canvas_center_y) == (
            500000.0,
            6000000.0,
        )
        assert (node.canvas_x, second.canvas_x) == (0.0, 10.0)

    def test_each_project_has_its_own_origin(self):
        _place(ProjectFactory(), 500000.0, 6000000.0)

        node = _place(ProjectFactory(), 600000.0, 5000000.0)

        assert (node.canvas_x, node.canvas_y) == (0.0, 0.0)

    def test_moving_a_placed_node_keeps_its_canvas_position(self):
        project = ProjectFactory()
        _place(project, 500000.0, 6000000.0)
        node = _place(project, 500010.0, 6000000.0)

        node.geom = Point(500500.0, 6000500.0, srid=25832)
        node.save()
        node.refresh_from_db()

        assert (node.canvas_x, node.canvas_y) == (5.0, 0.0)

    def test_saving_a_node_loaded_before_placement_keeps_its_position(self):
        project = ProjectFactory()
        _place(project, 500000.0, 6000000.0)
        stale = NodeFactory(
            project=project, geom=Point(500010.0, 6000000.0, srid=25832)
        )

        stale.name = "Renamed"
        stale.save()
        stale.refresh_from_db()

        assert (stale.canvas_x, stale.canvas_y) == (5.0, 0.0)

    def test_copied_canvas_position_is_replaced_by_one_from_the_geometry(self):
        project = ProjectFactory()
        _place(project, 500000.0, 6000000.0)

        copy = _place(
            project,
            500010.0,
            6000000.0,
            canvas_x=-40.0,
            canvas_y=75.0,
            child_canvas_x=12.0,
            child_canvas_y=34.0,
        )

        assert (copy.canvas_x, copy.canvas_y) == (5.0, 0.0)
        assert (copy.child_canvas_x, copy.child_canvas_y) == (None, None)

    def test_node_copied_from_another_project_is_placed_in_its_own_project(self):
        source_project = ProjectFactory()
        _place(source_project, 500000.0, 6000000.0)
        original = _place(source_project, 500100.0, 6000000.0)
        target_project = ProjectFactory()
        _place(target_project, 600000.0, 5000000.0)

        copy = _place(
            target_project,
            600020.0,
            5000000.0,
            canvas_x=original.canvas_x,
            canvas_y=original.canvas_y,
        )

        assert (copy.canvas_x, copy.canvas_y) == (10.0, 0.0)
