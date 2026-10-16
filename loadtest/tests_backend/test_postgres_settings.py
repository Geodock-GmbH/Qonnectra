"""Tests for the Postgres statistics settings against the real server.

``ALTER SYSTEM`` writes the server's ``postgresql.auto.conf``, so every test
puts back what was there before. Nothing restarts the server, so the running
configuration never changes.
"""

import pytest
from django.conf import settings
from qonnectra_loadtest.postgres import (
    LIBRARIES,
    SETTINGS,
    Postgres,
    split_library_list,
)

NAMES = ["shared_preload_libraries", *SETTINGS]

AUTO_CONF_SQL = """
    SELECT name, setting FROM pg_file_settings
    WHERE name = ANY(%s) AND sourcefile LIKE '%%postgresql.auto.conf'
    ORDER BY seqno
"""


@pytest.fixture
def server():
    """Connect like the add-on does and restore postgresql.auto.conf afterwards."""
    database = settings.DATABASES["default"]
    postgres = Postgres(
        env={
            "DB_HOST": database["HOST"],
            "DB_PORT": str(database["PORT"]),
            "DB_NAME": database["NAME"],
            "DB_USER": database["USER"],
            "DB_PASSWORD": database["PASSWORD"],
        }
    )
    before = postgres._query(AUTO_CONF_SQL, (NAMES,))
    yield postgres
    for name in NAMES:
        postgres._alter(name, None)
    for row in before:
        value = row["setting"]
        if row["name"] == "shared_preload_libraries":
            value = split_library_list(value)
        postgres._alter(row["name"], value)
    postgres.close()


def written(postgres: Postgres) -> dict[str, str]:
    """Return the add-on's settings as postgresql.auto.conf holds them now."""
    return {
        row["name"]: row["setting"] for row in postgres._query(AUTO_CONF_SQL, (NAMES,))
    }


class TestStatisticsSettings:
    """Tests for what switching the statistics on leaves for the next start."""

    def test_each_library_is_its_own_preload_entry(self, server):
        """Verify Postgres stores the libraries as separate names it can load."""
        server.write_statistics_settings(True)

        entries = written(server)["shared_preload_libraries"].split(", ")
        assert entries[-len(LIBRARIES) :] == list(LIBRARIES)
        assert server.unloadable_libraries() == []

    def test_every_setting_is_written(self, server):
        """Verify the other settings land in postgresql.auto.conf unchanged."""
        server.write_statistics_settings(True)

        conf = written(server)
        for name, value in SETTINGS.items():
            assert conf[name] == value

    def test_a_single_literal_list_is_reported_as_unloadable(self, server):
        """Verify the check before the restart catches a list Postgres would not start with."""
        server._alter("shared_preload_libraries", ",".join(LIBRARIES))

        assert server.unloadable_libraries() == [",".join(LIBRARIES)]
