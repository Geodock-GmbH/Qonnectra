#!/bin/bash
set -e

# Use environment variables set by PostgreSQL Docker image
# These are automatically available: POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD

# Note: The database and user are already created by the PostgreSQL Docker image
# when POSTGRES_DB and POSTGRES_USER environment variables are set.
# The user already has full privileges on the database, so no GRANT is needed.

# Execute SQL commands using the database and user from environment variables
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Set the user's client encoding
    ALTER ROLE "$POSTGRES_USER" SET client_encoding TO 'utf8';
    
    -- Set the user's timezone
    ALTER ROLE "$POSTGRES_USER" SET timezone TO 'Europe/Berlin';
    
    -- Create the postgis extension
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE EXTENSION IF NOT EXISTS pgrouting;
    CREATE EXTENSION IF NOT EXISTS dblink;
EOSQL

