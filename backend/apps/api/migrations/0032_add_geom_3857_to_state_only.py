# Migration 0017 added geom_3857 columns via raw SQL (GENERATED ALWAYS AS STORED).
# This migration only updates Django's migration state so it knows these columns
# exist; no database operations are run.

from django.db import migrations

import django.contrib.gis.db.models.fields as gis_fields


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0031_preserve_canvas_coordinates_trigger"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name="trench",
                    name="geom_3857",
                    field=gis_fields.LineStringField(
                        editable=False,
                        srid=3857,
                        spatial_index=False,
                        verbose_name="Geometry (3857)",
                    ),
                ),
                migrations.AddField(
                    model_name="address",
                    name="geom_3857",
                    field=gis_fields.PointField(
                        editable=False,
                        srid=3857,
                        spatial_index=False,
                        verbose_name="Geometry (3857)",
                    ),
                ),
                migrations.AddField(
                    model_name="node",
                    name="geom_3857",
                    field=gis_fields.PointField(
                        editable=False,
                        srid=3857,
                        spatial_index=False,
                        verbose_name="Geometry (3857)",
                    ),
                ),
                migrations.AddField(
                    model_name="area",
                    name="geom_3857",
                    field=gis_fields.PolygonField(
                        editable=False,
                        srid=3857,
                        spatial_index=False,
                        verbose_name="Geometry (3857)",
                    ),
                ),
            ],
            database_operations=[],
        ),
    ]
