from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AttributesCompanyViewSet,
    AttributesConduitTypeViewSet,
    AttributesNetworkLevelViewSet,
    AttributesStatusViewSet,
    ConduitImportTemplateView,
    ConduitImportView,
    ConduitViewSet,
    FeatureFilesViewSet,
    FlagsViewSet,
    OlTrenchTileViewSet,
    OlTrenchViewSet,
    ProjectsViewSet,
    RoutingView,
    TrenchConduitConnectionViewSet,
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
router.register(r"conduit", ConduitViewSet, basename="conduit")
router.register(r"flags", FlagsViewSet, basename="flags")
router.register(r"feature_files", FeatureFilesViewSet, basename="feature_files")
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
        "ol_trench_tiles/<int:z>/<int:x>/<int:y>.mvt",
        OlTrenchTileViewSet.as_view(),
        name="ol_trench_tiles",
    ),
    path(
        "routing/<int:start_trench_id>/<int:end_trench_id>/<int:project_id>/<int:tolerance>/",
        RoutingView.as_view(),
        name="routing",
    ),
]
