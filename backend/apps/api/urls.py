from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import TrenchViewSet, OlTrenchViewSet

router = DefaultRouter()
router.register(r"trench", TrenchViewSet, basename="trench")
router.register(r"ol_trench", OlTrenchViewSet, basename="ol_trench")
urlpatterns = [
    path("", include(router.urls)),
]
