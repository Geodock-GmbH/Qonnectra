# Generated manually for independent merge groups per side

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0028_add_shared_fiber_fields"),
    ]

    operations = [
        # Add merge_group_a field - independent merge group for side A
        migrations.AddField(
            model_name="fibersplice",
            name="merge_group_a",
            field=models.UUIDField(
                blank=True,
                db_index=True,
                help_text="UUID grouping ports on side A (IN) that share a fiber. Used for asymmetric components like splitters.",
                null=True,
                verbose_name="Merge Group A",
            ),
        ),
        # Add merge_group_b field - independent merge group for side B
        migrations.AddField(
            model_name="fibersplice",
            name="merge_group_b",
            field=models.UUIDField(
                blank=True,
                db_index=True,
                help_text="UUID grouping ports on side B (OUT) that share a fiber. Used for asymmetric components like splitters.",
                null=True,
                verbose_name="Merge Group B",
            ),
        ),
        # Migrate existing data: copy merge_group to the appropriate side-specific field
        migrations.RunSQL(
            sql="""
            UPDATE fiber_splice
            SET merge_group_a = merge_group
            WHERE merge_side = 'a' AND merge_group IS NOT NULL;

            UPDATE fiber_splice
            SET merge_group_b = merge_group
            WHERE merge_side = 'b' AND merge_group IS NOT NULL;
            """,
            reverse_sql="""
            UPDATE fiber_splice
            SET merge_group = COALESCE(merge_group_a, merge_group_b),
                merge_side = CASE WHEN merge_group_a IS NOT NULL THEN 'a' ELSE 'b' END
            WHERE merge_group_a IS NOT NULL OR merge_group_b IS NOT NULL;
            """,
        ),
        # Remove old index before removing the field
        migrations.RemoveIndex(
            model_name="fibersplice",
            name="idx_fiber_splice_merge_grp",
        ),
        # Remove legacy fields
        migrations.RemoveField(
            model_name="fibersplice",
            name="merge_group",
        ),
        migrations.RemoveField(
            model_name="fibersplice",
            name="merge_side",
        ),
        # Add new indexes for the side-specific merge groups
        migrations.AddIndex(
            model_name="fibersplice",
            index=models.Index(
                fields=["merge_group_a"], name="idx_fiber_splice_merge_grp_a"
            ),
        ),
        migrations.AddIndex(
            model_name="fibersplice",
            index=models.Index(
                fields=["merge_group_b"], name="idx_fiber_splice_merge_grp_b"
            ),
        ),
    ]
