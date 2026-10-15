"""Checks the Postgres statistics switch: what it writes, when it restarts, how it fails."""

import re

import psycopg
from psycopg import sql

from qonnectra_loadtest import __main__ as cli
from qonnectra_loadtest import docker, postgres
from qonnectra_loadtest.postgres import (
    SETTINGS,
    Postgres,
    split_library_list,
    switch_statistics,
)

INSTALLED = ("timescaledb", "pg_stat_statements", "auto_explain")


class RecordingPostgres(Postgres):
    """A server stand-in: records statements, applies the preload list on restart.

    Like Postgres, ``ALTER SYSTEM`` only changes the running value after
    :meth:`restart`, and stores each literal of a list setting as one entry,
    double-quoted when it holds more than a plain name.
    """

    def __init__(
        self,
        setting: str = "",
        source: str = "default",
        down_for: int = 0,
        installed: tuple[str, ...] = INSTALLED,
    ):
        """Create the stand-in.

        Args:
            setting: Running ``shared_preload_libraries``.
            source: Where it comes from, as in ``pg_settings.source``.
            down_for: Queries that fail after a restart, while Postgres starts.
            installed: Libraries ``LOAD`` finds.
        """
        super().__init__(env={})
        self.setting = self.pending = setting
        self.source = source
        self.down_for = down_for
        self.installed = installed
        self.down = 0
        self.statements: list[str] = []

    def restart(self) -> bool:
        """Apply the written preload list, like a container restart.

        Returns:
            bool: Always True, the restart works.
        """
        self.statements.append("-- restart")
        self.setting = self.pending
        self.down = self.down_for
        return True

    def _query(self, statement, params=()):
        """Record a statement and answer the preload queries."""
        text = (
            statement.as_string(None)
            if isinstance(statement, sql.Composable)
            else " ".join(statement.split())
        )
        if self.down:
            self.down -= 1
            raise psycopg.OperationalError("the database system is starting up")
        self.statements.append(text)
        written = re.fullmatch(
            r"ALTER SYSTEM (?:SET shared_preload_libraries = (.*)|RESET shared_preload_libraries)",
            text,
        )
        if written:
            self.pending = ", ".join(
                name if re.fullmatch(r"[a-z_][a-z0-9_]*", name) else f'"{name}"'
                for name in re.findall(r"'([^']*)'", written[1] or "")
            )
        loaded = re.fullmatch(r"LOAD '(.*)'", text)
        if loaded and loaded[1] not in self.installed:
            raise psycopg.errors.UndefinedFile(f'could not access file "{loaded[1]}"')
        if "FROM pg_settings" in text:
            return [{"setting": self.setting, "source": self.source}]
        if "FROM pg_file_settings" in text:
            return [{"setting": self.pending}] if self.pending else []
        if text == "SHOW shared_preload_libraries":
            return [{"shared_preload_libraries": self.setting}]
        return []


def switch(server: RecordingPostgres, on: bool, restart=None, wait_seconds=5):
    """Switch the statistics on the stand-in and return the result and log."""
    lines: list[str] = []
    switched = switch_statistics(
        on,
        server,
        restart=restart or server.restart,
        log=lines.append,
        wait_seconds=wait_seconds,
    )
    return switched, lines


def test_switching_on_keeps_other_libraries_and_restarts_once(monkeypatch):
    """Verify every setting is written before the restart and the extension after."""
    server = RecordingPostgres("timescaledb", "configuration file")

    switched, lines = switch(server, on=True)

    assert switched, lines
    restart = server.statements.index("-- restart")
    before = server.statements[:restart]
    assert (
        "ALTER SYSTEM SET shared_preload_libraries = "
        "'timescaledb', 'pg_stat_statements', 'auto_explain'"
    ) in before
    assert "LOAD 'auto_explain'" in before
    assert server.setting == "timescaledb, pg_stat_statements, auto_explain"
    for name, value in SETTINGS.items():
        assert f"ALTER SYSTEM SET {name} = '{value}'" in before
    assert server.statements.count("-- restart") == 1
    assert (
        "CREATE EXTENSION IF NOT EXISTS pg_stat_statements"
        in server.statements[restart:]
    )
    assert lines[-1] == "Postgres statistics are on."


def test_switching_off_resets_everything_and_drops_the_extension():
    """Verify switching off leaves only the other libraries and no add-on settings."""
    server = RecordingPostgres(
        "timescaledb,pg_stat_statements,auto_explain", "configuration file"
    )

    switched, lines = switch(server, on=False)

    assert switched, lines
    assert "ALTER SYSTEM SET shared_preload_libraries = 'timescaledb'" in (
        server.statements
    )
    for name in SETTINGS:
        assert f"ALTER SYSTEM RESET {name}" in server.statements
    assert "DROP EXTENSION IF EXISTS pg_stat_statements" in server.statements
    assert server.setting == "timescaledb"
    assert lines[-1] == "Postgres statistics are off."


def test_switching_off_the_only_libraries_resets_the_preload_list():
    """Verify an emptied preload list is reset, not set to an empty string."""
    server = RecordingPostgres("pg_stat_statements,auto_explain", "configuration file")

    switched, _ = switch(server, on=False)

    assert switched
    assert "ALTER SYSTEM RESET shared_preload_libraries" in server.statements
    assert server.setting == ""


def test_a_command_line_preload_list_is_left_alone():
    """Verify nothing is written and nothing restarts when the command line wins."""
    server = RecordingPostgres("pg_stat_statements", "command line")

    switched, lines = switch(server, on=False)

    assert not switched
    assert not any(s.startswith(("ALTER", "DROP")) for s in server.statements)
    assert "-- restart" not in server.statements
    assert "command line" in lines[0]


def test_a_library_postgres_cannot_load_stops_the_switch_before_the_restart():
    """Verify a preload list that would stop Postgres is reset and never restarted."""
    server = RecordingPostgres(installed=("pg_stat_statements",))

    switched, lines = switch(server, on=True)

    assert not switched
    assert "-- restart" not in server.statements
    assert server.pending == ""
    for name in SETTINGS:
        assert f"ALTER SYSTEM RESET {name}" in server.statements
    assert "auto_explain" in lines[-1]
    assert "Nothing was restarted" in lines[-1]


def test_splits_a_preload_list_like_postgres():
    """Verify a double-quoted entry stays one name, commas included."""
    assert split_library_list("pg_stat_statements, auto_explain") == [
        "pg_stat_statements",
        "auto_explain",
    ]
    assert split_library_list('"pg_stat_statements,auto_explain"') == [
        "pg_stat_statements,auto_explain"
    ]
    assert split_library_list("") == []


def test_a_failed_restart_says_how_to_apply_the_settings():
    """Verify the job fails and names the manual restart when Docker is unavailable."""
    server = RecordingPostgres()

    switched, lines = switch(server, on=True, restart=lambda: False)

    assert not switched
    assert "docker compose restart db" in lines[-1]


def test_waits_while_postgres_starts(monkeypatch):
    """Verify connection errors during the start are retried until it answers."""
    monkeypatch.setattr(postgres.time, "sleep", lambda seconds: None)
    server = RecordingPostgres(down_for=3)

    switched, lines = switch(server, on=True)

    assert switched, lines


def test_gives_up_when_postgres_stays_down(monkeypatch):
    """Verify the job ends with a message instead of waiting forever."""
    monkeypatch.setattr(postgres.time, "sleep", lambda seconds: None)
    server = RecordingPostgres(down_for=1000)

    switched, lines = switch(server, on=True, wait_seconds=0)

    assert not switched
    assert "did not come back" in lines[-1]


def test_cli_switches_without_django_and_restarts_the_db_container(monkeypatch):
    """Verify the CLI command restarts the db service's container, not another one."""
    calls = []

    def fake_docker(*args, timeout=30):
        """List a backend and a db container and record every command."""
        calls.append(args)
        if args[0] == "ps":
            return "qonnectra_backend_prod\nqonnectra_db_prod\n"
        return ""

    def fake_switch(on, server, restart, log):
        """Record the switch and run the restart it was given."""
        calls.append(("switch", on))
        return restart()

    def no_django():
        """Fail the test if the command sets up Django."""
        raise AssertionError("The switch must not need Django.")

    monkeypatch.setattr(docker, "_docker", fake_docker)
    monkeypatch.setattr(postgres, "switch_statistics", fake_switch)
    monkeypatch.setattr(cli, "setup_django", no_django)

    assert cli.main(["postgres-statistics", "on"]) == 0
    assert ("switch", True) in calls
    assert ("restart", "qonnectra_db_prod") in calls


def test_restart_fails_without_a_db_container(monkeypatch):
    """Verify a missing db container is reported as a failed restart."""
    monkeypatch.setattr(docker, "_docker", lambda *args, timeout=30: "other\n")

    assert docker.restart_service("db") is False
