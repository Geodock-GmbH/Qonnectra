"""Postgres statistics the recorder samples, and the settings that enable them.

Activity, counters and top SQL for a run. The settings behind top SQL and the
slow-query log (``pg_stat_statements``, ``auto_explain`` and friends) belong to
the add-on: it writes them with ``ALTER SYSTEM`` and restarts the db container,
so an installation without the add-on runs Postgres unchanged.

Plain psycopg with the backend's ``DB_*`` settings. All calls block, so the
runner calls them from gevent's thread pool.
"""

import os
import re
import time
from collections.abc import Callable

import psycopg
from psycopg import sql
from psycopg.rows import dict_row

LIBRARIES = ("pg_stat_statements", "auto_explain")
SETTINGS = {
    "pg_stat_statements.track": "all",
    "track_io_timing": "on",
    "log_min_duration_statement": "500",
    "auto_explain.log_min_duration": "1000",
    "auto_explain.log_format": "json",
    "log_lock_waits": "on",
}
"""What a run needs besides the preloaded libraries; all apply after a restart."""
RESTART_WAIT_SECONDS = 120

PRELOAD_SQL = """
    SELECT setting, source FROM pg_settings
    WHERE name = 'shared_preload_libraries'
"""

WRITTEN_PRELOAD_SQL = """
    SELECT setting FROM pg_file_settings
    WHERE name = 'shared_preload_libraries'
    ORDER BY seqno DESC
    LIMIT 1
"""
"""The preload list the next start reads; the last file that sets it wins."""

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

    def _query(self, statement: str | sql.Composed, params: tuple = ()) -> list[dict]:
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
                    cursor.execute(statement, params)
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

    def preload(self) -> tuple[list[str], bool]:
        """Return the preloaded libraries and whether the add-on can change them.

        Returns:
            tuple: Library names, and False when ``shared_preload_libraries``
                is set on the server's command line, which ``ALTER SYSTEM``
                cannot override.
        """
        row = self._query(PRELOAD_SQL)[0]
        return split_library_list(row["setting"]), row["source"] != "command line"

    def unloadable_libraries(self) -> list[str]:
        """Return the libraries of the written preload list Postgres cannot load.

        Postgres stops at start when one is missing, so this runs before any
        restart. ``LOAD`` of an already preloaded library does nothing.

        Returns:
            list[str]: Library names as the next start reads them.
        """
        rows = self._query(WRITTEN_PRELOAD_SQL)
        missing = []
        for name in split_library_list(rows[0]["setting"]) if rows else []:
            try:
                self._query(sql.SQL("LOAD {}").format(sql.Literal(name)))
            except psycopg.Error:
                missing.append(name)
        return missing

    def write_statistics_settings(self, on: bool):
        """Write or remove the statistics settings; they apply after a restart.

        Other preloaded libraries are kept. Removing resets every setting to
        what the configuration file says and drops the extension.

        Args:
            on: True to add the settings, False to remove them.

        Raises:
            RuntimeError: If the preload list is fixed on the command line.
        """
        libraries, changeable = self.preload()
        if not changeable:
            raise RuntimeError(
                "shared_preload_libraries is set on the db container's command "
                "line. Remove it there, or add pg_stat_statements,auto_explain."
            )
        others = [name for name in libraries if name not in LIBRARIES]
        wanted = [*others, *LIBRARIES] if on else others
        self._alter("shared_preload_libraries", wanted or None)
        for name, value in SETTINGS.items():
            self._alter(name, value if on else None)
        if not on:
            self._query("DROP EXTENSION IF EXISTS pg_stat_statements")

    def _alter(self, name: str, value: str | list[str] | None):
        """Set one server setting with ``ALTER SYSTEM``, or reset it for None.

        A list setting takes one literal per entry: Postgres stores a single
        literal ``'a,b'`` as one quoted name, ``"a,b"``.
        """
        if value is None:
            self._query(sql.SQL("ALTER SYSTEM RESET {}").format(sql.SQL(name)))
            return
        values = [value] if isinstance(value, str) else value
        self._query(
            sql.SQL("ALTER SYSTEM SET {} = {}").format(
                sql.SQL(name), sql.SQL(", ").join(map(sql.Literal, values))
            )
        )

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


def split_library_list(value: str) -> list[str]:
    """Split a preload list the way Postgres reads it.

    Names are separated by commas. A double-quoted name keeps its commas, so
    ``"a,b"`` is one library called ``a,b``.

    Args:
        value: The setting, e.g. ``pg_stat_statements, auto_explain``.

    Returns:
        list[str]: Library names.
    """
    return [
        quoted.replace('""', '"') if quoted else bare
        for quoted, bare in re.findall(r'"((?:[^"]|"")*)"|([^,\s"]+)', value)
    ]


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


def switch_statistics(
    on: bool,
    postgres: Postgres,
    restart: Callable[[], bool],
    log: Callable[[str], None],
    wait_seconds: float = RESTART_WAIT_SECONDS,
) -> bool:
    """Switch the statistics settings on or off, restarting Postgres.

    Args:
        on: True to switch on.
        postgres: Connection to the application database.
        restart: Restarts the db container; returns whether it worked.
        log: Receives one progress line at a time.
        wait_seconds: How long to wait for Postgres to come back.

    Returns:
        bool: Whether Postgres runs with the wanted state afterwards.
    """
    try:
        postgres.write_statistics_settings(on)
        missing = postgres.unloadable_libraries()
        if missing and on:
            postgres.write_statistics_settings(False)
    except (RuntimeError, psycopg.Error) as error:
        log(str(error))
        return False
    if missing:
        log(
            f"Postgres cannot load {', '.join(missing)} and would not start. "
            "Nothing was restarted" + (", the settings are reset." if on else ".")
        )
        return False
    postgres.close()
    log("Settings written. Restarting the database container…")
    if not restart():
        log(
            "Could not restart the db container. The settings apply with the "
            "next restart: docker compose restart db"
        )
        return False

    deadline = time.monotonic() + wait_seconds
    while True:
        try:
            libraries, _ = postgres.preload()
            break
        except psycopg.OperationalError:
            if time.monotonic() >= deadline:
                log(
                    "Postgres did not come back in time. The db container's "
                    "log says why; the settings are in postgresql.auto.conf "
                    "in its data volume."
                )
                return False
            time.sleep(2)

    if on and "pg_stat_statements" in libraries:
        postgres.statements_ready()
        log("Postgres statistics are on.")
        return True
    if not on and "pg_stat_statements" not in libraries:
        log("Postgres statistics are off.")
        return True
    log(f"Postgres restarted, but preloads: {', '.join(libraries) or 'nothing'}.")
    return False
