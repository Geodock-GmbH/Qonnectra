from rest_framework import viewsets

from .models import Trench
from .serializers import TrenchSerializer


# Create your views here.
class TrenchViewSet(viewsets.ModelViewSet):
    queryset = Trench.objects.all().order_by("id_trench")
    serializer_class = TrenchSerializer
    lookup_field = "id_trench"
    lookup_url_kwarg = "pk"
