from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.api'

    def ready(self):
        # Import signals to register them
        from . import signals  # noqa: F401
