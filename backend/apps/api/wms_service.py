"""WMS service module for fetching and parsing WMS capabilities."""

import hashlib
import logging
import time
from typing import Optional

from owslib.wms import WebMapService

logger = logging.getLogger(__name__)


class WMSServiceError(Exception):
    """Exception raised for WMS service errors."""
    pass


# Simple in-memory cache for WMS capabilities
_capabilities_cache: dict[str, tuple[list[dict], float]] = {}
CACHE_TTL_SECONDS = 300  # 5 minutes


def _get_cache_key(url: str, username: Optional[str] = None) -> str:
    """Generate a cache key for WMS capabilities."""
    key_data = f"{url}:{username or ''}"
    return hashlib.md5(key_data.encode()).hexdigest()


def _get_cached_layers(cache_key: str) -> Optional[list[dict]]:
    """Get cached layers if still valid."""
    if cache_key in _capabilities_cache:
        layers, timestamp = _capabilities_cache[cache_key]
        if time.time() - timestamp < CACHE_TTL_SECONDS:
            return layers
        del _capabilities_cache[cache_key]
    return None


def _cache_layers(cache_key: str, layers: list[dict]) -> None:
    """Cache layers with current timestamp."""
    _capabilities_cache[cache_key] = (layers, time.time())


def clear_capabilities_cache(url: Optional[str] = None, username: Optional[str] = None) -> None:
    """Clear cached capabilities.

    Args:
        url: If provided, only clear cache for this URL
        username: Optional username associated with the URL

    If no URL is provided, clears the entire cache.
    """
    global _capabilities_cache
    if url:
        cache_key = _get_cache_key(url, username)
        _capabilities_cache.pop(cache_key, None)
    else:
        _capabilities_cache = {}


def fetch_wms_layers(
    url: str,
    username: Optional[str] = None,
    password: Optional[str] = None,
    timeout: int = 30,
    version: Optional[str] = None,
    use_cache: bool = True,
) -> list[dict]:
    """Fetch available layers from a WMS GetCapabilities response.

    Supports automatic version fallback: tries 1.3.0 first, then 1.1.1.
    Results are cached for 5 minutes to reduce load on external servers.

    Args:
        url: WMS service URL
        username: Optional username for authenticated WMS
        password: Optional password for authenticated WMS
        timeout: Request timeout in seconds
        version: WMS version to use (None for auto-detect with fallback)
        use_cache: Whether to use cached results (default True)

    Returns:
        List of dicts with 'name' and 'title' keys

    Raises:
        WMSServiceError: If the WMS request fails
    """
    cache_key = _get_cache_key(url, username)

    # Check cache first
    if use_cache:
        cached = _get_cached_layers(cache_key)
        if cached is not None:
            logger.debug(f"Using cached WMS capabilities for {url}")
            return cached

    versions_to_try = [version] if version else ["1.3.0", "1.1.1"]
    last_error = None

    for wms_version in versions_to_try:
        try:
            logger.debug(f"Trying WMS version {wms_version} for {url}")
            wms = WebMapService(
                url,
                version=wms_version,
                username=username,
                password=password,
                timeout=timeout,
            )

            layers = []
            for layer_name, layer in wms.contents.items():
                layers.append({
                    "name": layer.name,
                    "title": layer.title or layer.name,
                })

            # Cache successful result
            _cache_layers(cache_key, layers)
            logger.info(f"Successfully fetched {len(layers)} layers from {url} using WMS {wms_version}")

            return layers

        except Exception as e:
            last_error = e
            logger.warning(f"WMS version {wms_version} failed for {url}: {e}")
            continue

    logger.error(f"Failed to fetch WMS capabilities from {url} with all versions")
    raise WMSServiceError(str(last_error)) from last_error
