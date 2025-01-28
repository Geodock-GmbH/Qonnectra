import uuid
from django.db import models
from django.contrib.gis.db import models as gis_models
from django.conf import settings


class AttributesSurface(models.Model):
    surface = models.TextField(null=False)
    sealing = models.BooleanField(null=False)


class AttributesConstructionType(models.Model):
    construction_type = models.TextField(null=False)


class Trench(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    id = models.IntegerField(null=False)
    surface = models.ForeignKey(AttributesSurface, null=False, on_delete=models.CASCADE)
    construction_type = models.ForeignKey(
        AttributesConstructionType, null=False, on_delete=models.CASCADE
    )
    construction_depth = models.IntegerField(null=True)
    construction_details = models.TextField(null=True)
    status = models.TextField(null=True)
    phase = models.TextField(null=True)
    internal_execution = models.BooleanField(null=True)
    funding_status = models.BooleanField(null=True)
    owner = models.TextField(null=True)
    company = models.TextField(null=True)
    date = models.DateField(null=True)
    comment = models.TextField(null=True)
    house_connection = models.BooleanField(null=True, default=False)
    length = models.DecimalField(null=False, max_digits=8, decimal_places=4)
    geom = gis_models.LineStringField(null=False, srid=settings.DEFAULT_SRID)
