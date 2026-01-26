# QGIS Server Setup

This directory contains the QGIS Server configuration for the qonnectra project.

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
# Direct access (requires MAP parameter)
curl "http://localhost:8082/ows/?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities&MAP=/projects/default.qgs"

# Through Caddy proxy (use -k to ignore SSL cert for localhost)
curl -k "https://qgis.localhost/ows/?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities&MAP=/projects/default.qgs"

# Test WFS with MAP parameter
curl -k "https://qgis.localhost/ows/?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetCapabilities&MAP=/projects/default.qgs"
```

All requests should return valid XML with service capabilities information.

**Important**: The `MAP` parameter is required and must point to a project file in the `/projects/` directory (e.g., `MAP=/projects/myproject.qgs`).

### Available Services

QGIS Server provides the following OGC services:
- **WMS** (Web Map Service) - For map rendering
- **WFS** (Web Feature Service) - For vector data access and editing (requires MAP parameter)
- **WMTS** (Web Map Tile Service) - For cached map tiles
- **WCS** (Web Coverage Service) - For raster data
- **OGC API Features** (WFS3) - Modern RESTful API for vector data

### WFS with MAP Parameter

All WFS requests **must** include the `MAP` parameter pointing to a QGIS project file:

```bash
# Example WFS GetFeature request
curl -k "https://qgis.localhost/ows/?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&MAP=/projects/myproject.qgs&TYPENAME=layer_name"

# Example with authentication (Django forward_auth)
curl -k -H "Cookie: sessionid=<your_session_id>" \
  "https://qgis.localhost/ows/?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&MAP=/projects/myproject.qgs&TYPENAME=trenches"
```

**Frontend Integration**: The frontend automatically includes the MAP parameter in all QGIS Server requests through the configured API client.

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

QGIS Server is integrated with Django authentication:

1. **Forward Authentication**: Caddy forwards authentication requests to Django's `/api/v1/auth/qgis-auth/` endpoint
2. **WFS Error Logging**: Backend logs WFS errors and validation failures
3. **Triggers**: PostgreSQL triggers prevent WFS failures (e.g., handling NULL id_trench values)
4. **Admin Integration**: Upload QGIS project files (.qgs) through Django admin to the `deployment/qgis/projects/` directory

### Authentication Flow

1. User authenticates with Django (JWT token in HTTP-only cookie)
2. Request to QGIS Server goes through Caddy
3. Caddy validates authentication with Django forward_auth endpoint
4. If authenticated, request is forwarded to QGIS Server
5. QGIS Server processes request with PostgreSQL database access

### Environment Variables

Required environment variables (set in your `deployment/.env` file):
```bash
# QGIS Server port (optional, defaults to 80 internal)
QGIS_SERVER_PORT=80

# Database connection (inherited from main stack)
DB_NAME=qonnectra
DB_USER=qonnectra_user
DB_PASSWORD=your_db_password
DB_HOST=db
DB_PORT=5432

# QGIS Server configuration
QGIS_SERVER_LOG_LEVEL=0  # 0=INFO, 1=WARNING, 2=CRITICAL
QGIS_PROJECT_FILE=/projects/default.qgs  # Default project (can be overridden with MAP parameter)
MAX_CACHE_LAYERS=1000
QGIS_SERVER_PARALLEL_RENDERING=1
```

### Custom Project Files

The default project (`default.qgs`) is a minimal empty project in WGS84. To use your own project:
1. Ensure your project uses layers compatible with your database schema
2. Use relative paths or PostgreSQL connections in your project
3. Test the project file in QGIS Desktop before deploying

### Troubleshooting

#### Common Issues

1. **Missing MAP parameter error**
   - Solution: Always include `MAP=/projects/<project>.qgs` in all WFS/WMS requests
   - Check frontend API client configuration

2. **Authentication failures**
   - Check Django forward_auth endpoint is accessible: `curl http://backend:8000/api/v1/auth/qgis-auth/`
   - Verify JWT token is present in cookies
   - Check Caddy logs for forward_auth errors

3. **Database connection issues**
   - Verify `pg_service.conf` configuration
   - Test database connectivity from QGIS container: `docker exec -it <qgis_container> psql -h db -U qonnectra_user -d qonnectra`
   - Check PostgreSQL logs for connection errors

4. **WFS NULL id_trench errors**
   - Backend includes triggers to handle NULL values
   - Check PostgreSQL trigger status
   - Review WFS error logs in Django

5. **Project file not found**
   - Ensure .qgs file exists in `deployment/qgis/projects/` directory
   - Check file permissions (must be readable by QGIS Server)
   - Verify MAP parameter path is correct (absolute path from container perspective)

6. **Performance issues**
   - Adjust `QGIS_SERVER_PARALLEL_RENDERING` setting
   - Increase `MAX_CACHE_LAYERS`
   - Check FCGI process count (min 2, max 8 in production)
   - Monitor PostgreSQL query performance

#### Debug Commands

```bash
# Check container logs
docker-compose logs qgis-server

# Check specific container name
docker ps | grep qgis

# View detailed logs
docker logs -f <qgis_container_name>

# Test database connection
docker exec -it <qgis_container> psql -h db -U qonnectra_user -d qonnectra

# Test WMS with MAP parameter
curl -k "https://qgis.localhost/ows/?SERVICE=WMS&REQUEST=GetCapabilities&MAP=/projects/default.qgs"

# Check QGIS Server version
docker exec -it <qgis_container> qgis_mapserver.fcgi -v
``` 