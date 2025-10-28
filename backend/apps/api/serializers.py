from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer, GeometryField

from .models import (
    Address,
    AttributesCableType,
    AttributesCompany,
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

    # Read only fields
    uuid = serializers.UUIDField(read_only=True)
    id_trench = serializers.IntegerField(read_only=True)
    house_connection = serializers.BooleanField(read_only=True)
    length = serializers.DecimalField(read_only=True, max_digits=12, decimal_places=4)

    # Get nested serializers for foreign keys
    surface = AttributesSurfaceSerializer(read_only=True)
    construction_type = AttributesConstructionTypeSerializer(read_only=True)
    status = AttributesStatusSerializer(read_only=True)
    phase = AttributesPhaseSerializer(read_only=True)
    owner = AttributesCompanySerializer(read_only=True)
    constructor = AttributesCompanySerializer(read_only=True)
    project = ProjectsSerializer(read_only=True)
    flag = FlagsSerializer(read_only=True)

    # Add write fields for foreign keys
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
    # Format date to YYYY/MM/DD
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
        # Check geometry type
        if value.geom_type != "LineString":
            raise serializers.ValidationError(
                f"{_('Geometry type must be LineString, not')} {value.geom_type}"
            )

        # Transform to default SRID
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

        # Translate labels for write-only fields
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

        # Translate labels
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

    # Read only fields for all fields since this is a view
    uuid = serializers.UUIDField(read_only=True)
    id_trench = serializers.IntegerField(read_only=True)
    house_connection = serializers.BooleanField(read_only=True)
    length = serializers.DecimalField(read_only=True, max_digits=12, decimal_places=4)

    # Get nested serializers for foreign keys
    surface = AttributesSurfaceSerializer(read_only=True)
    construction_type = AttributesConstructionTypeSerializer(read_only=True)
    status = AttributesStatusSerializer(read_only=True)
    phase = AttributesPhaseSerializer(read_only=True)
    owner = AttributesCompanySerializer(read_only=True)
    constructor = AttributesCompanySerializer(read_only=True)

    # Format date to YYYY/MM/DD
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

        # Translate labels
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

    # Read only fields
    uuid = serializers.UUIDField(read_only=True)

    # Get nested serializers for foreign keys
    conduit_type = AttributesConduitTypeSerializer(read_only=True)
    status = AttributesStatusSerializer(read_only=True)
    network_level = AttributesNetworkLevelSerializer(read_only=True)
    owner = AttributesCompanySerializer(read_only=True)
    constructor = AttributesCompanySerializer(read_only=True)
    manufacturer = AttributesCompanySerializer(read_only=True)
    project = ProjectsSerializer(read_only=True)
    flag = FlagsSerializer(read_only=True)

    # Add write fields for foreign keys
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
        # Translate labels
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

    # Read only fields
    uuid = serializers.UUIDField(read_only=True)

    # Get nested serializers for foreign keys for read operations
    trench = TrenchSerializer(read_only=True, source="uuid_trench")
    conduit = ConduitSerializer(read_only=True, source="uuid_conduit")

    class Meta:
        model = TrenchConduitConnection
        fields = "__all__"

    def get_fields(self):
        """Dynamically translate field labels."""
        fields = super().get_fields()

        # Translate labels
        fields["trench"].label = _("Trench")
        fields["conduit"].label = _("Conduit")

        return fields


class AddressSerializer(GeoFeatureModelSerializer):
    """Serializer for the Address model."""

    # Read only fields
    uuid = serializers.UUIDField(read_only=True)

    # Get nested serializers for foreign keys
    status_development = AttributesStatusDevelopmentSerializer(read_only=True)
    flag = FlagsSerializer(read_only=True)
    project = ProjectsSerializer(read_only=True)

    # Add write fields for foreign keys
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

        # Translate labels
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
        # Check geometry type
        if value.geom_type != "Point":
            raise serializers.ValidationError(
                f"{_('Geometry type must be Point, not')} {value.geom_type}"
            )

        # Transform to default SRID
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

    # Read only fields
    uuid = serializers.UUIDField(read_only=True)

    # Get nested serializers for foreign keys
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

        # Translate labels
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

    # Read only fields
    uuid = serializers.UUIDField(read_only=True)

    # Get nested serializers for foreign keys
    uuid_address = AddressSerializer(read_only=True)
    node_type = AttributesNodeTypeSerializer(read_only=True)
    status = AttributesStatusSerializer(read_only=True)
    network_level = AttributesNetworkLevelSerializer(read_only=True)
    owner = AttributesCompanySerializer(read_only=True)
    constructor = AttributesCompanySerializer(read_only=True)
    manufacturer = AttributesCompanySerializer(read_only=True)
    project = ProjectsSerializer(read_only=True)
    flag = FlagsSerializer(read_only=True)

    # Add write fields for foreign keys
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
    )
    status_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=AttributesStatus.objects.all(),
        source="status",
    )
    network_level_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=AttributesNetworkLevel.objects.all(),
        source="network_level",
    )
    owner_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=AttributesCompany.objects.all(),
        source="owner",
    )
    constructor_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=AttributesCompany.objects.all(),
        source="constructor",
    )
    manufacturer_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=AttributesCompany.objects.all(),
        source="manufacturer",
    )
    warranty = serializers.DateField(
        required=False, input_formats=["%Y-%m-%d"], format="%Y-%m-%d"
    )
    date = serializers.DateField(
        required=False, input_formats=["%Y-%m-%d"], format="%Y-%m-%d"
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

        # Translate labels
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

    # Read only fields
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

        # Translate labels
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


class MicroductSerializer(serializers.ModelSerializer):
    """Serializer for the Microduct model."""

    # Read only fields
    uuid = serializers.UUIDField(read_only=True)

    # Get nested serializers for foreign keys
    uuid_conduit = ConduitSerializer(read_only=True)
    microduct_status = AttributesMicroductStatusSerializer(read_only=True)
    uuid_node = NodeSerializer(read_only=True)

    # Add write fields for foreign keys
    number = serializers.IntegerField(required=True)
    color = serializers.CharField(required=True)

    # Color hex codes from AttributesMicroductColor
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
            return "#64748b"  # Default gray

        # Handle two-layer colors (e.g., "rot-weiss")
        color_name = obj.color.lower()
        if "-" in color_name:
            color_name = color_name.split("-")[0]

        try:
            color_obj = AttributesMicroductColor.objects.get(
                name_de__iexact=color_name, is_active=True
            )
            return color_obj.hex_code
        except AttributesMicroductColor.DoesNotExist:
            return "#64748b"  # Default gray

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

        # Translate labels
        fields["number"].label = _("Number")
        fields["color"].label = _("Color")
        fields["uuid_conduit_id"].label = _("Conduit")
        fields["microduct_status_id"].label = _("Microduct Status")
        fields["uuid_node_id"].label = _("Node")

        return fields


class MicroductConnectionSerializer(serializers.ModelSerializer):
    """Serializer for the MicroductConnection model."""

    # Read only fields
    uuid = serializers.UUIDField(read_only=True)

    # Get nested serializers for foreign keys
    uuid_microduct_from = MicroductSerializer(read_only=True)
    uuid_trench_from = TrenchSerializer(read_only=True)
    uuid_microduct_to = MicroductSerializer(read_only=True)
    uuid_trench_to = TrenchSerializer(read_only=True)
    uuid_node = NodeSerializer(read_only=True)

    # Add write fields for foreign keys
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

        # Translate labels
        fields["uuid_microduct_from_id"].label = _("Microduct From")
        fields["uuid_microduct_to_id"].label = _("Microduct To")
        fields["uuid_trench_from_id"].label = _("Trench From")
        fields["uuid_trench_to_id"].label = _("Trench To")
        fields["uuid_node_id"].label = _("Node")

        return fields


class CableSerializer(serializers.ModelSerializer):
    """Serializer for the Cable model."""

    # Read only fields
    uuid = serializers.UUIDField(required=False)

    # Get nested serializers for foreign keys
    cable_type = AttributesCableTypeSerializer(read_only=True)
    status = AttributesStatusSerializer(read_only=True)
    network_level = AttributesNetworkLevelSerializer(read_only=True)
    owner = AttributesCompanySerializer(read_only=True)
    constructor = AttributesCompanySerializer(read_only=True)
    manufacturer = AttributesCompanySerializer(read_only=True)
    project = ProjectsSerializer(read_only=True)
    flag = FlagsSerializer(read_only=True)

    # Add write fields for foreign keys
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

        # Translate labels
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

    # Read only fields
    uuid = serializers.UUIDField(read_only=True)

    # Get nested serializers for foreign keys
    uuid_microduct = MicroductSerializer(read_only=True)
    uuid_cable = CableSerializer(read_only=True)

    # Add write fields for foreign keys
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

        # Translate labels
        fields["uuid_microduct_id"].label = _("Microduct")
        fields["uuid_cable_id"].label = _("Cable")

        return fields
