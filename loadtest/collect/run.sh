#!/usr/bin/env bash
# Runs one k6 load test against the stack on this host and records what the
# server did meanwhile: per-container CPU/RAM, Postgres connections and wait
# events, the top SQL from pg_stat_statements, nginx timings/cache status and
# slow-query log lines. Everything lands in loadtest/runs/<ts>-<sha>-<profile>/
# and report.py turns it into report.md.
#
# Usage (from anywhere, on the VPS):
#   loadtest/collect/run.sh check
#   loadtest/collect/run.sh ramp -e MAX_USERS=80 -e PROJECTS=loadtest
#   loadtest/collect/run.sh baseline -e CACHE=bypass
# Extra arguments go straight to `k6 run`.
#
# Environment overrides: ENV_FILE, DB_CONTAINER, NGINX_CONTAINER,
# BACKEND_CONTAINER, K6_IMAGE, K6_CPUS, SAMPLE_SECONDS.
# EXTERNAL_K6=<seconds> only samples for that long, for k6 running elsewhere.
set -euo pipefail

PROFILE="${1:-check}"
shift || true

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOADTEST="$(cd "$HERE/.." && pwd)"
ROOT="$(cd "$LOADTEST/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/deployment/.env}"
DB_CONTAINER="${DB_CONTAINER:-qonnectra_db_prod}"
NGINX_CONTAINER="${NGINX_CONTAINER:-qonnectra_nginx_prod}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-qonnectra_backend_prod}"
K6_IMAGE="${K6_IMAGE:-grafana/k6:1.2.0}"
K6_CPUS="${K6_CPUS:-1.5}"
SAMPLE_SECONDS="${SAMPLE_SECONDS:-2}"

# Reads KEY=value from the compose .env without sourcing it (values may contain spaces).
env_value() {
	{ grep -E "^[[:space:]]*$1[[:space:]]*=" "$ENV_FILE" || true; } | tail -n1 |
		sed -E 's/^[^=]*=[[:space:]]*//; s/^"(.*)"$/\1/; s/[[:space:]]+$//'
}

[[ -f "$ENV_FILE" ]] || { echo "No $ENV_FILE (set ENV_FILE)" >&2; exit 1; }
[[ -n "${EXTERNAL_K6:-}" || -f "$LOADTEST/tokens.json" ]] || {
	echo "No loadtest/tokens.json. Create it with:" >&2
	echo "  docker exec qonnectra_backend_prod python manage.py create_loadtest_users --count 60 > loadtest/tokens.json" >&2
	exit 1
}
DB_USER="$(env_value DB_USER)"
DB_NAME="$(env_value DB_NAME)"
APP_DOMAIN="$(env_value APP_DOMAIN)"
API_DOMAIN="$(env_value API_DOMAIN)"

psql_db() {
	docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -X -q -v ON_ERROR_STOP=1 "$@"
}

if ! psql_db -tAc "SHOW shared_preload_libraries" | grep -q pg_stat_statements; then
	echo "pg_stat_statements is not preloaded. Pull the compose change and recreate db:" >&2
	echo "  cd deployment && docker compose up -d db" >&2
	exit 1
fi
psql_db -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements" >/dev/null
if ! docker exec "$BACKEND_CONTAINER" printenv PERF_HEADERS 2>/dev/null | grep -qE '^(1|true|yes)$'; then
	echo "Note: PERF_HEADERS is off, so the report has no per-endpoint query counts." >&2
	echo "      Set PERF_HEADERS=1 in deployment/.env and recreate backend and backend-wms." >&2
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
SHA="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo nogit)"
RUN_NAME="$STAMP-$SHA-$PROFILE"
RUN="$LOADTEST/runs/$RUN_NAME"
mkdir -p "$RUN"
echo "Recording into $RUN"

DB_STATS_SQL="COPY (SELECT extract(epoch FROM now())::bigint AS ts, numbackends, xact_commit, xact_rollback,
	blks_read, blks_hit, tup_returned, tup_fetched, tup_inserted, tup_updated, tup_deleted,
	temp_files, temp_bytes, deadlocks FROM pg_stat_database WHERE datname = current_database())
	TO STDOUT WITH CSV HEADER"

psql_db -c "SELECT pg_stat_statements_reset()" >/dev/null
psql_db -c "$DB_STATS_SQL" >"$RUN/pg_db_before.csv"

sample_containers() {
	echo "ts,container,cpu_pct,mem_usage,net_io,block_io" >"$RUN/containers.csv"
	while true; do
		local ts
		ts="$(date +%s)"
		docker stats --no-stream --format '{{.Name}},{{.CPUPerc}},{{.MemUsage}},{{.NetIO}},{{.BlockIO}}' |
			sed "s/^/$ts,/" >>"$RUN/containers.csv" || true
		sleep "$SAMPLE_SECONDS"
	done
}

sample_pg_activity() {
	echo "ts,role,state,wait_event_type,wait_event,connections" >"$RUN/pg_activity.csv"
	while true; do
		psql_db -tA -F, -c "SELECT extract(epoch FROM now())::bigint, coalesce(usename, ''),
			coalesce(state, ''), coalesce(wait_event_type, ''), coalesce(wait_event, ''), count(*)
			FROM pg_stat_activity WHERE backend_type = 'client backend' AND pid <> pg_backend_pid()
			GROUP BY 2, 3, 4, 5" >>"$RUN/pg_activity.csv" 2>/dev/null || true
		sleep 1
	done
}

SAMPLERS=()
cleanup() {
	for pid in "${SAMPLERS[@]}"; do kill "$pid" 2>/dev/null || true; done
	docker rm -f qonnectra_k6 >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

sample_containers &
SAMPLERS+=($!)
sample_pg_activity &
SAMPLERS+=($!)

START="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
set +e
if [[ -n "${EXTERNAL_K6:-}" ]]; then
	echo "Sampling for ${EXTERNAL_K6}s while k6 runs elsewhere (copy its summary.json and k6.csv.gz into $RUN)"
	sleep "$EXTERNAL_K6"
	K6_EXIT=0
else
docker run --rm --name qonnectra_k6 --network host --cpus "$K6_CPUS" \
	-u "$(id -u):$(id -g)" \
	-v "$LOADTEST:/loadtest" -w /loadtest/k6 \
	-e SUMMARY="/loadtest/runs/$RUN_NAME/summary.json" \
	"$K6_IMAGE" run \
	-e PROFILE="$PROFILE" \
	-e TOKENS=/loadtest/tokens.json \
	${APP_DOMAIN:+-e APP_URL="https://$APP_DOMAIN"} \
	${API_DOMAIN:+-e API_URL="https://$API_DOMAIN/api/v1/"} \
	--out "csv=/loadtest/runs/$RUN_NAME/k6.csv.gz" \
	"$@" main.js 2>&1 | tee "$RUN/k6.log"
K6_EXIT="${PIPESTATUS[0]}"
fi
set -e
END="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

cleanup
trap - EXIT INT TERM

psql_db -c "$DB_STATS_SQL" >"$RUN/pg_db_after.csv"
psql_db -c "COPY (
	SELECT r.rolname AS role, s.calls,
		round(s.total_exec_time::numeric, 1) AS total_ms,
		round(s.mean_exec_time::numeric, 2) AS mean_ms,
		round(s.max_exec_time::numeric, 1) AS max_ms,
		s.rows, s.shared_blks_hit, s.shared_blks_read, s.temp_blks_written,
		round((100 * s.total_exec_time / nullif(sum(s.total_exec_time) OVER (), 0))::numeric, 1) AS pct,
		regexp_replace(s.query, '\s+', ' ', 'g') AS query
	FROM pg_stat_statements s
	JOIN pg_database d ON d.oid = s.dbid
	JOIN pg_roles r ON r.oid = s.userid
	WHERE d.datname = current_database()
	ORDER BY s.total_exec_time DESC
	LIMIT 50) TO STDOUT WITH CSV HEADER" >"$RUN/top_sql.csv"

docker logs --since "$START" --until "$END" "$NGINX_CONTAINER" 2>/dev/null >"$RUN/nginx.log" || true
docker logs --since "$START" --until "$END" "$DB_CONTAINER" >"$RUN/pg.log" 2>&1 || true

cat >"$RUN/meta.json" <<EOF
{
  "profile": "$PROFILE",
  "k6_args": "$*",
  "git_sha": "$SHA",
  "start": "$START",
  "end": "$END",
  "k6_exit": $K6_EXIT,
  "host_cpus": $(nproc 2>/dev/null || echo 0),
  "host_mem_kb": $(awk '/MemTotal/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)
}
EOF

python3 "$HERE/report.py" "$RUN"
echo "Report: $RUN/report.md"
exit "$K6_EXIT"
