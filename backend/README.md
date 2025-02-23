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