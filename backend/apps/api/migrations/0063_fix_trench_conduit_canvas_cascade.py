"""Add ON DELETE CASCADE to trench_conduit_canvas FK constraints at the database level.

Django's on_delete=CASCADE is ORM-level only. When external tools like QGIS
delete trenches or conduits directly in the database, PostgreSQL needs the CASCADE
constraint to automatically clean up related trench_conduit_canvas rows.
"""

from django.db import migrations

FORWARD_SQL = """
DO $$
DECLARE
    trench_fk_name TEXT;
    conduit_fk_name TEXT;
BEGIN
    -- Find the actual FK constraint name for trench_id
    SELECT constraint_name INTO trench_fk_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
    WHERE tc.table_name = 'trench_conduit_canvas'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'trench_id';

    -- Find the actual FK constraint name for conduit_id
    SELECT constraint_name INTO conduit_fk_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
    WHERE tc.table_name = 'trench_conduit_canvas'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'conduit_id';

    -- Drop and recreate trench FK with CASCADE
    EXECUTE format('ALTER TABLE trench_conduit_canvas DROP CONSTRAINT %I', trench_fk_name);
    EXECUTE format(
        'ALTER TABLE trench_conduit_canvas '
        'ADD CONSTRAINT %I FOREIGN KEY (trench_id) REFERENCES trench(uuid) '
        'ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED',
        trench_fk_name
    );

    -- Drop and recreate conduit FK with CASCADE
    EXECUTE format('ALTER TABLE trench_conduit_canvas DROP CONSTRAINT %I', conduit_fk_name);
    EXECUTE format(
        'ALTER TABLE trench_conduit_canvas '
        'ADD CONSTRAINT %I FOREIGN KEY (conduit_id) REFERENCES conduit(uuid) '
        'ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED',
        conduit_fk_name
    );
END $$;
"""

REVERSE_SQL = """
DO $$
DECLARE
    trench_fk_name TEXT;
    conduit_fk_name TEXT;
BEGIN
    SELECT constraint_name INTO trench_fk_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
    WHERE tc.table_name = 'trench_conduit_canvas'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'trench_id';

    SELECT constraint_name INTO conduit_fk_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
    WHERE tc.table_name = 'trench_conduit_canvas'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'conduit_id';

    EXECUTE format('ALTER TABLE trench_conduit_canvas DROP CONSTRAINT %I', trench_fk_name);
    EXECUTE format(
        'ALTER TABLE trench_conduit_canvas '
        'ADD CONSTRAINT %I FOREIGN KEY (trench_id) REFERENCES trench(uuid) '
        'DEFERRABLE INITIALLY DEFERRED',
        trench_fk_name
    );

    EXECUTE format('ALTER TABLE trench_conduit_canvas DROP CONSTRAINT %I', conduit_fk_name);
    EXECUTE format(
        'ALTER TABLE trench_conduit_canvas '
        'ADD CONSTRAINT %I FOREIGN KEY (conduit_id) REFERENCES conduit(uuid) '
        'DEFERRABLE INITIALLY DEFERRED',
        conduit_fk_name
    );
END $$;
"""


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0062_fix_node_trench_selection_cascade"),
    ]

    operations = [
        migrations.RunSQL(FORWARD_SQL, REVERSE_SQL),
    ]
