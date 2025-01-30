import uuid
from django.db import models
from django.contrib.gis.db import models as gis_models
from django.conf import settings


class AttributesSurface(models.Model):
    id = models.IntegerField(primary_key=True)
    surface = models.TextField(null=False)
    sealing = models.BooleanField(null=False)

    class Meta:
        db_table = "attributes_surface"


class AttributesConstructionType(models.Model):
    id = models.IntegerField(primary_key=True)
    construction_type = models.TextField(null=False)

    class Meta:
        db_table = "attributes_construction_type"


class AttributesStatus(models.Model):
    id = models.IntegerField(primary_key=True)
    status = models.TextField(null=False)

    class Meta:
        db_table = "attributes_status"


class AttributesPhase(models.Model):
    id = models.IntegerField(primary_key=True)
    phase = models.TextField(null=False)

    class Meta:
        db_table = "attributes_phase"


class AttributesCompany(models.Model):
    id = models.IntegerField(primary_key=True)
    company = models.TextField(null=False)
    city = models.TextField(null=True)
    postal_code = models.TextField(null=True)
    street = models.TextField(null=True)
    housenumber = models.TextField(null=True)
    phone = models.TextField(null=True)
    email = models.TextField(null=True)

    class Meta:
        db_table = "attributes_company"


class AttributesNodeType(models.Model):
    id = models.IntegerField(primary_key=True)
    node_type = models.TextField(null=True)
    dimension = models.TextField(null=True)
    group = models.TextField(null=True)
    company = models.TextField(null=True)

    class Meta:
        db_table = "attributes_node_type"


class Trench(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, primary_key=True)
    id_trench = models.IntegerField(null=False)
    surface = models.ForeignKey(
        AttributesSurface,
        null=False,
        on_delete=models.CASCADE,
        db_column="fk_trench_surface",
    )
    construction_type = models.ForeignKey(
        AttributesConstructionType,
        null=False,
        on_delete=models.CASCADE,
        db_column="fk_trench_construction_type",
    )
    construction_depth = models.IntegerField(null=True)
    construction_details = models.TextField(null=True)
    status = models.ForeignKey(
        AttributesStatus,
        null=True,
        on_delete=models.CASCADE,
        db_column="fk_trench_status",
    )
    phase = models.ForeignKey(
        AttributesPhase,
        null=True,
        on_delete=models.CASCADE,
        db_column="fk_trench_phase",
    )
    internal_execution = models.BooleanField(null=True)
    funding_status = models.BooleanField(null=True)
    owner = models.ForeignKey(
        AttributesCompany,
        null=True,
        on_delete=models.CASCADE,
        db_column="fk_trench_owner",
        related_name="owned_trenches",
    )
    company = models.ForeignKey(
        AttributesCompany,
        null=True,
        on_delete=models.CASCADE,
        db_column="fk_trench_company",
        related_name="executed_trenches",
    )
    date = models.DateField(null=True)
    comment = models.TextField(null=True)
    house_connection = models.BooleanField(null=True, default=False)
    length = models.DecimalField(null=False, max_digits=8, decimal_places=4)
    geom = gis_models.LineStringField(null=False, srid=settings.DEFAULT_SRID)

    class Meta:
        db_table = "trench"
