from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import TrenchViewSet

router = DefaultRouter()
router.register(r"trench", TrenchViewSet, basename="trench")

urlpatterns = [
    path("", include(router.urls)),
]
