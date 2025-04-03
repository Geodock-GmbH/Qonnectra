# Krit GIS Backend

A Django-based GIS backend service for the Krit GIS project, providing spatial data management and API endpoints.

## 🔧 Prerequisites

- Docker and Docker Compose

## ⚙️ Configuration

The project requires configuration across several files. Here's a comprehensive guide to the required settings:

### Environment Variables (.env)

Create a `.env` file in the `deployment` directory with the following variables:

```env
# Django Settings
DJANGO_SECRET_KEY=your-secure-secret-key
DJANGO_ALLOWED_HOSTS=api.localhost,localhost,127.0.0.1
DEBUG=True  # Set to False in production

# Backend Settings
BACKEND_PORT=8000 

# Database Settings
DB_NAME=krit_gis
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_HOST=krit_gis_db
DB_PORT=5432

# Geometry Settings
DEFAULT_SRID=25832  # ETRS89 / UTM zone 32N

# Nextcloud Settings
NEXTCLOUD_PORT=8080
NEXTCLOUD_ADMIN_USER=your-nextcloud-admin
NEXTCLOUD_ADMIN_PASSWORD=your-secure-password
NEXTCLOUD_TRUSTED_DOMAINS=cloud.localhost localhost 127.0.0.1
NEXTCLOUD_DATABASE_NAME=nextcloud_db

# Caddy Settings
CADDY_PORT=80
CADDY_HTTPS_PORT=443

# Nginx Settings
NGINX_PORT=80

```

### PostgreSQL Settings (deployment/postgres/init.sql)

The `deployment/postgres/init.sql` file contains the initialization script for the PostgreSQL database. It sets up the database and the PostGIS extension for Django.


### Django Settings (settings.py)

The following settings in `backend/core/settings.py` may need adjustment:

- `CORS_ALLOWED_ORIGINS`: Add your frontend URLs
- `NEXTCLOUD_URL`: Your Nextcloud service URL
- `NEXTCLOUD_PUBLIC_URL`: Public-facing Nextcloud URL
- `NEXTCLOUD_USERNAME`: Admin username for Nextcloud
- `NEXTCLOUD_PASSWORD`: Admin password for Nextcloud
- `NEXTCLOUD_BASE_PATH`: Base path for file storage
- `NEXTCLOUD_VERIFY_SSL`: SSL verification setting

### Docker Compose Configuration

Key settings in `deployment/docker-compose.yml`:

- Database service (db):
  - Port mapping: 5440:5432
  - Volume mounts for data persistence
  - PostGIS version: 17-3.5

- Backend service:
  - Port: ${BACKEND_PORT:-8000}
  - Dependencies on database
  - Environment variables from .env

- Nextcloud service:
  - Port: ${NEXTCLOUD_PORT:-8080}
  - Volume mounts for data, apps, and configuration
  - Database integration settings

- Caddy service:
  - Port: ${CADDY_PORT:-80}
  - Port: ${CADDY_HTTPS_PORT:-443}
  - Volume mounts for data, configuration, and certificates
  - SSL certificate generation

## 🐳 Deployment

The project uses Docker Compose for deployment, which sets up four main services:
- PostgreSQL with PostGIS for spatial data
- Django backend service
- Nextcloud for file management
- Caddy for reverse proxy
- Nginx for reverse proxy and static file serving
### Starting the Services

1. Navigate to the deployment directory:
   ```bash
   cd ../deployment
   ```

2. Start all services:
   ```bash
   docker-compose up -d --build
   ```

   This will start:
   - PostgreSQL 17 with PostGIS on port 5440
   - Django backend on port 8000
   - Nextcloud on port 8080
   - Caddy for reverse proxy on port 80
   
### Service Configuration

#### Database
- **Database name**: your-database-name
- **Port mapping**: 5440 (external) -> 5432 (internal)
- **Default credentials**:
  - **Username**: your-database-user
  - **Password**: your-database-password
- **Uses**: PostGIS 3.5 with PostgreSQL 17

#### Backend Service
- **Environment variables** are pre-configured in `docker-compose.yml`:
  - `ALLOWED_HOSTS`: localhost,127.0.0.1
  - `DEFAULT_SRID`: 25832 (default for ETRS89 / UTM zone 32N)
  - **Database connection details**
  - **CORS settings** for development (localhost:5173)
  - **Logging configuration** for development

#### Nextcloud
- **Access URL**: http://localhost:8080
- **Default admin credentials**:
  - **Username**: your-nextcloud-admin-user
  - **Password**: your-nextcloud-admin-password
- **Uses**: PostgreSQL as the database backend

#### Caddy
- **Reverse proxy** for backend and Nextcloud
- **SSL certificate generation**

#### Nginx
- **Reverse proxy** for backend and Nextcloud
- **Static file serving**

### Monitoring Services

View running containers:
```bash
docker-compose ps
```

View service logs:
```bash
docker-compose logs [service_name]
```

### Stopping Services
```bash
docker-compose down
```

## 🛠️ Development

### Running Tests
```