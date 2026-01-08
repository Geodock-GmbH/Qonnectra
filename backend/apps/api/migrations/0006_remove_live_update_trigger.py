# Generated migration to remove live update trigger and function

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0005_wfs_error_logging"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                DROP TRIGGER IF EXISTS tg_02_notify_node_canvas_position ON node;
            """,
            reverse_sql="""
                CREATE TRIGGER tg_02_notify_node_canvas_position
                    AFTER UPDATE OF canvas_x, canvas_y
                    ON node
                    FOR EACH ROW
                EXECUTE PROCEDURE fn_notify_node_canvas_position();
            """,
        ),
        migrations.RunSQL(
            sql="""
                DROP FUNCTION IF EXISTS fn_notify_node_canvas_position();
            """,
            reverse_sql="""
                CREATE OR REPLACE FUNCTION fn_notify_node_canvas_position() RETURNS trigger
                LANGUAGE plpgsql
                AS
                $$
                BEGIN
                    IF tg_op = 'UPDATE' AND (
                        old.canvas_x IS DISTINCT FROM new.canvas_x OR
                        old.canvas_y IS DISTINCT FROM new.canvas_y
                    ) THEN
                        PERFORM pg_notify('node_position_updates', json_build_object(
                            'node_id', new.uuid::text,
                            'canvas_x', new.canvas_x,
                            'canvas_y', new.canvas_y,
                            'project_id', new.project
                        )::text);
                    END IF;
                    RETURN new;
                END;
                $$;
            """,
        ),
    ]
