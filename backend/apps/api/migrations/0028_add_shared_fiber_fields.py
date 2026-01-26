# Generated manually for shared fiber fields in merge groups

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0027_add_merge_side_to_fibersplice"),
    ]

    operations = [
        # Add shared_fiber_a field
        migrations.AddField(
            model_name="fibersplice",
            name="shared_fiber_a",
            field=models.ForeignKey(
                blank=True,
                db_column="shared_fiber_a",
                help_text="Shared fiber A for merged port groups (one fiber for all ports in group on side A).",
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="shared_splices_as_a",
                to="api.fiber",
                verbose_name="Shared Fiber A",
            ),
        ),
        # Add shared_cable_a field
        migrations.AddField(
            model_name="fibersplice",
            name="shared_cable_a",
            field=models.ForeignKey(
                blank=True,
                db_column="shared_cable_a",
                help_text="The cable of shared fiber A (denormalized for CASCADE delete).",
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="shared_fiber_splices_as_a",
                to="api.cable",
                verbose_name="Shared Cable A",
            ),
        ),
        # Add shared_fiber_b field
        migrations.AddField(
            model_name="fibersplice",
            name="shared_fiber_b",
            field=models.ForeignKey(
                blank=True,
                db_column="shared_fiber_b",
                help_text="Shared fiber B for merged port groups (one fiber for all ports in group on side B).",
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="shared_splices_as_b",
                to="api.fiber",
                verbose_name="Shared Fiber B",
            ),
        ),
        # Add shared_cable_b field
        migrations.AddField(
            model_name="fibersplice",
            name="shared_cable_b",
            field=models.ForeignKey(
                blank=True,
                db_column="shared_cable_b",
                help_text="The cable of shared fiber B (denormalized for CASCADE delete).",
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="shared_fiber_splices_as_b",
                to="api.cable",
                verbose_name="Shared Cable B",
            ),
        ),
        # Add indexes for shared fiber fields
        migrations.AddIndex(
            model_name="fibersplice",
            index=models.Index(
                fields=["shared_fiber_a"], name="idx_fiber_splice_shrd_fib_a"
            ),
        ),
        migrations.AddIndex(
            model_name="fibersplice",
            index=models.Index(
                fields=["shared_fiber_b"], name="idx_fiber_splice_shrd_fib_b"
            ),
        ),
    ]
