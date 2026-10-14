# WireGuard VPN

This WireGuard VPN allows QGIS Desktop users to connect directly to PostgreSQL instead of using WFS, and it can restrict web hosts such as the admin panel to VPN users (see [VPN-only web hosts](#vpn-only-web-hosts)). The `wireguard` service is part of the production compose file only; run the commands below from `deployment/`.

## Network configuration

- VPN subnet: 10.13.13.0/24
- Server IP (inside the VPN): 10.13.13.1
- PostgreSQL (via VPN): 10.13.13.1:5432 (routed to the db container)
- HTTPS (via VPN): 10.13.13.1:443 (routed to the caddy container, only needed for VPN-only web hosts)
- DNS (via VPN): 10.13.13.1:53 (CoreDNS inside the container, pushed to peers as `DNS = 10.13.13.1`)

## Files the image regenerates

The linuxserver image rebuilds `wg_confs/wg0.conf` and every `peer_<name>/peer_<name>.conf` whenever `WIREGUARD_PEERS`, `WIREGUARD_SERVERURL`, `WIREGUARD_PORT` or another WireGuard variable in `docker-compose.yml` changes. Manual edits to these files are lost at that point. Keys and peer IPs are kept, so existing clients keep working.

| File                                  | Behaviour                                           | Edit it? |
| ------------------------------------- | --------------------------------------------------- | -------- |
| `wg_confs/wg0.conf`                   | Overwritten from the template on regeneration       | No       |
| `peer_<name>/peer_<name>.conf`        | Overwritten from the template on regeneration       | No       |
| `templates/server.conf`               | Created once if missing, then used for `wg0.conf`   | Yes      |
| `templates/peer.conf`                 | Created once if missing, then used for peer configs | Yes      |
| `coredns/Corefile`                    | Created once if missing, never overwritten          | Yes      |
| `server/`, `peer_<name>/` (key files) | Created once, kept                                  | No       |

## Initial setup

Before adding peers, set up port forwarding so PostgreSQL traffic reaches the database container.

### 1. Set WIREGUARD_PEERS in your .env file

```bash
WIREGUARD_PEERS=alice,bob,charlie
```

### 2. Start the WireGuard container to generate initial configs

```bash
docker-compose up -d wireguard
```

### 3. Add port forwarding to the server template

Edit `./wireguard/templates/server.conf`, not `wg_confs/wg0.conf` (see [Files the image regenerates](#files-the-image-regenerates)). Replace the PostUp/PostDown lines with the ones below. The DB and Caddy IPs are resolved with `getent` when the tunnel starts, so they stay correct when containers are recreated. The 443 rule is only needed for [VPN-only web hosts](#vpn-only-web-hosts):

```ini
[Interface]
Address = ${INTERFACE}.1
ListenPort = 51820
PrivateKey = $(cat /config/server/privatekey-server)
PostUp = DB_IP=\$(getent hosts db | awk '{print \$1}'); CADDY_IP=\$(getent hosts caddy | awk '{print \$1}'); iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth+ -j MASQUERADE; iptables -t nat -A PREROUTING -i %i -p tcp --dport 5432 -j DNAT --to-destination \$DB_IP:5432; iptables -t nat -A PREROUTING -i %i -p tcp --dport 443 -j DNAT --to-destination \$CADDY_IP:443
PostDown = DB_IP=\$(getent hosts db | awk '{print \$1}'); CADDY_IP=\$(getent hosts caddy | awk '{print \$1}'); iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth+ -j MASQUERADE; iptables -t nat -D PREROUTING -i %i -p tcp --dport 5432 -j DNAT --to-destination \$DB_IP:5432; iptables -t nat -D PREROUTING -i %i -p tcp --dport 443 -j DNAT --to-destination \$CADDY_IP:443
```

The image fills in the template with shell expansion when it generates `wg0.conf`. `${INTERFACE}` and `$(cat …privatekey-server)` are meant to expand then. Everything that must run later, when the tunnel starts, needs a backslash: `\$(getent …)`, `\$1`, `\$DB_IP`, `\$CADDY_IP`. Without it, the IPs are frozen at generation time and `awk` prints the whole line.

### 4. Regenerate wg0.conf and restart WireGuard

The template is only applied when `wg0.conf` is regenerated. Delete it so the image rebuilds it on the next start. Server and peer keys live in separate files and are kept:

```bash
rm ./wireguard/wg_confs/wg0.conf
docker restart qonnectra_wireguard_prod
```

Peers added manually to `wg0.conf` (see [Option 2](#option-2-manual-peer-management)) are lost by this step and have to be added again.

### 5. Verify the iptables rules

```bash
docker exec qonnectra_wireguard_prod iptables -t nat -L PREROUTING -n
```

You should see a DNAT rule pointing to the database IP (and one to the Caddy IP on port 443 if you added it).

## Adding a new peer

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
   - `peer_<name>.conf`: client config file
   - `peer_<name>.png`: QR code for mobile

### Option 2: Manual peer management

Peers added this way live only in `wg0.conf` and disappear the next time the image regenerates it, for example when `WIREGUARD_PEERS` changes. Prefer Option 1.

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

2. Add the peer to the server config (`./wireguard/wg_confs/wg0.conf`):

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

   If you saved it separately, it is in `./wireguard/server/publickey`.

5. Create a client config file (e.g., `peer_manual.conf`) for the user:

   ```ini
   [Interface]
   PrivateKey = <peer-private-key>
   Address = 10.13.13.X/32
   DNS = 10.13.13.1

   [Peer]
   PublicKey = <server-public-key>
   Endpoint = <your-server-ip-or-domain>:51820
   AllowedIPs = 10.13.13.0/24
   PersistentKeepalive = 25
   ```

   Replace:
   - `<peer-private-key>`: the private key generated in step 1
   - `10.13.13.X`: the IP used in step 2
   - `<server-public-key>`: the key from step 4
   - `<your-server-ip-or-domain>`: your server's public IP or domain

6. Send the `.conf` file to the user. They import it into their WireGuard client (available for Windows, macOS, Linux, iOS, Android).

## QGIS connection settings

Once connected via WireGuard, set up the PostgreSQL connection in QGIS:

| Setting  | Value                             |
| -------- | --------------------------------- |
| Host     | `10.13.13.1`                      |
| Port     | `5432`                            |
| Database | _(from DB_NAME in .env)_          |
| Username | _(from QGIS_DB_USER in .env)_     |
| Password | _(from QGIS_DB_PASSWORD in .env)_ |
| SSL Mode | `disable`                         |

This is the same limited database user QGIS Server uses for WFS: it can read and write data in the GIS tables but cannot change the schema, and it has no access to the user, session, token and permission tables (see [QGIS environment variables](../qgis/environment-variables.md)).

## Revoking access

For a peer from `WIREGUARD_PEERS`:

1. Remove the name from `WIREGUARD_PEERS` in `.env`
2. Delete the peer folder `./wireguard/peer_<name>/`
3. Recreate the container. The changed variable makes the image regenerate `wg0.conf` without the peer:

   ```bash
   docker-compose up -d wireguard
   ```

If you only delete the folder and keep the name in `WIREGUARD_PEERS`, the next regeneration creates new keys for that name.

For a manually added peer:

1. Remove the peer section from `./wireguard/wg_confs/wg0.conf`
2. Reload WireGuard (choose one method):

   ```bash
   # Method A: Hot reload without dropping connections
   docker exec -it qonnectra_wireguard_prod bash -c "wg syncconf wg0 <(wg-quick strip /config/wg_confs/wg0.conf)"

   # Method B: Restart container (simpler, drops active connections)
   docker restart qonnectra_wireguard_prod
   ```

## VPN-only web hosts

Some hosts, such as the admin panel, the WebDAV files host or an extra Grafana, should only be reachable over the VPN. This needs three parts:

1. **Caddy blocks requests that do not come from the VPN.** VPN traffic reaches Caddy through the WireGuard container, so its source is a private Docker address; requests from the internet are not.
2. **Port 443 on 10.13.13.1 is forwarded to Caddy.** This is the 443 DNAT rule from [step 3](#3-add-port-forwarding-to-the-server-template).
3. **The VPN's DNS resolves the hostnames to 10.13.13.1.** Clients then reach these hosts through the tunnel without editing their hosts file.

### Caddy

Put the block into the site's snippet folder, e.g. `caddy/extra/admin/vpn-only.caddy` (see the [deployment README](../README.md)). Named matchers only apply inside the site block that defines them, so every VPN-only site needs its own copy:

```caddy
@vpn_only not remote_ip private_ranges
route {
    respond @vpn_only 403
}
```

Caddy sorts directives in a fixed order, and `basic_auth` and `forward_auth` run before `respond`. A site that also uses `basic_auth` therefore shows a login prompt to the internet instead of a 403. For such a site, put the 403 and the authentication into the same `route` so the order is kept as written:

```caddy
@vpn_only not remote_ip private_ranges
route {
    respond @vpn_only 403
    basic_auth {
        # ...
    }
    reverse_proxy grafana:3000
}
```

Do not publish an AAAA record for VPN-only hosts. The Docker network has no IPv6, so Docker's userland proxy forwards IPv6 requests to Caddy from the bridge gateway, and that private source IP passes `private_ranges`.

### DNS

With `PEERDNS=auto`, the image runs CoreDNS on 10.13.13.1 and writes `DNS = 10.13.13.1` into every generated peer config. Add the VPN-only hostnames to `./wireguard/coredns/Corefile`:

```
. {
    hosts {
        10.13.13.1 admin.example.com files.example.com grafana.example.com
        fallthrough
    }
    loop
    errors
    health
    reload
    forward . /etc/resolv.conf
}
```

- `fallthrough` passes every other name on to `forward`, which uses the server's normal DNS.
- Keep `health`. The image uses it to check that CoreDNS is up.
- `reload` applies changes to the Corefile within about 30 seconds. Without it, run `docker restart qonnectra_wireguard_prod`.

The image never overwrites an existing Corefile, so the entries survive peer changes, restarts and image updates. When the VPN is off, clients fall back to their normal DNS and reach the public IP, where Caddy answers with 403.

Client notes:

- The WireGuard apps for Windows, macOS, iOS and Android apply the `DNS` line automatically. Linux with `wg-quick` needs `resolvconf` or `systemd-resolved`.
- A browser with its own "secure DNS" (DNS over HTTPS) setting forced on can bypass the VPN resolver.
- Remove old hosts file entries for these hostnames. They stay active when the VPN is off.

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

If ping works but PostgreSQL does not connect:

1. Check if the DNAT rule exists and points to the right IP:
   ```bash
   docker exec qonnectra_wireguard_prod iptables -t nat -L PREROUTING -n
   ```
2. Verify what IP `db` resolves to inside the WireGuard container:
   ```bash
   docker exec qonnectra_wireguard_prod getent hosts db
   ```
3. If the DNAT rule is missing or wrong, restart the WireGuard container. It re-resolves `db` on startup:
   ```bash
   docker restart qonnectra_wireguard_prod
   ```
4. If the rule is still missing, check that `./wireguard/templates/server.conf` contains it. A regenerated `wg0.conf` only contains rules from the template.

### VPN-only host does not load

From a connected client, check that the VPN DNS answers with the VPN IP:

```bash
dig +short admin.example.com @10.13.13.1   # expected: 10.13.13.1
```

From a machine without VPN, check that the public IP blocks the host. `--resolve` skips local DNS and hosts file entries:

```bash
curl -4 -sI --resolve admin.example.com:443:<public-ip> https://admin.example.com | head -1   # expected: HTTP/2 403
```
