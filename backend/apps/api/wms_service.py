"""WMS service module for fetching and parsing WMS capabilities."""

import contextlib
import hashlib
import ipaddress
import logging
import math
import os
import socket
from typing import Optional
from urllib.parse import urlparse, urlunparse

from django.core.cache import cache
from owslib.wms import WebMapService

logger = logging.getLogger(__name__)


class WMSServiceError(Exception):
    """Exception raised for WMS service errors."""

    pass


class WMSSecurityError(WMSServiceError):
    """Raised when a WMS fetch is blocked for targeting an internal resource."""

    pass


CACHE_TTL_SECONDS = 300  # 5 minutes
CACHE_KEY_PREFIX = "wms_capabilities:"
QGIS_SERVER_INTERNAL_URL = "http://qgis-server"

ALLOWED_URL_SCHEMES = frozenset({"http", "https"})

# Hosts that are trusted internal destinations reached via code-controlled
# rewrites (see ``_rewrite_to_internal_qgis_url``); IP validation is skipped
# for these because they are not derived from user-supplied URLs.
_TRUSTED_INTERNAL_HOSTS = frozenset({"qgis-server"})


def _is_blocked_ip(ip: "ipaddress._BaseAddress") -> bool:
    """Return True if an IP address belongs to a private/internal range.

    Covers loopback, RFC1918/ULA private ranges, link-local (including cloud
    metadata at 169.254.169.254), and IPv4-mapped IPv6 forms.
    """
    mapped = getattr(ip, "ipv4_mapped", None)
    if mapped is not None:
        ip = mapped
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


@contextlib.contextmanager
def _block_internal_dns():
    """Reject resolution to any private/internal IP for the enclosed block.

    Patches ``socket.getaddrinfo`` so that every DNS resolution performed by
    the HTTP client — including each redirect hop — is validated against the
    private-range blocklist at connect time. This closes DNS-rebinding/TOCTOU
    races (validation happens at the actual resolution used to connect) and
    redirect-to-internal bypasses (every hop is re-resolved and re-checked).
    """
    original_getaddrinfo = socket.getaddrinfo

    def guarded_getaddrinfo(host, *args, **kwargs):
        results = original_getaddrinfo(host, *args, **kwargs)
        for family, _type, _proto, _canon, sockaddr in results:
            addr = sockaddr[0]
            try:
                ip = ipaddress.ip_address(addr)
            except ValueError:
                continue
            if _is_blocked_ip(ip):
                raise WMSSecurityError(
                    "Access to private/internal networks is not allowed"
                )
        return results

    socket.getaddrinfo = guarded_getaddrinfo
    try:
        yield
    finally:
        socket.getaddrinfo = original_getaddrinfo


def _fetch_guard(fetch_url: str):
    """Return the DNS guard to wrap a WMS fetch with.

    Trusted, code-controlled internal destinations (the rewritten QGIS server
    URL) are exempt; all user-derived URLs are guarded so any resolution to a
    private/internal IP — including redirect hops — is rejected.
    """
    hostname = urlparse(fetch_url).hostname or ""
    if hostname in _TRUSTED_INTERNAL_HOSTS:
        return contextlib.nullcontext()
    return _block_internal_dns()


def validate_wms_url(url: str) -> tuple[bool, str]:
    """Validate that a user-supplied WMS URL is safe to fetch.

    Checks the scheme allowlist and rejects hostnames that resolve to a
    private/internal address. This is a fail-fast pre-check; the authoritative
    protection is enforced at fetch time by ``_block_internal_dns``.

    Args:
        url: The WMS URL to validate.

    Returns:
        tuple[bool, str]: ``(is_safe, error_message)``.
    """
    parsed = urlparse(url)

    if parsed.scheme.lower() not in ALLOWED_URL_SCHEMES:
        return (
            False,
            f"URL scheme '{parsed.scheme}' not allowed. Only http/https permitted.",
        )

    hostname = parsed.hostname
    if not hostname:
        return False, "Invalid URL: no hostname"

    try:
        infos = socket.getaddrinfo(hostname, parsed.port or None)
    except socket.gaierror:
        return False, f"Could not resolve hostname: {hostname}"

    for family, _type, _proto, _canon, sockaddr in infos:
        try:
            ip = ipaddress.ip_address(sockaddr[0])
        except ValueError:
            continue
        if _is_blocked_ip(ip):
            return False, "Access to private/internal networks is not allowed"

    return True, ""


def _rewrite_to_internal_qgis_url(url: str) -> str:
    """Rewrite external QGIS domain URLs to the internal Docker container URL.

    When the backend fetches WMS capabilities from its own QGIS server via the
    external domain, the request goes through Caddy's forward_auth back to
    Django, causing a deadlock. This rewrites such URLs to hit the QGIS
    container directly on the internal Docker network.
    """
    qgis_domain = os.environ.get("QGIS_DOMAIN", "")
    if not qgis_domain:
        return url

    parsed = urlparse(url)
    if parsed.hostname == qgis_domain:
        rewritten = urlunparse(
            parsed._replace(
                scheme="http",
                netloc="qgis-server",
            )
        )
        logger.info(f"Rewrote QGIS URL to internal: {url} -> {rewritten}")
        return rewritten

    return url


def _get_cache_key(url: str, username: Optional[str] = None) -> str:
    """Generate a cache key for WMS capabilities.

    Args:
        url: WMS service URL.
        username: Optional username to scope the cache per user.

    Returns:
        str: Cache key combining prefix and MD5 hash of url+username.
    """
    key_data = f"{url}:{username or ''}"
    return f"{CACHE_KEY_PREFIX}{hashlib.md5(key_data.encode()).hexdigest()}"


def _get_cached_layers(cache_key: str) -> Optional[list[dict]]:
    """Retrieve cached WMS layers if the cache entry is still valid.

    Args:
        cache_key: Cache key generated by ``_get_cache_key``.

    Returns:
        Optional[list[dict]]: Cached layer list, or None on cache miss.
    """
    return cache.get(cache_key)


def _cache_layers(cache_key: str, layers: list[dict]) -> None:
    """Store WMS layers in the cache with the configured TTL.

    Args:
        cache_key: Cache key generated by ``_get_cache_key``.
        layers: List of layer dicts to cache.
    """
    cache.set(cache_key, layers, timeout=CACHE_TTL_SECONDS)


def clear_capabilities_cache(
    url: Optional[str] = None, username: Optional[str] = None
) -> None:
    """Clear cached WMS capabilities.

    If no URL is provided, attempt to clear all WMS cache keys
    (requires a cache backend that supports ``delete_pattern``).

    Args:
        url: If provided, only clear the cache for this specific URL.
        username: Optional username associated with the URL.
    """
    if url:
        cache_key = _get_cache_key(url, username)
        cache.delete(cache_key)
    else:
        # Clear all WMS capabilities cache keys using delete_pattern if available
        # (Redis/Memcached), otherwise this is a no-op for LocMemCache
        delete_pattern = getattr(cache, "delete_pattern", None)
        if delete_pattern is not None:
            delete_pattern(f"{CACHE_KEY_PREFIX}*")
        else:
            logger.warning(
                "Cache backend does not support delete_pattern, cannot clear all WMS cache"
            )


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
        url: WMS service URL.
        username: Optional username for authenticated WMS.
        password: Optional password for authenticated WMS.
        timeout: Request timeout in seconds.
        version: WMS version to use (None for auto-detect with fallback).
        use_cache: Whether to use cached results.

    Returns:
        list[dict]: Dicts with 'name' and 'title' keys.

    Raises:
        WMSServiceError: If the WMS request fails after all version attempts.
    """
    cache_key = _get_cache_key(url, username)

    if use_cache:
        cached = _get_cached_layers(cache_key)
        if cached is not None:
            logger.debug(f"Using cached WMS capabilities for {url}")
            return cached

    fetch_url = _rewrite_to_internal_qgis_url(url)
    versions_to_try = [version] if version else ["1.3.0", "1.1.1"]
    last_error = None

    for wms_version in versions_to_try:
        try:
            logger.debug(f"Trying WMS version {wms_version} for {fetch_url}")
            with _fetch_guard(fetch_url):
                wms = WebMapService(
                    fetch_url,
                    version=wms_version,
                    username=username,
                    password=password,
                    timeout=timeout,
                )

            layers = []
            for layer_name, layer in wms.contents.items():
                layers.append(
                    {
                        "name": layer.name,
                        "title": layer.title or layer.name,
                    }
                )

            _cache_layers(cache_key, layers)
            logger.info(
                f"Successfully fetched {len(layers)} layers from {url} using WMS {wms_version}"
            )

            return layers

        except WMSSecurityError:
            raise
        except Exception as e:
            last_error = e
            logger.warning(f"WMS version {wms_version} failed for {url}: {e}")
            continue

    logger.error(f"Failed to fetch WMS capabilities from {url} with all versions")
    raise WMSServiceError(str(last_error)) from last_error


def calculate_recommended_min_zoom(bbox_width_deg: float) -> int:
    """Calculate recommended minimum zoom level based on BBOX width.

    Many WMS services reject requests with very large bounding boxes.
    This derives a safe minimum zoom from the tile width at each zoom level
    (at zoom 0 a tile covers ~360 degrees).

    Args:
        bbox_width_deg: Width of the bounding box in degrees.

    Returns:
        int: Recommended minimum zoom level, clamped to 0-22.
    """
    if bbox_width_deg <= 0:
        return 0

    # At zoom 0, tile covers ~360 degrees
    # At zoom z, tile covers ~360 / 2^z degrees
    # We want tile width <= some reasonable limit (e.g., 0.5 degrees ~ 50km at equator)
    max_tile_width_deg = 0.5

    if bbox_width_deg <= max_tile_width_deg:
        return 0

    # Calculate zoom where tile width ≤ bbox_width_deg
    # tile_width = 360 / 2^z
    # z = log2(360 / bbox_width_deg)
    recommended_zoom = math.ceil(math.log2(360 / bbox_width_deg))

    return min(recommended_zoom, 22)


def scan_wms_capabilities(
    url: str,
    username: Optional[str] = None,
    password: Optional[str] = None,
    timeout: int = 30,
) -> dict:
    """Scan WMS capabilities and return detailed configuration info.

    Fetches GetCapabilities and analyzes service/layer constraints
    to recommend configuration settings.

    Args:
        url: WMS service URL.
        username: Optional username for authenticated WMS.
        password: Optional password for authenticated WMS.
        timeout: Request timeout in seconds.

    Returns:
        dict: Contains 'service_info' (title, abstract, version) and
            'layers' with recommended settings per layer.

    Raises:
        WMSServiceError: If the WMS request fails after all version attempts.
    """
    fetch_url = _rewrite_to_internal_qgis_url(url)
    versions_to_try = ["1.3.0", "1.1.1"]
    last_error = None

    for wms_version in versions_to_try:
        try:
            logger.debug(
                f"Scanning WMS capabilities using version {wms_version} for {fetch_url}"
            )
            with _fetch_guard(fetch_url):
                wms = WebMapService(
                    fetch_url,
                    version=wms_version,
                    username=username,
                    password=password,
                    timeout=timeout,
                )

            service_info = {
                "title": wms.identification.title if wms.identification else None,
                "abstract": wms.identification.abstract if wms.identification else None,
                "version": wms_version,
                "max_width": None,
                "max_height": None,
            }

            layers = []
            for layer_name, layer in wms.contents.items():
                layer_info = {
                    "name": layer.name,
                    "title": layer.title or layer.name,
                    "abstract": getattr(layer, "abstract", None),
                    "bbox": None,
                    "bbox_crs": None,
                    "recommended_min_zoom": 8,  # Default fallback
                    "supported_crs": [],
                    "queryable": getattr(layer, "queryable", False),
                    "opaque": getattr(layer, "opaque", False),
                }

                try:
                    if hasattr(layer, "boundingBoxWGS84") and layer.boundingBoxWGS84:
                        bbox = layer.boundingBoxWGS84
                        layer_info["bbox"] = list(bbox)
                        layer_info["bbox_crs"] = "EPSG:4326"

                        # Calculate bbox width in degrees
                        bbox_width = abs(bbox[2] - bbox[0])
                        layer_info["recommended_min_zoom"] = (
                            calculate_recommended_min_zoom(bbox_width)
                        )
                    elif hasattr(layer, "boundingBox") and layer.boundingBox:
                        bbox = layer.boundingBox
                        layer_info["bbox"] = list(bbox[:4])
                        layer_info["bbox_crs"] = bbox[4] if len(bbox) > 4 else "unknown"
                except Exception as e:
                    logger.debug(f"Could not extract bbox for layer {layer_name}: {e}")

                try:
                    if hasattr(layer, "crsOptions"):
                        layer_info["supported_crs"] = list(layer.crsOptions)[:20]
                except Exception:
                    pass

                layers.append(layer_info)

            logger.info(f"Successfully scanned {len(layers)} layers from {url}")

            return {
                "service_info": service_info,
                "layers": layers,
            }

        except WMSSecurityError:
            raise
        except Exception as e:
            last_error = e
            logger.warning(f"WMS scan with version {wms_version} failed for {url}: {e}")
            continue

    logger.error(f"Failed to scan WMS capabilities from {url} with all versions")
    raise WMSServiceError(str(last_error)) from last_error
