from django.conf import settings
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer, GeometryField

from .models import (
    AttributesCompany,
    AttributesConduitType,
    AttributesConstructionType,
    AttributesNetworkLevel,
    AttributesNodeType,
    AttributesPhase,
    AttributesStatus,
    AttributesSurface,
    Conduit,
    FeatureFiles,
    Flags,
    OlTrench,
    Projects,
    Trench,
    TrenchConduitConnection,
)


class ProjectsSerializer(serializers.ModelSerializer):
    """Serializer for the Projects model."""

    class Meta:
        model = Projects
        fields = ["id", "project", "description"]


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


class AttributesConduitTypeSerializer(serializers.ModelSerializer):
    """Serializer for the AttributesConduitType model."""

    class Meta:
        model = AttributesConduitType
        fields = [
            "id",
            "conduit_type",
            "conduit_count",
            "color_code",
            "conduit_type_alias",
            "conduit_type_microduct",
        ]


class AttributesNetworkLevelSerializer(serializers.ModelSerializer):
    """Serializer for the AttributesNetworkLevel model."""

    class Meta:
        model = AttributesNetworkLevel
        fields = ["id", "network_level"]


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
    # Format date to YYYY/MM/DD
    date = serializers.DateField(format="%Y/%m/%d")
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
        fields["trench_constructor"].label = _("Constructor")
        fields["construction_depth"].label = _("Construction Depth")
        fields["construction_details"].label = _("Construction Details")
        fields["internal_execution"].label = _("Internal Execution")
        fields["funding_status"].label = _("Funding Status")
        fields["date"].label = _("Date")
        fields["comment"].label = _("Comment")
        fields["geom"].label = _("Geometry")

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
    date = serializers.DateField(format="%Y/%m/%d", read_only=True)
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
    conduit_type_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=AttributesConduitType.objects.all(),
        source="conduit_type",
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
        model = Conduit
        fields = "__all__"
        ordering = ["name"]

    def get_fields(self):
        """Dynamically translate field labels."""
        fields = super().get_fields()

        # Translate labels
        fields["conduit_type"].label = _("Conduit Type")
        fields["status"].label = _("Status")
        fields["network_level"].label = _("Network Level")
        fields["owner"].label = _("Owner")
        fields["constructor"].label = _("Constructor")
        fields["manufacturer"].label = _("Manufacturer")
        fields["project"].label = _("Project")
        fields["flag"].label = _("Flag")

        return fields


class TrenchConduitSerializer(serializers.ModelSerializer):
    """Serializer for the TrenchConduit model."""

    # Read only fields
    uuid = serializers.UUIDField(read_only=True)

    # Get nested serializers for foreign keys
    trench = TrenchSerializer(read_only=True)
    conduit = ConduitSerializer(read_only=True)

    class Meta:
        model = TrenchConduitConnection
        fields = "__all__"

    def get_fields(self):
        """Dynamically translate field labels."""
        fields = super().get_fields()

        # Translate labels
        fields["trench"].label = _("Trench")
        fields["conduit"].label = _("Conduit")
