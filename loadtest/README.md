# Load testing

An optional add-on that simulates a team using Qonnectra at once and records what the server does meanwhile, so load can be traced to endpoints, SQL statements and containers. It ships with Qonnectra but only runs when you switch it on.

- **Web UI** at `https://<APP_DOMAIN>/loadtest/`, for Qonnectra superusers only (it uses your app session).
- **Runner**: [Locust](https://locust.io)'s own UI for starting, watching and stopping a run, with extra live tabs for container CPU, Django query counts, top SQL and Postgres connections.
- **Dashboard**: setup checks, synthetic test data (seed and purge with one click), and a report per finished run, with before/after comparison.

## Switching it on

On the server, in `deployment/.env`:

```bash
COMPOSE_PROFILES=loadtest
```

Then:

```bash
cd deployment
docker compose up -d --build
```

This builds the `loadtest` image on top of the backend image and starts it. Caddy already routes `/loadtest` on the app domain to it. Open `https://<APP_DOMAIN>/loadtest/` and check that the **Checks** card is green:

| check                   | when it is not green                                                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Postgres statistics     | Off by default. **Switch on** turns on `pg_stat_statements` and the slow-query log with `ALTER SYSTEM` and restarts the db container (a few seconds of downtime). |
| Per-endpoint DB numbers | The backend image predates the Server-Timing middleware: rebuild it.                                                                                              |
| Container stats         | `/var/run/docker.sock` is not mounted. Runs work, but the report has no container numbers.                                                                        |
| App / Tile server       | The URLs come from `APP_DOMAIN` and `PUBLIC_TILE_SERVER_URL`, or the runner's Host and tiles URL fields. Without a tile server, no basemap.                       |

To switch it off again, first purge the test data if you seeded any (see below) and press **Switch off** on the Postgres statistics check, then remove the line from `.env` and run `docker compose rm -sf loadtest`. Postgres settings, test data and load-test users all come from the add-on, so nothing of it stays behind. What stays in Qonnectra itself does nothing without the add-on: the Server-Timing middleware only answers the load-test key, and Caddy's `/loadtest` route answers 502.

## A run

1. **Test data** (optional). Seed `loadtest-NN` projects on the dashboard. The presets set the total street trench length: tiny 2 km, small 50 km, medium 500 km (about 25k addresses), large 2000 km. Each project gets trenches, house connections, conduits, microducts, cables, fibers, nodes, addresses and areas. Real projects are never touched. If the server restores its database every night, the test data is gone the next morning; seed again.
2. **Check.** Open the runner, pick the **Check** profile and start. One user per persona runs one session, and the run stops by itself. Every request should be green.
3. **Measure.** Pick **Ramp**, set the number of users to the peak you want and start. Ramp adds 5 users every 2 minutes, which is how you find the point where latency tips over. Watch the Server, Django, Top SQL and Connections tabs.
4. **Read the report.** When the run ends, it appears under **Runs** on the dashboard. Tick two runs and press **Compare** to see the effect of a change.

Load-test users (`loadtest_NNN`, regular non-superusers with full access through their own role) are created automatically at the start of each run, one per virtual user. Their tokens are minted directly, because the login API is throttled.

### Profiles

| profile | what it does                                                                       |
| ------- | ---------------------------------------------------------------------------------- |
| Check   | one user per selected persona, one session each, then stop                         |
| Steady  | ramp up to _users_ at the spawn rate, then hold for the run time (10 min if empty) |
| Ramp    | +5 users every 2 minutes up to _users_, then stop                                  |
| Spike   | up to _users_ within 2 minutes, hold 5 minutes, stop                               |
| Default | Locust's own: _users_ at the spawn rate until you press Stop                       |

### Personas

Untick a persona in the runner to leave it out. The weights are shares of the running users.

| persona    | weight | one session                                                                                                                                                                                                                                                                                                                                 |
| ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MapUser    | 60     | SSR load of `/project/{id}/map`, layer styles, WMS token and sources, basemap style and TileJSON. Fits the project extent, then 10–30 gestures 1–4 s apart: pans, zooms and clicks. Every view change loads the app's 4 vector tile layers, WMS tiles of enabled layers in zoom range, and basemap tiles. A click opens the feature drawer. |
| SearchUser | 15     | 1–3 debounced `searchFeatures` calls (each fans out to 5 Django searches), then opens a result.                                                                                                                                                                                                                                             |
| SchemaUser | 15     | SSR load of the network schema (10 parallel Django calls), then node, cable and fiber details and conduit table pages.                                                                                                                                                                                                                      |
| EditUser   | 10     | Patches a trench, creates and deletes a conduit. Only ever in seeded `loadtest-*` projects; without any in the run it does a map session instead.                                                                                                                                                                                           |

How close this is to a browser:

- Tiles follow OpenLayers: 512 px XYZ grid, 1600×900 viewport, a per-source tile cache (so a pan only requests what came into view), and at most 16 tile requests in flight per user, like OpenLayers' tile queue.
- The basemap follows ol-mapbox-style: health check, style, TileJSON, then tiles up to the TileJSON's `maxzoom` and overzoomed beyond it. Labels use web fonts from a CDN, not the tile server, so there are no glyph requests.
- **Tile factor** (default 2) requests every new feature tile twice, because the app creates two tile sources per layer. Confirm it with the calibration below.
- Remote functions are called over SvelteKit's wire format. `tests/test_remote.py` checks it against SvelteKit's own code in `frontend/node_modules`.

### Options in the start form

Under **Custom parameters**:

| option      | default                  | effect                                                                                                    |
| ----------- | ------------------------ | --------------------------------------------------------------------------------------------------------- |
| projects    | `all`                    | `all`, `loadtest` (seeded only), or ids like `1,4`                                                        |
| cache       | `on`                     | `bypass` gives every feature tile request its own URL, so nginx's tile cache never hits; WMS stays cached |
| wms         | on                       | request WMS tiles of enabled layers                                                                       |
| basemap     | on                       | request basemap tiles                                                                                     |
| tile factor | `2`                      | requests per new feature tile and layer                                                                   |
| think       | `1`                      | multiplier on all pauses; `0.5` = users act twice as fast                                                 |
| viewport    | `1600x900`               | browser window                                                                                            |
| api url     | from `API_DOMAIN`        | Django API base                                                                                           |
| tiles url   | `PUBLIC_TILE_SERVER_URL` | tile server; empty skips the basemap                                                                      |

The **Host** field is the app URL (`https://<APP_DOMAIN>`).

## Reading a report

1. **Timeline.** Find the first minute where `tile p95` passes 1 s or `err %` passes 1 %. The `users` in that row is how many concurrent users this host carries. The CPU columns of the same row show which container was saturated: `db` near 700–800 % means Postgres, `backend` near 600 % means all 6 gunicorn workers are busy.
2. **Endpoints.** Sorted by total waiting time, which is where users lose time. `queries` per request exposes N+1 serializers. If `app ms` is much higher than `db ms`, the cost is in Python, not SQL. These numbers come from a `Server-Timing` header that Django only adds for requests carrying a key derived from `DJANGO_SECRET_KEY`, so normal users never get it.
3. **Top SQL.** Each statement's share of all DB time. Tile queries contain `ST_AsMVT`. QGIS Server shows up under its own role.
4. **Postgres.** Many short-lived connections point to no pooling (`CONN_MAX_AGE`). `LWLock`/`Lock` waits mean contention, `IO` waits mean the data doesn't fit in `shared_buffers`.
5. **nginx.** Tile cache hit ratio. Compare `urt p95` with `rt p95` to see whether time is spent in Django or in front of it.

Every run is a folder in `loadtest/runs/` on the server (`summary.json`, `report.md`, `report.html`, Locust's `locust.html`, and the nginx and Postgres logs of the run). Add a line to [RESULTS.md](RESULTS.md) for every run worth remembering.

## Load and the server itself

The load generator runs on the same host as Qonnectra. Its container is capped at 1.5 CPUs and shows up as `loadtest` in the container numbers, so you can tell it apart from the app. With think times, 1.5 CPUs carry a few hundred users.

## Calibration (once, and after map changes)

This drives a real Chromium through the app (open the map, pan ×5, zoom, click, search, network schema) and writes `loadtest/calibration.json` with the requests per endpoint and phase and the measured tile duplication per layer. Run it from a machine with a browser:

```bash
cd frontend
CALIBRATE_URL=https://app.example.com PUBLIC_API_URL=https://api.example.com/api/v1/ \
E2E_TEST_USERNAME=… E2E_TEST_PASSWORD=… \
npx playwright test --config tests/calibrate/playwright.config.js
```

Set the tile factor to the `factor` it prints for the vector layers. Compare its per-phase counts with a Check run's request counts. If they are more than about 20 % apart, adjust the personas.

## Development

The package is `qonnectra_loadtest/`:

| module                                              | what it holds                                                                 |
| --------------------------------------------------- | ----------------------------------------------------------------------------- |
| `locustfile.py`                                     | start-form fields, event hooks                                                |
| `personas/`, `client.py`, `tiles.py`, `remote.py`   | what the virtual users do and how they send it                                |
| `shapes.py`                                         | load profiles                                                                 |
| `run.py`, `recorder.py`, `postgres.py`, `docker.py` | run lifecycle and what is recorded                                            |
| `report.py`, `analysis.py`                          | the report                                                                    |
| `web.py`, `auth.py`, `jobs.py`, `static/`           | dashboard, access check, seed and purge jobs                                  |
| `seeding.py`, `accounts.py`, `__main__.py`          | the Django side: test data and users, run as `python -m qonnectra_loadtest …` |

Tests:

```bash
cd loadtest && uv run pytest     # Locust side, including full runs against a local stub of Qonnectra
cd backend && pytest             # also runs loadtest/tests_backend (seeding, users, timing key)
```

To run the UI locally against a dev setup, use the backend's environment plus Locust, and point it at your dev servers:

```bash
cd loadtest
API_URL=http://localhost:8000/api/v1/ PYTHONPATH=.:../backend \
uv run --project ../backend --with locust==2.46.7 locust -f qonnectra_loadtest/locustfile.py \
  --class-picker --web-base-path /loadtest/runner \
  --host http://localhost:5173 --api-url http://localhost:8000/api/v1/
```

Then sign in to the app at `localhost:5173` as a superuser and open `http://localhost:8089/loadtest/`. The session cookie carries over because both run on `localhost`. Seeding and the load-test users go to the database in `deployment/.env`.

## Not covered yet

- The global view (tiles without a project filter) and switching projects.
- Session refresh traffic (`refreshSession` every 7 minutes, one request per user). The load-test tokens are long-lived instead.
- Writes go straight to Django, not through SvelteKit remote commands.
- File uploads and WebDAV.
- WMS tiles only for projects that have WMS sources configured; seeded projects have none.
