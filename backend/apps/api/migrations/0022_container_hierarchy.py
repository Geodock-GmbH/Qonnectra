# Generated migration for container hierarchy feature

import uuid as uuid_module

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0021_attributescomponenttype_nodeslotconfiguration_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="ContainerType",
            fields=[
                ("id", models.AutoField(primary_key=True, serialize=False)),
                (
                    "name",
                    models.CharField(
                        help_text="The name of the container type (e.g., 'MFG-Door-Left', '19-inch Rack')",
                        max_length=100,
                        unique=True,
                        verbose_name="Name",
                    ),
                ),
                (
                    "description",
                    models.TextField(
                        blank=True,
                        help_text="Optional description of this container type",
                        null=True,
                        verbose_name="Description",
                    ),
                ),
                (
                    "icon",
                    models.CharField(
                        blank=True,
                        help_text="Optional icon identifier for frontend display (e.g., 'folder', 'server')",
                        max_length=50,
                        null=True,
                        verbose_name="Icon",
                    ),
                ),
                (
                    "color",
                    models.CharField(
                        blank=True,
                        help_text="Optional hex color code for visual distinction (e.g., '#3B82F6')",
                        max_length=7,
                        null=True,
                        verbose_name="Color",
                    ),
                ),
                (
                    "display_order",
                    models.IntegerField(
                        default=0,
                        help_text="Order in which this type appears in selection dropdowns",
                        verbose_name="Display Order",
                    ),
                ),
                (
                    "is_active",
                    models.BooleanField(
                        default=True,
                        help_text="Whether this container type is available for use",
                        verbose_name="Active",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "container_type",
                "verbose_name": "Container Type",
                "verbose_name_plural": "Container Types",
                "ordering": ["display_order", "name"],
            },
        ),
        migrations.CreateModel(
            name="Container",
            fields=[
                (
                    "uuid",
                    models.UUIDField(
                        default=uuid_module.uuid4, primary_key=True, serialize=False
                    ),
                ),
                (
                    "name",
                    models.CharField(
                        blank=True,
                        help_text="Optional custom name for this container instance",
                        max_length=100,
                        null=True,
                        verbose_name="Name",
                    ),
                ),
                (
                    "sort_order",
                    models.IntegerField(
                        default=0,
                        help_text="Order of this container among siblings",
                        verbose_name="Sort Order",
                    ),
                ),
                (
                    "is_expanded",
                    models.BooleanField(
                        default=True,
                        help_text="Whether this container is expanded in the UI",
                        verbose_name="Expanded",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "container_type",
                    models.ForeignKey(
                        db_column="container_type",
                        help_text="The type of this container",
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="instances",
                        to="api.containertype",
                        verbose_name="Container Type",
                    ),
                ),
                (
                    "parent_container",
                    models.ForeignKey(
                        blank=True,
                        db_column="parent_container",
                        help_text="The parent container (null if top-level)",
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="children",
                        to="api.container",
                        verbose_name="Parent Container",
                    ),
                ),
                (
                    "uuid_node",
                    models.ForeignKey(
                        db_column="uuid_node",
                        help_text="The node this container belongs to",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="containers",
                        to="api.node",
                        verbose_name="Node",
                    ),
                ),
            ],
            options={
                "db_table": "container",
                "verbose_name": "Container",
                "verbose_name_plural": "Containers",
                "ordering": ["uuid_node", "parent_container", "sort_order"],
            },
        ),
        migrations.AddIndex(
            model_name="container",
            index=models.Index(fields=["uuid_node"], name="idx_container_node"),
        ),
        migrations.AddIndex(
            model_name="container",
            index=models.Index(
                fields=["parent_container"], name="idx_container_parent"
            ),
        ),
        migrations.AddIndex(
            model_name="container",
            index=models.Index(fields=["container_type"], name="idx_container_type"),
        ),
        migrations.AddField(
            model_name="nodeslotconfiguration",
            name="container",
            field=models.ForeignKey(
                blank=True,
                db_column="container",
                help_text="Optional container this slot configuration belongs to",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="slot_configurations",
                to="api.container",
                verbose_name="Container",
            ),
        ),
        migrations.AddField(
            model_name="nodeslotconfiguration",
            name="sort_order",
            field=models.IntegerField(
                default=0,
                help_text="Order of this configuration among siblings",
                verbose_name="Sort Order",
            ),
        ),
        migrations.AddIndex(
            model_name="nodeslotconfiguration",
            index=models.Index(
                fields=["container"], name="idx_node_slot_config_container"
            ),
        ),
    ]
