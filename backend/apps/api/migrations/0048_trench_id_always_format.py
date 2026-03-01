from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0047_node_data_integrity_triggers"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE OR REPLACE FUNCTION fn_is_valid_trench_id(id text)
            RETURNS boolean
            LANGUAGE plpgsql AS
            $$
            DECLARE
                alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ234567';
            BEGIN
                -- Check basic format: TR- prefix + 7 Base29 characters
                IF id IS NULL OR length(id) != 10 THEN
                    RETURN FALSE;
                END IF;

                IF left(id, 3) != 'TR-' THEN
                    RETURN FALSE;
                END IF;

                -- Check that remaining 7 characters are valid Base29
                FOR i IN 4..10 LOOP
                    IF position(substr(id, i, 1) IN alphabet) = 0 THEN
                        RETURN FALSE;
                    END IF;
                END LOOP;

                RETURN TRUE;
            END;
            $$;
            """,
            reverse_sql="DROP FUNCTION IF EXISTS fn_is_valid_trench_id(text);",
        ),
        migrations.RunSQL(
            sql="""
            CREATE OR REPLACE FUNCTION fn_generate_id_trench_if_null()
            RETURNS trigger
            LANGUAGE plpgsql AS
            $$
            BEGIN
                -- Generate new ID if null, empty, or not in the correct format
                IF NEW.id_trench IS NULL
                   OR NEW.id_trench = ''
                   OR NOT fn_is_valid_trench_id(NEW.id_trench) THEN
                    NEW.id_trench := fn_generate_trench_id(NEW.project);
                END IF;
                RETURN NEW;
            END;
            $$;
            """,
            reverse_sql="""
            CREATE OR REPLACE FUNCTION fn_generate_id_trench_if_null()
            RETURNS trigger
            LANGUAGE plpgsql AS
            $$
            BEGIN
                IF NEW.id_trench IS NULL OR NEW.id_trench = '' THEN
                    NEW.id_trench := fn_generate_trench_id(NEW.project);
                END IF;
                RETURN NEW;
            END;
            $$;
            """,
        ),
    ]
