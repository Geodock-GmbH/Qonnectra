# Qonnectra

## Overview

Qonnectra is a full-stack web application for managing and mapping telecommunications network infrastructure: trenches, conduits, microducts, nodes, addresses, cables and fibers, all stored as spatial data.

## Try it out
Before installing, you can try out the application at:

https://app.geodock.de

Credentials:
- Username: public_testaccount
- Password: M!XUaZp!sCvifv

This gives you access to the frontend. After logging in, choose the project "Testprojekt" from the dropdown in the top left corner.
The admin panel is currently not accessible for the public test account.

The server resets every day, so any changes you make will be lost.

## Features

- Spatial data: PostGIS storage in ETRS89 UTM zone 32N or 33N (SRID 25832 or 25833)
- Map: OpenLayers map with layer management, opacity controls, search and vector tiles
- Vector tile server: TileServer-GL serves light and dark base maps from mbtiles
- WireGuard VPN: direct database access from QGIS Desktop
- Network schema: Svelte Flow editor for the network schema, including fiber splices
- Node structure: slot configuration, dividers and clip numbering
- Fiber splices: splice tracking with a visual editor
- Fiber trace and signal analysis: trace fibers from an address, cable, fiber, node or residential unit and see where the signal breaks
- Fault simulation: simulate failures and see which parts of the network are affected
- Valuation: network valuation based on configurable cost rates
- Pipeline records: pipeline records and inquiries with drawn inquiry areas and export
- Containers: logical grouping of network components
- Components: hardware component tracking with types and structures
- Buildings: addresses and residential units with status and type
- Projects: infrastructure data organized by project, with flags and status tracking
- Deep links: every view (project, open feature, tab and map view) has a shareable URL
- Permissions: per-route and per-model permissions, managed in the Django admin
- Files: file storage with WebDAV access
- REST API: Django REST Framework API with spatial data and vector tile endpoints
- GeoPackage export: download the database schema as a GeoPackage to configure QGIS Server
- Authentication: JWT in HTTP-only cookies, bearer tokens for external apps
- Languages: German and English (via Paraglide)
- QGIS Server: OGC map services (WMS, WFS with the `?MAP=` parameter, WMTS, WCS)

## Technology stack

### Backend

- Django 5.2: Python web framework
- PostgreSQL 17 with the PostGIS extension
- Django REST Framework: REST API, versioned under `/api/v1/`
- django-rest-framework-gis: GIS support for the API
- dj-rest-auth and simplejwt: JWT authentication
- drf-spectacular: OpenAPI schema

### Frontend

- SvelteKit 2 (Svelte 5 runes, TypeScript, remote functions)
- OpenLayers 10: maps
- Skeleton UI: component library
- Svelte Flow: network diagrams
- TailwindCSS: styling
- Paraglide: internationalization

### Deployment

- Docker Compose: container orchestration
- Frontend: SvelteKit application
- Backend: Django REST API
- PostgreSQL: database with the PostGIS extension
- Caddy: reverse proxy with automatic HTTPS and WebDAV file access
- Nginx: static files, API proxy and WMS proxy cache
- QGIS Server: OGC web services (WMS, WFS with MAP parameter support)
- TileServer-GL: vector base maps (light and dark) from mbtiles
- WireGuard: VPN for database access from QGIS Desktop

## Project structure

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

## Quick start

### Prerequisites

- Docker and Docker Compose
- Node.js 22+ (for local frontend development)
- Python 3.12+ (for local backend development)
- uv package manager (optional, recommended for Python)

### Getting started

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd qonnectra
   ```

2. Set up the environment variables.

   Create a `.env` file in the `deployment/` directory. For production, start from `deployment/.env.production.template`. The [Deployment README](deployment/README.md) lists the required variables.

3. Start the services with Docker Compose:

   ```bash
   cd deployment

   # Local development with HTTPS on *.localhost
   docker compose -f docker-compose.dev.yml up -d --build

   # Production
   docker compose up -d --build
   ```

4. Open the application (development stack):
   - Frontend: `https://app.localhost` (or `http://localhost:5173` when running `npm run dev`)
   - API: `https://api.localhost` (or `http://localhost:8000` when running `manage.py runserver`)
   - Admin: `https://admin.localhost/admin`
   - QGIS Server: `https://qgis.localhost/ows/?MAP=/projects/<project>.qgs`
   - TileServer: `https://tiles.localhost`
   - Files (WebDAV): `https://files.localhost`

   After login the app opens the map of your last visited (or first) project at `/project/<id>/map`.

Each directory has its own README with detailed setup instructions:

- [Backend Setup](backend/README.md)
- [Frontend Setup](frontend/README.md)
- [Deployment Guide](deployment/README.md)

## Core data models

The application manages the following infrastructure components:

### Infrastructure

- `Trench`: linear excavation features with construction details (LineString geometry)
- `Conduit`: conduits placed in trenches, with automatic microduct generation
- `Microduct`: individual mini pipes within conduits
- `Node`: network junction points (Point geometry)
- `Address`: postal addresses (Point geometry) with residential units
- `Area`: polygon areas
- `Cable`: fiber optic cables with capacity tracking
- `Fiber`: individual fiber strands within cables

### Node structure and network management

- `NodeSlotConfiguration`: port layout and slot management for nodes
- `NodeSlotDivider`: slot organization within nodes
- `NodeSlotClipNumber`: clip numbering for node slots
- `FiberSplice`: fiber connections and splice management
- `Container`: logical grouping of network components
- `ContainerType`: container categories

### Other

- `PipelineRecord` / `PipelineInquiryArea`: pipeline records and inquiries
- `WMSSource` / `WMSLayer`: external WMS layers
- `QGISProject`: QGIS Server projects uploaded through the admin
- `RoutePermission` / `ModelPermission`: access control

The [Backend README](backend/README.md) has the complete list.

All spatial data uses ETRS89 UTM zone 32N or 33N (SRID 25832 or 25833).

## Development workflow

### Local development

1. Backend:

   ```bash
   cd backend
   uv venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   uv sync --dev
   python manage.py migrate
   python manage.py load_initial_data
   python manage.py runserver
   ```

2. Frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### Testing

- Backend: `uv run pytest apps/api/tests/` in `backend/` (see the [Backend README](backend/README.md))
- Frontend (in `frontend/`):
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

This project is licensed under the AGPLv3. See the [LICENSE](LICENSE) file for details.

## Additional resources

- [Django Documentation](https://docs.djangoproject.com/)
- [SvelteKit Documentation](https://svelte.dev/docs/kit)
- [OpenLayers Documentation](https://openlayers.org/)
- [PostGIS Documentation](https://postgis.net/documentation/)
