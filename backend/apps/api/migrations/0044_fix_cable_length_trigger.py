from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0043_alter_attributescompany_id_and_more"),
    ]

    operations = [
        # Drop the old trigger that fires on length column update
        migrations.RunSQL(
            "DROP TRIGGER IF EXISTS tg_06_update_cable_lengths_on_trench_change ON trench;",
            reverse_sql="""
            CREATE TRIGGER tg_06_update_cable_lengths_on_trench_change
                AFTER UPDATE OF length
                ON trench
                FOR EACH ROW
                WHEN (OLD.length IS DISTINCT FROM NEW.length)
            EXECUTE FUNCTION fn_update_cable_lengths_on_trench_change();
            """,
        ),
        # Create new trigger that fires on geom column update
        # This works because tg_02_calculate_length_from_geom runs BEFORE and updates length,
        # then this AFTER trigger uses the already-updated length values
        migrations.RunSQL(
            """
            CREATE TRIGGER tg_06_update_cable_lengths_on_trench_change
                AFTER UPDATE OF geom
                ON trench
                FOR EACH ROW
                WHEN (OLD.length IS DISTINCT FROM NEW.length)
            EXECUTE FUNCTION fn_update_cable_lengths_on_trench_change();
            """,
            reverse_sql="DROP TRIGGER IF EXISTS tg_06_update_cable_lengths_on_trench_change ON trench;",
        ),
    ]
