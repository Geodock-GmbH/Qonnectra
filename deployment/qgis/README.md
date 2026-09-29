# QGIS Server Setup

This directory contains the QGIS Server configuration for the qonnectra project.

## Structure

- `projects/`: QGIS project files (.qgs/.qgz), mounted read-only at `/projects` in the container
- `data/`: additional data files referenced by projects, mounted read-only at `/data`
- `nginx.conf`: nginx front end that passes requests to the QGIS FastCGI processes
- `pg_service.conf.template`: reference only; `pg_service.conf` is generated at container start (see [Database Integration](#database-integration))
- `environment-variables.md`: the variables and the database user in detail

## Usage

### Accessing QGIS Server

QGIS Server has no published port. It is reachable only through Caddy:

- Development: `https://qgis.localhost`
- Production: `https://<QGIS_DOMAIN>`

Every request is authenticated through Django first (see [Authentication Flow](#authentication-flow)).

### Testing the setup

Test the WMS capabilities of a project (replace `<project>` with a file in `projects/`):

```bash
# Development (-k ignores the local certificate); -u uses HTTP Basic with a Django user
curl -k -u <username> "https://qgis.localhost/ows/?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities&MAP=/projects/<project>.qgs"

# WFS
curl -k -u <username> "https://qgis.localhost/ows/?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetCapabilities&MAP=/projects/<project>.qgs"
```

Both requests should return XML with the service capabilities.

The `MAP` parameter is required and must point to a project file in the `/projects/` directory (e.g., `MAP=/projects/myproject.qgs`).

### Available services

QGIS Server provides these OGC services:

- WMS (Web Map Service): map rendering
- WFS (Web Feature Service): vector data access and editing (requires the MAP parameter)
- WMTS (Web Map Tile Service): cached map tiles
- WCS (Web Coverage Service): raster data
- OGC API Features (WFS3): REST API for vector data; the backend also proxies it at `/api/v1/wfs3/<project>/`

### WFS with MAP parameter

Every WFS request must include the `MAP` parameter pointing to a QGIS project file:

```bash
# Example WFS GetFeature request with HTTP Basic authentication
curl -k -u <username> \
  "https://qgis.localhost/ows/?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&MAP=/projects/myproject.qgs&TYPENAME=layer_name"
```

### Adding QGIS projects

There are two ways to add a project:

1. Django admin (recommended): upload the project in the admin under QGIS projects. The file is stored as `projects/<name>.qgs` (or `.qgz`), and data files uploaded with it go to `data/<name>/`. The admin validates the upload and warns when the project was saved with a different QGIS version than `QGIS_SERVER_VERSION`.
2. Manually: copy the `.qgs`/`.qgz` file to `projects/` on the host.

No restart is needed; QGIS Server loads the project on the next request that names it in `MAP`.

### Database Integration

QGIS projects connect to PostgreSQL through a PostgreSQL service name. At container start the compose command writes `/etc/postgresql-common/pg_service.conf` from `.env`:

```ini
[${QGIS_PG_SERVICE_NAME}]
host=db
port=5432
dbname=${DB_NAME}
user=${QGIS_DB_USER}
password=${QGIS_DB_PASSWORD}
sslmode=disable
```

QGIS Server therefore connects as the limited QGIS user instead of the main `DB_USER`. The service name must match the one used in your project's layers.

### Django integration

1. Forward authentication: Caddy forwards authentication requests to Django's `/api/v1/auth/qgis-auth/` endpoint
2. Project management: QGIS project and data files uploaded in the Django admin go to `deployment/qgis/projects/` and `deployment/qgis/data/`
3. WFS error logging: the backend logs WFS errors and validation failures
4. Triggers: PostgreSQL triggers fill values such as `id_trench` so that WFS inserts don't fail

### Authentication Flow

1. A request to QGIS Server goes through Caddy
2. Caddy calls Django's forward_auth endpoint with the request's cookies and `Authorization` header
3. Django accepts a valid JWT cookie (browser) or HTTP Basic credentials of a Django user (QGIS Desktop, curl); otherwise it answers 401 with a `WWW-Authenticate` challenge
4. If authenticated, Caddy forwards the request to QGIS Server
5. QGIS Server processes the request with the QGIS database user

### Environment variables

Set in `deployment/.env`:

```bash
# Database name (shared with the main stack)
DB_NAME=qonnectra

# QGIS database user (created by postgres/init.sh on the database's first start)
QGIS_DB_USER=qgis_user
QGIS_DB_PASSWORD=your_qgis_password

# PostgreSQL service name used by your QGIS projects
QGIS_PG_SERVICE_NAME=qonnectra

# Version of the qgis/qgis-server image, used to warn about version skew on upload
QGIS_SERVER_VERSION=3.44.7
```

The log level is set in the compose files (`QGIS_SERVER_LOG_LEVEL=1` in production, `2` in development).

### Custom project files

To use your own project:

1. Use PostgreSQL layers with the service connection (`service='qonnectra'`), not host/port/user
2. Use relative paths for any file-based data
3. Test the project file in QGIS Desktop before deploying

### Troubleshooting

#### Common issues

1. Missing MAP parameter error
   - Always include `MAP=/projects/<project>.qgs` in WMS/WFS requests

2. Authentication failures
   - Check the Caddy logs for forward_auth errors: `docker compose logs caddy`
   - For QGIS Desktop, use the username and password of a Django user (HTTP Basic)
   - For browsers, check that the JWT cookie is present and set on the right `COOKIE_DOMAIN`

3. Database connection issues / "Service not found"
   - Check `QGIS_DB_USER`, `QGIS_DB_PASSWORD` and `QGIS_PG_SERVICE_NAME` in `.env`
   - The QGIS user is created only on the database's first start (`postgres/init.sh`); if you set the variables later, create the role manually as in that script and restart the backend, which grants the table privileges on startup
   - Inspect the generated file: `docker exec <qgis_container> cat /etc/postgresql-common/pg_service.conf`
   - Check the PostgreSQL logs for connection errors

4. WFS NULL id_trench errors
   - Check that the PostgreSQL triggers exist
   - Review the WFS error logs in Django

5. Project file not found
   - Make sure the file exists in `deployment/qgis/projects/`
   - Check the file permissions (QGIS Server must be able to read it)
   - Verify the MAP path is the container path (`/projects/...`)

6. Performance issues
   - `spawn-fcgi -F` in the compose command sets the number of render processes (3 in production, 2 in development); raise it in `docker-compose.override.yml` on larger hosts
   - Monitor PostgreSQL query performance

#### Debug commands

```bash
# Container logs
docker compose logs -f qgis-server

# Container name
docker ps | grep qgis

# Test WMS through Caddy
curl -k -u <username> "https://qgis.localhost/ows/?SERVICE=WMS&REQUEST=GetCapabilities&MAP=/projects/<project>.qgs"
```
