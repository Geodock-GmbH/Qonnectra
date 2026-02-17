from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0038_residential_unit_id_generation"),
    ]

    operations = [
        migrations.RunSQL(
            """
            CREATE OR REPLACE FUNCTION fn_validate_linestring_geom() RETURNS trigger
            LANGUAGE plpgsql AS $$
            DECLARE
                invalid_point geometry;
                centroid_text text;
            BEGIN
                IF NOT st_isvalid(new.geom) THEN
                    RAISE EXCEPTION 'Invalid geometry: %', st_isvalidreason(new.geom);
                ELSIF NOT st_issimple(new.geom) THEN
                    -- Get the centroid of the geometry for easier identification
                    centroid_text := ST_AsText(ST_Centroid(new.geom));
                    RAISE EXCEPTION 'Geometry is not simple (self-intersecting). Centroid: %. Length: %m',
                        centroid_text, ROUND(ST_Length(new.geom)::numeric, 2);
                ELSE
                    RETURN new;
                END IF;
            END;
            $$;
            """,
            # Reverse SQL - restore original function
            """
            CREATE OR REPLACE FUNCTION fn_validate_linestring_geom() RETURNS trigger
            LANGUAGE plpgsql AS $$
            BEGIN
                IF NOT st_isvalid(new.geom) THEN
                    RAISE EXCEPTION 'Invalid geometry: %', st_isvalidreason(new.geom);
                ELSIF NOT st_issimple(new.geom) THEN
                    RAISE EXCEPTION 'Geometry is not simple';
                ELSE
                    RETURN new;
                END IF;
            END;
            $$;
            """,
        ),
    ]
