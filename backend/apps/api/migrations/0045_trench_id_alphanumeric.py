"""
Migration to change id_trench from auto-incrementing integer to alphanumeric format.

Changes id_trench from IntegerField to CharField(max_length=10) with format TR-XXXXXXX.
Uses Base29 encoding (same as Address ID) with 6 random chars + 1 checksum.
Project-scoped uniqueness: (project, id_trench) is unique.
"""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0044_fix_cable_length_trigger"),
    ]

    operations = [
        # Step 1: Drop existing trigger and function
        migrations.RunSQL(
            sql="DROP TRIGGER IF EXISTS tg_00_generate_id_trench_if_null ON trench;",
            reverse_sql="""
            CREATE TRIGGER tg_00_generate_id_trench_if_null
                BEFORE INSERT
                ON trench
                FOR EACH ROW
            EXECUTE FUNCTION fn_generate_id_trench_if_null();
            """,
        ),
        migrations.RunSQL(
            sql="DROP FUNCTION IF EXISTS fn_generate_id_trench_if_null();",
            reverse_sql="""
            CREATE OR REPLACE FUNCTION fn_generate_id_trench_if_null()
            RETURNS trigger
            LANGUAGE plpgsql AS
            $$
            BEGIN
                IF NEW.id_trench IS NULL THEN
                    NEW.id_trench := nextval(pg_get_serial_sequence('trench', 'id_trench'));
                END IF;
                RETURN NEW;
            END;
            $$;
            """,
        ),
        # Step 2: Drop existing indexes/constraints
        migrations.RunSQL(
            sql="""
            DROP INDEX IF EXISTS idx_trench_id_trench;
            ALTER TABLE trench DROP CONSTRAINT IF EXISTS trench_id_trench_key;
            """,
            reverse_sql="""
            CREATE UNIQUE INDEX trench_id_trench_key ON trench (id_trench);
            CREATE INDEX idx_trench_id_trench ON trench (id_trench);
            """,
        ),
        # Step 3: Drop the identity/sequence from id_trench
        migrations.RunSQL(
            sql="""
            ALTER TABLE trench ALTER COLUMN id_trench DROP IDENTITY IF EXISTS;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
        # Step 3b: Drop qgis_trench view (depends on id_trench column)
        migrations.RunSQL(
            sql="DROP VIEW IF EXISTS public.qgis_trench;",
            reverse_sql="""
            CREATE VIEW public.qgis_trench AS
                SELECT
                    id_trench,
                    construction_type,
                    surface,
                    flag,
                    project,
                    geom
                FROM public.trench;
            """,
        ),
        # Step 4: Alter column type from integer to varchar(10)
        migrations.RunSQL(
            sql="""
            ALTER TABLE trench
            ALTER COLUMN id_trench TYPE varchar(10) USING id_trench::varchar;
            """,
            reverse_sql="""
            UPDATE trench SET id_trench = NULL;
            ALTER TABLE trench
            ALTER COLUMN id_trench TYPE integer USING NULL;
            """,
        ),
        # Step 5: Create the ID generation function
        migrations.RunSQL(
            sql="""
            CREATE OR REPLACE FUNCTION fn_generate_trench_id(p_project_id integer)
            RETURNS text
            LANGUAGE plpgsql AS
            $$
            DECLARE
                alphabet    text    := 'ABCDEFGHJKLMNPQRSTUVWXYZ234567';
                base        integer := 29;
                hash_input  text;
                hash_bytes  bytea;
                id_chars    text;
                checksum    integer;
                full_id     text;
                attempt     integer := 0;
                max_attempts integer := 10;
                i           integer;
            BEGIN
                LOOP
                    attempt := attempt + 1;
                    IF attempt > max_attempts THEN
                        RAISE EXCEPTION 'Failed to generate unique trench ID after % attempts', max_attempts;
                    END IF;

                    -- Build hash input: project_id + random UUID for uniqueness
                    hash_input := COALESCE(p_project_id::text, '0') || '|' || gen_random_uuid()::text;
                    hash_bytes := digest(hash_input, 'sha256');

                    -- Encode first 6 bytes to 6 Base29 characters
                    id_chars := '';
                    FOR i IN 0..5 LOOP
                        id_chars := id_chars || substr(alphabet, (get_byte(hash_bytes, i) % base) + 1, 1);
                    END LOOP;

                    -- Compute checksum: weighted sum of character positions
                    checksum := 0;
                    FOR i IN 1..6 LOOP
                        checksum := checksum + ((position(substr(id_chars, i, 1) IN alphabet) - 1) * i);
                    END LOOP;
                    full_id := 'TR-' || id_chars || substr(alphabet, (checksum % base) + 1, 1);

                    -- Check uniqueness within project
                    IF NOT EXISTS (
                        SELECT 1 FROM trench
                        WHERE id_trench = full_id AND project = p_project_id
                    ) THEN
                        RETURN full_id;
                    END IF;
                END LOOP;
            END;
            $$;
            """,
            reverse_sql="DROP FUNCTION IF EXISTS fn_generate_trench_id(integer);",
        ),
        # Step 6: Disable ALL triggers, update existing trenches, create indexes, re-enable triggers
        migrations.RunSQL(
            sql="""
            ALTER TABLE trench DISABLE TRIGGER ALL;
            UPDATE trench
            SET id_trench = fn_generate_trench_id(project);
            CREATE UNIQUE INDEX unique_trench_id_per_project ON trench (project, id_trench);
            CREATE INDEX idx_trench_id_trench ON trench (id_trench);
            ALTER TABLE trench ENABLE TRIGGER ALL;
            """,
            reverse_sql="""
            DROP INDEX IF EXISTS unique_trench_id_per_project;
            DROP INDEX IF EXISTS idx_trench_id_trench;
            """,
        ),
        # Step 8: Create trigger function
        migrations.RunSQL(
            sql="""
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
            reverse_sql="DROP FUNCTION IF EXISTS fn_generate_id_trench_if_null();",
        ),
        # Step 9: Create trigger
        migrations.RunSQL(
            sql="""
            CREATE TRIGGER tg_00_generate_id_trench_if_null
                BEFORE INSERT
                ON trench
                FOR EACH ROW
            EXECUTE FUNCTION fn_generate_id_trench_if_null();
            """,
            reverse_sql="DROP TRIGGER IF EXISTS tg_00_generate_id_trench_if_null ON trench;",
        ),
        # Step 10: Recreate qgis_trench view
        migrations.RunSQL(
            sql="""
            CREATE VIEW public.qgis_trench AS
                SELECT
                    id_trench,
                    construction_type,
                    surface,
                    flag,
                    project,
                    geom
                FROM public.trench;
            """,
            reverse_sql="DROP VIEW IF EXISTS public.qgis_trench;",
        ),
    ]
