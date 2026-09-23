# Qonnectra

## Overview

Qonnectra is a full-stack web application designed for managing and visualizing telecommunications network infrastructure. It provides tools for managing trenches, conduits, microducts, nodes, addresses, cables, and fibers with spatial data capabilities.

## Try it out
Before installing, you can try out the application at:

https://app.geodock.de

Credentials:
- Username: public_testaccount
- Password: M!XUaZp!sCvifv

This gives you access to the frontend. After logging in, choose the project "Testprojekt" from the dropdown in the top left corner.
The admin panel is currently not accessible for the public test account.

The Server resets every day, so the changes you make will be lost.

## Features

- **Spatial Data Management**: Full PostGIS integration for handling geographic data with support for ETRS89 UTM Zone 32N or 33N (SRID 25832 or 25833)
- **Interactive Mapping**: OpenLayers-based map interface with layer management, opacity controls, search functionality, and vector tile support
- **Vector Tile Server**: TileServer-GL with mbtiles support for high-performance base map rendering (light/dark themes)
- **Wireguard VPN**: VPN for secure access to the database from QGIS Desktop
- **Network Schema Visualization**: Visual network schema editor using Svelte Flow with fiber splice management
- **Node Structure Management**: Advanced node configuration with slot management, dividers, and clip numbering
- **Fiber Splice Tracking**: Comprehensive fiber splice management with visual editor
- **Fiber Trace & Signal Analysis**: Trace fibers from an address, cable, fiber, node or residential unit and see where the signal breaks
- **Fault Simulation**: Simulate failures and see the affected parts of the network
- **Valuation**: Network valuation based on configurable cost rates
- **Pipeline Records**: Pipeline records and inquiries with drawn inquiry areas and export
- **Container Management**: Logical grouping and organization of network components
- **Component Management**: Hardware component tracking with types and structures
- **Building Management**: Addresses and Residential units management with status and type tracking
- **Multi-Project Support**: Organize infrastructure data by projects with flags and status tracking
- **Deep Links**: Every view is a shareable URL: project, open feature, tab and map view
- **Permissions**: Per-route and per-model permissions managed in the Django admin
- **File Management**: Integrated file storage with WebDAV support
- **REST API**: Django REST Framework API with spatial data support and vector tile endpoints
- **GeoPackage Export**: Download database schema as GeoPackage for QGIS-Server configuration
- **Authentication**: JWT-based authentication with HTTP-only cookies, bearer tokens for external apps
- **Internationalization**: Support for German and English (via Paraglide)
- **QGIS Server Integration**: OGC-compliant map services (WMS, WFS with ?MAP= parameter, WMTS, WCS)

## Technology Stack

### Backend

- **Django 5.2**: Python web framework
- **PostgreSQL 17**: Database with PostGIS extension
- **Django REST Framework**: RESTful API, versioned under `/api/v1/`
- **django-rest-framework-gis**: GIS-specific API features
- **dj-rest-auth** + **simplejwt**: JWT authentication
- **drf-spectacular**: OpenAPI schema

### Frontend

- **SvelteKit 2**: Full-stack framework (Svelte 5 runes, TypeScript, remote functions)
- **OpenLayers 10**: Interactive maps
- **Skeleton UI**: Component library
- **Svelte Flow**: Network diagram visualization
- **TailwindCSS**: Utility-first CSS framework
- **Paraglide**: Internationalization

### Deployment

- **Docker Compose**: Container orchestration
- **Frontend**: SvelteKit application
- **Backend**: Django REST API
- **PostgreSQL**: Database with PostGIS extension
- **Caddy**: Reverse proxy with automatic HTTPS and WebDAV file access
- **Nginx**: Static files, API proxy and WMS proxy cache
- **QGIS Server**: OGC web services (WMS, WFS with MAP parameter support)
- **TileServer-GL**: Vector tile server with mbtiles support for high-performance base map rendering (light/dark themes)
- **Wireguard**: VPN for secure access to the database from QGIS Desktop

## Project Structure

```
qonnectra/
├── CONTEXT.md        # Domain glossary (project, feature, drawer, map view, ...)
├── docs/adr/         # Architecture decision records
├── backend/          # Django REST API
│   ├── apps/
│   │   └── api/      # Main API application
│   └── core/         # Django settings and configuration
├── frontend/         # SvelteKit application
│   ├── src/
│   │   ├── lib/      # Components, classes, remote functions, utilities, stores
│   │   └── routes/   # SvelteKit routes (project pages under /project/[projectId]/)
│   └── tests/e2e/    # Playwright tests
└── deployment/       # Docker Compose configuration
    ├── backup/       # Backup and restore scripts
    ├── postgres/     # PostgreSQL setup
    ├── qgis/         # QGIS Server configuration and projects
    ├── tiles/        # TileServer-GL configuration and mbtiles
    ├── caddy/        # Caddy image
    ├── nginx/        # Nginx configuration
    └── wireguard/    # Wireguard VPN configuration
```

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 22+ (for local frontend development)
- Python 3.12+ (for local backend development)
- uv package manager (optional, recommended for Python)

### Getting Started

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd qonnectra
   ```

2. **Set up environment variables**

   Create a `.env` file in the `deployment/` directory. For production, start from `deployment/.env.production.template`. See [Deployment README](deployment/README.md) for required variables.

3. **Start services with Docker Compose**

   ```bash
   cd deployment

   # Local development with HTTPS on *.localhost
   docker compose -f docker-compose.dev.yml up -d --build

   # Production
   docker compose up -d --build
   ```

4. **Access the application** (development stack)
   - Frontend: `https://app.localhost` (or `http://localhost:5173` when running `npm run dev`)
   - API: `https://api.localhost` (or `http://localhost:8000` when running `manage.py runserver`)
   - Admin: `https://admin.localhost/admin`
   - QGIS Server: `https://qgis.localhost/ows/?MAP=/projects/<project>.qgs`
   - TileServer: `https://tiles.localhost`
   - Files (WebDAV): `https://files.localhost`

   After login the app opens the map of your last visited (or first) project at `/project/<id>/map`.

For detailed setup instructions, see the READMEs in each directory:

- [Backend Setup](backend/README.md)
- [Frontend Setup](frontend/README.md)
- [Deployment Guide](deployment/README.md)

## Core Data Models

The application manages the following infrastructure components:

### Infrastructure

- **Trench**: Linear excavation features with construction details (LineString geometry)
- **Conduit**: Conduits placed in trenches with automatic microduct generation
- **Microduct**: Individual mini pipes pathways within conduits
- **Node**: Network junction points (Point geometry)
- **Address**: Postal addresses (Point geometry) with residential units
- **Area**: Polygon areas
- **Cable**: Fiber optic cables with capacity tracking
- **Fiber**: Individual fiber strands within cables

### Node Structure & Network Management

- **NodeSlotConfiguration**: Port layout and slot management for nodes
- **NodeSlotDivider**: Slot organization within nodes
- **NodeSlotClipNumber**: Clip numbering for node slots
- **FiberSplice**: Fiber connection tracking and splice management
- **Container**: Logical grouping of network components
- **ContainerType**: Categories for container organization

### Other

- **PipelineRecord** / **PipelineInquiryArea**: Pipeline records and inquiries
- **WMSSource** / **WMSLayer**: External WMS layers
- **QGISProject**: QGIS Server projects uploaded through the admin
- **RoutePermission** / **ModelPermission**: Access control

See the [Backend README](backend/README.md) for the complete list.

All spatial data uses ETRS89 UTM Zone 32N or 33N (SRID 25832 or 25833) as the coordinate system.

## Development Workflow

### Local Development

1. **Backend Development**

   ```bash
   cd backend
   uv venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   uv sync --dev
   python manage.py migrate
   python manage.py load_initial_data
   python manage.py runserver
   ```

2. **Frontend Development**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### Testing

- **Backend**: `uv run pytest apps/api/tests/` in `backend/` (see [Backend README](backend/README.md))
- **Frontend** (in `frontend/`):
  - Unit and component tests: `npm test` (Vitest)
  - Type check: `npm run check`
  - Lint: `npm run lint:ts`
  - E2E tests: `npx playwright test` (Playwright; needs `E2E_TEST_USERNAME` / `E2E_TEST_PASSWORD` in `frontend/.env`)

## Documentation

- [Backend Documentation](backend/README.md)
- [Frontend Documentation](frontend/README.md)
- [Deployment Documentation](deployment/README.md)
- [QGIS Server Setup](deployment/qgis/README.md)
- [WireGuard VPN](deployment/wireguard/README.md)
- [Domain Glossary](CONTEXT.md)
- [Architecture Decisions](docs/adr/)
- [Contributing](CONTRIBUTING.md) · [Security Policy](SECURITY.md) · [Changelog](CHANGELOG.md)

## License

This project is licensed under the AGPLv3 License - see the [LICENSE](LICENSE) file for details.

## Additional Resources

- [Django Documentation](https://docs.djangoproject.com/)
- [SvelteKit Documentation](https://svelte.dev/docs/kit)
- [OpenLayers Documentation](https://openlayers.org/)
- [PostGIS Documentation](https://postgis.net/documentation/)
