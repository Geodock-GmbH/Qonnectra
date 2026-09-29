# Environment Variables for QGIS Server

## Quick setup

Before starting QGIS Server:

1. Set the QGIS variables in `deployment/.env` (see below). `pg_service.conf` is generated from them at container start; there is no file to create.

2. Add your QGIS project files through the Django admin or to the `projects/` directory.

3. Make sure your QGIS project uses a PostgreSQL service connection whose name matches `QGIS_PG_SERVICE_NAME`.

## Environment variables

Add these variables to the `.env` file in the deployment directory:

```bash
# PostgreSQL service name used in your QGIS project
# Example: If your QGIS project uses service='qonnectra', set this to 'qonnectra'
QGIS_PG_SERVICE_NAME=qonnectra

# Version of the qgis/qgis-server image in docker-compose; the admin warns when an
# uploaded project was saved with a different QGIS version
QGIS_SERVER_VERSION=3.44.7
```

## QGIS database user

For security, QGIS Server uses a separate database user with limited permissions instead of the main admin user. This user can read and write the tables but cannot modify the schema or extensions.

Add these variables to your `.env` file:

```bash
# QGIS Database User (created during database initialization)
QGIS_DB_USER=qgis_user
QGIS_DB_PASSWORD=your_secure_qgis_password
```

`postgres/init.sh` creates the QGIS user when the database is initialised for the first time, with `CONNECT` on the database and `USAGE` on the `public` schema. The backend grants the table privileges after every `migrate` (`backend/apps/api/qgis_role.py`), so the backend container needs `QGIS_DB_USER` too:

- SELECT, INSERT, UPDATE, DELETE on all tables in `public`
- Usage on sequences (for auto-increment fields)
- No schema modification or extension privileges
- No access to the Django auth, session, token and admin tables, `django_migrations`, `model_permission`, `route_permission` and `user_settings`

## PostgreSQL service configuration

QGIS projects connect to PostgreSQL through a service name. The QGIS Server container writes `/etc/postgresql-common/pg_service.conf` at startup from `QGIS_PG_SERVICE_NAME`, `DB_NAME`, `QGIS_DB_USER` and `QGIS_DB_PASSWORD`, so the password is defined only in `.env`. The generated file looks like this:

```ini
[qonnectra]
host=db
port=5432
dbname=your_database_name
user=qgis_user
password=your_qgis_user_password
sslmode=disable
```

The service name in brackets (e.g., `[qonnectra]`) comes from `QGIS_PG_SERVICE_NAME` and must match the service name used in your QGIS project's PostgreSQL layers.

## Creating QGIS projects

When creating QGIS projects for the server:

1. Use PostgreSQL/PostGIS layers with service-based connections
2. In QGIS, when adding a PostGIS connection, use "Service" instead of host/port/database
3. Set the service name to `QGIS_PG_SERVICE_NAME`
4. Upload the project in the Django admin, or save it to `deployment/qgis/projects/`

## Testing the setup

1. Start the stack: `docker-compose up -d`
2. Check the QGIS Server logs: `docker logs qonnectra_qgis_server_prod`
3. Test the WMS capabilities (replace `your-project.qgs` with your project file):
   ```bash
   curl -u <django-user> "https://qgis.localhost/ows/?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities&MAP=/projects/your-project.qgs"
   ```

## Troubleshooting

### "Service not found" error

- Verify `QGIS_PG_SERVICE_NAME` matches what your QGIS project expects
- Check the generated file: `docker exec qonnectra_qgis_server_prod cat /etc/postgresql-common/pg_service.conf`

### Database connection errors

- Check `QGIS_DB_USER` / `QGIS_DB_PASSWORD` in `.env` and that the role exists in the database
- Make sure the database container is running and healthy
- Verify network connectivity (use `db` as host for Docker)

### Project not found

- Make sure your `.qgs` file is in `deployment/qgis/projects/`
- Include the full path in requests: `MAP=/projects/your-project.qgs`
