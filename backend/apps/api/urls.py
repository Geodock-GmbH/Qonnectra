from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AddressViewSet,
    AttributesCableTypeViewSet,
    AttributesCompanyViewSet,
    AttributesConduitTypeViewSet,
    AttributesMicroductStatusViewSet,
    AttributesNetworkLevelViewSet,
    AttributesStatusViewSet,
    CableViewSet,
    ConduitImportTemplateView,
    ConduitImportView,
    ConduitViewSet,
    FeatureFilesViewSet,
    FlagsViewSet,
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
    RoutingView,
    TrenchConduitConnectionViewSet,
    TrenchesNearNodeView,
    TrenchViewSet,
)

router = DefaultRouter()
router.register(
    r"attributes_conduit_type",
    AttributesConduitTypeViewSet,
    basename="attributes_conduit_type",
)
router.register(
    r"attributes_status",
    AttributesStatusViewSet,
    basename="attributes_status",
)
router.register(
    r"attributes_network_level",
    AttributesNetworkLevelViewSet,
    basename="attributes_network_level",
)
router.register(
    r"attributes_company",
    AttributesCompanyViewSet,
    basename="attributes_company",
)
router.register(
    r"attributes_microduct_status",
    AttributesMicroductStatusViewSet,
    basename="attributes_microduct_status",
)
router.register(
    r"attributes_cable_type",
    AttributesCableTypeViewSet,
    basename="attributes_cable_type",
)
router.register(r"address", AddressViewSet, basename="address")
router.register(r"cable", CableViewSet, basename="cable")
router.register(r"conduit", ConduitViewSet, basename="conduit")
router.register(r"flags", FlagsViewSet, basename="flags")
router.register(r"feature_files", FeatureFilesViewSet, basename="feature_files")
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
urlpatterns = [
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
]
