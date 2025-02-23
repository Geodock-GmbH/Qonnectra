from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import OlTrenchViewSet, TrenchFilesViewSet, TrenchViewSet

router = DefaultRouter()
router.register(r"trench", TrenchViewSet, basename="trench")
router.register(r"trench_files", TrenchFilesViewSet, basename="trench_files")
router.register(r"ol_trench", OlTrenchViewSet, basename="ol_trench")
urlpatterns = [
    path("", include(router.urls)),
]
