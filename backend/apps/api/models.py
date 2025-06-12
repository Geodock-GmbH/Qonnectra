import uuid

from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey, GenericRelation
from django.contrib.contenttypes.models import ContentType
from django.contrib.gis.db import models as gis_models
from django.db import models
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
    construction_type = models.TextField(null=False, db_index=False)

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
    status = models.TextField(null=False, db_index=False, unique=True)

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
    phase = models.TextField(null=False, db_index=False)

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
    company = models.TextField(null=False, db_index=False)
    city = models.TextField(null=True)
    postal_code = models.TextField(null=True)
    street = models.TextField(null=True)
    housenumber = models.TextField(null=True)
    phone = models.TextField(null=True)
    email = models.TextField(null=True)

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
    node_type = models.TextField(null=False, db_index=False)
    dimension = models.TextField(null=True)
    group = models.TextField(null=True)
    company = models.TextField(null=True)

    class Meta:
        db_table = "attributes_node_type"
        indexes = [
            models.Index(
                fields=["node_type"],
                name="idx_node_type_node_type",
            ),
        ]


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
    id_trench = models.IntegerField(_("Trench ID"), null=False)
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
    company = models.ForeignKey(
        AttributesCompany,
        null=True,
        on_delete=models.CASCADE,
        related_name="executed_trenches",
        db_column="company",
        db_index=False,
        verbose_name=_("Company"),
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
            models.Index(fields=["company"], name="idx_trench_company"),
            gis_models.Index(fields=["geom"], name="idx_trench_geom"),
        ]


# TODO: Implement area model
# TODO: Refactor area count trigger, fn_update_area_counts and fn_area_counts_area_update to be dynamic

# TODO: Implement node model

# TODO: Implement address model

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
    company = models.ForeignKey(
        AttributesCompany,
        null=True,
        on_delete=models.DO_NOTHING,
        related_name="executed_ol_trenches",
        db_column="company",
        verbose_name=_("Company"),
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
