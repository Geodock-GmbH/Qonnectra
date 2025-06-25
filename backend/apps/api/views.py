from django.db import connection
from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Conduit,
    FeatureFiles,
    Flags,
    OlTrench,
    Projects,
    Trench,
    TrenchConduitConnection,
)
from .pageination import CustomPagination
from .routing import find_shortest_path
from .serializers import (
    ConduitSerializer,
    FeatureFilesSerializer,
    FlagsSerializer,
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
        uuid = self.request.query_params.get("uuid")
        if id_trench:
            queryset = queryset.filter(id_trench=id_trench)
        if uuid:
            queryset = queryset.filter(uuid=uuid)
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
    pagination_class = CustomPagination

    def get_queryset(self):
        queryset = OlTrench.objects.all()
        id_trench = self.request.query_params.get("id_trench")
        if id_trench:
            queryset = queryset.filter(id_trench=id_trench)
        uuid = self.request.query_params.get("uuid")
        if uuid:
            queryset = queryset.filter(uuid=uuid)
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
                    c1.company,
                    ct.construction_type,
                    c2.company,
                    ph.phase,
                    st.status,
                    s.surface,
                    f.flag
                FROM
                    public.ol_trench t
                LEFT JOIN public.flags f ON t.flag = f.id
                LEFT JOIN public.attributes_surface s ON t.surface = s.id
                LEFT JOIN public.attributes_construction_type ct ON t.construction_type = ct.id
                LEFT JOIN public.attributes_phase ph ON t.phase = ph.id
                LEFT JOIN public.attributes_status st ON t.status = st.id
                LEFT JOIN public.attributes_company c1 ON t.constructor = c1.id
                LEFT JOIN public.attributes_company c2 ON t.owner = c2.id
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


class FlagsViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the Flags model :model:`api.Flags`.

    An instance of :model:`api.Flags`.
    """

    permission_classes = [IsAuthenticated]
    queryset = Flags.objects.all().order_by("flag")
    serializer_class = FlagsSerializer
    lookup_field = "id"
    lookup_url_kwarg = "pk"


class ConduitViewSet(viewsets.ModelViewSet):
    """ViewSet for the Conduit model :model:`api.Conduit`.

    An instance of :model:`api.Conduit`.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = ConduitSerializer
    pagination_class = CustomPagination

    def get_queryset(self):
        """
        Optionally restricts the returned conduits by filtering against query parameters:
        - `project`: Filter by project ID
        - `flag`: Filter by flag ID
        - `name`: Filter by name (case-insensitive partial match)

        Multiple parameters can be combined (e.g., ?project=1&flag=2&name=fiber)
        """
        queryset = Conduit.objects.all().order_by("name")
        project_id = self.request.query_params.get("project")
        flag_id = self.request.query_params.get("flag")
        name = self.request.query_params.get("name")

        if project_id:
            try:
                project_id = int(project_id)
                queryset = queryset.filter(project=project_id)
            except ValueError:
                queryset = queryset.none()

        if flag_id:
            try:
                flag_id = int(flag_id)
                queryset = queryset.filter(flag=flag_id)
            except ValueError:
                queryset = queryset.none()

        if name:
            queryset = queryset.filter(name__icontains=name)

        return queryset


class TrenchConduitConnectionViewSet(viewsets.ModelViewSet):
    """ViewSet for the TrenchConduitConnection model :model:`api.TrenchConduitConnection`.

    An instance of :model:`api.TrenchConduitConnection`.
    """

    permission_classes = [IsAuthenticated]
    queryset = TrenchConduitConnection.objects.all()
    serializer_class = TrenchConduitSerializer
    pagination_class = CustomPagination

    def get_queryset(self):
        """
        Optionally restricts the returned connections to a given trench or conduit,
        by filtering against a `id_trench` or `name` query parameter in the URL.
        """
        queryset = TrenchConduitConnection.objects.all()
        trench_id = self.request.query_params.get("id_trench")
        conduit_id = self.request.query_params.get("uuid_conduit")
        name = self.request.query_params.get("name")

        if trench_id:
            queryset = queryset.filter(uuid_trench__id_trench=trench_id)

        if conduit_id:
            queryset = queryset.filter(uuid_conduit__uuid=conduit_id)

        if name:
            queryset = queryset.filter(uuid_conduit__name__icontains=name)

        return queryset


class RoutingView(APIView):
    """
    API view to find the shortest path between two trenches.
    """

    permission_classes = [IsAuthenticated]

    def get(
        self,
        request,
        start_trench_id,
        end_trench_id,
        project_id,
        tolerance=1,
        format=None,
    ):
        """
        Calculates and returns the shortest path between two trenches.

        URL: /api/routing/<start_trench_id>/<end_trench_id>/<project_id>/
        """
        try:
            start_id = int(start_trench_id)
            end_id = int(end_trench_id)
        except ValueError:
            return Response(
                {"error": "Trench IDs must be integers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = find_shortest_path(start_id, end_id, project_id, tolerance)

        if "error" in result:
            # Check for not found vs. other errors
            if "not found" in result["error"]:
                return Response(result, status=status.HTTP_404_NOT_FOUND)
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

        return Response(result, status=status.HTTP_200_OK)
