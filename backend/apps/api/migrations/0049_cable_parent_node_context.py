from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0048_trench_id_always_format"),
    ]

    operations = [
        migrations.AddField(
            model_name="cable",
            name="parent_node_context",
            field=models.ForeignKey(
                blank=True,
                db_column="parent_node_context",
                db_index=True,
                help_text="If set, cable was created in child view of this parent node",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="context_cables",
                to="api.node",
                verbose_name="Parent Node Context",
            ),
        ),
    ]
