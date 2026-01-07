from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AddressViewSet,
    AttributesCableTypeViewSet,
    AttributesCompanyViewSet,
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
    ContentTypeViewSet,
    FeatureFilesViewSet,
    FlagsViewSet,
    FrontendLogView,
    LayerExtentView,
    LogEntryViewSet,
    MicroductCableConnectionViewSet,
    MicroductConnectionViewSet,
    MicroductViewSet,
    NodeCanvasCoordinatesView,
    NodePositionListenView,
    NodeViewSet,
    OlAddressTileViewSet,
    OlAddressViewSet,
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
    QGISAuthView,
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
router.register(r"content-types", ContentTypeViewSet, basename="content-types")
router.register(r"address", AddressViewSet, basename="address")
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
router.register(r"node", NodeViewSet, basename="node")
router.register(r"ol_address", OlAddressViewSet, basename="ol_address")
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

urlpatterns = [
    path("logs/frontend/", FrontendLogView.as_view(), name="frontend-logs"),
    path("", include(router.urls)),
    path(
        "template/conduit/",
        ConduitImportTemplateView.as_view(),
        name="conduit-import-template",
    ),
    path("import/conduit/", ConduitImportView.as_view(), name="conduit-import"),
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
        "node-position-listen/",
        NodePositionListenView.as_view(),
        name="node-position-listen",
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
