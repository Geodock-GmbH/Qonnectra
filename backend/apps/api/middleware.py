"""Middleware for cross-subdomain cookie handling and load-test timing."""

import hashlib
import hmac
import time

from django.conf import settings
from django.db import connection


class CookieDomainMiddleware:
    """Set cookie domain on JWT cookies so they work across subdomains.

    dj-rest-auth sets cookies via Set-Cookie headers, not
    ``response.cookies``, so this middleware intercepts and patches
    the domain attribute on ``api-access-token`` and
    ``api-refresh-token`` cookies when ``USE_COOKIE_DOMAIN_MIDDLEWARE``
    is enabled.
    """

    def __init__(self, get_response: callable) -> None:
        """Initialize the middleware.

        Args:
            get_response: The next middleware or view in the chain.
        """
        self.get_response = get_response

    def __call__(self, request):
        """Process the request and patch cookie domains on the response.

        Args:
            request: The incoming Django HTTP request.

        Returns:
            HttpResponse: The response with patched cookie domains when applicable.
        """
        response = self.get_response(request)

        if settings.USE_COOKIE_DOMAIN_MIDDLEWARE:
            if "api-access-token" in response.cookies:
                response.cookies["api-access-token"]["domain"] = settings.COOKIE_DOMAIN
            if "api-refresh-token" in response.cookies:
                response.cookies["api-refresh-token"]["domain"] = settings.COOKIE_DOMAIN

        return response


SERVER_TIMING_HEADER = "X-Loadtest-Timing"


def server_timing_key(secret_key: str) -> str:
    """Return the value a request must send in ``X-Loadtest-Timing``.

    The load-test container derives the same value from the shared
    ``DJANGO_SECRET_KEY``, so no extra setting is needed and nobody else can
    switch the header on.

    Args:
        secret_key: Django's ``SECRET_KEY``.

    Returns:
        str: Hex HMAC-SHA256 of a fixed label, or an empty string without a key.
    """
    if not secret_key:
        return ""
    return hmac.new(
        secret_key.encode(), b"qonnectra-loadtest-timing", hashlib.sha256
    ).hexdigest()


class ServerTimingMiddleware:
    """Report per-request query count and DB time in a ``Server-Timing`` header.

    Only requests carrying the load-test key in ``X-Loadtest-Timing`` are
    measured, so the load test can attribute DB cost to endpoints
    (``app``/``db`` in ms, ``q`` = query count) while every other request
    pays one header lookup. Connection setup is outside ``execute`` and
    therefore not in ``db``.
    """

    def __init__(self, get_response: callable) -> None:
        """Initialize the middleware.

        Args:
            get_response: The next middleware or view in the chain.
        """
        self.get_response = get_response
        self.key = server_timing_key(settings.SECRET_KEY)

    def __call__(self, request):
        """Time the request and every SQL statement it executes, if asked to.

        Args:
            request: The incoming Django HTTP request.

        Returns:
            HttpResponse: The response, with a ``Server-Timing`` header when the
                request sent the load-test key.
        """
        sent = request.headers.get(SERVER_TIMING_HEADER)
        if not self.key or not sent or not hmac.compare_digest(sent, self.key):
            return self.get_response(request)

        stats = {"queries": 0, "db_ms": 0.0}

        def timed_execute(execute, sql, params, many, context):
            """Run one statement and add its duration to ``stats``."""
            started = time.perf_counter()
            try:
                return execute(sql, params, many, context)
            finally:
                stats["queries"] += 1
                stats["db_ms"] += (time.perf_counter() - started) * 1000

        started = time.perf_counter()
        with connection.execute_wrapper(timed_execute):
            response = self.get_response(request)
        app_ms = (time.perf_counter() - started) * 1000

        response["Server-Timing"] = (
            f"app;dur={app_ms:.1f}, db;dur={stats['db_ms']:.1f}, "
            f"q;dur={stats['queries']}"
        )
        return response
