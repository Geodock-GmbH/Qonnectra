"""
Anchor each project's canvas on the center most of its placed nodes share.

The page-load sync recomputed its center from the growing extent on every
run, so a project's nodes form groups placed with different centers. 0075
kept the center of the last sync, which can belong to a small group. Every
placed node implies the center it was laid out with
(``geo - canvas / scale``, Y flipped): nodes of one sync share it, nodes
moved by hand scatter. The center shared by the most nodes wins, unless it
explains no more nodes than the current one. No node is moved.
"""

from django.db import migrations

ANCHOR_ON_MAJORITY_CENTER = """
    WITH implied AS (
        SELECT n.project AS project_id,
               ST_X(n.geom) - n.canvas_x / s.canvas_scale AS center_x,
               ST_Y(n.geom) + n.canvas_y / s.canvas_scale AS center_y
          FROM node n
          JOIN network_schema_settings s ON s.project_id = n.project
         WHERE n.canvas_x IS NOT NULL AND n.canvas_y IS NOT NULL AND s.canvas_scale > 0
    ),
    -- Group at 10 cm so float noise from the canvas math does not split a sync's nodes
    votes AS (
        SELECT project_id,
               round(center_x::numeric, 1) AS key_x,
               round(center_y::numeric, 1) AS key_y,
               avg(center_x) AS center_x,
               avg(center_y) AS center_y,
               count(*) AS node_count
          FROM implied
         GROUP BY 1, 2, 3
    ),
    best AS (
        SELECT DISTINCT ON (project_id) project_id, center_x, center_y, node_count
          FROM votes
         ORDER BY project_id, node_count DESC, key_x, key_y
    ),
    current AS (
        SELECT v.project_id, v.node_count
          FROM votes v
          JOIN network_schema_settings s ON s.project_id = v.project_id
         WHERE v.key_x = round(s.canvas_center_x::numeric, 1)
           AND v.key_y = round(s.canvas_center_y::numeric, 1)
    )
    UPDATE network_schema_settings s
       SET canvas_center_x = best.center_x,
           canvas_center_y = best.center_y
      FROM best
      LEFT JOIN current ON current.project_id = best.project_id
     WHERE s.project_id = best.project_id
       AND best.node_count > COALESCE(current.node_count, 0);
"""


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0075_network_schema_canvas_placement"),
    ]

    operations = [
        migrations.RunSQL(
            sql=ANCHOR_ON_MAJORITY_CENTER, reverse_sql=migrations.RunSQL.noop
        ),
    ]
