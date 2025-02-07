from rest_framework import viewsets

from .models import Trench, OlTrench
from .serializers import TrenchSerializer, OlTrenchSerializer


class TrenchViewSet(viewsets.ModelViewSet):
    queryset = Trench.objects.all().order_by("id_trench")
    serializer_class = TrenchSerializer
    lookup_field = "id_trench"
    lookup_url_kwarg = "pk"


class OlTrenchViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = OlTrench.objects.all().order_by("id_trench")
    serializer_class = OlTrenchSerializer
    lookup_field = "id_trench"
    lookup_url_kwarg = "pk"
