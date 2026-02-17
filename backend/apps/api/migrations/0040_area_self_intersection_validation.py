from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0039_improve_geometry_validation_errors"),
    ]

    operations = [
        migrations.RunSQL(
            # Forward SQL - create function and trigger for area polygon validation
            """
            -- Create validation function for polygon geometry (Area model)
            CREATE OR REPLACE FUNCTION fn_validate_polygon_geom() RETURNS trigger
            LANGUAGE plpgsql AS $$
            DECLARE
                centroid_text text;
            BEGIN
                IF NOT ST_IsValid(new.geom) THEN
                    -- Get the centroid for easier identification
                    centroid_text := ST_AsText(ST_Centroid(new.geom));
                    RAISE EXCEPTION 'Invalid geometry: %. Centroid: %. Area: % m²',
                        ST_IsValidReason(new.geom), centroid_text, ROUND(ST_Area(new.geom)::numeric, 2);
                ELSIF NOT ST_IsSimple(new.geom) THEN
                    -- Get the centroid for easier identification
                    centroid_text := ST_AsText(ST_Centroid(new.geom));
                    RAISE EXCEPTION 'Geometry is not simple (self-intersecting). Centroid: %. Area: % m²',
                        centroid_text, ROUND(ST_Area(new.geom)::numeric, 2);
                ELSE
                    RETURN new;
                END IF;
            END;
            $$;

            -- Create trigger on area table
            CREATE TRIGGER tg_01_validate_polygon_geom
                BEFORE INSERT OR UPDATE OF geom
                ON area
                FOR EACH ROW
                EXECUTE PROCEDURE fn_validate_polygon_geom();
            """,
            # Reverse SQL - drop trigger and function
            """
            DROP TRIGGER IF EXISTS tg_01_validate_polygon_geom ON area;
            DROP FUNCTION IF EXISTS fn_validate_polygon_geom();
            """,
        ),
    ]
