# Qonnectra Backend

Django REST API backend for the Qonnectra GIS application, providing spatial data management and API endpoints for telecommunications infrastructure.

## Overview

The backend is built with Django 5.2 and Django REST Framework, featuring PostGIS integration for spatial data operations. It provides a RESTful API for managing trenches, conduits, nodes, addresses, cables, fibers, and other infrastructure components, including advanced node structure management and fiber splice tracking.

## Prerequisites

- Python >= 3.10
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
uv pip install -r uv --dev
```

Or using pip:

```bash
pip install -e .
pip install -e ".[dev]"  # For development dependencies
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

### 6. Load Fixtures (Optional)

Load initial data for attributes, projects, and flags:

```bash
python manage.py loaddata attributes_company attributes_construction_type attributes_conduit_type attributes_phase
python manage.py loaddata attributes_status attributes_surface storage_preference file_type_categories projects flags
python manage.py loaddata attributes_network_level attributes_node_type attributes_status_development
```

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

The API provides RESTful endpoints for all data models. Browse the API at:

- API Root: `http://localhost:8000/api/`
- Admin Interface: `http://localhost:8000/admin/`

### Key API Endpoints

**Infrastructure Management:**
- `/api/trench/` - Trench management (LineString geometry)
- `/api/conduit/` - Conduit management
- `/api/microduct/` - Microduct management
- `/api/node/` - Node management (Point geometry)
- `/api/address/` - Address management (Point geometry)
- `/api/cable/` - Cable management
- `/api/fiber/` - Fiber management

**Node Structure & Network:**
- `/api/node-slot-configuration/` - Node slot configuration management
- `/api/node-slot-divider/` - Slot divider management
- `/api/node-slot-clip-number/` - Clip numbering for slots
- `/api/fiber-splice/` - Fiber splice tracking
- `/api/container/` - Container management
- `/api/container-type/` - Container type definitions

**Component Management:**
- `/api/attributes-component-type/` - Component types
- `/api/attributes-component-structure/` - Component structures

**Organizational:**
- `/api/project/` - Project management
- `/api/company/` - Company/contractor management
- `/api/flags/` - Feature flagging

**Special Endpoints:**
- `GET /api/schema.gpkg` - Download GeoPackage schema (optional `?layers=` parameter)
- `GET /api/ol_*_tiles/<z>/<x>/<y>.mvt` - Vector tiles for map layers
- `POST /api/import/conduit/` - Import conduits from Excel
- `GET /api/template/conduit/` - Download Excel import template
- `GET /api/routing/` - Network routing queries
- `GET /api/trenches-near-node/` - Spatial proximity queries
- `POST /api/logs/frontend/` - Frontend error logging

All endpoints support:

- Standard CRUD operations
- Spatial filtering and queries
- Pagination
- Filtering and searching
- Authentication (JWT via `dj-rest-auth`)

## Database Models

### Core Infrastructure Models

- **Trench**: Linear excavation features with construction details, surface types, and phases
- **Conduit**: Conduits placed in trenches with type, network level, and manufacturer information
- **Microduct**: Individual mini pipes pathways within conduits (auto-generated from conduit color codes)
- **Node**: Network junction points with type, status, and network level classification
- **Address**: Postal addresses linked to nodes with development status
- **Cable**: Fiber optic cables with type, capacity, and manufacturer information
- **Fiber**: Individual fiber strands within cables

### Node Structure & Network Management Models

- **NodeSlotConfiguration**: Port layout and slot management for network nodes
- **NodeSlotDivider**: Organization of slot divisions within nodes
- **NodeSlotClipNumber**: Clip numbering system for node slots
- **FiberSplice**: Fiber connection tracking and splice management
- **Container**: Logical grouping containers for network components
- **ContainerType**: Container categorization and types

### Component Management Models

- **AttributesComponentType**: Hardware component type definitions
- **AttributesComponentStructure**: Component structure specifications

### Supporting Models

- **Projects**: Project organization
- **Flags**: Categorization flags
- **AttributesCompany**: Contractors, owners, and manufacturers
- **AttributesStatus**: Status classifications for various entities
- **AttributesPhase**: Construction phase tracking
- **AttributesNetworkLevel**: Network hierarchy levels
- **AttributesNodeType**: Node type classifications
- **AttributesStatusDevelopment**: Development status tracking
- **StoragePreferences**: File storage configuration
- **FeatureFiles**: Generic file attachments to any feature

All spatial fields use PostGIS with SRID 25832 or 25833 (ETRS89 UTM Zone 32N or 33N) as the coordinate system.

## Development

### Running Tests

```bash
pytest
```

Run specific test file:

```bash
pytest apps/api/tests/test_models.py
```

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

Load sample data for testing:

```bash
python manage.py loaddata <fixture_name>
```

Available fixtures are in `apps/api/fixtures/`:

- `attributes_*.json` - Attribute tables
- `projects.json` - Project definitions
- `flags.json` - Flag definitions
- `storage_preference.json` - Storage configuration

## Authentication

The API uses JWT authentication via `dj-rest-auth`:

1. Login: `POST /api/auth/login/` with credentials
2. Returns JWT tokens in HTTP-only cookies
3. Subsequent requests include cookies automatically
4. Logout: `POST /api/auth/logout/`

For development, you can also use session authentication via the Django admin.

## File Storage

Files are stored using a custom storage backend that supports Nextcloud integration. File uploads are handled through:

- Generic file attachments via `FeatureFiles` model
- Project-specific folder organization
- Integration with Nextcloud WebDAV

## Spatial Data

All spatial operations use PostGIS functions. Key features:

- Geometry fields use `django.contrib.gis.db.models` fields
- Default SRID: 25832 (ETRS89 UTM Zone 32N)
- Spatial indexing for performance
- Support for spatial queries and filters

## API Versioning

The API is versioned. Current version is accessible at `/api/v1/` (if versioning is configured).

## Additional Resources

- [Main README](../README.md)
- [Deployment Guide](../deployment/README.md)
- [Django Documentation](https://docs.djangoproject.com/)
- [Django REST Framework Documentation](https://www.django-rest-framework.org/)
- [PostGIS Documentation](https://postgis.net/documentation/)
