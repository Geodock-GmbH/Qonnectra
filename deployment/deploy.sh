#!/bin/bash

# Krit-GIS Production Deployment Script
# This script helps deploy the Krit-GIS stack to a production server

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        print_error "This script should not be run as root for security reasons."
        print_error "Please run as a regular user with sudo privileges."
        exit 1
    fi
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check for Docker
    if ! command_exists docker; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check for Docker Compose
    if ! command_exists docker-compose; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check Docker daemon is running
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker daemon is not running. Please start Docker first."
        exit 1
    fi
    
    print_success "All prerequisites satisfied."
}

# Function to setup environment
setup_environment() {
    print_status "Setting up environment..."
    
    if [[ ! -f .env ]]; then
        if [[ -f .env.production.template ]]; then
            print_warning ".env file not found. Copying from template..."
            cp .env.production.template .env
            print_warning "Please edit .env file with your production values before continuing."
            print_warning "Key items to change:"
            echo "  - All passwords and secret keys"
            echo "  - Domain names"
            echo "  - Email addresses"
            echo "  - DEBUG=False"
            echo ""
            read -p "Press Enter when you have configured .env file..."
        else
            print_error ".env.production.template not found. Cannot create .env file."
            exit 1
        fi
    fi
    
    # Source the .env file
    set -a  # automatically export all variables
    source .env
    set +a
    
    # Validate critical environment variables
    if [[ -z "$DOMAIN_NAME" || "$DOMAIN_NAME" == "your-domain.com" ]]; then
        print_error "DOMAIN_NAME not configured in .env file"
        exit 1
    fi
    
    if [[ -z "$DJANGO_SECRET_KEY" || "$DJANGO_SECRET_KEY" == "CHANGE_THIS_TO_A_STRONG_SECRET_KEY" ]]; then
        print_error "DJANGO_SECRET_KEY not configured in .env file"
        exit 1
    fi
    
    if [[ "$DEBUG" == "True" ]]; then
        print_warning "DEBUG is set to True. This should be False in production."
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    print_success "Environment configuration validated."
}

# Function to setup directories
setup_directories() {
    print_status "Setting up directories..."
    
    # Create log directory if it doesn't exist
    mkdir -p logs
    
    # Create backup directory
    mkdir -p backups
    
    # Set proper permissions
    chmod 755 logs backups
    
    print_success "Directories created."
}

# Function to pull latest images
pull_images() {
    print_status "Pulling latest Docker images..."
    docker-compose -f docker-compose.production.yml pull
    print_success "Images pulled successfully."
}

# Function to build custom images
build_images() {
    print_status "Building custom images..."
    docker-compose -f docker-compose.production.yml build --no-cache
    print_success "Images built successfully."
}

# Function to create backup
create_backup() {
    if docker volume ls | grep -q krit_gis; then
        print_status "Creating backup of existing data..."
        timestamp=$(date +"%Y%m%d_%H%M%S")
        
        # Backup database
        docker run --rm \
            -v krit_gis_network_prod_postgres_data:/source:ro \
            -v "$(pwd)/backups:/backup" \
            alpine:latest \
            tar czf "/backup/postgres_backup_${timestamp}.tar.gz" -C /source .
        
        # Backup other volumes if they exist
        for volume in geoserver_data nextcloud_data; do
            if docker volume ls | grep -q "${volume}"; then
                docker run --rm \
                    -v "krit_gis_network_prod_${volume}:/source:ro" \
                    -v "$(pwd)/backups:/backup" \
                    alpine:latest \
                    tar czf "/backup/${volume}_backup_${timestamp}.tar.gz" -C /source .
            fi
        done
        
        print_success "Backup created in backups/ directory"
    else
        print_status "No existing data found, skipping backup."
    fi
}

# Function to deploy stack
deploy_stack() {
    print_status "Deploying production stack..."
    
    # Stop any existing containers
    docker-compose -f docker-compose.production.yml down || true
    
    # Deploy the stack
    docker-compose -f docker-compose.production.yml up -d
    
    print_success "Stack deployed successfully."
}

# Function to wait for services
wait_for_services() {
    print_status "Waiting for services to become healthy..."
    
    # Wait for database
    print_status "Waiting for database..."
    timeout=300
    elapsed=0
    while ! docker-compose -f docker-compose.production.yml exec -T db pg_isready -U "${DB_USER}" -d "${DB_NAME}" >/dev/null 2>&1; do
        if [[ $elapsed -ge $timeout ]]; then
            print_error "Database failed to start within $timeout seconds"
            exit 1
        fi
        sleep 5
        elapsed=$((elapsed + 5))
        echo -n "."
    done
    echo
    print_success "Database is ready."
    
    # Wait for backend
    print_status "Waiting for backend..."
    timeout=300
    elapsed=0
    while ! docker-compose -f docker-compose.production.yml exec -T backend curl -f http://localhost:8000/admin/ >/dev/null 2>&1; do
        if [[ $elapsed -ge $timeout ]]; then
            print_error "Backend failed to start within $timeout seconds"
            exit 1
        fi
        sleep 10
        elapsed=$((elapsed + 10))
        echo -n "."
    done
    echo
    print_success "Backend is ready."
    
    print_success "All services are healthy."
}

# Function to show status
show_status() {
    print_status "Deployment Status:"
    echo
    docker-compose -f docker-compose.production.yml ps
    echo
    print_status "Your application should be available at:"
    echo "  Frontend: https://${APP_DOMAIN}"
    echo "  API: https://${API_DOMAIN}"
    echo "  Nextcloud: https://${CLOUD_DOMAIN}"
    echo "  GeoServer: https://${GEOSERVER_DOMAIN}"
    echo "  QGIS Server: https://${QGIS_DOMAIN}"
    echo
    print_status "Admin access:"
    echo "  Django Admin: https://${API_DOMAIN}/admin/"
    echo "  GeoServer: https://${GEOSERVER_DOMAIN}/geoserver/"
    echo "  Nextcloud: https://${CLOUD_DOMAIN}/"
}

# Function to show logs
show_logs() {
    print_status "Recent logs:"
    docker-compose -f docker-compose.production.yml logs --tail=50
}

# Main deployment function
deploy() {
    print_status "Starting Krit-GIS production deployment..."
    echo
    
    check_root
    check_prerequisites
    setup_environment
    setup_directories
    
    # Ask for confirmation
    echo -e "${YELLOW}About to deploy to production with the following settings:${NC}"
    echo "  Domain: ${DOMAIN_NAME}"
    echo "  App Domain: ${APP_DOMAIN}"
    echo "  API Domain: ${API_DOMAIN}"
    echo "  Debug Mode: ${DEBUG}"
    echo
    read -p "Continue with deployment? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Deployment cancelled."
        exit 0
    fi
    
    create_backup
    pull_images
    build_images
    deploy_stack
    wait_for_services
    show_status
    
    print_success "Deployment completed successfully!"
    echo
    print_status "Next steps:"
    echo "1. Configure your DNS to point your domains to this server"
    echo "2. Check the logs with: docker-compose -f docker-compose.production.yml logs"
    echo "3. Monitor the services with: docker-compose -f docker-compose.production.yml ps"
    echo "4. Access your application at the URLs shown above"
}

# Function to stop stack
stop() {
    print_status "Stopping production stack..."
    docker-compose -f docker-compose.production.yml down
    print_success "Stack stopped."
}

# Function to restart stack
restart() {
    print_status "Restarting production stack..."
    docker-compose -f docker-compose.production.yml restart
    print_success "Stack restarted."
}

# Function to update stack
update() {
    print_status "Updating production stack..."
    create_backup
    pull_images
    build_images
    docker-compose -f docker-compose.production.yml up -d
    wait_for_services
    show_status
    print_success "Stack updated successfully!"
}

# Main script logic
case "${1:-deploy}" in
    deploy)
        deploy
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    update)
        update
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    backup)
        create_backup
        ;;
    *)
        echo "Usage: $0 {deploy|stop|restart|update|status|logs|backup}"
        echo "  deploy  - Full deployment (default)"
        echo "  stop    - Stop all services"
        echo "  restart - Restart all services"
        echo "  update  - Update and restart services"
        echo "  status  - Show service status"
        echo "  logs    - Show recent logs"
        echo "  backup  - Create backup of data"
        exit 1
        ;;
esac 