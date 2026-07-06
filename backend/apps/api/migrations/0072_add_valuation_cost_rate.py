import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0071_seed_pipeline_inquiry_area_permissions'),
    ]

    operations = [
        migrations.CreateModel(
            name='ValuationCostRate',
            fields=[
                ('id', models.AutoField(primary_key=True, serialize=False)),
                ('category', models.CharField(choices=[('tiefbau', 'Tiefbau'), ('verteiler_oberirdisch', 'Verteiler, oberirdisch'), ('verteiler_unterirdisch', 'Verteiler, unterirdisch'), ('pop', 'POP'), ('mfg', 'MFG'), ('kleinverteiler', 'Kleinverteiler'), ('hausanschluss', 'Hausanschluss')], max_length=32, verbose_name='Cost Category')),
                ('amount', models.DecimalField(decimal_places=2, default=0, max_digits=14, verbose_name='Amount')),
                ('unit', models.CharField(choices=[('per_meter', 'pro Meter'), ('per_piece', 'Stück')], default='per_piece', max_length=16, verbose_name='Unit')),
                ('project', models.ForeignKey(db_column='project', on_delete=django.db.models.deletion.CASCADE, related_name='valuation_cost_rates', to='api.projects', verbose_name='Project')),
                ('node_types', models.ManyToManyField(blank=True, help_text='Node types counted for this category. Leave empty for the Tiefbau (per-meter) category, which sums trench length instead.', related_name='valuation_cost_rates', to='api.attributesnodetype', verbose_name='Node Types')),
            ],
            options={
                'verbose_name': 'Valuation Cost Rate',
                'verbose_name_plural': 'Valuation Cost Rates',
                'db_table': 'valuation_cost_rate',
                'ordering': ['project', 'category'],
            },
        ),
        migrations.AddConstraint(
            model_name='valuationcostrate',
            constraint=models.UniqueConstraint(fields=('project', 'category'), name='unique_valuation_cost_rate'),
        ),
    ]
