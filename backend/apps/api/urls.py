from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AddressViewSet,
    AreaViewSet,
    AttributesAreaTypeViewSet,
    AttributesCableTypeViewSet,
    AttributesCompanyViewSet,
    AttributesComponentStructureViewSet,
    AttributesComponentTypeViewSet,
    AttributesConduitTypeViewSet,
    AttributesConstructionTypeViewSet,
    AttributesFiberColorViewSet,
    AttributesMicroductColorViewSet,
    AttributesMicroductStatusViewSet,
    AttributesNetworkLevelViewSet,
    AttributesNodeTypeViewSet,
    AttributesStatusViewSet,
    AttributesSurfaceViewSet,
    CableLabelViewSet,
    CableTypeColorMappingViewSet,
    CableViewSet,
    ConduitImportTemplateView,
    ConduitImportView,
    ConduitViewSet,
    ContainerTypeViewSet,
    ContainerViewSet,
    ContentTypeViewSet,
    FeatureFilesViewSet,
    FiberViewSet,
    FlagsViewSet,
    FrontendLogView,
    GeoPackageSchemaView,
    LayerExtentView,
    LogEntryViewSet,
    MicroductCableConnectionViewSet,
    MicroductConnectionViewSet,
    MicroductViewSet,
    NodeCanvasCoordinatesView,
    NodeSlotClipNumberViewSet,
    NodeSlotConfigurationViewSet,
    NodeSlotDividerViewSet,
    NodeStructureViewSet,
    NodeTrenchSelectionViewSet,
    NodeViewSet,
    OlAddressTileViewSet,
    OlAddressViewSet,
    OlAreaTileViewSet,
    OlAreaViewSet,
    OlNodeTileViewSet,
    OlNodeViewSet,
    OlTrenchTileViewSet,
    OlTrenchViewSet,
    ProjectsViewSet,
    QGISAuthView,
    RoutingView,
    TrenchConduitConnectionViewSet,
    TrenchesNearNodeView,
    TrenchViewSet,
    WebDAVAuthView,
)

router = DefaultRouter()
router.register(
    r"attributes_cable_type",
    AttributesCableTypeViewSet,
    basename="attributes_cable_type",
)
router.register(
    r"attributes_company",
    AttributesCompanyViewSet,
    basename="attributes_company",
)
router.register(
    r"attributes_conduit_type",
    AttributesConduitTypeViewSet,
    basename="attributes_conduit_type",
)
router.register(
    r"attributes_construction_type",
    AttributesConstructionTypeViewSet,
    basename="attributes_construction_type",
)
router.register(
    r"attributes_surface",
    AttributesSurfaceViewSet,
    basename="attributes_surface",
)
router.register(
    r"attributes_fiber_color",
    AttributesFiberColorViewSet,
    basename="attributes_fiber_color",
)
router.register(
    r"attributes_microduct_color",
    AttributesMicroductColorViewSet,
    basename="attributes_microduct_color",
)
router.register(
    r"attributes_microduct_status",
    AttributesMicroductStatusViewSet,
    basename="attributes_microduct_status",
)
router.register(
    r"attributes_network_level",
    AttributesNetworkLevelViewSet,
    basename="attributes_network_level",
)
router.register(
    r"attributes_node_type",
    AttributesNodeTypeViewSet,
    basename="attributes_node_type",
)
router.register(
    r"attributes_status",
    AttributesStatusViewSet,
    basename="attributes_status",
)
router.register(
    r"attributes_area_type",
    AttributesAreaTypeViewSet,
    basename="attributes_area_type",
)
router.register(
    r"attributes_component_type",
    AttributesComponentTypeViewSet,
    basename="attributes_component_type",
)
router.register(
    r"attributes_component_structure",
    AttributesComponentStructureViewSet,
    basename="attributes_component_structure",
)
router.register(r"content-types", ContentTypeViewSet, basename="content-types")
router.register(r"address", AddressViewSet, basename="address")
router.register(r"area", AreaViewSet, basename="area")
router.register(r"cable", CableViewSet, basename="cable")
router.register(r"cable_label", CableLabelViewSet, basename="cable_label")
router.register(
    r"cable_type_color_mapping",
    CableTypeColorMappingViewSet,
    basename="cable_type_color_mapping",
)
router.register(r"conduit", ConduitViewSet, basename="conduit")
router.register(r"flags", FlagsViewSet, basename="flags")
router.register(r"feature-files", FeatureFilesViewSet, basename="feature-files")
router.register(r"microduct", MicroductViewSet, basename="microduct")
router.register(
    r"microduct_cable_connection",
    MicroductCableConnectionViewSet,
    basename="microduct_cable_connection",
)
router.register(
    r"microduct_connection", MicroductConnectionViewSet, basename="microduct_connection"
)
router.register(r"fiber", FiberViewSet, basename="fiber")
router.register(r"node", NodeViewSet, basename="node")
router.register(r"ol_address", OlAddressViewSet, basename="ol_address")
router.register(r"ol_area", OlAreaViewSet, basename="ol_area")
router.register(r"ol_node", OlNodeViewSet, basename="ol_node")
router.register(r"ol_trench", OlTrenchViewSet, basename="ol_trench")
router.register(r"projects", ProjectsViewSet, basename="projects")
router.register(r"trench", TrenchViewSet, basename="trench")
router.register(
    r"trench_conduit_connection",
    TrenchConduitConnectionViewSet,
    basename="trench_conduit_connection",
)
router.register(r"logs", LogEntryViewSet, basename="logs")
router.register(
    r"node-trench-selection",
    NodeTrenchSelectionViewSet,
    basename="node-trench-selection",
)
router.register(
    r"node-structure",
    NodeStructureViewSet,
    basename="node-structure",
)
router.register(
    r"node-slot-configuration",
    NodeSlotConfigurationViewSet,
    basename="node-slot-configuration",
)
router.register(
    r"node-slot-divider",
    NodeSlotDividerViewSet,
    basename="node-slot-divider",
)
router.register(
    r"node-slot-clip-number",
    NodeSlotClipNumberViewSet,
    basename="node-slot-clip-number",
)
router.register(
    r"container-type",
    ContainerTypeViewSet,
    basename="container-type",
)
router.register(
    r"container",
    ContainerViewSet,
    basename="container",
)

urlpatterns = [
    path("logs/frontend/", FrontendLogView.as_view(), name="frontend-logs"),
    path("", include(router.urls)),
    path(
        "template/conduit/",
        ConduitImportTemplateView.as_view(),
        name="conduit-import-template",
    ),
    path("import/conduit/", ConduitImportView.as_view(), name="conduit-import"),
    path("schema.gpkg", GeoPackageSchemaView.as_view(), name="geopackage-schema"),
    path(
        "ol_address_tiles/<int:z>/<int:x>/<int:y>.mvt",
        OlAddressTileViewSet.as_view(),
        name="ol_address_tiles",
    ),
    path(
        "ol_node_tiles/<int:z>/<int:x>/<int:y>.mvt",
        OlNodeTileViewSet.as_view(),
        name="ol_node_tiles",
    ),
    path(
        "ol_trench_tiles/<int:z>/<int:x>/<int:y>.mvt",
        OlTrenchTileViewSet.as_view(),
        name="ol_trench_tiles",
    ),
    path(
        "ol_area_tiles/<int:z>/<int:x>/<int:y>.mvt",
        OlAreaTileViewSet.as_view(),
        name="ol_area_tiles",
    ),
    path(
        "routing/",
        RoutingView.as_view(),
        name="routing",
    ),
    path(
        "trenches-near-node/",
        TrenchesNearNodeView.as_view(),
        name="trenches-near-node",
    ),
    path(
        "canvas-coordinates/",
        NodeCanvasCoordinatesView.as_view(),
        name="node-canvas-coordinates",
    ),
    path(
        "auth/webdav-auth/",
        WebDAVAuthView.as_view(),
        name="webdav-auth",
    ),
    path(
        "auth/qgis-auth/",
        QGISAuthView.as_view(),
        name="qgis-auth",
    ),
    path(
        "layer-extent/",
        LayerExtentView.as_view(),
        name="layer-extent",
    ),
]
