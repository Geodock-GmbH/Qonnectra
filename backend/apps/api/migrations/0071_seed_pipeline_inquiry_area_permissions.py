from django.db import migrations


def seed_pipeline_inquiry_area_permissions(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    ModelPermission = apps.get_model("api", "ModelPermission")

    admin_group, _ = Group.objects.get_or_create(name="Admin")
    editor_group, _ = Group.objects.get_or_create(name="Editor")
    viewer_group, _ = Group.objects.get_or_create(name="Viewer")

    ModelPermission.objects.get_or_create(
        group=admin_group,
        model_name="pipelineinquiryarea",
        defaults={"access_level": "full"},
    )
    ModelPermission.objects.get_or_create(
        group=editor_group,
        model_name="pipelineinquiryarea",
        defaults={"access_level": "edit"},
    )
    ModelPermission.objects.get_or_create(
        group=viewer_group,
        model_name="pipelineinquiryarea",
        defaults={"access_level": "view"},
    )


def reverse_migration(apps, schema_editor):
    ModelPermission = apps.get_model("api", "ModelPermission")
    ModelPermission.objects.filter(model_name="pipelineinquiryarea").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0070_add_pipeline_inquiry_area"),
    ]

    operations = [
        migrations.RunPython(
            seed_pipeline_inquiry_area_permissions, reverse_migration
        ),
    ]
