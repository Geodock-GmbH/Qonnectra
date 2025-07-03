# Environment Variables for QGIS Server

Add these variables to your `.env` file in the deployment directory:

```bash
# QGIS Server Configuration
QGIS_SERVER_PORT=8082

# Optional: Override default project file
# QGIS_PROJECT_FILE=/projects/your-project.qgs
```

## Required Variables from Main Stack

The QGIS Server container will automatically inherit these database connection variables:

- `DB_NAME` - PostgreSQL database name
- `DB_USER` - PostgreSQL username  
- `DB_PASSWORD` - PostgreSQL password
- `DB_HOST` - PostgreSQL host (should be 'db')
- `DB_PORT` - PostgreSQL port (should be '5432')

## Testing the Setup

1. Start the stack: `docker-compose up -d`
2. Check QGIS Server logs: `docker logs krit_gis_qgis_server`
3. Test WMS capabilities: `curl "http://localhost:8082/qgis/qgis_mapserv.fcgi?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities"`
4. Or visit: `https://qgis.localhost/qgis/qgis_mapserv.fcgi?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities` 