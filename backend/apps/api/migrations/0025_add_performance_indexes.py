# Generated manually for performance optimization

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0024_fiber_splice"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="node",
            index=models.Index(fields=["flag"], name="idx_node_flag"),
        ),
        migrations.AddIndex(
            model_name="node",
            index=models.Index(
                fields=["project", "flag"], name="idx_node_project_flag"
            ),
        ),
        migrations.AddIndex(
            model_name="cable",
            index=models.Index(
                fields=["project", "flag"], name="idx_cable_project_flag"
            ),
        ),
        migrations.RunSQL(
            sql="ANALYZE node, cable;",
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
