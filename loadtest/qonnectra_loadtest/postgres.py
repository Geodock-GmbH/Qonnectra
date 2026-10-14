"""Postgres statistics the recorder samples: activity, counters and top SQL.

Plain psycopg with the backend's ``DB_*`` settings. All calls block, so the
runner calls them from gevent's thread pool.
"""

import os

import psycopg
from psycopg.rows import dict_row

ACTIVITY_SQL = """
    SELECT coalesce(usename, '') AS role, coalesce(state, '') AS state,
        coalesce(wait_event_type, '') AS wait_event_type,
        coalesce(wait_event, '') AS wait_event, count(*)::int AS connections
    FROM pg_stat_activity
    WHERE backend_type = 'client backend' AND pid <> pg_backend_pid()
    GROUP BY 1, 2, 3, 4
"""

COUNTERS_SQL = """
    SELECT numbackends, xact_commit, xact_rollback, blks_read, blks_hit,
        tup_returned, tup_fetched, tup_inserted, tup_updated, tup_deleted,
        temp_files, temp_bytes, deadlocks
    FROM pg_stat_database WHERE datname = current_database()
"""

TOP_SQL = """
    SELECT r.rolname AS role, s.calls::bigint AS calls,
        round(s.total_exec_time::numeric, 1)::float AS total_ms,
        round(s.mean_exec_time::numeric, 2)::float AS mean_ms,
        round(s.max_exec_time::numeric, 1)::float AS max_ms,
        s.rows::bigint AS rows, s.shared_blks_hit::bigint AS shared_blks_hit,
        s.shared_blks_read::bigint AS shared_blks_read,
        s.temp_blks_written::bigint AS temp_blks_written,
        round((100 * s.total_exec_time
            / nullif(sum(s.total_exec_time) OVER (), 0))::numeric, 1)::float AS pct,
        regexp_replace(s.query, '\\s+', ' ', 'g') AS query
    FROM pg_stat_statements s
    JOIN pg_database d ON d.oid = s.dbid
    JOIN pg_roles r ON r.oid = s.userid
    WHERE d.datname = current_database()
    ORDER BY s.total_exec_time DESC
    LIMIT %s
"""


class Postgres:
    """One lazily opened, autocommit connection to the application database."""

    def __init__(self, env: dict[str, str] | None = None):
        """Remember the connection settings without connecting yet.

        Args:
            env: Environment with ``DB_*`` values, ``os.environ`` by default.
        """
        env = os.environ if env is None else env
        self.dsn = {
            "host": env.get("DB_HOST", "db"),
            "port": env.get("DB_PORT", "5432"),
            "dbname": env.get("DB_NAME", ""),
            "user": env.get("DB_USER", ""),
            "password": env.get("DB_PASSWORD", ""),
        }
        self.connection: psycopg.Connection | None = None

    def _query(self, sql: str, params: tuple = ()) -> list[dict]:
        """Run one statement and return its rows, reconnecting once if needed."""
        for attempt in (1, 2):
            try:
                if self.connection is None or self.connection.closed:
                    self.connection = psycopg.connect(
                        **self.dsn,
                        autocommit=True,
                        row_factory=dict_row,
                        connect_timeout=5,
                        application_name="qonnectra-loadtest",
                    )
                with self.connection.cursor() as cursor:
                    cursor.execute(sql, params)
                    return cursor.fetchall() if cursor.description else []
            except psycopg.OperationalError:
                self.connection = None
                if attempt == 2:
                    raise
        return []

    def statements_ready(self) -> bool:
        """Return whether pg_stat_statements is preloaded, creating the extension.

        Returns:
            bool: False when the server was started without the library.
        """
        rows = self._query("SHOW shared_preload_libraries")
        if "pg_stat_statements" not in (
            rows[0]["shared_preload_libraries"] if rows else ""
        ):
            return False
        self._query("CREATE EXTENSION IF NOT EXISTS pg_stat_statements")
        return True

    def reset_statements(self):
        """Clear pg_stat_statements so the top SQL covers this run only."""
        self._query("SELECT pg_stat_statements_reset()")

    def activity(self) -> list[dict]:
        """Return client connections grouped by role, state and wait event."""
        return self._query(ACTIVITY_SQL)

    def counters(self) -> dict:
        """Return the cumulative ``pg_stat_database`` counters of this database."""
        rows = self._query(COUNTERS_SQL)
        return {key: float(value) for key, value in rows[0].items()} if rows else {}

    def top_sql(self, limit: int = 50) -> list[dict]:
        """Return the statements with the most total execution time.

        Args:
            limit: Number of statements.

        Returns:
            list[dict]: One row per statement, with its share of all DB time.
        """
        return self._query(TOP_SQL, (limit,))

    def close(self):
        """Close the connection if it is open."""
        if self.connection is not None:
            self.connection.close()
            self.connection = None


def counter_delta(before: dict, after: dict) -> dict:
    """Return how much each counter grew between two snapshots.

    Args:
        before: :meth:`Postgres.counters` at the start.
        after: :meth:`Postgres.counters` at the end.

    Returns:
        dict: Counter name to increase; empty if a snapshot is missing.
    """
    if not before or not after:
        return {}
    return {key: after[key] - before.get(key, 0) for key in after}
