from django.db import migrations, models


# Legacy category value -> human-readable name for existing rows.
CATEGORY_TO_NAME = {
    "tiefbau": "Tiefbau",
    "verteiler_oberirdisch": "Verteiler, oberirdisch",
    "verteiler_unterirdisch": "Verteiler, unterirdisch",
    "pop": "POP",
    "mfg": "MFG",
    "kleinverteiler": "Kleinverteiler",
    "hausanschluss": "Hausanschluss",
}


def category_to_name(apps, schema_editor):
    """Copy the legacy ``category`` value into ``name`` and set the HA flag."""
    ValuationCostRate = apps.get_model("api", "ValuationCostRate")
    for rate in ValuationCostRate.objects.all():
        rate.name = CATEGORY_TO_NAME.get(rate.category, rate.category)
        rate.is_house_connection = rate.category == "hausanschluss"
        rate.save(update_fields=["name", "is_house_connection"])


def name_to_category(apps, schema_editor):
    """Reverse: map ``name`` back to a legacy category value where possible."""
    ValuationCostRate = apps.get_model("api", "ValuationCostRate")
    name_to_cat = {v: k for k, v in CATEGORY_TO_NAME.items()}
    for rate in ValuationCostRate.objects.all():
        rate.category = name_to_cat.get(rate.name, "tiefbau")
        rate.save(update_fields=["category"])


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0072_add_valuation_cost_rate"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="valuationcostrate",
            name="unique_valuation_cost_rate",
        ),
        migrations.AddField(
            model_name="valuationcostrate",
            name="name",
            field=models.CharField(default="", max_length=100, verbose_name="Cost Category"),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="valuationcostrate",
            name="is_house_connection",
            field=models.BooleanField(
                default=False,
                help_text="Nodes of this row are counted for the 'cost per house connection' KPI.",
                verbose_name="House Connection",
            ),
        ),
        migrations.RunPython(category_to_name, name_to_category),
        migrations.RemoveField(
            model_name="valuationcostrate",
            name="category",
        ),
        migrations.AlterField(
            model_name="valuationcostrate",
            name="unit",
            field=models.CharField(
                choices=[("per_meter", "pro Meter"), ("per_piece", "Stück")],
                default="per_piece",
                help_text="Per meter multiplies by the trench length (node types ignored); per piece multiplies by the number of nodes of the selected types.",
                max_length=16,
                verbose_name="Unit",
            ),
        ),
        migrations.AlterField(
            model_name="valuationcostrate",
            name="node_types",
            field=models.ManyToManyField(
                blank=True,
                help_text="Node types counted for this row. Leave empty for a per-meter row, which sums trench length instead.",
                related_name="valuation_cost_rates",
                to="api.attributesnodetype",
                verbose_name="Node Types",
            ),
        ),
        migrations.AlterModelOptions(
            name="valuationcostrate",
            options={
                "ordering": ["project", "name"],
                "verbose_name": "Valuation Cost Rate",
                "verbose_name_plural": "Valuation Cost Rates",
            },
        ),
        migrations.AddConstraint(
            model_name="valuationcostrate",
            constraint=models.UniqueConstraint(
                fields=("project", "name"), name="unique_valuation_cost_rate"
            ),
        ),
    ]
