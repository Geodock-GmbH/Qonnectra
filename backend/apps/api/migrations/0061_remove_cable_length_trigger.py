"""Drop the DB trigger that recalculated cable lengths on trench geometry changes.

Cable length recalculation is now handled in Python via Django signals, making
the ``tg_06_update_cable_lengths_on_trench_change`` trigger and its backing
function obsolete.
"""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0060_qgisprojectdatafile"),
    ]

    operations = [
        migrations.RunSQL(
            "DROP TRIGGER IF EXISTS tg_06_update_cable_lengths_on_trench_change ON trench;",
            reverse_sql="""
            CREATE TRIGGER tg_06_update_cable_lengths_on_trench_change
                AFTER UPDATE OF geom
                ON trench
                FOR EACH ROW
                WHEN (OLD.length IS DISTINCT FROM NEW.length)
            EXECUTE FUNCTION fn_update_cable_lengths_on_trench_change();
            """,
        ),
        migrations.RunSQL(
            "DROP FUNCTION IF EXISTS fn_update_cable_lengths_on_trench_change();",
            reverse_sql="""
            CREATE OR REPLACE FUNCTION fn_update_cable_lengths_on_trench_change()
            RETURNS trigger AS $$
            BEGIN
                UPDATE cable
                SET
                    length = (
                        SELECT COALESCE(SUM(DISTINCT t.length), 0)
                        FROM trench t
                        JOIN trench_conduit_connect tcc ON tcc.uuid_trench = t.uuid
                        JOIN microduct md ON md.uuid_conduit = tcc.uuid_conduit
                        JOIN microduct_cable_connection mcc ON mcc.uuid_microduct = md.uuid
                        WHERE mcc.uuid_cable = cable.uuid
                    ),
                    length_total = (
                        SELECT COALESCE(SUM(DISTINCT t.length), 0)
                        FROM trench t
                        JOIN trench_conduit_connect tcc ON tcc.uuid_trench = t.uuid
                        JOIN microduct md ON md.uuid_conduit = tcc.uuid_conduit
                        JOIN microduct_cable_connection mcc ON mcc.uuid_microduct = md.uuid
                        WHERE mcc.uuid_cable = cable.uuid
                    ) + COALESCE(cable.reserve_at_start, 0)
                      + COALESCE(cable.reserve_at_end, 0)
                      + COALESCE(cable.reserve_section, 0)
                WHERE cable.uuid IN (
                    SELECT DISTINCT mcc.uuid_cable
                    FROM microduct_cable_connection mcc
                    JOIN microduct md ON mcc.uuid_microduct = md.uuid
                    JOIN trench_conduit_connect tcc ON tcc.uuid_conduit = md.uuid_conduit
                    WHERE tcc.uuid_trench = NEW.uuid
                );

                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
            """,
        ),
    ]
