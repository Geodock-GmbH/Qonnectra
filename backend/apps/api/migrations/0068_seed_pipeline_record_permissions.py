from django.db import migrations


def seed_pipeline_record_permissions(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    ModelPermission = apps.get_model("api", "ModelPermission")

    admin_group, _ = Group.objects.get_or_create(name="Admin")
    editor_group, _ = Group.objects.get_or_create(name="Editor")
    viewer_group, _ = Group.objects.get_or_create(name="Viewer")

    for model_name in ("pipelinerecord", "typeofwork", "requestreason"):
        ModelPermission.objects.get_or_create(
            group=admin_group,
            model_name=model_name,
            defaults={"access_level": "full"},
        )
        ModelPermission.objects.get_or_create(
            group=editor_group,
            model_name=model_name,
            defaults={"access_level": "edit"},
        )
        ModelPermission.objects.get_or_create(
            group=viewer_group,
            model_name=model_name,
            defaults={"access_level": "view"},
        )


def reverse_migration(apps, schema_editor):
    ModelPermission = apps.get_model("api", "ModelPermission")
    ModelPermission.objects.filter(
        model_name__in=("pipelinerecord", "typeofwork", "requestreason")
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0067_add_pipeline_record"),
    ]

    operations = [
        migrations.RunPython(seed_pipeline_record_permissions, reverse_migration),
    ]
