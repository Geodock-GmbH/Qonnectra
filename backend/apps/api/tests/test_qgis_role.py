"""Tests for the QGIS role table privileges applied after migrate."""

import uuid

import pytest
from django.core.management.sql import emit_post_migrate_signal
from django.db import connection
from django.test import override_settings

from apps.api.qgis_role import apply_qgis_role_privileges

READ_WRITE = {"SELECT", "INSERT", "UPDATE", "DELETE"}
DATA_TABLES = ("trench", "node", "attributes_node_type", "qgis_projects")
DENIED_TABLES = (
    "auth_user",
    "auth_user_groups",
    "authtoken_token",
    "django_session",
    "django_migrations",
    "model_permission",
    "route_permission",
    "user_settings",
)


def _privileges(role, table):
    """Return which of SELECT, INSERT, UPDATE and DELETE ``role`` holds on ``table``.

    Args:
        role (str): Database role name.
        table (str): Table name in the ``public`` schema.

    Returns:
        set[str]: The held privileges.
    """
    held = set()
    with connection.cursor() as cursor:
        for privilege in sorted(READ_WRITE):
            cursor.execute(
                "SELECT has_table_privilege(%s, %s, %s)", [role, table, privilege]
            )
            if cursor.fetchone()[0]:
                held.add(privilege)
    return held


@pytest.fixture
def qgis_role(db):
    """Create a login role that is rolled back with the test transaction.

    Returns:
        str: Name of the created role.
    """
    role = f"qgis_test_{uuid.uuid4().hex[:8]}"
    with connection.cursor() as cursor:
        cursor.execute(f'CREATE ROLE "{role}" LOGIN')
    return role


class TestApplyQgisRolePrivileges:
    """The QGIS role edits the data tables but cannot touch auth or permission tables."""

    def test_post_migrate_grants_read_write_on_data_tables(self, qgis_role):
        """A migrate run gives the role read-write access to the GIS data tables."""
        with override_settings(QGIS_DB_USER=qgis_role):
            emit_post_migrate_signal(verbosity=0, interactive=False, db="default")

        for table in DATA_TABLES:
            assert _privileges(qgis_role, table) == READ_WRITE, table

    def test_revokes_existing_grants_on_denied_tables(self, qgis_role):
        """Grants left on auth, session and permission tables are removed."""
        with connection.cursor() as cursor:
            for table in DENIED_TABLES:
                cursor.execute(f'GRANT ALL ON "{table}" TO "{qgis_role}"')

        with override_settings(QGIS_DB_USER=qgis_role):
            apply_qgis_role_privileges()

        for table in DENIED_TABLES:
            assert _privileges(qgis_role, table) == set(), table

    def test_does_nothing_without_setting(self, qgis_role):
        """Without ``QGIS_DB_USER`` no privileges are granted."""
        with override_settings(QGIS_DB_USER=""):
            apply_qgis_role_privileges()

        assert _privileges(qgis_role, "trench") == set()

    @pytest.mark.django_db
    def test_does_nothing_when_role_is_missing(self):
        """A configured role that does not exist is skipped without an error."""
        with override_settings(QGIS_DB_USER=f"qgis_missing_{uuid.uuid4().hex[:8]}"):
            apply_qgis_role_privileges()
