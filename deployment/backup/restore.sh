#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/backup.conf"
source "$DEPLOY_DIR/.env"

usage() {
    echo "Usage: $0 <backup-date>"
    echo "  backup-date: YYYY-MM-DD (e.g. 2026-05-04)"
    echo ""
    echo "Restores from local backup or downloads from OneDrive if not found locally."
    echo ""
    echo "Options:"
    echo "  --db-only     Restore only the database"
    echo "  --media-only  Restore only media files"
    echo "  --list        List available backups (local and remote)"
    exit 1
}

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

list_backups() {
    echo "=== Local Backups ==="
    ls -d "$BACKUP_DIR"/20* 2>/dev/null | sort -r || echo "  (none)"
    echo ""
    echo "=== Remote Backups (OneDrive) ==="
    rclone lsd "$RCLONE_REMOTE/" 2>/dev/null | awk '{print "  " $NF}' || echo "  (cannot reach remote)"
}

if [[ "${1:-}" == "--list" ]]; then
    list_backups
    exit 0
fi

if [[ $# -lt 1 ]]; then
    usage
fi

BACKUP_DATE="$1"
DB_ONLY=false
MEDIA_ONLY=false

for arg in "$@"; do
    case $arg in
        --db-only) DB_ONLY=true ;;
        --media-only) MEDIA_ONLY=true ;;
    esac
done

RESTORE_DIR="$BACKUP_DIR/$BACKUP_DATE"

# Download from OneDrive if not available locally
if [[ ! -d "$RESTORE_DIR" ]]; then
    log "Backup not found locally. Downloading from OneDrive..."
    mkdir -p "$RESTORE_DIR"
    rclone copy "$RCLONE_REMOTE/$BACKUP_DATE/" "$RESTORE_DIR/" --progress
fi

if [[ ! -f "$RESTORE_DIR/database.dump" ]]; then
    echo "ERROR: No valid backup found for date $BACKUP_DATE"
    exit 1
fi

echo ""
echo "=== Qonnectra Restore ==="
echo "Backup date: $BACKUP_DATE"
echo "Source: $RESTORE_DIR"
echo ""
echo "This will:"
if [[ "$DB_ONLY" == true ]]; then
    echo "  - Restore the PostgreSQL database (destructive!)"
elif [[ "$MEDIA_ONLY" == true ]]; then
    echo "  - Restore media files from OneDrive"
else
    echo "  - Stop application services"
    echo "  - Restore the PostgreSQL database (destructive!)"
    echo "  - Restore media files"
    echo "  - Restore QGIS projects and data"
    echo "  - Restore WireGuard configs"
    echo "  - Restart all services"
fi
echo ""
read -p "Continue? [y/N] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

# Stop application services (keep DB running)
if [[ "$DB_ONLY" == false && "$MEDIA_ONLY" == false ]]; then
    log "Stopping application services..."
    cd "$DEPLOY_DIR"
    docker compose stop backend backend-wms frontend nginx qgis-server pg-error-parser tileserver caddy
fi

# Restore database
if [[ "$MEDIA_ONLY" == false ]]; then
    log "Restoring database..."
    docker exec -i "$DB_CONTAINER" pg_restore \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --clean \
        --if-exists \
        --no-owner \
        --single-transaction < "$RESTORE_DIR/database.dump" || {
        log "WARNING: pg_restore reported errors (common for --clean on missing objects). Checking DB..."
        docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME"
    }
    log "Database restored."
fi

# Restore media
if [[ "$DB_ONLY" == false ]]; then
    log "Restoring media files from OneDrive mirror..."
    rclone sync "$RCLONE_REMOTE/media/" "$MEDIA_MIRROR/" --progress
    docker run --rm \
        -v "$MEDIA_VOLUME":/target \
        -v "$MEDIA_MIRROR":/source:ro \
        alpine sh -c "rm -rf /target/* && cp -a /source/. /target/"
    log "Media restored."
fi

# Restore remaining files (full restore only)
if [[ "$DB_ONLY" == false && "$MEDIA_ONLY" == false ]]; then
    if [[ -f "$RESTORE_DIR/qgis-projects.tar.gz" ]]; then
        log "Restoring QGIS projects..."
        tar xzf "$RESTORE_DIR/qgis-projects.tar.gz" -C "$DEPLOY_DIR/qgis/projects/"
    fi

    if [[ -f "$RESTORE_DIR/qgis-data.tar.gz" ]]; then
        log "Restoring QGIS data..."
        tar xzf "$RESTORE_DIR/qgis-data.tar.gz" -C "$DEPLOY_DIR/qgis/data/"
    fi

    if [[ -f "$RESTORE_DIR/caddy-data.tar.gz" ]]; then
        log "Restoring Caddy certificates..."
        docker run --rm \
            -v "$CADDY_VOLUME":/target \
            -v "$RESTORE_DIR":/backup:ro \
            alpine sh -c "rm -rf /target/* && tar xzf /backup/caddy-data.tar.gz -C /target"
    fi

    if [[ -f "$RESTORE_DIR/wireguard.tar.gz" ]]; then
        log "Restoring WireGuard configs..."
        tar xzf "$RESTORE_DIR/wireguard.tar.gz" -C "$DEPLOY_DIR/wireguard/"
    fi

    if [[ -f "$RESTORE_DIR/dot-env.backup" ]]; then
        log "Environment file available at: $RESTORE_DIR/dot-env.backup"
        log "Compare with current: diff $RESTORE_DIR/dot-env.backup $DEPLOY_DIR/.env"
    fi

    # Restart services
    log "Restarting all services..."
    cd "$DEPLOY_DIR"
    docker compose up -d
fi

log "=== Restore Complete ==="
log "Verify: docker compose ps"
