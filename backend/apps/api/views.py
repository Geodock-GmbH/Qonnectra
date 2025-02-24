from rest_framework import viewsets

from .models import OlTrench, Trench, FeatureFiles
from .serializers import OlTrenchSerializer, FeatureFilesSerializer, TrenchSerializer


class TrenchViewSet(viewsets.ModelViewSet):
    """ViewSet for the Trench model :model:`api.Trench`.

    An instance of :model:`api.Trench`.
    """

    queryset = Trench.objects.all().order_by("id_trench")
    serializer_class = TrenchSerializer
    lookup_field = "id_trench"
    lookup_url_kwarg = "pk"


class FeatureFilesViewSet(viewsets.ModelViewSet):
    """ViewSet for the FeatureFiles model :model:`api.FeatureFiles`.

    An instance of :model:`api.FeatureFiles`.
    """

    queryset = FeatureFiles.objects.all().order_by("feature_id")
    serializer_class = FeatureFilesSerializer
    lookup_field = "feature_id"
    lookup_url_kwarg = "pk"


class OlTrenchViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the OlTrench model :model:`api.OlTrench`.

    An instance of :model:`api.OlTrench`.
    """

    queryset = OlTrench.objects.all().order_by("id_trench")
    serializer_class = OlTrenchSerializer
    lookup_field = "id_trench"
    lookup_url_kwarg = "pk"
