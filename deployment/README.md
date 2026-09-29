# qonnectra Deployment

This guide covers three ways to run qonnectra.

## Deployment options

1. Local development: manual PostgreSQL setup, with VS Code tasks for the backend and frontend
2. Docker Compose (development): the full stack, with local HTTPS from Caddy (self-signed certificates)
3. Production deployment: the full stack, with Caddy as reverse proxy and Let's Encrypt HTTPS

## Docker Compose files

| File                                   | Purpose                            |
| -------------------------------------- | ---------------------------------- |
| `docker-compose.yml`                   | Production deployment (default)    |
| `docker-compose.dev.yml`               | Development with Caddy local HTTPS |
| `docker-compose.override.yml.template` | Template for local customizations  |
| `.env.production.template`             | Template for `deployment/.env`     |

For local customizations, copy `docker-compose.override.yml.template` to `docker-compose.override.yml`. The override file is gitignored.

The development stack runs a subset of the production services: it has no `backend-wms` and no `wireguard` container, keeps the database in `postgres/data/` (bind mount) and publishes it on `localhost:5440`.

## 1. Local development

Use this setup for day-to-day development with hot reloading, debugging and direct database access.

### Prerequisites

- Python >= 3.12
- [uv](https://github.com/astral-sh/uv) package manager (recommended) or pip
- Node.js 22+
- PostgreSQL 17 with PostGIS extension
- VS Code (for tasks) or your preferred IDE

### Setup steps

#### 1.1 Backend environment configuration

Create a `.env` file in the `deployment/` directory:

```bash
# Django Settings
DJANGO_SECRET_KEY=your-secret-key-here
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
DEBUG=True
CSRF_TRUSTED_ORIGINS=http://localhost:5173,http://localhost:8000

# Database (for local PostgreSQL)
DB_NAME=qonnectra
DB_USER=qonnectra_user
DB_PASSWORD=your-secure-password
DB_HOST=localhost
DB_PORT=5432

# Spatial Data
DEFAULT_SRID=25832  # ETRS89 / UTM zone 32N or 33N

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:5173

# Django Superuser
DJANGO_SUPERUSER_USERNAME=admin
DJANGO_SUPERUSER_EMAIL=admin@example.com
DJANGO_SUPERUSER_PASSWORD=your-admin-password

# Cookie Domain (optional for local dev)
USE_COOKIE_DOMAIN_MIDDLEWARE=False
```

#### 1.2 Frontend environment configuration

Create a `.env` file in the `frontend/` directory:

```bash
cp frontend/.env.example frontend/.env
```

```bash
# API URL
API_URL=http://localhost:8000/api/v1/
PUBLIC_API_URL=http://localhost:8000/api/v1/

# Optional: vector base map (falls back to OSM tiles when unset)
# PUBLIC_TILE_SERVER_URL=https://tiles.localhost

# Optional: link to the user manual
PUBLIC_DOCUMENTATION_URL=https://qonnectra.de/manual/
```

SvelteKit reads server-side variables from `$env/static/private` and public variables (prefixed with `PUBLIC_`) from `$env/static/public`. For local development, make sure `API_URL` is set correctly.

#### 1.3 Database setup

Install and configure PostgreSQL with PostGIS:

```bash
# macOS (using Homebrew)
brew install postgresql@17 postgis
brew services start postgresql@17

# Ubuntu/Debian
sudo apt-get install postgresql-17 postgresql-17-postgis

# Create database and user
psql postgres
CREATE DATABASE qonnectra;
CREATE USER qonnectra_user WITH PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE qonnectra TO qonnectra_user;
\c qonnectra
CREATE EXTENSION postgis;
\q
```

#### 1.4 Backend setup

```bash
cd backend

# Create virtual environment
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
uv sync --dev

# Run migrations
python manage.py migrate

# Load initial data (attributes, projects, flags, settings) - idempotent
python manage.py load_initial_data

# Create superuser
python manage.py createsuperuser
```

#### 1.5 Frontend setup

```bash
cd frontend

# Install dependencies
npm install
```

#### 1.6 VS Code tasks

The workspace includes VS Code tasks for running the services. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and select one of:

- Django Runserver: starts the Django development server on `http://localhost:8000`
- Frontend Dev Server: starts the SvelteKit dev server on `http://localhost:5173`
- Django Migrate: runs the database migrations

Or use the terminal:

```bash
# Backend
cd backend
uv run manage.py runserver

# Frontend
cd frontend
npm run dev
```

### Accessing services

- Frontend: `http://localhost:5173`
- API: `http://localhost:8000`
- Django admin: `http://localhost:8000/admin` (local dev only, no subdomain separation)
- Database: `localhost:5432`

## 2. Docker Compose (development with local HTTPS)

This setup runs all services in Docker Compose, with Caddy providing local HTTPS through self-signed certificates. Caddy tries to install its CA certificate on first run.

### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 8 CPU cores and 16GB RAM (the compose file is tuned for this baseline)
- Ports 80 and 443 available

### Setup steps

#### 2.1 Environment configuration

Create a `.env` file in the `deployment/` directory:

```bash
# Django Settings
DJANGO_SECRET_KEY=your-secret-key-here
DJANGO_ALLOWED_HOSTS=api.localhost,admin.localhost,localhost,127.0.0.1
DEBUG=True
CSRF_TRUSTED_ORIGINS=https://api.localhost,https://app.localhost,https://admin.localhost

# Database
DB_NAME=qonnectra
DB_USER=qonnectra_user
DB_PASSWORD=your-secure-password
DB_HOST=db
DB_PORT=5432

# QGIS Server database user (created by postgres/init.sh on first start)
QGIS_DB_USER=qgis_user
QGIS_DB_PASSWORD=your-qgis-password

# Spatial Data
DEFAULT_SRID=25832  # ETRS89 / UTM zone 32N or 33N

# CORS
CORS_ALLOWED_ORIGINS=https://app.localhost

# Django Superuser
DJANGO_SUPERUSER_USERNAME=admin
DJANGO_SUPERUSER_EMAIL=admin@example.com
DJANGO_SUPERUSER_PASSWORD=your-admin-password

# Cookie Domain (for cross-subdomain cookies)
USE_COOKIE_DOMAIN_MIDDLEWARE=True
COOKIE_DOMAIN=.localhost
```

The dev compose file has defaults for the frontend URLs (`https://api.localhost/api/v1/`, `https://tiles.localhost`) and most Django settings, so the values above are the minimum.

#### 2.2 Start services

```bash
cd deployment
docker compose -f docker-compose.dev.yml up -d --build
```

On first run, Caddy tries to install its CA certificate and may ask for your password to trust it. After that, all `*.localhost` domains work with valid HTTPS.

If Caddy fails to install the certificate automatically, run:

```bash
docker compose -f docker-compose.dev.yml exec caddy caddy trust
```

#### 2.3 Local customizations (optional)

For local customizations that shouldn't be committed:

```bash
cp docker-compose.override.yml.template docker-compose.override.yml
# Edit docker-compose.override.yml as needed
```

### Accessing services

- Frontend: `https://app.localhost`
- API: `https://api.localhost`
- Django admin: `https://admin.localhost/admin`
- QGIS Server: `https://qgis.localhost`
- TileServer: `https://tiles.localhost`
- Files (WebDAV): `https://files.localhost`
- Database: `localhost:5440` (external port, configurable via `DB_EXTERNAL_PORT`)

## 3. Production deployment

The full stack in containers, behind Caddy with HTTPS.

### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- A server with at least 8 CPU cores and 16GB RAM (the compose file is tuned for this baseline)
- Ports 80 and 443 available
- Domain names configured (or localhost with certificates)

### Setup steps

#### 3.1 Environment configuration

Copy the template, then fill in every `CHANGE_THIS` value and your domains:

```bash
cd deployment
cp .env.production.template .env
```

The template documents each variable. The main groups are:

- Domains: `DOMAIN_NAME`, `API_DOMAIN`, `APP_DOMAIN`, `ADMIN_DOMAIN`, `FILES_DOMAIN`, `QGIS_DOMAIN`, `TILE_SERVER_DOMAIN` (Caddy requests a Let's Encrypt certificate for each)
- Database: `DB_NAME`, `DB_USER`, `DB_PASSWORD`, plus `QGIS_DB_USER` / `QGIS_DB_PASSWORD` for QGIS Server
- Django: `DJANGO_SECRET_KEY`, `FIELD_ENCRYPTION_KEY`, `DEBUG=False`, `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `USE_COOKIE_DOMAIN_MIDDLEWARE=True`, `COOKIE_DOMAIN=.your-domain.com`
- Superuser: `DJANGO_SUPERUSER_USERNAME`, `DJANGO_SUPERUSER_EMAIL`, `DJANGO_SUPERUSER_PASSWORD`
- Frontend: `API_URL` (internal, e.g. `http://backend:8000/api/v1/`), `PUBLIC_API_URL` (`https://api.your-domain.com/api/v1/`), `PUBLIC_TILE_SERVER_URL`, `PUBLIC_DOCUMENTATION_URL`
- QGIS: `QGIS_PG_SERVICE_NAME`, `QGIS_SERVER_VERSION` (keep in sync with the `qgis/qgis-server` image tag)
- WireGuard (optional): `WIREGUARD_SERVERURL`, `WIREGUARD_PORT`, `WIREGUARD_PEERS`

Generate the secrets with:

```bash
python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'   # DJANGO_SECRET_KEY
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"                     # FIELD_ENCRYPTION_KEY
```

#### 3.2 Frontend configuration

The frontend container reads its variables from `deployment/.env` (`env_file` and build args in `docker-compose.yml`), so you don't need a `frontend/.env`. The compose file sets `ORIGIN` to `https://${APP_DOMAIN}`.

#### 3.3 Start services

```bash
cd deployment
docker compose up -d --build
```

#### 3.4 Verify services

Check service status:

```bash
docker-compose ps
```

View logs:

```bash
docker-compose logs [service_name]
```

### Accessing services

- Frontend: `https://<APP_DOMAIN>`
- API: `https://<API_DOMAIN>` (the `/admin/` path is blocked here)
- Django admin: `https://<ADMIN_DOMAIN>/admin`
- QGIS Server: `https://<QGIS_DOMAIN>/ows/?MAP=/projects/<project>.qgs`
- TileServer: `https://<TILE_SERVER_DOMAIN>`
- Files (WebDAV): `https://<FILES_DOMAIN>`
- Database: not exposed (internal network only; use WireGuard for QGIS Desktop access)

### Services overview

#### Database (PostgreSQL 17)

- Port: 5432 (internal only in production; published as 5440 in development via `DB_EXTERNAL_PORT`)
- Volume: `postgres_data` for data persistence
- Health check: PostgreSQL readiness check
- Initialization: `postgres/init.sh` sets up extensions and users
- Extensions: PostGIS, pgRouting, dblink, pgcrypto
- Users:
  - Main user (`DB_USER`): full privileges, used by the Django backend
  - QGIS user (`QGIS_DB_USER`): read-write access to the GIS data tables, none to the auth and permission tables; table grants are applied by the backend after every `migrate`

#### Backend (Django 5.2)

- Port: 8000 (internal, exposed via nginx/caddy)
- Volumes:
  - `static_volume` for static files
  - `media_volume` for user uploads
- Startup steps:
  - Compiles translation messages (`compilemessages`)
  - Collects static files
  - Runs migrations
  - Creates the superuser (if it doesn't exist)
  - Loads fixtures via `load_initial_data` (idempotent)
  - Starts Gunicorn
- Depends on: database service
- Also serves:
  - GeoPackage schema export endpoint
  - Vector tile endpoints (MVT)
  - Excel import/export for conduits

#### Frontend (SvelteKit 2)

- Port: 3000 (internal, exposed via caddy)
- Environment: production build with the Node.js adapter
- Depends on: backend service
- Configuration: variables from `deployment/.env` (see 3.2)

#### QGIS Server

- Image: `qgis/qgis-server:3.44.7-noble` (keep `QGIS_SERVER_VERSION` in sync)
- Port: 80 (internal, exposed via caddy)
- Setup:
  1. Set `QGIS_DB_USER`, `QGIS_DB_PASSWORD` and `QGIS_PG_SERVICE_NAME` in `.env`
  2. Upload QGIS projects in the Django admin, or copy them to `qgis/projects/`
- Database connection: `pg_service.conf` is generated at container start from `.env`; there is nothing to copy
- Volumes:
  - `qgis/projects/` for QGIS project files (.qgs/.qgz), read-only
  - `qgis/data/` for additional data files, read-only
  - `qgis/nginx.conf` for the FastCGI front end
- Render processes: 3 in production (`spawn-fcgi -F 3`), 2 in development
- Services: WMS, WFS (with the `?MAP=/projects/<project>.qgs` parameter), WMTS, WCS, OGC API Features
- Authentication: Django forward_auth (JWT cookie or HTTP Basic)
- [QGIS Server Setup](qgis/README.md) has the detailed configuration

#### TileServer-GL

- Image: `maptiler/tileserver-gl:v5.6.0`
- Port: 8080 (internal, exposed via caddy as the tiles subdomain)
- Function: vector tile server for the base map
- Setup: generate mbtiles with Planetiler (see [Generating Map Tiles](#generating-map-tiles-with-planetiler) below)
- Volumes:
  - `tiles/*.mbtiles`: vector tile data (you generate it; not included in the repo)
  - `tiles/config.json`: TileServer configuration
  - `tiles/styles/light.json`: light theme style
  - `tiles/styles/dark.json`: dark theme style
- Serves vector tiles, the light and dark styles, and fonts for map labels
- Data source: mbtiles generated by Planetiler from OSM data

#### Backend WMS (Django)

- Port: 8000 (internal, proxied via nginx)
- Function: a separate Django instance for the WMS proxy; nginx caches its responses in `wms_cache` (production only)
- Memory: 1.5GB limit, 512MB reserved
- Details:
  - Has its own Gunicorn worker pool for tile requests, so tile load doesn't slow down the main API
  - Shares the static and media volumes with the main backend
  - Must use the same `DJANGO_SECRET_KEY` as `backend`, or WMS proxy tokens are rejected with 403

#### PG error parser

- Function: watches the PostgreSQL container logs for errors
- Memory: 256MB limit, 128MB reserved
- Reads the PostgreSQL logs through the Docker socket and records the database errors it finds. It runs as a Django management command.

#### WireGuard (optional)

- Image: `lscr.io/linuxserver/wireguard:latest`
- Port: 51820/udp (configurable via `WIREGUARD_PORT`)
- Function: VPN access to the database for QGIS Desktop (production only); see the [WireGuard README](wireguard/README.md)
- Memory: 128MB limit, 64MB reserved
- Configuration:
  - `WIREGUARD_SERVERURL`: server URL (default: auto-detect)
  - `WIREGUARD_PORT`: UDP port (default: 51820)
  - `WIREGUARD_PEERS`: peer configurations

#### Generating map tiles with Planetiler

[Planetiler](https://github.com/onthegomap/planetiler) generates vector tiles from OpenStreetMap data. Generate the mbtiles before starting the TileServer.

**Prerequisites:**

- Java 21 or later (`java --version`)
- 8GB+ RAM recommended
- Disk space: about twice the size of your OSM data file

**Quick start:**

```bash
cd deployment/tiles

# Download Planetiler (one-time)
wget https://github.com/onthegomap/planetiler/releases/latest/download/planetiler.jar

# Generate tiles for Germany (~3GB output)
java -Xmx8g -jar planetiler.jar --download --area=germany --output=germany.mbtiles

# Or for a smaller region (e.g., a German state)
java -Xmx4g -jar planetiler.jar --download --area=berlin --output=berlin.mbtiles
```

**Using a local OSM file:**

Download PBF files from [Geofabrik](https://download.geofabrik.de/):

```bash
# Download OSM data
wget https://download.geofabrik.de/europe/germany-latest.osm.pbf

# Generate tiles from local file
java -Xmx8g -jar planetiler.jar --osm-path=germany-latest.osm.pbf --output=tiles/germany.mbtiles
```

**Memory recommendations:**

| Region                  | RAM    | Approximate Output Size |
| ----------------------- | ------ | ----------------------- |
| City (e.g., Berlin)     | 2-4GB  | 100-500MB               |
| State/Province          | 4-8GB  | 500MB-2GB               |
| Country (e.g., Germany) | 8-16GB | 2-5GB                   |
| Continent               | 32GB+  | 20GB+                   |

**Updating config.json:**

After generating your mbtiles, point `tiles/config.json` at your file:

```json
{
  "data": {
    "your-region": {
      "mbtiles": "your-region.mbtiles"
    }
  }
}
```

**Common issues:**

- `OutOfMemoryError`: increase the `-Xmx` value or use a smaller region
- Slow generation: use SSD storage and more RAM
- Missing tiles at high zoom: Planetiler may skip sparse areas; this is normal

#### Caddy

- Ports: 80, 443
- Function: reverse proxy with automatic HTTPS
- Volumes:
  - `caddy_data` for certificates and data
  - `caddy_config` for configuration
  - `Caddyfile.production` for routing rules
  - `caddy/extra/` for site-specific snippets (see below)
  - `media_volume` (read-only) for WebDAV
- Handles:
  - Automatic HTTPS with Let's Encrypt
  - Subdomain routing (app, api, admin, qgis, tiles, files)
  - Forward authentication for QGIS Server
  - CORS headers for the tile server
  - Security headers (HSTS, X-Frame-Options, etc.)
  - Request body limits (10GB for WebDAV, 100MB for WFS)

Site-specific Caddy snippets: `Caddyfile.production` imports `caddy/extra/<site>/*.caddy` inside each site block (`api`, `admin`, `app`, `files`, `qgis`, `tileserver`) and `caddy/extra/sites/*.caddy` at top level. Put server-specific rules there (IP allow lists, extra sites) instead of editing the Caddyfile. The directory is not part of the repository; empty or missing folders are ignored.

#### Nginx

- Port: 80 (internal)
- Function: reverse proxy, static file serving
- Volumes:
  - `nginx/nginx.conf` for configuration
  - `static_volume` for Django static files
  - `media_volume` for media files
- Also does static file caching and gzip compression

#### Resource limits (production)

The production compose file is sized for the minimum supported host of 8 CPU cores and 16GB RAM.

| Service               | Memory Limit | Memory Reservation | Concurrency                                 |
| --------------------- | ------------ | ------------------ | ------------------------------------------- |
| Database (PostgreSQL) | 6GB          | 2GB                | shared_buffers 1.5GB, 4 parallel workers    |
| Backend (Django API)  | 2GB          | 1GB                | 6 gunicorn workers                          |
| Backend WMS           | 1.5GB        | 512MB              | 4 gunicorn workers                          |
| QGIS Server           | 3GB          | 1GB                | 3 FCGI render processes (`spawn-fcgi -F 3`) |
| TileServer-GL         | 1GB          | 512MB              |                                             |
| Frontend (SvelteKit)  | 512MB        | 256MB              |                                             |
| Caddy                 | 256MB        | 128MB              |                                             |
| PG Error Parser       | 256MB        | 128MB              |                                             |
| Nginx                 | 256MB        | 64MB               |                                             |
| WireGuard             | 128MB        | 64MB               |                                             |
| **Total**             | **~14.9GB**  | **~5.7GB**         |                                             |

## Environment variables reference

### Backend variables (`deployment/.env`)

| Variable                       | Required | Description                                              | Example                 |
| ------------------------------ | -------- | -------------------------------------------------------- | ----------------------- |
| `DJANGO_SECRET_KEY`            | Yes      | Django secret key                                        | `django-insecure-...`   |
| `DB_NAME`                      | Yes      | PostgreSQL database name                                 | `qonnectra`             |
| `DB_USER`                      | Yes      | PostgreSQL username                                      | `qonnectra_user`        |
| `DB_PASSWORD`                  | Yes      | PostgreSQL password                                      | `secure-password`       |
| `DB_HOST`                      | Yes      | Database host                                            | `localhost` or `db`     |
| `DB_PORT`                      | Yes      | Database port                                            | `5432`                  |
| `QGIS_DB_USER`                 | No       | QGIS database user (limited permissions)                 | `qgis_user`             |
| `QGIS_DB_PASSWORD`             | No       | QGIS database password                                   | `qgis-password`         |
| `DJANGO_SUPERUSER_USERNAME`    | Yes      | Admin username                                           | `admin`                 |
| `DJANGO_SUPERUSER_EMAIL`       | Yes      | Admin email                                              | `admin@example.com`     |
| `DJANGO_SUPERUSER_PASSWORD`    | Yes      | Admin password                                           | `admin-password`        |
| `DEBUG`                        | No       | Django debug mode                                        | `True` / `False`        |
| `DEFAULT_SRID`                 | No       | Default coordinate system                                | `25832`                 |
| `CORS_ALLOWED_ORIGINS`         | No       | CORS allowed origins                                     | `http://localhost:5173` |
| `USE_COOKIE_DOMAIN_MIDDLEWARE` | No       | Enable cookie domain middleware                          | `False`                 |
| `COOKIE_DOMAIN`                | No       | Cookie domain                                            | `.localhost`            |
| `FIELD_ENCRYPTION_KEY`         | No       | Encryption key for sensitive fields (e.g. WMS passwords) | `base64-encoded-key`    |
| `QGIS_PG_SERVICE_NAME`         | No       | PostgreSQL service name for QGIS Server                  | `qonnectra`             |
| `QGIS_SERVER_VERSION`          | No       | QGIS Server version, used to warn about project skew     | `3.44.7`                |
| `DJANGO_ALLOWED_HOSTS`         | Yes      | Comma-separated allowed hosts                            | `api.localhost`         |
| `CSRF_TRUSTED_ORIGINS`         | Yes      | Comma-separated trusted origins                          | `https://app.localhost` |
| `DB_EXTERNAL_PORT`             | No       | Published database port (dev compose only)               | `5440`                  |

### Deployment variables (`deployment/.env`, Docker only)

| Variable                                                                                                       | Description                                                   |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `DOMAIN_NAME`, `API_DOMAIN`, `APP_DOMAIN`, `ADMIN_DOMAIN`, `FILES_DOMAIN`, `QGIS_DOMAIN`, `TILE_SERVER_DOMAIN` | Domains served by Caddy (production)                          |
| `API_URL`, `PUBLIC_API_URL`, `PUBLIC_TILE_SERVER_URL`, `PUBLIC_DOCUMENTATION_URL`                              | Frontend variables, passed to the frontend container          |
| `WIREGUARD_SERVERURL`, `WIREGUARD_PORT`, `WIREGUARD_PEERS`                                                     | WireGuard VPN (see [WireGuard README](wireguard/README.md))   |

### Frontend variables (`frontend/.env`)

| Variable                   | Required | Description                                    | Example                         |
| -------------------------- | -------- | ---------------------------------------------- | ------------------------------- |
| `API_URL`                  | Yes      | Backend API URL (server-side)                  | `http://localhost:8000/api/v1/` |
| `PUBLIC_API_URL`           | Yes      | Backend API URL (client-side)                  | `http://localhost:8000/api/v1/` |
| `PUBLIC_TILE_SERVER_URL`   | No       | Vector tile server URL (omit for OSM fallback) | `http://localhost:8090`         |
| `PUBLIC_DOCUMENTATION_URL` | No       | URL to user documentation/manual               | `https://qonnectra.de/manual/`  |
| `ORIGIN`                   | No       | Public origin of the app (Node adapter)        | `https://app.localhost`         |
| `E2E_TEST_USERNAME`        | No       | Playwright login user                          |                                 |
| `E2E_TEST_PASSWORD`        | No       | Playwright login password                      |                                 |

In SvelteKit, private (server-side only) variables are read from `$env/static/private`. Public variables, which the client can read, must start with `PUBLIC_` and are read from `$env/static/public`.

## Service management

### Start services

```bash
docker-compose up -d
```

### Stop services

```bash
docker-compose down
```

### Restart a service

```bash
docker-compose restart [service_name]
```

### View logs

```bash
# All services
docker-compose logs

# Specific service
docker-compose logs [service_name]

# Follow logs
docker-compose logs -f [service_name]
```

### Execute commands in a container

```bash
# Backend shell
docker-compose exec backend python manage.py shell

# Database psql
docker-compose exec db psql -U [user] -d [database]

# Frontend
docker-compose exec frontend npm [command]

# Run migrations
docker-compose exec backend python manage.py migrate
```

### Rebuild services

```bash
docker-compose up -d --build [service_name]
```

### Enable BuildKit (required)

The Dockerfiles use BuildKit features for faster builds (npm cache persistence). Set these environment variables system-wide:

```bash
sudo nano /etc/environment
```

Add these lines:

```
DOCKER_BUILDKIT=1
COMPOSE_DOCKER_CLI_BUILD=1
```

Save and reboot (or log out and back in).

BuildKit keeps the npm and pip caches between builds, builds layers in parallel and gives clearer build output. Without these variables, builds fail with `unknown flag: mount`.

## Health checks

These services have health checks:

- Database: PostgreSQL readiness (`pg_isready`)
- QGIS Server: HTTP endpoint check (verifies the server is running)
- Backend: Django application (implicit via dependencies)

## Volumes

Docker volumes hold the persistent data:

- `postgres_data`: database files (production; development uses the `postgres/data/` bind mount)
- `static_volume`: Django static files
- `media_volume`: user uploads and media
- `wms_cache`: Nginx WMS proxy cache (production)
- `caddy_data`: Caddy certificates and data
- `caddy_config`: Caddy configuration

## Troubleshooting

### Services not starting

1. Check logs: `docker-compose logs [service]`
2. Verify the environment variables in the `.env` files
3. Make sure the ports are not in use
4. Check Docker resources (memory, disk)

### Database connection issues

1. Verify the database service is healthy: `docker-compose ps db`
2. Check the database logs: `docker-compose logs db`
3. Verify the credentials in `.env` match the database settings
4. For local development, make sure PostgreSQL is running: `brew services list` or `systemctl status postgresql`

### Static files not loading

1. Verify static files were collected: `docker-compose logs backend | grep collectstatic`
2. Check the nginx configuration
3. Verify the static volume is mounted

### QGIS Server issues

1. Setup checklist:
   - Verify `QGIS_DB_USER`, `QGIS_DB_PASSWORD` and `QGIS_PG_SERVICE_NAME` in `.env` (the QGIS user is only created on the database's first start)
   - Confirm your QGIS project uses the same PostgreSQL service name
   - Confirm your QGIS project is in `qgis/projects/`
2. Check the QGIS Server logs: `docker-compose logs qgis-server`
3. Include the MAP parameter in requests: `?MAP=/projects/<project>.qgs`
4. See [QGIS Server Setup](qgis/README.md) for the detailed configuration

### TileServer issues

1. Setup checklist:
   - Make sure the mbtiles file exists (generate it with Planetiler, see [Generating Map Tiles](#generating-map-tiles-with-planetiler))
   - Verify `tiles/config.json` references the correct mbtiles file
2. Check the TileServer logs: `docker-compose logs tileserver`
3. Verify the mbtiles file exists: `ls -lh deployment/tiles/*.mbtiles`
4. Test the tile endpoint directly: `curl http://localhost:8080/styles/light.json`
5. Check the CORS headers on tile requests
6. Verify the frontend uses the correct tile server URL (`PUBLIC_TILE_SERVER_URL`)
7. For missing or outdated tiles, regenerate the mbtiles with Planetiler from current OSM data

### Certificate issues (Caddy)

1. Check the Caddy logs: `docker-compose logs caddy`
2. Verify the domain configuration in `.env`
3. Check the certificate directory permissions
4. For localhost development, Caddy uses self-signed certificates

### Frontend API connection issues

1. Verify `API_URL` in `frontend/.env` matches the backend URL
2. Check the CORS settings in the backend `.env` (`CORS_ALLOWED_ORIGINS`)
3. In production, use HTTPS URLs everywhere
4. Check the browser console for CORS or connection errors

## Production deployment considerations

1. Secrets: keep sensitive variables in Docker secrets or an external secret manager
2. Resource limits: the compose file already sets CPU and memory limits; adjust them to your host
3. Backups: `backup/backup.sh` dumps the database and mirrors the media volume, `backup/restore.sh <YYYY-MM-DD>` restores it (`--db-only`, `--media-only`, `--list`). Both read server-specific paths and the rclone remote from `backup/backup.conf`, which is gitignored and must be created per server
4. Monitoring: set up logging and monitoring (e.g., Prometheus, Grafana)
5. Security:
   - Use strong passwords and secrets
   - Enable HTTPS (automatic with Caddy)
   - Restrict database access (not exposed externally)
   - Apply security updates regularly
   - Configure firewall rules
6. Scaling: for scaling beyond one host, consider Docker Swarm or Kubernetes

## Additional resources

- [Main README](../README.md)
- [Backend README](../backend/README.md)
- [Frontend README](../frontend/README.md)
- [QGIS Server Setup](qgis/README.md)
- [WireGuard VPN](wireguard/README.md)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Caddy Documentation](https://caddyserver.com/docs/)
