"""Enable pg_trgm extension and add GIN trigram indexes for fuzzy search."""

from django.contrib.postgres.operations import TrigramExtension
from django.db import migrations


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ("api", "0065_address_id_address_2"),
    ]

    operations = [
        TrigramExtension(),
        migrations.RunSQL(
            sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_address_street_trgm ON address USING gin (street gin_trgm_ops);',
            reverse_sql="DROP INDEX IF EXISTS idx_address_street_trgm;",
        ),
        migrations.RunSQL(
            sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_address_city_trgm ON address USING gin (city gin_trgm_ops);',
            reverse_sql="DROP INDEX IF EXISTS idx_address_city_trgm;",
        ),
        migrations.RunSQL(
            sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_address_zip_code_trgm ON address USING gin (zip_code gin_trgm_ops);',
            reverse_sql="DROP INDEX IF EXISTS idx_address_zip_code_trgm;",
        ),
        migrations.RunSQL(
            sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_address_district_trgm ON address USING gin (district gin_trgm_ops);',
            reverse_sql="DROP INDEX IF EXISTS idx_address_district_trgm;",
        ),
        migrations.RunSQL(
            sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_node_name_trgm ON node USING gin (name gin_trgm_ops);',
            reverse_sql="DROP INDEX IF EXISTS idx_node_name_trgm;",
        ),
        migrations.RunSQL(
            sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_area_name_trgm ON area USING gin (name gin_trgm_ops);',
            reverse_sql="DROP INDEX IF EXISTS idx_area_name_trgm;",
        ),
    ]
