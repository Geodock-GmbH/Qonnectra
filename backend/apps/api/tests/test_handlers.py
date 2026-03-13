"""Tests for DatabaseLogHandler sensitive data filtering and log persistence."""

import logging
from unittest.mock import Mock, patch

import pytest
from apps.api.handlers import DatabaseLogHandler


@pytest.fixture
def handler():
    """Create a DatabaseLogHandler instance."""
    return DatabaseLogHandler()


class TestFilterSensitiveData:
    """Tests for _filter_sensitive_data method."""

    def test_redacts_password_with_equals(self, handler):
        """Verify password values are redacted in key=value format."""
        result = handler._filter_sensitive_data("password=mysecret123")
        assert "mysecret123" not in result
        assert "***REDACTED***" in result

    def test_redacts_password_with_colon(self, handler):
        """Verify password values are redacted in key: value format."""
        result = handler._filter_sensitive_data("password: mysecret123")
        assert "mysecret123" not in result
        assert "***REDACTED***" in result

    def test_redacts_password_with_quotes(self, handler):
        """Verify password values are redacted in quoted format."""
        result = handler._filter_sensitive_data('password="mysecret123"')
        assert "mysecret123" not in result
        assert "***REDACTED***" in result

    def test_redacts_token(self, handler):
        """Verify token values are redacted."""
        result = handler._filter_sensitive_data("token=abc123xyz")
        assert "abc123xyz" not in result
        assert "***REDACTED***" in result

    def test_redacts_api_key(self, handler):
        """Verify API key values are redacted."""
        result = handler._filter_sensitive_data("api_key=sk-12345")
        assert "sk-12345" not in result
        assert "***REDACTED***" in result

    def test_redacts_api_key_with_hyphen(self, handler):
        """Verify api-key format is also redacted."""
        result = handler._filter_sensitive_data("api-key=sk-12345")
        assert "sk-12345" not in result
        assert "***REDACTED***" in result

    def test_redacts_secret(self, handler):
        """Verify secret values are redacted."""
        result = handler._filter_sensitive_data("secret=topsecret")
        assert "topsecret" not in result
        assert "***REDACTED***" in result

    def test_redacts_authorization(self, handler):
        """Verify authorization header values are redacted."""
        result = handler._filter_sensitive_data("authorization=Bearer eyJtoken")
        assert "Bearer" not in result
        assert "***REDACTED***" in result

    def test_case_insensitive(self, handler):
        """Verify pattern matching is case insensitive."""
        result = handler._filter_sensitive_data("PASSWORD=mysecret")
        assert "mysecret" not in result

        result = handler._filter_sensitive_data("Password=mysecret")
        assert "mysecret" not in result

        result = handler._filter_sensitive_data("TOKEN=abc")
        assert "abc" not in result

    def test_non_sensitive_data_unchanged(self, handler):
        """Verify non-sensitive messages pass through unchanged."""
        msg = "User logged in successfully from 192.168.1.1"
        assert handler._filter_sensitive_data(msg) == msg

    def test_empty_string(self, handler):
        """Verify empty string passes through."""
        assert handler._filter_sensitive_data("") == ""

    def test_multiple_sensitive_values_all_redacted(self, handler):
        """Verify all sensitive values in a single message are redacted."""
        msg = "password=secret1 token=secret2 api_key=secret3"
        result = handler._filter_sensitive_data(msg)
        assert "secret1" not in result
        assert "secret2" not in result
        assert "secret3" not in result


class TestGetClientIp:
    """Tests for _get_client_ip method."""

    def test_x_forwarded_for_single_ip(self, handler):
        """Verify IP is extracted from X-Forwarded-For with single IP."""
        request = Mock()
        request.META = {"HTTP_X_FORWARDED_FOR": "1.2.3.4"}
        assert handler._get_client_ip(request) == "1.2.3.4"

    def test_x_forwarded_for_multiple_ips(self, handler):
        """Verify first IP is taken from X-Forwarded-For with multiple IPs."""
        request = Mock()
        request.META = {"HTTP_X_FORWARDED_FOR": "1.2.3.4, 5.6.7.8, 9.10.11.12"}
        assert handler._get_client_ip(request) == "1.2.3.4"

    def test_fallback_to_remote_addr(self, handler):
        """Verify fallback to REMOTE_ADDR when X-Forwarded-For is missing."""
        request = Mock()
        request.META = {"REMOTE_ADDR": "10.0.0.1"}
        assert handler._get_client_ip(request) == "10.0.0.1"

    def test_truncation_at_45_chars(self, handler):
        """Verify IP is truncated to 45 characters."""
        long_ip = "a" * 100
        request = Mock()
        request.META = {"HTTP_X_FORWARDED_FOR": long_ip}
        assert len(handler._get_client_ip(request)) == 45

    def test_missing_both_headers(self, handler):
        """Verify empty string when both headers are missing."""
        request = Mock()
        request.META = {}
        assert handler._get_client_ip(request) == ""


@pytest.mark.django_db
class TestEmit:
    """Tests for the emit method."""

    def test_log_record_persisted(self, handler):
        """Verify a log record is written to the database."""
        from apps.api.models import LogEntry

        record = logging.LogRecord(
            name="test.handler.emit",
            level=logging.WARNING,
            pathname="test.py",
            lineno=1,
            msg="Test log message",
            args=(),
            exc_info=None,
        )
        handler.emit(record)

        entry = LogEntry.objects.filter(logger_name="test.handler.emit").last()
        assert entry is not None
        assert entry.level == "WARNING"
        assert entry.logger_name == "test.handler.emit"
        assert entry.message == "Test log message"
        assert entry.source == "backend"

    def test_user_context_attached(self, handler, user):
        """Verify user is attached when present on the log record."""
        from apps.api.models import LogEntry

        record = logging.LogRecord(
            name="test.handler.user",
            level=logging.INFO,
            pathname="",
            lineno=0,
            msg="user context test",
            args=(),
            exc_info=None,
        )
        record.user = user
        handler.emit(record)

        entry = LogEntry.objects.filter(logger_name="test.handler.user").last()
        assert entry.user == user

    def test_request_metadata_captured(self, handler):
        """Verify method, IP, and user_agent are captured from request."""
        from apps.api.models import LogEntry

        request = Mock()
        request.method = "POST"
        request.META = {
            "HTTP_X_FORWARDED_FOR": "1.2.3.4",
            "HTTP_USER_AGENT": "TestAgent/1.0",
        }

        record = logging.LogRecord(
            name="test.handler.request",
            level=logging.INFO,
            pathname="",
            lineno=0,
            msg="request metadata test",
            args=(),
            exc_info=None,
        )
        record.request = request
        handler.emit(record)

        entry = LogEntry.objects.filter(logger_name="test.handler.request").last()
        assert entry.extra_data["method"] == "POST"
        assert entry.extra_data["ip_address"] == "1.2.3.4"
        assert entry.extra_data["user_agent"] == "TestAgent/1.0"

    def test_apps_not_ready_returns_early(self, handler):
        """Verify no error when apps are not ready."""
        handler._log_entry_model = None

        with patch(
            "apps.api.handlers.DatabaseLogHandler._get_log_entry_model",
            return_value=None,
        ):
            record = logging.LogRecord(
                name="test",
                level=logging.INFO,
                pathname="",
                lineno=0,
                msg="msg",
                args=(),
                exc_info=None,
            )
            handler.emit(record)

    def test_sensitive_data_redacted_in_persisted_message(self, handler):
        """Verify sensitive data is redacted before being stored."""
        from apps.api.models import LogEntry

        record = logging.LogRecord(
            name="test.handler.redact",
            level=logging.INFO,
            pathname="",
            lineno=0,
            msg="Login attempt with password=supersecret",
            args=(),
            exc_info=None,
        )
        handler.emit(record)

        entry = LogEntry.objects.filter(logger_name="test.handler.redact").last()
        assert "supersecret" not in entry.message
        assert "***REDACTED***" in entry.message
