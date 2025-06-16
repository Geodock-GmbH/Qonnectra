from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ConduitViewSet,
    FeatureFilesViewSet,
    FlagsViewSet,
    OlTrenchTileViewSet,
    ProjectsViewSet,
    RoutingView,
    TrenchConduitConnectionViewSet,
    TrenchViewSet,
)

router = DefaultRouter()
router.register(r"conduit", ConduitViewSet, basename="conduit")
router.register(r"flags", FlagsViewSet, basename="flags")
router.register(r"feature_files", FeatureFilesViewSet, basename="feature_files")
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
        "ol_trench_tiles/<int:z>/<int:x>/<int:y>.mvt",
        OlTrenchTileViewSet.as_view(),
        name="ol_trench_tiles",
    ),
    path(
        "routing/<int:start_trench_id>/<int:end_trench_id>/<int:tolerance>/",
        RoutingView.as_view(),
        name="routing",
    ),
]
