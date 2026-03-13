"""Middleware for cross-subdomain cookie handling."""

from django.conf import settings


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
