# Qonnectra Backend

Django REST API for the Qonnectra GIS application. It stores the telecommunications infrastructure as spatial data and exposes it through API endpoints.

## Overview

The backend uses Django 5.2, Django REST Framework and PostGIS. Its REST API covers trenches, conduits, nodes, addresses, cables, fibers and the other infrastructure components, including node structures and fiber splices.

## Prerequisites

- Python >= 3.12
- [uv](https://github.com/astral-sh/uv) package manager (recommended) or pip
- PostgreSQL 17 with PostGIS extension
- Docker and Docker Compose (for running PostgreSQL)

## Setup

### 1. Create virtual environment

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

### 2. Install dependencies

Using uv:

```bash
uv sync --dev
```

### 3. Environment configuration

The backend reads environment variables from `deployment/.env`. The [Deployment README](../deployment/README.md) lists all of them.

The main ones:

- `DJANGO_SECRET_KEY`: secret key for Django
- `DB_NAME`: PostgreSQL database name
- `DB_USER`: PostgreSQL username
- `DB_PASSWORD`: PostgreSQL password
- `DB_HOST`: PostgreSQL host (default: `localhost` for local dev)
- `DB_PORT`: PostgreSQL port (default: `5440` for Docker, `5432` for direct connection)
- `DEFAULT_SRID`: coordinate system SRID (default: `25832` for ETRS89 UTM zone 32N)

### 4. Database setup

Make sure PostgreSQL with PostGIS is running. With Docker Compose:

```bash
cd ../deployment
docker-compose up -d db
```

### 5. Run migrations

```bash
python manage.py migrate
```

### 6. Load initial data

Load the attribute tables, projects, flags and settings from `apps/api/fixtures/`:

```bash
python manage.py load_initial_data
```

The command is idempotent: it skips each fixture group whose data already exists. `--force` loads anyway, which may fail on duplicates. The Docker backend runs the command on every start.

### 7. Create superuser

```bash
python manage.py createsuperuser
```

### 8. Run development server

```bash
python manage.py runserver
```

The API is then available at `http://localhost:8000`.

## API documentation

The API is versioned with DRF `NamespaceVersioning`; all endpoints live under `/api/v1/`.

- API root: `http://localhost:8000/api/v1/`
- Admin interface: `http://localhost:8000/admin/`
- Swagger UI: `http://localhost:8000/api/v1/docs/` (only with `DEBUG=True`)
- OpenAPI schema: `http://localhost:8000/api/v1/schema/` (only with `DEBUG=True`)

When reversing URLs in code or tests, include the namespace: `reverse("v1:trench-list")`, not `reverse("trench-list")`.

### Main API endpoints

**Infrastructure:**

- `/api/v1/trench/`: trenches (LineString geometry)
- `/api/v1/conduit/`: conduits
- `/api/v1/microduct/`: microducts
- `/api/v1/node/`: nodes (Point geometry)
- `/api/v1/address/`: addresses (Point geometry)
- `/api/v1/residential-unit/`: residential units of an address
- `/api/v1/area/`: areas (Polygon geometry)
- `/api/v1/cable/`: cables
- `/api/v1/fiber/`: fibers

**Node structure and network:**

- `/api/v1/node-structure/`: node structure
- `/api/v1/node-slot-configuration/`: node slot configuration
- `/api/v1/node-slot-divider/`: slot dividers
- `/api/v1/node-slot-clip-number/`: clip numbering for slots
- `/api/v1/fiber-splice/`: fiber splices
- `/api/v1/container/`: containers
- `/api/v1/container-type/`: container types
- `/api/v1/microduct_connection/`, `/api/v1/microduct_cable_connection/`, `/api/v1/trench_conduit_connection/`: connections between features

**Attributes:**

- `/api/v1/attributes_<name>/`: attribute tables, e.g. `attributes_company`, `attributes_node_type`, `attributes_component_type`, `attributes_component_structure`

**Organizational:**

- `/api/v1/projects/`: projects
- `/api/v1/flags/`: flags
- `/api/v1/feature-files/`: file attachments
- `/api/v1/wms-sources/`, `/api/v1/wms-layers/`: external WMS sources and layers
- `/api/v1/pipeline-records/`, `/api/v1/pipeline-inquiry-areas/`: pipeline records and inquiries
- `/api/v1/user-settings/`: per-user frontend settings
- `/api/v1/auth/permissions/`: route and model permissions of the current user

**Analysis and special endpoints:**

- `GET /api/v1/ol_{trench,node,address,area}_tiles/<z>/<x>/<y>.mvt`: vector tiles for map layers
- `GET /api/v1/fiber-trace/`, `GET /api/v1/signal-analysis/`, `GET /api/v1/trace-search/`: fiber tracing and signal analysis
- `POST /api/v1/fault-simulation/`: fault simulation
- `/api/v1/valuation/calculate/`, `/api/v1/valuation-rates/`: network valuation
- `GET /api/v1/dashboard/statistics/`: dashboard statistics
- `POST /api/v1/routing/`: network routing queries
- `GET /api/v1/trenches-near-node/`, `/api/v1/spatial/intersects/`: spatial queries
- `GET /api/v1/schema.gpkg`: download the GeoPackage schema (optional `?layers=` parameter)
- `/api/v1/export/features/`: feature export
- `POST /api/v1/import/conduit/`, `GET /api/v1/template/conduit/`: conduit Excel import and template
- `GET /api/v1/node-export/excel/<uuid>/`: node structure Excel export
- `/api/v1/wms-proxy/<uuid>/`, `/api/v1/wfs3/<project>/...`: authenticated WMS and OGC API Features proxies
- `POST /api/v1/logs/frontend/`: frontend error logging

`apps/api/urls.py` has the complete list.

Endpoints require authentication (see below) and are filtered by project where that applies.

### OpenAPI schema and frontend types

drf-spectacular generates `schema.yml`, which the frontend's generated types are built from:

```bash
uv run manage.py spectacular --file schema.yml
cd ../frontend && npm run generate:types
```

The VS Code task "Schema: Generate All" runs both steps.

## Database models

### Core infrastructure models

- `Trench`: linear excavation features with construction details, surface types and phases
- `Conduit`: conduits placed in trenches, with type, network level and manufacturer
- `Microduct`: individual mini pipes within conduits (generated from the conduit color codes)
- `Node`: network junction points with type, status and network level
- `Address`: postal addresses linked to nodes, with development status
- `ResidentialUnit`: residential units of an address, with type and status
- `Area`: polygon areas with area types
- `Cable`: fiber optic cables with type, capacity and manufacturer
- `Fiber`: individual fiber strands within cables
- `TrenchConduitConnection`, `MicroductConnection`, `MicroductCableConnection`: links between features

### Node structure and network management models

- `NodeStructure`: structure of the components inside a node
- `NodeSlotConfiguration`: port layout and slot management for network nodes
- `NodeSlotDivider`: slot divisions within nodes
- `NodeSlotClipNumber`: clip numbering for node slots
- `FiberSplice`: fiber connections and splice management
- `Container`: logical grouping of network components
- `ContainerType`: container categories and types
- `CableLabel`, `TrenchConduitCanvas`, `NodeTrenchSelection`: layout data for the network schema and pipe branch views

### Component management models

- `AttributesComponentType`: hardware component type definitions
- `AttributesComponentStructure`: component structure specifications

### Supporting models

- `Projects`: project organization
- `Flags`: categorization flags
- `Attributes*`: attribute tables (company, status, phase, network level, node type, surface, colors, ...)
- `StoragePreferences`, `FileTypeCategory`: file storage configuration
- `FeatureFiles`: file attachments for any feature
- `WMSSource`, `WMSLayer`: external WMS sources (passwords encrypted with `FIELD_ENCRYPTION_KEY`)
- `QGISProject`, `QGISProjectDataFile`: QGIS Server projects uploaded through the admin
- `PipelineRecord`, `PipelineInquiryArea`, `TypeOfWork`, `RequestReason`: pipeline records and inquiries
- `ValuationCostRate`: cost rates for the network valuation
- `ModelPermission`, `RoutePermission`: permissions per model and per frontend route
- `UserSettings`: per-user frontend settings
- `LogEntry`: backend and frontend log entries

All spatial fields use PostGIS with SRID 25832 or 25833 (ETRS89 UTM zone 32N or 33N).

## Development

### Running tests

pytest is configured in the repository root `pytest.ini`. From `backend/`:

```bash
uv run pytest apps/api/tests/
```

Run a specific test file:

```bash
uv run pytest apps/api/tests/test_views.py
```

Tests run against PostGIS, so the database must be reachable. `--reuse-db` is on by default; pass `--create-db` after changing migrations.

### Code formatting

The project uses [ruff](https://github.com/astral-sh/ruff) for linting and formatting:

```bash
ruff check .
ruff format .
```

### Making migrations

After modifying models:

```bash
python manage.py makemigrations
python manage.py migrate
```

### Loading development data

`python manage.py load_initial_data` loads all fixtures. To load a single fixture:

```bash
python manage.py loaddata <fixture_name>
```

The fixtures are in `apps/api/fixtures/`:

- `attributes_*.json`: attribute tables
- `projects.json`: project definitions
- `flags.json`: flag definitions
- `storage_preference.json`, `file_type_categories.json`: storage configuration
- `*_color_mapping.json`, `container_types.json`: color codes and container types
- `network_schema_settings.json`, `pipe_branch_settings.json`: per-project settings
- `type_of_work.json`, `request_reasons.json`: pipeline record options
- `valuation_cost_rates.json`: valuation cost rates

### Management commands

- `load_initial_data`: load all fixtures idempotently
- `parse_pg_errors`: follow the PostgreSQL container logs and record errors (runs in the `pg-error-parser` container)
- `warm_wms_cache`: pre-fetch WMS tiles through the proxy to fill the Nginx cache

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
2. The access and refresh tokens are set as HTTP-only cookies (`api-access-token`, `api-refresh-token`)
3. Refresh: `POST /api/v1/auth/token/refresh/` (refresh tokens rotate)
4. Current user: `GET /api/v1/auth/user/`
5. Logout: `POST /api/v1/auth/logout/`

**External apps (bearer tokens):**

1. Login: `POST /api/v1/auth/app/login/` returns the tokens in the response body
2. Send `Authorization: Bearer <access_token>` with each request
3. Refresh: `POST /api/v1/auth/app/token/refresh/`, logout: `POST /api/v1/auth/app/logout/`

Access tokens live 15 minutes, refresh tokens 7 days. With `USE_COOKIE_DOMAIN_MIDDLEWARE=True` the cookies are set on `COOKIE_DOMAIN` so they work across subdomains.

`/api/v1/auth/qgis-auth/` and `/api/v1/auth/webdav-auth/` are Caddy `forward_auth` endpoints for QGIS Server and WebDAV. They accept the JWT cookie or HTTP Basic credentials (for QGIS Desktop and WebDAV clients).

## File storage

Feature attachments (`FeatureFiles`) are stored on the local filesystem under `MEDIA_ROOT` (`LocalMediaStorage`), organized as `<project>/<feature type>/<id>/...`. In the Docker deployment, Caddy also serves the media volume over WebDAV on the files subdomain, with authentication through Django.

QGIS project files uploaded in the admin are written to `deployment/qgis/projects/` (`QGISProjectStorage`), where QGIS Server reads them.

## Spatial data

Geometry fields are `django.contrib.gis.db.models` fields with a default SRID of 25832 (ETRS89 UTM zone 32N). They are spatially indexed, spatial operations use PostGIS functions, and the API supports spatial queries and filters.

## Additional resources

- [Main README](../README.md)
- [Deployment Guide](../deployment/README.md)
- [Django Documentation](https://docs.djangoproject.com/)
- [Django REST Framework Documentation](https://www.django-rest-framework.org/)
- [PostGIS Documentation](https://postgis.net/documentation/)
