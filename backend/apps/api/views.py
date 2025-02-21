from rest_framework import viewsets

from .models import OlTrench, Trench, TrenchFiles
from .serializers import OlTrenchSerializer, TrenchFilesSerializer, TrenchSerializer


class TrenchViewSet(viewsets.ModelViewSet):
    """ViewSet for the Trench model :model:`api.Trench`.

    An instance of :model:`api.Trench`.
    """

    queryset = Trench.objects.all().order_by("id_trench")
    serializer_class = TrenchSerializer
    lookup_field = "id_trench"
    lookup_url_kwarg = "pk"


class TrenchFilesViewSet(viewsets.ModelViewSet):
    """ViewSet for the TrenchFiles model :model:`api.TrenchFiles`.

    An instance of :model:`api.TrenchFiles`.
    """

    queryset = TrenchFiles.objects.all().order_by("id_trench")
    serializer_class = TrenchFilesSerializer
    lookup_field = "id_trench"
    lookup_url_kwarg = "pk"


class OlTrenchViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the OlTrench model :model:`api.OlTrench`.

    An instance of :model:`api.OlTrench`.
    """

    queryset = OlTrench.objects.all().order_by("id_trench")
    serializer_class = OlTrenchSerializer
    lookup_field = "id_trench"
    lookup_url_kwarg = "pk"
