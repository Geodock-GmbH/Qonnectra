import logging
import os
import uuid

from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey, GenericRelation
from django.contrib.contenttypes.models import ContentType
from django.contrib.gis.db import models as gis_models
from django.db import models
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from pathvalidate import sanitize_filename

from .storage import LocalMediaStorage, QGISProjectStorage

logger = logging.getLogger(__name__)


class Projects(models.Model):
    """Stores all projects,
    related to :model:`api.Trench`.
    """

    id = models.IntegerField(primary_key=True)
    project = models.TextField(_("Project"), null=False, db_index=False, unique=True)
    description = models.TextField(_("Description"), null=True)
    active = models.BooleanField(_("Active"), null=False, default=True)

    class Meta:
        db_table = "projects"
        verbose_name = _("Project")
        verbose_name_plural = _("Projects")

    def __str__(self):
        return self.project


class Flags(models.Model):
    """Stores all flags,
    related to :model:`api.Trench`.
    """

    id = models.IntegerField(primary_key=True)
    flag = models.TextField(_("Flag"), null=False, db_index=False, unique=True)

    class Meta:
        db_table = "flags"
        verbose_name = _("Flag")
        verbose_name_plural = _("Flags")

    def __str__(self):
        return self.flag


class AttributesSurface(models.Model):
    """Stores all surfaces types for trench features,
    related to :model:`api.Trench`.
    """

    id = models.IntegerField(primary_key=True)
    surface = models.TextField(_("Surface"), null=False, db_index=False)
    sealing = models.BooleanField(_("Sealing"), null=False)

    class Meta:
        db_table = "attributes_surface"
        indexes = [
            models.Index(fields=["surface"], name="idx_surface_surface"),
        ]
        verbose_name = _("Surface")
        verbose_name_plural = _("Surfaces")

    def __str__(self):
        return self.surface


class AttributesConstructionType(models.Model):
    """Stores all construction types for trench features,
    related to :model:`api.Trench`.
    """

    id = models.IntegerField(primary_key=True)
    construction_type = models.TextField(
        _("Construction Type"), null=False, db_index=False
    )

    class Meta:
        db_table = "attributes_construction_type"
        indexes = [
            models.Index(
                fields=["construction_type"],
                name="idx_construction_type",
            ),
        ]
        verbose_name = _("Construction Type")
        verbose_name_plural = _("Construction Types")

    def __str__(self):
        return self.construction_type


class AttributesStatus(models.Model):
    """Stores all statuses for different models,
    related to :model:`api.Trench`.
    """

    id = models.IntegerField(primary_key=True)
    status = models.TextField(_("Status"), null=False, db_index=False, unique=True)

    class Meta:
        db_table = "attributes_status"
        indexes = [
            models.Index(
                fields=["status"],
                name="idx_status_status",
            ),
        ]
        verbose_name = _("Status")
        verbose_name_plural = _("Statuses")

    def __str__(self):
        return self.status


class AttributesPhase(models.Model):
    """Stores all phases for different models,
    related to :model:`api.Trench`.
    """

    id = models.IntegerField(primary_key=True)
    phase = models.TextField(_("Phase"), null=False, db_index=False)

    class Meta:
        db_table = "attributes_phase"
        indexes = [
            models.Index(
                fields=["phase"],
                name="idx_phase_phase",
            ),
        ]
        verbose_name = _("Phase")
        verbose_name_plural = _("Phases")

    def __str__(self):
        return self.phase


class AttributesCompany(models.Model):
    """Stores all companies for different models,
    related to :model:`api.Trench`.
    """

    id = models.IntegerField(primary_key=True)
    company = models.TextField(_("Company"), null=False, db_index=False)
    city = models.TextField(_("City"), null=True)
    postal_code = models.TextField(_("Postal Code"), null=True)
    street = models.TextField(_("Street"), null=True)
    housenumber = models.TextField(_("Housenumber"), null=True)
    phone = models.TextField(_("Phone"), null=True)
    email = models.TextField(_("Email"), null=True)

    class Meta:
        db_table = "attributes_company"
        indexes = [
            models.Index(
                fields=["company"],
                name="idx_company_company",
            ),
        ]
        verbose_name = _("Company")
        verbose_name_plural = _("Companies")

    def __str__(self):
        return self.company


class AttributesNodeType(models.Model):
    """Stores all node types for node features,
    related to :model:`api.Node`.
    """

    id = models.IntegerField(primary_key=True)
    node_type = models.TextField(_("Node Type"), null=False, db_index=False)
    dimension = models.TextField(_("Dimension"), null=True)
    group = models.TextField(_("Group"), null=True)
    company = models.TextField(_("Company"), null=True)

    class Meta:
        db_table = "attributes_node_type"
        indexes = [
            models.Index(
                fields=["node_type"],
                name="idx_node_type_node_type",
            ),
        ]
        verbose_name = _("Node Type")
        verbose_name_plural = _("Node Types")

    def __str__(self):
        return self.node_type


class AttributesConduitType(models.Model):
    """Stores all conduit types for conduit features,
    related to :model:`api.Conduit`.
    """

    id = models.IntegerField(primary_key=True)
    conduit_type = models.TextField(_("Conduit Type"), null=False, db_index=False)
    conduit_count = models.IntegerField(_("Conduit Count"), null=False)
    manufacturer = models.ForeignKey(
        AttributesCompany,
        null=True,
        on_delete=models.DO_NOTHING,
        db_column="manufacturer",
        verbose_name=_("Manufacturer"),
        blank=True,
    )
    conduit_type_alias = models.TextField(
        _("Conduit Type Alias"), null=True, blank=True
    )
    conduit_type_microduct = models.IntegerField(
        _("Conduit Type Microduct"), null=True, blank=True
    )

    class Meta:
        db_table = "attributes_conduit_type"
        indexes = [
            models.Index(fields=["conduit_type"], name="idx_conduit_type_conduit_type"),
        ]
        verbose_name = _("Conduit Type")
        verbose_name_plural = _("Conduit Types")

    def __str__(self):
        return self.conduit_type


class AttributesNetworkLevel(models.Model):
    """Stores all network levels for conduit features,
    related to :model:`api.Conduit`.
    """

    id = models.IntegerField(primary_key=True)
    network_level = models.TextField(_("Network Level"), null=False, db_index=False)

    class Meta:
        db_table = "attributes_network_level"
        indexes = [
            models.Index(fields=["network_level"], name="idx_network_level_net_level"),
        ]
        verbose_name = _("Network Level")
        verbose_name_plural = _("Network Levels")

    def __str__(self):
        return self.network_level


class AttributesStatusDevelopment(models.Model):
    """Stores all statuses for development,
    related to :model:`api.Address`.
    """

    id = models.IntegerField(primary_key=True)
    status = models.TextField(_("Status"), null=False, db_index=False, unique=True)

    class Meta:
        db_table = "attributes_status_development"
        indexes = [
            models.Index(fields=["status"], name="idx_status_development_status"),
        ]
        verbose_name = _("Status Development")
        verbose_name_plural = _("Status Developments")

    def __str__(self):
        return self.status


class AttributesMicroductStatus(models.Model):
    """Stores all microduct statuses,
    related to :model:`api.Microduct`.
    """

    id = models.IntegerField(primary_key=True)
    microduct_status = models.TextField(
        _("Microduct Status"), null=False, db_index=True, unique=True
    )

    class Meta:
        db_table = "attributes_microduct_status"
        verbose_name = _("Microduct Status")
        verbose_name_plural = _("Microduct Statuses")

    def __str__(self):
        return self.microduct_status


class AttributesCableType(models.Model):
    """Stores all cable types,
    related to :model:`api.Cable`.
    """

    id = models.AutoField(primary_key=True)
    cable_type = models.TextField(_("Cable Type"), null=False)
    fiber_count = models.IntegerField(_("Fiber Count"), null=False)
    bundle_count = models.IntegerField(_("Bundle Count"), null=False)
    bundle_fiber_count = models.IntegerField(_("Bundle Fiber Count"), null=False)
    manufacturer = models.ForeignKey(
        AttributesCompany,
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="manufacturer",
        verbose_name=_("Manufacturer"),
    )

    class Meta:
        db_table = "attributes_cable_type"
        verbose_name = _("Cable Type")
        verbose_name_plural = _("Cable Types")

    def __str__(self):
        return self.cable_type


class AttributesMicroductColor(models.Model):
    """Stores all available microduct colors with their visual representation.
    Allows admin to manage color palette for microducts.
    Related to :model:`api.Microduct`, :model:`api.AttributesConduitType`.
    """

    id = models.AutoField(primary_key=True)

    name_de = models.CharField(
        _("German Name"),
        max_length=50,
        unique=True,
        help_text=_("German color name (e.g., 'rot', 'rot-weiss')"),
    )
    name_en = models.CharField(
        _("English Name"),
        max_length=50,
        help_text=_("English color name (e.g., 'red', 'red-white')"),
    )

    hex_code = models.CharField(
        _("Hex Color Code"),
        max_length=7,
        help_text=_("Primary CSS hex color code (e.g., '#dc2626')"),
    )
    hex_code_secondary = models.CharField(
        _("Secondary Hex Color Code"),
        max_length=7,
        null=True,
        blank=True,
        help_text=_("Secondary color for striped/two-layer microducts (optional)"),
    )

    display_order = models.IntegerField(
        _("Display Order"),
        default=0,
        help_text=_("Order in which colors appear in selection lists"),
    )
    is_active = models.BooleanField(
        _("Active"),
        default=True,
        help_text=_("Inactive colors are hidden but preserved for existing data"),
    )
    description = models.TextField(
        _("Description"),
        null=True,
        blank=True,
        help_text=_("Optional notes about this color"),
    )

    class Meta:
        db_table = "attributes_microduct_color"
        verbose_name = _("Microduct Color")
        verbose_name_plural = _("Microduct Colors")
        ordering = ["display_order", "name_de"]
        indexes = [
            models.Index(fields=["name_de"], name="idx_md_color_name_de"),
            models.Index(fields=["display_order"], name="idx_md_color_display_order"),
            models.Index(fields=["is_active"], name="idx_md_color_is_active"),
        ]

    def __str__(self):
        return f"{self.name_de} ({self.name_en})"

    @property
    def is_two_layer(self):
        """Check if this is a two-layer/striped color"""
        return self.hex_code_secondary is not None


class AttributesFiberStatus(models.Model):
    """Stores all fiber statuses,
    related to :model:`api.Fiber`.
    """

    id = models.AutoField(primary_key=True)
    fiber_status = models.TextField(
        _("Fiber Status"), null=False, db_index=False, unique=True
    )

    class Meta:
        db_table = "attributes_fiber_status"
        verbose_name = _("Fiber Status")
        verbose_name_plural = _("Fiber Statuses")
        ordering = ["fiber_status"]
        indexes = [
            models.Index(fields=["fiber_status"], name="idx_fiber_status_status"),
        ]

    def __str__(self):
        return self.fiber_status


class AttributesFiberColor(models.Model):
    """Stores all colors for fibers and bundles,
    related to :model:`api.Fiber`.
    """

    id = models.AutoField(primary_key=True)

    name_de = models.CharField(
        _("German Name"),
        max_length=50,
        unique=True,
        help_text=_("German color name (e.g., 'rot', 'rot-weiss')"),
    )
    name_en = models.CharField(
        _("English Name"),
        max_length=50,
        help_text=_("English color name (e.g., 'red', 'red-white')"),
    )
    hex_code = models.CharField(
        _("Hex Color Code"),
        max_length=7,
        help_text=_("Primary CSS hex color code (e.g., '#dc2626')"),
    )
    hex_code_secondary = models.CharField(
        _("Secondary Hex Color Code"),
        max_length=7,
        null=True,
        blank=True,
        help_text=_("Secondary color for striped/two-layer microducts (optional)"),
    )
    display_order = models.IntegerField(
        _("Display Order"),
        default=0,
        help_text=_("Order in which colors appear in selection lists"),
    )
    is_active = models.BooleanField(
        _("Active"),
        default=True,
        help_text=_("Inactive colors are hidden but preserved for existing data"),
    )
    description = models.TextField(
        _("Description"),
        null=True,
        blank=True,
        help_text=_("Optional notes about this color"),
    )

    class Meta:
        db_table = "attributes_fiber_color"
        verbose_name = _("Fiber Color")
        verbose_name_plural = _("Fiber Colors")
        ordering = ["display_order", "name_de"]
        indexes = [
            models.Index(fields=["name_de"], name="idx_fiber_color_name_de"),
            models.Index(
                fields=["display_order"], name="idx_fiber_color_display_order"
            ),
            models.Index(fields=["is_active"], name="idx_fiber_color_is_active"),
        ]

    def __str__(self):
        return f"{self.name_de} ({self.name_en})"


class FeatureFiles(models.Model):
    """Stores all files for different models,
    related to :model:`api.Trench`.
    """

    uuid = models.UUIDField(default=uuid.uuid4, primary_key=True)

    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        verbose_name=_("Feature Type"),
        limit_choices_to={
            "app_label": "api",
            "model__in": [
                "trench",
                "conduit",
                "cable",
                "node",
                "address",
                "residentialunit",
            ],
        },
    )
    object_id = models.UUIDField(verbose_name=_("Feature ID"))
    feature = GenericForeignKey("content_type", "object_id")

    def get_feature_identifier(instance):
        """
        Get the human-readable identifier for a feature based on its model type.

        Returns the appropriate identifier (id_trench, name, address string, etc.)
        instead of the UUID.
        """
        model_name = instance.content_type.model
        feature = instance.feature

        if model_name == "trench":
            return feature.id_trench
        elif model_name == "conduit":
            return feature.name
        elif model_name == "cable":
            return feature.name
        elif model_name == "node":
            return feature.name
        elif model_name == "address":
            suffix = (
                f" {feature.house_number_suffix}" if feature.house_number_suffix else ""
            )
            return f"{feature.street} {feature.housenumber}{suffix}, {feature.zip_code} {feature.city}"
        elif model_name == "residentialunit":
            return instance.object_id
        else:
            return instance.object_id

    def get_upload_path(instance, filename):
        """
        Determine the upload path for a file based on project, feature type and file category.

        The path structure follows: {project_name}/{feature_type}/{feature_id}/{category}/{filename}

        For example:
        - Project Alpha/trenches/12345/photos/image.jpg
        - Project Beta/conduits/K1-HVT-FLS/documents/report.pdf
        - Project Alpha/cables/C1-Main/photos/image.jpg
        - Project Beta/nodes/N1-POP/documents/spec.pdf
        - Project Alpha/addresses/Bahnstraße 20, 24941 Flensburg/documents/contract.pdf
        """

        prefs = StoragePreferences.objects.first()
        model_name = instance.content_type.model
        feature = instance.feature
        feature_id = FeatureFiles.get_feature_identifier(instance)

        project_name = (
            feature.project.project
            if hasattr(feature, "project") and feature.project
            else "default"
        )
        project_name = sanitize_filename(project_name)

        # Only support AUTO mode - manual uploads happen via WebDAV
        if not prefs or prefs.mode != "AUTO":
            # Default fallback if no preferences exist
            return f"{project_name}/{model_name}s/{feature_id}/{filename}"

        file_extension = instance.get_file_type() or ""
        file_extension = file_extension.lower()

        # Determine file category based on extension
        try:
            category_obj = FileTypeCategory.objects.get(extension=file_extension)
            file_category = category_obj.category
        except FileTypeCategory.DoesNotExist:
            file_category = "documents"

        # Get folder structure from preferences
        folder_paths = prefs.folder_structure.get(model_name, {})
        folder_name = folder_paths.get(
            file_category, folder_paths.get("default", model_name + "s")
        )

        # Build the path based on folder structure with project name as root
        if "/" in folder_name:
            # Handle nested folder structure (e.g., "trenches/photos")
            base_folder, sub_folder = folder_name.split("/", 1)
            return f"{project_name}/{base_folder}/{feature_id}/{sub_folder}/{filename}"
        else:
            return f"{project_name}/{folder_name}/{feature_id}/{filename}"

    file_path = models.FileField(
        upload_to=get_upload_path,
        storage=LocalMediaStorage(),
        null=False,
        verbose_name=_("File Path"),
        max_length=500,
    )

    file_name = models.TextField(null=False, verbose_name=_("File Name"))
    file_type = models.TextField(null=True, verbose_name=_("File Type"))
    description = models.TextField(null=True, verbose_name=_("Description"))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("Created At"))

    def get_file_name(instance):
        file_path = instance.file_path.name
        try:
            # Extract just the filename from the full path
            filename = os.path.basename(file_path)
            parts = filename.split(".")
            return parts[0] if len(parts) > 1 else filename
        except Exception:
            return file_path

    def get_file_type(instance):
        file_path = instance.file_path.name
        try:
            # Extract just the filename from the full path
            filename = os.path.basename(file_path)
            parts = filename.split(".")
            return parts[-1] if len(parts) > 1 else None
        except Exception:
            return None

    def save(self, *args, **kwargs):
        self.file_name = self.get_file_name()
        self.file_type = self.get_file_type()
        super().save(*args, **kwargs)

    class Meta:
        db_table = "feature_files"
        verbose_name = _("Feature File")
        verbose_name_plural = _("Feature Files")
        indexes = [
            models.Index(
                fields=["content_type", "object_id"],
                name="idx_feature_files_type_id",
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["content_type", "object_id", "file_path"],
                name="unique_feature_file_path",
            ),
        ]


class StoragePreferences(models.Model):
    """Stores all storage preferences for different models,
    related to :model:`api.FeatureFiles`.

    Note: Manual mode has been removed. Files uploaded via WebDAV are
    handled outside of Django's automatic organization.
    """

    STORAGE_MODE_CHOICES = [
        ("AUTO", "Automatic Organization"),
    ]

    mode = models.CharField(max_length=10, choices=STORAGE_MODE_CHOICES, default="AUTO")
    folder_structure = models.JSONField(
        default=dict,
        help_text=_(
            "Custom folder structure for different feature types. "
            "Example: {'trench': 'trenches', 'node': 'nodes'}"
        ),
    )

    class Meta:
        db_table = "storage_preferences"
        verbose_name = _("Storage Preference")
        verbose_name_plural = _("Storage Preferences")

    def __str__(self):
        return f"Storage Preferences - {self.mode}"

    def clean(self):
        """Validate the folder_structure field."""
        from .validators import validate_storage_preferences_structure

        super().clean()
        if self.folder_structure:
            validate_storage_preferences_structure(self.folder_structure)


class FileTypeCategory(models.Model):
    """Maps file extensions to categories for organizing uploads.
    Used by :model:`api.FeatureFiles` to determine storage paths.
    """

    extension = models.CharField(
        max_length=10,
        primary_key=True,
        verbose_name=_("File Extension"),
        help_text=_("File extension without the dot (e.g., 'pdf', 'jpg')"),
    )

    category = models.CharField(
        max_length=50,
        verbose_name=_("Category"),
        help_text=_(
            "Category used for folder organization (e.g., 'photos', 'documents')"
        ),
    )

    description = models.TextField(
        null=True,
        blank=True,
        verbose_name=_("Description"),
        help_text=_("Optional description of this file type"),
    )

    class Meta:
        db_table = "file_type_category"
        verbose_name = _("File Type Category")
        verbose_name_plural = _("File Type Categories")
        ordering = ["extension"]

    def __str__(self):
        return f"{self.extension} → {self.category}"


class Trench(models.Model):
    """Stores all trench features,
    related to :model:`api.AttributesSurface`,
    :model:`api.AttributesConstructionType`,
    :model:`api.AttributesStatus`,
    :model:`api.AttributesPhase`,
    :model:`api.AttributesCompany`,
    :model:`api.Projects`,
    :model:`api.Flags`.
    """

    uuid = models.UUIDField(default=uuid.uuid4, primary_key=True)
    id_trench = models.IntegerField(_("Trench ID"), null=False, unique=True)
    surface = models.ForeignKey(
        AttributesSurface,
        null=False,
        on_delete=models.CASCADE,
        db_column="surface",
        db_index=False,
        verbose_name=_("Surface"),
    )
    construction_type = models.ForeignKey(
        AttributesConstructionType,
        null=False,
        on_delete=models.CASCADE,
        db_column="construction_type",
        db_index=False,
        verbose_name=_("Construction Type"),
    )
    construction_depth = models.IntegerField(
        _("Construction Depth"),
        null=True,
    )
    construction_details = models.TextField(
        _("Construction Details"),
        null=True,
    )
    status = models.ForeignKey(
        AttributesStatus,
        null=True,
        on_delete=models.CASCADE,
        db_column="status",
        db_index=False,
        verbose_name=_("Status"),
    )
    phase = models.ForeignKey(
        AttributesPhase,
        null=True,
        on_delete=models.CASCADE,
        db_column="phase",
        db_index=False,
        verbose_name=_("Phase"),
    )
    internal_execution = models.BooleanField(
        _("Internal Execution"),
        null=True,
    )
    funding_status = models.BooleanField(
        _("Funding Status"),
        null=True,
    )
    owner = models.ForeignKey(
        AttributesCompany,
        null=True,
        on_delete=models.CASCADE,
        related_name="owned_trenches",
        db_column="owner",
        db_index=False,
        verbose_name=_("Owner"),
    )
    constructor = models.ForeignKey(
        AttributesCompany,
        null=True,
        on_delete=models.CASCADE,
        related_name="executed_trenches",
        db_column="constructor",
        db_index=False,
        verbose_name=_("Constructor"),
    )
    date = models.DateField(_("Date"), null=True)
    comment = models.TextField(_("Comment"), null=True)
    house_connection = models.BooleanField(
        _("House Connection"),
        null=True,
        default=False,
    )
    length = models.DecimalField(
        _("Length"),
        null=False,
        max_digits=12,
        decimal_places=4,
    )
    geom = gis_models.LineStringField(
        _("Geometry"),
        null=False,
        srid=int(settings.DEFAULT_SRID),
        spatial_index=False,
    )

    files = GenericRelation(
        FeatureFiles,
        content_type_field="content_type",
        object_id_field="object_id",
        related_query_name="trench",
    )

    project = models.ForeignKey(
        Projects,
        null=False,
        on_delete=models.CASCADE,
        db_column="project",
        db_index=False,
        default=1,
        verbose_name=_("Project"),
    )

    flag = models.ForeignKey(
        Flags,
        null=False,
        on_delete=models.CASCADE,
        db_column="flag",
        db_index=False,
        default=1,
        verbose_name=_("Flag"),
    )

    def __str__(self):
        """String representation of the trench model."""
        return str(self.id_trench)

    class Meta:
        """Meta class for the trench model."""

        db_table = "trench"
        verbose_name = _("Trench")
        verbose_name_plural = _("Trenches")
        ordering = ["id_trench"]
        indexes = [
            models.Index(fields=["id_trench"], name="idx_trench_id_trench"),
            models.Index(fields=["surface"], name="idx_trench_surface"),
            models.Index(
                fields=["construction_type"], name="idx_trench_construction_type"
            ),
            models.Index(fields=["status"], name="idx_trench_status"),
            models.Index(fields=["phase"], name="idx_trench_phase"),
            models.Index(fields=["owner"], name="idx_trench_owner"),
            models.Index(fields=["constructor"], name="idx_trench_constructor"),
            gis_models.Index(fields=["geom"], name="idx_trench_geom"),
        ]


# TODO: Implement area model
# TODO: Refactor area count trigger, fn_update_area_counts and fn_area_counts_area_update to be dynamic
# TODO: Implement residential unit model


class OlTrench(models.Model):
    """Stores all trench features rendered on Openlayers,
    related to :model:`api.AttributesSurface`,
    :model:`api.AttributesConstructionType`,
    :model:`api.AttributesStatus`,
    :model:`api.AttributesPhase`,
    :model:`api.AttributesCompany`,
    :model:`api.Projects`,
    :model:`api.Flags`.
    """

    uuid = models.UUIDField(primary_key=True)
    id_trench = models.IntegerField(_("Trench ID"))
    surface = models.ForeignKey(
        AttributesSurface,
        on_delete=models.DO_NOTHING,
        db_column="surface",
        verbose_name=_("Surface"),
    )
    construction_type = models.ForeignKey(
        AttributesConstructionType,
        on_delete=models.DO_NOTHING,
        db_column="construction_type",
        verbose_name=_("Construction Type"),
    )
    construction_depth = models.IntegerField(_("Construction Depth"), null=True)
    construction_details = models.TextField(_("Construction Details"), null=True)
    status = models.ForeignKey(
        AttributesStatus,
        null=True,
        on_delete=models.DO_NOTHING,
        db_column="status",
        verbose_name=_("Status"),
    )
    phase = models.ForeignKey(
        AttributesPhase,
        null=True,
        on_delete=models.DO_NOTHING,
        db_column="phase",
        verbose_name=_("Phase"),
    )
    internal_execution = models.BooleanField(_("Internal Execution"), null=True)
    funding_status = models.BooleanField(_("Funding Status"), null=True)
    owner = models.ForeignKey(
        AttributesCompany,
        null=True,
        on_delete=models.DO_NOTHING,
        related_name="owned_ol_trenches",
        db_column="owner",
        verbose_name=_("Owner"),
    )
    constructor = models.ForeignKey(
        AttributesCompany,
        null=True,
        on_delete=models.DO_NOTHING,
        related_name="executed_ol_trenches",
        db_column="constructor",
        verbose_name=_("Constructor"),
    )
    date = models.DateField(_("Date"), null=True)
    comment = models.TextField(_("Comment"), null=True)
    house_connection = models.BooleanField(_("House Connection"), null=True)
    length = models.DecimalField(_("Length"), max_digits=12, decimal_places=4)
    geom = gis_models.LineStringField(_("Geometry"), srid=int(settings.DEFAULT_SRID))
    project = models.ForeignKey(
        Projects,
        null=False,
        on_delete=models.DO_NOTHING,
        db_column="project",
        verbose_name=_("Project"),
    )
    flag = models.ForeignKey(
        Flags,
        null=False,
        on_delete=models.DO_NOTHING,
        db_column="flag",
        verbose_name=_("Flag"),
    )

    class Meta:
        managed = False
        db_table = "ol_trench"
        verbose_name = _("OL Trench")
        verbose_name_plural = _("OL Trenches")
        ordering = ["id_trench"]


class Conduit(models.Model):
    """Stores all conduits,
    related to :model:`api.TrenchConduitConnection`,
    :model:`api.AttributesConduitType`,
    :model:`api.AttributesStatus`,
    :model:`api.AttributesNetworkLevel`,
    :model:`api.AttributesCompany`,
    :model:`api.Flags`,
    :model:`api.Projects`.
    """

    uuid = models.UUIDField(default=uuid.uuid4, primary_key=True)
    name = models.TextField(
        null=False,
        unique=True,
        db_index=False,
        verbose_name=_("Conduit Name"),
    )
    conduit_type = models.ForeignKey(
        AttributesConduitType,
        null=False,
        on_delete=models.CASCADE,
        db_column="conduit_type",
        db_index=False,
        verbose_name=_("Conduit Type"),
    )
    outer_conduit = models.TextField(
        null=True,
        db_index=False,
    )
    status = models.ForeignKey(
        AttributesStatus,
        null=True,
        on_delete=models.DO_NOTHING,
        db_column="status",
        db_index=False,
        verbose_name=_("Status"),
    )
    network_level = models.ForeignKey(
        AttributesNetworkLevel,
        null=True,
        on_delete=models.DO_NOTHING,
        db_column="network_level",
        db_index=False,
        verbose_name=_("Network Level"),
    )
    owner = models.ForeignKey(
        AttributesCompany,
        null=True,
        on_delete=models.DO_NOTHING,
        db_column="owner",
        db_index=False,
        verbose_name=_("Owner"),
        related_name="owned_conduits",
    )
    constructor = models.ForeignKey(
        AttributesCompany,
        null=True,
        on_delete=models.DO_NOTHING,
        db_column="constructor",
        db_index=False,
        verbose_name=_("Constructor"),
        related_name="constructed_conduits",
    )
    manufacturer = models.ForeignKey(
        AttributesCompany,
        null=True,
        on_delete=models.DO_NOTHING,
        db_column="manufacturer",
        db_index=False,
        verbose_name=_("Manufacturer"),
        related_name="manufactured_conduits",
    )
    date = models.DateField(_("Date"), null=True)

    files = GenericRelation(
        FeatureFiles,
        content_type_field="content_type",
        object_id_field="object_id",
        related_query_name="conduit",
    )

    project = models.ForeignKey(
        Projects,
        null=False,
        on_delete=models.DO_NOTHING,
        db_column="project",
        db_index=False,
        verbose_name=_("Project"),
    )

    flag = models.ForeignKey(
        Flags,
        null=False,
        on_delete=models.DO_NOTHING,
        db_column="flag",
        db_index=False,
        verbose_name=_("Flag"),
    )

    def __str__(self):
        return self.name

    class Meta:
        db_table = "conduit"
        verbose_name = _("Conduit")
        verbose_name_plural = _("Conduits")
        ordering = ["name"]
        indexes = [
            models.Index(fields=["name"], name="idx_conduit_name"),
            models.Index(fields=["conduit_type"], name="idx_conduit_conduit_type"),
            models.Index(fields=["status"], name="idx_conduit_status"),
            models.Index(fields=["network_level"], name="idx_conduit_network_level"),
            models.Index(fields=["owner"], name="idx_conduit_owner"),
            models.Index(fields=["constructor"], name="idx_conduit_constructor"),
            models.Index(fields=["manufacturer"], name="idx_conduit_manufacturer"),
            models.Index(fields=["project"], name="idx_conduit_project"),
            models.Index(fields=["flag"], name="idx_conduit_flag"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "name"],
                name="unique_conduit",
            ),
        ]


class TrenchConduitConnection(models.Model):
    """Stores all trench conduit connections,
    related to :model:`api.Trench`,
    :model:`api.Conduit`.
    """

    uuid = models.UUIDField(default=uuid.uuid4, primary_key=True)
    uuid_trench = models.ForeignKey(
        Trench,
        null=False,
        on_delete=models.CASCADE,
        db_column="uuid_trench",
        db_index=False,
        verbose_name=_("Trench"),
    )
    uuid_conduit = models.ForeignKey(
        Conduit,
        null=False,
        on_delete=models.CASCADE,
        db_column="uuid_conduit",
        db_index=False,
        verbose_name=_("Conduit"),
    )

    class Meta:
        db_table = "trench_conduit_connect"
        verbose_name = _("Trench Conduit Connection")
        verbose_name_plural = _("Trench Conduit Connections")
        indexes = [
            models.Index(fields=["uuid_trench"], name="idx_trench_conduit_con_trench"),
            models.Index(
                fields=["uuid_conduit"],
                name="idx_trench_conduit_con_cond",
            ),
        ]


class Address(models.Model):
    """Stores all addresses,
    related to :model:`api.Nodes`,
    :model:`api.AttributesStatusDevelopment`,
    :model:`api.Flags`,
    :model:`api.Projects`.
    """

    uuid = models.UUIDField(default=uuid.uuid4, primary_key=True)
    id_address = models.IntegerField(_("Address ID"), null=True, unique=True)
    zip_code = models.TextField(_("Zip Code"), null=False)
    city = models.TextField(_("City"), null=False)
    district = models.TextField(_("District"), null=True)
    street = models.TextField(_("Street"), null=False)
    housenumber = models.IntegerField(_("Housenumber"), null=False)
    house_number_suffix = models.TextField(_("House Number Suffix"), null=True)
    status_development = models.ForeignKey(
        AttributesStatusDevelopment,
        null=True,
        on_delete=models.DO_NOTHING,
        db_column="status_development",
        db_index=False,
        verbose_name=_("Status Development"),
    )
    geom = gis_models.PointField(
        _("Geometry"), srid=int(settings.DEFAULT_SRID), null=False
    )

    files = GenericRelation(
        FeatureFiles,
        content_type_field="content_type",
        object_id_field="object_id",
        related_query_name="address",
    )

    flag = models.ForeignKey(
        Flags,
        null=False,
        on_delete=models.DO_NOTHING,
        db_column="flag",
        db_index=False,
        verbose_name=_("Flag"),
    )
    project = models.ForeignKey(
        Projects,
        null=False,
        on_delete=models.DO_NOTHING,
        db_column="project",
        db_index=False,
        verbose_name=_("Project"),
    )

    class Meta:
        db_table = "address"
        verbose_name = _("Address")
        verbose_name_plural = _("Addresses")
        ordering = ["street", "housenumber", "house_number_suffix"]
        indexes = [
            models.Index(fields=["id_address"], name="idx_address_id_address"),
            models.Index(fields=["zip_code"], name="idx_address_zip_code"),
            models.Index(fields=["city"], name="idx_address_city"),
            models.Index(fields=["district"], name="idx_address_district"),
            models.Index(fields=["street"], name="idx_address_street"),
            models.Index(fields=["housenumber"], name="idx_address_housenumber"),
            models.Index(
                fields=["house_number_suffix"], name="idx_address_h_number_suffix"
            ),
            models.Index(
                fields=["status_development"], name="idx_address_status_development"
            ),
            models.Index(fields=["project"], name="idx_address_project"),
            models.Index(fields=["flag"], name="idx_address_flag"),
            gis_models.Index(fields=["geom"], name="idx_address_geom"),
        ]

    def __str__(self):
        """Return the address."""
        return f"{self.street} {self.housenumber} {self.house_number_suffix}"


class OlAddress(models.Model):
    """Stores all addresses rendered on Openlayers,
    related to :model:`api.Address`,
    :model:`api.AttributesStatusDevelopment`,
    :model:`api.Flags`,
    :model:`api.Projects`.
    """

    uuid = models.UUIDField(primary_key=True)
    id_address = models.IntegerField(_("Address ID"))
    zip_code = models.TextField(_("Zip Code"))
    city = models.TextField(_("City"))
    district = models.TextField(_("District"))
    street = models.TextField(_("Street"))
    housenumber = models.IntegerField(_("Housenumber"))
    house_number_suffix = models.TextField(_("House Number Suffix"))
    geom = gis_models.PointField(_("Geometry"), srid=int(settings.DEFAULT_SRID))
    flag = models.ForeignKey(
        Flags,
        null=False,
        on_delete=models.DO_NOTHING,
        db_column="flag",
        db_index=False,
        verbose_name=_("Flag"),
    )
    project = models.ForeignKey(
        Projects,
        null=False,
        on_delete=models.DO_NOTHING,
        db_column="project",
        db_index=False,
        verbose_name=_("Project"),
    )
    status_development = models.ForeignKey(
        AttributesStatusDevelopment,
        null=True,
        on_delete=models.DO_NOTHING,
        db_column="status_development",
        db_index=False,
        verbose_name=_("Status Development"),
    )

    class Meta:
        managed = False
        db_table = "ol_address"
        verbose_name = _("OL Address")
        verbose_name_plural = _("Openlayers Addresses")
        ordering = ["street", "housenumber", "house_number_suffix"]


class Node(models.Model):
    """Stores all nodes,
    related to :model:`api.Address`,
    :model:`api.AttributesNodeType`,
    :model:`api.AttributesStatus`,
    :model:`api.AttributesNetworkLevel`,
    :model:`api.AttributesCompany`,
    :model:`api.Flags`,
    :model:`api.Projects`.
    """

    uuid = models.UUIDField(default=uuid.uuid4, primary_key=True)
    name = models.TextField(_("Node Name"), null=False)
    node_type = models.ForeignKey(
        AttributesNodeType,
        null=False,
        on_delete=models.DO_NOTHING,
        db_column="node_type",
        db_index=False,
        verbose_name=_("Node Type"),
    )
    uuid_address = models.ForeignKey(
        Address,
        null=True,
        on_delete=models.DO_NOTHING,
        db_column="uuid_address",
        db_index=False,
        verbose_name=_("Address"),
    )
    status = models.ForeignKey(
        AttributesStatus,
        null=True,
        on_delete=models.DO_NOTHING,
        db_column="status",
        db_index=False,
        verbose_name=_("Status"),
    )
    network_level = models.ForeignKey(
        AttributesNetworkLevel,
        null=True,
        on_delete=models.DO_NOTHING,
        db_column="network_level",
        db_index=False,
        verbose_name=_("Network Level"),
    )
    owner = models.ForeignKey(
        AttributesCompany,
        null=True,
        on_delete=models.DO_NOTHING,
        db_column="owner",
        db_index=False,
        verbose_name=_("Owner"),
        related_name="owned_nodes",
    )
    constructor = models.ForeignKey(
        AttributesCompany,
        null=True,
        on_delete=models.DO_NOTHING,
        db_column="constructor",
        db_index=False,
        verbose_name=_("Constructor"),
        related_name="constructed_nodes",
    )
    manufacturer = models.ForeignKey(
        AttributesCompany,
        null=True,
        on_delete=models.DO_NOTHING,
        db_column="manufacturer",
        db_index=False,
        verbose_name=_("Manufacturer"),
        related_name="manufactured_nodes",
    )
    warranty = models.DateField(_("Warranty"), null=True)
    date = models.DateField(_("Date"), null=True)
    geom = gis_models.PointField(_("Geometry"), srid=int(settings.DEFAULT_SRID))
    canvas_x = models.FloatField(_("Canvas X"), null=True, blank=True)
    canvas_y = models.FloatField(_("Canvas Y"), null=True, blank=True)

    files = GenericRelation(
        FeatureFiles,
        content_type_field="content_type",
        object_id_field="object_id",
        related_query_name="node",
    )

    flag = models.ForeignKey(
        Flags,
        null=False,
        on_delete=models.DO_NOTHING,
        db_column="flag",
        db_index=False,
        verbose_name=_("Flag"),
    )
    project = models.ForeignKey(
        Projects,
        null=False,
        on_delete=models.DO_NOTHING,
        db_column="project",
        db_index=False,
        verbose_name=_("Project"),
    )

    class Meta:
        db_table = "node"
        verbose_name = _("Node")
        verbose_name_plural = _("Nodes")
        ordering = ["name"]
        indexes = [
            models.Index(fields=["name"], name="idx_node_name"),
            models.Index(fields=["node_type"], name="idx_node_node_type"),
            models.Index(fields=["uuid_address"], name="idx_node_uuid_address"),
            models.Index(fields=["status"], name="idx_node_status"),
            models.Index(fields=["network_level"], name="idx_node_network_level"),
            models.Index(fields=["owner"], name="idx_node_owner"),
            models.Index(fields=["constructor"], name="idx_node_constructor"),
            models.Index(fields=["manufacturer"], name="idx_node_manufacturer"),
            models.Index(fields=["warranty"], name="idx_node_warranty"),
            models.Index(fields=["date"], name="idx_node_date"),
            models.Index(fields=["canvas_x"], name="idx_node_canvas_x"),
            models.Index(fields=["canvas_y"], name="idx_node_canvas_y"),
            gis_models.Index(fields=["geom"], name="idx_node_geom"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "name"],
                name="unique_node",
            ),
        ]

    def __str__(self):
        """Return the node name."""
        return self.name


class OlNode(models.Model):
    """Stores all nodes rendered on Openlayers,
    related to :model:`api.Node`,
    :model:`api.AttributesNodeType`,
    :model:`api.AttributesStatus`,
    :model:`api.AttributesNetworkLevel`,
    :model:`api.AttributesCompany`,
    :model:`api.Flags`,
    :model:`api.Projects`.
    """

    uuid = models.UUIDField(primary_key=True)
    name = models.TextField(_("Node Name"))
    node_type = models.ForeignKey(
        AttributesNodeType,
        null=False,
        on_delete=models.DO_NOTHING,
        db_column="node_type",
        db_index=False,
        verbose_name=_("Node Type"),
    )
    uuid_address = models.ForeignKey(
        Address,
        null=True,
        on_delete=models.DO_NOTHING,
        db_column="uuid_address",
        db_index=False,
        verbose_name=_("Address"),
    )
    status = models.ForeignKey(
        AttributesStatus,
        null=True,
        on_delete=models.DO_NOTHING,
        db_column="status",
        db_index=False,
        verbose_name=_("Status"),
    )
    network_level = models.ForeignKey(
        AttributesNetworkLevel,
        null=True,
        on_delete=models.DO_NOTHING,
        db_column="network_level",
        db_index=False,
        verbose_name=_("Network Level"),
    )
    owner = models.ForeignKey(
        AttributesCompany,
        null=True,
        on_delete=models.DO_NOTHING,
        db_column="owner",
        db_index=False,
        verbose_name=_("Owner"),
        related_name="owned_ol_nodes",
    )
    constructor = models.ForeignKey(
        AttributesCompany,
        null=True,
        on_delete=models.DO_NOTHING,
        db_column="constructor",
        db_index=False,
        verbose_name=_("Constructor"),
        related_name="constructed_ol_nodes",
    )
    manufacturer = models.ForeignKey(
        AttributesCompany,
        null=True,
        on_delete=models.DO_NOTHING,
        db_column="manufacturer",
        db_index=False,
        verbose_name=_("Manufacturer"),
        related_name="manufactured_ol_nodes",
    )
    warranty = models.DateField(_("Warranty"), null=True)
    date = models.DateField(_("Date"), null=True)
    geom = gis_models.PointField(_("Geometry"), srid=int(settings.DEFAULT_SRID))
    flag = models.ForeignKey(
        Flags,
        null=False,
        on_delete=models.DO_NOTHING,
        db_column="flag",
        db_index=False,
        verbose_name=_("Flag"),
    )
    project = models.ForeignKey(
        Projects,
        null=False,
        on_delete=models.DO_NOTHING,
        db_column="project",
        db_index=False,
        verbose_name=_("Project"),
    )

    class Meta:
        managed = False
        db_table = "ol_node"
        verbose_name = _("OL Node")
        verbose_name_plural = _("Openlayers Nodes")
        ordering = ["name"]


class Microduct(models.Model):
    """Stores all microducts,
    related to :model:`api.Conduit`.
    """

    uuid = models.UUIDField(default=uuid.uuid4, primary_key=True)
    uuid_conduit = models.ForeignKey(
        Conduit,
        null=False,
        on_delete=models.CASCADE,
        db_column="uuid_conduit",
        db_index=False,
        verbose_name=_("Conduit"),
    )
    number = models.IntegerField(_("Number"), null=False, db_index=False)
    color = models.TextField(_("Color"), null=False, db_index=False)
    microduct_status = models.ForeignKey(
        AttributesMicroductStatus,
        null=True,
        on_delete=models.SET_NULL,
        db_column="microduct_status",
        db_index=False,
        verbose_name=_("Microduct Status"),
    )
    uuid_node = models.ForeignKey(
        Node,
        null=True,
        on_delete=models.SET_NULL,
        db_column="uuid_node",
        db_index=False,
        verbose_name=_("Node"),
    )

    class Meta:
        db_table = "microduct"
        verbose_name = _("Microduct")
        verbose_name_plural = _("Microducts")
        ordering = ["uuid_conduit", "number"]
        indexes = [
            models.Index(fields=["uuid_conduit"], name="idx_microduct_conduit"),
            models.Index(fields=["number"], name="idx_microduct_number"),
            models.Index(fields=["color"], name="idx_microduct_color"),
            models.Index(fields=["microduct_status"], name="idx_microduct_status"),
            models.Index(fields=["uuid_node"], name="idx_microduct_node"),
        ]

    def __str__(self):
        return self.uuid_conduit.name + "-" + str(self.number)


@receiver(post_save, sender=Conduit)
def create_microducts_for_conduit(sender, instance, created, **kwargs):
    """
    Signal to automatically create microducts when a conduit is created.
    Creates microducts based on the ConduitTypeColorMapping for the conduit's type.
    """
    if created and instance.conduit_type:
        color_mappings = (
            ConduitTypeColorMapping.objects.filter(conduit_type=instance.conduit_type)
            .select_related("color")
            .order_by("position")
        )

        if color_mappings.exists():
            for mapping in color_mappings:
                try:
                    Microduct.objects.create(
                        uuid_conduit=instance,
                        number=mapping.position,
                        color=mapping.color.name_de,
                    )
                except Exception as e:
                    print(f"Error creating microduct for conduit {instance.name}: {e}")
                    continue


class MicroductConnection(models.Model):
    """Stores all microduct connections,
    related to :model:`api.Microduct`.
    """

    uuid = models.UUIDField(default=uuid.uuid4, primary_key=True)
    uuid_microduct_from = models.ForeignKey(
        Microduct,
        null=False,
        on_delete=models.CASCADE,
        db_column="uuid_microduct_from",
        db_index=False,
        verbose_name=_("Microduct From"),
        related_name="microduct_connections_from",
    )
    uuid_trench_from = models.ForeignKey(
        Trench,
        null=False,
        on_delete=models.CASCADE,
        db_column="uuid_trench_from",
        db_index=False,
        verbose_name=_("Trench From"),
        related_name="microduct_connections_trench_from",
    )
    uuid_microduct_to = models.ForeignKey(
        Microduct,
        null=False,
        on_delete=models.CASCADE,
        db_column="uuid_microduct_to",
        db_index=False,
        verbose_name=_("Microduct To"),
        related_name="microduct_connections_to",
    )
    uuid_trench_to = models.ForeignKey(
        Trench,
        null=False,
        on_delete=models.CASCADE,
        db_column="uuid_trench_to",
        db_index=False,
        verbose_name=_("Trench To"),
        related_name="microduct_connections_trench_to",
    )
    uuid_node = models.ForeignKey(
        Node,
        null=False,
        on_delete=models.CASCADE,
        db_column="uuid_node",
        db_index=False,
        verbose_name=_("Node"),
    )

    class Meta:
        db_table = "microduct_connection"
        verbose_name = _("Microduct Connection")
        verbose_name_plural = _("Microduct Connections")
        ordering = ["uuid_microduct_from", "uuid_microduct_to"]
        indexes = [
            models.Index(
                fields=["uuid_microduct_from"], name="idx_microduct_connection_from"
            ),
            models.Index(
                fields=["uuid_microduct_to"], name="idx_microduct_connection_to"
            ),
            models.Index(
                fields=["uuid_trench_from"], name="idx_microduct_connection_tr_fr"
            ),
            models.Index(
                fields=["uuid_trench_to"], name="idx_microduct_connection_tr_to"
            ),
            models.Index(fields=["uuid_node"], name="idx_microduct_connection_node"),
        ]

    def __str__(self):
        return self.uuid_microduct_from.name + " -> " + self.uuid_microduct_to.name


class CanvasSyncStatus(models.Model):
    """
    Tracks canvas coordinate synchronization operations to prevent concurrent syncs.
    Ensures only one sync operation runs per project/flag combination at a time.
    """

    SYNC_STATUS_CHOICES = [
        ("IDLE", "Idle"),
        ("IN_PROGRESS", "In Progress"),
        ("COMPLETED", "Completed"),
        ("FAILED", "Failed"),
    ]

    sync_key = models.CharField(
        max_length=100,
        unique=True,
        help_text="Unique identifier for sync operation (e.g., 'project_1', 'project_1_flag_5')",
    )
    status = models.CharField(
        max_length=20, choices=SYNC_STATUS_CHOICES, default="IDLE"
    )
    started_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True
    )
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    last_heartbeat = models.DateTimeField(null=True, blank=True)

    # Sync metadata
    scale = models.FloatField(null=True, blank=True)
    center_x = models.FloatField(null=True, blank=True)
    center_y = models.FloatField(null=True, blank=True)
    nodes_processed = models.IntegerField(default=0)
    error_message = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "canvas_sync_status"
        verbose_name = _("Canvas Sync Status")
        verbose_name_plural = _("Canvas Sync Statuses")

    def __str__(self):
        return f"{self.sync_key} - {self.status}"

    def is_stale(self, timeout_minutes=10):
        """Check if sync operation is stale (no heartbeat for timeout_minutes)"""
        if not self.last_heartbeat:
            return True
        return timezone.now() - self.last_heartbeat > timezone.timedelta(
            minutes=timeout_minutes
        )

    def update_heartbeat(self):
        """Update heartbeat timestamp to indicate sync is still active"""
        self.last_heartbeat = timezone.now()
        self.save(update_fields=["last_heartbeat"])

    @classmethod
    def get_sync_key(cls, project_id, flag_id=None):
        """Generate consistent sync key for project/flag combination"""
        if flag_id:
            return f"project_{project_id}_flag_{flag_id}"
        return f"project_{project_id}"

    @classmethod
    def cleanup_stale_syncs(cls, timeout_minutes=10):
        """Clean up stale sync operations that are stuck in IN_PROGRESS"""
        stale_cutoff = timezone.now() - timezone.timedelta(minutes=timeout_minutes)
        cls.objects.filter(
            status="IN_PROGRESS", last_heartbeat__lt=stale_cutoff
        ).update(
            status="FAILED",
            completed_at=timezone.now(),
            error_message="Sync operation timed out",
        )


class Cable(models.Model):
    """Stores all cables,
    related to :model:`api.MicroductCableConnection`,
    :model:`api.AttributesCableType`,
    :model:`api.AttributesStatus`,
    :model:`api.AttributesCompany`,
    :model:`api.Node`,
    :model:`api.Flags`,
    :model:`api.Projects`.
    """

    uuid = models.UUIDField(default=uuid.uuid4, primary_key=True)
    name = models.TextField(
        null=False,
        unique=True,
        db_index=False,
        verbose_name=_("Cable Name"),
    )
    cable_type = models.ForeignKey(
        AttributesCableType,
        null=False,
        on_delete=models.CASCADE,
        db_column="cable_type",
        db_index=False,
        verbose_name=_("Cable Type"),
    )
    status = models.ForeignKey(
        AttributesStatus,
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="status",
        db_index=False,
        verbose_name=_("Status"),
    )
    network_level = models.ForeignKey(
        AttributesNetworkLevel,
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="network_level",
        db_index=False,
        verbose_name=_("Network Level"),
    )
    owner = models.ForeignKey(
        AttributesCompany,
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="owner",
        db_index=False,
        verbose_name=_("Owner"),
        related_name="owned_cables",
    )
    constructor = models.ForeignKey(
        AttributesCompany,
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="constructor",
        db_index=False,
        verbose_name=_("Constructor"),
        related_name="constructed_cables",
    )
    manufacturer = models.ForeignKey(
        AttributesCompany,
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="manufacturer",
        db_index=False,
        verbose_name=_("Manufacturer"),
        related_name="manufactured_cables",
    )
    date = models.DateField(_("Date"), null=True, blank=True)
    uuid_node_start = models.ForeignKey(
        Node,
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="uuid_node_start",
        db_index=False,
        verbose_name=_("Node Start"),
        related_name="node_start_cables",
    )
    uuid_node_end = models.ForeignKey(
        Node,
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="uuid_node_end",
        db_index=False,
        verbose_name=_("Node End"),
        related_name="node_end_cables",
    )
    length = models.FloatField(_("Length"), null=True, blank=True)
    length_total = models.FloatField(_("Length Total"), null=True, blank=True)
    reserve_at_start = models.IntegerField(_("Reserve At Start"), null=True, blank=True)
    reserve_at_end = models.IntegerField(_("Reserve At End"), null=True, blank=True)
    reserve_section = models.IntegerField(_("Reserve Section"), null=True, blank=True)
    handle_start = models.CharField(
        _("Handle Start"),
        max_length=10,
        null=True,
        blank=True,
        help_text=_("Handle position at start node (top, right, bottom, left)"),
    )
    handle_end = models.CharField(
        _("Handle End"),
        max_length=10,
        null=True,
        blank=True,
        help_text=_("Handle position at end node (top, right, bottom, left)"),
    )
    diagram_path = models.JSONField(
        _("Diagram Path"),
        null=True,
        blank=True,
        help_text=_(
            "Custom waypoints for diagram edge path as array of {x, y} coordinates"
        ),
    )

    files = GenericRelation(
        FeatureFiles,
        content_type_field="content_type",
        object_id_field="object_id",
        related_query_name="cable",
    )

    project = models.ForeignKey(
        Projects,
        null=False,
        on_delete=models.DO_NOTHING,
        db_column="project",
        db_index=False,
        verbose_name=_("Project"),
    )
    flag = models.ForeignKey(
        Flags,
        null=False,
        on_delete=models.DO_NOTHING,
        db_column="flag",
        db_index=False,
        verbose_name=_("Flag"),
    )

    class Meta:
        db_table = "cable"
        verbose_name = _("Cable")
        verbose_name_plural = _("Cables")
        ordering = ["name"]
        indexes = [
            models.Index(fields=["name"], name="idx_cable_name"),
            models.Index(fields=["cable_type"], name="idx_cable_cable_type"),
            models.Index(fields=["status"], name="idx_cable_status"),
            models.Index(fields=["network_level"], name="idx_cable_network_level"),
            models.Index(fields=["owner"], name="idx_cable_owner"),
            models.Index(fields=["constructor"], name="idx_cable_constructor"),
            models.Index(fields=["manufacturer"], name="idx_cable_manufacturer"),
            models.Index(fields=["date"], name="idx_cable_date"),
            models.Index(fields=["uuid_node_start"], name="idx_cable_uuid_node_start"),
            models.Index(fields=["uuid_node_end"], name="idx_cable_uuid_node_end"),
            models.Index(fields=["length"], name="idx_cable_length"),
            models.Index(fields=["length_total"], name="idx_cable_length_total"),
            models.Index(
                fields=["reserve_at_start"], name="idx_cable_reserve_at_start"
            ),
            models.Index(fields=["reserve_at_end"], name="idx_cable_reserve_at_end"),
            models.Index(fields=["reserve_section"], name="idx_cable_reserve_section"),
            models.Index(fields=["handle_start"], name="idx_cable_handle_start"),
            models.Index(fields=["handle_end"], name="idx_cable_handle_end"),
            models.Index(fields=["diagram_path"], name="idx_cable_diagram_path"),
            models.Index(fields=["project"], name="idx_cable_project"),
            models.Index(fields=["flag"], name="idx_cable_flag"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "name"],
                name="unique_cable",
            ),
        ]

    def __str__(self):
        return self.name


class CableLabel(models.Model):
    """Stores diagram labels for cables,
    related to :model:`api.Cable`.
    Allows multiple positionable labels per cable in the network diagram.
    """

    uuid = models.UUIDField(default=uuid.uuid4, primary_key=True)
    cable = models.ForeignKey(
        Cable,
        null=False,
        on_delete=models.CASCADE,
        db_column="cable",
        db_index=True,
        verbose_name=_("Cable"),
        related_name="labels",
    )
    text = models.TextField(
        _("Label Text"),
        null=False,
        blank=False,
        help_text=_("The text content to display on the label"),
    )
    position_x = models.FloatField(
        _("Position X"),
        null=True,
        blank=True,
        help_text=_("X coordinate of the label in the diagram canvas"),
    )
    position_y = models.FloatField(
        _("Position Y"),
        null=True,
        blank=True,
        help_text=_("Y coordinate of the label in the diagram canvas"),
    )
    order = models.IntegerField(
        _("Order"),
        default=0,
        help_text=_("Display order when multiple labels exist"),
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "cable_label"
        verbose_name = _("Cable Label")
        verbose_name_plural = _("Cable Labels")
        ordering = ["cable", "order"]
        indexes = [
            models.Index(fields=["cable"], name="idx_cable_label_cable"),
            models.Index(fields=["order"], name="idx_cable_label_order"),
        ]

    def __str__(self):
        return f"{self.cable.name} - {self.text[:50]}"


class MicroductCableConnection(models.Model):
    """Stores all microduct cable connections,
    related to :model:`api.Microduct`,
    :model:`api.Cable`.
    """

    uuid = models.UUIDField(default=uuid.uuid4, primary_key=True)
    uuid_microduct = models.ForeignKey(
        Microduct,
        null=False,
        on_delete=models.CASCADE,
        db_column="uuid_microduct",
        db_index=False,
        verbose_name=_("Microduct"),
    )
    uuid_cable = models.ForeignKey(
        Cable,
        null=False,
        on_delete=models.CASCADE,
        db_column="uuid_cable",
        db_index=False,
        verbose_name=_("Cable"),
    )

    class Meta:
        db_table = "microduct_cable_connection"
        verbose_name = _("Microduct Cable Connection")
        verbose_name_plural = _("Microduct Cable Connections")
        ordering = ["uuid_microduct", "uuid_cable"]
        indexes = [
            models.Index(
                fields=["uuid_microduct"],
                name="idx_md_cable_con_uuid_md",
            ),
            models.Index(fields=["uuid_cable"], name="idx_md_cable_con_uuid_cable"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["uuid_microduct", "uuid_cable"],
                name="unique_microduct_cable_connection",
            ),
        ]

    def __str__(self):
        return (
            self.uuid_microduct.uuid_conduit.name
            + "-"
            + str(self.uuid_microduct.number)
            + " to "
            + self.uuid_cable.name
        )


@receiver(pre_save, sender=Cable)
def track_cable_name_change(sender, instance, **kwargs):
    """
    Track the old cable name before save to detect if it changed.
    Stores the old name as a temporary attribute on the instance.
    """
    if instance.pk:
        try:
            old_cable = Cable.objects.get(pk=instance.pk)
            instance._old_name = old_cable.name
        except Cable.DoesNotExist:
            instance._old_name = None
    else:
        instance._old_name = None


@receiver(post_save, sender=Cable)
def update_cable_labels_on_name_change(sender, instance, created, **kwargs):
    """
    Automatically update all cable labels when the cable name changes.
    Updates CableLabel.text to match the new Cable.name.
    """
    if created:
        return

    old_name = getattr(instance, "_old_name", None)
    if old_name is not None and old_name != instance.name:
        instance.labels.update(text=instance.name)


class ConduitTypeColorMapping(models.Model):
    """Maps positions to colors for each conduit type."""

    uuid = models.UUIDField(default=uuid.uuid4, primary_key=True)
    conduit_type = models.ForeignKey(
        AttributesConduitType,
        on_delete=models.CASCADE,
        related_name="color_mappings",
        verbose_name=_("Conduit Type"),
    )
    position = models.IntegerField(
        _("Position"), help_text=_("Microduct position/number (1-12, etc.)")
    )
    color = models.ForeignKey(
        AttributesMicroductColor, on_delete=models.PROTECT, verbose_name=_("Color")
    )

    class Meta:
        db_table = "conduit_type_color_mapping"
        verbose_name = _("Conduit Type Color Mapping")
        verbose_name_plural = _("Conduit Type Color Mappings")
        unique_together = [["conduit_type", "position"]]
        ordering = ["conduit_type", "position"]

    def __str__(self):
        return (
            f"{self.conduit_type.conduit_type} - {self.position} - {self.color.name_de}"
        )


class CableTypeColorMapping(models.Model):
    """Maps positions to colors for bundles and fibers in each cable type.

    Supports configurable color sequences for both bundle and fiber positions,
    allowing different color standards (DIN, IEC, etc.) per cable type.
    """

    POSITION_TYPE_CHOICES = [
        ("bundle", _("Bundle")),
        ("fiber", _("Fiber")),
    ]

    LAYER_CHOICES = [
        ("inner", _("Inner")),
        ("outer", _("Outer")),
    ]

    uuid = models.UUIDField(default=uuid.uuid4, primary_key=True)
    cable_type = models.ForeignKey(
        AttributesCableType,
        on_delete=models.CASCADE,
        related_name="color_mappings",
        verbose_name=_("Cable Type"),
    )
    position_type = models.CharField(
        _("Position Type"),
        max_length=10,
        choices=POSITION_TYPE_CHOICES,
        help_text=_("Whether this mapping is for bundle or fiber colors"),
    )
    position = models.IntegerField(
        _("Position"), help_text=_("Bundle/Fiber position number (1-12, etc.)")
    )
    color = models.ForeignKey(
        AttributesFiberColor,
        on_delete=models.PROTECT,
        verbose_name=_("Color"),
    )

    layer = models.TextField(
        _("Layer"),
        default="inner",
        help_text=_("Inner or outer layer"),
        choices=LAYER_CHOICES,
    )

    class Meta:
        db_table = "cable_type_color_mapping"
        verbose_name = _("Cable Type Color Mapping")
        verbose_name_plural = _("Cable Type Color Mappings")
        unique_together = [["cable_type", "position_type", "position"]]
        ordering = ["cable_type", "position_type", "position"]
        indexes = [
            models.Index(
                fields=["cable_type", "position_type"], name="idx_cable_color_type"
            ),
        ]

    def __str__(self):
        return f"{self.cable_type.cable_type} - {self.position_type} - {self.position} - {self.color.name_de}"


class Fiber(models.Model):
    """Stores all fibers,
    related to :model:`api.Cable`, :model:`api.Bundle`.
    """

    uuid = models.UUIDField(
        default=uuid.uuid4, primary_key=True, help_text=_("The UUID of the fiber")
    )
    uuid_cable = models.ForeignKey(
        Cable,
        null=False,
        on_delete=models.CASCADE,
        db_column="uuid_cable",
        db_index=False,
        verbose_name=_("Cable"),
        help_text=_("The cable that the fiber belongs to"),
    )
    bundle_number = models.IntegerField(
        _("Bundle Number"),
        null=False,
        help_text=_("The bundle number that the fiber belongs to"),
    )
    bundle_color = models.TextField(
        _("Bundle Color"),
        null=False,
        blank=False,
        help_text=_("The color of the bundle that the fiber belongs to"),
    )
    fiber_number_absolute = models.IntegerField(
        _("Fiber Number Absolute"),
        null=False,
        help_text=_("The absolute fiber number that the fiber belongs to"),
    )
    fiber_number_in_bundle = models.IntegerField(
        _("Fiber Number In Bundle"),
        null=False,
        help_text=_("The number of the fiber in the bundle that the fiber belongs to"),
    )
    fiber_color = models.TextField(
        _("Fiber Color"),
        null=False,
        help_text=_("The color of the fiber that the fiber belongs to"),
    )
    active = models.BooleanField(
        _("Active"),
        null=False,
        default=True,
        help_text=_("Whether the fiber is active"),
    )
    fiber_status = models.ForeignKey(
        AttributesFiberStatus,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        db_column="fiber_status",
        db_index=False,
        verbose_name=_("Fiber Status"),
    )
    layer = models.TextField(
        _("Layer"),
        default="inner",
        help_text=_("Inner or outer layer"),
        blank=False,
        null=False,
    )
    flag = models.ForeignKey(
        Flags,
        null=False,
        on_delete=models.PROTECT,
        db_column="flag",
        db_index=False,
        verbose_name=_("Flag"),
    )
    project = models.ForeignKey(
        Projects,
        null=False,
        on_delete=models.PROTECT,
        db_column="project",
        db_index=False,
        verbose_name=_("Project"),
    )

    class Meta:
        db_table = "fiber"
        verbose_name = _("Fiber")
        verbose_name_plural = _("Fibers")
        ordering = [
            "uuid_cable",
            "fiber_number_absolute",
            "bundle_number",
            "fiber_number_in_bundle",
        ]
        indexes = [
            models.Index(fields=["uuid_cable"], name="idx_fiber_cable"),
            models.Index(fields=["bundle_number"], name="idx_fiber_bundle_number"),
            models.Index(fields=["bundle_color"], name="idx_fiber_bundle_color"),
            models.Index(
                fields=["fiber_number_absolute"], name="idx_fiber_number_absolute"
            ),
            models.Index(
                fields=["fiber_number_in_bundle"],
                name="idx_fiber_number_in_bundle",
            ),
            models.Index(fields=["fiber_color"], name="idx_fiber_fiber_color"),
            models.Index(fields=["active"], name="idx_fiber_active"),
            models.Index(fields=["fiber_status"], name="idx_fiber_fiber_status"),
            models.Index(fields=["layer"], name="idx_fiber_layer"),
            models.Index(fields=["flag"], name="idx_fiber_flag"),
            models.Index(fields=["project"], name="idx_fiber_project"),
        ]

    def __str__(self):
        return f"{self.uuid_cable.name} - {self.bundle_number} - {self.fiber_number_absolute}"


@receiver(post_save, sender=Cable)
def create_fibers_for_cable(sender, instance, created, **kwargs):
    """
    Signal to automatically create fibers when a cable is created.
    Creates fibers based on the CableTypeColorMapping configurations for the cable's type.
    Uses cable type's bundle_count and bundle_fiber_count to organize fibers properly.
    """
    if not created:
        return

    cable_type = instance.cable_type

    bundle_mappings = (
        CableTypeColorMapping.objects.filter(
            cable_type=cable_type, position_type="bundle"
        )
        .select_related("color")
        .order_by("position")
    )

    fiber_mappings = (
        CableTypeColorMapping.objects.filter(
            cable_type=cable_type, position_type="fiber"
        )
        .select_related("color")
        .order_by("position")
    )

    if not bundle_mappings.exists() or not fiber_mappings.exists():
        return

    bundle_count = cable_type.bundle_count
    bundle_fiber_count = cable_type.bundle_fiber_count

    if bundle_mappings.count() < bundle_count:
        return

    if fiber_mappings.count() < bundle_fiber_count:
        return

    fibers_to_create = []
    fiber_number_absolute = 1
    for bundle_number in range(1, bundle_count + 1):
        bundle_mapping = bundle_mappings.filter(position=bundle_number).first()
        bundle_color = (
            bundle_mapping.color.name_de
            if bundle_mapping
            else f"Bundle {bundle_number}"
        )

        for fiber_in_bundle in range(1, bundle_fiber_count + 1):
            fiber_mapping = fiber_mappings.filter(position=fiber_in_bundle).first()
            fiber_color = (
                fiber_mapping.color.name_de
                if fiber_mapping
                else f"Fiber {fiber_in_bundle}"
            )
            layer = fiber_mapping.layer if fiber_mapping else _("Inner")

            fiber = Fiber(
                uuid_cable=instance,
                bundle_number=bundle_number,
                bundle_color=bundle_color,
                fiber_number_absolute=fiber_number_absolute,
                fiber_number_in_bundle=fiber_in_bundle,
                fiber_color=fiber_color,
                active=True,
                fiber_status=None,
                flag=instance.flag,
                project=instance.project,
                layer=layer,
            )
            fibers_to_create.append(fiber)
            fiber_number_absolute += 1

    if fibers_to_create:
        Fiber.objects.bulk_create(fibers_to_create)


class QGISProject(models.Model):
    """Stores QGIS project files for WMS/WFS services.

    Projects are stored in deployment/qgis/projects/ and can be accessed via:
    - WMS: https://domain/qgis/?SERVICE=WMS&MAP=/projects/{name}.qgs
    - WFS: https://domain/qgis/?SERVICE=WFS&MAP=/projects/{name}.qgs
    """

    uuid = models.UUIDField(default=uuid.uuid4, primary_key=True)
    name = models.SlugField(
        _("Project Name"),
        max_length=100,
        unique=True,
        help_text=_(
            "Slug-like identifier used in WMS/WFS URLs (e.g., 'infrastructure', 'public-map')"
        ),
    )
    display_name = models.CharField(
        _("Display Name"),
        max_length=200,
        help_text=_("Human-readable project name"),
    )
    description = models.TextField(
        _("Description"),
        blank=True,
        help_text=_("Optional description of this QGIS project"),
    )

    def get_qgis_upload_path(instance, filename):
        """
        Generate upload path for QGIS project files.
        Files are stored as: {name}.qgs or {name}.qgz
        """
        ext = os.path.splitext(filename)[1]
        return f"{instance.name}{ext}"

    project_file = models.FileField(
        _("QGIS Project File"),
        upload_to=get_qgis_upload_path,
        storage=QGISProjectStorage(),
        help_text=_("QGIS project file (.qgs or .qgz)"),
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name=_("Created By"),
    )

    class Meta:
        db_table = "qgis_projects"
        verbose_name = _("QGIS Project")
        verbose_name_plural = _("QGIS Projects")
        ordering = ["display_name", "-created_at"]

    def __str__(self):
        return self.display_name

    def clean(self):
        """Validate project file extension."""
        from django.core.exceptions import ValidationError

        if self.project_file:
            ext = os.path.splitext(self.project_file.name)[1].lower()
            if ext not in [".qgs", ".qgz"]:
                raise ValidationError(
                    {"project_file": _("Only .qgs and .qgz files are allowed.")}
                )

    def get_wms_url(self):
        """Get WMS access URL for this project."""
        return f"?SERVICE=WMS&MAP=/projects/{self.name}{os.path.splitext(self.project_file.name)[1]}"

    def get_wfs_url(self):
        """Get WFS access URL for this project."""
        return f"?SERVICE=WFS&MAP=/projects/{self.name}{os.path.splitext(self.project_file.name)[1]}"


@receiver(post_delete, sender=QGISProject)
def qgis_project_deleted(sender, instance, **kwargs):
    """
    Handle QGIS project deletion.
    - Delete the physical file from storage
    """
    if instance.project_file:
        try:
            instance.project_file.delete(save=False)
            logger.info(f"Deleted QGIS project file: {instance.project_file.name}")
        except Exception as e:
            logger.error(
                f"Error deleting QGIS project file {instance.project_file.name}: {e}"
            )


class LogEntry(models.Model):
    """Stores application logs for monitoring and debugging.

    Captures logs from both backend (Django) and frontend (SvelteKit) with
    context about the user, request path, and additional metadata.
    """

    LOG_LEVEL_CHOICES = [
        ("DEBUG", "Debug"),
        ("INFO", "Info"),
        ("WARNING", "Warning"),
        ("ERROR", "Error"),
        ("CRITICAL", "Critical"),
    ]

    SOURCE_CHOICES = [
        ("backend", "Backend"),
        ("frontend", "Frontend"),
        ("wfs", "WFS (QGIS Server)"),
    ]

    uuid = models.UUIDField(default=uuid.uuid4, primary_key=True)
    timestamp = models.DateTimeField(
        auto_now_add=True, db_index=True, verbose_name=_("Timestamp")
    )
    level = models.CharField(
        max_length=20,
        choices=LOG_LEVEL_CHOICES,
        db_index=True,
        verbose_name=_("Log Level"),
    )
    logger_name = models.CharField(
        max_length=255,
        verbose_name=_("Logger Name"),
        help_text=_("Name of the logger (e.g., 'apps.api', 'frontend.auth')"),
    )
    message = models.TextField(
        verbose_name=_("Message"), help_text=_("The log message")
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="application_logs",
        verbose_name=_("User"),
        help_text=_("User associated with this log entry"),
    )
    source = models.CharField(
        max_length=50,
        choices=SOURCE_CHOICES,
        default="backend",
        db_index=True,
        verbose_name=_("Source"),
        help_text=_("Whether this log came from backend or frontend"),
    )
    path = models.CharField(
        max_length=500,
        null=True,
        blank=True,
        verbose_name=_("Path"),
        help_text=_("Request path or URL where the log occurred"),
    )
    extra_data = models.JSONField(
        null=True,
        blank=True,
        verbose_name=_("Extra Data"),
        help_text=_("Additional context data (request method, IP, user agent, etc.)"),
    )
    project = models.ForeignKey(
        Projects,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="logs",
        verbose_name=_("Project"),
        help_text=_("Project associated with this log entry (if applicable)"),
    )

    class Meta:
        db_table = "log_entry"
        verbose_name = _("Log Entry")
        verbose_name_plural = _("Log Entries")
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["-timestamp"], name="idx_log_entry_timestamp"),
            models.Index(fields=["level"], name="idx_log_entry_level"),
            models.Index(fields=["user"], name="idx_log_entry_user"),
            models.Index(fields=["source"], name="idx_log_entry_source"),
            models.Index(fields=["logger_name"], name="idx_log_entry_logger_name"),
            models.Index(fields=["project"], name="idx_log_entry_project"),
        ]

    def __str__(self):
        return f"[{self.timestamp}] {self.level}: {self.message[:50]}"
