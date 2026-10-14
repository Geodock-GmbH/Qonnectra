"""Tests for CookieDomainMiddleware."""

import pytest
from django.http import HttpResponse
from django.test import RequestFactory, override_settings
from apps.api.middleware import CookieDomainMiddleware


@pytest.fixture
def request_factory():
    """Create a Django request factory."""
    return RequestFactory()


def make_middleware(response):
    """Create middleware that returns a fixed response."""
    return CookieDomainMiddleware(lambda req: response)


class TestCookieDomainMiddleware:
    """Tests for cookie domain patching middleware."""

    @override_settings(USE_COOKIE_DOMAIN_MIDDLEWARE=True, COOKIE_DOMAIN=".example.com")
    def test_patches_jwt_cookies_when_enabled(self, request_factory):
        """Verify cookie domain is set when middleware is enabled."""
        response = HttpResponse()
        response.set_cookie("api-access-token", "access-val")
        response.set_cookie("api-refresh-token", "refresh-val")

        middleware = make_middleware(response)
        result = middleware(request_factory.get("/"))

        assert result.cookies["api-access-token"]["domain"] == ".example.com"
        assert result.cookies["api-refresh-token"]["domain"] == ".example.com"

    @override_settings(USE_COOKIE_DOMAIN_MIDDLEWARE=False)
    def test_no_patching_when_disabled(self, request_factory):
        """Verify cookies are not patched when middleware is disabled."""
        response = HttpResponse()
        response.set_cookie("api-access-token", "access-val")

        middleware = make_middleware(response)
        result = middleware(request_factory.get("/"))

        assert result.cookies["api-access-token"]["domain"] == ""

    @override_settings(USE_COOKIE_DOMAIN_MIDDLEWARE=True, COOKIE_DOMAIN=".example.com")
    def test_other_cookies_untouched(self, request_factory):
        """Verify non-JWT cookies are not patched."""
        response = HttpResponse()
        response.set_cookie("sessionid", "sess-val")
        response.set_cookie("api-access-token", "access-val")

        middleware = make_middleware(response)
        result = middleware(request_factory.get("/"))

        assert result.cookies["sessionid"]["domain"] == ""
        assert result.cookies["api-access-token"]["domain"] == ".example.com"

    @override_settings(USE_COOKIE_DOMAIN_MIDDLEWARE=True, COOKIE_DOMAIN=".example.com")
    def test_response_without_cookies_passes_through(self, request_factory):
        """Verify response without cookies passes through unmodified."""
        response = HttpResponse("OK")

        middleware = make_middleware(response)
        result = middleware(request_factory.get("/"))

        assert result.status_code == 200
        assert "api-access-token" not in result.cookies


def counting_view(request):
    """Run two queries, so the header has something to count."""
    from django.contrib.auth import get_user_model

    user_model = get_user_model()
    user_model.objects.count()
    user_model.objects.exists()
    return HttpResponse()


@pytest.mark.django_db
class TestServerTimingMiddleware:
    """Tests for the load-test Server-Timing header."""

    def test_reports_query_count_and_db_time_for_the_load_test(self, request_factory):
        """Verify a request with the load-test key gets every statement counted."""
        from django.conf import settings

        from apps.api.middleware import (
            SERVER_TIMING_HEADER,
            ServerTimingMiddleware,
            server_timing_key,
        )

        request = request_factory.get(
            "/",
            headers={SERVER_TIMING_HEADER: server_timing_key(settings.SECRET_KEY)},
        )
        result = ServerTimingMiddleware(counting_view)(request)

        parts = dict(
            part.strip().split(";dur=") for part in result["Server-Timing"].split(",")
        )
        assert parts["q"] == "2"
        assert float(parts["db"]) >= 0
        assert float(parts["app"]) >= float(parts["db"])

    @pytest.mark.parametrize("sent", [None, "", "wrong-key"])
    def test_other_requests_get_no_header(self, request_factory, sent):
        """Verify requests without the right key are not measured."""
        from apps.api.middleware import SERVER_TIMING_HEADER, ServerTimingMiddleware

        headers = {} if sent is None else {SERVER_TIMING_HEADER: sent}
        result = ServerTimingMiddleware(counting_view)(
            request_factory.get("/", headers=headers)
        )

        assert "Server-Timing" not in result

    def test_installed_for_real_requests(self, client):
        """Verify the full middleware stack measures a keyed request end to end."""
        from django.conf import settings
        from django.urls import reverse

        from apps.api.middleware import SERVER_TIMING_HEADER, server_timing_key

        plain = client.get(reverse("v1:config"))
        keyed = client.get(
            reverse("v1:config"),
            headers={SERVER_TIMING_HEADER: server_timing_key(settings.SECRET_KEY)},
        )

        assert "Server-Timing" not in plain
        assert keyed["Server-Timing"].startswith("app;dur=")

    def test_key_depends_on_secret(self):
        """Verify the key changes with the secret and is empty without one."""
        from apps.api.middleware import server_timing_key

        assert server_timing_key("a") != server_timing_key("b")
        assert server_timing_key("") == ""
