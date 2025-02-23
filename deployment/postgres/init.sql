-- Change these to your desired values

-- The credentials are not meant to be used in production!

-- Create the database
GRANT ALL PRIVILEGES ON DATABASE krit_gis TO geodock_admin;

-- Create nextcloud_db database
CREATE DATABASE nextcloud_db;
GRANT ALL PRIVILEGES ON DATABASE nextcloud_db TO geodock_admin;

-- Set the user's client encoding
\c krit_gis
ALTER ROLE geodock_admin SET client_encoding TO 'utf8';

-- Set the user's transaction isolation level
-- ALTER ROLE geodock_admin SET default_transaction_isolation TO 'read committed';

-- Set the user's timezone
\c krit_gis
ALTER ROLE geodock_admin SET timezone TO 'Europe/Berlin';

-- Create the postgis extension
\c krit_gis
CREATE EXTENSION IF NOT EXISTS postgis;
