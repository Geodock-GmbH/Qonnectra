# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 1.x     | ✅ Active support |
| < 1.0   | ❌ No longer supported |

Only the latest release in the `1.x` line receives security fixes. We recommend always running the most recent release.

---

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues, pull requests, or discussions.**

Send a confidential report by email to:

**mail@geodock.de**

Include as much of the following as possible to help us triage and fix the issue quickly:

- A description of the vulnerability and its potential impact
- The affected component (backend API, frontend, deployment config, database, WireGuard, WebDAV, etc.)
- Steps to reproduce or a proof-of-concept
- The version or commit hash you tested against
- Any suggested fix, if you have one

---

## Scope

The following are in scope for security reports:

- **Backend API** — Django REST Framework endpoints, authentication, authorization, input validation
- **Frontend** — SvelteKit application, client-side token handling, exposed secrets
- **Deployment configuration** — Docker Compose files, Caddy/Nginx config, environment variable exposure
- **Database** — PostgreSQL/PostGIS access controls, SQL injection, privilege escalation
- **Authentication** — JWT token handling, HTTP-only cookie security, session management
- **WireGuard VPN** — Configuration exposure, peer authentication
- **WebDAV** — File storage access controls, path traversal
- **QGIS Server** — WMS/WFS endpoint authorization, forward authentication bypass
- **REST API** — Broken object-level authorization, mass assignment, insecure direct object references
- **Vector tile server** — TileServer-GL configuration exposure

The following are **out of scope**:

- Vulnerabilities in third-party dependencies that have no available fix (please report these upstream)
- Denial-of-service attacks that require exceptional resources
- Social engineering of project maintainers
- Physical attacks

---

## Security architecture overview

Understanding the stack helps contextualize reports:

**Authentication & sessions**
Qonnectra uses JWT-based authentication with HTTP-only cookies. Tokens are not stored in `localStorage`. CSRF protection is active for all state-changing endpoints. Cross-subdomain cookie sharing is controlled via `COOKIE_DOMAIN` and `USE_COOKIE_DOMAIN_MIDDLEWARE`.

**Network perimeter**
In production, all external traffic is routed through Caddy (reverse proxy with automatic HTTPS via Let's Encrypt). The PostgreSQL database is not exposed externally. The WireGuard VPN provides authenticated encrypted access to the database from QGIS Desktop clients.

**QGIS Server access**
QGIS Server endpoints are protected via Django forward authentication. The `?MAP=` parameter is required and restricted to the `qgis/projects/` directory.

**Secrets management**
Secrets (database passwords, `DJANGO_SECRET_KEY`, `FIELD_ENCRYPTION_KEY`) are passed via environment variables from a `.env` file that must not be committed to version control. Sensitive database fields (e.g., WMS passwords) are encrypted at rest using `FIELD_ENCRYPTION_KEY`.

**Database users**
Two database users exist: the main application user with full privileges, and a restricted QGIS user (`QGIS_DB_USER`) with limited read-write access for WFS/WMS operations.

---

## Known security considerations for operators

When deploying Qonnectra, please ensure the following:

- **`DEBUG=False` in production** — Django debug mode exposes stack traces and internal configuration.
- **Strong `DJANGO_SECRET_KEY`** — Must be unique per deployment and never shared or committed to source control.
- **`FIELD_ENCRYPTION_KEY` set** — Required to encrypt sensitive fields at rest (e.g., stored WMS credentials).
- **`.env` files not committed** — The `deployment/.env` file contains credentials and must remain outside version control.
- **HTTPS enforced** — Caddy handles this automatically in production. Do not run without TLS.
- **Ports not exposed unnecessarily** — In production, PostgreSQL (5432) should not be reachable from the internet. WireGuard (51820/udp) should be firewalled to known IPs where possible.
- **WireGuard peer configurations secured** — Private keys in WireGuard peer configs grant full VPN access to the internal network.
- **QGIS project files reviewed** — Files placed in `qgis/projects/` are served via QGIS Server. Ensure they do not expose unintended database connections or data.
- **TileServer-GL config reviewed** — `tiles/config.json` and associated mbtiles are served publicly. Do not include sensitive data in tile sources.
- **Regular updates** — Keep all Docker images, Python packages (`uv sync`), and npm packages (`npm install`) up to date.

---

## Dependency vulnerability management

Qonnectra's backend dependencies are managed with `uv` (Python) and the frontend with `npm`.

To audit locally:

```bash
# Backend
cd backend
uv sync --dev
pip-audit  # or: uv run pip-audit

# Frontend
cd frontend
npm audit
```

Critical and high CVEs (CVSS ≥ 7.0) in shipped dependencies will be treated as security issues and addressed with priority.

---

## Disclosure policy

We follow a **coordinated disclosure** process:

1. Reporter submits the vulnerability privately.
2. We investigate and develop a fix.
3. We release a patched version and notify the reporter.
4. Reporter may publish details after the fix is publicly available.

We ask that reporters give us reasonable time to fix the issue before public disclosure.

---

## Contact

Security reports: **mail@geodock.de**  
General questions: [GitHub Discussions](https://github.com/Geodock-GmbH/Qonnectra/discussions)  
Project maintainer: [Geodock GmbH](https://github.com/Geodock-GmbH)
