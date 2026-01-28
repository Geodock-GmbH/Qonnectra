from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer, GeometryField

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
    AttributesPhase,
    AttributesStatus,
    AttributesStatusDevelopment,
    AttributesSurface,
    Cable,
    CableLabel,
    CableTypeColorMapping,
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
    Node,
    NodeSlotClipNumber,
    NodeSlotConfiguration,
    NodeSlotDivider,
    NodeStructure,
    NodeTrenchSelection,
    OlAddress,
    OlArea,
    OlNode,
    OlTrench,
    Projects,
    Trench,
    TrenchConduitConnection,
)


class ProjectsSerializer(serializers.ModelSerializer):
    """Serializer for the Projects model."""

    class Meta:
        model = Projects
        fields = ["id", "project", "description", "active"]


class ContentTypeSerializer(serializers.ModelSerializer):
    """Serializer for Django ContentType model."""

    class Meta:
        model = ContentType
        fields = ["id", "app_label", "model"]
        read_only_fields = ["id", "app_label", "model"]


class FlagsSerializer(serializers.ModelSerializer):
    """Serializer for the Flags model."""

    class Meta:
        model = Flags
        fields = ["id", "flag"]


class AttributesSurfaceSerializer(serializers.ModelSerializer):
    """Serializer for the AttributesSurface model."""

    class Meta:
        model = AttributesSurface
        fields = ["id", "surface", "sealing"]


class AttributesConstructionTypeSerializer(serializers.ModelSerializer):
    """Serializer for the AttributesConstructionType model."""

    class Meta:
        model = AttributesConstructionType
        fields = ["id", "construction_type"]


class AttributesStatusSerializer(serializers.ModelSerializer):
    """Serializer for the AttributesStatus model."""

    class Meta:
        model = AttributesStatus
        fields = ["id", "status"]


class AttributesPhaseSerializer(serializers.ModelSerializer):
    """Serializer for the AttributesPhase model."""

    class Meta:
        model = AttributesPhase
        fields = ["id", "phase"]


class AttributesCompanySerializer(serializers.ModelSerializer):
    """Serializer for the AttributesCompany model."""

    class Meta:
        model = AttributesCompany
        fields = [
            "id",
            "company",
            "city",
            "postal_code",
            "street",
            "housenumber",
            "phone",
            "email",
        ]


class AttributesNodeTypeSerializer(serializers.ModelSerializer):
    """Serializer for the AttributesNodeType model."""

    class Meta:
        model = AttributesNodeType
        fields = ["id", "node_type", "dimension", "group", "company"]
        ordering = ["node_type"]


class AttributesConduitTypeSerializer(serializers.ModelSerializer):
    """Serializer for the AttributesConduitType model."""

    class Meta:
        model = AttributesConduitType
        fields = [
            "id",
            "conduit_type",
            "conduit_count",
            "conduit_type_alias",
            "conduit_type_microduct",
        ]


class AttributesNetworkLevelSerializer(serializers.ModelSerializer):
    """Serializer for the AttributesNetworkLevel model."""

    class Meta:
        model = AttributesNetworkLevel
        fields = ["id", "network_level"]


class AttributesStatusDevelopmentSerializer(serializers.ModelSerializer):
    """Serializer for the AttributesStatusDevelopment model."""

    class Meta:
        model = AttributesStatusDevelopment
        fields = ["id", "status"]


class AttributesMicroductStatusSerializer(serializers.ModelSerializer):
    """Serializer for the AttributesMicroductStatus model."""

    class Meta:
        model = AttributesMicroductStatus
        fields = ["id", "microduct_status"]


class AttributesMicroductColorSerializer(serializers.ModelSerializer):
    """Serializer for the AttributesMicroductColor model."""

    class Meta:
        model = AttributesMicroductColor
        fields = [
            "id",
            "name_de",
            "name_en",
            "hex_code",
            "hex_code_secondary",
            "display_order",
            "is_active",
            "description",
            "is_two_layer",
        ]
        read_only_fields = ["is_two_layer"]


class AttributesFiberColorSerializer(serializers.ModelSerializer):
    """Serializer for the AttributesFiberColor model."""

    class Meta:
        model = AttributesFiberColor
        fields = [
            "id",
            "name_de",
            "name_en",
            "hex_code",
            "hex_code_secondary",
            "display_order",
            "is_active",
            "description",
        ]


class CableTypeColorMappingSerializer(serializers.ModelSerializer):
    """Serializer for the CableTypeColorMapping model."""

    color = AttributesFiberColorSerializer(read_only=True)

    class Meta:
        model = CableTypeColorMapping
        fields = ["uuid", "cable_type", "position_type", "position", "color", "layer"]


class AttributesCableTypeSerializer(serializers.ModelSerializer):
    """Serializer for the AttributesCableType model."""

    class Meta:
        model = AttributesCableType
        fields = ["id", "cable_type"]


class AttributesAreaTypeSerializer(serializers.ModelSerializer):
    """Serializer for the AttributesAreaType model."""

    class Meta:
        model = AttributesAreaType
        fields = ["id", "area_type"]


class AttributesComponentTypeSerializer(serializers.ModelSerializer):
    """Serializer for the AttributesComponentType model."""

    class Meta:
        model = AttributesComponentType
        fields = ["id", "component_type", "occupied_slots", "manufacturer"]


class AttributesComponentStructureSerializer(serializers.ModelSerializer):
    """Serializer for the AttributesComponentStructure model."""

    class Meta:
        model = AttributesComponentStructure
        fields = ["id", "component_type", "in_or_out", "port", "port_alias"]


class TrenchSerializer(GeoFeatureModelSerializer):
    """Serializer for the Trench model.

    Args:
        GeoFeatureModelSerializer (GeoFeatureModelSerializer): The base serializer class.

    Raises:
        serializers.ValidationError: If the geometry is not a LineString.
        serializers.ValidationError: If the geometry cannot be transformed to the default SRID.

    Returns:
        dict: The serialized trench.
    """

    uuid = serializers.UUIDField(read_only=True)
    id_trench = serializers.IntegerField(read_only=True)
    house_connection = serializers.BooleanField(read_only=True)
    length = serializers.DecimalField(read_only=True, max_digits=12, decimal_places=4)

    surface = AttributesSurfaceSerializer(read_only=True)
    construction_type = AttributesConstructionTypeSerializer(read_only=True)
    status = AttributesStatusSerializer(read_only=True)
    phase = AttributesPhaseSerializer(read_only=True)
    owner = AttributesCompanySerializer(read_only=True)
    constructor = AttributesCompanySerializer(read_only=True)
    project = ProjectsSerializer(read_only=True)
    flag = FlagsSerializer(read_only=True)

    surface_value = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=AttributesSurface.objects.all(),
        source="surface",
    )
    construction_type_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=AttributesConstructionType.objects.all(),
        source="construction_type",
    )
    construction_depth = serializers.IntegerField(required=False)
    construction_details = serializers.CharField(required=False)
    status_id = serializers.PrimaryKeyRelatedField(
        queryset=AttributesStatus.objects.all(),
        required=False,
        write_only=True,
        source="status",
    )
    phase_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=AttributesPhase.objects.all(),
        source="phase",
        required=False,
    )
    internal_execution = serializers.BooleanField(required=False)
    funding_status = serializers.BooleanField(required=False)
    trench_owner = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=AttributesCompany.objects.all(),
        source="owner",
        required=False,
    )
    trench_company = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=AttributesCompany.objects.all(),
        source="company",
        required=False,
    )
    trench_constructor = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=AttributesCompany.objects.all(),
        source="constructor",
        required=False,
    )
    date = serializers.DateField(input_formats=["%Y/%m/%d"], format="%d.%m.%Y")
    comment = serializers.CharField(required=False)
    geom = GeometryField()
    project_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=Projects.objects.all(),
        source="project",
    )
    flag_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=Flags.objects.all(),
        source="flag",
    )

    class Meta:
        model = Trench
        geo_field = "geom"
        fields = "__all__"
        ordering = ["id"]

    def validate_geom(self, value):
        """Validate geometry before saving"""
        if value.geom_type != "LineString":
            raise serializers.ValidationError(
                f"{_('Geometry type must be LineString, not')} {value.geom_type}"
            )

        if value.srid != settings.DEFAULT_SRID:
            try:
                value.transform(settings.DEFAULT_SRID)
            except Exception as e:
                raise serializers.ValidationError(
                    f"{_('Could not transform coordinates to EPSG:')} {settings.DEFAULT_SRID}: {str(e)}"
                )

        return value

    def get_fields(self):
        """Dynamically translate choices in the browsable API form."""
        fields = super().get_fields()

        fields["surface_value"].label = _("Surface")
        fields["construction_type_id"].label = _("Construction Type")
        fields["status_id"].label = _("Status")
        fields["phase_id"].label = _("Phase")
        fields["trench_owner"].label = _("Owner")
        fields["trench_company"].label = _("Company")
        fields["trench_constructor"].label = _("Constructor")
        fields["construction_depth"].label = _("Construction Depth")
        fields["construction_details"].label = _("Construction Details")
        fields["internal_execution"].label = _("Internal Execution")
        fields["funding_status"].label = _("Funding Status")
        fields["date"].label = _("Date")
        fields["comment"].label = _("Comment")
        fields["geom"].label = _("Geometry")
        fields["project_id"].label = _("Project")
        fields["flag_id"].label = _("Flag")

        return fields


class FeatureFilesSerializer(serializers.ModelSerializer):
    """Serializer for the FeatureFiles model."""

    uuid = serializers.UUIDField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    file_name = serializers.CharField(read_only=True)
    file_type = serializers.CharField(read_only=True)

    class Meta:
        model = FeatureFiles
        fields = [
            "uuid",
            "object_id",
            "content_type",
            "file_path",
            "file_name",
            "file_type",
            "description",
            "created_at",
        ]

    def get_fields(self):
        """Dynamically translate field labels."""
        fields = super().get_fields()

        fields["content_type"].label = _("Feature Type")
        fields["object_id"].label = _("Feature ID")
        fields["file_path"].label = _("File Path")
        fields["file_name"].label = _("File Name")
        fields["file_type"].label = _("File Type")
        fields["description"].label = _("Description")
        fields["created_at"].label = _("Created At")

        return fields


class OlTrenchSerializer(GeoFeatureModelSerializer):
    """Serializer for the OlTrench model.

    Args:
        GeoFeatureModelSerializer (GeoFeatureModelSerializer): The base serializer class.
    """

    uuid = serializers.UUIDField(read_only=True)
    id_trench = serializers.IntegerField(read_only=True)
    house_connection = serializers.BooleanField(read_only=True)
    length = serializers.DecimalField(read_only=True, max_digits=12, decimal_places=4)

    surface = AttributesSurfaceSerializer(read_only=True)
    construction_type = AttributesConstructionTypeSerializer(read_only=True)
    status = AttributesStatusSerializer(read_only=True)
    phase = AttributesPhaseSerializer(read_only=True)
    owner = AttributesCompanySerializer(read_only=True)
    constructor = AttributesCompanySerializer(read_only=True)

    date = serializers.DateField(
        input_formats=["%Y/%m/%d"], format="%d.%m.%Y", read_only=True
    )
    construction_depth = serializers.IntegerField(read_only=True)
    construction_details = serializers.CharField(read_only=True)
    internal_execution = serializers.BooleanField(read_only=True)
    funding_status = serializers.BooleanField(read_only=True)
    comment = serializers.CharField(read_only=True)
    geom = GeometryField(read_only=True)
    project = ProjectsSerializer(read_only=True)
    flag = FlagsSerializer(read_only=True)

    class Meta:
        model = OlTrench
        geo_field = "geom"
        fields = "__all__"
        ordering = ["id_trench"]

    def get_fields(self):
        """Dynamically translate field labels."""
        fields = super().get_fields()

        fields["surface"].label = _("Surface")
        fields["construction_type"].label = _("Construction Type")
        fields["status"].label = _("Status")
        fields["phase"].label = _("Phase")
        fields["owner"].label = _("Owner")
        fields["constructor"].label = _("Constructor")
        fields["construction_depth"].label = _("Construction Depth")
        fields["construction_details"].label = _("Construction Details")
        fields["internal_execution"].label = _("Internal Execution")
        fields["funding_status"].label = _("Funding Status")
        fields["date"].label = _("Date")
        fields["comment"].label = _("Comment")
        fields["geom"].label = _("Geometry")
        fields["project"].label = _("Project")
        fields["flag"].label = _("Flag")
        return fields


class ConduitSerializer(serializers.ModelSerializer):
    """Serializer for the Conduit model."""

    uuid = serializers.UUIDField(read_only=True)

    conduit_type = AttributesConduitTypeSerializer(read_only=True)
    status = AttributesStatusSerializer(read_only=True)
    network_level = AttributesNetworkLevelSerializer(read_only=True)
    owner = AttributesCompanySerializer(read_only=True)
    constructor = AttributesCompanySerializer(read_only=True)
    manufacturer = AttributesCompanySerializer(read_only=True)
    project = ProjectsSerializer(read_only=True)
    flag = FlagsSerializer(read_only=True)

    name = serializers.CharField(
        required=True,
        label=_("Conduit Name"),
    )
    conduit_type_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=AttributesConduitType.objects.all(),
        source="conduit_type",
    )
    status_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=AttributesStatus.objects.all(),
        source="status",
        required=False,
    )
    network_level_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=AttributesNetworkLevel.objects.all(),
        source="network_level",
        required=False,
    )
    owner_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=AttributesCompany.objects.all(),
        source="owner",
        required=False,
    )
    constructor_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=AttributesCompany.objects.all(),
        source="constructor",
        required=False,
    )
    manufacturer_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=AttributesCompany.objects.all(),
        source="manufacturer",
        required=False,
    )
    project_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=Projects.objects.all(),
        source="project",
    )
    flag_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=Flags.objects.all(),
        source="flag",
    )
    outer_conduit = serializers.CharField(required=False, allow_blank=True)

    date = serializers.DateField(
        input_formats=["%Y-%m-%d"], format="%Y-%m-%d", required=False
    )

    class Meta:
        model = Conduit
        fields = "__all__"
        ordering = ["name"]
        validators = [
            serializers.UniqueTogetherValidator(
                queryset=Conduit.objects.all(),
                fields=["project", "name"],
                message=_("A conduit with that name already exists."),
            )
        ]

    def get_fields(self):
        """Dynamically translate field labels."""
        fields = super().get_fields()
        fields["conduit_type_id"].label = _("Conduit Type")
        fields["status_id"].label = _("Status")
        fields["network_level_id"].label = _("Network Level")
        fields["owner_id"].label = _("Owner")
        fields["constructor_id"].label = _("Constructor")
        fields["manufacturer_id"].label = _("Manufacturer")
        fields["project_id"].label = _("Project")
        fields["flag_id"].label = _("Flag")
        fields["outer_conduit"].label = _("Outer Conduit")

        return fields


class TrenchConduitSerializer(serializers.ModelSerializer):
    """Serializer for the TrenchConduit model."""

    uuid = serializers.UUIDField(read_only=True)

    trench = TrenchSerializer(read_only=True, source="uuid_trench")
    conduit = ConduitSerializer(read_only=True, source="uuid_conduit")

    class Meta:
        model = TrenchConduitConnection
        fields = "__all__"

    def get_fields(self):
        """Dynamically translate field labels."""
        fields = super().get_fields()

        fields["trench"].label = _("Trench")
        fields["conduit"].label = _("Conduit")

        return fields


class AddressSerializer(GeoFeatureModelSerializer):
    """Serializer for the Address model."""

    uuid = serializers.UUIDField(read_only=True)

    status_development = AttributesStatusDevelopmentSerializer(read_only=True)
    flag = FlagsSerializer(read_only=True)
    project = ProjectsSerializer(read_only=True)

    id_address = serializers.IntegerField(required=False)
    zip_code = serializers.CharField(required=True)
    city = serializers.CharField(required=True)
    district = serializers.CharField(required=False)
    street = serializers.CharField(required=True)
    housenumber = serializers.IntegerField(required=True)
    house_number_suffix = serializers.CharField(required=False)
    status_development_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=AttributesStatusDevelopment.objects.all(),
        source="status_development",
    )
    flag_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=Flags.objects.all(),
        source="flag",
    )
    project_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=Projects.objects.all(),
        source="project",
    )
    geom = GeometryField()

    class Meta:
        model = Address
        geo_field = "geom"
        fields = "__all__"
        ordering = ["street", "housenumber", "house_number_suffix"]

    def get_fields(self):
        """Dynamically translate field labels."""
        fields = super().get_fields()

        fields["id_address"].label = _("Address ID")
        fields["zip_code"].label = _("Zip Code")
        fields["city"].label = _("City")
        fields["district"].label = _("District")
        fields["street"].label = _("Street")
        fields["housenumber"].label = _("Housenumber")
        fields["house_number_suffix"].label = _("House Number Suffix")
        fields["status_development_id"].label = _("Status Development")
        fields["flag_id"].label = _("Flag")
        fields["project_id"].label = _("Project")
        fields["geom"].label = _("Geometry")

        return fields

    def validate_geom(self, value):
        """Validate geometry before saving"""
        if value.geom_type != "Point":
            raise serializers.ValidationError(
                f"{_('Geometry type must be Point, not')} {value.geom_type}"
            )

        if value.srid != settings.DEFAULT_SRID:
            try:
                value.transform(settings.DEFAULT_SRID)
            except Exception as e:
                raise serializers.ValidationError(
                    f"{_('Could not transform coordinates to EPSG:')} {settings.DEFAULT_SRID}: {str(e)}"
                )

        return value


class OlAddressSerializer(GeoFeatureModelSerializer):
    """Serializer for the OlAddress model.

    Args:
        GeoFeatureModelSerializer (GeoFeatureModelSerializer): The base serializer class.
    """

    uuid = serializers.UUIDField(read_only=True)

    flag = FlagsSerializer(read_only=True)
    project = ProjectsSerializer(read_only=True)
    status_development = AttributesStatusDevelopmentSerializer(read_only=True)
    id_address = serializers.IntegerField(read_only=True)
    zip_code = serializers.CharField(read_only=True)
    city = serializers.CharField(read_only=True)
    district = serializers.CharField(read_only=True)
    street = serializers.CharField(read_only=True)
    housenumber = serializers.IntegerField(read_only=True)
    house_number_suffix = serializers.CharField(read_only=True)
    geom = GeometryField(read_only=True)

    class Meta:
        model = OlAddress
        geo_field = "geom"
        fields = "__all__"
        ordering = ["street", "housenumber", "house_number_suffix"]

    def get_fields(self):
        """Dynamically translate field labels."""
        fields = super().get_fields()

        fields["flag"].label = _("Flag")
        fields["project"].label = _("Project")
        fields["status_development"].label = _("Status Development")
        fields["id_address"].label = _("Address ID")
        fields["zip_code"].label = _("Zip Code")
        fields["city"].label = _("City")
        fields["district"].label = _("District")
        fields["street"].label = _("Street")
        fields["housenumber"].label = _("Housenumber")
        fields["house_number_suffix"].label = _("House Number Suffix")
        fields["geom"].label = _("Geometry")

        return fields


class NodeSerializer(GeoFeatureModelSerializer):
    """Serializer for the Node model."""

    uuid = serializers.UUIDField(read_only=True)

    uuid_address = AddressSerializer(read_only=True)
    node_type = AttributesNodeTypeSerializer(read_only=True)
    status = AttributesStatusSerializer(read_only=True)
    network_level = AttributesNetworkLevelSerializer(read_only=True)
    owner = AttributesCompanySerializer(read_only=True)
    constructor = AttributesCompanySerializer(read_only=True)
    manufacturer = AttributesCompanySerializer(read_only=True)
    project = ProjectsSerializer(read_only=True)
    flag = FlagsSerializer(read_only=True)

    name = serializers.CharField(required=True, label=_("Node Name"))
    node_type_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=AttributesNodeType.objects.all(),
        source="node_type",
    )
    uuid_address_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=Address.objects.all(),
        source="uuid_address",
        required=False,
        allow_null=True,
    )
    status_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=AttributesStatus.objects.all(),
        source="status",
        required=False,
        allow_null=True,
    )
    network_level_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=AttributesNetworkLevel.objects.all(),
        source="network_level",
        required=False,
        allow_null=True,
    )
    owner_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=AttributesCompany.objects.all(),
        source="owner",
        required=False,
        allow_null=True,
    )
    constructor_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=AttributesCompany.objects.all(),
        source="constructor",
        required=False,
        allow_null=True,
    )
    manufacturer_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=AttributesCompany.objects.all(),
        source="manufacturer",
        required=False,
        allow_null=True,
    )
    warranty = serializers.DateField(
        required=False,
        input_formats=["%Y-%m-%d"],
        format="%Y-%m-%d",
        allow_null=True,
    )
    date = serializers.DateField(
        required=False,
        input_formats=["%Y-%m-%d"],
        format="%Y-%m-%d",
        allow_null=True,
    )
    geom = GeometryField()
    canvas_x = serializers.FloatField(required=False, allow_null=True)
    canvas_y = serializers.FloatField(required=False, allow_null=True)
    project_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=Projects.objects.all(),
        source="project",
    )
    flag_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=Flags.objects.all(),
        source="flag",
    )

    class Meta:
        model = Node
        geo_field = "geom"
        fields = "__all__"
        ordering = ["name"]

    def get_fields(self):
        """Dynamically translate field labels."""
        fields = super().get_fields()

        fields["name"].label = _("Node Name")
        fields["node_type_id"].label = _("Node Type")
        fields["uuid_address_id"].label = _("Address")
        fields["status_id"].label = _("Status")
        fields["network_level_id"].label = _("Network Level")
        fields["owner_id"].label = _("Owner")
        fields["constructor_id"].label = _("Constructor")
        fields["manufacturer_id"].label = _("Manufacturer")
        fields["warranty"].label = _("Warranty")
        fields["date"].label = _("Date")
        fields["geom"].label = _("Geometry")
        fields["canvas_x"].label = _("Canvas X")
        fields["canvas_y"].label = _("Canvas Y")
        fields["project_id"].label = _("Project")
        fields["flag_id"].label = _("Flag")

        return fields


class OlNodeSerializer(GeoFeatureModelSerializer):
    """Serializer for the OlNode model."""

    uuid = serializers.UUIDField(read_only=True)
    name = serializers.CharField(read_only=True)
    node_type = AttributesNodeTypeSerializer(read_only=True)
    uuid_address = OlAddressSerializer(read_only=True)
    status = AttributesStatusSerializer(read_only=True)
    network_level = AttributesNetworkLevelSerializer(read_only=True)
    owner = AttributesCompanySerializer(read_only=True)
    constructor = AttributesCompanySerializer(read_only=True)
    manufacturer = AttributesCompanySerializer(read_only=True)
    warranty = serializers.DateField(
        read_only=True, input_formats=["%Y-%m-%d"], format="%Y-%m-%d"
    )
    date = serializers.DateField(
        read_only=True, input_formats=["%Y-%m-%d"], format="%Y-%m-%d"
    )
    project = ProjectsSerializer(read_only=True)
    flag = FlagsSerializer(read_only=True)
    geom = GeometryField(read_only=True)

    class Meta:
        model = OlNode
        geo_field = "geom"
        fields = "__all__"
        ordering = ["name"]

    def get_fields(self):
        """Dynamically translate field labels."""
        fields = super().get_fields()

        fields["name"].label = _("Node Name")
        fields["node_type"].label = _("Node Type")
        fields["uuid_address"].label = _("Address")
        fields["status"].label = _("Status")
        fields["network_level"].label = _("Network Level")
        fields["owner"].label = _("Owner")
        fields["constructor"].label = _("Constructor")
        fields["manufacturer"].label = _("Manufacturer")
        fields["warranty"].label = _("Warranty")
        fields["date"].label = _("Date")
        fields["project"].label = _("Project")
        fields["flag"].label = _("Flag")
        fields["geom"].label = _("Geometry")

        return fields


class AreaSerializer(GeoFeatureModelSerializer):
    """Serializer for the Area model."""

    uuid = serializers.UUIDField(read_only=True)
    area_type = AttributesAreaTypeSerializer(read_only=True)
    flag = FlagsSerializer(read_only=True)
    project = ProjectsSerializer(read_only=True)
    area_type_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=AttributesAreaType.objects.all(),
        source="area_type",
    )
    flag_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=Flags.objects.all(),
        source="flag",
    )
    project_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=Projects.objects.all(),
        source="project",
    )
    geom = GeometryField()

    class Meta:
        model = Area
        geo_field = "geom"
        fields = "__all__"
        ordering = ["area_type"]

    def get_fields(self):
        """Dynamically translate field labels."""
        fields = super().get_fields()

        fields["area_type_id"].label = _("Area Type")
        fields["flag_id"].label = _("Flag")
        fields["project_id"].label = _("Project")
        fields["geom"].label = _("Geometry")

        return fields

    def validate_geom(self, value):
        """Validate geometry before saving"""
        if value.geom_type != "Polygon":
            raise serializers.ValidationError(
                f"{_('Geometry type must be Polygon, not')} {value.geom_type}"
            )

        if value.srid != settings.DEFAULT_SRID:
            try:
                value.transform(settings.DEFAULT_SRID)
            except Exception as e:
                raise serializers.ValidationError(
                    f"{_('Could not transform coordinates to EPSG:')} {settings.DEFAULT_SRID}: {str(e)}"
                )

        return value


class OlAreaSerializer(GeoFeatureModelSerializer):
    """Serializer for the OlArea model.

    Args:
        GeoFeatureModelSerializer (GeoFeatureModelSerializer): The base serializer class.
    """

    uuid = serializers.UUIDField(read_only=True)
    area_type = AttributesAreaTypeSerializer(read_only=True)
    flag = FlagsSerializer(read_only=True)
    project = ProjectsSerializer(read_only=True)
    geom = GeometryField(read_only=True)

    class Meta:
        model = OlArea
        geo_field = "geom"
        fields = "__all__"
        ordering = ["area_type"]

    def get_fields(self):
        """Dynamically translate field labels."""
        fields = super().get_fields()

        fields["area_type"].label = _("Area Type")
        fields["flag"].label = _("Flag")
        fields["project"].label = _("Project")
        fields["geom"].label = _("Geometry")

        return fields


class MicroductSerializer(serializers.ModelSerializer):
    """Serializer for the Microduct model."""

    uuid = serializers.UUIDField(read_only=True)

    uuid_conduit = ConduitSerializer(read_only=True)
    microduct_status = AttributesMicroductStatusSerializer(read_only=True)
    uuid_node = NodeSerializer(read_only=True)

    number = serializers.IntegerField(required=True)
    color = serializers.CharField(required=True)

    hex_code = serializers.SerializerMethodField(read_only=True)
    hex_code_secondary = serializers.SerializerMethodField(read_only=True)
    is_two_layer = serializers.SerializerMethodField(read_only=True)

    uuid_conduit_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=Conduit.objects.all(),
        source="uuid_conduit",
    )
    microduct_status_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=AttributesMicroductStatus.objects.all(),
        source="microduct_status",
        required=False,
    )
    uuid_node_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=Node.objects.all(),
        source="uuid_node",
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Microduct
        fields = "__all__"
        ordering = ["number"]

    def get_hex_code(self, obj):
        """Get primary hex code from AttributesMicroductColor."""
        if not obj.color:
            return "#64748b"

        color_name = obj.color.lower()
        if "-" in color_name:
            color_name = color_name.split("-")[0]

        try:
            color_obj = AttributesMicroductColor.objects.get(
                name_de__iexact=color_name, is_active=True
            )
            return color_obj.hex_code
        except AttributesMicroductColor.DoesNotExist:
            return "#64748b"

    def get_hex_code_secondary(self, obj):
        """Get secondary hex code for two-layer colors."""
        if not obj.color or "-" not in obj.color.lower():
            return None

        color_name = obj.color.lower().split("-")[1]

        try:
            color_obj = AttributesMicroductColor.objects.get(
                name_de__iexact=color_name, is_active=True
            )
            return color_obj.hex_code
        except AttributesMicroductColor.DoesNotExist:
            return None

    def get_is_two_layer(self, obj):
        """Check if this is a two-layer/striped color."""
        return "-" in obj.color.lower() if obj.color else False

    def validate_uuid_node_id(self, value):
        """Validate that the node has an address assigned."""
        if value and not value.uuid_address:
            raise serializers.ValidationError(_("This node has no address assigned"))
        return value

    def get_fields(self):
        """Dynamically translate field labels."""
        fields = super().get_fields()

        fields["number"].label = _("Number")
        fields["color"].label = _("Color")
        fields["uuid_conduit_id"].label = _("Conduit")
        fields["microduct_status_id"].label = _("Microduct Status")
        fields["uuid_node_id"].label = _("Node")

        return fields


class MicroductConnectionSerializer(serializers.ModelSerializer):
    """Serializer for the MicroductConnection model."""

    uuid = serializers.UUIDField(read_only=True)

    uuid_microduct_from = MicroductSerializer(read_only=True)
    uuid_trench_from = TrenchSerializer(read_only=True)
    uuid_microduct_to = MicroductSerializer(read_only=True)
    uuid_trench_to = TrenchSerializer(read_only=True)
    uuid_node = NodeSerializer(read_only=True)

    uuid_microduct_from_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=Microduct.objects.all(),
        source="uuid_microduct_from",
    )
    uuid_trench_from_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=Trench.objects.all(),
        source="uuid_trench_from",
    )
    uuid_microduct_to_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=Microduct.objects.all(),
        source="uuid_microduct_to",
    )
    uuid_trench_to_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=Trench.objects.all(),
        source="uuid_trench_to",
    )
    uuid_node_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=Node.objects.all(),
        source="uuid_node",
    )

    class Meta:
        model = MicroductConnection
        fields = "__all__"
        ordering = ["uuid_microduct_from", "uuid_microduct_to"]

    def get_fields(self):
        """Dynamically translate field labels."""
        fields = super().get_fields()

        fields["uuid_microduct_from_id"].label = _("Microduct From")
        fields["uuid_microduct_to_id"].label = _("Microduct To")
        fields["uuid_trench_from_id"].label = _("Trench From")
        fields["uuid_trench_to_id"].label = _("Trench To")
        fields["uuid_node_id"].label = _("Node")

        return fields


class CableSerializer(serializers.ModelSerializer):
    """Serializer for the Cable model."""

    uuid = serializers.UUIDField(required=False)
    cable_type = AttributesCableTypeSerializer(read_only=True)
    status = AttributesStatusSerializer(read_only=True)
    network_level = AttributesNetworkLevelSerializer(read_only=True)
    owner = AttributesCompanySerializer(read_only=True)
    constructor = AttributesCompanySerializer(read_only=True)
    manufacturer = AttributesCompanySerializer(read_only=True)
    project = ProjectsSerializer(read_only=True)
    flag = FlagsSerializer(read_only=True)

    name = serializers.CharField(
        required=True,
        label=_("Cable Name"),
    )
    cable_type_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=AttributesCableType.objects.all(),
        source="cable_type",
    )
    status_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        required=False,
        queryset=AttributesStatus.objects.all(),
        source="status",
    )
    network_level_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        required=False,
        queryset=AttributesNetworkLevel.objects.all(),
        source="network_level",
    )
    owner_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        required=False,
        queryset=AttributesCompany.objects.all(),
        source="owner",
    )
    constructor_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        required=False,
        queryset=AttributesCompany.objects.all(),
        source="constructor",
    )
    manufacturer_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        required=False,
        queryset=AttributesCompany.objects.all(),
        source="manufacturer",
    )
    date = serializers.DateField(
        input_formats=["%Y-%m-%d"], format="%Y-%m-%d", required=False
    )
    uuid_node_start_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        required=True,
        queryset=Node.objects.all(),
        source="uuid_node_start",
    )
    uuid_node_end_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        required=True,
        queryset=Node.objects.all(),
        source="uuid_node_end",
    )
    project_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        required=True,
        queryset=Projects.objects.all(),
        source="project",
    )
    flag_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        required=True,
        queryset=Flags.objects.all(),
        source="flag",
    )
    length = serializers.FloatField(required=False)
    length_total = serializers.FloatField(required=False)
    reserve_at_start = serializers.IntegerField(required=False)
    reserve_at_end = serializers.IntegerField(required=False)
    reserve_section = serializers.IntegerField(required=False)
    handle_start = serializers.CharField(
        required=True, allow_blank=True, allow_null=True
    )
    handle_end = serializers.CharField(required=True, allow_blank=True, allow_null=True)
    diagram_path = serializers.JSONField(required=False, allow_null=True)

    uuid_node_start_name = serializers.SerializerMethodField()
    uuid_node_end_name = serializers.SerializerMethodField()

    def get_uuid_node_start_name(self, obj):
        """Get the name of the start node."""
        return obj.uuid_node_start.name if obj.uuid_node_start else None

    def get_uuid_node_end_name(self, obj):
        """Get the name of the end node."""
        return obj.uuid_node_end.name if obj.uuid_node_end else None

    class Meta:
        model = Cable
        fields = "__all__"
        ordering = ["name"]
        validators = [
            serializers.UniqueTogetherValidator(
                queryset=Cable.objects.all(),
                fields=["project", "name"],
                message=_("A cable with that name already exists."),
            )
        ]
        extra_kwargs = {
            "uuid": {"required": False},
        }

    def get_fields(self):
        """Dynamically translate field labels."""
        fields = super().get_fields()

        fields["name"].label = _("Cable Name")
        fields["cable_type_id"].label = _("Cable Type")
        fields["status_id"].label = _("Status")
        fields["network_level_id"].label = _("Network Level")
        fields["owner_id"].label = _("Owner")
        fields["constructor_id"].label = _("Constructor")
        fields["manufacturer_id"].label = _("Manufacturer")
        fields["date"].label = _("Date")
        fields["uuid_node_start_id"].label = _("Node Start")
        fields["uuid_node_end_id"].label = _("Node End")
        fields["length"].label = _("Length")
        fields["length_total"].label = _("Length Total")
        fields["reserve_at_start"].label = _("Reserve At Start")
        fields["reserve_at_end"].label = _("Reserve At End")
        fields["reserve_section"].label = _("Reserve Section")
        fields["project_id"].label = _("Project")
        fields["flag_id"].label = _("Flag")

        return fields


class CableLabelSerializer(serializers.ModelSerializer):
    """Serializer for the CableLabel model."""

    uuid = serializers.UUIDField(required=False)
    cable_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=Cable.objects.all(),
        source="cable",
    )
    cable = CableSerializer(read_only=True)

    class Meta:
        model = CableLabel
        fields = "__all__"
        ordering = ["cable", "order"]

    def get_fields(self):
        """Dynamically translate field labels."""
        fields = super().get_fields()
        fields["cable_id"].label = _("Cable")
        fields["text"].label = _("Label Text")
        fields["position_x"].label = _("Position X")
        fields["position_y"].label = _("Position Y")
        fields["order"].label = _("Order")
        return fields


class MicroductCableConnectionSerializer(serializers.ModelSerializer):
    """Serializer for the MicroductCableConnection model."""

    uuid = serializers.UUIDField(read_only=True)

    uuid_microduct = MicroductSerializer(read_only=True)
    uuid_cable = CableSerializer(read_only=True)

    uuid_microduct_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=Microduct.objects.all(),
        source="uuid_microduct",
    )
    uuid_cable_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=Cable.objects.all(),
        source="uuid_cable",
    )

    class Meta:
        model = MicroductCableConnection
        fields = "__all__"
        ordering = ["uuid_microduct", "uuid_cable"]

    def get_fields(self):
        """Dynamically translate field labels."""
        fields = super().get_fields()

        fields["uuid_microduct_id"].label = _("Microduct")
        fields["uuid_cable_id"].label = _("Cable")

        return fields


class LogEntrySerializer(serializers.ModelSerializer):
    """Serializer for the LogEntry model."""

    username = serializers.CharField(
        source="user.username", read_only=True, allow_null=True
    )
    user_email = serializers.EmailField(
        source="user.email", read_only=True, allow_null=True
    )
    project = ProjectsSerializer(read_only=True)

    class Meta:
        model = LogEntry
        fields = [
            "uuid",
            "timestamp",
            "level",
            "logger_name",
            "message",
            "user",
            "username",
            "user_email",
            "source",
            "path",
            "extra_data",
            "project",
        ]
        read_only_fields = ["uuid", "timestamp"]


class CustomUserDetailsSerializer(serializers.Serializer):
    """
    Custom serializer for user details that includes the is_staff flag.
    This overrides the default dj-rest-auth user serializer.
    """

    pk = serializers.IntegerField(read_only=True)
    username = serializers.CharField(read_only=True)
    email = serializers.EmailField(read_only=True)
    first_name = serializers.CharField(read_only=True)
    last_name = serializers.CharField(read_only=True)
    is_staff = serializers.BooleanField(read_only=True)
    is_superuser = serializers.BooleanField(read_only=True)


class NodeTrenchSelectionSerializer(serializers.ModelSerializer):
    """Serializer for the NodeTrenchSelection model."""

    trench_id_trench = serializers.CharField(source="trench.id_trench", read_only=True)
    node_name = serializers.CharField(source="node.name", read_only=True)

    class Meta:
        model = NodeTrenchSelection
        fields = [
            "uuid",
            "node",
            "node_name",
            "trench",
            "trench_id_trench",
            "created_at",
        ]
        read_only_fields = ["uuid", "created_at"]


class NodeTrenchSelectionBulkSerializer(serializers.Serializer):
    """Serializer for bulk updating trench selections for a node."""

    node_uuid = serializers.UUIDField()
    trench_uuids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=True,
    )


class NodeSlotConfigurationSerializer(serializers.ModelSerializer):
    """Serializer for the NodeSlotConfiguration model."""

    uuid = serializers.UUIDField(read_only=True)

    uuid_node = NodeSerializer(read_only=True)

    uuid_node_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=Node.objects.all(),
        source="uuid_node",
    )
    side = serializers.CharField(required=True, max_length=50)
    total_slots = serializers.IntegerField(required=True)

    used_slots = serializers.SerializerMethodField(read_only=True)
    free_slots = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = NodeSlotConfiguration
        fields = "__all__"
        ordering = ["uuid_node", "side"]

    def get_used_slots(self, obj):
        """Calculate total used slots from NodeStructure entries."""
        structures = obj.structures.all()
        return sum(s.slot_end - s.slot_start + 1 for s in structures)

    def get_free_slots(self, obj):
        """Calculate remaining free slots."""
        return obj.total_slots - self.get_used_slots(obj)

    def get_fields(self):
        """Dynamically translate field labels."""
        fields = super().get_fields()

        fields["uuid_node_id"].label = _("Node")
        fields["side"].label = _("Side")
        fields["total_slots"].label = _("Total Slots")

        return fields


class NodeStructureSerializer(serializers.ModelSerializer):
    """Serializer for the NodeStructure model."""

    uuid = serializers.UUIDField(read_only=True)

    uuid_node = NodeSerializer(read_only=True)
    slot_configuration = NodeSlotConfigurationSerializer(read_only=True)
    component_type = AttributesComponentTypeSerializer(read_only=True)
    component_structure = AttributesComponentStructureSerializer(read_only=True)

    uuid_node_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=Node.objects.all(),
        source="uuid_node",
    )
    slot_configuration_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=NodeSlotConfiguration.objects.all(),
        source="slot_configuration",
    )
    component_type_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=AttributesComponentType.objects.all(),
        source="component_type",
        required=False,
        allow_null=True,
    )
    component_structure_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=AttributesComponentStructure.objects.all(),
        source="component_structure",
        required=False,
        allow_null=True,
    )
    slot_start = serializers.IntegerField(required=True)
    slot_end = serializers.IntegerField(required=True)
    clip_number = serializers.IntegerField(required=False, allow_null=True)
    purpose = serializers.ChoiceField(
        choices=NodeStructure.Purpose.choices,
        default=NodeStructure.Purpose.COMPONENT,
    )
    label = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    slot_count = serializers.SerializerMethodField(read_only=True)
    side_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = NodeStructure
        fields = "__all__"
        ordering = ["uuid_node", "slot_configuration", "slot_start"]

    def get_slot_count(self, obj):
        """Calculate the number of slots used by this structure."""
        return obj.slot_end - obj.slot_start + 1

    def get_side_name(self, obj):
        """Get the side name from the slot configuration."""
        return obj.slot_configuration.side if obj.slot_configuration else None

    def validate(self, data):
        """Validate that component_type is provided when purpose is 'component'.

        Note: component_structure is optional - it can be configured later.
        """
        purpose = data.get("purpose", NodeStructure.Purpose.COMPONENT)
        if purpose == NodeStructure.Purpose.COMPONENT:
            if not data.get("component_type"):
                raise serializers.ValidationError(
                    {
                        "component_type_id": _(
                            "Component type is required for component entries."
                        )
                    }
                )
        return data

    def get_fields(self):
        """Dynamically translate field labels."""
        fields = super().get_fields()

        fields["uuid_node_id"].label = _("Node")
        fields["slot_configuration_id"].label = _("Slot Configuration")
        fields["component_type_id"].label = _("Component Type")
        fields["component_structure_id"].label = _("Component Structure")
        fields["slot_start"].label = _("Slot Start")
        fields["slot_end"].label = _("Slot End")
        fields["clip_number"].label = _("Clip Number")
        fields["purpose"].label = _("Purpose")
        fields["label"].label = _("Label")

        return fields


class NodeSlotDividerSerializer(serializers.ModelSerializer):
    """Serializer for the NodeSlotDivider model."""

    uuid = serializers.UUIDField(read_only=True)
    slot_configuration_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=NodeSlotConfiguration.objects.all(),
        source="slot_configuration",
    )

    class Meta:
        model = NodeSlotDivider
        fields = ["uuid", "slot_configuration", "slot_configuration_id", "after_slot"]
        read_only_fields = ["uuid", "slot_configuration"]

    def validate(self, data):
        """Validate that after_slot is within valid range."""
        slot_config = data.get("slot_configuration")
        after_slot = data.get("after_slot")

        if slot_config and after_slot:
            if after_slot < 1 or after_slot >= slot_config.total_slots:
                raise serializers.ValidationError(
                    {
                        "after_slot": _(
                            "Divider position must be between 1 and total_slots - 1."
                        )
                    }
                )
        return data


class NodeSlotClipNumberSerializer(serializers.ModelSerializer):
    """Serializer for the NodeSlotClipNumber model."""

    uuid = serializers.UUIDField(read_only=True)
    slot_configuration_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=NodeSlotConfiguration.objects.all(),
        source="slot_configuration",
    )

    class Meta:
        model = NodeSlotClipNumber
        fields = [
            "uuid",
            "slot_configuration",
            "slot_configuration_id",
            "slot_number",
            "clip_number",
        ]
        read_only_fields = ["uuid", "slot_configuration"]

    def validate(self, data):
        """Validate that slot_number is within valid range."""
        slot_config = data.get("slot_configuration")
        slot_number = data.get("slot_number")

        if slot_config and slot_number:
            if slot_number < 1 or slot_number > slot_config.total_slots:
                raise serializers.ValidationError(
                    {"slot_number": _("Slot number must be between 1 and total_slots.")}
                )
        return data


class AttributesComponentStructureSerializer(serializers.ModelSerializer):
    """Serializer for AttributesComponentStructure (component ports)."""

    class Meta:
        model = AttributesComponentStructure
        fields = ["id", "component_type", "in_or_out", "port", "port_alias"]


class FiberSpliceSerializer(serializers.ModelSerializer):
    """Serializer for FiberSplice model."""

    # Include nested info for display
    fiber_a_details = serializers.SerializerMethodField()
    fiber_b_details = serializers.SerializerMethodField()
    merge_group_a_info = serializers.SerializerMethodField()
    merge_group_b_info = serializers.SerializerMethodField()

    class Meta:
        model = FiberSplice
        fields = [
            "uuid",
            "node_structure",
            "port_number",
            "fiber_a",
            "cable_a",
            "fiber_b",
            "cable_b",
            "fiber_a_details",
            "fiber_b_details",
            # Side-specific merge groups (independent merging per side)
            "merge_group_a",
            "merge_group_b",
            "merge_group_a_info",
            "merge_group_b_info",
            # Shared fiber fields (for merged port groups)
            "shared_fiber_a",
            "shared_cable_a",
            "shared_fiber_b",
            "shared_cable_b",
        ]

    def _get_fiber_details(self, fiber, cable):
        """Helper to get fiber details dict."""
        if not fiber:
            return None
        return {
            "uuid": str(fiber.uuid),
            "fiber_number": fiber.fiber_number_absolute,
            "fiber_color": fiber.fiber_color,
            "bundle_number": fiber.bundle_number,
            "bundle_color": fiber.bundle_color,
            "cable_uuid": str(cable.uuid) if cable else None,
            "cable_name": cable.name if cable else None,
        }

    def get_fiber_a_details(self, obj):
        """
        Get fiber A details.
        If port is merged on side A (has merge_group_a), use shared_fiber_a.
        """
        if obj.merge_group_a and obj.shared_fiber_a:
            return self._get_fiber_details(obj.shared_fiber_a, obj.shared_cable_a)
        return self._get_fiber_details(obj.fiber_a, obj.cable_a)

    def get_fiber_b_details(self, obj):
        """
        Get fiber B details.
        If port is merged on side B (has merge_group_b), use shared_fiber_b.
        """
        if obj.merge_group_b and obj.shared_fiber_b:
            return self._get_fiber_details(obj.shared_fiber_b, obj.shared_cable_b)
        return self._get_fiber_details(obj.fiber_b, obj.cable_b)

    def _get_merge_group_info(self, obj, side):
        """Get info about a merge group on a specific side."""
        merge_group = getattr(obj, f"merge_group_{side}")
        if not merge_group:
            return None

        # Get all port numbers in the same merge group
        siblings = list(
            FiberSplice.objects.filter(**{f"merge_group_{side}": merge_group})
            .values_list("port_number", flat=True)
            .order_by("port_number")
        )

        if not siblings:
            return None

        return {
            "merge_group_id": str(merge_group),
            "side": side,
            "port_numbers": siblings,
            "port_count": len(siblings),
            "port_range": f"{min(siblings)}-{max(siblings)}"
            if len(siblings) > 1
            else str(siblings[0]),
        }

    def get_merge_group_a_info(self, obj):
        """Get info about the merge group on side A."""
        return self._get_merge_group_info(obj, "a")

    def get_merge_group_b_info(self, obj):
        """Get info about the merge group on side B."""
        return self._get_merge_group_info(obj, "b")


class PortMergeSerializer(serializers.Serializer):
    """Serializer for port merge operations."""

    node_structure = serializers.UUIDField()
    port_numbers = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        min_length=2,
        help_text="List of port numbers to merge (minimum 2)",
    )
    side = serializers.ChoiceField(
        choices=["a", "b"],
        help_text="Which side to merge: 'a' (IN) or 'b' (OUT)",
    )


class PortUnmergeSerializer(serializers.Serializer):
    """Serializer for unmerging specific ports from a group."""

    merge_group = serializers.UUIDField()
    port_numbers = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        min_length=1,
        help_text="List of port numbers to unmerge from the group",
    )


class ContainerTypeSerializer(serializers.ModelSerializer):
    """Serializer for the ContainerType model (admin-defined types)."""

    class Meta:
        model = ContainerType
        fields = [
            "id",
            "name",
            "description",
            "icon",
            "color",
            "display_order",
            "is_active",
        ]


class ContainerSerializer(serializers.ModelSerializer):
    """Serializer for Container instances."""

    uuid = serializers.UUIDField(read_only=True)
    container_type = ContainerTypeSerializer(read_only=True)
    container_type_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=ContainerType.objects.filter(is_active=True),
        source="container_type",
    )
    uuid_node_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=Node.objects.all(),
        source="uuid_node",
    )
    parent_container_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=Container.objects.all(),
        source="parent_container",
        required=False,
        allow_null=True,
    )
    display_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Container
        fields = [
            "uuid",
            "uuid_node_id",
            "container_type",
            "container_type_id",
            "parent_container",
            "parent_container_id",
            "name",
            "sort_order",
            "is_expanded",
            "display_name",
            "created_at",
            "updated_at",
        ]

    def get_display_name(self, obj):
        return obj.get_display_name()


class ContainerTreeSerializer(serializers.ModelSerializer):
    """
    Recursive serializer for building the full container tree with nested items.
    Returns containers with their children and slot configurations.
    """

    uuid = serializers.UUIDField(read_only=True)
    container_type = ContainerTypeSerializer(read_only=True)
    display_name = serializers.SerializerMethodField()
    children = serializers.SerializerMethodField()
    slot_configurations = serializers.SerializerMethodField()

    class Meta:
        model = Container
        fields = [
            "uuid",
            "container_type",
            "name",
            "display_name",
            "sort_order",
            "is_expanded",
            "children",
            "slot_configurations",
        ]

    def get_display_name(self, obj):
        return obj.get_display_name()

    def get_children(self, obj):
        """Recursively serialize child containers."""
        children = obj.children.all().order_by("sort_order")
        return ContainerTreeSerializer(children, many=True, context=self.context).data

    def get_slot_configurations(self, obj):
        """Serialize slot configurations in this container."""
        configs = obj.slot_configurations.all().order_by("sort_order", "side")
        return NodeSlotConfigurationListSerializer(
            configs, many=True, context=self.context
        ).data


class NodeSlotConfigurationListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for slot configurations in container tree.
    Does not include nested node data to avoid circular references.
    """

    uuid = serializers.UUIDField(read_only=True)
    used_slots = serializers.SerializerMethodField(read_only=True)
    free_slots = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = NodeSlotConfiguration
        fields = [
            "uuid",
            "side",
            "total_slots",
            "sort_order",
            "used_slots",
            "free_slots",
        ]

    def get_used_slots(self, obj):
        """Calculate total used slots from NodeStructure entries."""
        structures = obj.structures.all()
        return sum(s.slot_end - s.slot_start + 1 for s in structures)

    def get_free_slots(self, obj):
        """Calculate remaining free slots."""
        return obj.total_slots - self.get_used_slots(obj)


class FiberSerializer(serializers.ModelSerializer):
    """Serializer for the Fiber model."""

    uuid = serializers.UUIDField(read_only=True)
    cable_name = serializers.CharField(source="uuid_cable.name", read_only=True)

    uuid_cable_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=Cable.objects.all(),
        source="uuid_cable",
    )

    class Meta:
        model = Fiber
        fields = [
            "uuid",
            "uuid_cable",
            "uuid_cable_id",
            "cable_name",
            "bundle_number",
            "bundle_color",
            "fiber_number_absolute",
            "fiber_number_in_bundle",
            "fiber_color",
            "active",
            "layer",
            "fiber_status",
            "flag",
            "project",
        ]
        read_only_fields = ["uuid"]

    def get_fields(self):
        """Dynamically translate field labels."""
        fields = super().get_fields()
        fields["bundle_number"].label = _("Bundle Number")
        fields["bundle_color"].label = _("Bundle Color")
        fields["fiber_number_absolute"].label = _("Fiber Number (Absolute)")
        fields["fiber_number_in_bundle"].label = _("Fiber Number (In Bundle)")
        fields["fiber_color"].label = _("Fiber Color")
        fields["active"].label = _("Active")
        fields["layer"].label = _("Layer")
        return fields


class CableAtNodeSerializer(serializers.ModelSerializer):
    """Lightweight serializer for cables at a node with direction info."""

    uuid = serializers.UUIDField(read_only=True)
    cable_type = AttributesCableTypeSerializer(read_only=True)
    direction = serializers.SerializerMethodField()
    fiber_count = serializers.IntegerField(
        source="cable_type.fiber_count", read_only=True
    )
    bundle_count = serializers.IntegerField(
        source="cable_type.bundle_count", read_only=True
    )

    class Meta:
        model = Cable
        fields = [
            "uuid",
            "name",
            "cable_type",
            "direction",
            "fiber_count",
            "bundle_count",
        ]

    def get_direction(self, obj):
        """Determine if cable starts or ends at the node."""
        node_uuid = self.context.get("node_uuid")
        if node_uuid:
            if str(obj.uuid_node_start_id) == str(node_uuid):
                return "start"
            elif str(obj.uuid_node_end_id) == str(node_uuid):
                return "end"
        return None
