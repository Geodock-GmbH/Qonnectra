"""Run options: what the start form sets, plus the target URLs from the environment.

The container gets the same ``deployment/.env`` values as the backend, so the
public URLs follow from ``APP_DOMAIN``, ``API_DOMAIN`` and
``TILE_SERVER_DOMAIN``. Each can be overridden in the start form.
"""

import hashlib
import hmac
import os
from dataclasses import dataclass


def _with_slash(url: str) -> str:
    """Return ``url`` with exactly one trailing slash, or empty."""
    return f"{url.rstrip('/')}/" if url else ""


def default_urls(env: dict[str, str] | None = None) -> dict[str, str]:
    """Return the public app, API and tile server URLs of this installation.

    Args:
        env: Environment to read, ``os.environ`` by default.

    Returns:
        dict[str, str]: ``app``, ``api`` and ``tiles``; empty when unknown.
    """
    env = os.environ if env is None else env
    app = env.get("APP_DOMAIN", "")
    api = env.get("API_DOMAIN", "")
    return {
        "app": f"https://{app}" if app else "",
        "api": f"https://{api}/api/v1/" if api else "",
        "tiles": env.get("PUBLIC_TILE_SERVER_URL", "").rstrip("/"),
    }


def internal_api_url(env: dict[str, str] | None = None) -> str:
    """Return the API base the container reaches inside the Docker network.

    Used for the login check of the web UI, never for load. Falls back to
    nginx on the compose network.

    Args:
        env: Environment to read, ``os.environ`` by default.

    Returns:
        str: API base including ``/api/v1/``.
    """
    env = os.environ if env is None else env
    return _with_slash(env.get("API_URL") or "http://nginx/api/v1/")


def timing_key(secret_key: str) -> str:
    """Return the ``X-Loadtest-Timing`` value Django's middleware expects.

    Same derivation as ``apps.api.middleware.server_timing_key``.

    Args:
        secret_key: The shared ``DJANGO_SECRET_KEY``.

    Returns:
        str: Hex HMAC-SHA256, or an empty string without a key.
    """
    if not secret_key:
        return ""
    return hmac.new(
        secret_key.encode(), b"qonnectra-loadtest-timing", hashlib.sha256
    ).hexdigest()


@dataclass(frozen=True)
class RunOptions:
    """Everything a persona needs to know about the current run."""

    app_url: str
    api_url: str
    tiles_url: str
    projects: str = "all"
    cache: str = "on"
    wms: bool = True
    basemap: bool = True
    tile_factor: int = 2
    think: float = 1.0
    viewport: tuple[int, int] = (1600, 900)

    @classmethod
    def from_parsed(cls, options, host: str) -> "RunOptions":
        """Build the options from Locust's parsed command line and start form.

        Args:
            options: ``environment.parsed_options``.
            host: The form's Host field, which is the app URL.

        Returns:
            RunOptions: Normalised options.

        Raises:
            ValueError: If a URL is missing or the viewport is malformed.
        """
        width, _, height = str(options.viewport).lower().partition("x")
        app_url = str(host or "").rstrip("/")
        api_url = _with_slash(str(options.api_url))
        if not app_url or not api_url:
            raise ValueError(
                "Host (the app URL) and API URL are required: set APP_DOMAIN and "
                "API_DOMAIN in deployment/.env or fill them in the start form."
            )
        return cls(
            app_url=app_url,
            api_url=api_url,
            tiles_url=str(options.tiles_url).rstrip("/"),
            projects=str(options.projects).strip() or "all",
            cache=str(options.cache),
            wms=bool(options.wms),
            basemap=bool(options.basemap),
            tile_factor=max(1, int(options.tile_factor)),
            think=max(0.0, float(options.think)),
            viewport=(int(width), int(height)),
        )
