#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/backup.conf"

env_val() { grep "^$1=" "$DEPLOY_DIR/.env" | head -1 | cut -d'=' -f2-; }
DB_USER="$(env_val DB_USER)"
DB_NAME="$(env_val DB_NAME)"

DATE=$(date +%Y-%m-%d)
TIMESTAMP_DIR="$BACKUP_DIR/$DATE"
START_TIME=$(date +%s)

mkdir -p "$TIMESTAMP_DIR" "$MEDIA_MIRROR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

cleanup_on_error() {
    log "ERROR: Backup failed at step: $CURRENT_STEP"
    exit 1
}
trap cleanup_on_error ERR

CURRENT_STEP="init"
log "=== Qonnectra Backup Started ==="

# 1. Database dump (pg_dump custom format, already compressed)
CURRENT_STEP="database"
log "Dumping PostgreSQL database..."
docker exec "$DB_CONTAINER" pg_dump \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --format=custom \
    --compress=6 > "$TIMESTAMP_DIR/database.dump"
log "Database dump: $(du -sh "$TIMESTAMP_DIR/database.dump" | cut -f1)"

# 2. Media files (incremental sync to local mirror)
CURRENT_STEP="media"
log "Syncing media volume to local mirror..."
docker run --rm \
    -v "$MEDIA_VOLUME":/source:ro \
    -v "$MEDIA_MIRROR":/target \
    alpine sh -c "cp -au /source/. /target/"
log "Media mirror: $(du -sh "$MEDIA_MIRROR" | cut -f1)"

# 3. QGIS project files
CURRENT_STEP="qgis-projects"
log "Archiving QGIS projects..."
tar czf "$TIMESTAMP_DIR/qgis-projects.tar.gz" -C "$DEPLOY_DIR/qgis/projects" .
log "QGIS projects: $(du -sh "$TIMESTAMP_DIR/qgis-projects.tar.gz" | cut -f1)"

# 4. QGIS data files
CURRENT_STEP="qgis-data"
log "Archiving QGIS data..."
tar czf "$TIMESTAMP_DIR/qgis-data.tar.gz" -C "$DEPLOY_DIR/qgis/data" .
log "QGIS data: $(du -sh "$TIMESTAMP_DIR/qgis-data.tar.gz" | cut -f1)"

# 5. Caddy TLS certificates
CURRENT_STEP="caddy"
log "Archiving Caddy certificates..."
docker run --rm \
    -v "$CADDY_VOLUME":/source:ro \
    -v "$TIMESTAMP_DIR":/backup \
    alpine tar czf /backup/caddy-data.tar.gz -C /source .
log "Caddy data: $(du -sh "$TIMESTAMP_DIR/caddy-data.tar.gz" | cut -f1)"

# 6. WireGuard configs
CURRENT_STEP="wireguard"
log "Archiving WireGuard configs..."
tar czf "$TIMESTAMP_DIR/wireguard.tar.gz" -C "$DEPLOY_DIR/wireguard" .
log "WireGuard: $(du -sh "$TIMESTAMP_DIR/wireguard.tar.gz" | cut -f1)"

# 7. Environment file
CURRENT_STEP="env"
cp "$DEPLOY_DIR/.env" "$TIMESTAMP_DIR/dot-env.backup"

# 8. Sync to OneDrive
CURRENT_STEP="rclone-archives"
log "Uploading archives to OneDrive..."
rclone copy "$TIMESTAMP_DIR" "$RCLONE_REMOTE/$DATE/" \
    --transfers 4 \
    --log-level NOTICE

CURRENT_STEP="rclone-media"
log "Syncing media mirror to OneDrive (incremental)..."
rclone sync "$MEDIA_MIRROR" "$RCLONE_REMOTE/media/" \
    --transfers 4 \
    --log-level NOTICE

# 9. Local retention cleanup
CURRENT_STEP="cleanup"
log "Cleaning up local backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -maxdepth 1 -type d -name "20*" -mtime +"$RETENTION_DAYS" -exec rm -rf {} \;

# Summary
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
log "=== Backup Complete (${DURATION}s) ==="
log "Local: $TIMESTAMP_DIR"
log "Remote: $RCLONE_REMOTE/$DATE/"
