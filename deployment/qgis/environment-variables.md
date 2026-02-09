# Environment Variables for QGIS Server

## Quick Setup

Before starting QGIS Server, you need to:

1. **Create your PostgreSQL service configuration:**

   ```bash
   cp pg_service.conf.template pg_service.conf
   # Edit pg_service.conf with your database credentials
   ```

2. **Add your QGIS project files** to the `projects/` directory

3. **Ensure your QGIS project uses a PostgreSQL service connection** that matches the service name in `pg_service.conf`

## Environment Variables

Add these variables to your `.env` file in the deployment directory:

```bash
# QGIS Server Configuration
QGIS_SERVER_PORT=8082

# PostgreSQL service name used in your QGIS project
# This should match the service name in pg_service.conf and your QGIS project
# Example: If your QGIS project uses service='qonnectra', set this to 'qonnectra'
QGIS_PG_SERVICE_NAME=qonnectra
```

## QGIS Database User

For security, QGIS Server uses a separate database user with limited permissions instead of the main admin user. This user has read-write access to tables but cannot modify schema or extensions.

Add these variables to your `.env` file:

```bash
# QGIS Database User (created during database initialization)
QGIS_DB_USER=qgis_user
QGIS_DB_PASSWORD=your_secure_qgis_password
```

The QGIS user is automatically created by `postgres/init.sh` with the following permissions:

- SELECT, INSERT, UPDATE, DELETE on all tables
- Usage on sequences (for auto-increment fields)
- No schema modification or extension privileges

## PostgreSQL Service Configuration

QGIS projects connect to PostgreSQL using a service name. This is configured in `pg_service.conf`:

```ini
[qonnectra]
host=db
port=5432
dbname=your_database_name
user=qgis_user
password=your_qgis_user_password
sslmode=disable
```

**Important:** Use the QGIS database user credentials here, not the main admin user.

The service name in brackets (e.g., `[qonnectra]`) must match:

1. The `QGIS_PG_SERVICE_NAME` environment variable
2. The service name used in your QGIS project's PostgreSQL layers

## Creating QGIS Projects

When creating QGIS projects for the server:

1. Use PostgreSQL/PostGIS layers with **service-based connections**
2. In QGIS, when adding a PostGIS connection, use "Service" instead of host/port/database
3. Set the service name to match your `pg_service.conf` configuration
4. Save the project to `deployment/qgis/projects/`

## Testing the Setup

1. Start the stack: `docker-compose up -d`
2. Check QGIS Server logs: `docker logs qonnectra_qgis_server_prod`
3. Test WMS capabilities (replace `your-project.qgs` with your project file):
   ```bash
   curl "https://qgis.localhost/ows/?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities&MAP=/projects/your-project.qgs"
   ```

## Troubleshooting

### "Service not found" error

- Ensure `pg_service.conf` exists (copy from template)
- Verify the service name matches what your QGIS project expects

### Database connection errors

- Check database credentials in `pg_service.conf`
- Ensure the database container is running and healthy
- Verify network connectivity (use `db` as host for Docker)

### Project not found

- Ensure your `.qgs` file is in `deployment/qgis/projects/`
- Include the full path in requests: `MAP=/projects/your-project.qgs`
