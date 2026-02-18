# WireGuard VPN for QGIS Database Access

This WireGuard VPN allows QGIS Desktop users to connect directly to PostgreSQL instead of using WFS.

## Network Configuration

- **VPN Subnet:** 10.13.13.0/24
- **Server IP (inside VPN):** 10.13.13.1
- **PostgreSQL (via VPN):** 10.13.13.1:5432 (routed to db container)

## Adding a New Peer

### Option 1: Auto-generate via environment variable

1. Edit `.env` and add the peer name:
   ```
   WIREGUARD_PEERS=alice,bob,charlie
   ```

2. Restart the WireGuard container:
   ```bash
   docker-compose up -d wireguard
   ```

3. Find generated configs in `./wireguard/peer_<name>/`:
   - `peer_<name>.conf` - Client config file
   - `peer_<name>.png` - QR code for mobile

### Option 2: Manual peer management

1. Generate keys inside the container:
   ```bash
   docker exec -it qonnectra_wireguard_prod wg genkey | tee /config/peer_manual/privatekey | wg pubkey > /config/peer_manual/publickey
   ```

2. Add peer to server config (`./wireguard/wg_confs/wg0.conf`):
   ```ini
   [Peer]
   PublicKey = <peer-public-key>
   AllowedIPs = 10.13.13.X/32
   ```

3. Reload WireGuard:
   ```bash
   docker exec -it qonnectra_wireguard_prod wg syncconf wg0 <(wg-quick strip wg0)
   ```

## QGIS Connection Settings

Once connected via WireGuard, configure QGIS PostgreSQL connection:

| Setting | Value |
|---------|-------|
| Host | `db` or `10.13.13.1` |
| Port | `5432` |
| Database | *(from DB_NAME in .env)* |
| Username | *(from QGIS_DB_USER in .env)* |
| Password | *(from QGIS_DB_PASSWORD in .env)* |
| SSL Mode | `disable` |

**Note:** The QGIS_DB_USER has read-only access to the database views, same as WFS.

## Revoking Access

1. Remove the peer section from `./wireguard/wg_confs/wg0.conf`
2. Delete the peer folder from `./wireguard/peer_<name>/`
3. Reload WireGuard:
   ```bash
   docker exec -it qonnectra_wireguard_prod wg syncconf wg0 <(wg-quick strip wg0)
   ```

## Troubleshooting

### Check WireGuard status
```bash
docker exec -it qonnectra_wireguard_prod wg show
```

### View connected peers
```bash
docker exec -it qonnectra_wireguard_prod wg show wg0 latest-handshakes
```

### Check container logs
```bash
docker logs qonnectra_wireguard_prod
```

### Test PostgreSQL connectivity from VPN
From a connected client:
```bash
psql -h 10.13.13.1 -p 5432 -U qgis_user -d qonnectra_production
```
