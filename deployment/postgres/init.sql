-- Change these to your desired values

-- The credentials are not meant to be used in production!
-- Create the database
CREATE DATABASE krit_gis;
CREATE USER geodock_admin WITH PASSWORD 'geodock_admin';
ALTER ROLE geodock_admin SET client_encoding TO 'utf8';
ALTER ROLE geodock_admin SET default_transaction_isolation TO 'read committed';
ALTER ROLE geodock_admin SET timezone TO 'Europe/Berlin';
GRANT ALL PRIVILEGES ON DATABASE krit_gis TO geodock_admin;
CREATE EXTENSION IF NOT EXISTS postgis;