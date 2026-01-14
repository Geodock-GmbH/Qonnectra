import logging
import mimetypes
import os
from urllib.parse import quote

from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.core.files.base import ContentFile
from django.db import connection, transaction
from django.db.models import Avg, Count, F, Q, Sum
from django.http import FileResponse, HttpResponse
from django.utils import timezone
from django.utils.encoding import iri_to_uri
from pathvalidate import sanitize_filename
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Address,
    Area,
    AttributesAreaType,
    AttributesCableType,
    AttributesCompany,
    AttributesConduitType,
    AttributesConstructionType,
    AttributesFiberColor,
    AttributesMicroductColor,
    AttributesMicroductStatus,
    AttributesNetworkLevel,
    AttributesNodeType,
    AttributesStatus,
    AttributesSurface,
    Cable,
    CableLabel,
    CableTypeColorMapping,
    CanvasSyncStatus,
    Conduit,
    FeatureFiles,
    Flags,
    LogEntry,
    Microduct,
    MicroductCableConnection,
    MicroductConnection,
    NetworkSchemaSettings,
    Node,
    NodeTrenchSelection,
    OlAddress,
    OlArea,
    OlNode,
    OlTrench,
    PipeBranchSettings,
    Projects,
    Trench,
    TrenchConduitConnection,
)
from .pageination import CustomPagination
from .routing import find_shortest_path
from .serializers import (
    AddressSerializer,
    AreaSerializer,
    AttributesAreaTypeSerializer,
    AttributesCableTypeSerializer,
    AttributesCompanySerializer,
    AttributesConduitTypeSerializer,
    AttributesConstructionTypeSerializer,
    AttributesFiberColorSerializer,
    AttributesMicroductColorSerializer,
    AttributesMicroductStatusSerializer,
    AttributesNetworkLevelSerializer,
    AttributesNodeTypeSerializer,
    AttributesStatusSerializer,
    AttributesSurfaceSerializer,
    CableLabelSerializer,
    CableSerializer,
    CableTypeColorMappingSerializer,
    ConduitSerializer,
    ContentTypeSerializer,
    FeatureFilesSerializer,
    FlagsSerializer,
    LogEntrySerializer,
    MicroductCableConnectionSerializer,
    MicroductConnectionSerializer,
    MicroductSerializer,
    NodeSerializer,
    NodeTrenchSelectionBulkSerializer,
    NodeTrenchSelectionSerializer,
    OlAddressSerializer,
    OlAreaSerializer,
    OlNodeSerializer,
    OlTrenchSerializer,
    ProjectsSerializer,
    TrenchConduitSerializer,
    TrenchSerializer,
)
from .services import (
    GEOPACKAGE_LAYER_CONFIG,
    generate_conduit_import_template,
    generate_geopackage_schema,
    import_conduits_from_excel,
)

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


class ContentTypeViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for Django ContentType model."""

    permission_classes = [IsAuthenticated]
    serializer_class = ContentTypeSerializer
    lookup_field = "id"
    lookup_url_kwarg = "pk"

    def get_queryset(self):
        """Return only ContentTypes for api app models that support file uploads."""
        return ContentType.objects.filter(
            app_label="api",
            model__in=[
                "trench",
                "conduit",
                "cable",
                "node",
                "address",
                "residentialunit",
                "area",
            ],
        ).order_by("model")


class AttributesConstructionTypeViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the AttributesConstructionType model :model:`api.AttributesConstructionType`.

    An instance of :model:`api.AttributesConstructionType`.
    """

    permission_classes = [IsAuthenticated]
    queryset = AttributesConstructionType.objects.all().order_by("construction_type")
    serializer_class = AttributesConstructionTypeSerializer
    lookup_field = "id"
    lookup_url_kwarg = "pk"


class AttributesSurfaceViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the AttributesSurface model :model:`api.AttributesSurface`.

    An instance of :model:`api.AttributesSurface`.
    """

    permission_classes = [IsAuthenticated]
    queryset = AttributesSurface.objects.all().order_by("surface")
    serializer_class = AttributesSurfaceSerializer
    lookup_field = "id"
    lookup_url_kwarg = "pk"


class AttributesAreaTypeViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the AttributesAreaType model :model:`api.AttributesAreaType`.

    An instance of :model:`api.AttributesAreaType`.
    """

    permission_classes = [IsAuthenticated]
    queryset = AttributesAreaType.objects.all().order_by("area_type")
    serializer_class = AttributesAreaTypeSerializer
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

    @action(detail=False, methods=["get"])
    def average_house_connection_length(self, request):
        project = self.request.query_params.get("project")
        flag = self.request.query_params.get("flag")

        queryset = self.get_queryset().filter(house_connection=True)

        if project:
            queryset = queryset.filter(project=project)
        if flag:
            queryset = queryset.filter(flag=flag)

        avg_length = queryset.aggregate(avg_length=Avg("length"))["avg_length"] or 0

        return Response({"average_length": avg_length, "count": queryset.count()})

    @action(detail=False, methods=["get"])
    def length_with_funding(self, request):
        project = self.request.query_params.get("project")
        flag = self.request.query_params.get("flag")

        queryset = self.get_queryset().filter(funding_status=True)

        if project:
            queryset = queryset.filter(project=project)
        if flag:
            queryset = queryset.filter(flag=flag)

        total_length = (
            queryset.aggregate(total_length=Sum("length"))["total_length"] or 0
        )

        return Response({"total_length": total_length, "count": queryset.count()})

    @action(detail=False, methods=["get"])
    def length_with_internal_execution(self, request):
        project = self.request.query_params.get("project")
        flag = self.request.query_params.get("flag")

        queryset = self.get_queryset().filter(internal_execution=True)

        if project:
            queryset = queryset.filter(project=project)
        if flag:
            queryset = queryset.filter(flag=flag)

        total_length = (
            queryset.aggregate(total_length=Sum("length"))["total_length"] or 0
        )

        return Response({"total_length": total_length, "count": queryset.count()})

    @action(detail=False, methods=["get"])
    def length_by_status(self, request):
        project = self.request.query_params.get("project")
        flag = self.request.query_params.get("flag")

        queryset = self.get_queryset()

        if project:
            queryset = queryset.filter(project=project)
        if flag:
            queryset = queryset.filter(flag=flag)

        queryset = (
            queryset.annotate(status_name=F("status__status"))
            .values("status_name")
            .annotate(gesamt_länge=Sum("length"))
            .order_by("status_name")
        )

        results = list(queryset)

        return Response({"results": results, "count": len(results)})

    @action(detail=False, methods=["get"])
    def length_by_phase(self, request):
        project = self.request.query_params.get("project")
        flag = self.request.query_params.get("flag")

        queryset = self.get_queryset()

        if project:
            queryset = queryset.filter(project=project)
        if flag:
            queryset = queryset.filter(flag=flag)

        queryset = (
            queryset.annotate(network_level=F("phase__phase"))
            .values("network_level")
            .annotate(gesamt_länge=Sum("length"))
            .order_by("network_level")
        )

        results = list(queryset)

        return Response({"results": results, "count": len(results)})

    @action(detail=False, methods=["get"])
    def longest_routes(self, request):
        project = self.request.query_params.get("project")
        flag = self.request.query_params.get("flag")
        limit = int(self.request.query_params.get("limit", 5))

        queryset = self.get_queryset()

        if project:
            queryset = queryset.filter(project=project)
        if flag:
            queryset = queryset.filter(flag=flag)

        queryset = (
            queryset.annotate(
                construction_type_name=F("construction_type__construction_type"),
                surface_name=F("surface__surface"),
            )
            .values("id_trench", "length", "construction_type_name", "surface_name")
            .order_by("-length")[:limit]
        )

        results = list(queryset)

        return Response({"results": results, "count": len(results)})

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
            queryset = queryset.filter(Q(id_trench__icontains=search_term))

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

    def get_queryset(self):
        """
        Filter files by object_id query parameter.

        This ensures that files are only returned for the specific feature
        being viewed, preventing files from leaking between different features.
        """
        queryset = FeatureFiles.objects.all().order_by("file_path")

        object_id = self.request.query_params.get("object_id")
        if object_id:
            queryset = queryset.filter(object_id=object_id)

        return queryset

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, pk=None):
        """
        Download a file using X-Accel-Redirect for efficient serving.

        This endpoint validates user authentication and then redirects
        to Nginx's internal location for secure file serving.

        In development mode (DEBUG=True), files are served directly via
        Django's FileResponse since X-Accel-Redirect requires Nginx.
        """
        file_obj = self.get_object()

        # Construct filename and encode for RFC 2231 to support non-ASCII characters
        filename = f"{file_obj.file_name}.{file_obj.file_type}"
        encoded_filename = quote(filename)

        # In development, serve files directly (X-Accel-Redirect requires Nginx)
        if settings.DEBUG:
            mime_type, _ = mimetypes.guess_type(filename)
            if mime_type is None:
                mime_type = "application/octet-stream"
            file_handle = file_obj.file_path.open("rb")
            response = FileResponse(file_handle, content_type=mime_type)
            response["Content-Disposition"] = (
                f"attachment; filename*=UTF-8''{encoded_filename}"
            )
            return response

        # In production, use X-Accel-Redirect for Nginx
        file_path = file_obj.file_path.name
        redirect_url = f"/media/{file_path}"
        # Convert IRI to URI for Nginx X-Accel-Redirect (encodes Unicode characters)
        redirect_url = iri_to_uri(redirect_url)

        response = HttpResponse()
        response["X-Accel-Redirect"] = redirect_url
        response["Content-Type"] = ""  # Let Nginx determine content type
        response["Content-Disposition"] = (
            f"attachment; filename*=UTF-8''{encoded_filename}"
        )

        return response

    @action(detail=True, methods=["get"], url_path="preview")
    def preview(self, request, pk=None):
        """
        Preview a file using X-Accel-Redirect for efficient serving.

        This endpoint validates user authentication and then redirects
        to Nginx's internal location for secure file serving with inline
        content disposition, allowing browsers to display the file.

        In development mode (DEBUG=True), files are served directly via
        Django's FileResponse since X-Accel-Redirect requires Nginx.
        """
        file_obj = self.get_object()

        # Construct filename and encode for RFC 2231 to support non-ASCII characters
        filename = f"{file_obj.file_name}.{file_obj.file_type}"
        encoded_filename = quote(filename)

        mime_type, _ = mimetypes.guess_type(filename)
        if mime_type is None:
            mime_type = "application/octet-stream"

        # In development, serve files directly (X-Accel-Redirect requires Nginx)
        if settings.DEBUG:
            file_handle = file_obj.file_path.open("rb")
            response = FileResponse(file_handle, content_type=mime_type)
            response["Content-Disposition"] = (
                f"inline; filename*=UTF-8''{encoded_filename}"
            )
            return response

        # In production, use X-Accel-Redirect for Nginx
        file_path = file_obj.file_path.name
        redirect_url = f"/media/{file_path}"
        # Convert IRI to URI for Nginx X-Accel-Redirect (encodes Unicode characters)
        redirect_url = iri_to_uri(redirect_url)

        response = HttpResponse()
        response["X-Accel-Redirect"] = redirect_url
        response["Content-Type"] = mime_type
        response["Content-Disposition"] = f"inline; filename*=UTF-8''{encoded_filename}"

        return response

    @action(detail=True, methods=["post"], url_path="rename")
    def rename(self, request, pk=None):
        """
        Rename a file by updating both the filesystem and database.

        This endpoint:
        1. Validates the new filename
        2. Physically renames the file in storage
        3. Updates the database record atomically
        4. Returns the updated file object

        Request body:
            {
                "new_filename": "newname.ext"
            }
        """
        file_obj = self.get_object()
        new_filename = request.data.get("new_filename")

        if not new_filename:
            return Response(
                {"error": "new_filename is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            new_filename = sanitize_filename(new_filename)
        except Exception as e:
            return Response(
                {"error": f"Invalid filename: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        old_path = file_obj.file_path.name

        old_dir = os.path.dirname(old_path)
        new_path = os.path.join(old_dir, new_filename)

        if file_obj.file_path.storage.exists(new_path):
            return Response(
                {"error": "A file with this name already exists"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        elif len(new_path) >= 255:
            return Response(
                {"error": "File path is too long"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with transaction.atomic():
                with file_obj.file_path.storage.open(old_path, "rb") as old_file:
                    file_content = old_file.read()

                file_obj.file_path.storage.save(new_path, ContentFile(file_content))

                file_obj.file_path.storage.delete(old_path)

                file_obj.file_path.name = new_path

                filename_only = os.path.basename(new_path)
                name_parts = filename_only.rsplit(".", 1)
                file_obj.file_name = (
                    name_parts[0] if len(name_parts) > 1 else filename_only
                )
                file_obj.file_type = name_parts[1] if len(name_parts) > 1 else None
                file_obj.save()

            serializer = self.get_serializer(file_obj)
            return Response(serializer.data)

        except Exception as e:
            return Response(
                {"error": f"Failed to rename file: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def destroy(self, request, *args, **kwargs):
        """
        Delete both the database record and the physical file.

        This override ensures that when a FeatureFile is deleted via the API,
        both the database entry and the actual file on disk are removed.
        """
        instance = self.get_object()

        # Delete the physical file first
        if instance.file_path:
            try:
                # This calls the storage backend's delete() method
                instance.file_path.delete(save=False)
                logger.info(f"Deleted physical file: {instance.file_path.name}")
            except Exception as e:
                logger.error(
                    f"Error deleting physical file {instance.file_path.name}: {e}"
                )
                # Continue to delete DB record even if file deletion fails
                # (file might already be gone)

        # Delete the database record
        return super().destroy(request, *args, **kwargs)


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
                    logger.warning(
                        f"Authentication failed for user: {username}",
                        extra={
                            "request": request,
                            "path": request.path,
                        },
                    )
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


class QGISAuthView(APIView):
    """
    QGIS Server authentication endpoint for Caddy forward_auth.

    This endpoint validates Django user credentials and returns:
    - 200 OK if credentials are valid and user has QGIS access
    - 401 Unauthorized if credentials are invalid or user lacks permissions

    Caddy uses this endpoint to authenticate WMS/WFS/WCS access to QGIS Server.

    Supports both JWT cookie authentication (for web browsers) and HTTP Basic
    authentication (for QGIS Desktop and other GIS clients).
    """

    permission_classes = [AllowAny]  # We handle auth manually

    def _authenticate_request(self, request):
        """
        Common authentication logic for all HTTP methods.
        Returns tuple: (success: bool, response_data: dict, status_code: int)
        """
        logger.info(
            f"QGIS auth request: method={request.method}, "
            f"path={request.path}, user={request.user}"
        )

        if request.user and request.user.is_authenticated:
            logger.info(f"User authenticated via JWT cookie: {request.user.username}")
            return True, {"status": "authenticated"}, status.HTTP_200_OK

        auth_header = request.META.get("HTTP_AUTHORIZATION", "")

        if not auth_header:
            logger.info(
                "No Authorization header provided - sending WWW-Authenticate challenge"
            )
            return False, {"error": "Unauthorized"}, status.HTTP_401_UNAUTHORIZED

        if auth_header.startswith("Basic "):
            try:
                import base64

                credentials = base64.b64decode(auth_header[6:]).decode("utf-8")
                username, password = credentials.split(":", 1)

                logger.debug(f"Attempting Basic auth for QGIS access: {username}")

                from django.contrib.auth import authenticate

                user = authenticate(username=username, password=password)

                if user is not None:
                    if user.is_active:
                        logger.info(f"User authenticated via Basic auth: {username}")
                        return True, {"status": "authenticated"}, status.HTTP_200_OK
                    else:
                        logger.warning(
                            f"User account is inactive: {username}",
                            extra={
                                "request": request,
                                "path": request.path,
                            },
                        )
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

        return False, {"error": "Unauthorized"}, status.HTTP_401_UNAUTHORIZED

    def get(self, request, *args, **kwargs):
        """Handle GET requests from Caddy forward_auth."""
        success, data, status_code = self._authenticate_request(request)
        response = Response(data, status=status_code)

        # If authentication failed, add WWW-Authenticate header to trigger Basic Auth
        if status_code == status.HTTP_401_UNAUTHORIZED:
            response["WWW-Authenticate"] = 'Basic realm="QGIS Server"'

        return response

    def post(self, request, *args, **kwargs):
        """Handle POST requests."""
        success, data, status_code = self._authenticate_request(request)
        response = Response(data, status=status_code)

        if status_code == status.HTTP_401_UNAUTHORIZED:
            response["WWW-Authenticate"] = 'Basic realm="QGIS Server"'

        return response

    def head(self, request, *args, **kwargs):
        """Handle HEAD requests."""
        success, data, status_code = self._authenticate_request(request)
        response = Response(data, status=status_code)

        if status_code == status.HTTP_401_UNAUTHORIZED:
            response["WWW-Authenticate"] = 'Basic realm="QGIS Server"'

        return response

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
            WITH
            bounds AS (
                SELECT
                    ST_TileEnvelope(%(z)s, %(x)s, %(y)s) AS tile_bounds,
                    ST_TileEnvelope(%(z)s, %(x)s, %(y)s, margin => (64.0 / 4096)) AS tile_bounds_margin
            ),
            trench_conduits AS (
                SELECT
                    tcc.uuid_trench,
                    STRING_AGG(co.name, ', ' ORDER BY co.name) AS conduit_names
                FROM public.trench_conduit_connect tcc
                JOIN public.conduit co ON tcc.uuid_conduit = co.uuid
                GROUP BY tcc.uuid_trench
            ),
            mvtgeom AS (
                SELECT
                    ST_AsMVTGeom(
                        t.geom_3857,
                        b.tile_bounds,
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
                    f.flag,
                    tc.conduit_names
                FROM bounds b
                CROSS JOIN public.trench t
                LEFT JOIN public.flags f ON t.flag = f.id
                LEFT JOIN public.attributes_surface s ON t.surface = s.id
                LEFT JOIN public.attributes_construction_type ct ON t.construction_type = ct.id
                LEFT JOIN public.attributes_phase ph ON t.phase = ph.id
                LEFT JOIN public.attributes_status st ON t.status = st.id
                LEFT JOIN public.attributes_company c1 ON t.constructor = c1.id
                LEFT JOIN public.attributes_company c2 ON t.owner = c2.id
                LEFT JOIN trench_conduits tc ON t.uuid = tc.uuid_trench
                WHERE
                    t.geom_3857 && b.tile_bounds_margin
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
        if active is not None:
            # Convert string 'true'/'false' to boolean
            active_bool = active.lower() in ("true", "1", "yes")
            queryset = queryset.filter(active=active_bool)
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

    @action(detail=True, methods=["get"], url_path="trenches")
    def get_trenches(self, request, pk=None):
        """
        Returns all trench UUIDs that contain this conduit.
        """
        conduit = self.get_object()
        trench_uuids = TrenchConduitConnection.objects.filter(
            uuid_conduit=conduit
        ).values_list("uuid_trench__uuid", flat=True)

        return Response({"trench_uuids": list(trench_uuids)})

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
            tokens = search_term.strip().split()
            for token in tokens:
                queryset = queryset.filter(
                    Q(street__icontains=token)
                    | Q(housenumber__icontains=token)
                    | Q(house_number_suffix__icontains=token)
                    | Q(zip_code__icontains=token)
                    | Q(city__icontains=token)
                    | Q(district__icontains=token)
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
            WITH
            bounds AS (
                SELECT
                    ST_TileEnvelope(%(z)s, %(x)s, %(y)s) AS tile_bounds,
                    ST_TileEnvelope(%(z)s, %(x)s, %(y)s, margin => (64.0 / 4096)) AS tile_bounds_margin
            ),
            mvtgeom AS (
                SELECT
                    ST_AsMVTGeom(
                        a.geom_3857,
                        b.tile_bounds,
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
                FROM bounds b
                CROSS JOIN public.address a
                LEFT JOIN public.attributes_status_development sd ON a.status_development = sd.id
                LEFT JOIN public.flags f ON a.flag = f.id
                WHERE
                    a.geom_3857 && b.tile_bounds_margin
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

    @action(detail=False, methods=["get"])
    def expiring_warranties(self, request):
        """
        Returns the next 5 nodes with warranties expiring soonest.
        Filters out nodes with no warranty or expired warranties.
        """
        from datetime import date

        project_id = request.query_params.get("project")
        flag = request.query_params.get("flag")

        queryset = Node.objects.filter(
            warranty__isnull=False, warranty__gte=date.today()
        )

        if project_id:
            try:
                project_id = int(project_id)
                queryset = queryset.filter(project=project_id)
            except ValueError:
                queryset = queryset.none()
        if flag:
            try:
                flag = int(flag)
                queryset = queryset.filter(flag=flag)
            except ValueError:
                queryset = queryset.none()

        queryset = queryset.order_by("warranty")[:5]

        result = []
        for node in queryset:
            days_until_expiry = (node.warranty - date.today()).days
            result.append(
                {
                    "id": node.uuid,
                    "name": node.name,
                    "warranty": node.warranty.strftime("%Y-%m-%d"),
                    "node_type": node.node_type.node_type if node.node_type else None,
                    "days_until_expiry": days_until_expiry,
                }
            )

        return Response({"results": result, "count": len(result)})

    @action(detail=False, methods=["get"], url_path="all")
    def all_nodes(self, request):
        """
        Returns all nodes with project and flag filters.
        No pagination is used.

        Query Parameters:
        - `project`: Filter by project ID
        - `flag`: Filter by flag ID
        - `group`: Filter by node type group
        - `exclude_group`: Exclude nodes by node type group
        - `search`: Search term for name/type
        - `use_pipe_branch_settings`: If 'true', apply project's pipe-branch allowed types

        If project settings are configured, excluded node types are automatically
        filtered out unless an explicit exclude_group parameter is provided.
        """
        queryset = Node.objects.all().order_by("name")
        project_id = request.query_params.get("project")
        flag_id = request.query_params.get("flag")
        group = request.query_params.get("group")
        search_term = request.query_params.get("search")
        exclude_group = request.query_params.get("exclude_group")
        use_pipe_branch_settings = request.query_params.get("use_pipe_branch_settings")
        settings_configured = False
        pipe_branch_configured = False

        if project_id:
            queryset = queryset.filter(project=project_id)

            # Apply pipe-branch settings if requested
            if use_pipe_branch_settings == "true":
                allowed_type_ids = PipeBranchSettings.get_allowed_type_ids(project_id)
                if allowed_type_ids is not None:
                    pipe_branch_configured = True
                    if allowed_type_ids:  # If list is not empty
                        queryset = queryset.filter(node_type_id__in=allowed_type_ids)
                    else:
                        # Empty list means no types allowed, return empty
                        queryset = queryset.none()
            # Apply project-specific exclusions if no explicit exclude_group provided
            # and not using pipe_branch_settings
            elif exclude_group is None:
                settings = NetworkSchemaSettings.get_settings_for_project(project_id)
                if settings is not None:
                    settings_configured = True
                    excluded_type_ids = list(
                        settings.excluded_node_types.values_list("id", flat=True)
                    )
                    if excluded_type_ids:
                        queryset = queryset.exclude(node_type_id__in=excluded_type_ids)

        if flag_id:
            queryset = queryset.filter(flag=flag_id)
        if group:
            queryset = queryset.filter(node_type__group=group)
        if exclude_group:
            # Explicit exclude_group overrides project settings
            queryset = queryset.exclude(node_type__group=exclude_group)
        if search_term:
            queryset = queryset.filter(
                Q(name__icontains=search_term)
                | Q(node_type__node_type__icontains=search_term)
            )
        serializer = NodeSerializer(queryset, many=True)
        data = serializer.data

        # Add metadata about settings configuration to the GeoJSON response
        if isinstance(data, dict) and data.get("type") == "FeatureCollection":
            data["metadata"] = {
                "settings_configured": settings_configured,
                "pipe_branch_configured": pipe_branch_configured,
            }
        elif isinstance(data, list):
            # Wrap in FeatureCollection format with metadata
            data = {
                "type": "FeatureCollection",
                "features": data,
                "metadata": {
                    "settings_configured": settings_configured,
                    "pipe_branch_configured": pipe_branch_configured,
                },
            }

        return Response(data)


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
            WITH
            bounds AS (
                SELECT
                    ST_TileEnvelope(%(z)s, %(x)s, %(y)s) AS tile_bounds,
                    ST_TileEnvelope(%(z)s, %(x)s, %(y)s, margin => (64.0 / 4096)) AS tile_bounds_margin
            ),
            mvtgeom AS (
                SELECT
                    ST_AsMVTGeom(
                        n.geom_3857,
                        b.tile_bounds,
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
                    COALESCE(a.street || ' ' || a.housenumber, a.house_number_suffix,
                        a.street || '' || a.housenumber) AS address
                FROM bounds b
                CROSS JOIN public.node n
                LEFT JOIN public.address a ON n.uuid_address = a.uuid
                LEFT JOIN public.attributes_company c1 ON n.owner = c1.id
                LEFT JOIN public.attributes_company c2 ON n.constructor = c2.id
                LEFT JOIN public.attributes_company c3 ON n.manufacturer = c3.id
                LEFT JOIN public.attributes_network_level nl ON n.network_level = nl.id
                LEFT JOIN public.attributes_node_type nt ON n.node_type = nt.id
                LEFT JOIN public.attributes_status s ON n.status = s.id
                LEFT JOIN public.flags f ON n.flag = f.id
                WHERE
                    n.geom_3857 && b.tile_bounds_margin
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

    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

    def post(self, request, *args, **kwargs):
        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response(
                {"error": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST
            )

        if not file_obj.name.endswith(".xlsx"):
            return Response(
                {"error": "Invalid file format. Please upload an .xlsx file."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if file_obj.size > self.MAX_FILE_SIZE:
            return Response(
                {
                    "error": f"File too large. Maximum size is {self.MAX_FILE_SIZE // (1024 * 1024)}MB."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = import_conduits_from_excel(file_obj)

        if result["success"]:
            response_data = {
                "message": f"Successfully imported {result['created_count']} conduits.",
                "created_count": result["created_count"],
            }
            if result.get("warnings"):
                response_data["warnings"] = result["warnings"]
            return Response(response_data, status=status.HTTP_201_CREATED)
        else:
            response_data = {"errors": result["errors"]}
            if result.get("warnings"):
                response_data["warnings"] = result["warnings"]
            return Response(response_data, status=status.HTTP_400_BAD_REQUEST)


class GeoPackageSchemaView(APIView):
    """
    API endpoint to download GeoPackage schema.

    GET /api/v1/schema.gpkg - Download GeoPackage with all tables
    GET /api/v1/schema.gpkg?layers=trench,node,address - Download with specific layers

    Query parameters:
        layers: Comma-separated list of layer names to include (optional)
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        layers_param = request.query_params.get("layers")
        layers = None
        if layers_param:
            layers = [
                layer.strip() for layer in layers_param.split(",") if layer.strip()
            ]

        try:
            return generate_geopackage_schema(layers=layers)
        except ValueError as e:
            return Response(
                {
                    "error": str(e),
                    "available_layers": list(GEOPACKAGE_LAYER_CONFIG.keys()),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.error(f"Failed to generate GeoPackage: {e}")
            return Response(
                {"error": "Failed to generate GeoPackage schema."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
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


class LogEntryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing application logs.

    Only accessible to staff users (is_staff=True).
    Provides filtering by date range, log level, user, source, project, and search.

    Query parameters:
    - level: Filter by log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    - source: Filter by source (backend, frontend)
    - user: Filter by user ID
    - project: Filter by project ID
    - search: Search in message and logger_name
    - date_from: Filter logs from this date (ISO format)
    - date_to: Filter logs until this date (ISO format)
    """

    permission_classes = [IsAuthenticated]
    queryset = (
        LogEntry.objects.all().select_related("user", "project").order_by("-timestamp")
    )
    serializer_class = LogEntrySerializer
    pagination_class = CustomPagination
    lookup_field = "uuid"
    lookup_url_kwarg = "pk"

    def get_queryset(self):
        """Filter queryset based on query parameters."""
        queryset = super().get_queryset()

        # Only allow staff users to view logs
        if not self.request.user.is_staff:
            return LogEntry.objects.none()

        # Filter by log level
        level = self.request.query_params.get("level")
        if level:
            queryset = queryset.filter(level=level.upper())

        # Filter by source
        source = self.request.query_params.get("source")
        if source:
            queryset = queryset.filter(source=source)

        # Filter by user
        user_id = self.request.query_params.get("user")
        if user_id:
            queryset = queryset.filter(user_id=user_id)

        # Filter by project
        project_id = self.request.query_params.get("project")
        if project_id:
            queryset = queryset.filter(project_id=project_id)

        # Search in message and logger_name
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(message__icontains=search) | Q(logger_name__icontains=search)
            )

        # Filter by date range
        date_from = self.request.query_params.get("date_from")
        if date_from:
            queryset = queryset.filter(timestamp__gte=date_from)

        date_to = self.request.query_params.get("date_to")
        if date_to:
            queryset = queryset.filter(timestamp__lte=date_to)

        return queryset


class FrontendLogView(APIView):
    """
    API endpoint for submitting frontend logs.

    POST /api/v1/logs/frontend/

    Request body:
    {
        "level": "ERROR",
        "message": "Error message",
        "path": "/some/path",
        "extra_data": {...},
        "project": "1"
    }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        """Submit a frontend log entry."""
        try:
            level = request.data.get("level", "INFO").upper()
            message = request.data.get("message", "")
            path = request.data.get("path", "")
            extra_data = request.data.get("extra_data", {})
            project_id = request.data.get("project", None)

            # Validate level
            valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
            if level not in valid_levels:
                level = "INFO"

            project_instance = None
            if project_id is not None:
                try:
                    if isinstance(project_id, list):
                        project_id = project_id[0]
                    project_id = int(project_id)
                    project_instance = Projects.objects.get(id=project_id)
                except (ValueError, Projects.DoesNotExist, TypeError):
                    project_instance = None

            # Create log entry
            LogEntry.objects.create(
                level=level,
                logger_name="frontend",
                message=message[:10000],  # Limit message length
                user=request.user,
                source="frontend",
                path=path[:500] if path else None,
                extra_data=extra_data,
                project=project_instance,
            )

            return Response({"status": "success"}, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Error creating frontend log entry: {e}")
            return Response(
                {"error": "Failed to create log entry"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class LayerExtentView(APIView):
    """
    API view to get the bounding box extent for a layer type.

    Returns the extent in EPSG:3857 (Web Mercator) for direct use by OpenLayers.
    Uses PostGIS ST_Extent for efficient bounding box calculation.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, format=None):
        """
        Returns the bounding box extent for a layer filtered by project.

        Query Parameters:
        - `layer`: Layer type ('trench', 'address', 'node', or 'area') - required
        - `project`: Project ID to filter by - required

        Returns:
        - extent: [xmin, ymin, xmax, ymax] in EPSG:3857, or null if no features
        - layer: The requested layer type
        """
        layer = request.query_params.get("layer")
        project = request.query_params.get("project")

        if not layer or not project:
            return Response(
                {"error": "Both 'layer' and 'project' parameters are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        layer_tables = {
            "trench": "ol_trench",
            "address": "ol_address",
            "node": "ol_node",
            "area": "ol_area",
        }

        if layer not in layer_tables:
            return Response(
                {
                    "error": f"Invalid layer. Must be one of: {', '.join(layer_tables.keys())}"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            project_id = int(project)
        except ValueError:
            return Response(
                {"error": "Project must be a numeric value"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sql = f"""
            SELECT
                ST_XMin(extent), ST_YMin(extent),
                ST_XMax(extent), ST_YMax(extent)
            FROM (
                SELECT ST_Extent(ST_Transform(geom, 3857)) as extent
                FROM {layer_tables[layer]}
                WHERE project = %(project)s
            ) as bounds
        """

        try:
            with connection.cursor() as cursor:
                cursor.execute(sql, {"project": project_id})
                row = cursor.fetchone()

            if row and row[0] is not None:
                return Response(
                    {
                        "extent": [row[0], row[1], row[2], row[3]],
                        "layer": layer,
                    }
                )
            return Response(
                {
                    "extent": None,
                    "layer": layer,
                }
            )

        except Exception as e:
            logger.error(f"Error fetching layer extent: {e}")
            return Response(
                {"error": "Failed to calculate layer extent"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class AreaViewSet(viewsets.ModelViewSet):
    """ViewSet for the Area model :model:`api.Area`.

    An instance of :model:`api.Area`.
    """

    permission_classes = [IsAuthenticated]
    queryset = Area.objects.all().order_by("name")
    serializer_class = AreaSerializer
    lookup_field = "uuid"
    lookup_url_kwarg = "pk"
    pagination_class = CustomPagination

    def get_queryset(self):
        """
        Optionally restricts the returned areas by filtering against query parameters:
        - `uuid`: Filter by UUID
        - `project`: Filter by project ID
        - `flag`: Filter by flag ID
        - `name`: Filter by name (case-insensitive partial match)
        """
        queryset = Area.objects.all().order_by("name")
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
    def all_areas(self, request):
        """
        Returns all areas with project and flag filters.
        No pagination is used.
        """
        queryset = Area.objects.all().order_by("name")
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
                | Q(area_type__area_type__icontains=search_term)
            )
        serializer = AreaSerializer(queryset, many=True)
        return Response(serializer.data)


class OlAreaViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the OlArea model :model:`api.OlArea`.

    An instance of :model:`api.OlArea`.
    """

    permission_classes = [IsAuthenticated]
    queryset = OlArea.objects.all().order_by("area_type", "uuid")
    serializer_class = OlAreaSerializer
    lookup_field = "uuid"
    lookup_url_kwarg = "pk"
    pagination_class = CustomPagination

    def get_queryset(self):
        """
        Optionally restricts the returned areas by filtering against query parameters:
        - `uuid`: Filter by UUID
        - `project`: Filter by project ID
        - `flag`: Filter by flag ID
        """
        queryset = OlArea.objects.all().order_by("area_type", "uuid")
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
    def all_ol_areas(self, request):
        """
        Returns all ol_areas with project and flag filters.
        No pagination is used.
        """
        queryset = OlArea.objects.all().order_by("area_type", "uuid")
        project_id = request.query_params.get("project")
        flag_id = request.query_params.get("flag")
        if project_id:
            queryset = queryset.filter(project=project_id)
        if flag_id:
            queryset = queryset.filter(flag=flag_id)
        serializer = OlAreaSerializer(queryset, many=True)
        return Response(serializer.data)


class OlAreaTileViewSet(APIView):
    """ViewSet for the OlArea model :model:`api.OlArea`.

    An instance of :model:`api.OlArea`.
    """

    permission_classes = [AllowAny]

    def get(self, request, z, x, y, format=None):
        """
        Serves MVT tiles for OlArea.
        URL: /api/ol_area_tiles/{z}/{x}/{y}.mvt?project={project}
        """
        sql = """
            WITH
            bounds AS (
                SELECT
                    ST_TileEnvelope(%(z)s, %(x)s, %(y)s) AS tile_bounds,
                    ST_TileEnvelope(%(z)s, %(x)s, %(y)s, margin => (64.0 / 4096)) AS tile_bounds_margin
            ),
            mvtgeom AS (
                SELECT
                    ST_AsMVTGeom(
                        a.geom_3857,
                        b.tile_bounds,
                        extent => 4096,
                        buffer => 64
                    ) AS geom,
                    a.uuid,
                    a.name,
                    at.area_type,
                    f.flag
                FROM bounds b
                CROSS JOIN public.area a
                LEFT JOIN public.attributes_area_type at ON a.area_type = at.id
                LEFT JOIN public.flags f ON a.flag = f.id
                WHERE
                    a.geom_3857 && b.tile_bounds_margin
                    AND a.project = %(project)s
            )
            SELECT ST_AsMVT(mvtgeom, 'ol_area', 4096, 'geom') AS mvt
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


class NodeTrenchSelectionViewSet(viewsets.ModelViewSet):
    """ViewSet for managing node-trench selections for the pipe-branch canvas.

    This tracks which trenches a user has selected to display on the pipe-branch
    canvas for a given node. Selections are persisted so they auto-load when
    the user returns to the same node.
    """

    permission_classes = [IsAuthenticated]
    queryset = NodeTrenchSelection.objects.all()
    serializer_class = NodeTrenchSelectionSerializer
    lookup_field = "uuid"

    def get_queryset(self):
        """Filter selections by node if specified."""
        queryset = super().get_queryset()
        node_uuid = self.request.query_params.get("node")
        if node_uuid:
            queryset = queryset.filter(node__uuid=node_uuid)
        return queryset.select_related("node", "trench")

    @action(detail=False, methods=["get"], url_path="by-node/(?P<node_uuid>[^/.]+)")
    def by_node(self, request, node_uuid=None):
        """Get all trench selections for a specific node."""
        selections = NodeTrenchSelection.objects.filter(
            node__uuid=node_uuid
        ).select_related("trench")
        serializer = self.get_serializer(selections, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="bulk-update")
    def bulk_update(self, request):
        """Bulk update trench selections for a node.

        This replaces all existing selections for the node with the provided list.
        Expects: { "node_uuid": "...", "trench_uuids": ["...", "..."] }
        """
        serializer = NodeTrenchSelectionBulkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        node_uuid = serializer.validated_data["node_uuid"]
        trench_uuids = serializer.validated_data["trench_uuids"]

        try:
            node = Node.objects.get(uuid=node_uuid)
        except Node.DoesNotExist:
            return Response(
                {"error": f"Node with uuid {node_uuid} not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        NodeTrenchSelection.objects.filter(node=node).delete()

        new_selections = []
        for trench_uuid in trench_uuids:
            try:
                trench = Trench.objects.get(uuid=trench_uuid)
                new_selections.append(NodeTrenchSelection(node=node, trench=trench))
            except Trench.DoesNotExist:
                continue

        if new_selections:
            NodeTrenchSelection.objects.bulk_create(new_selections)

        updated_selections = NodeTrenchSelection.objects.filter(
            node=node
        ).select_related("trench")
        result_serializer = NodeTrenchSelectionSerializer(updated_selections, many=True)
        return Response(result_serializer.data, status=status.HTTP_200_OK)
