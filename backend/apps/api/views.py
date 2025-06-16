from django.db import connection
from django.http import HttpResponse
from rest_framework import viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from .models import (
    Conduit,
    FeatureFiles,
    OlTrench,
    Projects,
    Trench,
    TrenchConduitConnection,
)
from .pageination import CustomPagination
from .serializers import (
    ConduitSerializer,
    FeatureFilesSerializer,
    OlTrenchSerializer,
    ProjectsSerializer,
    TrenchConduitSerializer,
    TrenchSerializer,
)


class TrenchViewSet(viewsets.ModelViewSet):
    """ViewSet for the Trench model :model:`api.Trench`.

    An instance of :model:`api.Trench`.
    """

    permission_classes = [IsAuthenticated]
    queryset = Trench.objects.all().order_by("id_trench")
    serializer_class = TrenchSerializer
    lookup_field = "id_trench"
    lookup_url_kwarg = "pk"
    pagination_class = CustomPagination

    def get_queryset(self):
        queryset = Trench.objects.all()
        id_trench = self.request.query_params.get("id_trench")
        if id_trench:
            queryset = queryset.filter(id_trench=id_trench)
        return queryset


class FeatureFilesViewSet(viewsets.ModelViewSet):
    """ViewSet for the FeatureFiles model :model:`api.FeatureFiles`.

    An instance of :model:`api.FeatureFiles`.
    """

    permission_classes = [IsAuthenticated]
    queryset = FeatureFiles.objects.all().order_by("object_id")
    serializer_class = FeatureFilesSerializer
    lookup_field = "uuid"
    lookup_url_kwarg = "pk"
    pagination_class = CustomPagination


class OlTrenchViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the OlTrench model :model:`api.OlTrench`.

    An instance of :model:`api.OlTrench`.
    """

    permission_classes = [IsAuthenticated]
    queryset = OlTrench.objects.all().order_by("id_trench")
    serializer_class = OlTrenchSerializer
    lookup_field = "id_trench"
    lookup_url_kwarg = "pk"

    def get_queryset(self):
        queryset = OlTrench.objects.all()
        id_trench = self.request.query_params.get("id_trench")
        if id_trench:
            queryset = queryset.filter(id_trench=id_trench)
        return queryset


class OlTrenchTileViewSet(APIView):
    """ViewSet for the OlTrench model :model:`api.OlTrench`.

    An instance of :model:`api.OlTrench`.
    """

    permission_classes = [AllowAny]

    def get(self, request, z, x, y, format=None):
        """
        Serves MVT tiles for OlTrench.
        URL: /api/ol_trench_tiles/{z}/{x}/{y}.mvt?project={project}
        """
        sql = """
            WITH mvtgeom AS (
                SELECT
                    ST_AsMVTGeom(
                        t.geom, 
                        ST_TileEnvelope(%(z)s, %(x)s, %(y)s),
                        extent => 4096,
                        buffer => 64
                    ) AS geom,
                    t.uuid,
                    t.id_trench,
                    t.construction_depth,
                    t.construction_details,
                    t.internal_execution,
                    t.funding_status,
                    t.date,
                    t.comment,
                    t.house_connection,
                    t.length,
                    t.company,
                    t.construction_type,
                    t.owner,
                    t.phase,
                    t.status,
                    t.surface,
                    t.flag
                FROM
                    public.ol_trench t
                WHERE
                    t.geom && ST_TileEnvelope(%(z)s, %(x)s, %(y)s, margin => (64.0 / 4096))
                    AND t.project = %(project)s
            )
            SELECT ST_AsMVT(mvtgeom, 'ol_trench', 4096, 'geom') AS mvt
            FROM mvtgeom;
        """
        project_id = request.query_params.get("project")
        if project_id is None:
            return HttpResponse(status=204)
        try:
            project_id = int(project_id)
        except ValueError:
            return HttpResponse(
                "Invalid project ID", status=400, content_type="text/plain"
            )

        params = {"z": int(z), "x": int(x), "y": int(y), "project": project_id}

        with connection.cursor() as cursor:
            cursor.execute(sql, params)
            row = cursor.fetchone()

        if row and row[0]:
            return HttpResponse(
                row[0], content_type="application/vnd.mapbox-vector-tile"
            )
        else:
            # Return an empty response or 204 No Content if no features in tile
            return HttpResponse(status=204)


class ProjectsViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the Projects model :model:`api.Projects`.

    An instance of :model:`api.Projects`.
    """

    permission_classes = [IsAuthenticated]
    queryset = Projects.objects.all().order_by("project")
    serializer_class = ProjectsSerializer
    lookup_field = "id"
    lookup_url_kwarg = "pk"


class ConduitViewSet(viewsets.ModelViewSet):
    """ViewSet for the Conduit model :model:`api.Conduit`.

    An instance of :model:`api.Conduit`.
    """

    permission_classes = [IsAuthenticated]
    queryset = Conduit.objects.all()
    serializer_class = ConduitSerializer


class TrenchConduitConnectionViewSet(viewsets.ModelViewSet):
    """ViewSet for the TrenchConduitConnection model :model:`api.TrenchConduitConnection`.

    An instance of :model:`api.TrenchConduitConnection`.
    """

    permission_classes = [IsAuthenticated]
    queryset = TrenchConduitConnection.objects.all()
    serializer_class = TrenchConduitSerializer
