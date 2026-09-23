# Qonnectra Backend

Django REST API backend for the Qonnectra GIS application, providing spatial data management and API endpoints for telecommunications infrastructure.

## Overview

The backend is built with Django 5.2 and Django REST Framework, featuring PostGIS integration for spatial data operations. It provides a RESTful API for managing trenches, conduits, nodes, addresses, cables, fibers, and other infrastructure components, including advanced node structure management and fiber splice tracking.

## Prerequisites

- Python >= 3.12
- [uv](https://github.com/astral-sh/uv) package manager (recommended) or pip
- PostgreSQL 17 with PostGIS extension
- Docker and Docker Compose (for running PostgreSQL)

## Setup

### 1. Create Virtual Environment

Using uv (recommended):

```bash
cd backend
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

Or using venv:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

### 2. Install Dependencies

Using uv:

```bash
uv sync --dev
```

### 3. Environment Configuration

The backend reads environment variables from `deployment/.env`. See the [Deployment README](../deployment/README.md) for required environment variables.

Key variables:

- `DJANGO_SECRET_KEY`: Secret key for Django
- `DB_NAME`: PostgreSQL database name
- `DB_USER`: PostgreSQL username
- `DB_PASSWORD`: PostgreSQL password
- `DB_HOST`: PostgreSQL host (default: `localhost` for local dev)
- `DB_PORT`: PostgreSQL port (default: `5440` for Docker, `5432` for direct connection)
- `DEFAULT_SRID`: Coordinate system SRID (default: `25832` for ETRS89 UTM Zone 32N)

### 4. Database Setup

Ensure PostgreSQL with PostGIS is running. If using Docker Compose:

```bash
cd ../deployment
docker-compose up -d db
```

### 5. Run Migrations

```bash
python manage.py migrate
```

### 6. Load Initial Data

Load the attribute tables, projects, flags and settings from `apps/api/fixtures/`:

```bash
python manage.py load_initial_data
```

The command is idempotent: each fixture group is skipped when its data already exists. Use `--force` to load anyway (may fail on duplicates). The Docker backend runs it on every start.

### 7. Create Superuser

```bash
python manage.py createsuperuser
```

### 8. Run Development Server

```bash
python manage.py runserver
```

The API will be available at `http://localhost:8000`

## API Documentation

The API is versioned with DRF `NamespaceVersioning`; all endpoints live under `/api/v1/`.

- API Root: `http://localhost:8000/api/v1/`
- Admin Interface: `http://localhost:8000/admin/`
- Swagger UI: `http://localhost:8000/api/v1/docs/` (only with `DEBUG=True`)
- OpenAPI schema: `http://localhost:8000/api/v1/schema/` (only with `DEBUG=True`)

When reversing URLs in code or tests, include the namespace: `reverse("v1:trench-list")`, not `reverse("trench-list")`.

### Key API Endpoints

**Infrastructure:**

- `/api/v1/trench/` - Trenches (LineString geometry)
- `/api/v1/conduit/` - Conduits
- `/api/v1/microduct/` - Microducts
- `/api/v1/node/` - Nodes (Point geometry)
- `/api/v1/address/` - Addresses (Point geometry)
- `/api/v1/residential-unit/` - Residential units of an address
- `/api/v1/area/` - Areas (Polygon geometry)
- `/api/v1/cable/` - Cables
- `/api/v1/fiber/` - Fibers

**Node Structure & Network:**

- `/api/v1/node-structure/` - Node structure
- `/api/v1/node-slot-configuration/` - Node slot configuration
- `/api/v1/node-slot-divider/` - Slot dividers
- `/api/v1/node-slot-clip-number/` - Clip numbering for slots
- `/api/v1/fiber-splice/` - Fiber splices
- `/api/v1/container/` - Containers
- `/api/v1/container-type/` - Container types
- `/api/v1/microduct_connection/`, `/api/v1/microduct_cable_connection/`, `/api/v1/trench_conduit_connection/` - Connections between features

**Attributes:**

- `/api/v1/attributes_<name>/` - Attribute tables, e.g. `attributes_company`, `attributes_node_type`, `attributes_component_type`, `attributes_component_structure`

**Organizational:**

- `/api/v1/projects/` - Projects
- `/api/v1/flags/` - Flags
- `/api/v1/feature-files/` - File attachments
- `/api/v1/wms-sources/`, `/api/v1/wms-layers/` - External WMS sources and layers
- `/api/v1/pipeline-records/`, `/api/v1/pipeline-inquiry-areas/` - Pipeline records and inquiries
- `/api/v1/user-settings/` - Per-user frontend settings
- `/api/v1/auth/permissions/` - Route and model permissions of the current user

**Analysis & Special Endpoints:**

- `GET /api/v1/ol_{trench,node,address,area}_tiles/<z>/<x>/<y>.mvt` - Vector tiles for map layers
- `GET /api/v1/fiber-trace/`, `GET /api/v1/signal-analysis/`, `GET /api/v1/trace-search/` - Fiber tracing and signal analysis
- `POST /api/v1/fault-simulation/` - Fault simulation
- `/api/v1/valuation/calculate/`, `/api/v1/valuation-rates/` - Network valuation
- `GET /api/v1/dashboard/statistics/` - Dashboard statistics
- `POST /api/v1/routing/` - Network routing queries
- `GET /api/v1/trenches-near-node/`, `/api/v1/spatial/intersects/` - Spatial queries
- `GET /api/v1/schema.gpkg` - Download GeoPackage schema (optional `?layers=` parameter)
- `/api/v1/export/features/` - Feature export
- `POST /api/v1/import/conduit/`, `GET /api/v1/template/conduit/` - Conduit Excel import and template
- `GET /api/v1/node-export/excel/<uuid>/` - Node structure Excel export
- `/api/v1/wms-proxy/<uuid>/`, `/api/v1/wfs3/<project>/...` - Authenticated WMS and OGC API Features proxies
- `POST /api/v1/logs/frontend/` - Frontend error logging

See `apps/api/urls.py` for the complete list.

Endpoints are filtered by project where it applies and require authentication (see below).

### OpenAPI Schema and Frontend Types

`schema.yml` is generated with drf-spectacular and feeds the frontend's generated types:

```bash
uv run manage.py spectacular --file schema.yml
cd ../frontend && npm run generate:types
```

The VS Code task **Schema: Generate All** runs both steps.

## Database Models

### Core Infrastructure Models

- **Trench**: Linear excavation features with construction details, surface types, and phases
- **Conduit**: Conduits placed in trenches with type, network level, and manufacturer information
- **Microduct**: Individual mini pipes within conduits (auto-generated from conduit color codes)
- **Node**: Network junction points with type, status, and network level classification
- **Address**: Postal addresses linked to nodes with development status
- **ResidentialUnit**: Residential units of an address with type and status
- **Area**: Polygon areas with area types
- **Cable**: Fiber optic cables with type, capacity, and manufacturer information
- **Fiber**: Individual fiber strands within cables
- **TrenchConduitConnection**, **MicroductConnection**, **MicroductCableConnection**: Links between features

### Node Structure & Network Management Models

- **NodeStructure**: Structure of components inside a node
- **NodeSlotConfiguration**: Port layout and slot management for network nodes
- **NodeSlotDivider**: Organization of slot divisions within nodes
- **NodeSlotClipNumber**: Clip numbering system for node slots
- **FiberSplice**: Fiber connection tracking and splice management
- **Container**: Logical grouping containers for network components
- **ContainerType**: Container categorization and types
- **CableLabel**, **TrenchConduitCanvas**, **NodeTrenchSelection**: Network schema and pipe branch layout data

### Component Management Models

- **AttributesComponentType**: Hardware component type definitions
- **AttributesComponentStructure**: Component structure specifications

### Supporting Models

- **Projects**: Project organization
- **Flags**: Categorization flags
- **Attributes\***: Attribute tables (company, status, phase, network level, node type, surface, colors, ...)
- **StoragePreferences**, **FileTypeCategory**: File storage configuration
- **FeatureFiles**: Generic file attachments to any feature
- **WMSSource**, **WMSLayer**: External WMS sources (passwords encrypted with `FIELD_ENCRYPTION_KEY`)
- **QGISProject**, **QGISProjectDataFile**: QGIS Server projects uploaded through the admin
- **PipelineRecord**, **PipelineInquiryArea**, **TypeOfWork**, **RequestReason**: Pipeline records and inquiries
- **ValuationCostRate**: Cost rates for the network valuation
- **ModelPermission**, **RoutePermission**: Permissions per model and per frontend route
- **UserSettings**: Per-user frontend settings
- **LogEntry**: Backend and frontend log entries

All spatial fields use PostGIS with SRID 25832 or 25833 (ETRS89 UTM Zone 32N or 33N) as the coordinate system.

## Development

### Running Tests

pytest is configured in the repository root `pytest.ini`. From `backend/`:

```bash
uv run pytest apps/api/tests/
```

Run a specific test file:

```bash
uv run pytest apps/api/tests/test_views.py
```

Tests run against PostGIS, so the database must be reachable. `--reuse-db` is on by default; pass `--create-db` after changing migrations.

### Code Formatting

This project uses [ruff](https://github.com/astral-sh/ruff) for linting and formatting:

```bash
ruff check .
ruff format .
```

### Making Migrations

After modifying models:

```bash
python manage.py makemigrations
python manage.py migrate
```

### Loading Development Data

`python manage.py load_initial_data` loads all fixtures. Single fixtures can be loaded with:

```bash
python manage.py loaddata <fixture_name>
```

Available fixtures are in `apps/api/fixtures/`:

- `attributes_*.json` - Attribute tables
- `projects.json` - Project definitions
- `flags.json` - Flag definitions
- `storage_preference.json`, `file_type_categories.json` - Storage configuration
- `*_color_mapping.json`, `container_types.json` - Color codes and container types
- `network_schema_settings.json`, `pipe_branch_settings.json` - Per-project settings
- `type_of_work.json`, `request_reasons.json` - Pipeline record options
- `valuation_cost_rates.json` - Valuation cost rates

### Management Commands

- `load_initial_data` - Load all fixtures idempotently
- `parse_pg_errors` - Follow the PostgreSQL container logs and record errors (runs in the `pg-error-parser` container)
- `warm_wms_cache` - Pre-fetch WMS tiles through the proxy to fill the Nginx cache

### Translations

Backend strings are translated with Django's gettext (`locale/`):

```bash
python manage.py makemessages -l de
python manage.py compilemessages
```

## Authentication

The API uses JWT authentication (`dj-rest-auth` + `djangorestframework-simplejwt`).

**Web frontend (cookies):**

1. Login: `POST /api/v1/auth/login/` with username and password
2. Access and refresh tokens are set as HTTP-only cookies (`api-access-token`, `api-refresh-token`)
3. Refresh: `POST /api/v1/auth/token/refresh/` (refresh tokens rotate)
4. Current user: `GET /api/v1/auth/user/`
5. Logout: `POST /api/v1/auth/logout/`

**External apps (bearer tokens):**

1. Login: `POST /api/v1/auth/app/login/` returns the tokens in the response body
2. Send `Authorization: Bearer <access_token>` with each request
3. Refresh: `POST /api/v1/auth/app/token/refresh/`, logout: `POST /api/v1/auth/app/logout/`

Access tokens live 15 minutes, refresh tokens 7 days. With `USE_COOKIE_DOMAIN_MIDDLEWARE=True` the cookies are set on `COOKIE_DOMAIN` so they work across subdomains.

`/api/v1/auth/qgis-auth/` and `/api/v1/auth/webdav-auth/` are Caddy `forward_auth` endpoints for QGIS Server and WebDAV. They accept the JWT cookie or HTTP Basic credentials (for QGIS Desktop and WebDAV clients).

## File Storage

Feature attachments (`FeatureFiles`) are stored on the local filesystem under `MEDIA_ROOT` (`LocalMediaStorage`), organized as `<project>/<feature type>/<id>/...`. In the Docker deployment the media volume is also served over WebDAV by Caddy on the files subdomain, authenticated through Django.

QGIS project files uploaded in the admin are written to `deployment/qgis/projects/` (`QGISProjectStorage`), where QGIS Server reads them.

## Spatial Data

All spatial operations use PostGIS functions. Key features:

- Geometry fields use `django.contrib.gis.db.models` fields
- Default SRID: 25832 (ETRS89 UTM Zone 32N)
- Spatial indexing for performance
- Support for spatial queries and filters

## Additional Resources

- [Main README](../README.md)
- [Deployment Guide](../deployment/README.md)
- [Django Documentation](https://docs.djangoproject.com/)
- [Django REST Framework Documentation](https://www.django-rest-framework.org/)
- [PostGIS Documentation](https://postgis.net/documentation/)
