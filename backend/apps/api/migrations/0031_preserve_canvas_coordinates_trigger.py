"""
Migration to add a BEFORE UPDATE trigger on the node table that preserves
canvas_x and canvas_y values when an UPDATE sets them to NULL but the
existing values are not NULL.
"""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0030_node_parent_node"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                CREATE OR REPLACE FUNCTION fn_preserve_canvas_coordinates()
                RETURNS TRIGGER AS $$
                BEGIN
                    -- Preserve canvas_x if the update would set it to NULL
                    -- but the existing value is not NULL
                    IF NEW.canvas_x IS NULL AND OLD.canvas_x IS NOT NULL THEN
                        NEW.canvas_x := OLD.canvas_x;
                    END IF;
                    -- Preserve canvas_y if the update would set it to NULL
                    -- but the existing value is not NULL
                    IF NEW.canvas_y IS NULL AND OLD.canvas_y IS NOT NULL THEN
                        NEW.canvas_y := OLD.canvas_y;
                    END IF;
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
            """,
            reverse_sql="DROP FUNCTION IF EXISTS fn_preserve_canvas_coordinates();",
        ),
        migrations.RunSQL(
            sql="""
                CREATE TRIGGER tg_preserve_canvas_coordinates
                    BEFORE UPDATE ON node
                    FOR EACH ROW
                EXECUTE FUNCTION fn_preserve_canvas_coordinates();
            """,
            reverse_sql="DROP TRIGGER IF EXISTS tg_preserve_canvas_coordinates ON node;",
        ),
    ]
