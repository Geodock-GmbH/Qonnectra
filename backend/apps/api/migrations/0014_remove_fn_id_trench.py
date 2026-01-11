"""
Migration to remove the fn_generate_id_trench function and its trigger.

This migration removes:
- The tg_04_generate_id_trench trigger on trench table
- The fn_generate_id_trench function

The reverse SQL recreates these objects if a rollback is needed.
"""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0013_alter_address_id_address_alter_area_name_and_more"),
    ]

    operations = [
        migrations.RunSQL(
            sql="DROP TRIGGER IF EXISTS tg_04_generate_id_trench ON trench;",
            reverse_sql="""
                CREATE TRIGGER tg_04_generate_id_trench
                    BEFORE INSERT OR UPDATE OF id_trench
                    ON trench
                    FOR EACH ROW
                EXECUTE PROCEDURE fn_generate_id_trench();
            """,
        ),
        migrations.RunSQL(
            sql="DROP FUNCTION IF EXISTS fn_generate_id_trench();",
            reverse_sql="""
                CREATE OR REPLACE FUNCTION fn_generate_id_trench()
                    RETURNS trigger
                    LANGUAGE plpgsql
                AS
                $$
                DECLARE
                    next_id  bigint;
                    lock_key bigint := 123456789;
                BEGIN
                    if tg_op = 'update' and new.id_trench is not null then
                        return old;
                    end if;

                    PERFORM pg_advisory_xact_lock(lock_key);

                    select coalesce(max(id_trench), 0) + 1
                    into next_id
                    from trench;

                    new.id_trench := next_id;
                    return new;
                END;
                $$;
            """,
        ),
    ]
