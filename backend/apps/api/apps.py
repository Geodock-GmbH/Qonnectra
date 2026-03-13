"""Django application configuration for the api app."""

from django.apps import AppConfig


class ApiConfig(AppConfig):
    """Application config for the core API app.

    Register signal handlers on startup via the ``ready`` hook.
    """

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.api"

    def ready(self) -> None:
        """Import signal handlers so they are registered with Django."""
        from . import signals  # noqa: F401
