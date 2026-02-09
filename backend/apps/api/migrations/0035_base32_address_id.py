"""
Migration to implement Base32 address ID generation.

Changes id_address from IntegerField to CharField(max_length=7) and creates
PL/pgSQL functions + BEFORE INSERT trigger for automatic ID generation.

IDs are 7 characters: 6 hash-derived Base32 chars + 1 checksum char.
Alphabet: ABCDEFGHJKLMNPQRSTUVWXYZ234567 (29 chars, excludes I,O,0,1,8,9).
Project ID is included in hash input for project-scoped uniqueness.

WFS inserts that explicitly set id_address=NULL are handled by the trigger
(same pattern as fn_generate_id_trench_if_null from migration 0020).
"""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0034_drop_ol_views"),
    ]

    operations = [
        migrations.RunSQL(
            sql="CREATE EXTENSION IF NOT EXISTS pgcrypto;",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            sql="""
            DROP INDEX IF EXISTS unique_address;
            DROP INDEX IF EXISTS idx_address_id_address;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            sql="""
            ALTER TABLE address
            ALTER COLUMN id_address TYPE varchar(7) USING id_address::varchar;
            """,
            reverse_sql="""
            UPDATE address SET id_address = NULL;
            ALTER TABLE address
            ALTER COLUMN id_address TYPE integer USING NULL;
            """,
        ),
        migrations.RunSQL(
            sql="""
            CREATE INDEX idx_address_id_address ON address (id_address);
            CREATE UNIQUE INDEX unique_address ON address (project, id_address)
                WHERE id_address IS NOT NULL;
            """,
            reverse_sql="""
            DROP INDEX IF EXISTS unique_address;
            DROP INDEX IF EXISTS idx_address_id_address;
            """,
        ),
        migrations.RunSQL(
            sql="""
            CREATE OR REPLACE FUNCTION fn_generate_address_id(p_project_id integer)
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
                        RAISE EXCEPTION 'Failed to generate unique address ID after % attempts', max_attempts;
                    END IF;

                    -- Build hash input: project_id + random UUID for uniqueness
                    hash_input := COALESCE(p_project_id::text, '0') || '|' || gen_random_uuid()::text;
                    hash_bytes := digest(hash_input, 'sha256');

                    -- Encode first 6 bytes to 6 Base32 characters
                    id_chars := '';
                    FOR i IN 0..5 LOOP
                        id_chars := id_chars || substr(alphabet, (get_byte(hash_bytes, i) % base) + 1, 1);
                    END LOOP;

                    -- Compute checksum: weighted sum of character positions
                    checksum := 0;
                    FOR i IN 1..6 LOOP
                        checksum := checksum + ((position(substr(id_chars, i, 1) IN alphabet) - 1) * i);
                    END LOOP;
                    full_id := id_chars || substr(alphabet, (checksum % base) + 1, 1);

                    -- Check uniqueness within project
                    IF NOT EXISTS (
                        SELECT 1 FROM address
                        WHERE id_address = full_id AND project = p_project_id
                    ) THEN
                        RETURN full_id;
                    END IF;
                END LOOP;
            END;
            $$;
            """,
            reverse_sql="DROP FUNCTION IF EXISTS fn_generate_address_id(integer);",
        ),
        migrations.RunSQL(
            sql="""
            CREATE OR REPLACE FUNCTION fn_generate_id_address_if_null()
            RETURNS trigger
            LANGUAGE plpgsql AS
            $$
            BEGIN
                IF NEW.id_address IS NULL OR NEW.id_address = '' THEN
                    NEW.id_address := fn_generate_address_id(NEW.project);
                END IF;
                RETURN NEW;
            END;
            $$;
            """,
            reverse_sql="DROP FUNCTION IF EXISTS fn_generate_id_address_if_null();",
        ),
        migrations.RunSQL(
            sql="""
            CREATE TRIGGER tg_00_generate_id_address_if_null
                BEFORE INSERT
                ON address
                FOR EACH ROW
            EXECUTE FUNCTION fn_generate_id_address_if_null();
            """,
            reverse_sql="DROP TRIGGER IF EXISTS tg_00_generate_id_address_if_null ON address;",
        ),
        migrations.RunSQL(
            sql="""
            UPDATE address
            SET id_address = fn_generate_address_id(project)
            WHERE id_address IS NULL;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
