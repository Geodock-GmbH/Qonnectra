"""Tests for Node, NodeStructure, and Container models."""

import pytest
from django.contrib.gis.geos import Point
from django.db import IntegrityError

from apps.api.models import (
    Container,
    ContainerType,
    NetworkSchemaSettings,
    Node,
    PipeBranchSettings,
)

from ..factories import (
    FlagFactory,
    NodeFactory,
    NodeTypeFactory,
    ProjectFactory,
)


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
class TestContainerTypeModel:
    """Tests for the ContainerType model."""

    def test_container_type_creation(self):
        """Test creating a container type."""
        container_type = ContainerType.objects.create(
            name="Splice Cassette",
            description="A cassette for splicing fibers",
        )
        assert container_type.id is not None
        assert container_type.name == "Splice Cassette"
        assert container_type.description == "A cassette for splicing fibers"

    def test_container_type_str_representation(self):
        """Test container type string representation."""
        container_type = ContainerType.objects.create(name="Test Type")
        assert str(container_type) == "Test Type"

    def test_container_type_with_optional_fields(self):
        """Test container type with icon and color fields."""
        container_type = ContainerType.objects.create(
            name="Rack Container",
            icon="server",
            color="#3B82F6",
            display_order=5,
        )
        assert container_type.icon == "server"
        assert container_type.color == "#3B82F6"
        assert container_type.display_order == 5

    def test_container_type_is_active_default(self):
        """Test that container type is active by default."""
        container_type = ContainerType.objects.create(name="Default Active Type")
        assert container_type.is_active is True

    def test_container_type_unique_name(self):
        """Test that container type name must be unique."""
        ContainerType.objects.create(name="Unique Type")
        with pytest.raises(IntegrityError):
            ContainerType.objects.create(name="Unique Type")


@pytest.mark.django_db
class TestContainerModel:
    """Tests for the Container model."""

    def test_container_creation(self):
        """Test creating a container."""
        container_type = ContainerType.objects.create(name="Cassette")
        node = NodeFactory()

        container = Container.objects.create(
            container_type=container_type,
            uuid_node=node,
            name="Container 1",
        )
        assert container.uuid is not None
        assert container.container_type == container_type
        assert container.uuid_node == node
        assert container.name == "Container 1"

    def test_container_hierarchy(self):
        """Test container parent-child relationship."""
        container_type = ContainerType.objects.create(name="Cassette")
        node = NodeFactory()

        parent = Container.objects.create(
            container_type=container_type,
            uuid_node=node,
            name="Parent",
        )
        child = Container.objects.create(
            container_type=container_type,
            uuid_node=node,
            name="Child",
            parent_container=parent,
        )

        assert child.parent_container == parent
        assert child in parent.children.all()

    def test_container_str_representation_with_name(self):
        """Test container string representation with custom name."""
        container_type = ContainerType.objects.create(name="Door")
        node = NodeFactory()
        container = Container.objects.create(
            container_type=container_type,
            uuid_node=node,
            name="Left Door",
        )
        assert str(container) == "Door (Left Door)"

    def test_container_str_representation_without_name(self):
        """Test container string representation without custom name."""
        container_type = ContainerType.objects.create(name="Rack")
        node = NodeFactory()
        container = Container.objects.create(
            container_type=container_type,
            uuid_node=node,
        )
        assert str(container) == "Rack"

    def test_container_get_display_name_with_custom_name(self):
        """Test get_display_name returns custom name when set."""
        container_type = ContainerType.objects.create(name="Generic")
        node = NodeFactory()
        container = Container.objects.create(
            container_type=container_type,
            uuid_node=node,
            name="Custom Name",
        )
        assert container.get_display_name() == "Custom Name"

    def test_container_get_display_name_without_custom_name(self):
        """Test get_display_name returns type name when no custom name."""
        container_type = ContainerType.objects.create(name="Type Name")
        node = NodeFactory()
        container = Container.objects.create(
            container_type=container_type,
            uuid_node=node,
        )
        assert container.get_display_name() == "Type Name"

    def test_container_is_expanded_default(self):
        """Test that container is expanded by default."""
        container_type = ContainerType.objects.create(name="Test Type")
        node = NodeFactory()
        container = Container.objects.create(
            container_type=container_type,
            uuid_node=node,
        )
        assert container.is_expanded is True

    def test_container_deleted_when_node_deleted(self):
        """Test that containers are deleted when parent node is deleted."""
        container_type = ContainerType.objects.create(name="Deletable Type")
        node = NodeFactory()
        container = Container.objects.create(
            container_type=container_type,
            uuid_node=node,
        )
        container_uuid = container.uuid

        node.delete()

        assert not Container.objects.filter(uuid=container_uuid).exists()


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
