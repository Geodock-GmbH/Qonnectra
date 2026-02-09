"""
Migration to drop all ol_ database views.

The ol_trench, ol_address, ol_node, and ol_area views are no longer needed
because the application now queries base tables directly using geom_3857.
"""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0033_convert_geom_3857_to_generatedfield"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            DROP VIEW IF EXISTS public.ol_trench CASCADE;
            DROP VIEW IF EXISTS public.ol_node CASCADE;
            DROP VIEW IF EXISTS public.ol_address CASCADE;
            DROP VIEW IF EXISTS public.ol_area CASCADE;
            """,
            reverse_sql="""
            CREATE VIEW public.ol_trench AS
            SELECT
                t.uuid,
                t.id_trench,
                t.construction_depth,
                t.construction_details,
                t.internal_execution,
                t.funding_status,
                t.date,
                t.comment,
                t.house_connection,
                t.length,
                t.geom_3857 AS geom,
                t.constructor,
                t.construction_type,
                t.owner,
                t.phase,
                t.status,
                t.surface,
                t.project,
                t.flag
            FROM trench t
            ORDER BY t.id_trench;

            CREATE VIEW public.ol_node AS
            SELECT
                n.uuid,
                n.name,
                n.warranty,
                n.date,
                n.geom_3857 AS geom,
                n.constructor,
                n.flag,
                n.manufacturer,
                n.network_level,
                n.node_type,
                n.owner,
                n.project,
                n.status,
                n.uuid_address,
                n.parent_node
            FROM node n;

            CREATE VIEW public.ol_address AS
            SELECT
                a.uuid,
                a.id_address,
                a.zip_code,
                a.city,
                a.district,
                a.street,
                a.housenumber,
                a.house_number_suffix,
                a.geom_3857 AS geom,
                a.flag,
                a.project,
                a.status_development
            FROM address a;

            CREATE VIEW public.ol_area AS
            SELECT
                a.uuid,
                a.name,
                a.area_type,
                a.geom_3857 AS geom,
                a.flag,
                a.project
            FROM area a
            ORDER BY a.name;
            """,
        ),
    ]
