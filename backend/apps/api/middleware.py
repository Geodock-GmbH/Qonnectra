from django.conf import settings


class CookieDomainMiddleware:
    """
    Middleware to set cookie domain for JWT cookies to work across subdomains.

    dj-rest-auth sets cookies via Set-Cookie headers, not Django's response.cookies,
    so we need to intercept and modify the raw HTTP headers.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        if settings.USE_COOKIE_DOMAIN_MIDDLEWARE:
            if "api-access-token" in response.cookies:
                response.cookies["api-access-token"]["domain"] = settings.COOKIE_DOMAIN
            if "api-refresh-token" in response.cookies:
                response.cookies["api-refresh-token"]["domain"] = settings.COOKIE_DOMAIN

        return response
