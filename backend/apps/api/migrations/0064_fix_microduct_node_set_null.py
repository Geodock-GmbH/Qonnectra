"""Add ON DELETE SET NULL to microduct uuid_node FK constraint at the database level.

Django's on_delete=SET_NULL is ORM-level only. When external tools like QGIS
delete nodes directly in the database, PostgreSQL needs the SET NULL constraint
to automatically nullify the uuid_node column on related microduct rows.
"""

from django.db import migrations

FORWARD_SQL = """
DO $$
DECLARE
    node_fk_name TEXT;
BEGIN
    -- Find the actual FK constraint name for uuid_node
    SELECT constraint_name INTO node_fk_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
    WHERE tc.table_name = 'microduct'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'uuid_node';

    -- Drop and recreate with ON DELETE SET NULL
    EXECUTE format('ALTER TABLE microduct DROP CONSTRAINT %I', node_fk_name);
    EXECUTE format(
        'ALTER TABLE microduct '
        'ADD CONSTRAINT %I FOREIGN KEY (uuid_node) REFERENCES node(uuid) '
        'ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED',
        node_fk_name
    );
END $$;
"""

REVERSE_SQL = """
DO $$
DECLARE
    node_fk_name TEXT;
BEGIN
    SELECT constraint_name INTO node_fk_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
    WHERE tc.table_name = 'microduct'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'uuid_node';

    EXECUTE format('ALTER TABLE microduct DROP CONSTRAINT %I', node_fk_name);
    EXECUTE format(
        'ALTER TABLE microduct '
        'ADD CONSTRAINT %I FOREIGN KEY (uuid_node) REFERENCES node(uuid) '
        'DEFERRABLE INITIALLY DEFERRED',
        node_fk_name
    );
END $$;
"""


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0063_fix_trench_conduit_canvas_cascade"),
    ]

    operations = [
        migrations.RunSQL(FORWARD_SQL, REVERSE_SQL),
    ]
