import uuid

from django.conf import settings
from django.contrib.gis.db import models as gis_models
from django.db import models


class AttributesSurface(models.Model):
    id = models.IntegerField(primary_key=True)
    surface = models.TextField(null=False, db_index=False)
    sealing = models.BooleanField(null=False)

    class Meta:
        db_table = "attributes_surface"
        indexes = [
            models.Index(fields=["surface"], name="idx_surface_surface"),
        ]

    def __str__(self):
        return self.surface


class AttributesConstructionType(models.Model):
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

    def __str__(self):
        return self.construction_type


class AttributesStatus(models.Model):
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

    def __str__(self):
        return self.status


class AttributesPhase(models.Model):
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

    def __str__(self):
        return self.phase


class AttributesCompany(models.Model):
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

    def __str__(self):
        return self.company


class AttributesNodeType(models.Model):
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


class Trench(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4(), primary_key=True)
    id_trench = models.IntegerField(null=False)
    surface = models.ForeignKey(
        AttributesSurface,
        null=False,
        on_delete=models.CASCADE,
        db_column="surface",
        db_index=False,
    )
    construction_type = models.ForeignKey(
        AttributesConstructionType,
        null=False,
        on_delete=models.CASCADE,
        db_column="construction_type",
        db_index=False,
    )
    construction_depth = models.IntegerField(null=True)
    construction_details = models.TextField(null=True)
    status = models.ForeignKey(
        AttributesStatus,
        null=True,
        on_delete=models.CASCADE,
        db_column="status",
        db_index=False,
    )
    phase = models.ForeignKey(
        AttributesPhase,
        null=True,
        on_delete=models.CASCADE,
        db_column="phase",
        db_index=False,
    )
    internal_execution = models.BooleanField(null=True)
    funding_status = models.BooleanField(null=True)
    owner = models.ForeignKey(
        AttributesCompany,
        null=True,
        on_delete=models.CASCADE,
        related_name="owned_trenches",
        db_column="owner",
        db_index=False,
    )
    company = models.ForeignKey(
        AttributesCompany,
        null=True,
        on_delete=models.CASCADE,
        related_name="executed_trenches",
        db_column="company",
        db_index=False,
    )
    date = models.DateField(null=True)
    comment = models.TextField(null=True)
    house_connection = models.BooleanField(null=True, default=False)
    length = models.DecimalField(null=False, max_digits=12, decimal_places=4)
    geom = gis_models.LineStringField(
        null=False, srid=settings.DEFAULT_SRID, spatial_index=False
    )

    class Meta:
        db_table = "trench"
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
