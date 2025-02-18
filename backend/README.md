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

### Database Setup

1. Navigate to the deployment directory:
   ```bash
   cd ../deployment/postgres
   ```

2. Start the PostgreSQL container:
   ```bash
   docker-compose up -d
   ```

   This will start a PostgreSQL 16 instance with PostGIS extension on port 5440.

### Environment Configuration

The application uses the following environment variables:
- `DEBUG`: Set to False in production
- `SECRET_KEY`: Django secret key
- `ALLOWED_HOSTS`: Comma-separated list of allowed hosts
- `DATABASE_URL`: PostgreSQL connection URL

### Production Deployment

1. Build the Docker image:
   ```bash
   docker build -t krit-gis-backend .
   ```

2. Run the container:
   ```bash
   docker run -d \
     --name krit-gis-backend \
     --network krit_gis_network \
     -p 8000:8000 \
     -e DEBUG=False \
     -e SECRET_KEY=your-production-secret-key \
     -e ALLOWED_HOSTS=your-domain.com \
     -e DATABASE_URL=postgres://geodock_admin:geodock_admin@db:5432/krit_gis \
     krit-gis-backend
   ```

## 🛠️ Development

### Running Tests
```bash
pytest
```

### Code Style
The project uses Ruff for code formatting and linting:
```bash
ruff check .
ruff format .
```

## 📚 API Documentation

API documentation is available at:
- Development: http://localhost:8000/api/docs/
- Production: https://your-domain.com/api/docs/

## 🌐 Available Endpoints

- `/api/v1/`: API root
- `/api/v1/admin/`: Django admin interface
- `/api/v1/docs/`: API documentation

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.