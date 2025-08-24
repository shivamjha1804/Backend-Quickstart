#!/bin/bash

# test-api Deployment Script
# This script handles the deployment of the application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="production"
COMPOSE_FILE="docker-compose.prod.yml"
BUILD_IMAGE=true
RUN_MIGRATIONS=true
BACKUP_DB=true

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

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -e, --env ENVIRONMENT     Set environment (default: production)"
    echo "  -f, --file FILE          Docker compose file (default: docker-compose.prod.yml)"
    echo "  --no-build               Skip building Docker image"
    echo "  --no-migration           Skip running database migrations"
    echo "  --no-backup              Skip database backup"
    echo "  -h, --help               Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                       Deploy with default settings"
    echo "  $0 -e staging            Deploy to staging environment"
    echo "  $0 --no-build            Deploy without rebuilding image"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -f|--file)
            COMPOSE_FILE="$2"
            shift 2
            ;;
        --no-build)
            BUILD_IMAGE=false
            shift
            ;;
        --no-migration)
            RUN_MIGRATIONS=false
            shift
            ;;
        --no-backup)
            BACKUP_DB=false
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if docker-compose file exists
if [[ ! -f "$COMPOSE_FILE" ]]; then
    print_error "Docker compose file '$COMPOSE_FILE' not found."
    exit 1
fi

print_status "Starting deployment to $ENVIRONMENT environment..."

# Create backup if requested
if [[ "$BACKUP_DB" == true ]]; then
    print_status "Creating database backup..."
    mkdir -p backups
    BACKUP_FILE="backups/backup_$(date +%Y%m%d_%H%M%S).sql"
    
    
    
    
fi

# Build and deploy
if [[ "$BUILD_IMAGE" == true ]]; then
    print_status "Building Docker images..."
    docker-compose -f "$COMPOSE_FILE" build --no-cache
    print_success "Docker images built successfully"
fi

print_status "Starting services..."
docker-compose -f "$COMPOSE_FILE" up -d

# Wait for services to be healthy
print_status "Waiting for services to be healthy..."
sleep 30

# Check if app is healthy
if docker-compose -f "$COMPOSE_FILE" exec app wget --no-verbose --tries=1 --spider http://localhost:3000/health >/dev/null 2>&1; then
    print_success "Application is healthy"
else
    print_error "Application health check failed"
    docker-compose -f "$COMPOSE_FILE" logs app
    exit 1
fi

# Run migrations if requested
if [[ "$RUN_MIGRATIONS" == true ]]; then
    print_status "Running database migrations..."
    if docker-compose -f "$COMPOSE_FILE" exec app npm run migrate; then
        print_success "Database migrations completed"
    else
        print_error "Database migrations failed"
        exit 1
    fi
fi

# Show deployment summary
print_success "Deployment completed successfully!"
echo ""
echo "Services status:"
docker-compose -f "$COMPOSE_FILE" ps
echo ""
echo "Application URL: http://localhost:3000"
echo "Health check: http://localhost:3000/health"
echo "API Documentation: http://localhost:3000/docs"
echo ""
print_status "Deployment logs can be viewed with: docker-compose -f $COMPOSE_FILE logs -f"