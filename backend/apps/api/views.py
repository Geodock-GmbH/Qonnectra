import logging
import mimetypes
import os
import uuid
from collections import defaultdict
from datetime import date
from urllib.parse import quote

import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.db import connection, transaction
from django.db.models import Avg, Count, F, Q, Sum
from django.db.models.functions import TruncMonth
from django.http import FileResponse, HttpResponse, StreamingHttpResponse
from django.utils import timezone
from django.utils.encoding import iri_to_uri
from pathvalidate import sanitize_filename
from rest_framework import status, viewsets
from rest_framework.authentication import BaseAuthentication
from rest_framework.decorators import action, api_view, permission_classes
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
    AttributesComponentStructure,
    AttributesComponentType,
    AttributesConduitType,
    AttributesConstructionType,
    AttributesFiberColor,
    AttributesMicroductColor,
    AttributesMicroductStatus,
    AttributesNetworkLevel,
    AttributesNodeType,
    AttributesResidentialUnitStatus,
    AttributesResidentialUnitType,
    AttributesStatus,
    AttributesStatusDevelopment,
    AttributesSurface,
    Cable,
    CableLabel,
    CableTypeColorMapping,
    CanvasSyncStatus,
    Conduit,
    Container,
    ContainerType,
    FeatureFiles,
    Fiber,
    FiberSplice,
    Flags,
    LogEntry,
    Microduct,
    MicroductCableConnection,
    MicroductConnection,
    NetworkSchemaSettings,
    Node,
    NodeSlotClipNumber,
    NodeSlotConfiguration,
    NodeSlotDivider,
    NodeStructure,
    NodeTrenchSelection,
    PipeBranchSettings,
    Projects,
    ResidentialUnit,
    Trench,
    TrenchConduitConnection,
    WMSLayer,
    WMSSource,
)
from .pageination import CustomPagination
from .routing import find_shortest_path
from .serializers import (
    AddressListSerializer,
    AddressSerializer,
    AreaSerializer,
    AttributesAreaTypeSerializer,
    AttributesCableTypeSerializer,
    AttributesCompanySerializer,
    AttributesComponentStructureSerializer,
    AttributesComponentTypeSerializer,
    AttributesConduitTypeSerializer,
    AttributesConstructionTypeSerializer,
    AttributesFiberColorSerializer,
    AttributesMicroductColorSerializer,
    AttributesMicroductStatusSerializer,
    AttributesNetworkLevelSerializer,
    AttributesNodeTypeSerializer,
    AttributesResidentialUnitStatusSerializer,
    AttributesResidentialUnitTypeSerializer,
    AttributesStatusDevelopmentSerializer,
    AttributesStatusSerializer,
    AttributesSurfaceSerializer,
    CableAtNodeSerializer,
    CableLabelSerializer,
    CableSerializer,
    CableTypeColorMappingSerializer,
    ConduitForTrenchSelectionSerializer,
    ConduitListSerializer,
    ConduitSerializer,
    ContainerSerializer,
    ContainerTreeSerializer,
    ContainerTypeSerializer,
    ContentTypeSerializer,
    FeatureFilesSerializer,
    FiberSerializer,
    FiberSpliceSerializer,
    FlagsSerializer,
    LogEntrySerializer,
    MicroductCableConnectionSerializer,
    MicroductConnectionSerializer,
    MicroductSerializer,
    NodeSerializer,
    NodeSlotClipNumberSerializer,
    NodeSlotConfigurationListSerializer,
    NodeSlotConfigurationSerializer,
    NodeSlotDividerSerializer,
    NodeStructureSerializer,
    NodeTrenchSelectionBulkSerializer,
    NodeTrenchSelectionSerializer,
    ProjectsSerializer,
    ResidentialUnitSerializer,
    TrenchConduitSerializer,
    TrenchSerializer,
    WMSLayerSerializer,
    WMSSourceCreateSerializer,
    WMSSourceSerializer,
)
from .services import (
    GEOPACKAGE_LAYER_CONFIG,
    generate_conduit_import_template,
    generate_geopackage_schema,
    import_conduits_from_excel,
)
from .wms_service import WMSServiceError, fetch_wms_layers, scan_wms_capabilities

logger = logging.getLogger(__name__)

User = get_user_model()


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


class AttributesComponentTypeViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = AttributesComponentType.objects.all().order_by("component_type")
    serializer_class = AttributesComponentTypeSerializer
    lookup_field = "id"
    lookup_url_kwarg = "pk"


class AttributesStatusDevelopmentViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the AttributesStatusDevelopment model :model:`api.AttributesStatusDevelopment`.

    An instance of :model:`api.AttributesStatusDevelopment`.
    """

    permission_classes = [IsAuthenticated]
    queryset = AttributesStatusDevelopment.objects.all().order_by("status")
    serializer_class = AttributesStatusDevelopmentSerializer
    lookup_field = "id"
    lookup_url_kwarg = "pk"


class AttributesResidentialUnitTypeViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the AttributesResidentialUnitType model."""

    permission_classes = [IsAuthenticated]
    queryset = AttributesResidentialUnitType.objects.all().order_by(
        "residential_unit_type"
    )
    serializer_class = AttributesResidentialUnitTypeSerializer
    lookup_field = "id"
    lookup_url_kwarg = "pk"


class AttributesResidentialUnitStatusViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the AttributesResidentialUnitStatus model."""

    permission_classes = [IsAuthenticated]
    queryset = AttributesResidentialUnitStatus.objects.all().order_by("status")
    serializer_class = AttributesResidentialUnitStatusSerializer
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
        queryset = Trench.objects.select_related(
            "surface",
            "construction_type",
            "status",
            "phase",
            "owner",
            "constructor",
            "project",
            "flag",
        ).order_by("id_trench")
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


class OlTrenchTileViewSet(APIView):
    """ViewSet for the OlTrench model :model:`api.OlTrench`.

    An instance of :model:`api.OlTrench`.
    """

    permission_classes = [IsAuthenticated]

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
                    t.project,
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
                    AND (%(project)s IS NULL OR t.project = %(project)s)
            )
            SELECT ST_AsMVT(mvtgeom, 'ol_trench', 4096, 'geom') AS mvt
            FROM mvtgeom;
        """
        project_id = request.query_params.get("project")
        if project_id is not None:
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
        Returns conduits with server-side pagination.

        Query params:
        - project: Filter by project ID (optional)
        - flag: Filter by flag ID
        - search: Search term
        - page: Page number (default: 1)
        - page_size: Items per page (default: 50, max: 200)
        """
        queryset = Conduit.objects.select_related(
            "conduit_type",
            "status",
            "network_level",
            "owner",
            "constructor",
            "manufacturer",
            "flag",
        ).order_by("name")

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

        total_count = queryset.count()

        try:
            page = int(request.query_params.get("page", 1))
            page_size = min(int(request.query_params.get("page_size", 50)), 200)
        except ValueError:
            page = 1
            page_size = 50

        start = (page - 1) * page_size
        end = start + page_size
        queryset = queryset[start:end]

        serializer = ConduitListSerializer(queryset, many=True)

        return Response(
            {
                "results": serializer.data,
                "count": total_count,
                "page": page,
                "page_size": page_size,
                "total_pages": (total_count + page_size - 1) // page_size,
            }
        )

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
        queryset = Address.objects.select_related(
            "status_development",
            "flag",
            "project",
        ).order_by("street", "housenumber", "house_number_suffix")

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
        Returns addresses with server-side pagination.

        Query params:
        - project: Filter by project ID (optional)
        - flag: Filter by flag ID
        - search: Search term (searches street, housenumber, etc.)
        - page: Page number (default: 1)
        - page_size: Items per page (default: 50, max: 200)
        """
        queryset = Address.objects.select_related(
            "status_development",
            "flag",
        ).order_by("street", "housenumber", "house_number_suffix")

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

        total_count = queryset.count()

        try:
            page = int(request.query_params.get("page", 1))
            page_size = min(int(request.query_params.get("page_size", 50)), 200)
        except ValueError:
            page = 1
            page_size = 50

        start = (page - 1) * page_size
        end = start + page_size
        queryset = queryset[start:end]

        serializer = AddressListSerializer(queryset, many=True)

        return Response(
            {
                "results": serializer.data,
                "count": total_count,
                "page": page,
                "page_size": page_size,
                "total_pages": (total_count + page_size - 1) // page_size,
            }
        )

    @action(detail=True, methods=["post"], url_path="regenerate-id")
    def regenerate_id(self, request, pk=None):
        """Regenerate the Base32 address ID for this address."""
        address = self.get_object()
        with connection.cursor() as cursor:
            cursor.execute("SELECT fn_generate_address_id(%s)", [address.project_id])
            new_id = cursor.fetchone()[0]
        address.id_address = new_id
        address.save(update_fields=["id_address"])
        serializer = self.get_serializer(address)
        return Response(serializer.data)


class ResidentialUnitViewSet(viewsets.ModelViewSet):
    """ViewSet for the ResidentialUnit model."""

    permission_classes = [IsAuthenticated]
    queryset = ResidentialUnit.objects.all().order_by("uuid_address", "floor", "side")
    serializer_class = ResidentialUnitSerializer
    lookup_field = "uuid"
    lookup_url_kwarg = "pk"

    def get_queryset(self):
        """
        Optionally restricts the returned residential units by filtering against query parameters:
        - `uuid_address`: Filter by address UUID
        """
        queryset = ResidentialUnit.objects.select_related(
            "uuid_address",
            "residential_unit_type",
            "status",
        ).order_by("uuid_address", "id_residential_unit", "floor", "side")

        uuid_address = self.request.query_params.get("uuid_address")
        if uuid_address:
            queryset = queryset.filter(uuid_address=uuid_address)

        return queryset

    @action(detail=False, methods=["get"], url_path="all")
    def all_units(self, request):
        """Returns all residential units for an address. No pagination."""
        queryset = ResidentialUnit.objects.select_related(
            "uuid_address",
            "residential_unit_type",
            "status",
        ).order_by("uuid_address", "floor", "side")
        uuid_address = request.query_params.get("uuid_address")
        if uuid_address:
            queryset = queryset.filter(uuid_address__uuid=uuid_address)
        serializer = ResidentialUnitSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="regenerate-id")
    def regenerate_id(self, request, pk=None):
        """Regenerate the Base28 residential unit ID for this unit."""
        unit = self.get_object()
        project_id = unit.uuid_address.project_id
        with connection.cursor() as cursor:
            cursor.execute("SELECT fn_generate_residential_unit_id(%s)", [project_id])
            new_id = cursor.fetchone()[0]
        unit.id_residential_unit = new_id
        unit.save(update_fields=["id_residential_unit"])
        serializer = self.get_serializer(unit)
        return Response(serializer.data)


class OlAddressTileViewSet(APIView):
    """ViewSet for the OlAddress model :model:`api.OlAddress`.

    An instance of :model:`api.OlAddress`.
    """

    permission_classes = [IsAuthenticated]

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
                    a.project,
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
                    AND (%(project)s IS NULL OR a.project = %(project)s)
            )
            SELECT ST_AsMVT(mvtgeom, 'ol_address', 4096, 'geom') AS mvt
            FROM mvtgeom;
        """
        project_id = request.query_params.get("project")
        if project_id is not None:
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
        - `parent_node`: Filter by parent node UUID
        - `uuid_address`: Filter by address UUID
        - `has_parent`: Filter nodes that have / do not have a parent
        - `has_address`: Filter nodes that have / do not have an address
        """
        queryset = Node.objects.select_related(
            "node_type",
            "uuid_address",
            "parent_node",
            "status",
            "network_level",
            "owner",
            "constructor",
            "manufacturer",
            "project",
            "flag",
        ).order_by("name")
        uuid = self.request.query_params.get("uuid")
        project_id = self.request.query_params.get("project")
        flag_id = self.request.query_params.get("flag")
        name = self.request.query_params.get("name")
        node_type = self.request.query_params.get("node_type")
        parent_uuid = self.request.query_params.get("parent_node")
        uuid_address = self.request.query_params.get("uuid_address")
        has_parent = self.request.query_params.get("has_parent")
        has_address = self.request.query_params.get("has_address")
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
        if parent_uuid:
            queryset = queryset.filter(parent_node__uuid=parent_uuid)
        if uuid_address:
            queryset = queryset.filter(uuid_address__uuid=uuid_address)
        if has_parent is not None:
            value = has_parent.lower()
            if value in ["1", "true", "yes"]:
                queryset = queryset.filter(parent_node__isnull=False)
            elif value in ["0", "false", "no"]:
                queryset = queryset.filter(parent_node__isnull=True)
        if has_address is not None:
            value = has_address.lower()
            if value in ["1", "true", "yes"]:
                queryset = queryset.filter(uuid_address__isnull=False)
            elif value in ["0", "false", "no"]:
                queryset = queryset.filter(uuid_address__isnull=True)
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
        ).select_related("node_type")

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

    @action(detail=False, methods=["get"])
    def count_by_city(self, request):
        """
        Returns the count of nodes grouped by city (from linked address).
        """
        project_id = request.query_params.get("project")
        flag = request.query_params.get("flag")

        queryset = Node.objects.filter(uuid_address__isnull=False)
        if project_id:
            queryset = queryset.filter(project=project_id)
        if flag:
            queryset = queryset.filter(flag=flag)

        queryset = (
            queryset.values("uuid_address__city")
            .annotate(count=Count("uuid"))
            .order_by("-count")
        )

        result = [
            {"city": row["uuid_address__city"], "count": row["count"]}
            for row in queryset
            if row["uuid_address__city"]
        ]

        return Response({"results": result, "count": len(result)})

    @action(detail=False, methods=["get"])
    def count_by_status(self, request):
        """
        Returns the count of nodes grouped by status.
        """
        project_id = request.query_params.get("project")
        flag = request.query_params.get("flag")

        queryset = Node.objects.all()
        if project_id:
            queryset = queryset.filter(project=project_id)
        if flag:
            queryset = queryset.filter(flag=flag)

        queryset = (
            queryset.values("status__status")
            .annotate(count=Count("uuid"))
            .order_by("-count")
        )

        result = [
            {"status": row["status__status"], "count": row["count"]}
            for row in queryset
            if row["status__status"]
        ]

        return Response({"results": result, "count": len(result)})

    @action(detail=False, methods=["get"])
    def count_by_network_level(self, request):
        """
        Returns the count of nodes grouped by network level.
        """
        project_id = request.query_params.get("project")
        flag = request.query_params.get("flag")

        queryset = Node.objects.all()
        if project_id:
            queryset = queryset.filter(project=project_id)
        if flag:
            queryset = queryset.filter(flag=flag)

        queryset = (
            queryset.values("network_level__network_level")
            .annotate(count=Count("uuid"))
            .order_by("-count")
        )

        result = [
            {"network_level": row["network_level__network_level"], "count": row["count"]}
            for row in queryset
            if row["network_level__network_level"]
        ]

        return Response({"results": result, "count": len(result)})

    @action(detail=False, methods=["get"])
    def count_by_owner(self, request):
        """
        Returns the count of nodes grouped by owner company.
        """
        project_id = request.query_params.get("project")
        flag = request.query_params.get("flag")

        queryset = Node.objects.filter(owner__isnull=False)
        if project_id:
            queryset = queryset.filter(project=project_id)
        if flag:
            queryset = queryset.filter(flag=flag)

        queryset = (
            queryset.values("owner__company")
            .annotate(count=Count("uuid"))
            .order_by("-count")
        )

        result = [
            {"owner": row["owner__company"], "count": row["count"]}
            for row in queryset
            if row["owner__company"]
        ]

        return Response({"results": result, "count": len(result)})

    @action(detail=False, methods=["get"])
    def newest_oldest_nodes(self, request):
        """
        Returns the 5 newest and 5 oldest nodes by date field.
        """
        project_id = request.query_params.get("project")
        flag = request.query_params.get("flag")

        queryset = Node.objects.filter(date__isnull=False).select_related("node_type")
        if project_id:
            queryset = queryset.filter(project=project_id)
        if flag:
            queryset = queryset.filter(flag=flag)

        newest = list(queryset.order_by("-date")[:5])
        oldest = list(queryset.order_by("date")[:5])

        def node_to_dict(node):
            return {
                "id": node.uuid,
                "name": node.name,
                "date": node.date.strftime("%Y-%m-%d") if node.date else None,
                "node_type": node.node_type.node_type if node.node_type else None,
            }

        return Response(
            {
                "newest": [node_to_dict(n) for n in newest],
                "oldest": [node_to_dict(n) for n in oldest],
            }
        )

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
        - `include_excluded`: If 'true', bypass NetworkSchemaSettings exclusions (for search)

        If project settings are configured, excluded node types are automatically
        filtered out unless an explicit exclude_group or include_excluded parameter is provided.
        """
        queryset = Node.objects.select_related(
            "node_type",
            "uuid_address",
            "status",
            "network_level",
            "owner",
            "constructor",
            "manufacturer",
            "project",
            "flag",
        ).order_by("name")
        project_id = request.query_params.get("project")
        flag_id = request.query_params.get("flag")
        group = request.query_params.get("group")
        search_term = request.query_params.get("search")
        exclude_group = request.query_params.get("exclude_group")
        use_pipe_branch_settings = request.query_params.get("use_pipe_branch_settings")
        child_view_for = request.query_params.get("child_view_for")
        include_excluded = request.query_params.get("include_excluded")
        settings_configured = False
        pipe_branch_configured = False
        excluded_type_ids = []
        child_view_enabled_type_ids = []

        if project_id:
            queryset = queryset.filter(project=project_id)

            # Handle child view mode: return parent node + its direct children
            if child_view_for:
                queryset = queryset.filter(
                    Q(uuid=child_view_for) | Q(parent_node_id=child_view_for)
                )
                # Get child view enabled types for this project
                settings = NetworkSchemaSettings.get_settings_for_project(project_id)
                if settings is not None:
                    child_view_enabled_type_ids = list(
                        settings.child_view_enabled_node_types.values_list(
                            "id", flat=True
                        )
                    )

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
            # and not using pipe_branch_settings, child_view_for, or include_excluded
            elif exclude_group is None and not child_view_for and include_excluded != "true":
                settings = NetworkSchemaSettings.get_settings_for_project(project_id)
                if settings is not None:
                    settings_configured = True
                    excluded_type_ids = list(
                        settings.excluded_node_types.values_list("id", flat=True)
                    )
                    child_view_enabled_type_ids = list(
                        settings.child_view_enabled_node_types.values_list(
                            "id", flat=True
                        )
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
                "excluded_node_type_ids": excluded_type_ids,
                "child_view_enabled_node_type_ids": child_view_enabled_type_ids,
            }
        elif isinstance(data, list):
            # Wrap in FeatureCollection format with metadata
            data = {
                "type": "FeatureCollection",
                "features": data,
                "metadata": {
                    "settings_configured": settings_configured,
                    "pipe_branch_configured": pipe_branch_configured,
                    "excluded_node_type_ids": excluded_type_ids,
                    "child_view_enabled_node_type_ids": child_view_enabled_type_ids,
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

        Only calculates positions for nodes missing canvas coordinates,
        preserving user-positioned nodes. The bounding box is calculated
        from ALL nodes.
        """
        try:
            # Get ALL nodes with geometry for bounding box calculation
            all_queryset = Node.objects.filter(geom__isnull=False)

            if project_id:
                all_queryset = all_queryset.filter(project=project_id)
            if flag_id:
                all_queryset = all_queryset.filter(flag=flag_id)

            all_nodes = list(all_queryset)

            if not all_nodes:
                sync_status.status = "COMPLETED"
                sync_status.completed_at = timezone.now()
                sync_status.save()
                return Response({"message": "No nodes found with geometry"}, status=400)

            # Extract coordinates from ALL nodes for bounding box
            all_coordinates = []
            for node in all_nodes:
                if node.geom:
                    coords = node.geom.coords
                    all_coordinates.append(
                        {"x": coords[0], "y": coords[1], "node": node}
                    )

            if not all_coordinates:
                sync_status.status = "COMPLETED"
                sync_status.completed_at = timezone.now()
                sync_status.save()
                return Response({"message": "No valid coordinates found"}, status=400)

            # Calculate bounding box from ALL nodes
            min_x = min(coord["x"] for coord in all_coordinates)
            max_x = max(coord["x"] for coord in all_coordinates)
            min_y = min(coord["y"] for coord in all_coordinates)
            max_y = max(coord["y"] for coord in all_coordinates)

            # Calculate center
            center_x = (min_x + max_x) / 2
            center_y = (min_y + max_y) / 2

            # Store calculated values in sync status
            sync_status.center_x = center_x
            sync_status.center_y = center_y
            sync_status.save()

            # Only update nodes MISSING canvas coordinates, preserving user-positioned nodes
            batch_size = 500
            nodes_to_update = []

            for coord_data in all_coordinates:
                node = coord_data["node"]

                # Skip nodes that already have canvas coordinates
                if node.canvas_x is not None and node.canvas_y is not None:
                    continue

                geo_x = coord_data["x"]
                geo_y = coord_data["y"]

                # Transform to canvas coordinates
                node.canvas_x = (geo_x - center_x) * scale
                node.canvas_y = -(geo_y - center_y) * scale  # Flip Y axis
                nodes_to_update.append(node)

            # Perform bulk update in batches
            updated_count = 0
            for i in range(0, len(nodes_to_update), batch_size):
                batch = nodes_to_update[i : i + batch_size]
                Node.objects.bulk_update(batch, ["canvas_x", "canvas_y"])
                updated_count += len(batch)

                # Update progress and heartbeat after each batch
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


class OlNodeTileViewSet(APIView):
    """ViewSet for the OlNode model :model:`api.OlNode`.

    An instance of :model:`api.OlNode`.
    """

    permission_classes = [IsAuthenticated]

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
                    n.project,
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
                        a.street || '' || a.housenumber) AS address,
                    parent_n.name AS parent_node_name
                FROM bounds b
                CROSS JOIN public.node n
                LEFT JOIN public.address a ON n.uuid_address = a.uuid
                LEFT JOIN public.node parent_n ON n.parent_node = parent_n.uuid
                LEFT JOIN public.attributes_company c1 ON n.owner = c1.id
                LEFT JOIN public.attributes_company c2 ON n.constructor = c2.id
                LEFT JOIN public.attributes_company c3 ON n.manufacturer = c3.id
                LEFT JOIN public.attributes_network_level nl ON n.network_level = nl.id
                LEFT JOIN public.attributes_node_type nt ON n.node_type = nt.id
                LEFT JOIN public.attributes_status s ON n.status = s.id
                LEFT JOIN public.flags f ON n.flag = f.id
                WHERE
                    n.geom_3857 && b.tile_bounds_margin
                    AND (%(project)s IS NULL OR n.project = %(project)s)
            )
            SELECT ST_AsMVT(mvtgeom, 'ol_node', 4096, 'geom') AS mvt
            FROM mvtgeom;
        """
        project_id = request.query_params.get("project")
        if project_id is not None:
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

        if not start_trench_id or not end_trench_id:
            return Response(
                {"error": "start_trench_id and end_trench_id are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = find_shortest_path(start_trench_id, end_trench_id, project_id, tolerance)

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
        - `uuid_node`: Filter by node UUID
        """
        queryset = Microduct.objects.all()
        uuid_conduit = self.request.query_params.get("uuid_conduit")
        number = self.request.query_params.get("number")
        color = self.request.query_params.get("color")
        uuid_node = self.request.query_params.get("uuid_node")

        if uuid_conduit:
            queryset = queryset.filter(uuid_conduit=uuid_conduit)
        if uuid_conduit and number:
            queryset = queryset.filter(uuid_conduit=uuid_conduit, number=number)
        if uuid_conduit and color:
            queryset = queryset.filter(uuid_conduit=uuid_conduit, color=color)
        if uuid_node:
            queryset = queryset.filter(uuid_node=uuid_node)
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
        uuid_node = request.query_params.get("uuid_node")
        if uuid_conduit:
            queryset = queryset.filter(uuid_conduit=uuid_conduit)
        if uuid_conduit and number:
            queryset = queryset.filter(uuid_conduit=uuid_conduit, number=number)
        if uuid_conduit and color:
            queryset = queryset.filter(uuid_conduit=uuid_conduit, color=color)
        if uuid_node:
            queryset = queryset.filter(uuid_node=uuid_node)
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

    def create(self, request, *args, **kwargs):
        """Override create to add a warning when cable type has incomplete color mappings."""
        response = super().create(request, *args, **kwargs)

        cable_type_id = request.data.get("cable_type_id")
        if cable_type_id:
            try:
                cable_type = AttributesCableType.objects.get(pk=cable_type_id)
                bundle_mapping_count = CableTypeColorMapping.objects.filter(
                    cable_type=cable_type, position_type="bundle"
                ).count()
                fiber_mapping_count = CableTypeColorMapping.objects.filter(
                    cable_type=cable_type, position_type="fiber"
                ).count()

                if (
                    bundle_mapping_count < cable_type.bundle_count
                    or fiber_mapping_count < cable_type.bundle_fiber_count
                ):
                    response.data["warning"] = (
                        f"Cable type '{cable_type.cable_type}' has incomplete color mappings: "
                        f"needs {cable_type.bundle_count} bundle mapping(s) but has {bundle_mapping_count}, "
                        f"needs {cable_type.bundle_fiber_count} fiber mapping(s) but has {fiber_mapping_count}. "
                        f"Fibers were not generated."
                    )
            except AttributesCableType.DoesNotExist:
                pass

        return response

    @action(detail=False, methods=["get"], url_path="all")
    def all_cables(self, request):
        """
        Returns all cables with project, flag, and search filters.
        No pagination is used.
        """
        queryset = Cable.objects.select_related(
            "cable_type",
            "status",
            "network_level",
            "owner",
            "constructor",
            "manufacturer",
            "project",
            "flag",
            "uuid_node_start",
            "uuid_node_end",
        ).order_by("name")
        project_id = request.query_params.get("project")
        flag_id = request.query_params.get("flag")
        name = request.query_params.get("name")
        search_term = request.query_params.get("search")
        child_view_for = request.query_params.get("child_view_for")
        if project_id:
            queryset = queryset.filter(project=project_id)

            # Handle child view mode: return cables created in this parent's child view
            if child_view_for:
                queryset = queryset.filter(parent_node_context_id=child_view_for)
            else:
                # Main schema: only show cables without parent context (created in main schema)
                queryset = queryset.filter(parent_node_context__isnull=True)

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

    @action(detail=False, methods=["get"], url_path="at-node/(?P<node_uuid>[^/.]+)")
    def cables_at_node(self, request, node_uuid=None):
        """
        Returns all cables that start or end at the specified node.
        """
        if not node_uuid:
            return Response(
                {"error": "node_uuid is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        queryset = (
            Cable.objects.filter(
                Q(uuid_node_start=node_uuid) | Q(uuid_node_end=node_uuid)
            )
            .select_related("cable_type")
            .order_by("name")
        )

        serializer = CableAtNodeSerializer(
            queryset, many=True, context={"node_uuid": node_uuid}
        )
        return Response(serializer.data)


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


class FiberViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the Fiber model :model:`api.Fiber`.

    Read-only access to fiber data with filtering by cable.
    """

    permission_classes = [IsAuthenticated]
    queryset = Fiber.objects.all().order_by(
        "uuid_cable", "bundle_number", "fiber_number_in_bundle"
    )
    serializer_class = FiberSerializer
    lookup_field = "uuid"
    lookup_url_kwarg = "pk"

    def get_queryset(self):
        """
        Optionally restricts the returned fibers by filtering against query parameters:
        - `cable`: Filter by cable UUID
        - `bundle_number`: Filter by bundle number
        """
        queryset = Fiber.objects.all().order_by(
            "uuid_cable", "bundle_number", "fiber_number_in_bundle"
        )
        cable_uuid = self.request.query_params.get("cable")
        bundle_number = self.request.query_params.get("bundle_number")
        if cable_uuid:
            queryset = queryset.filter(uuid_cable=cable_uuid)
        if bundle_number:
            queryset = queryset.filter(bundle_number=bundle_number)
        return queryset

    @action(detail=False, methods=["get"], url_path="by-cable/(?P<cable_uuid>[^/.]+)")
    def fibers_by_cable(self, request, cable_uuid=None):
        """
        Returns all fibers for a specific cable, ordered by bundle and fiber number.
        """
        if not cable_uuid:
            return Response(
                {"error": "cable_uuid is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        queryset = Fiber.objects.filter(uuid_cable=cable_uuid).order_by(
            "bundle_number", "fiber_number_in_bundle"
        )
        serializer = FiberSerializer(queryset, many=True)
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
            "trench": "trench",
            "address": "address",
            "node": "node",
            "area": "area",
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
                SELECT ST_Extent(geom_3857) as extent
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


class OlAreaTileViewSet(APIView):
    """ViewSet for the OlArea model :model:`api.OlArea`.

    An instance of :model:`api.OlArea`.
    """

    permission_classes = [IsAuthenticated]

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
                    a.project,
                    at.area_type,
                    f.flag
                FROM bounds b
                CROSS JOIN public.area a
                LEFT JOIN public.attributes_area_type at ON a.area_type = at.id
                LEFT JOIN public.flags f ON a.flag = f.id
                WHERE
                    a.geom_3857 && b.tile_bounds_margin
                    AND (%(project)s IS NULL OR a.project = %(project)s)
            )
            SELECT ST_AsMVT(mvtgeom, 'ol_area', 4096, 'geom') AS mvt
            FROM mvtgeom;
        """
        project_id = request.query_params.get("project")
        if project_id is not None:
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


class NodeSlotConfigurationViewSet(viewsets.ModelViewSet):
    """ViewSet for the NodeSlotConfiguration model.

    Manages slot configurations for nodes, allowing users to define
    the total number of slots available on each side of a node.
    """

    permission_classes = [IsAuthenticated]
    queryset = NodeSlotConfiguration.objects.all().order_by("uuid_node", "side")
    serializer_class = NodeSlotConfigurationSerializer
    lookup_field = "uuid"

    def get_queryset(self):
        """Filter slot configurations by node if specified."""
        queryset = super().get_queryset()
        node_uuid = self.request.query_params.get("node")
        if node_uuid:
            queryset = queryset.filter(uuid_node__uuid=node_uuid)
        return queryset.select_related("uuid_node")

    @action(detail=False, methods=["get"], url_path="by-node/(?P<node_uuid>[^/.]+)")
    def by_node(self, request, node_uuid=None):
        """Get all slot configurations for a specific node with usage stats."""
        configs = NodeSlotConfiguration.objects.filter(
            uuid_node__uuid=node_uuid
        ).select_related("uuid_node")
        serializer = self.get_serializer(configs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="move-to-container")
    def move_to_container(self, request, uuid=None):
        """
        Move a slot configuration into a container or to root level.

        Request body:
        {
            "container_id": "uuid" | null,  # Target container (null for root)
            "sort_order": 0  # Position within container/root
        }
        """
        config = self.get_object()
        container_id = request.data.get("container_id")
        sort_order = request.data.get("sort_order", 0)

        if container_id:
            try:
                container = Container.objects.get(uuid=container_id)
                # Verify container belongs to same node
                if container.uuid_node_id != config.uuid_node_id:
                    return Response(
                        {"error": "Container belongs to a different node"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                config.container = container
            except Container.DoesNotExist:
                return Response(
                    {"error": "Container not found"}, status=status.HTTP_404_NOT_FOUND
                )
        else:
            config.container = None

        config.sort_order = sort_order
        config.save()

        return Response(NodeSlotConfigurationSerializer(config).data)


class NodeStructureViewSet(viewsets.ModelViewSet):
    """ViewSet for the NodeStructure model.

    Manages the structure of components within a node, including
    component types, structures, and their slot positions.
    """

    permission_classes = [IsAuthenticated]
    queryset = NodeStructure.objects.all().order_by(
        "uuid_node", "slot_configuration", "slot_start"
    )
    serializer_class = NodeStructureSerializer
    lookup_field = "uuid"

    def get_queryset(self):
        """Filter node structures by node, slot_configuration, or purpose if specified."""
        queryset = super().get_queryset()
        node_uuid = self.request.query_params.get("node")
        slot_config_uuid = self.request.query_params.get("slot_configuration")
        purpose = self.request.query_params.get("purpose")

        if node_uuid:
            queryset = queryset.filter(uuid_node__uuid=node_uuid)
        if slot_config_uuid:
            queryset = queryset.filter(slot_configuration__uuid=slot_config_uuid)
        if purpose:
            queryset = queryset.filter(purpose=purpose)

        return queryset.select_related(
            "uuid_node", "slot_configuration", "component_type", "component_structure"
        )

    @action(detail=False, methods=["get"], url_path="by-node/(?P<node_uuid>[^/.]+)")
    def by_node(self, request, node_uuid=None):
        """Get all structures for a specific node grouped by slot configuration."""
        structures = (
            NodeStructure.objects.filter(uuid_node__uuid=node_uuid)
            .select_related(
                "slot_configuration", "component_type", "component_structure"
            )
            .order_by("slot_configuration", "slot_start")
        )
        serializer = self.get_serializer(structures, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="summary/(?P<node_uuid>[^/.]+)")
    def summary(self, request, node_uuid=None):
        """Get a summary of slot usage for a node."""
        try:
            node = Node.objects.get(uuid=node_uuid)
        except Node.DoesNotExist:
            return Response(
                {"error": "Node not found"}, status=status.HTTP_404_NOT_FOUND
            )

        configs = NodeSlotConfiguration.objects.filter(uuid_node=node)

        summary = {}
        for config in configs:
            side_structures = config.structures.all()
            used = sum(s.slot_end - s.slot_start + 1 for s in side_structures)
            components = side_structures.filter(
                purpose=NodeStructure.Purpose.COMPONENT
            ).count()
            reserves = side_structures.filter(
                purpose=NodeStructure.Purpose.RESERVE
            ).count()

            summary[config.side] = {
                "uuid": str(config.uuid),
                "total_slots": config.total_slots,
                "used_slots": used,
                "free_slots": config.total_slots - used,
                "component_count": components,
                "reserve_count": reserves,
            }

        return Response(summary)

    @action(detail=True, methods=["post"], url_path="move")
    def move(self, request, uuid=None):
        """Move a structure to a new slot position."""
        structure = self.get_object()
        new_slot_start = request.data.get("slot_start")

        if new_slot_start is None:
            return Response(
                {"error": "slot_start is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            new_slot_start = int(new_slot_start)
        except (TypeError, ValueError):
            return Response(
                {"error": "slot_start must be an integer"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        slot_count = structure.slot_end - structure.slot_start + 1
        new_slot_end = new_slot_start + slot_count - 1

        # Validate slot range within configuration bounds
        config = structure.slot_configuration
        if new_slot_start < 1 or new_slot_end > config.total_slots:
            return Response(
                {"error": "Invalid slot range"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Check for overlaps with other structures (excluding self)
        overlapping = (
            NodeStructure.objects.filter(slot_configuration=config)
            .exclude(uuid=structure.uuid)
            .filter(Q(slot_start__lte=new_slot_end) & Q(slot_end__gte=new_slot_start))
        )

        if overlapping.exists():
            return Response(
                {"error": "Slots already occupied"}, status=status.HTTP_400_BAD_REQUEST
            )

        structure.slot_start = new_slot_start
        structure.slot_end = new_slot_end
        structure.save()

        serializer = self.get_serializer(structure)
        return Response(serializer.data)


class NodeSlotDividerViewSet(viewsets.ModelViewSet):
    """
    ViewSet for NodeSlotDivider model.
    Manages horizontal divider lines between TPU slots for visual grouping.
    """

    permission_classes = [IsAuthenticated]
    queryset = NodeSlotDivider.objects.all().order_by(
        "slot_configuration", "after_slot"
    )
    serializer_class = NodeSlotDividerSerializer
    lookup_field = "uuid"

    def get_queryset(self):
        """Filter dividers by slot_configuration if specified."""
        queryset = super().get_queryset()
        slot_config_uuid = self.request.query_params.get("slot_configuration")

        if slot_config_uuid:
            queryset = queryset.filter(slot_configuration__uuid=slot_config_uuid)

        return queryset.select_related("slot_configuration")


class NodeSlotClipNumberViewSet(viewsets.ModelViewSet):
    """
    ViewSet for NodeSlotClipNumber model.
    Manages custom clip numbers for individual slots.
    """

    permission_classes = [IsAuthenticated]
    queryset = NodeSlotClipNumber.objects.all().order_by(
        "slot_configuration", "slot_number"
    )
    serializer_class = NodeSlotClipNumberSerializer
    lookup_field = "uuid"

    def get_queryset(self):
        """Filter clip numbers by slot_configuration if specified."""
        queryset = super().get_queryset()
        slot_config_uuid = self.request.query_params.get("slot_configuration")

        if slot_config_uuid:
            queryset = queryset.filter(slot_configuration__uuid=slot_config_uuid)

        return queryset.select_related("slot_configuration")

    @action(detail=False, methods=["post"], url_path="upsert")
    def upsert(self, request):
        """Create or update a clip number for a slot."""
        slot_config_id = request.data.get("slot_configuration_id")
        slot_number = request.data.get("slot_number")
        clip_number = request.data.get("clip_number")

        if not all([slot_config_id, slot_number, clip_number]):
            return Response(
                {
                    "error": "slot_configuration_id, slot_number, and clip_number are required"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            slot_config = NodeSlotConfiguration.objects.get(uuid=slot_config_id)
        except NodeSlotConfiguration.DoesNotExist:
            return Response(
                {"error": "Slot configuration not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        clip_number_obj, created = NodeSlotClipNumber.objects.update_or_create(
            slot_configuration=slot_config,
            slot_number=int(slot_number),
            defaults={"clip_number": clip_number},
        )

        serializer = self.get_serializer(clip_number_obj)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class AttributesComponentStructureViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only ViewSet for AttributesComponentStructure model.
    Returns ports (IN/OUT) for a given component type.
    """

    permission_classes = [IsAuthenticated]
    queryset = AttributesComponentStructure.objects.all()
    serializer_class = AttributesComponentStructureSerializer

    def get_queryset(self):
        """Filter by component_type if specified."""
        queryset = super().get_queryset()
        component_type_id = self.request.query_params.get("component_type")

        if component_type_id:
            queryset = queryset.filter(component_type_id=component_type_id)

        return queryset.order_by("in_or_out", "port")


class FiberSpliceViewSet(viewsets.ModelViewSet):
    """
    ViewSet for FiberSplice model.
    Manages fiber splice connections within node components.
    Each splice connects fiber_a to fiber_b at a specific port number.
    """

    permission_classes = [IsAuthenticated]
    queryset = FiberSplice.objects.all()
    serializer_class = FiberSpliceSerializer
    lookup_field = "uuid"

    def get_queryset(self):
        """Filter splices by node_structure, node_structure__uuid_node, cable_a, or cable_b if specified."""
        queryset = super().get_queryset()
        node_structure = self.request.query_params.get("node_structure")
        node_structure_uuid_node = self.request.query_params.get(
            "node_structure__uuid_node"
        )
        cable_a = self.request.query_params.get("cable_a")
        cable_b = self.request.query_params.get("cable_b")

        if node_structure:
            queryset = queryset.filter(node_structure=node_structure)

        if node_structure_uuid_node:
            queryset = queryset.filter(
                node_structure__uuid_node=node_structure_uuid_node
            )

        if cable_a:
            queryset = queryset.filter(cable_a=cable_a)

        if cable_b:
            queryset = queryset.filter(cable_b=cable_b)

        return queryset.select_related(
            "fiber_a", "cable_a", "fiber_b", "cable_b", "node_structure"
        )

    @action(detail=False, methods=["post"], url_path="upsert")
    def upsert(self, request):
        """
        Create or update a fiber splice connection.
        Specify which side ('a' or 'b') the fiber should be placed on.

        If the port is part of a merge group on this side,
        the fiber becomes a SHARED fiber for all ports in the group.
        """
        node_structure_uuid = request.data.get("node_structure")
        port_number = request.data.get("port_number")
        side = request.data.get("side")  # 'a' or 'b'
        fiber_uuid = request.data.get("fiber_uuid")
        cable_uuid = request.data.get("cable_uuid")

        if not all([node_structure_uuid, port_number, side, fiber_uuid, cable_uuid]):
            return Response(
                {
                    "error": "node_structure, port_number, side, fiber_uuid, and cable_uuid are required"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if side not in ("a", "b"):
            return Response(
                {"error": "side must be 'a' or 'b'"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            node_structure = NodeStructure.objects.get(uuid=node_structure_uuid)
        except NodeStructure.DoesNotExist:
            return Response(
                {"error": "Node structure not found"}, status=status.HTTP_404_NOT_FOUND
            )

        # Get or create the splice record for this port
        splice, created = FiberSplice.objects.get_or_create(
            node_structure=node_structure,
            port_number=port_number,
        )

        # Check if this port is merged on this side (using side-specific merge group)
        merge_group_field = f"merge_group_{side}"
        merge_group_value = getattr(splice, merge_group_field)
        is_merged_on_this_side = merge_group_value is not None

        if is_merged_on_this_side:
            # Set SHARED fiber for ALL ports in the merge group
            FiberSplice.objects.filter(**{merge_group_field: merge_group_value}).update(
                **{
                    f"shared_fiber_{side}_id": fiber_uuid,
                    f"shared_cable_{side}_id": cable_uuid,
                }
            )
            # Re-fetch the splice to get updated data
            splice.refresh_from_db()
        else:
            # Set individual fiber (not in a merge group on this side)
            if side == "a":
                splice.fiber_a_id = fiber_uuid
                splice.cable_a_id = cable_uuid
            else:
                splice.fiber_b_id = fiber_uuid
                splice.cable_b_id = cable_uuid
            splice.save()

        serializer = self.get_serializer(splice)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"], url_path="clear-port")
    def clear_port(self, request):
        """
        Clear a fiber from a specific side of a port.
        If both sides become empty AND not in any merge group, delete the splice record.

        If the port is merged on this side, clears the SHARED fiber for all ports
        in the merge group, but keeps the merge group structure intact.
        """
        node_structure_uuid = request.data.get("node_structure")
        port_number = request.data.get("port_number")
        side = request.data.get("side")  # 'a' or 'b'

        if not all([node_structure_uuid, port_number, side]):
            return Response(
                {"error": "node_structure, port_number, and side are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if side not in ("a", "b"):
            return Response(
                {"error": "side must be 'a' or 'b'"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            node_structure = NodeStructure.objects.get(uuid=node_structure_uuid)
        except NodeStructure.DoesNotExist:
            return Response(
                {"error": "Node structure not found"}, status=status.HTTP_404_NOT_FOUND
            )

        try:
            splice = FiberSplice.objects.get(
                node_structure=node_structure, port_number=port_number
            )
        except FiberSplice.DoesNotExist:
            return Response({"deleted": False, "message": "No splice found"})

        # Check if this port is merged on this side (using side-specific merge group)
        merge_group_field = f"merge_group_{side}"
        merge_group_value = getattr(splice, merge_group_field)
        is_merged_on_this_side = merge_group_value is not None

        if is_merged_on_this_side:
            # Clear SHARED fiber for ALL ports in the merge group
            # Keep the merge group structure intact
            FiberSplice.objects.filter(**{merge_group_field: merge_group_value}).update(
                **{
                    f"shared_fiber_{side}": None,
                    f"shared_cable_{side}": None,
                }
            )
            return Response(
                {
                    "deleted": True,
                    "message": f"Shared fiber cleared from merge group on side {side}",
                    "merge_group_preserved": True,
                }
            )
        else:
            # Clear individual fiber on this side
            if side == "a":
                splice.fiber_a = None
                splice.cable_a = None
            else:
                splice.fiber_b = None
                splice.cable_b = None

            # Check if we should delete the record
            # Only delete if: both sides empty, no shared fibers, and not in any merge group
            both_sides_empty = splice.fiber_a is None and splice.fiber_b is None
            no_shared_fibers = (
                splice.shared_fiber_a is None and splice.shared_fiber_b is None
            )
            not_in_any_merge = (
                splice.merge_group_a is None and splice.merge_group_b is None
            )

            if both_sides_empty and no_shared_fibers and not_in_any_merge:
                splice.delete()
                return Response({"deleted": True, "message": "Splice record deleted"})

            splice.save()
            return Response(
                {"deleted": True, "message": f"Fiber cleared from side {side}"}
            )

    @action(detail=False, methods=["post"], url_path="merge-ports")
    def merge_ports(self, request):
        """
        Merge multiple ports into a group for a specific side (A or B).
        Creates a new merge_group UUID and assigns it to the side-specific field.

        Each side has its own independent merge group, allowing ports to be
        merged on both sides simultaneously (e.g., splitter with merged input AND output).

        If any port has an existing fiber on the merged side, it becomes the
        SHARED fiber for all ports in the group. Individual fibers on the
        merged side are cleared.
        """
        from .serializers import PortMergeSerializer

        serializer = PortMergeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        node_structure_uuid = serializer.validated_data["node_structure"]
        port_numbers = serializer.validated_data["port_numbers"]
        side = serializer.validated_data["side"]

        try:
            node_structure = NodeStructure.objects.get(uuid=node_structure_uuid)
        except NodeStructure.DoesNotExist:
            return Response(
                {"error": "Node structure not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Generate new merge group UUID for this side
        merge_group_id = uuid.uuid4()
        merge_group_field = f"merge_group_{side}"

        # Get or create splice records for each port
        splices = []
        existing_fiber = None
        existing_cable = None

        for port_num in port_numbers:
            splice, created = FiberSplice.objects.get_or_create(
                node_structure=node_structure,
                port_number=port_num,
            )
            # Check if this port has an existing fiber on the merge side
            # Use the first one we find as the shared fiber
            if existing_fiber is None:
                if side == "a" and splice.fiber_a:
                    existing_fiber = splice.fiber_a
                    existing_cable = splice.cable_a
                elif side == "b" and splice.fiber_b:
                    existing_fiber = splice.fiber_b
                    existing_cable = splice.cable_b

            # Set the side-specific merge group (preserves the other side's merge group)
            setattr(splice, merge_group_field, merge_group_id)
            splices.append(splice)

        # If we found an existing fiber, make it the shared fiber for all ports
        # Also clear individual fibers on the merged side
        for splice in splices:
            if existing_fiber:
                if side == "a":
                    splice.shared_fiber_a = existing_fiber
                    splice.shared_cable_a = existing_cable
                    splice.fiber_a = None
                    splice.cable_a = None
                else:
                    splice.shared_fiber_b = existing_fiber
                    splice.shared_cable_b = existing_cable
                    splice.fiber_b = None
                    splice.cable_b = None
            else:
                # No existing fiber, just clear individual fibers on merged side
                if side == "a":
                    splice.fiber_a = None
                    splice.cable_a = None
                else:
                    splice.fiber_b = None
                    splice.cable_b = None
            splice.save()

        return Response(
            {
                "merge_group": str(merge_group_id),
                "side": side,
                "port_numbers": port_numbers,
                "splices": FiberSpliceSerializer(splices, many=True).data,
            }
        )

    @action(detail=False, methods=["post"], url_path="unmerge-ports")
    def unmerge_ports(self, request):
        """
        Remove specific ports from a merge group on a specific side.
        Sets merge_group_a or merge_group_b to NULL for specified ports.
        If only one port remains in group, unmerges that one too.

        When unmerging, converts the shared fiber back to an individual fiber
        on the first unmerged port, then clears shared fibers for that side only.
        """
        from .serializers import PortUnmergeSerializer

        serializer = PortUnmergeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        merge_group = serializer.validated_data["merge_group"]
        port_numbers = serializer.validated_data["port_numbers"]

        # Try to find the merge group on side A first, then side B
        group_splices_a = FiberSplice.objects.filter(merge_group_a=merge_group)
        group_splices_b = FiberSplice.objects.filter(merge_group_b=merge_group)

        if group_splices_a.exists():
            group_splices = group_splices_a
            side = "a"
            merge_group_field = "merge_group_a"
        elif group_splices_b.exists():
            group_splices = group_splices_b
            side = "b"
            merge_group_field = "merge_group_b"
        else:
            return Response(
                {"error": "Merge group not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get the first splice to determine the shared fiber
        first_splice = group_splices.first()

        # Get the shared fiber (if any) to convert back to individual
        shared_fiber = None
        shared_cable = None
        if side == "a":
            shared_fiber = first_splice.shared_fiber_a
            shared_cable = first_splice.shared_cable_a
        else:
            shared_fiber = first_splice.shared_fiber_b
            shared_cable = first_splice.shared_cable_b

        # Unmerge specified ports
        unmerged_splices = list(group_splices.filter(port_number__in=port_numbers))

        # Convert shared fiber to individual fiber on the first unmerged port
        if shared_fiber and unmerged_splices:
            first_unmerged = unmerged_splices[0]
            if side == "a":
                first_unmerged.fiber_a = shared_fiber
                first_unmerged.cable_a = shared_cable
            else:
                first_unmerged.fiber_b = shared_fiber
                first_unmerged.cable_b = shared_cable

        # Clear merge info and shared fibers for THIS SIDE ONLY on unmerged ports
        for splice in unmerged_splices:
            setattr(splice, merge_group_field, None)
            if side == "a":
                splice.shared_fiber_a = None
                splice.shared_cable_a = None
            else:
                splice.shared_fiber_b = None
                splice.shared_cable_b = None
            splice.save()

        # Check remaining ports in group
        remaining = group_splices.exclude(port_number__in=port_numbers)
        remaining_count = remaining.count()

        if remaining_count == 1:
            # Only one port left, unmerge it too (can't have a group of 1)
            remaining_splice = remaining.first()

            # Convert shared fiber to individual for the last remaining port
            if side == "a" and remaining_splice.shared_fiber_a:
                remaining_splice.fiber_a = remaining_splice.shared_fiber_a
                remaining_splice.cable_a = remaining_splice.shared_cable_a
            elif side == "b" and remaining_splice.shared_fiber_b:
                remaining_splice.fiber_b = remaining_splice.shared_fiber_b
                remaining_splice.cable_b = remaining_splice.shared_cable_b

            setattr(remaining_splice, merge_group_field, None)
            if side == "a":
                remaining_splice.shared_fiber_a = None
                remaining_splice.shared_cable_a = None
            else:
                remaining_splice.shared_fiber_b = None
                remaining_splice.shared_cable_b = None
            remaining_splice.save()
            remaining_count = 0

        return Response(
            {
                "unmerged_ports": port_numbers,
                "remaining_in_group": remaining_count,
                "side": side,
            }
        )

    @action(detail=False, methods=["post"], url_path="upsert-merged")
    def upsert_merged(self, request):
        """
        Upsert fibers to a merge group on a specific side.

        Behavior depends on whether the merge group is on this side:
        - If dropping on the MERGED side (this side has the merge group):
        Use the FIRST fiber as the shared fiber for all ports in the group
        - If dropping on the OTHER side (not merged on this side):
        Fill individual fibers sequentially across ports
        """
        merge_group = request.data.get("merge_group")
        side = request.data.get("side")  # 'a' or 'b'
        fibers = request.data.get("fibers")  # List of {uuid, cable_uuid}

        if not all([merge_group, side, fibers]):
            return Response(
                {"error": "merge_group, side, and fibers are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if side not in ("a", "b"):
            return Response(
                {"error": "side must be 'a' or 'b'"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        splices_a = list(
            FiberSplice.objects.filter(merge_group_a=merge_group).order_by(
                "port_number"
            )
        )
        splices_b = list(
            FiberSplice.objects.filter(merge_group_b=merge_group).order_by(
                "port_number"
            )
        )

        if splices_a:
            splices = splices_a
            merge_group_side = "a"
        elif splices_b:
            splices = splices_b
            merge_group_side = "b"
        else:
            return Response(
                {"error": "Merge group not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Determine if we're dropping on the same side as the merge group
        is_merged_side = merge_group_side == side

        if is_merged_side:
            # Dropping on MERGED side: Use FIRST fiber as shared fiber for ALL ports
            first_fiber = fibers[0]
            for splice in splices:
                if side == "a":
                    splice.shared_fiber_a_id = first_fiber["uuid"]
                    splice.shared_cable_a_id = first_fiber["cable_uuid"]
                else:
                    splice.shared_fiber_b_id = first_fiber["uuid"]
                    splice.shared_cable_b_id = first_fiber["cable_uuid"]
                splice.save()

            return Response(
                {
                    "updated_count": len(splices),
                    "mode": "shared_fiber",
                    "splices": FiberSpliceSerializer(splices, many=True).data,
                }
            )
        else:
            # Dropping on NON-MERGED side: Fill individual fibers sequentially
            updated_splices = []
            for i, splice in enumerate(splices):
                if i < len(fibers):
                    fiber_data = fibers[i]
                    if side == "a":
                        splice.fiber_a_id = fiber_data["uuid"]
                        splice.cable_a_id = fiber_data["cable_uuid"]
                    else:
                        splice.fiber_b_id = fiber_data["uuid"]
                        splice.cable_b_id = fiber_data["cable_uuid"]
                    splice.save()
                    updated_splices.append(splice)

            return Response(
                {
                    "updated_count": len(updated_splices),
                    "mode": "individual_fibers",
                    "splices": FiberSpliceSerializer(updated_splices, many=True).data,
                }
            )


class ContainerTypeViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only ViewSet for ContainerType model.
    Only returns active container types.
    Admin management is done via Django Admin.
    """

    permission_classes = [IsAuthenticated]
    queryset = ContainerType.objects.filter(is_active=True).order_by(
        "display_order", "name"
    )
    serializer_class = ContainerTypeSerializer


class ContainerViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Container instances.
    Supports CRUD operations and hierarchy manipulation.
    """

    permission_classes = [IsAuthenticated]
    queryset = Container.objects.all().select_related(
        "container_type", "parent_container", "uuid_node"
    )
    serializer_class = ContainerSerializer
    lookup_field = "uuid"

    def get_queryset(self):
        """Filter containers by node if specified."""
        queryset = super().get_queryset()
        node_uuid = self.request.query_params.get("node")
        if node_uuid:
            queryset = queryset.filter(uuid_node__uuid=node_uuid)
        return queryset.order_by("sort_order")

    @action(detail=False, methods=["get"], url_path="by-node/(?P<node_uuid>[^/.]+)")
    def by_node(self, request, node_uuid=None):
        """Get all containers for a specific node as a flat list."""
        containers = (
            Container.objects.filter(uuid_node__uuid=node_uuid)
            .select_related("container_type", "parent_container")
            .order_by("sort_order")
        )
        serializer = self.get_serializer(containers, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="tree/(?P<node_uuid>[^/.]+)")
    def tree(self, request, node_uuid=None):
        """
        Get the complete container hierarchy for a node.
        Returns a tree structure with nested containers and slot configurations.
        """
        try:
            node = Node.objects.get(uuid=node_uuid)
        except Node.DoesNotExist:
            return Response(
                {"error": "Node not found"}, status=status.HTTP_404_NOT_FOUND
            )

        # Get root-level containers (no parent)
        root_containers = (
            Container.objects.filter(uuid_node=node, parent_container__isnull=True)
            .select_related("container_type")
            .prefetch_related("children", "slot_configurations")
            .order_by("sort_order")
        )

        # Get root-level slot configurations (not in any container)
        root_configs = NodeSlotConfiguration.objects.filter(
            uuid_node=node, container__isnull=True
        ).order_by("sort_order", "side")

        return Response(
            {
                "containers": ContainerTreeSerializer(root_containers, many=True).data,
                "root_slot_configurations": NodeSlotConfigurationListSerializer(
                    root_configs, many=True
                ).data,
            }
        )

    @action(detail=True, methods=["post"], url_path="move")
    def move(self, request, uuid=None):
        """
        Move a container to a new parent or reorder within siblings.

        Request body:
        {
            "parent_container_id": "uuid" | null,  # New parent (null for root)
            "sort_order": 0  # New position among siblings
        }
        """
        container = self.get_object()
        parent_id = request.data.get("parent_container_id")
        sort_order = request.data.get("sort_order", 0)

        # Validate: cannot move container into itself or its descendants
        if parent_id:
            try:
                new_parent = Container.objects.get(uuid=parent_id)
                # Check for circular reference
                ancestor = new_parent
                while ancestor:
                    if ancestor.uuid == container.uuid:
                        return Response(
                            {
                                "error": "Cannot move container into itself or its descendants"
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    ancestor = ancestor.parent_container
                container.parent_container = new_parent
            except Container.DoesNotExist:
                return Response(
                    {"error": "Parent container not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )
        else:
            container.parent_container = None

        container.sort_order = sort_order
        container.save()

        return Response(ContainerSerializer(container).data)


class ConduitsByTrenchesView(APIView):
    """Get deduplicated conduits for selected trenches."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        trench_ids = request.query_params.get("trench_ids", "")
        cable_id = request.query_params.get("cable_id")

        # Validate cable_id UUID format if provided
        if cable_id:
            try:
                uuid.UUID(cable_id)
            except ValueError:
                return Response(
                    {"error": "Invalid cable_id format"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if not trench_ids:
            return Response([])

        # Validate each trench UUID
        trench_uuid_list = []
        for uuid_str in trench_ids.split(","):
            uuid_str = uuid_str.strip()
            if uuid_str:
                try:
                    uuid.UUID(uuid_str)
                    trench_uuid_list.append(uuid_str)
                except ValueError:
                    return Response(
                        {"error": f"Invalid trench UUID format: {uuid_str}"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

        # Get unique conduits from TrenchConduitConnection
        conduit_ids = list(
            TrenchConduitConnection.objects.filter(uuid_trench_id__in=trench_uuid_list)
            .values_list("uuid_conduit_id", flat=True)
            .distinct()
        )

        conduits = Conduit.objects.filter(uuid__in=conduit_ids).select_related(
            "conduit_type"
        )

        # Prefetch linked conduit IDs to avoid N+1 queries
        linked_conduit_ids = set()
        if cable_id:
            linked_conduit_ids = set(
                MicroductCableConnection.objects.filter(
                    uuid_cable_id=cable_id,
                    uuid_microduct__uuid_conduit_id__in=conduit_ids,
                ).values_list("uuid_microduct__uuid_conduit_id", flat=True)
            )

        serializer = ConduitForTrenchSelectionSerializer(
            conduits,
            many=True,
            context={"cable_id": cable_id, "linked_conduit_ids": linked_conduit_ids},
        )
        return Response(serializer.data)


class MicropipesByConduitsView(APIView):
    """Get micropipes with availability info across selected conduits."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        conduit_ids = request.query_params.get("conduit_ids", "")
        cable_id = request.query_params.get("cable_id")

        # Validate cable_id UUID format if provided
        if cable_id:
            try:
                uuid.UUID(cable_id)
            except ValueError:
                return Response(
                    {"error": "Invalid cable_id format"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if not conduit_ids:
            return Response([])

        # Validate each conduit UUID
        conduit_uuid_list = []
        for uuid_str in conduit_ids.split(","):
            uuid_str = uuid_str.strip()
            if uuid_str:
                try:
                    uuid.UUID(uuid_str)
                    conduit_uuid_list.append(uuid_str)
                except ValueError:
                    return Response(
                        {"error": f"Invalid conduit UUID format: {uuid_str}"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
        conduits = Conduit.objects.filter(uuid__in=conduit_uuid_list)
        conduit_map = {str(c.uuid): c.name for c in conduits}

        # Get all microducts for these conduits
        microducts = Microduct.objects.filter(
            uuid_conduit_id__in=conduit_uuid_list
        ).select_related("uuid_conduit", "microduct_status")

        # Get color hex codes
        color_mapping = {
            c.name_de: c.hex_code
            for c in AttributesMicroductColor.objects.filter(is_active=True)
        }

        # Group by (number, color)
        micropipe_groups = {}
        for md in microducts:
            key = (md.number, md.color)
            if key not in micropipe_groups:
                micropipe_groups[key] = {
                    "number": md.number,
                    "color_name": md.color,
                    "color_hex": color_mapping.get(md.color, "#808080"),
                    "available_in": [],
                    "microduct_uuids": {},
                    "has_defect": False,
                }
            micropipe_groups[key]["available_in"].append(str(md.uuid_conduit_id))
            micropipe_groups[key]["microduct_uuids"][str(md.uuid_conduit_id)] = str(
                md.uuid
            )
            # Mark as defective if any microduct in the group has a status
            if md.microduct_status:
                micropipe_groups[key]["has_defect"] = True

        # Get ALL cable connections for microducts in these conduits
        all_connections = MicroductCableConnection.objects.filter(
            uuid_microduct__uuid_conduit_id__in=conduit_uuid_list
        ).select_related("uuid_cable")

        # Build mapping: microduct_uuid -> list of {uuid, name}
        microduct_cables = defaultdict(list)
        for conn in all_connections:
            microduct_cables[conn.uuid_microduct_id].append(
                {"uuid": str(conn.uuid_cable_id), "name": conn.uuid_cable.name}
            )

        # Build response
        result = []
        conduit_set = set(conduit_uuid_list)
        for key, data in sorted(micropipe_groups.items(), key=lambda x: x[0]):
            available_set = set(data["available_in"])
            missing_conduits = conduit_set - available_set

            # Collect all cables linked to any microduct in this group
            linked_cables_set = {}
            for md_uuid_str in data["microduct_uuids"].values():
                md_uuid = uuid.UUID(md_uuid_str)
                for cable_info in microduct_cables.get(md_uuid, []):
                    linked_cables_set[cable_info["uuid"]] = cable_info["name"]

            linked_cables = [
                {"uuid": c_uuid, "name": c_name}
                for c_uuid, c_name in linked_cables_set.items()
            ]

            # Check if linked to current cable
            is_linked = cable_id and cable_id in linked_cables_set

            result.append(
                {
                    "number": data["number"],
                    "color_name": data["color_name"],
                    "color_hex": data["color_hex"],
                    "available_in": list(available_set),
                    "available_in_all": len(missing_conduits) == 0,
                    "linked_to_cable": is_linked,
                    "linked_cables": linked_cables,
                    "missing_in": [conduit_map.get(c, c) for c in missing_conduits],
                    "microduct_status": data["has_defect"],
                }
            )

        return Response(result)


class CableMicropipeConnectionsView(APIView):
    """Manage cable-micropipe connections."""

    permission_classes = [IsAuthenticated]

    def post(self, request, cable_id):
        """Create connections for a micropipe across multiple conduits."""
        micropipe_number = request.data.get("micropipe_number")
        color = request.data.get("color")
        conduit_ids = request.data.get("conduit_ids", [])

        if not micropipe_number or not color or not conduit_ids:
            return Response(
                {"error": "micropipe_number, color, and conduit_ids are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Find matching microducts
        microducts = Microduct.objects.filter(
            uuid_conduit_id__in=conduit_ids, number=micropipe_number, color=color
        )

        created = []
        for md in microducts:
            conn, was_created = MicroductCableConnection.objects.get_or_create(
                uuid_microduct=md, uuid_cable_id=cable_id
            )
            if was_created:
                created.append(str(conn.uuid))

        return Response({"created": created, "count": len(created)})

    def delete(self, request, cable_id):
        """Remove connections for a micropipe across conduits."""
        micropipe_number = request.data.get("micropipe_number")
        conduit_ids = request.data.get("conduit_ids", [])

        if not micropipe_number or not conduit_ids:
            return Response(
                {"error": "micropipe_number and conduit_ids are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        deleted, _ = MicroductCableConnection.objects.filter(
            uuid_cable_id=cable_id,
            uuid_microduct__uuid_conduit_id__in=conduit_ids,
            uuid_microduct__number=micropipe_number,
        ).delete()

        return Response({"deleted": deleted})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_trenches_for_cable_connections(request, cable_id):
    """
    Get all trench UUIDs where the cable has micropipe connections.
    Path: Cable -> MicroductCableConnection -> Microduct -> Conduit -> TrenchConduitConnection -> Trench
    """
    trench_uuids = list(
        Trench.objects.filter(
            trenchconduitconnection__uuid_conduit__microduct__microductcableconnection__uuid_cable_id=cable_id
        )
        .distinct()
        .values_list("uuid", flat=True)
    )

    return Response({"trench_uuids": [str(uuid) for uuid in trench_uuids]})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_conduits_for_cable(request, cable_id):
    """Get all conduit names where the cable has micropipe connections."""
    conduit_names = list(
        Conduit.objects.filter(
            microduct__microductcableconnection__uuid_cable_id=cable_id
        )
        .distinct()
        .values_list("name", flat=True)
    )
    return Response({"conduit_names": conduit_names})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_cable_micropipe_summary(request, project_id):
    """
    Get micropipe connection summary for all cables in a project.
    Returns a dict mapping cable UUIDs to their connected micropipes with color info.
    Used for dynamic edge coloring in the network schema diagram.
    """
    connections = (
        MicroductCableConnection.objects.filter(uuid_cable__project_id=project_id)
        .select_related("uuid_microduct", "uuid_cable")
        .order_by("uuid_cable", "uuid_microduct__number")
    )

    # Build a lookup for color hex codes
    color_lookup = {
        color.name_de.lower(): color.hex_code
        for color in AttributesMicroductColor.objects.filter(is_active=True)
    }

    # Group by cable and extract micropipe info
    result = {}
    for conn in connections:
        cable_uuid = str(conn.uuid_cable_id)
        if cable_uuid not in result:
            result[cable_uuid] = []

        color_name = (
            conn.uuid_microduct.color.lower() if conn.uuid_microduct.color else None
        )
        hex_code = color_lookup.get(color_name, "#64748b")

        result[cable_uuid].append(
            {
                "number": conn.uuid_microduct.number,
                "color_hex": hex_code,
                "color_name": conn.uuid_microduct.color,
            }
        )

    return Response(result)


class WMSSourceViewSet(viewsets.ModelViewSet):
    """ViewSet for WMS sources.

    Note: Project-level authorization follows existing codebase pattern where
    authenticated users can access any project's data via query params.
    To restrict access, implement project-level permissions at the auth layer.
    """

    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return WMSSourceCreateSerializer
        return WMSSourceSerializer

    def get_queryset(self):
        queryset = WMSSource.objects.filter(is_active=True)
        project_id = self.request.query_params.get("project")
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        return queryset.prefetch_related("layers")

    def _is_url_safe(self, url: str) -> tuple[bool, str]:
        """Check if URL is safe to access (not internal/private).

        Reuses validation logic from WMSProxyView.
        """
        import ipaddress
        import socket
        from urllib.parse import urlparse

        blocked_networks = [
            "10.0.0.0/8",
            "172.16.0.0/12",
            "192.168.0.0/16",
            "127.0.0.0/8",
            "169.254.0.0/16",
            "::1/128",
            "fc00::/7",
            "fe80::/10",
        ]

        parsed = urlparse(url)
        hostname = parsed.hostname

        if not hostname:
            return False, "Invalid URL: no hostname"

        internal_hostnames = ["localhost", "metadata.google.internal"]
        if hostname.lower() in internal_hostnames:
            return False, "Access to internal hosts is not allowed"

        try:
            ip = ipaddress.ip_address(hostname)
        except ValueError:
            try:
                resolved = socket.gethostbyname(hostname)
                ip = ipaddress.ip_address(resolved)
            except socket.gaierror:
                return False, f"Could not resolve hostname: {hostname}"

        for network_str in blocked_networks:
            try:
                network = ipaddress.ip_network(network_str)
                if ip in network:
                    return False, "Access to private/internal networks is not allowed"
            except ValueError:
                continue

        return True, ""

    @action(detail=True, methods=["post"])
    def refresh_layers(self, request, pk=None):
        """Refresh layers from WMS GetCapabilities."""
        source = self.get_object()

        # SSRF protection
        is_safe, error_msg = self._is_url_safe(source.url)
        if not is_safe:
            return Response(
                {"error": error_msg},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            layers_data = fetch_wms_layers(
                source.url,
                username=source.username or None,
                password=source.password or None,
            )
        except WMSServiceError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        new_names = {layer["name"] for layer in layers_data}
        source.layers.exclude(name__in=new_names).delete()

        for i, layer_data in enumerate(layers_data):
            WMSLayer.objects.update_or_create(
                source=source,
                name=layer_data["name"],
                defaults={
                    "title": layer_data["title"],
                    "sort_order": i,
                },
            )

        return Response(WMSSourceSerializer(source).data)

    @action(detail=False, methods=["get"])
    def access_token(self, request):
        """Get a short-lived access token for WMS tile requests.

        This token can be passed as a query parameter to the WMS proxy
        to authenticate tile requests that can't use cookies (due to
        SameSite restrictions on cross-origin image requests).

        The token includes a 'wms_only' claim to scope it specifically
        for WMS proxy requests, preventing misuse on other endpoints.
        """
        from datetime import timedelta

        from rest_framework_simplejwt.tokens import AccessToken

        # Create a short-lived token (5 minutes) for WMS access
        token = AccessToken.for_user(request.user)
        token.set_exp(lifetime=timedelta(minutes=5))
        # Scope token to WMS proxy only
        token["wms_only"] = True

        return Response({"token": str(token)})

    @action(detail=True, methods=["post"])
    def scan_capabilities(self, request, pk=None):
        """Scan WMS capabilities to recommend configuration settings.

        Analyzes the WMS GetCapabilities response to determine:
        - Recommended minZoom for each layer based on BBOX constraints
        - Supported CRS for each layer
        - Service-level constraints

        Returns detailed information to help configure WMS layers.
        """
        source = self.get_object()

        # SSRF protection
        is_safe, error_msg = self._is_url_safe(source.url)
        if not is_safe:
            return Response(
                {"error": error_msg},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = scan_wms_capabilities(
                source.url,
                username=source.username or None,
                password=source.password or None,
            )
        except WMSServiceError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(result)


class WMSLayerViewSet(viewsets.ModelViewSet):
    """ViewSet for WMS layers."""

    serializer_class = WMSLayerSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = WMSLayer.objects.filter(is_enabled=True)
        project_id = self.request.query_params.get("project")
        if project_id:
            queryset = queryset.filter(
                source__project_id=project_id, source__is_active=True
            )
        return queryset.select_related("source")


class WMSTokenAuthentication(BaseAuthentication):
    """Custom authentication that accepts JWT token via query parameter.

    This is needed for WMS tile requests where browsers don't send cookies
    due to SameSite restrictions on cross-origin image requests.

    Only accepts tokens with 'wms_only' claim to prevent misuse of
    general access tokens via URL parameters.
    """

    def authenticate(self, request):
        from rest_framework.exceptions import AuthenticationFailed
        from rest_framework_simplejwt.exceptions import TokenError
        from rest_framework_simplejwt.tokens import AccessToken

        token = request.query_params.get("token")
        if not token:
            return None

        try:
            validated_token = AccessToken(token)

            # Verify token is scoped for WMS access only
            if not validated_token.get("wms_only"):
                raise AuthenticationFailed("Token not valid for WMS access")

            user_id = validated_token.get("user_id")
            user = User.objects.get(id=user_id)
            return (user, validated_token)
        except TokenError as e:
            raise AuthenticationFailed(f"Invalid token: {e}")
        except User.DoesNotExist:
            raise AuthenticationFailed("User not found")


class WMSProxyView(APIView):
    """Proxy view for WMS requests.

    Includes SSRF protection to prevent access to internal networks,
    response size limits, and streaming response support.

    Supports authentication via:
    - Standard cookie-based JWT (for same-origin requests)
    - Query parameter token (for cross-origin image requests)
    """

    from dj_rest_auth.jwt_auth import JWTCookieAuthentication

    authentication_classes = [WMSTokenAuthentication, JWTCookieAuthentication]
    permission_classes = [IsAuthenticated]

    MAX_RESPONSE_SIZE = 50 * 1024 * 1024  # 50MB

    BLOCKED_NETWORKS = [
        "0.0.0.0/8",  # "This" network
        "10.0.0.0/8",
        "172.16.0.0/12",
        "192.168.0.0/16",
        "127.0.0.0/8",
        "169.254.0.0/16",  # Link-local / AWS metadata
        "::1/128",
        "fc00::/7",
        "fe80::/10",
    ]

    ALLOWED_WMS_PARAMS = {
        "service",
        "request",
        "version",
        "layers",
        "styles",
        "crs",
        "srs",
        "bbox",
        "width",
        "height",
        "format",
        "transparent",
        "bgcolor",
        "time",
        "elevation",
        "map",  # QGIS Server project file parameter
    }

    ALLOWED_URL_SCHEMES = {"http", "https"}

    def _is_url_safe(self, url: str) -> tuple[bool, str]:
        """Check if URL is safe to access (not internal/private).

        Returns:
            Tuple of (is_safe, error_message)
        """
        import ipaddress
        import socket
        from urllib.parse import urlparse

        parsed = urlparse(url)

        # Validate URL scheme
        if parsed.scheme.lower() not in self.ALLOWED_URL_SCHEMES:
            return (
                False,
                f"URL scheme '{parsed.scheme}' not allowed. Only http/https permitted.",
            )

        hostname = parsed.hostname

        if not hostname:
            return False, "Invalid URL: no hostname"

        # Block common internal hostnames
        internal_hostnames = ["localhost", "metadata.google.internal"]
        if hostname.lower() in internal_hostnames:
            return False, "Access to internal hosts is not allowed"

        try:
            # Try to parse as IP address first
            ip = ipaddress.ip_address(hostname)
        except ValueError:
            # It's a hostname, resolve it
            try:
                resolved = socket.gethostbyname(hostname)
                ip = ipaddress.ip_address(resolved)
            except socket.gaierror:
                return False, f"Could not resolve hostname: {hostname}"

        # Check against blocked networks
        for network_str in self.BLOCKED_NETWORKS:
            try:
                network = ipaddress.ip_network(network_str)
                if ip in network:
                    return False, "Access to private/internal networks is not allowed"
            except ValueError:
                continue

        return True, ""

    def get(self, request, source_id):
        """Proxy WMS GET request to upstream server."""
        try:
            source = WMSSource.objects.get(id=source_id, is_active=True)
        except WMSSource.DoesNotExist:
            return Response(
                {"error": "WMS source not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # SSRF protection: validate URL is not targeting internal networks
        is_safe, error_msg = self._is_url_safe(source.url)
        if not is_safe:
            return Response(
                {"error": error_msg},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Parse the WMS URL to extract base URL and preserved params (like MAP)
        from urllib.parse import parse_qs, urlparse, urlunparse

        parsed_url = urlparse(source.url)
        base_url = urlunparse(
            (
                parsed_url.scheme,
                parsed_url.netloc,
                parsed_url.path,
                "",  # params
                "",  # query - will be added via params dict
                "",  # fragment
            )
        )

        # Extract allowed params from the original URL (e.g., MAP for QGIS Server)
        # Normalize keys to uppercase for case-insensitive merging
        original_params = {
            k.upper(): v[0] if len(v) == 1 else v
            for k, v in parse_qs(parsed_url.query).items()
            if k.lower() in self.ALLOWED_WMS_PARAMS
        }

        # Filter incoming request params to allowed WMS parameters only
        # and remove our auth token. Normalize keys to uppercase.
        params = {
            k.upper(): v
            for k, v in request.query_params.dict().items()
            if k.lower() in self.ALLOWED_WMS_PARAMS
        }

        # Merge: original URL params first, then request params override
        params = {**original_params, **params}

        auth = None
        if source.username and source.password:
            auth = (source.username, source.password)

        try:
            upstream_response = requests.get(
                base_url,
                params=params,
                auth=auth,
                timeout=30,
                stream=True,
            )
        except requests.RequestException as e:
            logger.error(
                f"WMS proxy upstream request failed for source {source_id}: {e}",
                extra={
                    "wms_source_id": str(source_id),
                    "upstream_url": base_url,
                    "params": params,
                },
            )
            return Response(
                {"error": f"Upstream request failed: {e}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # Log non-2xx responses from upstream
        if not upstream_response.ok:
            logger.warning(
                f"WMS proxy received non-2xx from upstream: {upstream_response.status_code}",
                extra={
                    "wms_source_id": str(source_id),
                    "upstream_url": base_url,
                    "upstream_status": upstream_response.status_code,
                    "params": params,
                },
            )

        # Check response size limit
        content_length = upstream_response.headers.get("Content-Length")
        if content_length and int(content_length) > self.MAX_RESPONSE_SIZE:
            upstream_response.close()
            return Response(
                {"error": "Response too large"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # Use streaming response for efficiency
        def iter_content():
            total_size = 0
            for chunk in upstream_response.iter_content(chunk_size=8192):
                total_size += len(chunk)
                if total_size > self.MAX_RESPONSE_SIZE:
                    upstream_response.close()
                    return
                yield chunk

        return StreamingHttpResponse(
            iter_content(),
            status=upstream_response.status_code,
            content_type=upstream_response.headers.get(
                "Content-Type", "application/octet-stream"
            ),
        )


class DashboardStatisticsView(APIView):
    """Consolidated endpoint for all dashboard statistics.

    Returns all dashboard data in a single request, reducing HTTP overhead
    from 16 separate API calls to 1. Includes caching for improved performance.
    """

    permission_classes = [IsAuthenticated]
    CACHE_TIMEOUT = 300  # 5 minutes

    def get(self, request):
        project_id = request.query_params.get("project")
        flag_id = request.query_params.get("flag")

        if not project_id:
            return Response(
                {"error": "project parameter is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Build cache key
        cache_key = f"dashboard_stats_{project_id}_{flag_id or 'all'}"

        # Try to get from cache
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return Response(cached_data)

        # Compute all statistics
        result = {
            "trench": self._get_trench_statistics(project_id, flag_id),
            "node": self._get_node_statistics(project_id, flag_id),
            "address": self._get_address_statistics(project_id, flag_id),
            "conduit": self._get_conduit_statistics(project_id, flag_id),
            "area": self._get_area_statistics(project_id, flag_id),
        }

        # Cache the result
        cache.set(cache_key, result, self.CACHE_TIMEOUT)

        return Response(result)

    def _get_trench_statistics(self, project_id, flag_id):
        """Gather all trench-related statistics."""
        base_queryset = Trench.objects.all()
        if project_id:
            base_queryset = base_queryset.filter(project=project_id)
        if flag_id:
            base_queryset = base_queryset.filter(flag=flag_id)

        # Total length and count
        totals = base_queryset.aggregate(
            total_length=Sum("length"),
            count=Count("uuid"),
        )

        # Average house connection length
        house_connection_qs = base_queryset.filter(house_connection=True)
        avg_house_connection = house_connection_qs.aggregate(
            average_length=Avg("length"),
            count=Count("uuid"),
        )

        # Length with funding
        funding_qs = base_queryset.filter(funding_status=True)
        length_with_funding = funding_qs.aggregate(
            total_length=Sum("length"),
            count=Count("uuid"),
        )

        # Length with internal execution
        internal_qs = base_queryset.filter(internal_execution=True)
        length_with_internal = internal_qs.aggregate(
            total_length=Sum("length"),
            count=Count("uuid"),
        )

        # Length by types (construction type + surface)
        length_by_types = list(
            base_queryset.annotate(
                bauweise=F("construction_type__construction_type"),
                oberfläche=F("surface__surface"),
            )
            .values("bauweise", "oberfläche")
            .annotate(gesamt_länge=Sum("length"))
            .order_by("bauweise", "oberfläche")
        )

        # Length by status
        length_by_status = list(
            base_queryset.annotate(status_name=F("status__status"))
            .values("status_name")
            .annotate(gesamt_länge=Sum("length"))
            .order_by("status_name")
        )

        # Length by phase (network level)
        length_by_phase = list(
            base_queryset.annotate(network_level=F("phase__phase"))
            .values("network_level")
            .annotate(gesamt_länge=Sum("length"))
            .order_by("network_level")
        )

        # Longest routes
        longest_routes = list(
            base_queryset.annotate(
                construction_type_name=F("construction_type__construction_type"),
                surface_name=F("surface__surface"),
            )
            .values("id_trench", "length", "construction_type_name", "surface_name")
            .order_by("-length")[:5]
        )

        return {
            "total_length": totals["total_length"] or 0,
            "count": totals["count"] or 0,
            "average_house_connection_length": avg_house_connection["average_length"] or 0,
            "house_connection_count": avg_house_connection["count"] or 0,
            "length_with_funding": length_with_funding["total_length"] or 0,
            "funding_count": length_with_funding["count"] or 0,
            "length_with_internal_execution": length_with_internal["total_length"] or 0,
            "internal_execution_count": length_with_internal["count"] or 0,
            "length_by_types": length_by_types,
            "length_by_status": length_by_status,
            "length_by_phase": length_by_phase,
            "longest_routes": longest_routes,
        }

    def _get_node_statistics(self, project_id, flag_id):
        """Gather all node-related statistics."""
        base_queryset = Node.objects.all()
        if project_id:
            base_queryset = base_queryset.filter(project=project_id)
        if flag_id:
            base_queryset = base_queryset.filter(flag=flag_id)

        # Count by type
        count_by_type = list(
            base_queryset.values("node_type__node_type")
            .annotate(count=Count("node_type"))
            .order_by("node_type__node_type")
        )
        count_by_type = [
            {"node_type": row["node_type__node_type"], "count": row["count"]}
            for row in count_by_type
        ]

        # Count by city
        city_qs = base_queryset.filter(uuid_address__isnull=False)
        count_by_city = list(
            city_qs.values("uuid_address__city")
            .annotate(count=Count("uuid"))
            .order_by("-count")
        )
        count_by_city = [
            {"city": row["uuid_address__city"], "count": row["count"]}
            for row in count_by_city
            if row["uuid_address__city"]
        ]

        # Count by status
        count_by_status = list(
            base_queryset.values("status__status")
            .annotate(count=Count("uuid"))
            .order_by("-count")
        )
        count_by_status = [
            {"status": row["status__status"], "count": row["count"]}
            for row in count_by_status
            if row["status__status"]
        ]

        # Count by network level
        count_by_network_level = list(
            base_queryset.values("network_level__network_level")
            .annotate(count=Count("uuid"))
            .order_by("-count")
        )
        count_by_network_level = [
            {"network_level": row["network_level__network_level"], "count": row["count"]}
            for row in count_by_network_level
            if row["network_level__network_level"]
        ]

        # Count by owner
        owner_qs = base_queryset.filter(owner__isnull=False)
        count_by_owner = list(
            owner_qs.values("owner__company")
            .annotate(count=Count("uuid"))
            .order_by("-count")
        )
        count_by_owner = [
            {"owner": row["owner__company"], "count": row["count"]}
            for row in count_by_owner
            if row["owner__company"]
        ]

        # Expiring warranties
        warranty_qs = base_queryset.filter(
            warranty__isnull=False, warranty__gte=date.today()
        ).select_related("node_type").order_by("warranty")[:5]
        expiring_warranties = []
        for node in warranty_qs:
            days_until_expiry = (node.warranty - date.today()).days
            expiring_warranties.append({
                "id": node.uuid,
                "name": node.name,
                "warranty": node.warranty.strftime("%Y-%m-%d"),
                "node_type": node.node_type.node_type if node.node_type else None,
                "days_until_expiry": days_until_expiry,
            })

        # Newest and oldest nodes
        date_qs = base_queryset.filter(date__isnull=False).select_related("node_type")
        newest = list(date_qs.order_by("-date")[:5])
        oldest = list(date_qs.order_by("date")[:5])

        def node_to_dict(node):
            return {
                "id": node.uuid,
                "name": node.name,
                "date": node.date.strftime("%Y-%m-%d") if node.date else None,
                "node_type": node.node_type.node_type if node.node_type else None,
            }

        return {
            "count_by_type": count_by_type,
            "count_by_city": count_by_city,
            "count_by_status": count_by_status,
            "count_by_network_level": count_by_network_level,
            "count_by_owner": count_by_owner,
            "expiring_warranties": expiring_warranties,
            "newest_nodes": [node_to_dict(n) for n in newest],
            "oldest_nodes": [node_to_dict(n) for n in oldest],
        }

    def _get_address_statistics(self, project_id, flag_id):
        """Gather all address and residential unit statistics."""
        base_queryset = Address.objects.all()
        if project_id:
            base_queryset = base_queryset.filter(project=project_id)
        if flag_id:
            base_queryset = base_queryset.filter(flag=flag_id)

        # Count addresses by city
        count_by_city = list(
            base_queryset.values("city")
            .annotate(count=Count("uuid"))
            .order_by("-count")
        )
        count_by_city = [
            {"city": row["city"], "count": row["count"]}
            for row in count_by_city
            if row["city"]
        ]

        # Count by development status (Ausbaustatus)
        count_by_status = list(
            base_queryset.values("status_development__status")
            .annotate(count=Count("uuid"))
            .order_by("-count")
        )
        count_by_status = [
            {"status": row["status_development__status"], "count": row["count"]}
            for row in count_by_status
            if row["status_development__status"]
        ]

        # Residential unit statistics
        unit_queryset = ResidentialUnit.objects.filter(uuid_address__in=base_queryset)

        # Count residential units by city (through address)
        units_by_city = list(
            unit_queryset.values("uuid_address__city")
            .annotate(count=Count("uuid"))
            .order_by("-count")
        )
        units_by_city = [
            {"city": row["uuid_address__city"], "count": row["count"]}
            for row in units_by_city
            if row["uuid_address__city"]
        ]

        # Count residential units by type
        units_by_type = list(
            unit_queryset.values("residential_unit_type__residential_unit_type")
            .annotate(count=Count("uuid"))
            .order_by("-count")
        )
        units_by_type = [
            {"type": row["residential_unit_type__residential_unit_type"], "count": row["count"]}
            for row in units_by_type
            if row["residential_unit_type__residential_unit_type"]
        ]

        return {
            "count_by_city": count_by_city,
            "count_by_status": count_by_status,
            "units_by_city": units_by_city,
            "units_by_type": units_by_type,
            "total_addresses": base_queryset.count(),
            "total_units": unit_queryset.count(),
        }

    def _get_conduit_statistics(self, project_id, flag_id):
        """Gather all conduit-related statistics."""
        base_queryset = Conduit.objects.all()
        if project_id:
            base_queryset = base_queryset.filter(project=project_id)
        if flag_id:
            base_queryset = base_queryset.filter(flag=flag_id)

        # Path to trench length via TrenchConduitConnection
        trench_length_path = "trenchconduitconnection__uuid_trench__length"

        # Total length and count
        totals = base_queryset.aggregate(
            total_length=Sum(trench_length_path),
            count=Count("uuid", distinct=True),
        )

        # Length by type
        length_by_type = list(
            base_queryset.values(type_name=F("conduit_type__conduit_type"))
            .annotate(total=Sum(trench_length_path))
            .order_by("-total")
        )
        length_by_type = [
            {"type_name": row["type_name"], "total": row["total"] or 0}
            for row in length_by_type
            if row["type_name"]
        ]

        # Length by status with type breakdown (for stacked bar)
        length_by_status_type = list(
            base_queryset.values(
                status_name=F("status__status"),
                type_name=F("conduit_type__conduit_type"),
            )
            .annotate(total=Sum(trench_length_path))
            .order_by("status_name", "type_name")
        )
        length_by_status_type = [
            {
                "status_name": row["status_name"],
                "type_name": row["type_name"],
                "total": row["total"] or 0,
            }
            for row in length_by_status_type
            if row["status_name"] and row["type_name"]
        ]

        # Length by network level
        length_by_network_level = list(
            base_queryset.values(network_level_name=F("network_level__network_level"))
            .annotate(total=Sum(trench_length_path))
            .order_by("-total")
        )
        length_by_network_level = [
            {"network_level": row["network_level_name"], "total": row["total"] or 0}
            for row in length_by_network_level
            if row["network_level_name"]
        ]

        # Average length per type
        # First get total length and count per type, then calculate average
        type_stats = list(
            base_queryset.values(type_name=F("conduit_type__conduit_type"))
            .annotate(
                total_length=Sum(trench_length_path),
                conduit_count=Count("uuid", distinct=True),
            )
            .order_by("-total_length")
        )
        avg_length_by_type = [
            {
                "type_name": row["type_name"],
                "avg_length": (row["total_length"] / row["conduit_count"]) if row["conduit_count"] else 0,
            }
            for row in type_stats
            if row["type_name"] and row["total_length"]
        ]
        avg_length_by_type.sort(key=lambda x: x["avg_length"], reverse=True)

        # Count by status
        count_by_status = list(
            base_queryset.values(status_name=F("status__status"))
            .annotate(count=Count("uuid"))
            .order_by("-count")
        )
        count_by_status = [
            {"status_name": row["status_name"], "count": row["count"]}
            for row in count_by_status
            if row["status_name"]
        ]

        # Length by owner
        length_by_owner = list(
            base_queryset.filter(owner__isnull=False)
            .values(owner_name=F("owner__company"))
            .annotate(total=Sum(trench_length_path))
            .order_by("-total")
        )
        length_by_owner = [
            {"owner_name": row["owner_name"], "total": row["total"] or 0}
            for row in length_by_owner
            if row["owner_name"]
        ]

        # Length by manufacturer
        length_by_manufacturer = list(
            base_queryset.filter(manufacturer__isnull=False)
            .values(manufacturer_name=F("manufacturer__company"))
            .annotate(total=Sum(trench_length_path))
            .order_by("-total")
        )
        length_by_manufacturer = [
            {"manufacturer_name": row["manufacturer_name"], "total": row["total"] or 0}
            for row in length_by_manufacturer
            if row["manufacturer_name"]
        ]

        # Conduits by date (monthly)
        conduits_by_month = list(
            base_queryset.filter(date__isnull=False)
            .annotate(month=TruncMonth("date"))
            .values("month")
            .annotate(count=Count("uuid"))
            .order_by("month")
        )
        conduits_by_month = [
            {"month": row["month"].strftime("%Y-%m") if row["month"] else None, "count": row["count"]}
            for row in conduits_by_month
            if row["month"]
        ]

        # Top 5 longest conduits
        longest_conduits = list(
            base_queryset.annotate(
                total_length=Sum(trench_length_path),
                type_name=F("conduit_type__conduit_type"),
            )
            .filter(total_length__isnull=False)
            .values("name", "type_name", "total_length")
            .order_by("-total_length")[:5]
        )
        longest_conduits = [
            {
                "name": row["name"],
                "type_name": row["type_name"],
                "total_length": row["total_length"] or 0,
            }
            for row in longest_conduits
            if row["total_length"]
        ]

        return {
            "total_length": totals["total_length"] or 0,
            "count": totals["count"] or 0,
            "length_by_type": length_by_type,
            "length_by_status_type": length_by_status_type,
            "length_by_network_level": length_by_network_level,
            "avg_length_by_type": avg_length_by_type,
            "count_by_status": count_by_status,
            "length_by_owner": length_by_owner,
            "length_by_manufacturer": length_by_manufacturer,
            "conduits_by_month": conduits_by_month,
            "longest_conduits": longest_conduits,
        }

    def _get_area_statistics(self, project_id, flag_id):
        """Gather all area-related statistics with spatial analysis."""
        from django.contrib.gis.db.models.functions import Area as GISArea, Intersection, Length
        from django.contrib.gis.db.models.aggregates import Collect

        base_queryset = Area.objects.filter(project_id=project_id)
        if flag_id:
            base_queryset = base_queryset.filter(flag_id=flag_id)

        # 1. Basic area statistics
        area_count = base_queryset.count()

        # Total coverage in km²
        total_coverage = base_queryset.annotate(area_m2=GISArea("geom")).aggregate(
            total=Sum("area_m2")
        )["total"]

        # Areas by type
        areas_by_type = list(
            base_queryset.values(type_name=F("area_type__area_type"))
            .annotate(count=Count("uuid"), total_area=Sum(GISArea("geom")))
            .order_by("-count")
        )
        areas_by_type = [
            {
                "type_name": row["type_name"],
                "count": row["count"],
                "total_area_km2": row["total_area"].sq_km if row["total_area"] else 0,
            }
            for row in areas_by_type
        ]

        # 2. Coverage gap metrics - addresses/nodes NOT in any area
        address_qs = Address.objects.filter(project_id=project_id)
        node_qs = Node.objects.filter(project_id=project_id)
        if flag_id:
            address_qs = address_qs.filter(flag_id=flag_id)
            node_qs = node_qs.filter(flag_id=flag_id)

        total_addresses = address_qs.count()
        total_nodes = node_qs.count()
        total_residential_units = ResidentialUnit.objects.filter(
            uuid_address__project_id=project_id
        ).count()

        # Collect all area geometries into union
        all_areas_geom = base_queryset.aggregate(union=Collect("geom"))["union"]

        addresses_in_areas = 0
        nodes_in_areas = 0
        residential_units_in_areas = 0
        if all_areas_geom:
            addresses_in_areas = address_qs.filter(geom__within=all_areas_geom).count()
            nodes_in_areas = node_qs.filter(geom__within=all_areas_geom).count()
            address_ids_in_areas = list(
                address_qs.filter(geom__within=all_areas_geom).values_list("uuid", flat=True)
            )
            residential_units_in_areas = ResidentialUnit.objects.filter(
                uuid_address_id__in=address_ids_in_areas
            ).count()

        # 3. Addresses per area (exclude empty)
        addresses_per_area = []
        for area in base_queryset.annotate(area_m2=GISArea("geom")).select_related("area_type"):
            addr_count = address_qs.filter(geom__within=area.geom).count()
            if addr_count > 0:
                addresses_per_area.append(
                    {
                        "name": area.name,
                        "type": area.area_type.area_type if area.area_type else None,
                        "count": addr_count,
                        "area_km2": area.area_m2.sq_km if area.area_m2 else 0,
                    }
                )

        # Addresses by area type
        addresses_by_area_type = []
        for area_type in AttributesAreaType.objects.all():
            areas_of_type = base_queryset.filter(area_type=area_type)
            combined_geom = areas_of_type.aggregate(union=Collect("geom"))["union"]
            if combined_geom:
                count = address_qs.filter(geom__within=combined_geom).count()
                if count > 0:
                    addresses_by_area_type.append({"type": area_type.area_type, "count": count})

        # 4. Nodes per area (exclude empty)
        nodes_per_area = []
        for area in base_queryset.select_related("area_type"):
            node_count = node_qs.filter(geom__within=area.geom).count()
            if node_count > 0:
                nodes_per_area.append({"name": area.name, "count": node_count})

        # Nodes by area type
        nodes_by_area_type = []
        for area_type in AttributesAreaType.objects.all():
            areas_of_type = base_queryset.filter(area_type=area_type)
            combined_geom = areas_of_type.aggregate(union=Collect("geom"))["union"]
            if combined_geom:
                count = node_qs.filter(geom__within=combined_geom).count()
                if count > 0:
                    nodes_by_area_type.append({"type": area_type.area_type, "count": count})

        # 5. Trench length per area (clipped to boundary, exclude empty)
        trench_qs = Trench.objects.filter(project_id=project_id)
        if flag_id:
            trench_qs = trench_qs.filter(flag_id=flag_id)

        trench_length_per_area = []
        for area in base_queryset.annotate(area_m2=GISArea("geom")):
            intersecting = trench_qs.filter(geom__intersects=area.geom)
            total_length = intersecting.annotate(
                clipped_length=Length(Intersection("geom", area.geom))
            ).aggregate(total=Sum("clipped_length"))["total"]

            if total_length and total_length.m > 0:
                area_km2 = area.area_m2.sq_km if area.area_m2 else 0
                trench_length_per_area.append(
                    {
                        "name": area.name,
                        "length_m": total_length.m,
                        "area_km2": area_km2,
                        "density": (total_length.m / 1000) / area_km2 if area_km2 > 0 else 0,
                    }
                )

        # 6. Residential units by area type
        residential_by_area_type = []
        for area_type in AttributesAreaType.objects.all():
            areas_of_type = base_queryset.filter(area_type=area_type)
            combined_geom = areas_of_type.aggregate(union=Collect("geom"))["union"]
            if combined_geom:
                addr_ids = list(
                    address_qs.filter(geom__within=combined_geom).values_list("uuid", flat=True)
                )
                count = ResidentialUnit.objects.filter(uuid_address_id__in=addr_ids).count()
                if count > 0:
                    residential_by_area_type.append({"type": area_type.area_type, "count": count})

        return {
            "area_count": area_count,
            "total_coverage_km2": total_coverage.sq_km if total_coverage else 0,
            "areas_by_type": areas_by_type,
            # Coverage gap
            "total_addresses": total_addresses,
            "addresses_in_areas": addresses_in_areas,
            "total_nodes": total_nodes,
            "nodes_in_areas": nodes_in_areas,
            "total_residential_units": total_residential_units,
            "residential_units_in_areas": residential_units_in_areas,
            # Per-area stats (top 10, empty excluded)
            "addresses_per_area": sorted(
                addresses_per_area, key=lambda x: x["count"], reverse=True
            )[:10],
            "addresses_by_area_type": addresses_by_area_type,
            "nodes_per_area": sorted(nodes_per_area, key=lambda x: x["count"], reverse=True)[:10],
            "nodes_by_area_type": nodes_by_area_type,
            "trench_length_per_area": sorted(
                trench_length_per_area, key=lambda x: x["length_m"], reverse=True
            )[:10],
            "residential_by_area_type": residential_by_area_type,
        }
