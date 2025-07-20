from django.db import connection
from django.db.models import Q
from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Address,
    AttributesCompany,
    AttributesConduitType,
    AttributesMicroductStatus,
    AttributesNetworkLevel,
    AttributesStatus,
    Conduit,
    FeatureFiles,
    Flags,
    Microduct,
    MicroductConnection,
    Node,
    OlAddress,
    OlNode,
    OlTrench,
    Projects,
    Trench,
    TrenchConduitConnection,
)
from .pageination import CustomPagination
from .routing import find_shortest_path
from .serializers import (
    AddressSerializer,
    AttributesCompanySerializer,
    AttributesConduitTypeSerializer,
    AttributesMicroductStatusSerializer,
    AttributesNetworkLevelSerializer,
    AttributesStatusSerializer,
    ConduitSerializer,
    FeatureFilesSerializer,
    FlagsSerializer,
    MicroductConnectionSerializer,
    MicroductSerializer,
    NodeSerializer,
    OlAddressSerializer,
    OlNodeSerializer,
    OlTrenchSerializer,
    ProjectsSerializer,
    TrenchConduitSerializer,
    TrenchSerializer,
)
from .services import generate_conduit_import_template, import_conduits_from_excel


class AttributesConduitTypeViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the AttributesConduitType model :model:`api.AttributesConduitType`.

    An instance of :model:`api.AttributesConduitType`.
    """

    permission_classes = [IsAuthenticated]

    queryset = AttributesConduitType.objects.all().order_by("conduit_type")
    serializer_class = AttributesConduitTypeSerializer
    lookup_field = "id"
    lookup_url_kwarg = "pk"


class AttributesStatusViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the AttributesStatus model :model:`api.AttributesStatus`.

    An instance of :model:`api.AttributesStatus`.
    """

    permission_classes = [IsAuthenticated]

    queryset = AttributesStatus.objects.all().order_by("status")
    serializer_class = AttributesStatusSerializer
    lookup_field = "id"
    lookup_url_kwarg = "pk"


class AttributesNetworkLevelViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the AttributesNetworkLevel model :model:`api.AttributesNetworkLevel`.

    An instance of :model:`api.AttributesNetworkLevel`.
    """

    permission_classes = [IsAuthenticated]

    queryset = AttributesNetworkLevel.objects.all().order_by("network_level")
    serializer_class = AttributesNetworkLevelSerializer
    lookup_field = "id"
    lookup_url_kwarg = "pk"


class AttributesCompanyViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the AttributesCompany model :model:`api.AttributesCompany`.

    An instance of :model:`api.AttributesCompany`.
    """

    permission_classes = [IsAuthenticated]

    queryset = AttributesCompany.objects.all().order_by("company")
    serializer_class = AttributesCompanySerializer
    lookup_field = "id"
    lookup_url_kwarg = "pk"


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
    lookup_field = "uuid"
    lookup_url_kwarg = "pk"

    @action(detail=False, methods=["get"], url_path="all")
    def all_conduits(self, request):
        """
        Returns all conduits with project and flag filters.
        No pagination is used.
        """
        queryset = Conduit.objects.all().order_by("name")
        project_id = request.query_params.get("project")
        flag_id = request.query_params.get("flag")
        search_term = request.query_params.get("search")
        if project_id:
            queryset = queryset.filter(project=project_id)
        if flag_id:
            queryset = queryset.filter(flag=flag_id)
        if search_term:
            queryset = queryset.filter(
                Q(name__icontains=search_term)
                | Q(conduit_type__conduit_type__icontains=search_term)
                | Q(outer_conduit__icontains=search_term)
                | Q(status__status__icontains=search_term)
                | Q(network_level__network_level__icontains=search_term)
                | Q(owner__company__icontains=search_term)
                | Q(constructor__company__icontains=search_term)
                | Q(manufacturer__company__icontains=search_term)
                | Q(flag__flag__icontains=search_term)
            )
        serializer = ConduitSerializer(queryset, many=True)
        return Response(serializer.data)

    def get_queryset(self):
        """
        Optionally restricts the returned conduits by filtering against query parameters:
        - `uuid`: Filter by UUID
        - `project`: Filter by project ID
        - `flag`: Filter by flag ID
        - `name`: Filter by name (case-insensitive partial match)

        Multiple parameters can be combined (e.g., ?project=1&flag=2&name=fiber)
        """
        queryset = Conduit.objects.all().order_by("name")
        uuid = self.request.query_params.get("uuid")
        project_id = self.request.query_params.get("project")
        flag_id = self.request.query_params.get("flag")
        name = self.request.query_params.get("name")

        if uuid:
            queryset = queryset.filter(uuid=uuid)

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

    @action(detail=False, methods=["get"], url_path="all")
    def all_connections(self, request):
        """
        Returns all trench-conduit connections with project and flag filters.
        """
        queryset = TrenchConduitConnection.objects.all()
        project_id = request.query_params.get("project")
        flag_id = request.query_params.get("flag")
        trench_id = request.query_params.get("id_trench")
        conduit_id = request.query_params.get("uuid_conduit")
        if project_id:
            queryset = queryset.filter(project=project_id)
        if flag_id:
            queryset = queryset.filter(flag=flag_id)
        if trench_id:
            queryset = queryset.filter(uuid_trench__id_trench=trench_id)
        if conduit_id:
            queryset = queryset.filter(uuid_conduit__uuid=conduit_id)
        serializer = TrenchConduitSerializer(queryset, many=True)
        return Response(serializer.data)

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

        if conduit_id and trench_id:
            queryset = queryset.filter(
                uuid_conduit__uuid=conduit_id, uuid_trench__id_trench=trench_id
            ).order_by("uuid_trench__id_trench")
        elif conduit_id:
            queryset = queryset.filter(uuid_conduit__uuid=conduit_id).order_by(
                "uuid_trench__id_trench"
            )

        if name:
            queryset = queryset.filter(uuid_conduit__name__icontains=name)

        return queryset


class AddressViewSet(viewsets.ModelViewSet):
    """ViewSet for the Address model :model:`api.Address`.

    An instance of :model:`api.Address`.
    """

    permission_classes = [IsAuthenticated]
    queryset = Address.objects.all().order_by(
        "street", "housenumber", "house_number_suffix"
    )
    serializer_class = AddressSerializer
    lookup_field = "uuid"
    lookup_url_kwarg = "pk"
    pagination_class = CustomPagination

    def get_queryset(self):
        """
        Optionally restricts the returned addresses by filtering against query parameters:
        - `uuid`: Filter by UUID
        - `project`: Filter by project ID
        - `flag`: Filter by flag ID
        - `name`: Filter by name (case-insensitive partial match)
        """
        queryset = Address.objects.all().order_by(
            "street", "housenumber", "house_number_suffix"
        )
        uuid = self.request.query_params.get("uuid")
        project_id = self.request.query_params.get("project")
        flag_id = self.request.query_params.get("flag")
        name = self.request.query_params.get("name")

        if uuid:
            queryset = queryset.filter(uuid=uuid)

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


class OlAddressViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the OlAddress model :model:`api.OlAddress`.

    An instance of :model:`api.OlAddress`.
    """

    permission_classes = [IsAuthenticated]
    queryset = OlAddress.objects.all().order_by(
        "street", "housenumber", "house_number_suffix"
    )
    serializer_class = OlAddressSerializer
    lookup_field = "uuid"
    lookup_url_kwarg = "pk"
    pagination_class = CustomPagination

    def get_queryset(self):
        """
        Optionally restricts the returned addresses by filtering against query parameters:
        - `uuid`: Filter by UUID
        - `project`: Filter by project ID
        - `flag`: Filter by flag ID
        """
        queryset = OlAddress.objects.all()
        project_id = self.request.query_params.get("project")
        flag_id = self.request.query_params.get("flag")
        if project_id:
            queryset = queryset.filter(project=project_id)
        if flag_id:
            queryset = queryset.filter(flag=flag_id)
        return queryset


class OlAddressTileViewSet(APIView):
    """ViewSet for the OlAddress model :model:`api.OlAddress`.

    An instance of :model:`api.OlAddress`.
    """

    permission_classes = [AllowAny]

    def get(self, request, z, x, y, format=None):
        """
        Serves MVT tiles for OlAddress.
        URL: /api/ol_address_tiles/{z}/{x}/{y}.mvt?project={project}
        """
        sql = """
            WITH mvtgeom AS (
                SELECT 
                ST_AsMVTGeom(
                        a.geom, 
                        ST_TileEnvelope(%(z)s, %(x)s, %(y)s),
                        extent => 4096,
                        buffer => 64
                    ) AS geom,
                    a.uuid,
                    a.id_address,
                    a.zip_code,
                    a.city,
                    a.district,
                    a.street,
                    a.housenumber,
                    a.house_number_suffix,
                    f.flag,
                    sd.status
            FROM ol_address  a
            LEFT JOIN attributes_status_development sd ON a.status_development = sd.id
            LEFT JOIN flags f ON a.flag = f.id
                WHERE
                    a.geom && ST_TileEnvelope(%(z)s, %(x)s, %(y)s, margin => (64.0 / 4096))
                    AND a.project = %(project)s
            )
            SELECT ST_AsMVT(mvtgeom, 'ol_address', 4096, 'geom') AS mvt
            FROM mvtgeom;
        """
        project_id = request.query_params.get("project")
        if project_id is None:
            return HttpResponse(
                "No project ID provided", status=400, content_type="text/plain"
            )
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
            return HttpResponse(status=204)


class NodeViewSet(viewsets.ModelViewSet):
    """ViewSet for the Node model :model:`api.Node`.

    An instance of :model:`api.Node`.
    """

    permission_classes = [IsAuthenticated]
    queryset = Node.objects.all().order_by("name")
    serializer_class = NodeSerializer
    lookup_field = "uuid"
    lookup_url_kwarg = "pk"
    pagination_class = CustomPagination

    def get_queryset(self):
        """
        Optionally restricts the returned nodes by filtering against query parameters:
        - `uuid`: Filter by UUID
        - `project`: Filter by project ID
        - `flag`: Filter by flag ID
        - `name`: Filter by name (case-insensitive partial match)
        """
        queryset = Node.objects.all().order_by("name")
        uuid = self.request.query_params.get("uuid")
        project_id = self.request.query_params.get("project")
        flag_id = self.request.query_params.get("flag")
        name = self.request.query_params.get("name")

        if uuid:
            queryset = queryset.filter(uuid=uuid)

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


class OlNodeViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the OlNode model :model:`api.OlNode`.

    An instance of :model:`api.OlNode`.
    """

    permission_classes = [IsAuthenticated]
    queryset = OlNode.objects.all().order_by("name")
    serializer_class = OlNodeSerializer
    lookup_field = "uuid"
    lookup_url_kwarg = "pk"
    pagination_class = CustomPagination

    def get_queryset(self):
        """
        Optionally restricts the returned addresses by filtering against query parameters:
        - `uuid`: Filter by UUID
        - `project`: Filter by project ID
        - `flag`: Filter by flag ID
        """
        queryset = OlNode.objects.all()
        project_id = self.request.query_params.get("project")
        flag_id = self.request.query_params.get("flag")
        if project_id:
            queryset = queryset.filter(project=project_id)
        if flag_id:
            queryset = queryset.filter(flag=flag_id)
        return queryset


class OlNodeTileViewSet(APIView):
    """ViewSet for the OlNode model :model:`api.OlNode`.

    An instance of :model:`api.OlNode`.
    """

    permission_classes = [AllowAny]

    def get(self, request, z, x, y, format=None):
        """
        Serves MVT tiles for OlNode.
        URL: /api/ol_node_tiles/{z}/{x}/{y}.mvt?project={project}
        """
        sql = """
            WITH mvtgeom AS (
                SELECT 
                ST_AsMVTGeom(
                        n.geom, 
                        ST_TileEnvelope(%(z)s, %(x)s, %(y)s),
                        extent => 4096,
                        buffer => 64
                    ) AS geom,
                    n.uuid,
                    n.name,
                    n.warranty,
                    n.date,
                    c2.company,
                    f.flag,
                    c3.company,
                    nl.network_level,
                    nt.node_type,
                    c1.company,
                    s.status,
                    coalesce(a.street || ' ' || a.housenumber, a.house_number_suffix,
                    a.street || '' || a.housenumber) as address
                FROM ol_node n
                LEFT JOIN address a on n.uuid_address = a.uuid
                LEFT JOIN attributes_company c1 on n.owner = c1.id
                LEFT JOIN attributes_company c2 on n.constructor = c2.id
                LEFT JOIN attributes_company c3 on n.manufacturer = c3.id
                LEFT JOIN attributes_network_level nl on n.network_level = nl.id
                LEFT JOIN attributes_node_type nt on n.node_type = nt.id
                LEFT JOIN attributes_status s on n.status = s.id
                LEFT JOIN flags f on n.flag = f.id
                WHERE
                    n.geom && ST_TileEnvelope(%(z)s, %(x)s, %(y)s, margin => (64.0 / 4096))
                    AND n.project = %(project)s
            )
            SELECT ST_AsMVT(mvtgeom, 'ol_node', 4096, 'geom') AS mvt
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
            return HttpResponse(status=204)


class RoutingView(APIView):
    """
    API view to find the shortest path between two trenches.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, format=None):
        """
        Calculates and returns the shortest path between two trenches.

        URL: /api/routing/
        Body (JSON): {
            "start_trench_id": int,
            "end_trench_id": int,
            "project_id": int,
            "tolerance": int (optional, default=1)
        }
        """
        start_trench_id = request.data.get("start_trench_id")
        end_trench_id = request.data.get("end_trench_id")
        project_id = request.data.get("project_id")[0]
        tolerance = request.data.get("tolerance", 1)[0]

        try:
            start_id = int(start_trench_id)
            end_id = int(end_trench_id)
        except (ValueError, TypeError):
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


class ConduitImportTemplateView(APIView):
    """ViewSet for the Conduit model :model:`api.Conduit`.

    An instance of :model:`api.Conduit`.

    Returns a template for importing conduits.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return generate_conduit_import_template()


class ConduitImportView(APIView):
    """
    API view to handle the import of conduits from an Excel file.
    """

    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response(
                {"error": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST
            )

        if not file_obj.name.endswith((".xlsx")):
            return Response(
                {"error": "Invalid file format. Please upload an .xlsx file."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = import_conduits_from_excel(file_obj)

        if result["success"]:
            return Response(
                {
                    "message": f"Successfully imported {result['created_count']} conduits."
                },
                status=status.HTTP_201_CREATED,
            )
        else:
            return Response(
                {"errors": result["errors"]}, status=status.HTTP_400_BAD_REQUEST
            )


class AttributesMicroductStatusViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the AttributesMicroductStatus model :model:`api.AttributesMicroductStatus`.

    An instance of :model:`api.AttributesMicroductStatus`.
    """

    permission_classes = [IsAuthenticated]
    queryset = AttributesMicroductStatus.objects.all().order_by("microduct_status")
    serializer_class = AttributesMicroductStatusSerializer
    lookup_field = "id"
    lookup_url_kwarg = "pk"


class MicroductViewSet(viewsets.ModelViewSet):
    """ViewSet for the Microduct model :model:`api.Microduct`.

    An instance of :model:`api.Microduct`.
    """

    permission_classes = [IsAuthenticated]
    queryset = Microduct.objects.all().order_by("number")
    serializer_class = MicroductSerializer
    lookup_field = "uuid"
    lookup_url_kwarg = "pk"
    pagination_class = CustomPagination

    def get_queryset(self):
        """
        Optionally restricts the returned microducts by filtering against query parameters:
        - `uuid_conduit`: Filter by conduit UUID
        - `number`: Filter by microduct number
        - `color`: Filter by color
        """
        queryset = Microduct.objects.all()
        uuid_conduit = self.request.query_params.get("uuid_conduit")
        number = self.request.query_params.get("number")
        color = self.request.query_params.get("color")

        if uuid_conduit:
            queryset = queryset.filter(uuid_conduit=uuid_conduit)
        if uuid_conduit and number:
            queryset = queryset.filter(uuid_conduit=uuid_conduit, number=number)
        if uuid_conduit and color:
            queryset = queryset.filter(uuid_conduit=uuid_conduit, color=color)
        return queryset


class MicroductConnectionViewSet(viewsets.ModelViewSet):
    """ViewSet for the MicroductConnection model :model:`api.MicroductConnection`.

    An instance of :model:`api.MicroductConnection`.
    """

    permission_classes = [IsAuthenticated]
    queryset = MicroductConnection.objects.all()
    serializer_class = MicroductConnectionSerializer
    lookup_field = "uuid"
    lookup_url_kwarg = "pk"
    pagination_class = CustomPagination

    def get_queryset(self):
        """
        Optionally restricts the returned microduct connections by filtering against query parameters:
        - `uuid_microduct_from`: Filter by microduct from UUID
        - `uuid_microduct_to`: Filter by microduct to UUID
        - `uuid_node`: Filter by node UUID
        """
        queryset = MicroductConnection.objects.all()
        uuid_microduct_from = self.request.query_params.get("uuid_microduct_from")
        uuid_microduct_to = self.request.query_params.get("uuid_microduct_to")
        uuid_node = self.request.query_params.get("uuid_node")

        if uuid_microduct_from:
            queryset = queryset.filter(uuid_microduct_from=uuid_microduct_from)
        if uuid_microduct_to:
            queryset = queryset.filter(uuid_microduct_to=uuid_microduct_to)
        if uuid_node:
            queryset = queryset.filter(uuid_node=uuid_node)
        return queryset
