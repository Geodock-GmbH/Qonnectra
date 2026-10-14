# Load testing

This simulates a team using Qonnectra at the same time and records what the server does meanwhile, so DB load can be traced to endpoints and SQL statements.

- **k6** drives the load. It runs in Docker, on the VPS or anywhere else.
- **Personas** model real use: map users panning and clicking, people searching, planners in the network schema, and optionally editors.
- **`collect/run.sh`** records container CPU/RAM, Postgres connections and wait events, `pg_stat_statements`, nginx cache status and timings, and slow-query log lines. Then it writes `runs/<run>/report.md`.
- **`collect/report.py --compare`** puts two runs side by side, so every optimisation is a before/after measurement.

## What it simulates

| persona | share             | what one session does                                                                                                                                                                                                                                                                                                                                                               |
| ------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| map     | 60–65 %           | SSR load of `/project/{id}/map`, layer style attributes, WMS token + sources. Fits the project extent, then 10–30 gestures 1–4 s apart: pans, zooms and clicks. A click runs `getFeatureDetails` + `getConduitsInTrench`, and sometimes the cable and profile tabs. Vector tiles are fetched for all 4 layers, plus WMS tiles when sources are configured and the zoom is in range. |
| search  | 15–17 %           | 1–3 debounced `searchFeatures` calls (each fans out to 5 Django searches), then opens a result                                                                                                                                                                                                                                                                                      |
| schema  | 15–18 %           | SSR load of the network schema (10 parallel Django calls), then node/cable/fiber details and conduit table pages                                                                                                                                                                                                                                                                    |
| edit    | 10 % (`WRITES=1`) | PATCH a trench, create and delete a conduit. Only in `loadtest-*` projects.                                                                                                                                                                                                                                                                                                         |

Notes on how close this is to a real browser:

- Tiles are computed like OpenLayers does it: 512 px XYZ grid, 1600×900 viewport, a per-source tile cache. A pan only requests the tiles that came into view.
- `TILE_FACTOR` (default 2) models every vector tile being requested twice. The app creates two tile sources per layer (`MapState.initializeLayers` and `createXLayer`). Calibrate (see below) to confirm the real factor.
- Each virtual user has its own load-test identity, a regular non-superuser, so permission checks run as for real users.
- Remote functions are called over SvelteKit's real wire format (`lib/remote.js`). `npm test` checks that format against SvelteKit's own code.

## One-time setup on the VPS

```bash
cd /path/to/qonnectra && git pull
cd deployment

# 1. Postgres: pg_stat_statements, auto_explain and the slow-query log need a restart
docker compose up -d db

# 2. Per-endpoint query counts: set PERF_HEADERS=1 in deployment/.env, then
docker compose up -d --build backend backend-wms
# 3. nginx log format with request and upstream times
docker compose up -d nginx

# 4. Load-test users. The tokens are valid for 4 h; rerun when they expire.
docker exec qonnectra_backend_prod python manage.py create_loadtest_users --count 60 --hours 4 > ../loadtest/tokens.json

# 5. Optional synthetic data in loadtest-01..03 (medium ≈ 500 km street trench, ~25k addresses)
docker exec qonnectra_backend_prod python manage.py seed_load_data --preset medium
```

`PERF_HEADERS=1` costs a few microseconds per SQL statement. Turn it off again when you are not measuring.

## Running

```bash
loadtest/collect/run.sh check -e PROJECTS=loadtest     # 1 user per persona, checks that everything answers
loadtest/collect/run.sh baseline                       # 10 users for 10 min
loadtest/collect/run.sh ramp -e MAX_USERS=80           # +5 users every 2 min: finds the knee
loadtest/collect/run.sh ramp -e CACHE=bypass           # same, but every tile misses the nginx cache
loadtest/collect/run.sh long -e MAX_USERS=60           # 30 users for 30 min: leaks, memory growth
```

Everything after the profile goes to `k6 run`. k6 runs in a container capped at `K6_CPUS=1.5`. Its CPU shows up as `k6` in the container table, so you can tell it apart from the app.

To keep the VPS free of k6 entirely, start the sampling on the VPS for the length of the test, and run k6 from another machine at the same time:

```bash
# on the VPS (a ramp to 80 users takes 32 min)
EXTERNAL_K6=1950 loadtest/collect/run.sh ramp
# on the other machine, with the same tokens.json
cd loadtest/k6 && docker run --rm -v "$PWD/..:/loadtest" -w /loadtest/k6 -e SUMMARY=/loadtest/summary.json \
  grafana/k6:1.2.0 run -e PROFILE=ramp -e MAX_USERS=80 --out csv=/loadtest/k6.csv.gz main.js
```

Afterwards, copy `summary.json` and `k6.csv.gz` into the run directory and rerun `python3 loadtest/collect/report.py <run>`.

| variable              | default                | effect                                                                             |
| --------------------- | ---------------------- | ---------------------------------------------------------------------------------- |
| `PROFILE`             | `check`                | `check`, `baseline`, `ramp`, `long`, `stress`                                      |
| `PROJECTS`            | `all`                  | `all`, `loadtest` (seeded only), or ids like `1,4`                                 |
| `MAX_USERS`           | `60`                   | peak users for ramp/stress (long runs half)                                        |
| `CACHE`               | `on`                   | `bypass` adds a random query parameter to every tile, to measure raw tile SQL cost |
| `WMS`                 | `1`                    | `0` skips WMS tiles (they go to QGIS or external servers)                          |
| `WRITES`              | `0`                    | `1` adds the edit persona                                                          |
| `TILE_FACTOR`         | `2`                    | requests per new tile per layer; set it from the calibration                       |
| `THINK`               | `1`                    | think-time multiplier; `0.5` = users act twice as fast                             |
| `VIEW_W` / `VIEW_H`   | `1600` / `900`         | browser viewport                                                                   |
| `APP_URL` / `API_URL` | from `deployment/.env` | targets                                                                            |

## Calibration (once, and after map changes)

This records a real Chromium session (open map, pan ×5, zoom, click, search, network schema). It writes `loadtest/calibration.json`, which contains:

- requests per endpoint and phase
- the measured tile duplication factor per layer
- whether the remote-function ids k6 uses match the app

Run it from a machine with a browser:

```bash
cd frontend
CALIBRATE_URL=https://app.geodock.de PUBLIC_API_URL=https://api.geodock.de/api/v1/ \
E2E_TEST_USERNAME=… E2E_TEST_PASSWORD=… \
npx playwright test --config tests/calibrate/playwright.config.js
```

Set `TILE_FACTOR` to the `factor` it prints for the vector layers. Compare its per-phase counts with a check run's endpoint counts. If they're more than about 20 % apart, adjust the scenario.

## Reading report.md

1. **Timeline.** Find the first minute where `tile p95` passes 1 s or `err %` passes 1 %. The `users` in that row is how many concurrent users this host carries. The CPU columns in the same row show which container was saturated: `db` near 700–800 % means Postgres, `backend` near 600 % means all 6 gunicorn workers are busy.
2. **Endpoints.** Sorted by total waiting time, which is where users lose time. `queries` per request exposes N+1 serializers. Compare `db ms` with `app ms`: if app time is much higher than DB time, the cost is in Python (serializers), not SQL.
3. **Top SQL.** The share of all DB time per statement. Tile queries have `ST_AsMVT` in them. QGIS Server queries appear under its own role.
4. **Postgres connections and wait events.** Many short-lived connections point to no pooling (`CONN_MAX_AGE`). `LWLock`/`Lock` waits mean contention. `IO` waits mean the data doesn't fit in `shared_buffers`.
5. **nginx.** Tile cache hit ratio. Compare `urt p95` with `rt p95` to see whether time is spent in Django or in front of it.

After a change, rerun the same profile and arguments and compare:

```bash
python3 loadtest/collect/report.py --compare loadtest/runs/<before> loadtest/runs/<after>
```

Add a line to `RESULTS.md` for every run worth remembering.

## Cleanup

```bash
docker exec qonnectra_backend_prod python manage.py seed_load_data --purge
docker exec qonnectra_backend_prod python manage.py create_loadtest_users --purge
rm loadtest/tokens.json
# PERF_HEADERS=0 in deployment/.env, then: docker compose up -d backend backend-wms
```

## Not covered yet

- Global view (tiles without a project filter) and project switching.
- Session refresh traffic (`refreshSession` every 7 min, one request per user). The load-test tokens are long-lived instead.
- Writes go straight to Django, not through SvelteKit remote commands.
- The basemap tile server (tileserver-gl) and file uploads/WebDAV.

## Tests

```bash
cd loadtest && npm test                            # k6 helpers: remote wire format, tile math
python3 -m unittest discover loadtest/collect      # report aggregation
```
