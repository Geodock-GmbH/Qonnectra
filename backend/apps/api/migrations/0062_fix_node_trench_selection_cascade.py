"""Add ON DELETE CASCADE to node_trench_selection FK constraints at the database level.

Django's on_delete=CASCADE is ORM-level only. When external tools like QGIS
delete nodes or trenches directly in the database, PostgreSQL needs the CASCADE
constraint to automatically clean up related node_trench_selection rows.
"""

from django.db import migrations

FORWARD_SQL = """
DO $$
DECLARE
    node_fk_name TEXT;
    trench_fk_name TEXT;
BEGIN
    -- Find the actual FK constraint name for node_id
    SELECT constraint_name INTO node_fk_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
    WHERE tc.table_name = 'node_trench_selection'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'node_id';

    -- Find the actual FK constraint name for trench_id
    SELECT constraint_name INTO trench_fk_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
    WHERE tc.table_name = 'node_trench_selection'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'trench_id';

    -- Drop and recreate node FK with CASCADE
    EXECUTE format('ALTER TABLE node_trench_selection DROP CONSTRAINT %I', node_fk_name);
    EXECUTE format(
        'ALTER TABLE node_trench_selection '
        'ADD CONSTRAINT %I FOREIGN KEY (node_id) REFERENCES node(uuid) '
        'ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED',
        node_fk_name
    );

    -- Drop and recreate trench FK with CASCADE
    EXECUTE format('ALTER TABLE node_trench_selection DROP CONSTRAINT %I', trench_fk_name);
    EXECUTE format(
        'ALTER TABLE node_trench_selection '
        'ADD CONSTRAINT %I FOREIGN KEY (trench_id) REFERENCES trench(uuid) '
        'ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED',
        trench_fk_name
    );
END $$;
"""

REVERSE_SQL = """
DO $$
DECLARE
    node_fk_name TEXT;
    trench_fk_name TEXT;
BEGIN
    SELECT constraint_name INTO node_fk_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
    WHERE tc.table_name = 'node_trench_selection'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'node_id';

    SELECT constraint_name INTO trench_fk_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
    WHERE tc.table_name = 'node_trench_selection'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'trench_id';

    EXECUTE format('ALTER TABLE node_trench_selection DROP CONSTRAINT %I', node_fk_name);
    EXECUTE format(
        'ALTER TABLE node_trench_selection '
        'ADD CONSTRAINT %I FOREIGN KEY (node_id) REFERENCES node(uuid) '
        'DEFERRABLE INITIALLY DEFERRED',
        node_fk_name
    );

    EXECUTE format('ALTER TABLE node_trench_selection DROP CONSTRAINT %I', trench_fk_name);
    EXECUTE format(
        'ALTER TABLE node_trench_selection '
        'ADD CONSTRAINT %I FOREIGN KEY (trench_id) REFERENCES trench(uuid) '
        'DEFERRABLE INITIALLY DEFERRED',
        trench_fk_name
    );
END $$;
"""


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0061_remove_cable_length_trigger"),
    ]

    operations = [
        migrations.RunSQL(FORWARD_SQL, REVERSE_SQL),
    ]
