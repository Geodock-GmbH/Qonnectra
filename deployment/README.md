# qonnectra Deployment

This guide covers three deployment scenarios for qonnectra: local development with manual setup, Docker Compose development, and production deployment.

## Deployment Options

1. **Local Development** - Manual PostgreSQL setup with VS Code tasks for backend/frontend
2. **Docker Compose (No Caddy)** - Development environment with Docker services
3. **Production Deployment** - Full stack with Caddy reverse proxy and HTTPS

---

## 1. Local Development

This setup is ideal for active development with hot reloading, debugging, and direct database access.

### Prerequisites

- Python >= 3.10
- [uv](https://github.com/astral-sh/uv) package manager (recommended) or pip
- Node.js 18+
- PostgreSQL 17 with PostGIS extension
- VS Code (for tasks) or your preferred IDE

### Setup Steps

#### 1.1 Backend Environment Configuration

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

#### 1.2 Frontend Environment Configuration

Create a `.env` file in the `frontend/` directory:

```bash
# API URL
API_URL=http://localhost:8000/api/

# Origin (optional, for CORS)
ORIGIN=http://localhost:5173
```

**Note:** SvelteKit uses `$env/static/private` for server-side variables and `$env/static/public` for public variables (prefixed with `PUBLIC_`). For local development, ensure `API_URL` is set correctly.

#### 1.3 Database Setup

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

#### 1.4 Backend Setup

```bash
cd backend

# Create virtual environment
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
uv pip install -r uv --dev

# Run migrations
python manage.py migrate

# Load fixtures (optional)
python manage.py loaddata attributes_company attributes_construction_type attributes_conduit_type attributes_phase
python manage.py loaddata attributes_status attributes_surface storage_preference file_type_categories projects flags
python manage.py loaddata attributes_network_level attributes_node_type attributes_status_development

# Create superuser
python manage.py createsuperuser
```

#### 1.5 Frontend Setup

```bash
cd frontend

# Install dependencies
npm install
```

#### 1.6 VS Code Tasks

The workspace includes VS Code tasks for running services. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and select:

- **Django Runserver** - Starts Django development server on `http://localhost:8000`
- **Frontend Dev Server** - Starts SvelteKit dev server on `http://localhost:5173`
- **Django Migrate** - Runs database migrations

Or use the terminal:

```bash
# Backend
cd backend
uv run manage.py runserver

# Frontend
cd frontend
npm run dev
```

### Accessing Services

- **Frontend**: `http://localhost:5173`
- **API**: `http://localhost:8000`
- **Django Admin**: `http://localhost:8000/admin`
- **Database**: `localhost:5432`

---

## 2. Docker Compose (No Caddy)

This setup uses Docker Compose for all services except Caddy, ideal for development with containerized services.

### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- Minimum 4GB RAM available
- Ports 8000, 5173, 5440 available

### Setup Steps

#### 2.1 Environment Configuration

Create a `.env` file in the `deployment/` directory:

```bash
# Django Settings
DJANGO_SECRET_KEY=your-secret-key-here
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
DEBUG=True
CSRF_TRUSTED_ORIGINS=http://localhost:5173,http://localhost:8000

# Database
DB_NAME=qonnectra
DB_USER=qonnectra_user
DB_PASSWORD=your-secure-password
DB_HOST=db
DB_PORT=5432

# Spatial Data
DEFAULT_SRID=25832  # ETRS89 / UTM zone 32N or 33N

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:5173

# Django Superuser
DJANGO_SUPERUSER_USERNAME=admin
DJANGO_SUPERUSER_EMAIL=admin@example.com
DJANGO_SUPERUSER_PASSWORD=your-admin-password

# Cookie Domain (optional)
USE_COOKIE_DOMAIN_MIDDLEWARE=False
```

#### 2.2 Frontend Environment Configuration

Create a `.env` file in the `frontend/` directory:

```bash
# API URL (pointing to Docker backend)
API_URL=http://localhost:8000/api/

# Origin
ORIGIN=http://localhost:5173
```

#### 2.3 Start Services

```bash
cd deployment
docker-compose -f docker-compose.no-caddy.yml up -d --build
```

#### 2.4 Run Migrations

```bash
docker-compose exec backend python manage.py migrate
docker-compose exec backend python manage.py loaddata attributes_company attributes_construction_type attributes_conduit_type attributes_phase
docker-compose exec backend python manage.py loaddata attributes_status attributes_surface storage_preference file_type_categories projects flags
docker-compose exec backend python manage.py loaddata attributes_network_level attributes_node_type attributes_status_development
```

### Accessing Services

- **Frontend**: `http://localhost:3000` (if running in container) or `http://localhost:5173` (if running locally)
- **API**: `http://localhost:8000`
- **Django Admin**: `http://localhost:8000/admin`
- **Database**: `localhost:5440` (external port)

### Running Frontend Locally with Docker Backend

You can run the frontend locally while using the Docker backend:

1. Ensure Docker services are running (backend, database)
2. Start frontend locally: `cd frontend && npm run dev`
3. Frontend will connect to `http://localhost:8000` (Docker backend)

---

## 3. Production Deployment

Full production stack with Caddy reverse proxy, HTTPS, and all services containerized.

### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- Minimum 4GB RAM available
- Ports 80, 443 available
- Domain names configured (or use localhost with certificates)

### Setup Steps

#### 3.1 Environment Configuration

Create a `.env` file in the `deployment/` directory:

```bash
# Django Settings
DJANGO_SECRET_KEY=your-very-secure-secret-key
DJANGO_ALLOWED_HOSTS=api.localhost,localhost,127.0.0.1
DEBUG=False
CSRF_TRUSTED_ORIGINS=https://api.localhost,https://app.localhost

# Database
DB_NAME=qonnectra
DB_USER=qonnectra_user
DB_PASSWORD=your-very-secure-password
DB_HOST=db
DB_PORT=5432

# Spatial Data
DEFAULT_SRID=25832  # ETRS89 / UTM zone 32N or 33N

# CORS
CORS_ALLOWED_ORIGINS=https://app.localhost

# Django Superuser
DJANGO_SUPERUSER_USERNAME=admin
DJANGO_SUPERUSER_EMAIL=admin@example.com
DJANGO_SUPERUSER_PASSWORD=your-secure-admin-password

# Cookie Domain (for cross-subdomain cookies)
USE_COOKIE_DOMAIN_MIDDLEWARE=True
COOKIE_DOMAIN=.localhost

# Domains (for Caddy)
DOMAIN_NAME=localhost
API_DOMAIN=api.localhost
APP_DOMAIN=app.localhost
FILES_DOMAIN=files.localhost
QGIS_DOMAIN=qgis.localhost
TILES_DOMAIN=tiles.localhost

# API URL (for frontend)
API_URL=https://api.localhost/api/
```

#### 3.2 Frontend Environment Configuration

Create a `.env` file in the `frontend/` directory (or set via Docker environment):

```bash
# API URL (production)
API_URL=https://api.localhost/api/

# Origin
ORIGIN=https://app.localhost
```

**Note:** For production Docker builds, these variables are typically set in `docker-compose.production.yml` or passed via environment variables.

#### 3.3 Start Services

```bash
cd deployment
docker-compose -f docker-compose.production.yml up -d --build
```

#### 3.4 Verify Services

Check service status:
```bash
docker-compose ps
```

View logs:
```bash
docker-compose logs [service_name]
```

### Accessing Services

- **Frontend**: `https://app.localhost`
- **API**: `https://api.localhost`
- **Django Admin**: `https://api.localhost/admin`
- **QGIS Server**: `https://qgis.localhost/ows/?MAP=/projects/<project>.qgs`
- **TileServer**: `https://tiles.localhost`
- **Files (WebDAV)**: `https://files.localhost`
- **Database**: Not exposed externally (internal network only)

### Services Overview

#### Database (PostgreSQL 17)

- **Port**: 5440 (external) → 5432 (internal)
- **Volume**: `postgres_data` for data persistence
- **Health Check**: PostgreSQL readiness check
- **Initialization**: `postgres/init.sql` sets up PostGIS extension
- **Extensions**: PostGIS for spatial data support

#### Backend (Django 5.2)

- **Port**: 8000 (internal, exposed via nginx/caddy)
- **Volumes**:
  - `static_volume` for static files
  - `media_volume` for user uploads
- **Commands**:
  - Collects static files
  - Runs migrations
  - Creates superuser (if not exists)
  - Loads fixtures
  - Starts Gunicorn
- **Depends on**: Database service
- **Special Features**:
  - GeoPackage schema export endpoint
  - Vector tile endpoints (MVT)
  - Excel import/export for conduits

#### Frontend (SvelteKit 2)

- **Port**: 3000 (internal, exposed via nginx/caddy)
- **Environment**: Production build with Node.js adapter
- **Depends on**: Backend service
- **Features**:
  - OpenLayers 10 for mapping
  - Svelte Flow for network diagrams
  - Vector tile support

#### QGIS Server

- **Image**: `qgis/qgis-server:latest`
- **Port**: 80 (internal, exposed via caddy)
- **Volumes**:
  - `qgis/projects/` for QGIS project files (.qgs)
  - `qgis/data/` for additional data
  - `qgis/pg_service.conf` for database connection
- **Services**: WMS, WFS (with ?MAP=/projects/<project>.qgs parameter), WMTS, WCS, OGC API Features
- **Authentication**: Django forward_auth integration
- See [QGIS Server README](qgis/README.md) for details

#### TileServer-GL

- **Port**: 8080 (internal, exposed via caddy as tiles subdomain)
- **Function**: Vector tile server for base map rendering
- **Volumes**:
  - `tiles/germany.mbtiles` - Base map data (3.2GB)
  - `tiles/config.json` - TileServer configuration
  - `tiles/light.json` - Light theme style
  - `tiles/dark.json` - Dark theme style
  - `tiles/fonts/` - Font glyphs for labels
- **Features**:
  - High-performance vector tile serving
  - Dynamic light/dark theme switching
  - Font serving for map labels
  - Health checks for tile availability
- **Data Source**: Mbtiles generated from Planetiler (OSM data)

#### Caddy

- **Ports**: 80, 443
- **Function**: Reverse proxy with automatic HTTPS
- **Volumes**:
  - `caddy_data` for certificates and data
  - `caddy_config` for configuration
  - `Caddyfile.production` for routing rules
- **Features**:
  - Automatic HTTPS with Let's Encrypt
  - Subdomain routing (app, api, qgis, tiles, files)
  - Forward authentication for QGIS Server
  - CORS headers for tile server
  - Security headers (HSTS, X-Frame-Options, etc.)
  - Request body limits (10GB for WebDAV, 100MB for WFS)

#### Nginx

- **Port**: 80 (internal)
- **Function**: Reverse proxy, static file serving
- **Volumes**:
  - `nginx/nginx.conf` for configuration
  - `static_volume` for Django static files
  - `media_volume` for media files
- **Features**: Static file caching and gzip compression

---

## Environment Variables Reference

### Backend Variables (`deployment/.env`)

| Variable | Required | Description | Example |
|---------|----------|-------------|---------|
| `DJANGO_SECRET_KEY` | Yes | Django secret key | `django-insecure-...` |
| `DB_NAME` | Yes | PostgreSQL database name | `qonnectra` |
| `DB_USER` | Yes | PostgreSQL username | `qonnectra_user` |
| `DB_PASSWORD` | Yes | PostgreSQL password | `secure-password` |
| `DB_HOST` | Yes | Database host | `localhost` or `db` |
| `DB_PORT` | Yes | Database port | `5432` |
| `DJANGO_SUPERUSER_USERNAME` | Yes | Admin username | `admin` |
| `DJANGO_SUPERUSER_EMAIL` | Yes | Admin email | `admin@example.com` |
| `DJANGO_SUPERUSER_PASSWORD` | Yes | Admin password | `admin-password` |
| `DEBUG` | No | Django debug mode | `True` / `False` |
| `DEFAULT_SRID` | No | Default coordinate system | `25832` |
| `CORS_ALLOWED_ORIGINS` | No | CORS allowed origins | `http://localhost:5173` |
| `USE_COOKIE_DOMAIN_MIDDLEWARE` | No | Enable cookie domain middleware | `False` |
| `COOKIE_DOMAIN` | No | Cookie domain | `.localhost` |

### Frontend Variables (`frontend/.env`)

| Variable | Required | Description | Example |
|---------|----------|-------------|---------|
| `API_URL` | Yes | Backend API URL | `http://localhost:8000/api/` |
| `ORIGIN` | No | Frontend origin for CORS | `http://localhost:5173` |

**Note:** In SvelteKit, private environment variables (server-side only) are accessed via `$env/static/private`, and public variables (client-side accessible) must be prefixed with `PUBLIC_` and accessed via `$env/static/public`.

---

## Service Management

### Start Services

```bash
docker-compose up -d
```

### Stop Services

```bash
docker-compose down
```

### Restart a Service

```bash
docker-compose restart [service_name]
```

### View Logs

```bash
# All services
docker-compose logs

# Specific service
docker-compose logs [service_name]

# Follow logs
docker-compose logs -f [service_name]
```

### Execute Commands in Container

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

### Rebuild Services

```bash
docker-compose up -d --build [service_name]
```

### Enable BuildKit (Required)

The Dockerfiles use BuildKit features for faster builds (npm cache persistence). Add these environment variables system-wide:

```bash
sudo nano /etc/environment
```

Add these lines:
```
DOCKER_BUILDKIT=1
COMPOSE_DOCKER_CLI_BUILD=1
```

Save and reboot (or log out and back in).

**Why?** BuildKit enables:
- Persistent npm/pip caches between builds
- Parallel layer building
- Better build output

Without these variables, builds will fail with: `unknown flag: mount`

---

## Health Checks

Services include health checks:

- **Database**: PostgreSQL readiness (`pg_isready`)
- **QGIS Server**: WMS capabilities endpoint
- **Backend**: Django application (implicit via dependencies)

---

## Volumes

Persistent data is stored in Docker volumes:

- `postgres_data`: Database files
- `static_volume`: Django static files
- `media_volume`: User uploads and media
- `caddy_data`: Caddy certificates and data
- `caddy_config`: Caddy configuration

---

## Troubleshooting

### Services Not Starting

1. Check logs: `docker-compose logs [service]`
2. Verify environment variables in `.env` files
3. Ensure ports are not in use
4. Check Docker resources (memory, disk)

### Database Connection Issues

1. Verify database service is healthy: `docker-compose ps db`
2. Check database logs: `docker-compose logs db`
3. Verify credentials in `.env` match database settings
4. For local development, ensure PostgreSQL is running: `brew services list` or `systemctl status postgresql`

### Static Files Not Loading

1. Verify static files collection: `docker-compose logs backend | grep collectstatic`
2. Check nginx configuration
3. Verify static volume is mounted

### QGIS Server Issues

See [QGIS Server README](qgis/README.md) for troubleshooting. Remember to include the MAP parameter in WFS/WMS requests: `?MAP=/projects/<project>.qgs`

### TileServer Issues

1. Check TileServer logs: `docker-compose logs tileserver`
2. Verify mbtiles file exists: `ls -lh deployment/tiles/germany.mbtiles`
3. Test tile endpoint directly: `curl http://localhost:8080/styles/light.json`
4. Check CORS headers for tile requests
5. Verify frontend is using correct tile server URL
6. For missing tiles: May need to regenerate mbtiles from Planetiler with updated OSM data

### Certificate Issues (Caddy)

1. Check Caddy logs: `docker-compose logs caddy`
2. Verify domain configuration in `.env`
3. Check certificate directory permissions
4. For localhost development, Caddy will use self-signed certificates

### Frontend API Connection Issues

1. Verify `API_URL` in `frontend/.env` matches backend URL
2. Check CORS settings in backend `.env` (`CORS_ALLOWED_ORIGINS`)
3. For production, ensure HTTPS URLs are used consistently
4. Check browser console for CORS or connection errors

---

## Production Deployment Considerations

1. **Secrets Management**: Use Docker secrets or external secret management services
2. **Resource Limits**: Configure appropriate CPU/memory limits (already configured in compose file)
3. **Backup Strategy**: Regular database backups using `docker-compose exec db pg_dump`
4. **Monitoring**: Set up logging and monitoring solutions (e.g., Prometheus, Grafana)
5. **Security**: 
   - Use strong passwords and secrets
   - Enable HTTPS (automatic with Caddy)
   - Restrict database access (not exposed externally)
   - Regular security updates
   - Configure firewall rules
6. **Scaling**: Consider using Docker Swarm or Kubernetes for production scaling
7. **Environment Variables**: Use secret management for sensitive variables in production

---

## Additional Resources

- [Main README](../README.md)
- [Backend README](../backend/README.md)
- [Frontend README](../frontend/README.md)
- [QGIS Server Setup](qgis/README.md)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Caddy Documentation](https://caddyserver.com/docs/)
