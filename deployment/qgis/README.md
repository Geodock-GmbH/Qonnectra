# QGIS Server Setup

This directory contains the QGIS Server configuration for the Qonnectra project.

## Structure

- `projects/` - Directory containing QGIS project files (.qgs)
- `data/` - Directory for additional data files (shapefiles, etc.)
- `pg_service.conf` - PostgreSQL service configuration for database connections

## Usage

### Accessing QGIS Server

Once the stack is running, QGIS Server will be available at:
- Direct access: http://localhost:8082
- Through Caddy proxy: https://qgis.localhost

### Testing the Setup

To verify QGIS Server is working correctly, test the WMS capabilities:

```bash
# Direct access
curl "http://localhost:8082/ows/?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities"

# Through Caddy proxy (use -k to ignore SSL cert)
curl -k "https://qgis.localhost/ows/?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities"
```

Both should return valid XML with WMS capabilities information.

### Available Services

QGIS Server provides the following OGC services:
- **WMS** (Web Map Service) - For map rendering
- **WFS** (Web Feature Service) - For vector data access
- **WMTS** (Web Map Tile Service) - For cached map tiles
- **WCS** (Web Coverage Service) - For raster data
- **API endpoints** - Including WFS3/OGC API Features

### Adding QGIS Projects

1. Create or copy your .qgs project files to the `projects/` directory
2. Update the `QGIS_PROJECT_FILE` environment variable in docker-compose.yml to point to your project
3. Restart the QGIS Server container: `docker restart qonnectra_qgis_server_prod` (or check actual container name with `docker ps`)

### Database Integration

QGIS Server is configured to connect to your PostgreSQL database using the settings in `pg_service.conf`. The connection uses:
- Host: `db` (the PostgreSQL container)
- Database: Uses `${DB_NAME}` from your environment
- User/Password: Uses `${DB_USER}` and `${DB_PASSWORD}` from your environment

### Django Integration

For future Django admin integration:
1. Create a Django admin page for uploading QGIS project files
2. Save uploaded .qgs files to the `deployment/qgis/projects/` directory
3. Update the container environment variable to point to the new project
4. Restart the QGIS Server container to load the new project

### Environment Variables

Required environment variables (set in your `.env` file):
```bash
# QGIS Server port (optional, defaults to 8082)
QGIS_SERVER_PORT=8082

# Database connection (inherited from main stack)
DB_NAME=your_database_name
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_HOST=db
DB_PORT=5432
```

### Custom Project Files

The default project (`default.qgs`) is a minimal empty project in WGS84. To use your own project:
1. Ensure your project uses layers compatible with your database schema
2. Use relative paths or PostgreSQL connections in your project
3. Test the project file in QGIS Desktop before deploying

### Troubleshooting

- Check container logs: `docker logs [qgis_container_name]` (use `docker ps` to find the exact container name)
- Verify project file syntax: Ensure .qgs file is valid XML
- Database connectivity: Ensure PostgreSQL service is healthy
- Port conflicts: Check that port 8082 is not used by other services 