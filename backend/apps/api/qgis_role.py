"""Table privileges of the QGIS database role.

QGIS Server and QGIS Desktop (through WireGuard) connect to PostgreSQL as
``settings.QGIS_DB_USER``. ``deployment/postgres/init.sh`` creates that role on
the database's first start, before any table exists, so the table grants are
applied here after every ``migrate`` instead: read-write access to every table
in ``public`` except the authentication, session and permission tables.
"""

from django.apps import apps
from django.conf import settings
from django.db import DEFAULT_DB_ALIAS, connections, transaction

DENIED_APP_LABELS = (
    "admin",
    "auth",
    "authtoken",
    "contenttypes",
    "sessions",
    "token_blacklist",
)
DENIED_API_MODELS = ("ModelPermission", "RoutePermission", "UserSettings")
DENIED_TABLES = ("django_migrations",)


def denied_tables() -> set[str]:
    """Return the tables the QGIS role must have no privileges on.

    Returns:
        set[str]: Table names of the denied apps and models, including their
        auto-created many-to-many tables.
    """
    tables: set[str] = set(DENIED_TABLES)
    for label in DENIED_APP_LABELS:
        try:
            app_config = apps.get_app_config(label)
        except LookupError:
            continue
        tables.update(
            model._meta.db_table
            for model in app_config.get_models(include_auto_created=True)
        )
    tables.update(
        apps.get_model("api", name)._meta.db_table for name in DENIED_API_MODELS
    )
    return tables


def apply_qgis_role_privileges(sender=None, using=DEFAULT_DB_ALIAS, **kwargs):
    """Grant the QGIS role read-write access to the data tables and none to the denied ones.

    Connected to ``post_migrate``, so every deploy re-applies the grants,
    including on tables added by later migrations. Does nothing when
    ``QGIS_DB_USER`` is unset or the role does not exist.

    Args:
        sender (AppConfig | None): App config that sent the signal.
        using (str): Alias of the migrated database.
        **kwargs: Remaining ``post_migrate`` keyword arguments.
    """
    role = settings.QGIS_DB_USER
    if not role:
        return
    connection = connections[using]
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", [role])
        if cursor.fetchone() is None:
            return

    quote = connection.ops.quote_name
    existing = set(connection.introspection.table_names())
    with transaction.atomic(using=using), connection.cursor() as cursor:
        cursor.execute(
            "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public "
            f"TO {quote(role)}"
        )
        cursor.execute(
            f"GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {quote(role)}"
        )
        for table in sorted(denied_tables() & existing):
            cursor.execute(f"REVOKE ALL ON {quote(table)} FROM {quote(role)}")
