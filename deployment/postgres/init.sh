#!/bin/bash
set -e

# Use environment variables set by PostgreSQL Docker image
# These are automatically available: POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD
# Additional QGIS user variables: QGIS_DB_USER, QGIS_DB_PASSWORD

# Note: The database and main user are already created by the PostgreSQL Docker image
# when POSTGRES_DB and POSTGRES_USER environment variables are set.
# The main user already has full privileges on the database, so no GRANT is needed.

# Execute SQL commands using the database and user from environment variables
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Set the main user's client encoding
    ALTER ROLE "$POSTGRES_USER" SET client_encoding TO 'utf8';

    -- Set the main user's timezone
    ALTER ROLE "$POSTGRES_USER" SET timezone TO 'Europe/Berlin';

    -- Create the postgis extension
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE EXTENSION IF NOT EXISTS pgrouting;
    CREATE EXTENSION IF NOT EXISTS dblink;
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
EOSQL

# Create QGIS user if credentials are provided
if [ -n "$QGIS_DB_USER" ] && [ -n "$QGIS_DB_PASSWORD" ]; then
    echo "Creating QGIS database user: $QGIS_DB_USER"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
        -- Create QGIS user for WFS/WMS access
        DO \$\$
        BEGIN
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$QGIS_DB_USER') THEN
                CREATE ROLE "$QGIS_DB_USER" WITH LOGIN PASSWORD '$QGIS_DB_PASSWORD';
            END IF;
        END
        \$\$;

        -- Set QGIS user's client encoding and timezone
        ALTER ROLE "$QGIS_DB_USER" SET client_encoding TO 'utf8';
        ALTER ROLE "$QGIS_DB_USER" SET timezone TO 'Europe/Berlin';

        -- Grant connect privilege
        GRANT CONNECT ON DATABASE "$POSTGRES_DB" TO "$QGIS_DB_USER";

        -- Grant usage on public schema
        GRANT USAGE ON SCHEMA public TO "$QGIS_DB_USER";
EOSQL
    echo "QGIS user created successfully"
else
    echo "QGIS_DB_USER or QGIS_DB_PASSWORD not set, skipping QGIS user creation"
fi

