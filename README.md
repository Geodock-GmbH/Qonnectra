# Qonnectra

## Project Status

This project is currently in development. It is not yet ready for production use. Breaking changes are expected.

A comprehensive GIS (Geographic Information System) application for managing telecommunications infrastructure, built with modern web technologies.

## Overview

Qonnectra is a full-stack web application designed for managing and visualizing telecommunications network infrastructure. It provides tools for managing trenches, conduits, microducts, nodes, addresses, cables, and fibers with spatial data capabilities.

## Features

- **Spatial Data Management**: Full PostGIS integration for handling geographic data with support for ETRS89 UTM Zone 32N or 33N (SRID 25832 or 25833)
- **Interactive Mapping**: OpenLayers-based map interface with layer management, opacity controls, search functionality, and vector tile support
- **Vector Tile Server**: TileServer-GL with mbtiles support for high-performance base map rendering (light/dark themes)
- **Network Schema Visualization**: Visual network schema editor using Svelte Flow with fiber splice management
- **Node Structure Management**: Advanced node configuration with slot management, dividers, and clip numbering
- **Fiber Splice Tracking**: Comprehensive fiber splice management with visual editor
- **Container Management**: Logical grouping and organization of network components
- **Component Management**: Hardware component tracking with types and structures
- **Multi-Project Support**: Organize infrastructure data by projects with flags and status tracking
- **File Management**: Integrated file storage with WebDAV support
- **REST API**: Django REST Framework API with spatial data support and vector tile endpoints
- **GeoPackage Export**: Download database schema as GeoPackage for QGIS-Server configuration
- **Authentication**: JWT-based authentication with HTTP-only cookies
- **Internationalization**: Support for German and English (via Paraglide)
- **QGIS Server Integration**: OGC-compliant map services (WMS, WFS with ?MAP= parameter, WMTS, WCS)

## Technology Stack

### Backend

- **Django 5.2**: Python web framework
- **PostgreSQL 17**: Database with PostGIS extension
- **Django REST Framework**: RESTful API
- **django-rest-framework-gis**: GIS-specific API features
- **dj-rest-auth**: JWT authentication

### Frontend

- **SvelteKit**: Full-stack framework (Svelte 5)
- **OpenLayers 10**: Interactive maps
- **Skeleton UI**: Component library
- **Svelte Flow**: Network diagram visualization
- **TailwindCSS**: Utility-first CSS framework
- **Paraglide**: Internationalization

### Deployment

- **Docker Compose**: Container orchestration
- **Caddy**: Reverse proxy with automatic HTTPS
- **Nginx**: Web server and reverse proxy
- **QGIS Server**: OGC web services (WMS, WFS with MAP parameter support)
- **TileServer-GL**: Vector tile server with mbtiles support

## Project Structure

```
qonnectra/
├── backend/          # Django REST API
│   ├── apps/
│   │   └── api/      # Main API application
│   └── core/         # Django settings and configuration
├── frontend/         # SvelteKit application
│   └── src/
│       ├── lib/      # Components, utilities, stores
│       └── routes/   # SvelteKit routes
└── deployment/       # Docker Compose configuration
    ├── postgres/     # PostgreSQL setup
    ├── qgis/         # QGIS Server configuration and projects
    ├── tiles/        # TileServer-GL configuration and mbtiles
    ├── caddy/        # Caddy reverse proxy
    └── nginx/        # Nginx configuration
```

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local frontend development)
- Python 3.10+ (for local backend development)
- uv package manager (optional, recommended for Python)

### Getting Started

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd qonnectra
   ```

2. **Set up environment variables**

   Create a `.env` file in the `deployment/` directory. See [Deployment README](deployment/README.md) for required variables.

3. **Start services with Docker Compose**

   ```bash
   cd deployment
   docker-compose up -d --build
   ```

4. **Access the application**
   - Frontend: `https://app.localhost` (or `http://localhost:5173` for local dev)
   - API: `https://api.localhost` (or `http://localhost:8000` for local dev)
   - Admin: `https://api.localhost/admin`
   - QGIS Server: `https://qgis.localhost/ows/?MAP=/projects/<project>.qgs`
   - TileServer: `https://tiles.localhost`
   - Files (WebDAV): `https://files.localhost`

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
- **Address**: Postal addresses (Point geometry)
- **Cable**: Fiber optic cables with capacity tracking
- **Fiber**: Individual fiber strands within cables

### Node Structure & Network Management

- **NodeSlotConfiguration**: Port layout and slot management for nodes
- **NodeSlotDivider**: Slot organization within nodes
- **NodeSlotClipNumber**: Clip numbering for node slots
- **FiberSplice**: Fiber connection tracking and splice management
- **Container**: Logical grouping of network components
- **ContainerType**: Categories for container organization

All spatial data uses ETRS89 UTM Zone 32N or 33N (SRID 25832 or 25833) as the coordinate system.

## Development Workflow

### Local Development

1. **Backend Development**

   ```bash
   cd backend
   uv venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   uv pip install -r uv --dev
   python manage.py migrate
   python manage.py runserver
   ```

2. **Frontend Development**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### Testing

- **Backend**: `pytest` (see [Backend README](backend/README.md))
- **Frontend**:
  - Unit tests: `npm run test:unit` (Vitest)
  - E2E tests: `npm run test:e2e` (Playwright)

## Contributing

Contributions are welcome! Please ensure that:

1. Code follows the project's style guidelines
2. Tests are included for new features
3. Documentation is updated as needed
4. All tests pass before submitting

## Documentation

- [Backend Documentation](backend/README.md)
- [Frontend Documentation](frontend/README.md)
- [Deployment Documentation](deployment/README.md)
- [QGIS Server Setup](deployment/qgis/README.md)

## License

This project is licensed under the GPLv3 License - see the [LICENSE](LICENSE) file for details.

## Additional Resources

- [Django Documentation](https://docs.djangoproject.com/)
- [SvelteKit Documentation](https://kit.svelte.dev/)
- [OpenLayers Documentation](https://openlayers.org/)
- [PostGIS Documentation](https://postgis.net/documentation/)
