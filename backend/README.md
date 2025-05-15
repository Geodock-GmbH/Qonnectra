# Krit GIS Backend

A Django-based GIS backend service for the Krit GIS project, providing spatial data management and API endpoints.

## 🔧 Prerequisites

- uv package manager (optional, recommended)
- Docker and Docker Compose

## 🔧 Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/krit-gis-backend.git
   cd krit-gis-backend
   ```

2. Install dependencies:
   ```bash
   uv venv
   ```
   - On MacOS/Linux:
     ```bash
     source .venv/bin/activate
     uv pip install -r uv --dev
     ```
   - On Windows:
     ```bash
     .venv\Scripts\activate
     uv pip install -r uv --dev
     ```
   

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

# Nextcloud File Uploader Settings
NEXTCLOUD_URL=https://cloud.localhost
NEXTCLOUD_PUBLIC_URL=https://cloud.localhost
NEXTCLOUD_FILEUPLOADER_USERNAME=your-nextcloud-fileuploader
NEXTCLOUD_FILEUPLOADER_PASSWORD=your-secure-password

# Caddy Settings
CADDY_PORT=80
CADDY_HTTPS_PORT=443

# Nginx Settings
NGINX_PORT=80

# Geoserver Settings
GEOSERVER_PORT=8081
GEOSERVER_ADMIN_USER=your-geoserver-admin
GEOSERVER_ADMIN_PASSWORD=your-secure-password

```

### PostgreSQL Settings (deployment/postgres/init.sql)

The `deployment/postgres/init.sql` file contains the initialization script for the PostgreSQL database. It sets up the database and the PostGIS extension for Django.


### Django Settings (settings.py)

The following settings in `backend/core/settings.py` may need adjustment:

- `CORS_ALLOWED_ORIGINS`


### Docker Compose Configuration

Key settings in `deployment/docker-compose.yml`:

- Database service (db):
  - Port mapping: 5440:5432
  - Volume mounts for data persistence
  - PostGIS version: 17-3.5

- Backend service:
  - Port: ${BACKEND_PORT:-8000}
  - Expose: 8000
  - Dependencies on database
  - Environment variables from .env

- Nextcloud service:
  - Port: ${NEXTCLOUD_PORT:-8080}
  - Expose: 8080
  - Volume mounts for data, apps, and configuration
  - Database integration settings
  - Environment variables from .env

- Caddy service:
  - Port: ${CADDY_PORT:-80}
  - Port: ${CADDY_HTTPS_PORT:-443}
  - Volume mounts for data, configuration, and certificates
  - SSL certificate generation

- Nginx service:
  - Port: ${NGINX_PORT:-80}
  - Volume mounts for configuration
  - Static file serving

- Geoserver service:
  - Port: ${GEOSERVER_PORT:-8081}
  - Volume mounts for data
  - Environment variables from .env

## 🐳 Deployment

The project uses Docker Compose for deployment, which sets up four main services:
- PostgreSQL with PostGIS for spatial data
- Django backend service
- Nextcloud for file management
- Caddy for reverse proxy
- Nginx for reverse proxy and static file serving
- Geoserver for spatial data management

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
   - PostgreSQL 17 with PostGIS
   - Django backend
   - Nextcloud
   - Caddy for reverse proxy
   - Nginx for reverse proxy and static file serving
   - Geoserver for spatial data management
   
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
# Krit GIS Backend

A Django-based GIS backend service for the Krit GIS project, providing spatial data management and API endpoints.

## 🔧 Prerequisites

- Python >= 3.10
- Docker and Docker Compose
- PostgreSQL 17 with PostGIS extension
- Git

## 🚀 Quick Start

### Backend Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/Krit-GIS.git
   cd Krit-GIS/backend
   ```

2. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -e .
   ```

4. Create a `.env` file in the backend directory or
   write it directly in the `core/settings.py` file with the following content:
   ```
   DEBUG=True
   SECRET_KEY=your-secret-key
   ALLOWED_HOSTS=localhost,127.0.0.1
   DATABASE_URL=postgres://geodock_admin:geodock_admin@localhost:5440/krit_gis
   ```

5. Run migrations:
   ```bash
   python manage.py migrate
   ```

6. Start the development server:
   ```bash
   python manage.py runserver
   ```

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
  ```

### Starting the Services

1. Navigate to the deployment directory:
   ```bash
   cd ../deployment
   ```

2. Start all services:
   ```bash
   docker-compose up -d
   ```

   This will start:
   - PostgreSQL 17 with PostGIS on port 5440
   - Django backend on port 8000
   - Nextcloud on port 8080

### Service Configuration

#### Database
- Database name: krit_gis
- Port: 5440 (external), 5432 (internal)
- Default credentials (for development only):
  - Username: geodock_admin
  - Password: geodock_admin

#### Backend Service
Environment variables are pre-configured in docker-compose.yml:
- `DEBUG`: Set to False by default
- `ALLOWED_HOSTS`: localhost,127.0.0.1
- `DEFAULT_SRID`: 25832
- Database connection details

#### Nextcloud
- Access URL: http://localhost:8080
- Default admin credentials (for development only):
  - Username: admin
  - Password: admin

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