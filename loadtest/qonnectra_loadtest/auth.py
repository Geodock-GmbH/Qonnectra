"""Who may use the load-test UI: Qonnectra superusers, by their app session.

The UI is served on the app's own domain under ``/loadtest/``, so the
browser sends the app's ``api-access-token`` cookie along. Django's
``auth/user/`` answers who that is. An expired access token is refreshed
with the refresh cookie the same way the SvelteKit hook does it, and the new
cookies are passed on to the browser.
"""

import hashlib
import threading
import time
from dataclasses import dataclass, field

import requests

ACCESS_COOKIE = "api-access-token"
REFRESH_COOKIE = "api-refresh-token"
CACHE_SECONDS = 30
CACHE_MAX_ENTRIES = 200
REFRESH_REUSE_SECONDS = 30
"""Django rotates and blacklists refresh tokens, so the UI's parallel polls
must share one refresh instead of each spending the same token."""


@dataclass
class Verdict:
    """Outcome of one access check."""

    allowed: bool
    reason: str = ""
    """``login`` (no valid session) or ``forbidden`` (not a superuser)."""
    set_cookies: list[str] = field(default_factory=list)
    """``Set-Cookie`` values to pass on after a token refresh."""


def cookie_value(set_cookie: str) -> tuple[str, str]:
    """Return name and value of a ``Set-Cookie`` header value.

    Args:
        set_cookie: e.g. ``api-access-token=abc; Path=/; HttpOnly``.

    Returns:
        tuple[str, str]: Cookie name and value.
    """
    pair = set_cookie.split(";", 1)[0]
    name, _, value = pair.partition("=")
    return name.strip(), value.strip()


def without_secure(set_cookie: str) -> str:
    """Drop the ``Secure`` attribute, for plain-HTTP development setups.

    Args:
        set_cookie: A ``Set-Cookie`` header value.

    Returns:
        str: The same cookie without ``Secure``.
    """
    return "; ".join(
        part
        for part in (piece.strip() for piece in set_cookie.split(";"))
        if part.lower() != "secure"
    )


class SuperuserGate:
    """Decides from the request cookies whether someone may use the UI."""

    def __init__(self, api_url: str, http=requests):
        """Create a gate with an empty cache.

        Args:
            api_url: Django API base inside the Docker network, with ``/api/v1/``.
            http: Object with requests-compatible ``get`` and ``post``, for tests.
        """
        self.api_url = api_url
        self.http = http
        self.cache: dict[str, tuple[float, bool]] = {}
        self.refreshed: dict[str, tuple[float, list[str]]] = {}
        self.refresh_lock = threading.Lock()

    def _who(self, access: str) -> bool | None:
        """Return whether the token belongs to a superuser; None if Django rejects it."""
        key = hashlib.sha256(access.encode()).hexdigest()
        cached = self.cache.get(key)
        if cached and cached[0] > time.time():
            return cached[1]
        response = self.http.get(
            f"{self.api_url}auth/user/",
            headers={"Cookie": f"{ACCESS_COOKIE}={access}"},
            timeout=10,
        )
        if response.status_code in (401, 403):
            return None
        response.raise_for_status()
        superuser = bool(response.json().get("is_superuser"))
        if len(self.cache) >= CACHE_MAX_ENTRIES:
            self.cache.clear()
        self.cache[key] = (time.time() + CACHE_SECONDS, superuser)
        return superuser

    def _refresh(self, refresh: str) -> list[str]:
        """Trade the refresh token for new cookies; empty list on failure.

        A refresh token is spent once; requests that arrive with the same
        token shortly after get the cookies of that one refresh.
        """
        key = hashlib.sha256(refresh.encode()).hexdigest()
        with self.refresh_lock:
            done = self.refreshed.get(key)
            if done and done[0] > time.time():
                return done[1]
            response = self.http.post(
                f"{self.api_url}auth/token/refresh/",
                headers={"Cookie": f"{REFRESH_COOKIE}={refresh}"},
                json={},
                timeout=10,
            )
            cookies = response.raw.headers.getlist("Set-Cookie") if response.ok else []
            if len(self.refreshed) >= CACHE_MAX_ENTRIES:
                self.refreshed.clear()
            self.refreshed[key] = (time.time() + REFRESH_REUSE_SECONDS, cookies)
            return cookies

    def check(self, cookies: dict[str, str], secure: bool = True) -> Verdict:
        """Check the cookies of one request.

        Args:
            cookies: Request cookies.
            secure: Whether the browser talks HTTPS; refreshed cookies lose
                their ``Secure`` flag otherwise, so a dev browser keeps them.

        Returns:
            Verdict: Allowed, or why not, plus cookies to set after a refresh.
        """
        access = cookies.get(ACCESS_COOKIE)
        superuser = self._who(access) if access else None
        set_cookies: list[str] = []
        if superuser is None and cookies.get(REFRESH_COOKIE):
            set_cookies = self._refresh(cookies[REFRESH_COOKIE])
            fresh = dict(cookie_value(value) for value in set_cookies)
            if fresh.get(ACCESS_COOKIE):
                superuser = self._who(fresh[ACCESS_COOKIE])
            if not secure:
                set_cookies = [without_secure(value) for value in set_cookies]
        if superuser is None:
            return Verdict(False, "login", set_cookies)
        if not superuser:
            return Verdict(False, "forbidden", set_cookies)
        return Verdict(True, "", set_cookies)
