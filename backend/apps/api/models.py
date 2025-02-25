import uuid

from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey, GenericRelation
from django.contrib.contenttypes.models import ContentType
from django.contrib.gis.db import models as gis_models
from django.db import models
from django.utils.translation import gettext_lazy as _
from .storage import NextcloudStorage


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

    # Generic Foreign Key fields
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

    file_path = models.FileField(
        upload_to="%Y/%m/%d",  # Organizes files by date
        storage=NextcloudStorage(),
        null=False,
        verbose_name=_("File Path"),
    )
    file_name = models.TextField(null=False, verbose_name=_("File Name"))
    file_type = models.TextField(null=False, verbose_name=_("File Type"))
    description = models.TextField(null=True, verbose_name=_("Description"))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("Created At"))

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


class Trench(models.Model):
    """Stores all trench features,
    related to :model:`api.AttributesSurface`,
    :model:`api.AttributesConstructionType`,
    :model:`api.AttributesStatus`,
    :model:`api.AttributesPhase`,
    :model:`api.AttributesCompany`.
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
    :model:`api.AttributesCompany`.
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

    class Meta:
        managed = False
        db_table = "ol_trench"
        verbose_name = _("OL Trench")
        verbose_name_plural = _("OL Trenches")
        ordering = ["id_trench"]
