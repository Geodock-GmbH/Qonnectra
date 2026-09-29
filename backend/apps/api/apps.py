"""Django application configuration for the api app."""

from django.apps import AppConfig


class ApiConfig(AppConfig):
    """Application config for the core API app.

    Register signal handlers on startup via the ``ready`` hook.
    """

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.api"

    def ready(self) -> None:
        """Register the signal handlers and the post-migrate QGIS role grants."""
        from django.db.models.signals import post_migrate

        from . import signals  # noqa: F401
        from .qgis_role import apply_qgis_role_privileges

        post_migrate.connect(apply_qgis_role_privileges, sender=self)
