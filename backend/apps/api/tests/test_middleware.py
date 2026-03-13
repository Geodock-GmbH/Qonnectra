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
