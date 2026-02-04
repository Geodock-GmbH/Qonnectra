# Convert geom_3857 fields from regular fields to GeneratedField.
# The database columns already exist as GENERATED ALWAYS AS STORED,
# so only Django's state needs updating — no database operations.

from django.db import migrations, models

import django.contrib.gis.db.models.fields as gis_fields
from django.contrib.gis.db.models.functions import Transform


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0032_add_geom_3857_to_state_only"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RemoveField(
                    model_name="trench",
                    name="geom_3857",
                ),
                migrations.RemoveField(
                    model_name="address",
                    name="geom_3857",
                ),
                migrations.RemoveField(
                    model_name="node",
                    name="geom_3857",
                ),
                migrations.RemoveField(
                    model_name="area",
                    name="geom_3857",
                ),
                migrations.AddField(
                    model_name="trench",
                    name="geom_3857",
                    field=models.GeneratedField(
                        db_persist=True,
                        expression=Transform("geom", 3857),
                        output_field=gis_fields.LineStringField(srid=3857),
                    ),
                ),
                migrations.AddField(
                    model_name="address",
                    name="geom_3857",
                    field=models.GeneratedField(
                        db_persist=True,
                        expression=Transform("geom", 3857),
                        output_field=gis_fields.PointField(srid=3857),
                    ),
                ),
                migrations.AddField(
                    model_name="node",
                    name="geom_3857",
                    field=models.GeneratedField(
                        db_persist=True,
                        expression=Transform("geom", 3857),
                        output_field=gis_fields.PointField(srid=3857),
                    ),
                ),
                migrations.AddField(
                    model_name="area",
                    name="geom_3857",
                    field=models.GeneratedField(
                        db_persist=True,
                        expression=Transform("geom", 3857),
                        output_field=gis_fields.PolygonField(srid=3857),
                    ),
                ),
            ],
            database_operations=[],
        ),
    ]
