# WireGuard VPN for QGIS Database Access

This WireGuard VPN allows QGIS Desktop users to connect directly to PostgreSQL instead of using WFS.

## Network Configuration

- **VPN Subnet:** 10.13.13.0/24
- **Server IP (inside VPN):** 10.13.13.1
- **PostgreSQL (via VPN):** 10.13.13.1:5432 (routed to db container)

## Initial Setup

Before adding peers, you must configure port forwarding to route PostgreSQL traffic to the database container.

### 1. Set WIREGUARD_PEERS in your .env file

```bash
WIREGUARD_PEERS=alice,bob,charlie
```

### 2. Start the WireGuard container to generate initial configs

```bash
docker-compose up -d wireguard
```

### 3. Add port forwarding to wg0.conf

Edit `./wireguard/wg_confs/wg0.conf` and modify the PostUp/PostDown lines to include the DNAT rule. The DB IP is resolved dynamically at startup using `getent`, so it stays correct even if containers are recreated:

```ini
[Interface]
Address = 10.13.13.1
ListenPort = 51820
PrivateKey = <existing-key>
PostUp = DB_IP=$(getent hosts db | awk '{print $1}'); iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth+ -j MASQUERADE; iptables -t nat -A PREROUTING -i %i -p tcp --dport 5432 -j DNAT --to-destination $DB_IP:5432
PostDown = DB_IP=$(getent hosts db | awk '{print $1}'); iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth+ -j MASQUERADE; iptables -t nat -D PREROUTING -i %i -p tcp --dport 5432 -j DNAT --to-destination $DB_IP:5432
```

### 5. Restart WireGuard to apply the rules

```bash
docker restart qonnectra_wireguard_prod
```

### 6. Verify the iptables rule

```bash
docker exec qonnectra_wireguard_prod iptables -t nat -L PREROUTING -n
```

You should see a DNAT rule pointing to the database IP.

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

1. Generate keys (choose one method):

   **Method A: Save to mounted volume (recommended)**

   ```bash
   mkdir -p ./wireguard/peer_manual
   docker exec qonnectra_wireguard_prod wg genkey | tee ./wireguard/peer_manual/privatekey | wg pubkey > ./wireguard/peer_manual/publickey
   ```

   **Method B: Print keys to terminal**

   ```bash
   docker exec qonnectra_wireguard_prod sh -c "wg genkey | tee /dev/stderr | wg pubkey"
   ```

   This prints the private key first (stderr), then the public key (stdout).

2. Add peer to server config (`./wireguard/wg_confs/wg0.conf`):

   ```ini
   [Peer]
   PublicKey = <peer-public-key>
   AllowedIPs = 10.13.13.X/32
   ```

3. Reload WireGuard (choose one method):

   ```bash
   # Method A: Hot reload without dropping connections
   docker exec -it qonnectra_wireguard_prod bash -c "wg syncconf wg0 <(wg-quick strip /config/wg_confs/wg0.conf)"

   # Method B: Restart container (simpler, drops active connections)
   docker restart qonnectra_wireguard_prod
   ```

4. Get the server's public key:

   ```bash
   cat ./wireguard/wg_confs/wg0.conf | grep -A1 "\[Interface\]" | grep PrivateKey
   # Then derive public key from private key:
   echo "<server-private-key>" | docker exec -i qonnectra_wireguard_prod wg pubkey
   ```

   Or if you saved it separately, check `./wireguard/server/publickey`.

5. Create a client config file (e.g., `peer_manual.conf`) for the user:

   ```ini
   [Interface]
   PrivateKey = <peer-private-key>
   Address = 10.13.13.X/32

   [Peer]
   PublicKey = <server-public-key>
   Endpoint = <your-server-ip-or-domain>:51820
   AllowedIPs = 10.13.13.0/24
   PersistentKeepalive = 25
   ```

   Replace:
   - `<peer-private-key>` - The private key generated in step 1
   - `10.13.13.X` - Same IP used in step 2
   - `<server-public-key>` - From step 4
   - `<your-server-ip-or-domain>` - Your server's public IP or domain

6. Send the `.conf` file to the user. They import it into their WireGuard client (available for Windows, macOS, Linux, iOS, Android).

## QGIS Connection Settings

Once connected via WireGuard, configure QGIS PostgreSQL connection:

| Setting  | Value                             |
| -------- | --------------------------------- |
| Host     | `10.13.13.1`                      |
| Port     | `5432`                            |
| Database | _(from DB_NAME in .env)_          |
| Username | _(from QGIS_DB_USER in .env)_     |
| Password | _(from QGIS_DB_PASSWORD in .env)_ |
| SSL Mode | `disable`                         |

**Note:** The QGIS_DB_USER has read-only access to the database views, same as WFS.

## Revoking Access

1. Remove the peer section from `./wireguard/wg_confs/wg0.conf`
2. Delete the peer folder from `./wireguard/peer_<name>/`
3. Reload WireGuard (choose one method):

   ```bash
   # Method A: Hot reload without dropping connections
   docker exec -it qonnectra_wireguard_prod bash -c "wg syncconf wg0 <(wg-quick strip /config/wg_confs/wg0.conf)"

   # Method B: Restart container (simpler, drops active connections)
   docker restart qonnectra_wireguard_prod
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

### PostgreSQL connection refused

If ping works but PostgreSQL doesn't connect:

1. Check if the DNAT rule exists and points to the right IP:
   ```bash
   docker exec qonnectra_wireguard_prod iptables -t nat -L PREROUTING -n
   ```
2. Verify what IP `db` resolves to inside the WireGuard container:
   ```bash
   docker exec qonnectra_wireguard_prod getent hosts db
   ```
3. If the DNAT rule is missing or wrong, restart the WireGuard container — it will re-resolve `db` automatically:
   ```bash
   docker restart qonnectra_wireguard_prod
   ```
