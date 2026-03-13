"""Custom logging handlers for the Qonnectra application."""

import logging
import re


class DatabaseLogHandler(logging.Handler):
    """Write log records to the database via :model:`api.LogEntry`.

    Capture log messages and store them with context about the user,
    request, and additional metadata.  Sensitive information such as
    passwords, tokens, and API keys is redacted before storage.
    """

    SENSITIVE_PATTERNS = [
        (
            re.compile(r'password["\']?\s*[:=]\s*["\']?([^"\'}\s,]+)', re.IGNORECASE),
            "***REDACTED***",
        ),
        (
            re.compile(r'token["\']?\s*[:=]\s*["\']?([^"\'}\s,]+)', re.IGNORECASE),
            "***REDACTED***",
        ),
        (
            re.compile(
                r'api[_-]?key["\']?\s*[:=]\s*["\']?([^"\'}\s,]+)', re.IGNORECASE
            ),
            "***REDACTED***",
        ),
        (
            re.compile(r'secret["\']?\s*[:=]\s*["\']?([^"\'}\s,]+)', re.IGNORECASE),
            "***REDACTED***",
        ),
        (
            re.compile(
                r'authorization["\']?\s*[:=]\s*["\']?([^"\'}\s,]+)', re.IGNORECASE
            ),
            "***REDACTED***",
        ),
    ]

    def __init__(self, *args, **kwargs):
        """Initialize the handler with an empty model cache."""
        super().__init__(*args, **kwargs)
        self._log_entry_model = None

    def _get_log_entry_model(self):
        """Return the cached LogEntry model, or ``None`` if apps aren't ready."""
        if self._log_entry_model is None:
            try:
                from django.apps import apps
                from django.core.exceptions import AppRegistryNotReady

                apps.check_apps_ready()
                apps.check_models_ready()

                self._log_entry_model = apps.get_model("api", "LogEntry")
            except (AppRegistryNotReady, LookupError):
                return None

        return self._log_entry_model

    def emit(self, record: logging.LogRecord) -> None:
        """Persist a log record to the database.

        Args:
            record: Standard library ``LogRecord`` with optional ``user``,
                ``path``, and ``request`` attributes for context.
        """
        LogEntry = self._get_log_entry_model()

        if LogEntry is None:
            return

        try:
            message = self._filter_sensitive_data(record.getMessage())

            user = getattr(record, "user", None)

            path = getattr(record, "path", None)

            extra_data = {}

            if hasattr(record, "request"):
                request = record.request
                extra_data["method"] = getattr(request, "method", None)
                extra_data["ip_address"] = self._get_client_ip(request)
                extra_data["user_agent"] = request.META.get("HTTP_USER_AGENT", "")[:500]

            if record.exc_info:
                extra_data["exception"] = self.format(record)

            for key, value in record.__dict__.items():
                if key not in [
                    "name",
                    "msg",
                    "args",
                    "created",
                    "filename",
                    "funcName",
                    "levelname",
                    "levelno",
                    "lineno",
                    "module",
                    "msecs",
                    "message",
                    "pathname",
                    "process",
                    "processName",
                    "relativeCreated",
                    "thread",
                    "threadName",
                    "exc_info",
                    "exc_text",
                    "stack_info",
                    "user",
                    "request",
                    "path",
                ]:
                    extra_data[key] = str(value)[:1000]

            LogEntry.objects.create(
                level=record.levelname,
                logger_name=record.name,
                message=message[:10000],
                user=user,
                source="backend",
                path=path,
                extra_data=extra_data if extra_data else None,
            )

        except Exception as e:
            self.handleError(record)
            print(f"Error logging to database: {e}")

    def _filter_sensitive_data(self, message: str) -> str:
        """Redact sensitive values (passwords, tokens, keys) from a message.

        Args:
            message: Raw log message that may contain secrets.

        Returns:
            str: Message with sensitive values replaced by ``***REDACTED***``.
        """
        filtered_message = message
        for pattern, replacement in self.SENSITIVE_PATTERNS:
            filtered_message = pattern.sub(
                lambda m: m.group(0).replace(m.group(1), replacement), filtered_message
            )
        return filtered_message

    def _get_client_ip(self, request) -> str:
        """Extract the client IP address from a Django request.

        Args:
            request: Django ``HttpRequest`` (or DRF ``Request``).

        Returns:
            str: Client IP (max 45 chars), preferring ``X-Forwarded-For``.
        """
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            ip = x_forwarded_for.split(",")[0].strip()
        else:
            ip = request.META.get("REMOTE_ADDR", "")
        return ip[:45]
