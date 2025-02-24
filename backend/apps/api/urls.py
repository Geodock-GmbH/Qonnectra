from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import OlTrenchViewSet, FeatureFilesViewSet, TrenchViewSet

router = DefaultRouter()
router.register(r"trench", TrenchViewSet, basename="trench")
router.register(r"feature_files", FeatureFilesViewSet, basename="feature_files")
router.register(r"ol_trench", OlTrenchViewSet, basename="ol_trench")
urlpatterns = [
    path("", include(router.urls)),
]
