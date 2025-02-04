from django.conf import settings
from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer, GeometryField
from django.utils.translation import gettext_lazy as _
from .models import (
    AttributesCompany,
    AttributesConstructionType,
    AttributesPhase,
    AttributesStatus,
    AttributesSurface,
    Trench,
)


class AttributesSurfaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttributesSurface
        fields = ["id", "surface", "sealing"]


class AttributesConstructionTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttributesConstructionType
        fields = ["id", "construction_type"]


class AttributesStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttributesStatus
        fields = ["id", "status"]


class AttributesPhaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttributesPhase
        fields = ["id", "phase"]


class AttributesCompanySerializer(serializers.ModelSerializer):
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


class TrenchSerializer(GeoFeatureModelSerializer):
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
    company = AttributesCompanySerializer(read_only=True)

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
                f"Geometry type must be LineString, not {value.geom_type}"
            )

        # Transform to default SRID
        if value.srid != settings.DEFAULT_SRID:
            try:
                value.transform(settings.DEFAULT_SRID)
            except Exception as e:
                raise serializers.ValidationError(
                    f"Could not transform coordinates to EPSG:{settings.DEFAULT_SRID}: {str(e)}"
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
        fields["construction_depth"].label = _("Construction Depth")
        fields["construction_details"].label = _("Construction Details")
        fields["internal_execution"].label = _("Internal Execution")
        fields["funding_status"].label = _("Funding Status")
        fields["date"].label = _("Date")
        fields["comment"].label = _("Comment")
        fields["geom"].label = _("Geometry")

        return fields
