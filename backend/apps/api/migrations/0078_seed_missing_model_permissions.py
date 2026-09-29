from django.db import migrations

MODEL_NAMES = [
    "nodeslotclipnumber",
    "nodeslotdivider",
    "nodetrenchselection",
    "wmssource",
]

LEVELS = {"Admin": "full", "Editor": "edit", "Viewer": "view"}


def seed_missing_model_permissions(apps, schema_editor):
    """Grant the seeded roles access to models that were missing from their rows.

    Only creates rows that do not exist yet, so levels an administrator set by
    hand are kept. Roles that were deleted are skipped.

    Args:
        apps: Historical app registry of the migration state.
        schema_editor: Unused schema editor passed by ``RunPython``.
    """
    Group = apps.get_model("auth", "Group")
    ModelPermission = apps.get_model("api", "ModelPermission")

    for group in Group.objects.filter(name__in=LEVELS):
        for model_name in MODEL_NAMES:
            ModelPermission.objects.get_or_create(
                group=group,
                model_name=model_name,
                defaults={"access_level": LEVELS[group.name]},
            )


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0077_add_funding_status_node_cable_conduit"),
    ]

    operations = [
        migrations.RunPython(seed_missing_model_permissions, migrations.RunPython.noop),
    ]
