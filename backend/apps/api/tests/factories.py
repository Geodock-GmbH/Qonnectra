"""
These factories provide a clean way to create test data for the application's models,
handling the complex relationships and required fields automatically.
"""

import factory
from apps.api.models import (
    Address,
    Area,
    AttributesAreaType,
    AttributesCableType,
    AttributesCompany,
    AttributesConduitType,
    AttributesConstructionType,
    AttributesFiberColor,
    AttributesFiberStatus,
    AttributesMicroductColor,
    AttributesNetworkLevel,
    AttributesNodeType,
    AttributesStatus,
    AttributesSurface,
    Cable,
    CableLabel,
    CableTypeColorMapping,
    Conduit,
    ConduitTypeColorMapping,
    Container,
    ContainerType,
    Fiber,
    FileTypeCategory,
    Flags,
    Microduct,
    MicroductCableConnection,
    MicroductConnection,
    Node,
    Projects,
    StoragePreferences,
    Trench,
    TrenchConduitCanvas,
    TrenchConduitConnection,
    WMSLayer,
    WMSSource,
)
from django.contrib.gis.geos import LineString, Point


class ProjectFactory(factory.django.DjangoModelFactory):
    """Factory for Projects model."""

    class Meta:
        model = Projects

    id = factory.Sequence(lambda n: n + 1)
    project = factory.Sequence(lambda n: f"Test Project {n}")
    description = factory.Faker("sentence")
    active = True


class FlagFactory(factory.django.DjangoModelFactory):
    """Factory for Flags model."""

    class Meta:
        model = Flags

    id = factory.Sequence(lambda n: n + 1)
    flag = factory.Sequence(lambda n: f"Test Flag {n}")


class CompanyFactory(factory.django.DjangoModelFactory):
    """Factory for AttributesCompany model."""

    class Meta:
        model = AttributesCompany

    id = factory.Sequence(lambda n: n + 1)
    company = factory.Sequence(lambda n: f"Test Company {n}")
    city = factory.Faker("city")
    postal_code = factory.Faker("postcode")
    street = factory.Faker("street_name")
    housenumber = factory.Faker("building_number")


class StatusFactory(factory.django.DjangoModelFactory):
    """Factory for AttributesStatus model."""

    class Meta:
        model = AttributesStatus

    id = factory.Sequence(lambda n: n + 1)
    status = factory.Sequence(lambda n: f"Status {n}")


class SurfaceFactory(factory.django.DjangoModelFactory):
    """Factory for AttributesSurface model."""

    class Meta:
        model = AttributesSurface

    id = factory.Sequence(lambda n: n + 1)
    surface = factory.Sequence(lambda n: f"Surface Type {n}")
    sealing = True


class ConstructionTypeFactory(factory.django.DjangoModelFactory):
    """Factory for AttributesConstructionType model."""

    class Meta:
        model = AttributesConstructionType

    id = factory.Sequence(lambda n: n + 1)
    construction_type = factory.Sequence(lambda n: f"Construction Type {n}")


class NodeTypeFactory(factory.django.DjangoModelFactory):
    """Factory for AttributesNodeType model."""

    class Meta:
        model = AttributesNodeType

    id = factory.Sequence(lambda n: n + 1)
    node_type = factory.Sequence(lambda n: f"Node Type {n}")


class NetworkLevelFactory(factory.django.DjangoModelFactory):
    """Factory for AttributesNetworkLevel model."""

    class Meta:
        model = AttributesNetworkLevel

    id = factory.Sequence(lambda n: n + 1)
    network_level = factory.Sequence(lambda n: f"Network Level {n}")


class ConduitTypeFactory(factory.django.DjangoModelFactory):
    """Factory for AttributesConduitType model."""

    class Meta:
        model = AttributesConduitType

    id = factory.Sequence(lambda n: n + 1)
    conduit_type = factory.Sequence(lambda n: f"Conduit Type {n}")
    conduit_count = 7


class CableTypeFactory(factory.django.DjangoModelFactory):
    """Factory for AttributesCableType model."""

    class Meta:
        model = AttributesCableType

    cable_type = factory.Sequence(lambda n: f"Cable Type {n}")
    fiber_count = 12
    bundle_count = 2
    bundle_fiber_count = 6


class MicroductColorFactory(factory.django.DjangoModelFactory):
    """Factory for AttributesMicroductColor model."""

    class Meta:
        model = AttributesMicroductColor

    name_de = factory.Sequence(lambda n: f"Farbe {n}")
    name_en = factory.Sequence(lambda n: f"Color {n}")
    hex_code = factory.Sequence(lambda n: f"#{n:06d}")


class FiberColorFactory(factory.django.DjangoModelFactory):
    """Factory for AttributesFiberColor model."""

    class Meta:
        model = AttributesFiberColor

    name_de = factory.Sequence(lambda n: f"Faserfarbe {n}")
    name_en = factory.Sequence(lambda n: f"Fiber Color {n}")
    hex_code = factory.Sequence(lambda n: f"#{n:06d}")


class FiberStatusFactory(factory.django.DjangoModelFactory):
    """Factory for AttributesFiberStatus model."""

    class Meta:
        model = AttributesFiberStatus

    fiber_status = factory.Sequence(lambda n: f"Fiber Status {n}")


class AreaTypeFactory(factory.django.DjangoModelFactory):
    """Factory for AttributesAreaType model."""

    class Meta:
        model = AttributesAreaType

    area_type = factory.Sequence(lambda n: f"Area Type {n}")


class TrenchFactory(factory.django.DjangoModelFactory):
    """Factory for Trench model."""

    class Meta:
        model = Trench

    id_trench = factory.Sequence(lambda n: f"TR-TEST{n:03d}")
    surface = factory.SubFactory(SurfaceFactory)
    construction_type = factory.SubFactory(ConstructionTypeFactory)
    length = factory.LazyAttribute(lambda o: 100.0)
    geom = factory.LazyAttribute(lambda o: LineString((0, 0), (100, 0), srid=25832))
    project = factory.SubFactory(ProjectFactory)
    flag = factory.SubFactory(FlagFactory)


class ConduitFactory(factory.django.DjangoModelFactory):
    """Factory for Conduit model."""

    class Meta:
        model = Conduit

    name = factory.Sequence(lambda n: f"Conduit-{n}")
    conduit_type = factory.SubFactory(ConduitTypeFactory)
    project = factory.SubFactory(ProjectFactory)
    flag = factory.SubFactory(FlagFactory)


class TrenchConduitConnectionFactory(factory.django.DjangoModelFactory):
    """Factory for TrenchConduitConnection model."""

    class Meta:
        model = TrenchConduitConnection

    uuid_trench = factory.SubFactory(TrenchFactory)
    uuid_conduit = factory.SubFactory(ConduitFactory)


class MicroductFactory(factory.django.DjangoModelFactory):
    """Factory for Microduct model."""

    class Meta:
        model = Microduct

    uuid_conduit = factory.SubFactory(ConduitFactory)
    number = factory.Sequence(lambda n: n + 1)
    color = factory.Sequence(lambda n: f"Color {n}")


class NodeFactory(factory.django.DjangoModelFactory):
    """Factory for Node model."""

    class Meta:
        model = Node

    name = factory.Sequence(lambda n: f"Node-{n}")
    node_type = factory.SubFactory(NodeTypeFactory)
    geom = factory.LazyAttribute(lambda o: Point(0, 0, srid=25832))
    project = factory.SubFactory(ProjectFactory)
    flag = factory.SubFactory(FlagFactory)


class AddressFactory(factory.django.DjangoModelFactory):
    """Factory for Address model."""

    class Meta:
        model = Address

    zip_code = "24941"
    city = "Flensburg"
    street = factory.Sequence(lambda n: f"Teststraße {n}")
    housenumber = factory.Sequence(lambda n: n + 1)
    geom = factory.LazyAttribute(lambda o: Point(0, 0, srid=25832))
    project = factory.SubFactory(ProjectFactory)
    flag = factory.SubFactory(FlagFactory)


class CableFactory(factory.django.DjangoModelFactory):
    """Factory for Cable model."""

    class Meta:
        model = Cable

    name = factory.Sequence(lambda n: f"Cable-{n}")
    cable_type = factory.SubFactory(CableTypeFactory)
    project = factory.SubFactory(ProjectFactory)
    flag = factory.SubFactory(FlagFactory)


class CableLabelFactory(factory.django.DjangoModelFactory):
    """Factory for CableLabel model."""

    class Meta:
        model = CableLabel

    cable = factory.SubFactory(CableFactory)
    text = factory.LazyAttribute(lambda o: o.cable.name)
    order = 0


class MicroductCableConnectionFactory(factory.django.DjangoModelFactory):
    """Factory for MicroductCableConnection model."""

    class Meta:
        model = MicroductCableConnection

    uuid_microduct = factory.SubFactory(MicroductFactory)
    uuid_cable = factory.SubFactory(CableFactory)


class ConduitTypeColorMappingFactory(factory.django.DjangoModelFactory):
    """Factory for ConduitTypeColorMapping model."""

    class Meta:
        model = ConduitTypeColorMapping

    conduit_type = factory.SubFactory(ConduitTypeFactory)
    position = factory.Sequence(lambda n: n + 1)
    color = factory.SubFactory(MicroductColorFactory)


class CableTypeColorMappingFactory(factory.django.DjangoModelFactory):
    """Factory for CableTypeColorMapping model."""

    class Meta:
        model = CableTypeColorMapping

    cable_type = factory.SubFactory(CableTypeFactory)
    position_type = "fiber"
    position = factory.Sequence(lambda n: n + 1)
    color = factory.SubFactory(FiberColorFactory)
    layer = "inner"


class FiberFactory(factory.django.DjangoModelFactory):
    """Factory for Fiber model."""

    class Meta:
        model = Fiber

    uuid_cable = factory.SubFactory(CableFactory)
    bundle_number = 1
    bundle_color = "rot"
    fiber_number_absolute = factory.Sequence(lambda n: n + 1)
    fiber_number_in_bundle = factory.Sequence(lambda n: (n % 6) + 1)
    fiber_color = "blau"
    active = True
    layer = "inner"
    flag = factory.SubFactory(FlagFactory)
    project = factory.SubFactory(ProjectFactory)


class AreaFactory(factory.django.DjangoModelFactory):
    """Factory for Area model."""

    class Meta:
        model = Area

    area_type = factory.SubFactory(AreaTypeFactory)
    name = factory.Sequence(lambda n: f"Area-{n}")
    geom = factory.LazyAttribute(lambda o: "POLYGON((0 0, 100 0, 100 100, 0 100, 0 0))")
    project = factory.SubFactory(ProjectFactory)
    flag = factory.SubFactory(FlagFactory)


class StoragePreferencesFactory(factory.django.DjangoModelFactory):
    """Factory for StoragePreferences model."""

    class Meta:
        model = StoragePreferences

    mode = "AUTO"
    folder_structure = {
        "trench": {"default": "trenches", "photos": "trenches/photos"},
        "conduit": {"default": "conduits"},
        "cable": {"default": "cables"},
        "node": {"default": "nodes"},
        "address": {"default": "addresses"},
    }


class FileTypeCategoryFactory(factory.django.DjangoModelFactory):
    """Factory for FileTypeCategory model."""

    class Meta:
        model = FileTypeCategory

    extension = factory.Sequence(lambda n: f"ext{n}")
    category = "documents"


class WMSSourceFactory(factory.django.DjangoModelFactory):
    """Factory for WMSSource model."""

    class Meta:
        model = WMSSource

    project = factory.SubFactory(ProjectFactory)
    name = factory.Sequence(lambda n: f"WMS Source {n}")
    url = factory.Sequence(lambda n: f"https://wms{n}.example.com/wms")
    is_active = True
    sort_order = factory.Sequence(lambda n: n)


class WMSLayerFactory(factory.django.DjangoModelFactory):
    """Factory for WMSLayer model."""

    class Meta:
        model = WMSLayer

    source = factory.SubFactory(WMSSourceFactory)
    name = factory.Sequence(lambda n: f"layer_{n}")
    title = factory.Sequence(lambda n: f"Layer {n}")
    is_enabled = True
    sort_order = factory.Sequence(lambda n: n)


class ContainerTypeFactory(factory.django.DjangoModelFactory):
    """Factory for ContainerType model."""

    class Meta:
        model = ContainerType

    name = factory.Sequence(lambda n: f"Container Type {n}")


class ContainerFactory(factory.django.DjangoModelFactory):
    """Factory for Container model."""

    class Meta:
        model = Container

    uuid_node = factory.SubFactory(NodeFactory)
    container_type = factory.SubFactory(ContainerTypeFactory)
    name = factory.Sequence(lambda n: f"Container-{n}")
    sort_order = factory.Sequence(lambda n: n)


class MicroductConnectionFactory(factory.django.DjangoModelFactory):
    """Factory for MicroductConnection model."""

    class Meta:
        model = MicroductConnection

    uuid_microduct_from = factory.SubFactory(MicroductFactory)
    uuid_trench_from = factory.SubFactory(TrenchFactory)
    uuid_microduct_to = factory.SubFactory(MicroductFactory)
    uuid_trench_to = factory.SubFactory(TrenchFactory)
    uuid_node = factory.SubFactory(NodeFactory)


class TrenchConduitCanvasFactory(factory.django.DjangoModelFactory):
    """Factory for TrenchConduitCanvas model."""

    class Meta:
        model = TrenchConduitCanvas

    trench = factory.SubFactory(TrenchFactory)
    conduit = factory.SubFactory(ConduitFactory)
    canvas_x = factory.Faker("pyfloat", min_value=0, max_value=500)
    canvas_y = factory.Faker("pyfloat", min_value=0, max_value=500)
    canvas_width = 80.0
    canvas_height = 80.0
