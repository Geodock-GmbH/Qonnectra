import json
import logging

import psycopg
from django.conf import settings
from django.db import connection, transaction
from django.db.models import Count, F, Q, Sum
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Address,
    AttributesCableType,
    AttributesCompany,
    AttributesConduitType,
    AttributesFiberColor,
    AttributesMicroductColor,
    AttributesMicroductStatus,
    AttributesNetworkLevel,
    AttributesNodeType,
    AttributesStatus,
    Cable,
    CableLabel,
    CableTypeColorMapping,
    CanvasSyncStatus,
    Conduit,
    FeatureFiles,
    Flags,
    Microduct,
    MicroductCableConnection,
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
    AttributesCableTypeSerializer,
    AttributesCompanySerializer,
    AttributesConduitTypeSerializer,
    AttributesFiberColorSerializer,
    AttributesMicroductColorSerializer,
    AttributesMicroductStatusSerializer,
    AttributesNetworkLevelSerializer,
    AttributesNodeTypeSerializer,
    AttributesStatusSerializer,
    CableLabelSerializer,
    CableSerializer,
    CableTypeColorMappingSerializer,
    ConduitSerializer,
    FeatureFilesSerializer,
    FlagsSerializer,
    MicroductCableConnectionSerializer,
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

logger = logging.getLogger(__name__)


class AttributesCableTypeViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the AttributesCableType model :model:`api.AttributesCableType`.

    An instance of :model:`api.AttributesCableType`.
    """

    permission_classes = [IsAuthenticated]
    queryset = AttributesCableType.objects.all().order_by("cable_type")
    serializer_class = AttributesCableTypeSerializer
    lookup_field = "id"
    lookup_url_kwarg = "pk"


class AttributesConduitTypeViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the AttributesConduitType model :model:`api.AttributesConduitType`.

    An instance of :model:`api.AttributesConduitType`.
    """

    permission_classes = [IsAuthenticated]

    queryset = AttributesConduitType.objects.all().order_by("conduit_type")
    serializer_class = AttributesConduitTypeSerializer
    lookup_field = "id"
    lookup_url_kwarg = "pk"


class AttributesNodeTypeViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the AttributesNodeType model :model:`api.AttributesNodeType`.

    An instance of :model:`api.AttributesNodeType`.
    """

    permission_classes = [IsAuthenticated]
    queryset = AttributesNodeType.objects.all().order_by("node_type")
    serializer_class = AttributesNodeTypeSerializer
    lookup_field = "id"
    lookup_url_kwarg = "pk"

    def get_queryset(self):
        queryset = AttributesNodeType.objects.all().order_by("node_type")
        exclude_group = self.request.query_params.get("exclude_group")
        if exclude_group:
            queryset = queryset.exclude(group=exclude_group)
        return queryset


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

    An instance of :model: `api.Trench`.
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

    @action(detail=False, methods=["get"])
    def length_by_types(self, request):
        """Get trench lengths grouped by construction type and surface.

        Returns aggregated data showing total length for each combination
        of construction type and surface. Allows filtering by project and flag.
        """
        project = request.query_params.get("project")
        flag = request.query_params.get("flag")

        queryset = Trench.objects.all()

        if project:
            queryset = queryset.filter(project=project)
        if flag:
            queryset = queryset.filter(flag=flag)

        queryset = (
            queryset.annotate(
                bauweise=F("construction_type__construction_type"),
                oberfläche=F("surface__surface"),
            )
            .values("bauweise", "oberfläche")
            .annotate(gesamt_länge=Sum("length"))
            .order_by("bauweise", "oberfläche")
        )

        results = list(queryset)

        return Response({"results": results, "count": len(results)})

    @action(detail=False, methods=["get"])
    def total_length(self, request):
        status = self.request.query_params.get("status")
        project = self.request.query_params.get("project")
        flag = self.request.query_params.get("flag")
        surface = self.request.query_params.get("surface")
        construction_type = self.request.query_params.get("construction_type")

        queryset = self.get_queryset()
        if status:
            queryset = queryset.filter(status=status)
        if project:
            queryset = queryset.filter(project=project)
        if flag:
            queryset = queryset.filter(flag=flag)
        if surface:
            queryset = queryset.filter(surface=surface)
        if construction_type:
            queryset = queryset.filter(construction_type=construction_type)

        total_length = (
            queryset.aggregate(total_length=Sum("length"))["total_length"] or 0
        )

        return Response({"total_length": total_length, "count": queryset.count()})

    @action(detail=False, methods=["get"], url_path="all")
    def all_trenches(self, request):
        """
        Returns all trenches with project, flag, and search filters.
        No pagination is used.
        """
        queryset = Trench.objects.all().order_by("id_trench")
        project_id = request.query_params.get("project")
        flag_id = request.query_params.get("flag")
        search_term = request.query_params.get("search")

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

        if search_term:
            queryset = queryset.filter(
                Q(id_trench__icontains=search_term) | Q(comment__icontains=search_term)
            )

        serializer = TrenchSerializer(queryset, many=True)
        return Response(serializer.data)


class FeatureFilesViewSet(viewsets.ModelViewSet):
    """ViewSet for the FeatureFiles model :model:`api.FeatureFiles`.

    An instance of :model:`api.FeatureFiles`.

    Provides authenticated file downloads using Nginx X-Accel-Redirect for
    secure and efficient file serving.
    """

    permission_classes = [IsAuthenticated]
    queryset = FeatureFiles.objects.all().order_by("object_id")
    serializer_class = FeatureFilesSerializer
    lookup_field = "uuid"
    lookup_url_kwarg = "pk"
    pagination_class = CustomPagination

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, pk=None):
        """
        Download a file using X-Accel-Redirect for efficient serving.

        This endpoint validates user authentication and then redirects
        to Nginx's internal location for secure file serving.
        """
        # get_object() will raise Http404 if not found, no need for try/except
        file_obj = self.get_object()

        # Build the internal redirect path for Nginx
        # The file_path.name contains the relative path from MEDIA_ROOT
        file_path = file_obj.file_path.name
        redirect_url = f"/media/{file_path}"

        # Create response with X-Accel-Redirect header
        response = HttpResponse()
        response["X-Accel-Redirect"] = redirect_url
        response["Content-Type"] = ""  # Let Nginx determine content type
        response["Content-Disposition"] = (
            f'attachment; filename="{file_obj.file_name}.{file_obj.file_type}"'
        )

        return response


class WebDAVAuthView(APIView):
    """
    WebDAV authentication endpoint for Caddy forward_auth.

    This endpoint validates Django user credentials and returns:
    - 200 OK if credentials are valid (authenticated)
    - 401 Unauthorized if credentials are invalid

    Caddy uses this endpoint to authenticate WebDAV access to media files.

    Supports both JWT cookie authentication (for web users) and HTTP Basic
    authentication (for WebDAV clients like OS file managers).
    """

    permission_classes = [AllowAny]  # We handle auth manually

    def _authenticate_request(self, request):
        """
        Common authentication logic for all HTTP methods.
        Returns tuple: (success: bool, response_data: dict, status_code: int)
        """
        logger.info(
            f"WebDAV auth request: method={request.method}, "
            f"path={request.path}, user={request.user}"
        )

        # Check if the user is authenticated via session/JWT cookie
        if request.user and request.user.is_authenticated:
            logger.info(f"User authenticated via JWT cookie: {request.user.username}")
            return True, {"status": "authenticated"}, status.HTTP_200_OK

        # If not authenticated via session, check Authorization header for Basic auth
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")

        if not auth_header:
            logger.info(
                "No Authorization header provided - sending WWW-Authenticate challenge"
            )
            return False, {"error": "Unauthorized"}, status.HTTP_401_UNAUTHORIZED

        if auth_header.startswith("Basic "):
            try:
                import base64

                # Decode Basic auth credentials
                credentials = base64.b64decode(auth_header[6:]).decode("utf-8")
                username, password = credentials.split(":", 1)

                logger.debug(f"Attempting Basic auth for user: {username}")

                from django.contrib.auth import authenticate

                user = authenticate(username=username, password=password)

                if user is not None:
                    if user.is_active:
                        logger.info(f"User authenticated via Basic auth: {username}")
                        return True, {"status": "authenticated"}, status.HTTP_200_OK
                    else:
                        logger.warning(f"User account is inactive: {username}")
                        return (
                            False,
                            {"error": "Account inactive"},
                            status.HTTP_401_UNAUTHORIZED,
                        )
                else:
                    logger.warning(f"Authentication failed for user: {username}")
                    return (
                        False,
                        {"error": "Invalid credentials"},
                        status.HTTP_401_UNAUTHORIZED,
                    )

            except ValueError as e:
                logger.error(f"Failed to parse Basic auth credentials: {e}")
                return (
                    False,
                    {"error": "Invalid Authorization header format"},
                    status.HTTP_401_UNAUTHORIZED,
                )
            except Exception as e:
                logger.error(f"Unexpected error during Basic auth: {e}", exc_info=True)
                return (
                    False,
                    {"error": "Authentication error"},
                    status.HTTP_401_UNAUTHORIZED,
                )
        else:
            logger.warning(f"Unsupported Authorization type: {auth_header[:20]}...")
            return (
                False,
                {"error": "Unsupported Authorization type"},
                status.HTTP_401_UNAUTHORIZED,
            )

        # Should never reach here, but just in case
        return False, {"error": "Unauthorized"}, status.HTTP_401_UNAUTHORIZED

    def get(self, request, *args, **kwargs):
        """Handle GET requests from Caddy forward_auth."""
        success, data, status_code = self._authenticate_request(request)
        response = Response(data, status=status_code)

        # If authentication failed, add WWW-Authenticate header to trigger Basic Auth
        if status_code == status.HTTP_401_UNAUTHORIZED:
            response["WWW-Authenticate"] = 'Basic realm="WebDAV"'

        return response

    def post(self, request, *args, **kwargs):
        """Handle POST requests."""
        success, data, status_code = self._authenticate_request(request)
        return Response(data, status=status_code)

    def head(self, request, *args, **kwargs):
        """Handle HEAD requests."""
        success, data, status_code = self._authenticate_request(request)
        return Response(data, status=status_code)

    def options(self, request, *args, **kwargs):
        """Handle OPTIONS requests."""
        success, data, status_code = self._authenticate_request(request)
        return Response(data, status=status_code)


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

    def get_queryset(self):
        queryset = Projects.objects.all().order_by("project")
        active = self.request.query_params.get("active")
        if active:
            queryset = queryset.filter(active=active)
        return queryset


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
        return queryset  #


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
        trench_uuid = request.query_params.get("uuid_trench")
        trench_id = request.query_params.get("id_trench")
        conduit_id = request.query_params.get("uuid_conduit")
        if trench_uuid:
            queryset = queryset.filter(uuid_trench__uuid=trench_uuid)
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
        trench_uuid = self.request.query_params.get("uuid_trench")
        trench_id = self.request.query_params.get("id_trench")
        conduit_id = self.request.query_params.get("uuid_conduit")
        name = self.request.query_params.get("name")

        if trench_uuid:
            queryset = queryset.filter(uuid_trench__uuid=trench_uuid)

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

    @action(detail=False, methods=["get"], url_path="all")
    def all_addresses(self, request):
        """
        Returns all addresses with project and flag filters.
        No pagination is used.
        """
        queryset = Address.objects.all().order_by(
            "street", "housenumber", "house_number_suffix"
        )
        project_id = request.query_params.get("project")
        flag_id = request.query_params.get("flag")
        search_term = request.query_params.get("search")
        if project_id:
            queryset = queryset.filter(project=project_id)
        if flag_id:
            queryset = queryset.filter(flag=flag_id)
        if search_term:
            queryset = queryset.filter(
                Q(street__icontains=search_term)
                | Q(housenumber__icontains=search_term)
                | Q(house_number_suffix__icontains=search_term)
                | Q(zip_code__icontains=search_term)
                | Q(city__icontains=search_term)
                | Q(district__icontains=search_term)
            )
        serializer = AddressSerializer(queryset, many=True)
        return Response(serializer.data)


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

    @action(detail=False, methods=["get"], url_path="all")
    def all_ol_addresses(self, request):
        """
        Returns all ol_addresses with project and flag filters.
        No pagination is used.
        """
        queryset = OlAddress.objects.all().order_by(
            "street", "housenumber", "house_number_suffix"
        )
        project_id = request.query_params.get("project")
        flag_id = request.query_params.get("flag")
        if project_id:
            queryset = queryset.filter(project=project_id)
        if flag_id:
            queryset = queryset.filter(flag=flag_id)
        serializer = OlAddressSerializer(queryset, many=True)
        return Response(serializer.data)


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
        - `node_type`: Filter by node type
        """
        queryset = Node.objects.all().order_by("name")
        uuid = self.request.query_params.get("uuid")
        project_id = self.request.query_params.get("project")
        flag_id = self.request.query_params.get("flag")
        name = self.request.query_params.get("name")
        node_type = self.request.query_params.get("node_type")
        exclude_group = self.request.query_params.get("exclude_group")
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
        if node_type:
            queryset = queryset.filter(node_type=node_type)
        if exclude_group:
            queryset = queryset.exclude(node_type__group=exclude_group)
        return queryset

    @action(detail=False, methods=["get"])
    def count_of_nodes_by_type(self, request):
        """
        Returns the count of nodes by type.
        """
        project_id = request.query_params.get("project")
        flag = request.query_params.get("flag")

        queryset = Node.objects.all()
        if project_id:
            queryset = queryset.filter(project=project_id)
        if flag:
            queryset = queryset.filter(flag=flag)

        queryset = (
            queryset.values("node_type__node_type")
            .annotate(count=Count("node_type"))
            .order_by("node_type__node_type")
        )

        result = [
            {"node_type": row["node_type__node_type"], "count": row["count"]}
            for row in queryset
        ]

        return Response({"results": result, "count": len(result)})

    @action(detail=False, methods=["get"], url_path="all")
    def all_nodes(self, request):
        """
        Returns all nodes with project and flag filters.
        No pagination is used.
        """
        queryset = Node.objects.all().order_by("name")
        project_id = request.query_params.get("project")
        flag_id = request.query_params.get("flag")
        group = request.query_params.get("group")
        search_term = request.query_params.get("search")
        exclude_group = request.query_params.get("exclude_group")

        if project_id:
            queryset = queryset.filter(project=project_id)
        if flag_id:
            queryset = queryset.filter(flag=flag_id)
        if group:
            queryset = queryset.filter(node_type__group=group)
        if exclude_group:
            queryset = queryset.exclude(node_type__group=exclude_group)
        if search_term:
            queryset = queryset.filter(
                Q(name__icontains=search_term)
                | Q(node_type__node_type__icontains=search_term)
                | Q(status__status__icontains=search_term)
                | Q(network_level__network_level__icontains=search_term)
                | Q(owner__company__icontains=search_term)
                | Q(manufacturer__company__icontains=search_term)
                | Q(flag__flag__icontains=search_term)
            )
        serializer = NodeSerializer(queryset, many=True)
        return Response(serializer.data)


class NodeCanvasCoordinatesView(APIView):
    """
    Multi-user safe API view to calculate and store canvas coordinates for nodes.

    Uses CanvasSyncStatus model to prevent concurrent sync operations and
    ensure consistent results across multiple users.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, format=None):
        """
        Check the status of canvas coordinates and sync operations.

        Returns:
        {
            "total_nodes": int,
            "nodes_with_canvas": int,
            "nodes_missing_canvas": int,
            "sync_needed": bool,
            "sync_in_progress": bool,
            "sync_status": str,
            "sync_started_at": datetime,
            "sync_progress": float
        }
        """
        project_id = request.query_params.get("project_id")
        flag_id = request.query_params.get("flag_id")

        # Clean up stale sync operations first
        CanvasSyncStatus.cleanup_stale_syncs()

        # Generate sync key
        sync_key = CanvasSyncStatus.get_sync_key(project_id, flag_id)

        # Get or create sync status
        sync_status, created = CanvasSyncStatus.objects.get_or_create(
            sync_key=sync_key, defaults={"status": "IDLE", "started_by": request.user}
        )

        # Get node statistics
        queryset = Node.objects.filter(geom__isnull=False)

        if project_id:
            queryset = queryset.filter(project=project_id)
        if flag_id:
            queryset = queryset.filter(flag=flag_id)

        total_nodes = queryset.count()
        nodes_with_canvas = queryset.filter(
            canvas_x__isnull=False, canvas_y__isnull=False
        ).count()
        nodes_missing_canvas = total_nodes - nodes_with_canvas
        sync_needed = nodes_missing_canvas > 0
        sync_in_progress = sync_status.status == "IN_PROGRESS"

        # Calculate progress if sync is in progress
        progress = 0.0
        if sync_in_progress and total_nodes > 0:
            progress = (sync_status.nodes_processed / total_nodes) * 100

        return Response(
            {
                "total_nodes": total_nodes,
                "nodes_with_canvas": nodes_with_canvas,
                "nodes_missing_canvas": nodes_missing_canvas,
                "sync_needed": sync_needed,
                "sync_in_progress": sync_in_progress,
                "sync_status": sync_status.status,
                "sync_started_at": sync_status.started_at,
                "sync_progress": progress,
                "error_message": sync_status.error_message
                if sync_status.status == "FAILED"
                else None,
            }
        )

    def post(self, request, format=None):
        """
        Calculate and store canvas coordinates with concurrency control.

        Expected request body:
        {
            "project_id": int,  # Optional: filter by project
            "flag_id": int,     # Optional: filter by flag
            "scale": float      # Optional: scale factor (default: 1.0)
        }
        """
        project_id = request.data.get("project_id")
        flag_id = request.data.get("flag_id")
        scale = request.data.get("scale", 1.0)

        # Generate sync key
        sync_key = CanvasSyncStatus.get_sync_key(project_id, flag_id)

        try:
            with transaction.atomic():
                # Try to acquire sync lock atomically
                sync_status = (
                    CanvasSyncStatus.objects.select_for_update()
                    .filter(sync_key=sync_key)
                    .first()
                )

                if not sync_status:
                    sync_status = CanvasSyncStatus.objects.create(
                        sync_key=sync_key,
                        status="IN_PROGRESS",
                        started_by=request.user,
                        started_at=timezone.now(),
                        last_heartbeat=timezone.now(),
                        scale=scale,
                    )
                else:
                    # Check if sync is already in progress
                    if (
                        sync_status.status == "IN_PROGRESS"
                        and not sync_status.is_stale()
                    ):
                        return Response(
                            {
                                "message": "Canvas coordinate sync already in progress",
                                "sync_started_by": sync_status.started_by.username
                                if sync_status.started_by
                                else None,
                                "sync_started_at": sync_status.started_at,
                                "estimated_completion": None,  # Could add time estimation
                            },
                            status=409,
                        )  # Conflict

                    # Update sync status to IN_PROGRESS
                    sync_status.status = "IN_PROGRESS"
                    sync_status.started_by = request.user
                    sync_status.started_at = timezone.now()
                    sync_status.last_heartbeat = timezone.now()
                    sync_status.scale = scale
                    sync_status.nodes_processed = 0
                    sync_status.error_message = None
                    sync_status.save()

            # Now perform the sync operation outside the lock transaction
            return self._perform_sync(sync_status, project_id, flag_id, scale)

        except Exception as e:
            # Clean up sync status on error
            try:
                sync_status = CanvasSyncStatus.objects.get(sync_key=sync_key)
                sync_status.status = "FAILED"
                sync_status.completed_at = timezone.now()
                sync_status.error_message = str(e)
                sync_status.save()
            except CanvasSyncStatus.DoesNotExist:
                pass

            return Response(
                {"error": "Failed to start canvas coordinate sync", "message": str(e)},
                status=500,
            )

    def _perform_sync(self, sync_status, project_id, flag_id, scale):
        """
        Perform the actual canvas coordinate synchronization.
        """
        try:
            # Get nodes to process (snapshot at sync start)
            queryset = Node.objects.filter(geom__isnull=False)

            if project_id:
                queryset = queryset.filter(project=project_id)
            if flag_id:
                queryset = queryset.filter(flag=flag_id)

            nodes = list(queryset)

            if not nodes:
                sync_status.status = "COMPLETED"
                sync_status.completed_at = timezone.now()
                sync_status.save()
                return Response({"message": "No nodes found with geometry"}, status=400)

            # Extract coordinates from all nodes
            coordinates = []
            for node in nodes:
                if node.geom:
                    coords = node.geom.coords
                    coordinates.append({"x": coords[0], "y": coords[1], "node": node})

            if not coordinates:
                sync_status.status = "COMPLETED"
                sync_status.completed_at = timezone.now()
                sync_status.save()
                return Response({"message": "No valid coordinates found"}, status=400)

            # Calculate bounding box from snapshot
            min_x = min(coord["x"] for coord in coordinates)
            max_x = max(coord["x"] for coord in coordinates)
            min_y = min(coord["y"] for coord in coordinates)
            max_y = max(coord["y"] for coord in coordinates)

            # Calculate center
            center_x = (min_x + max_x) / 2
            center_y = (min_y + max_y) / 2

            # Store calculated values in sync status
            sync_status.center_x = center_x
            sync_status.center_y = center_y
            sync_status.save()

            # Update nodes with canvas coordinates in batches
            updated_count = 0
            batch_size = 100

            for i, coord_data in enumerate(coordinates):
                node = coord_data["node"]
                geo_x = coord_data["x"]
                geo_y = coord_data["y"]

                # Transform to canvas coordinates
                canvas_x = (geo_x - center_x) * scale
                canvas_y = -(geo_y - center_y) * scale  # Flip Y axis

                node.canvas_x = canvas_x
                node.canvas_y = canvas_y
                node.save(update_fields=["canvas_x", "canvas_y"])
                updated_count += 1

                # Update progress and heartbeat every batch
                if (i + 1) % batch_size == 0:
                    sync_status.nodes_processed = updated_count
                    sync_status.update_heartbeat()

            # Mark sync as completed
            sync_status.status = "COMPLETED"
            sync_status.completed_at = timezone.now()
            sync_status.nodes_processed = updated_count
            sync_status.save()

            return Response(
                {
                    "message": f"Successfully updated canvas coordinates for {updated_count} nodes",
                    "updated_count": updated_count,
                    "scale": scale,
                    "center": {"x": center_x, "y": center_y},
                    "bounds": {
                        "min_x": min_x,
                        "max_x": max_x,
                        "min_y": min_y,
                        "max_y": max_y,
                    },
                }
            )

        except Exception as e:
            # Mark sync as failed
            sync_status.status = "FAILED"
            sync_status.completed_at = timezone.now()
            sync_status.error_message = str(e)
            sync_status.save()
            raise


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
        uuid = self.request.query_params.get("uuid")
        project_id = self.request.query_params.get("project")
        flag_id = self.request.query_params.get("flag")
        if uuid:
            queryset = queryset.filter(uuid=uuid)
        if project_id:
            queryset = queryset.filter(project=project_id)
        if flag_id:
            queryset = queryset.filter(flag=flag_id)
        return queryset

    @action(detail=False, methods=["get"], url_path="all")
    def all_ol_nodes(self, request):
        """
        Returns all ol_nodes with project and flag filters.
        No pagination is used.
        """
        queryset = OlNode.objects.all().order_by("name")
        project_id = request.query_params.get("project")
        flag_id = request.query_params.get("flag")
        group = request.query_params.get("group")
        search_term = request.query_params.get("search")

        if project_id:
            queryset = queryset.filter(project=project_id)
        if flag_id:
            queryset = queryset.filter(flag=flag_id)
        if group:
            queryset = queryset.filter(node_type__group=group)
        if search_term:
            queryset = queryset.filter(
                Q(name__icontains=search_term)
                | Q(node_type__node_type__icontains=search_term)
                | Q(status__status__icontains=search_term)
                | Q(network_level__network_level__icontains=search_term)
                | Q(owner__company__icontains=search_term)
                | Q(manufacturer__company__icontains=search_term)
                | Q(flag__flag__icontains=search_term)
            )
        serializer = OlNodeSerializer(queryset, many=True)
        return Response(serializer.data)


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


class AttributesMicroductColorViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the AttributesMicroductColor model :model:`api.AttributesMicroductColor`.

    An instance of :model:`api.AttributesMicroductColor`.
    """

    permission_classes = [IsAuthenticated]
    queryset = AttributesMicroductColor.objects.filter(is_active=True).order_by(
        "display_order", "name_de"
    )
    serializer_class = AttributesMicroductColorSerializer
    lookup_field = "id"
    lookup_url_kwarg = "pk"


class AttributesFiberColorViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the AttributesFiberColor model :model:`api.AttributesFiberColor`.

    An instance of :model:`api.AttributesFiberColor`.
    """

    permission_classes = [IsAuthenticated]
    queryset = AttributesFiberColor.objects.filter(is_active=True).order_by(
        "display_order", "name_de"
    )
    serializer_class = AttributesFiberColorSerializer
    lookup_field = "id"
    lookup_url_kwarg = "pk"


class CableTypeColorMappingViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the CableTypeColorMapping model :model:`api.CableTypeColorMapping`.

    An instance of :model:`api.CableTypeColorMapping`.
    """

    permission_classes = [IsAuthenticated]
    queryset = CableTypeColorMapping.objects.all().order_by(
        "cable_type", "position_type", "position"
    )
    serializer_class = CableTypeColorMappingSerializer
    lookup_field = "uuid"
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

    @action(detail=False, methods=["get"], url_path="all")
    def all_microducts(self, request):
        """
        Returns all microducts.
        No pagination is applied.
        """
        queryset = Microduct.objects.all()
        uuid_conduit = request.query_params.get("uuid_conduit")
        number = request.query_params.get("number")
        color = request.query_params.get("color")
        if uuid_conduit:
            queryset = queryset.filter(uuid_conduit=uuid_conduit)
        if uuid_conduit and number:
            queryset = queryset.filter(uuid_conduit=uuid_conduit, number=number)
        if uuid_conduit and color:
            queryset = queryset.filter(uuid_conduit=uuid_conduit, color=color)
        serializer = MicroductSerializer(queryset, many=True)
        return Response(serializer.data)


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

    @action(detail=False, methods=["get"])
    def all_connections(self, request):
        """
        Returns all microduct connections.
        - `uuid_node`: Filter by node UUID
        """
        queryset = MicroductConnection.objects.all()
        uuid_node = request.query_params.get("uuid_node")
        if uuid_node:
            queryset = queryset.filter(uuid_node=uuid_node)
        serializer = MicroductConnectionSerializer(queryset, many=True)
        return Response(serializer.data)


class TrenchesNearNodeView(APIView):
    """
    API view to get trenches near a specific node and their associated microducts.

    This endpoint returns trenches within a specified distance of a node,
    along with their conduits and microducts.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, format=None):
        """
        Returns trenches near a node with their associated microducts.

        Query Parameters:
        - `node_name`: Name of the node to search around (required)
        - `distance`: Distance in meters to search around the node (default: 5)
        - `project`: Project ID to filter by (required)

        Returns:
        - List of trenches with their associated conduits and microducts
        """
        node_name = request.query_params.get("node_name")
        distance = request.query_params.get("distance", 5)
        project_id = request.query_params.get("project")

        if not all([node_name, project_id]):
            return Response(
                {"error": "node_name and project_id are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            distance = float(distance)
            project_id = int(project_id)
        except ValueError:
            return Response(
                {"error": "distance and project_id must be numeric values."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from .models import Node

            node = Node.objects.get(name=node_name, project=project_id)
            node_uuid = node.uuid
        except Node.DoesNotExist:
            return Response(
                {"error": f"Node '{node_name}' not found in project {project_id}."},
                status=status.HTTP_404_NOT_FOUND,
            )

        sql = """
        with trenches_near_node as (
            select t.uuid
            from 
                trench t,
                node n
            where st_dwithin(t.geom, n.geom, %s)
                and n.name = %s
                and n.project = %s
                and t.project = %s
        )
        select t.uuid, t.id_trench, c.uuid, c.name, md.uuid, md.number, md.color, md.microduct_status, mc.hex_code,
        mc.hex_code_secondary,
        mc.name_de,
        mc.name_en
        from microduct md
                join conduit c on c.uuid = md.uuid_conduit
                join trench_conduit_connect tcc on tcc.uuid_conduit = c.uuid
                join trench t on t.uuid = tcc.uuid_trench
                left join conduit_type_color_mapping ctcm
                on ctcm.conduit_type_id = c.conduit_type and md.number = ctcm.position
                left join attributes_microduct_color mc on ctcm.color_id = mc.id
        where t.project = %s
        and t.uuid = any (select uuid from trenches_near_node)
        order by t.id_trench, c.name, md.number;
        """

        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    sql,
                    [
                        distance,
                        node_name,
                        project_id,
                        project_id,
                        project_id,
                    ],
                )

                rows = cursor.fetchall()

        except Exception as e:
            return Response(
                {"error": f"Database error: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        trenches = {}
        for row in rows:
            (
                trench_uuid,
                trench_id,
                conduit_uuid,
                conduit_name,
                microduct_uuid,
                microduct_number,
                microduct_color,
                microduct_status,
                microduct_hex_code,
                microduct_hex_code_secondary,
                microduct_name_de,
                microduct_name_en,
            ) = row

            if trench_uuid not in trenches:
                trenches[trench_uuid] = {
                    "uuid": trench_uuid,
                    "id_trench": trench_id,
                    "conduits": {},
                }

            if conduit_uuid not in trenches[trench_uuid]["conduits"]:
                trenches[trench_uuid]["conduits"][conduit_uuid] = {
                    "uuid": conduit_uuid,
                    "name": conduit_name,
                    "microducts": [],
                }

            trenches[trench_uuid]["conduits"][conduit_uuid]["microducts"].append(
                {
                    "uuid": microduct_uuid,
                    "number": microduct_number,
                    "color": microduct_color,
                    "microduct_status": microduct_status,
                    "hex_code": microduct_hex_code,
                    "hex_code_secondary": microduct_hex_code_secondary,
                    "name_de": microduct_name_de,
                    "name_en": microduct_name_en,
                    "is_two_layer": microduct_hex_code_secondary is not None,
                }
            )

        result = []
        for trench_data in trenches.values():
            conduits_list = []
            for conduit_data in trench_data["conduits"].values():
                conduits_list.append(conduit_data)

            result.append(
                {
                    "uuid": trench_data["uuid"],
                    "id_trench": trench_data["id_trench"],
                    "conduits": conduits_list,
                }
            )

        result.sort(key=lambda x: x["id_trench"])

        return Response(
            {
                "trenches": result,
                "count": len(result),
                "node_uuid": node_uuid,
                "node_name": node_name,
                "distance": distance,
                "project_id": project_id,
            },
            status=status.HTTP_200_OK,
        )


class NodePositionListenView(APIView):
    """
    Long-polling endpoint for real-time node position updates.
    Uses PostgreSQL LISTEN/NOTIFY for efficient notifications.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        project_id = request.query_params.get("project", "1")
        timeout = min(
            int(request.query_params.get("timeout", "30")), 60
        )  # Max 60 seconds

        try:
            db_settings = settings.DATABASES["default"]
            conn_params = {
                "host": db_settings["HOST"],
                "port": db_settings["PORT"],
                "dbname": db_settings["NAME"],
                "user": db_settings["USER"],
                "password": db_settings["PASSWORD"],
            }

            with psycopg.connect(**conn_params, autocommit=True) as conn:
                with conn.cursor() as cursor:
                    cursor.execute("LISTEN node_position_updates")

                gen = conn.notifies(timeout=timeout)
                notifications = []

                try:
                    for notify in gen:
                        try:
                            payload = json.loads(notify.payload)
                            if str(payload.get("project_id")) == str(project_id):
                                notifications.append(
                                    {
                                        "node_id": payload["node_id"],
                                        "canvas_x": payload["canvas_x"],
                                        "canvas_y": payload["canvas_y"],
                                    }
                                )
                        except (json.JSONDecodeError, KeyError):
                            continue

                        if notifications:
                            gen.close()
                            return Response({"updates": notifications})

                except psycopg.OperationalError:
                    pass

                return Response({"updates": []})

        except Exception as e:
            return Response(
                {"error": f"Connection failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class CableViewSet(viewsets.ModelViewSet):
    """ViewSet for the Cable model :model:`api.Cable`.

    An instance of :model:`api.Cable`.
    """

    permission_classes = [IsAuthenticated]
    queryset = Cable.objects.all().order_by("name")
    serializer_class = CableSerializer
    lookup_field = "uuid"
    lookup_url_kwarg = "pk"
    pagination_class = CustomPagination

    @action(detail=False, methods=["get"], url_path="all")
    def all_cables(self, request):
        """
        Returns all cables with project, flag, and search filters.
        No pagination is used.
        """
        queryset = Cable.objects.all().order_by("name")
        project_id = request.query_params.get("project")
        flag_id = request.query_params.get("flag")
        name = request.query_params.get("name")
        search_term = request.query_params.get("search")
        if project_id:
            queryset = queryset.filter(project=project_id)
        if flag_id:
            queryset = queryset.filter(flag=flag_id)
        if name:
            queryset = queryset.filter(name__icontains=name)
        if search_term:
            queryset = queryset.filter(
                Q(name__icontains=search_term)
                | Q(cable_type__cable_type__icontains=search_term)
                | Q(status__status__icontains=search_term)
                | Q(network_level__network_level__icontains=search_term)
                | Q(owner__company__icontains=search_term)
                | Q(constructor__company__icontains=search_term)
                | Q(manufacturer__company__icontains=search_term)
                | Q(flag__flag__icontains=search_term)
            )
        serializer = CableSerializer(queryset, many=True)
        return Response(serializer.data)

    def get_queryset(self):
        """
        Optionally restricts the returned cables by filtering against query parameters:
        - `uuid`: Filter by UUID
        - `project`: Filter by project ID
        - `flag`: Filter by flag ID
        - `name`: Filter by name (case-insensitive partial match)
        """
        queryset = Cable.objects.all().order_by("name")
        uuid = self.request.query_params.get("uuid")
        project_id = self.request.query_params.get("project")
        flag_id = self.request.query_params.get("flag")
        name = self.request.query_params.get("name")
        if uuid:
            queryset = queryset.filter(uuid=uuid)
        if project_id:
            queryset = queryset.filter(project=project_id)
        if flag_id:
            queryset = queryset.filter(flag=flag_id)
        if name:
            queryset = queryset.filter(name__icontains=name)
        return queryset


class CableLabelViewSet(viewsets.ModelViewSet):
    """ViewSet for the CableLabel model :model:`api.CableLabel`.

    An instance of :model:`api.CableLabel`.
    """

    permission_classes = [IsAuthenticated]
    queryset = CableLabel.objects.all().order_by("cable", "order")
    serializer_class = CableLabelSerializer
    lookup_field = "uuid"
    lookup_url_kwarg = "pk"
    pagination_class = CustomPagination

    def get_queryset(self):
        """
        Optionally restricts the returned labels by filtering against query parameters:
        - `cable`: Filter by cable UUID
        """
        queryset = CableLabel.objects.all().order_by("cable", "order")
        cable_uuid = self.request.query_params.get("cable")
        if cable_uuid:
            queryset = queryset.filter(cable__uuid=cable_uuid)
        return queryset

    @action(detail=False, methods=["get"], url_path="all")
    def all_labels(self, request):
        """
        Returns all cable labels with optional cable filter.
        No pagination is used.
        """
        queryset = CableLabel.objects.all().order_by("cable", "order")
        cable_uuid = request.query_params.get("cable")
        if cable_uuid:
            queryset = queryset.filter(cable__uuid=cable_uuid)
        serializer = CableLabelSerializer(queryset, many=True)
        return Response(serializer.data)


class MicroductCableConnectionViewSet(viewsets.ModelViewSet):
    """ViewSet for the MicroductCableConnection model :model:`api.MicroductCableConnection`.

    An instance of :model:`api.MicroductCableConnection`.
    """

    permission_classes = [IsAuthenticated]
    queryset = MicroductCableConnection.objects.all()
    serializer_class = MicroductCableConnectionSerializer
    lookup_field = "uuid"
    lookup_url_kwarg = "pk"
    pagination_class = CustomPagination

    def get_queryset(self):
        """
        Optionally restricts the returned microduct cable connections by filtering against query parameters:
        - `uuid_microduct`: Filter by microduct UUID
        - `uuid_cable`: Filter by cable UUID
        """
        queryset = MicroductCableConnection.objects.all()
        uuid_microduct = self.request.query_params.get("uuid_microduct")
        uuid_cable = self.request.query_params.get("uuid_cable")
        if uuid_microduct:
            queryset = queryset.filter(uuid_microduct=uuid_microduct)
        if uuid_cable:
            queryset = queryset.filter(uuid_cable=uuid_cable)
        return queryset

    @action(detail=False, methods=["get"], url_path="all")
    def all_connections(self, request):
        """
        Returns all microduct cable connections.
        No pagination is used.
        """
        queryset = MicroductCableConnection.objects.all()
        uuid_microduct = request.query_params.get("uuid_microduct")
        uuid_cable = request.query_params.get("uuid_cable")
        if uuid_microduct:
            queryset = queryset.filter(uuid_microduct=uuid_microduct)
        if uuid_cable:
            queryset = queryset.filter(uuid_cable=uuid_cable)
        serializer = MicroductCableConnectionSerializer(queryset, many=True)
        return Response(serializer.data)
