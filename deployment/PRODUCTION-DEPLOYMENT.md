# Krit-GIS Production Deployment Guide

This guide walks you through deploying the Krit-GIS stack to a production server with SSL certificates, proper security, and monitoring.

## 📋 Prerequisites

### Server Requirements
- **OS**: Ubuntu 20.04+ or similar Linux distribution
- **RAM**: Minimum 4GB, recommended 8GB+
- **Storage**: Minimum 50GB SSD, recommended 100GB+
- **CPU**: Minimum 2 cores, recommended 4+ cores
- **Network**: Public IP address with ports 80 and 443 accessible

### Domain Requirements
- A registered domain name (e.g., `your-domain.com`)
- Access to DNS management for your domain
- Ability to create subdomains:
  - `app.your-domain.com` (Frontend)
  - `api.your-domain.com` (Backend API)
  - `cloud.your-domain.com` (Nextcloud)
  - `geoserver.your-domain.com` (GeoServer)
  - `qgis.your-domain.com` (QGIS Server)

### Software Requirements
- Docker (latest version)
- Docker Compose (latest version)
- Git
- Basic command line knowledge

## 🚀 Quick Start

### 1. Install Docker and Docker Compose

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Log out and back in for group changes to take effect
```

### 2. Clone the Repository

```bash
git clone https://github.com/your-username/Krit-GIS.git
cd Krit-GIS/deployment
```

### 3. Configure Environment Variables

```bash
# Copy the production template
cp .env.production.template .env

# Edit the environment file
nano .env
```

**Critical variables to change:**

```bash
# Domain Configuration
DOMAIN_NAME=your-domain.com
API_DOMAIN=api.your-domain.com
APP_DOMAIN=app.your-domain.com
CLOUD_DOMAIN=cloud.your-domain.com
GEOSERVER_DOMAIN=geoserver.your-domain.com
QGIS_DOMAIN=qgis.your-domain.com

# Database (CHANGE THESE!)
DB_PASSWORD=your_super_secure_database_password
DB_USER=krit_gis_prod_user

# Django (CHANGE THESE!)
DJANGO_SECRET_KEY=your_50_character_secret_key_here
DJANGO_ALLOWED_HOSTS=your-domain.com,api.your-domain.com
DJANGO_SUPERUSER_PASSWORD=your_admin_password
DJANGO_SUPERUSER_EMAIL=admin@your-domain.com

# GeoServer (CHANGE THIS!)
GEOSERVER_ADMIN_PASSWORD=your_geoserver_password

# Nextcloud (CHANGE THESE!)
NEXTCLOUD_ADMIN_PASSWORD=your_nextcloud_password
NEXTCLOUD_FILEUPLOADER_PASSWORD=your_uploader_password
NEXTCLOUD_TRUSTED_DOMAINS=cloud.your-domain.com

# Production Settings
DEBUG=False
```

**Generate a Django secret key:**
```bash
python3 -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
```

### 4. Configure DNS

Before deploying, set up your DNS records to point to your server's IP address:

```
Type    Name                    Value
A       your-domain.com         YOUR_SERVER_IP
A       app.your-domain.com     YOUR_SERVER_IP
A       api.your-domain.com     YOUR_SERVER_IP
A       cloud.your-domain.com   YOUR_SERVER_IP
A       geoserver.your-domain.com YOUR_SERVER_IP
A       qgis.your-domain.com    YOUR_SERVER_IP
```

### 5. Deploy

```bash
# Run the deployment script
./deploy.sh

# Or deploy manually
docker-compose -f docker-compose.production.yml up -d
```

## 🔧 Manual Deployment Steps

If you prefer to deploy manually or need to customize the process:

### 1. Build and Start Services

```bash
# Pull latest images
docker-compose -f docker-compose.production.yml pull

# Build custom images
docker-compose -f docker-compose.production.yml build

# Start services
docker-compose -f docker-compose.production.yml up -d
```

### 2. Verify Deployment

```bash
# Check service status
docker-compose -f docker-compose.production.yml ps

# Check logs
docker-compose -f docker-compose.production.yml logs -f

# Check individual service logs
docker-compose -f docker-compose.production.yml logs backend
docker-compose -f docker-compose.production.yml logs caddy
```

### 3. Wait for SSL Certificates

Caddy will automatically obtain SSL certificates from Let's Encrypt. This may take a few minutes. Check the Caddy logs:

```bash
docker-compose -f docker-compose.production.yml logs caddy
```

## 🔐 Security Considerations

### Firewall Configuration

```bash
# Install UFW
sudo apt install ufw

# Default rules
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (adjust port if needed)
sudo ufw allow 22

# Allow HTTP and HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Enable firewall
sudo ufw enable
```

### Database Security

- The database is only accessible within the Docker network
- Use strong passwords for all database users
- Regular backups are essential

### File Permissions

Ensure proper file permissions:

```bash
# Set restrictive permissions on .env file
chmod 600 .env

# Set proper permissions on deployment directory
chmod 755 deploy.sh
```

## 📊 Monitoring and Maintenance

### Service Management

```bash
# Check service status
./deploy.sh status

# View logs
./deploy.sh logs

# Restart services
./deploy.sh restart

# Stop services
./deploy.sh stop

# Update services
./deploy.sh update
```

### Backup and Restore

```bash
# Create backup
./deploy.sh backup

# Manual database backup
docker-compose -f docker-compose.production.yml exec db pg_dump -U $DB_USER $DB_NAME > backup.sql

# Restore database
docker-compose -f docker-compose.production.yml exec -T db psql -U $DB_USER $DB_NAME < backup.sql
```

### Log Management

```bash
# View all logs
docker-compose -f docker-compose.production.yml logs

# Follow logs in real-time
docker-compose -f docker-compose.production.yml logs -f

# View specific service logs
docker-compose -f docker-compose.production.yml logs backend
docker-compose -f docker-compose.production.yml logs caddy
docker-compose -f docker-compose.production.yml logs db
```

### Resource Monitoring

```bash
# Check resource usage
docker stats

# Check disk usage
df -h
docker system df

# Check service health
docker-compose -f docker-compose.production.yml ps
```

## 🔄 Updates and Maintenance

### Updating the Application

```bash
# Pull latest code
git pull origin main

# Update using deployment script
./deploy.sh update

# Or manually
docker-compose -f docker-compose.production.yml pull
docker-compose -f docker-compose.production.yml build --no-cache
docker-compose -f docker-compose.production.yml up -d
```

### Certificate Renewal

Caddy automatically renews SSL certificates. Check renewal status:

```bash
docker-compose -f docker-compose.production.yml logs caddy | grep -i cert
```

## 🌐 Accessing Your Application

After successful deployment, your services will be available at:

- **Frontend**: https://app.your-domain.com
- **API**: https://api.your-domain.com
- **Django Admin**: https://api.your-domain.com/admin/
- **Nextcloud**: https://cloud.your-domain.com
- **GeoServer**: https://geoserver.your-domain.com/geoserver/
- **QGIS Server**: https://qgis.your-domain.com

## 🔍 Troubleshooting

### Common Issues

1. **SSL Certificate Issues**
   ```bash
   # Check Caddy logs
   docker-compose -f docker-compose.production.yml logs caddy
   
   # Ensure DNS is properly configured
   nslookup your-domain.com
   ```

2. **Database Connection Issues**
   ```bash
   # Check database logs
   docker-compose -f docker-compose.production.yml logs db
   
   # Test database connection
   docker-compose -f docker-compose.production.yml exec db psql -U $DB_USER $DB_NAME
   ```

3. **Service Won't Start**
   ```bash
   # Check service logs
   docker-compose -f docker-compose.production.yml logs [service-name]
   
   # Check resource usage
   docker stats
   free -h
   df -h
   ```

4. **502 Bad Gateway**
   - Usually means backend service is not ready
   - Check backend logs and wait for full startup

### Log Locations

- **Application logs**: `docker-compose logs`
- **Caddy logs**: `./logs/caddy/` (if configured)
- **System logs**: `/var/log/`

### Performance Tuning

For better performance on larger deployments:

1. **Increase resource limits** in `docker-compose.production.yml`
2. **Tune PostgreSQL settings** based on your hardware
3. **Enable caching** in Django settings
4. **Configure CDN** for static files

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review service logs
3. Check the project documentation
4. Open an issue on the project repository

## 🔒 Security Best Practices

1. **Regular Updates**: Keep all components updated
2. **Strong Passwords**: Use unique, strong passwords for all services
3. **Backup Strategy**: Implement regular automated backups
4. **Monitor Logs**: Regularly review logs for suspicious activity
5. **Network Security**: Use firewalls and restrict access
6. **SSL/TLS**: Ensure all connections use HTTPS
7. **Database Security**: Keep database internal to Docker network 