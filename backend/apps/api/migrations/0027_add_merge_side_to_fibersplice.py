from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0026_add_merge_group_to_fibersplice"),
    ]

    operations = [
        migrations.AddField(
            model_name="fibersplice",
            name="merge_side",
            field=models.CharField(
                blank=True,
                choices=[("a", "A (IN)"), ("b", "B (OUT)")],
                help_text="Which side (A/IN or B/OUT) is merged for this port.",
                max_length=1,
                null=True,
                verbose_name="Merge Side",
            ),
        ),
    ]
