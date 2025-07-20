import uuid

from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey, GenericRelation
from django.contrib.contenttypes.models import ContentType
from django.contrib.gis.db import models as gis_models
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils.translation import gettext_lazy as _

from .storage import NextcloudStorage


class Projects(models.Model):
    """Stores all projects,
    related to :model:`api.Trench`.
    """

    id = models.IntegerField(primary_key=True)
    project = models.TextField(_("Project"), null=False, db_index=False, unique=True)
    description = models.TextField(_("Description"), null=True)

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
    )
    color_code = models.JSONField(_("Color Code"), null=False)
    conduit_type_alias = models.TextField(_("Conduit Type Alias"), null=True)
    conduit_type_microduct = models.IntegerField(_("Conduit Type Microduct"), null=True)

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


# TODO: Implement custom storage class for feature files (nextcloud): https://docs.djangoproject.com/en/4.2/howto/custom-file-storage/
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
            "model__in": ["trench", "node", "address", "residentialunit"],
        },
    )
    object_id = models.UUIDField(verbose_name=_("Feature ID"))
    feature = GenericForeignKey("content_type", "object_id")

    # TODO: Add test for get_upload_path
    def get_upload_path(instance, filename):
        # TODO: Implement a better manual mode
        # For now, we just use the default folder structure
        prefs = StoragePreferences.objects.first()
        if prefs and prefs.mode == "MANUAL":
            return "%Y/%m/%d/{filename}"

        if prefs and prefs.mode == "AUTO":
            model_name = instance.content_type.model
            file_extension = instance.get_file_type() or ""
            file_extension = file_extension.lower()

            try:
                category_obj = FileTypeCategory.objects.get(extension=file_extension)
                file_category = category_obj.category
            except FileTypeCategory.DoesNotExist:
                file_category = "documents"

            folder_paths = prefs.folder_structure.get(model_name, {})

            folder_name = folder_paths.get(
                file_category, folder_paths.get("default", model_name + "s")
            )
            if model_name == "trench":
                trench = instance.feature
                if "/" in folder_name:
                    base_folder, sub_folder = folder_name.split("/", 1)
                    return f"{base_folder}/{trench.id_trench}/{sub_folder}/{filename}"
                else:
                    return f"{folder_name}/{trench.id_trench}/{filename}"

            return f"{folder_name}/{filename}"

    file_path = models.FileField(
        upload_to=get_upload_path,
        storage=NextcloudStorage(),
        null=False,
        verbose_name=_("File Path"),
    )

    file_name = models.TextField(null=False, verbose_name=_("File Name"))
    file_type = models.TextField(null=True, verbose_name=_("File Type"))
    description = models.TextField(null=True, verbose_name=_("Description"))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("Created At"))

    def get_file_name(instance):
        file_name = instance.file_path.name
        try:
            parts = file_name.split(".")
            return parts[0] if len(parts) > 1 else file_name
        except Exception:
            return file_name

    def get_file_type(instance):
        file_name = instance.file_path.name
        try:
            parts = file_name.split(".")
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


class StoragePreferences(models.Model):
    """Stores all storage preferences for different models,
    related to :model:`api.FeatureFiles`.
    """

    STORAGE_MODE_CHOICES = [
        ("AUTO", "Automatic Organization"),
        ("MANUAL", "User Defined"),
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


# OL VIEW
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


class GtPkMetadata(models.Model):
    """Stores all primary key metadata for different models,
    used for geoserver,
    related to :model:`api.Trench`.
    """

    table_schema = models.CharField(max_length=32, null=False)
    table_name = models.CharField(max_length=32, null=False)
    pk_column = models.CharField(max_length=32, null=False)
    pk_column_idx = models.IntegerField(null=True)
    pk_policy = models.CharField(max_length=32, null=True)
    pk_sequence = models.CharField(max_length=64, null=True)

    class Meta:
        db_table = "gt_pk_metadata"
        verbose_name = _("GT PK Metadata")
        verbose_name_plural = _("GT PK Metadata")
        indexes = [
            models.Index(
                fields=["table_schema", "table_name", "pk_column"],
                name="idx_gpm_schema_name_pk_column",
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["table_schema", "table_name", "pk_column"],
                name="unique_gt_pk_metadata",
            ),
        ]

    def __str__(self):
        return f"{self.table_schema}.{self.table_name}.{self.pk_column}"


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
    Creates microducts based on the color_code field in the conduit's conduit_type.
    """
    if created and instance.conduit_type and instance.conduit_type.color_code:
        color_code = instance.conduit_type.color_code

        for number, color in color_code.items():
            try:
                microduct_number = int(number)

                Microduct.objects.create(
                    uuid_conduit=instance, number=microduct_number, color=color
                )

            except (ValueError, TypeError) as e:
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
    uuid_microduct_to = models.ForeignKey(
        Microduct,
        null=False,
        on_delete=models.CASCADE,
        db_column="uuid_microduct_to",
        db_index=False,
        verbose_name=_("Microduct To"),
        related_name="microduct_connections_to",
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
            models.Index(fields=["uuid_node"], name="idx_microduct_connection_node"),
        ]

    def __str__(self):
        return self.uuid_microduct_from.name + " -> " + self.uuid_microduct_to.name
