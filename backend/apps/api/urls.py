from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    FeatureFilesViewSet,
    OlTrenchTileViewSet,
    OlTrenchViewSet,
    ProjectsViewSet,
    TrenchViewSet,
)

router = DefaultRouter()
router.register(r"trench", TrenchViewSet, basename="trench")
router.register(r"feature_files", FeatureFilesViewSet, basename="feature_files")
router.register(r"ol_trench", OlTrenchViewSet, basename="ol_trench")
router.register(r"projects", ProjectsViewSet, basename="projects")
urlpatterns = [
    path("", include(router.urls)),
    path(
        "ol_trench_tiles/<int:z>/<int:x>/<int:y>.mvt",
        OlTrenchTileViewSet.as_view(),
        name="ol_trench_tiles",
    ),
]
