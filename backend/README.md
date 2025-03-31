# Krit GIS Backend

A Django-based GIS backend service for the Krit GIS project, providing spatial data management and API endpoints.

## 🔧 Prerequisites

- Docker and Docker Compose

## 🐳 Deployment

The project uses Docker Compose for deployment, which sets up three main services:
- PostgreSQL with PostGIS for spatial data
- Django backend service
- Nextcloud for file management

### Prerequisites
- Docker and Docker Compose
- Environment variables file (.env) containing:
  ```
  DJANGO_SECRET_KEY=your-secret-key
  DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
  DEBUG=True or False
  DB_NAME=your-database-name
  DB_USER=your-database-user
  DB_PASSWORD=your-database-password
  DB_HOST=your-database-host
  DB_PORT=your-database-port
  DEFAULT_SRID=your-default-srid
  NEXTCLOUD_ADMIN_USER=your-nextcloud-admin-user
  NEXTCLOUD_ADMIN_PASSWORD=your-nextcloud-admin-password
  NEXTCLOUD_TRUSTED_DOMAINS=your-nextcloud-trusted-domains
  ```

- Edit the `docker-compose.yml` file to set the environment variables.

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

### Service Configuration

#### Database
- Database name: your-database-name
- Port mapping: 5440 (external) -> 5432 (internal)
- Default credentials:
  - Username: your-database-user
  - Password: your-database-password
- Uses PostGIS 3.5 with PostgreSQL 17

#### Backend Service
Environment variables are pre-configured in docker-compose.yml:
- `ALLOWED_HOSTS`: localhost,127.0.0.1
- `DEFAULT_SRID`: 25832 (default for ETRS89 / UTM zone 32N)
- Database connection details
- CORS settings for development (localhost:5173)
- Logging configuration for development

#### Nextcloud
- Access URL: http://localhost:8080
- Default admin credentials:
  - Username:your-nextcloud-admin-user
  - Password:your-nextcloud-admin-password
- Uses PostgreSQL as the database backend

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