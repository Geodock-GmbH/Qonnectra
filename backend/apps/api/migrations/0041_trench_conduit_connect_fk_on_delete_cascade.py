from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0040_area_self_intersection_validation"),
    ]

    operations = [
        migrations.RunSQL(
            # Forward SQL - enforce DB-level cascade deletes
            """
            ALTER TABLE trench_conduit_connect
                DROP CONSTRAINT IF EXISTS trench_conduit_connect_uuid_trench_3cc3e7f0_fk_trench_uuid;

            ALTER TABLE trench_conduit_connect
                ADD CONSTRAINT trench_conduit_connect_uuid_trench_3cc3e7f0_fk_trench_uuid
                FOREIGN KEY (uuid_trench) REFERENCES trench(uuid) ON DELETE CASCADE;

            ALTER TABLE trench_conduit_connect
                DROP CONSTRAINT IF EXISTS trench_conduit_connect_uuid_conduit_2fce3dba_fk_conduit_uuid;

            ALTER TABLE trench_conduit_connect
                ADD CONSTRAINT trench_conduit_connect_uuid_conduit_2fce3dba_fk_conduit_uuid
                FOREIGN KEY (uuid_conduit) REFERENCES conduit(uuid) ON DELETE CASCADE;
            """,
            # Reverse SQL - restore original deferrable constraints (no DB cascade)
            """
            ALTER TABLE trench_conduit_connect
                DROP CONSTRAINT IF EXISTS trench_conduit_connect_uuid_trench_3cc3e7f0_fk_trench_uuid;

            ALTER TABLE trench_conduit_connect
                ADD CONSTRAINT trench_conduit_connect_uuid_trench_3cc3e7f0_fk_trench_uuid
                FOREIGN KEY (uuid_trench) REFERENCES trench(uuid) DEFERRABLE INITIALLY DEFERRED;

            ALTER TABLE trench_conduit_connect
                DROP CONSTRAINT IF EXISTS trench_conduit_connect_uuid_conduit_2fce3dba_fk_conduit_uuid;

            ALTER TABLE trench_conduit_connect
                ADD CONSTRAINT trench_conduit_connect_uuid_conduit_2fce3dba_fk_conduit_uuid
                FOREIGN KEY (uuid_conduit) REFERENCES conduit(uuid) DEFERRABLE INITIALLY DEFERRED;
            """,
        ),
    ]
