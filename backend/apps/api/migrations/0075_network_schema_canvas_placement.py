"""
Place nodes on the network schema canvas with a database trigger.

Nodes drawn in QGIS never pass through Django, so the canvas position is
computed by ``tg_place_node_on_canvas`` from the project's canvas center
and scale stored in ``network_schema_settings``. Canvas values that arrive
with an insert are ignored: they only come from features copied in QGIS,
whose position belongs to the original node. This replaces the
page-load sync and its ``canvas_sync_status`` table: existing projects keep
the center of their last sync, projects that were never synced are centered
on their nodes, and every node still missing a position is placed.
"""

from django.db import migrations, models

PLACE_NODE_FUNCTION = """
    CREATE OR REPLACE FUNCTION fn_place_node_on_canvas()
    RETURNS TRIGGER AS $$
    DECLARE
        v_center_x double precision;
        v_center_y double precision;
        v_scale double precision;
    BEGIN
        SELECT canvas_center_x, canvas_center_y, canvas_scale
          INTO v_center_x, v_center_y, v_scale
          FROM network_schema_settings
         WHERE project_id = NEW.project;

        IF v_center_x IS NULL OR v_center_y IS NULL THEN
            INSERT INTO network_schema_settings (project_id, canvas_center_x, canvas_center_y)
            VALUES (NEW.project, ST_X(NEW.geom), ST_Y(NEW.geom))
            ON CONFLICT (project_id) DO UPDATE
               SET canvas_center_x = COALESCE(network_schema_settings.canvas_center_x, EXCLUDED.canvas_center_x),
                   canvas_center_y = COALESCE(network_schema_settings.canvas_center_y, EXCLUDED.canvas_center_y)
            RETURNING canvas_center_x, canvas_center_y, canvas_scale
                 INTO v_center_x, v_center_y, v_scale;
        END IF;

        NEW.canvas_x := (ST_X(NEW.geom) - v_center_x) * v_scale;
        NEW.canvas_y := -(ST_Y(NEW.geom) - v_center_y) * v_scale;
        NEW.child_canvas_x := NULL;
        NEW.child_canvas_y := NULL;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
"""

CARRY_OVER_SYNC_CENTERS = """
    INSERT INTO network_schema_settings (project_id, canvas_center_x, canvas_center_y, canvas_scale)
    SELECT p.id, css.center_x, css.center_y, COALESCE(css.scale, 0.5)
      FROM canvas_sync_status css
      JOIN projects p ON css.sync_key = 'project_' || p.id
     WHERE css.center_x IS NOT NULL AND css.center_y IS NOT NULL
    ON CONFLICT (project_id) DO UPDATE
       SET canvas_center_x = EXCLUDED.canvas_center_x,
           canvas_center_y = EXCLUDED.canvas_center_y,
           canvas_scale = EXCLUDED.canvas_scale;
"""

CENTER_NEVER_SYNCED_PROJECTS = """
    INSERT INTO network_schema_settings (project_id, canvas_center_x, canvas_center_y)
    SELECT project,
           (MIN(ST_X(geom)) + MAX(ST_X(geom))) / 2,
           (MIN(ST_Y(geom)) + MAX(ST_Y(geom))) / 2
      FROM node
     GROUP BY project
    ON CONFLICT (project_id) DO UPDATE
       SET canvas_center_x = COALESCE(network_schema_settings.canvas_center_x, EXCLUDED.canvas_center_x),
           canvas_center_y = COALESCE(network_schema_settings.canvas_center_y, EXCLUDED.canvas_center_y);
"""

PLACE_UNPLACED_NODES = """
    UPDATE node
       SET canvas_x = (ST_X(node.geom) - s.canvas_center_x) * s.canvas_scale,
           canvas_y = -(ST_Y(node.geom) - s.canvas_center_y) * s.canvas_scale
      FROM network_schema_settings s
     WHERE s.project_id = node.project
       AND (node.canvas_x IS NULL OR node.canvas_y IS NULL);
"""


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0074_usersettings"),
    ]

    operations = [
        migrations.AddField(
            model_name="networkschemasettings",
            name="canvas_center_x",
            field=models.FloatField(
                blank=True,
                help_text="Geo X coordinate at the canvas origin, taken from the first placed node.",
                null=True,
                verbose_name="Canvas Center X",
            ),
        ),
        migrations.AddField(
            model_name="networkschemasettings",
            name="canvas_center_y",
            field=models.FloatField(
                blank=True,
                help_text="Geo Y coordinate at the canvas origin, taken from the first placed node.",
                null=True,
                verbose_name="Canvas Center Y",
            ),
        ),
        migrations.AddField(
            model_name="networkschemasettings",
            name="canvas_scale",
            field=models.FloatField(
                db_default=0.5,
                default=0.5,
                help_text="Canvas units per metre for placing nodes on the network schema. Can only be changed while no node of the project is placed.",
                verbose_name="Canvas Scale",
            ),
        ),
        migrations.AddField(
            model_name="networkschemasettings",
            name="configured",
            field=models.BooleanField(
                db_default=False,
                default=False,
                help_text="Tick once the excluded node types are set up. Until then the network schema warns that every node, including house connections, is shown.",
                verbose_name="Configured",
            ),
        ),
        migrations.RunSQL(
            sql="UPDATE network_schema_settings SET configured = TRUE;",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            sql=CARRY_OVER_SYNC_CENTERS, reverse_sql=migrations.RunSQL.noop
        ),
        migrations.RunSQL(
            sql=CENTER_NEVER_SYNCED_PROJECTS, reverse_sql=migrations.RunSQL.noop
        ),
        migrations.RunSQL(sql=PLACE_UNPLACED_NODES, reverse_sql=migrations.RunSQL.noop),
        migrations.DeleteModel(name="CanvasSyncStatus"),
        migrations.RunSQL(
            sql=PLACE_NODE_FUNCTION,
            reverse_sql="DROP FUNCTION IF EXISTS fn_place_node_on_canvas();",
        ),
        migrations.RunSQL(
            sql="""
                CREATE TRIGGER tg_place_node_on_canvas
                    BEFORE INSERT ON node
                    FOR EACH ROW
                EXECUTE FUNCTION fn_place_node_on_canvas();
            """,
            reverse_sql="DROP TRIGGER IF EXISTS tg_place_node_on_canvas ON node;",
        ),
    ]
