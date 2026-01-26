# Generated manually for merge group feature

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0025_add_performance_indexes"),
    ]

    operations = [
        migrations.AddField(
            model_name="fibersplice",
            name="merge_group",
            field=models.UUIDField(
                blank=True,
                db_index=True,
                help_text="UUID grouping ports that should receive fibers together. Used for asymmetric components like splitters (e.g., 1:8 has 8 OUT ports merged).",
                null=True,
                verbose_name="Merge Group",
            ),
        ),
        migrations.AddIndex(
            model_name="fibersplice",
            index=models.Index(
                fields=["merge_group"], name="idx_fiber_splice_merge_grp"
            ),
        ),
    ]
