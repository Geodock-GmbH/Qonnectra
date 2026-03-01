"""WMS service module for fetching and parsing WMS capabilities."""

import hashlib
import logging
import math
from typing import Optional

from django.core.cache import cache
from owslib.wms import WebMapService

logger = logging.getLogger(__name__)


class WMSServiceError(Exception):
    """Exception raised for WMS service errors."""
    pass


CACHE_TTL_SECONDS = 300  # 5 minutes
CACHE_KEY_PREFIX = "wms_capabilities:"


def _get_cache_key(url: str, username: Optional[str] = None) -> str:
    """Generate a cache key for WMS capabilities."""
    key_data = f"{url}:{username or ''}"
    return f"{CACHE_KEY_PREFIX}{hashlib.md5(key_data.encode()).hexdigest()}"


def _get_cached_layers(cache_key: str) -> Optional[list[dict]]:
    """Get cached layers if still valid."""
    return cache.get(cache_key)


def _cache_layers(cache_key: str, layers: list[dict]) -> None:
    """Cache layers with TTL."""
    cache.set(cache_key, layers, timeout=CACHE_TTL_SECONDS)


def clear_capabilities_cache(url: Optional[str] = None, username: Optional[str] = None) -> None:
    """Clear cached capabilities.

    Args:
        url: If provided, only clear cache for this URL
        username: Optional username associated with the URL

    If no URL is provided, clears all WMS capabilities cache keys.
    """
    if url:
        cache_key = _get_cache_key(url, username)
        cache.delete(cache_key)
    else:
        # Clear all WMS capabilities cache keys using delete_pattern if available
        # (Redis/Memcached), otherwise this is a no-op for LocMemCache
        if hasattr(cache, "delete_pattern"):
            cache.delete_pattern(f"{CACHE_KEY_PREFIX}*")
        else:
            logger.warning("Cache backend does not support delete_pattern, cannot clear all WMS cache")


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


def calculate_recommended_min_zoom(bbox_width_deg: float) -> int:
    """Calculate recommended minimum zoom level based on BBOX width.

    At zoom 0, the world is ~360 degrees wide.
    Many WMS services reject requests with BBOX > ~40km (~0.4 deg at equator).

    Args:
        bbox_width_deg: Width of the bounding box in degrees

    Returns:
        Recommended minimum zoom level (0-22)
    """
    if bbox_width_deg <= 0:
        return 0

    # At zoom 0, tile covers ~360 degrees
    # At zoom z, tile covers ~360 / 2^z degrees
    # We want tile width <= some reasonable limit (e.g., 0.5 degrees ~ 50km at equator)
    max_tile_width_deg = 0.5

    if bbox_width_deg <= max_tile_width_deg:
        return 0

    # Calculate zoom where tile width ≤ max_tile_width_deg
    # tile_width = 360 / 2^z
    # z = log2(360 / tile_width)
    recommended_zoom = math.ceil(math.log2(360 / max_tile_width_deg))

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
        url: WMS service URL
        username: Optional username for authenticated WMS
        password: Optional password for authenticated WMS
        timeout: Request timeout in seconds

    Returns:
        Dict with service_info and layers containing recommended settings

    Raises:
        WMSServiceError: If the WMS request fails
    """
    versions_to_try = ["1.3.0", "1.1.1"]
    last_error = None

    for wms_version in versions_to_try:
        try:
            logger.debug(f"Scanning WMS capabilities using version {wms_version} for {url}")
            wms = WebMapService(
                url,
                version=wms_version,
                username=username,
                password=password,
                timeout=timeout,
            )

            # Extract service-level info
            service_info = {
                "title": wms.identification.title if wms.identification else None,
                "abstract": wms.identification.abstract if wms.identification else None,
                "version": wms_version,
                "max_width": None,
                "max_height": None,
            }

            # Try to get service constraints (not all WMS provide this)
            try:
                if hasattr(wms, "getServiceXML"):
                    # Some WMS services specify MaxWidth/MaxHeight in capabilities
                    pass  # OWSLib doesn't expose these directly
            except Exception:
                pass

            # Extract layer info with bounding boxes
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

                # Get bounding box
                try:
                    # Try WGS84 bounding box first
                    if hasattr(layer, "boundingBoxWGS84") and layer.boundingBoxWGS84:
                        bbox = layer.boundingBoxWGS84
                        layer_info["bbox"] = list(bbox)
                        layer_info["bbox_crs"] = "EPSG:4326"

                        # Calculate bbox width in degrees
                        bbox_width = abs(bbox[2] - bbox[0])
                        layer_info["recommended_min_zoom"] = calculate_recommended_min_zoom(bbox_width)
                    elif hasattr(layer, "boundingBox") and layer.boundingBox:
                        bbox = layer.boundingBox
                        layer_info["bbox"] = list(bbox[:4])
                        layer_info["bbox_crs"] = bbox[4] if len(bbox) > 4 else "unknown"
                except Exception as e:
                    logger.debug(f"Could not extract bbox for layer {layer_name}: {e}")

                # Get supported CRS
                try:
                    if hasattr(layer, "crsOptions"):
                        layer_info["supported_crs"] = list(layer.crsOptions)[:20]  # Limit to 20
                except Exception:
                    pass

                layers.append(layer_info)

            logger.info(f"Successfully scanned {len(layers)} layers from {url}")

            return {
                "service_info": service_info,
                "layers": layers,
            }

        except Exception as e:
            last_error = e
            logger.warning(f"WMS scan with version {wms_version} failed for {url}: {e}")
            continue

    logger.error(f"Failed to scan WMS capabilities from {url} with all versions")
    raise WMSServiceError(str(last_error)) from last_error
