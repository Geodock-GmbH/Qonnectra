"""
Migration to implement Base28 residential unit ID generation.

Changes id_residential_unit from TextField(unique=True) to CharField(max_length=8)
and creates PL/pgSQL functions + BEFORE INSERT trigger for automatic ID generation.

IDs are 8 characters: 7 hash-derived Base28 chars + 1 checksum char.
Alphabet: 234679ACDEFGHJKLMNPQRTUVWXYZ (28 chars, excludes B,I,O,S,0,1,5,8).
Project ID is resolved through the address FK for project-scoped uniqueness.
"""

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0037_remove_residentialunit_suffix"),
    ]

    operations = [
        migrations.RunSQL(
            sql="CREATE EXTENSION IF NOT EXISTS pgcrypto;",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.AlterField(
            model_name="residentialunit",
            name="id_residential_unit",
            field=models.CharField(
                max_length=8,
                null=True,
                blank=True,
                verbose_name="Residential Unit ID",
            ),
        ),
        migrations.RunSQL(
            sql="""
            CREATE OR REPLACE FUNCTION fn_generate_residential_unit_id(p_project_id integer)
            RETURNS text
            LANGUAGE plpgsql AS
            $$
            DECLARE
                alphabet     text    := '234679ACDEFGHJKLMNPQRTUVWXYZ';
                base         integer := 28;
                hash_input   text;
                hash_bytes   bytea;
                id_chars     text;
                checksum     integer;
                full_id      text;
                attempt      integer := 0;
                max_attempts integer := 10;
                i            integer;
            BEGIN
                LOOP
                    attempt := attempt + 1;
                    IF attempt > max_attempts THEN
                        RAISE EXCEPTION 'Failed to generate unique residential unit ID after % attempts', max_attempts;
                    END IF;

                    -- Build hash input: project_id + marker + random UUID for uniqueness
                    hash_input := COALESCE(p_project_id::text, '0') || '|RU|' || gen_random_uuid()::text;
                    hash_bytes := digest(hash_input, 'sha256');

                    -- Encode first 7 bytes to 7 Base28 characters
                    id_chars := '';
                    FOR i IN 0..6 LOOP
                        id_chars := id_chars || substr(alphabet, (get_byte(hash_bytes, i) % base) + 1, 1);
                    END LOOP;

                    -- Compute checksum: weighted sum of character positions
                    checksum := 0;
                    FOR i IN 1..7 LOOP
                        checksum := checksum + ((position(substr(id_chars, i, 1) IN alphabet) - 1) * i);
                    END LOOP;
                    full_id := id_chars || substr(alphabet, (checksum % base) + 1, 1);

                    -- Check uniqueness within project (join through address table)
                    IF NOT EXISTS (
                        SELECT 1 FROM residential_unit ru
                        JOIN address a ON ru.uuid_address = a.uuid
                        WHERE ru.id_residential_unit = full_id
                          AND a.project = p_project_id
                    ) THEN
                        RETURN full_id;
                    END IF;
                END LOOP;
            END;
            $$;
            """,
            reverse_sql="DROP FUNCTION IF EXISTS fn_generate_residential_unit_id(integer);",
        ),
        migrations.RunSQL(
            sql="""
            CREATE OR REPLACE FUNCTION fn_generate_id_residential_unit_if_null()
            RETURNS trigger
            LANGUAGE plpgsql AS
            $$
            DECLARE
                v_project_id integer;
            BEGIN
                IF NEW.id_residential_unit IS NULL OR NEW.id_residential_unit = '' THEN
                    -- Look up the project through the address
                    SELECT a.project INTO v_project_id
                    FROM address a
                    WHERE a.uuid = NEW.uuid_address;

                    NEW.id_residential_unit := fn_generate_residential_unit_id(v_project_id);
                END IF;
                RETURN NEW;
            END;
            $$;
            """,
            reverse_sql="DROP FUNCTION IF EXISTS fn_generate_id_residential_unit_if_null();",
        ),
        migrations.RunSQL(
            sql="""
            CREATE TRIGGER tg_00_generate_id_residential_unit_if_null
                BEFORE INSERT
                ON residential_unit
                FOR EACH ROW
            EXECUTE FUNCTION fn_generate_id_residential_unit_if_null();
            """,
            reverse_sql="DROP TRIGGER IF EXISTS tg_00_generate_id_residential_unit_if_null ON residential_unit;",
        ),
        migrations.RunSQL(
            sql="""
            UPDATE residential_unit ru
            SET id_residential_unit = fn_generate_residential_unit_id(a.project)
            FROM address a
            WHERE ru.uuid_address = a.uuid
              AND (ru.id_residential_unit IS NULL OR ru.id_residential_unit = '');
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
