# Deployment Options

This directory contains two deployment configurations for the Krit-GIS stack:

## 1. Full Stack with Caddy (SSL/TLS) - `docker-compose.yml`

**Use this for:** Production-like environment with HTTPS support

**Features:**
- Caddy reverse proxy with automatic SSL certificates
- Services accessible via friendly domains:
  - Frontend: `https://app.localhost`
  - Backend API: `https://api.localhost`
  - Nextcloud: `https://cloud.localhost`
  - GeoServer: `https://geoserver.localhost`
  - QGIS Server: `https://qgis.localhost`
- Internal certificate authority for local development
- Load balancing and SSL termination

**Start with:**
```bash
docker-compose up -d
```

**Note:** First-time setup may have certificate issues. You might need to trust Caddy's internal CA in your browser.

## 2. Simplified Stack without Caddy (HTTP Only) - `docker-compose.no-caddy.yml`

**Use this for:** Local development, testing, or when you want to avoid SSL certificate issues

**Features:**
- Direct access to services on specific ports
- No SSL/HTTPS complexity
- Services accessible via:
  - Frontend: `http://localhost:3000`
  - Backend API: `http://localhost:8000`
  - Nextcloud: `http://localhost:8080`
  - GeoServer: `http://localhost:8081`
  - QGIS Server: `http://localhost:8082`
  - PostgreSQL: `localhost:5440`

**Start with:**
```bash
docker-compose -f docker-compose.no-caddy.yml up -d
```

## Port Configuration

Both configurations use the same environment variables for port customization:

- `BACKEND_PORT` (default: 8000)
- `GEOSERVER_PORT` (default: 8081)
- `QGIS_SERVER_PORT` (default: 8082)
- `NEXTCLOUD_PORT` (default: 8080)
- `FRONTEND_PORT` (default: 3000) - only in no-caddy version

## Environment Variables

Make sure you have a `.env` file with all required variables. Both configurations use the same environment variables, but some URL references may need adjustment:

For the no-caddy version, update these in your `.env`:
```env
NEXTCLOUD_URL=http://localhost:8080
NEXTCLOUD_PUBLIC_URL=http://localhost:8080
# Update any other HTTPS references to HTTP
```

## Switching Between Configurations

To switch from one to the other:

1. Stop current stack:
   ```bash
   docker-compose down
   # or
   docker-compose -f docker-compose.no-caddy.yml down
   ```

2. Start the other configuration:
   ```bash
   docker-compose -f docker-compose.no-caddy.yml up -d
   # or
   docker-compose up -d
   ```

## Recommended Workflow

1. **Development:** Use `docker-compose.no-caddy.yml` for simpler setup and debugging
2. **Testing/Demo:** Use `docker-compose.yml` for a more production-like environment
3. **Production:** Use `docker-compose.yml` but replace Caddy's internal certificates with proper SSL certificates 