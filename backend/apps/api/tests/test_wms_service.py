"""Tests for WMS service module (capabilities fetching, caching, zoom calculation)."""

from unittest.mock import Mock, patch

import pytest
from apps.api.wms_service import (
    WMSServiceError,
    _cache_layers,
    _get_cache_key,
    _get_cached_layers,
    calculate_recommended_min_zoom,
    clear_capabilities_cache,
    fetch_wms_layers,
)
from django.core.cache import cache


@pytest.fixture(autouse=True)
def clear_wms_cache():
    """Clear the cache before and after each test."""
    cache.clear()
    yield
    cache.clear()


class TestGetCacheKey:
    """Tests for _get_cache_key helper."""

    def test_same_inputs_produce_same_key(self):
        """Verify deterministic key generation."""
        key1 = _get_cache_key("https://wms.example.com", "user1")
        key2 = _get_cache_key("https://wms.example.com", "user1")
        assert key1 == key2

    def test_different_urls_produce_different_keys(self):
        """Verify different URLs produce different cache keys."""
        key1 = _get_cache_key("https://wms1.example.com")
        key2 = _get_cache_key("https://wms2.example.com")
        assert key1 != key2

    def test_different_usernames_produce_different_keys(self):
        """Verify username scopes the cache key."""
        key1 = _get_cache_key("https://wms.example.com", "user1")
        key2 = _get_cache_key("https://wms.example.com", "user2")
        assert key1 != key2

    def test_none_username_same_as_empty(self):
        """Verify None username produces same key as no username."""
        key1 = _get_cache_key("https://wms.example.com", None)
        key2 = _get_cache_key("https://wms.example.com")
        assert key1 == key2


class TestCacheHelpers:
    """Tests for _get_cached_layers and _cache_layers."""

    def test_cache_miss_returns_none(self):
        """Verify cache miss returns None."""
        assert _get_cached_layers("nonexistent_key") is None

    def test_cache_roundtrip(self):
        """Verify cached layers can be retrieved."""
        layers = [{"name": "layer1", "title": "Layer 1"}]
        key = _get_cache_key("https://test.com")
        _cache_layers(key, layers)
        assert _get_cached_layers(key) == layers


class TestClearCapabilitiesCache:
    """Tests for clear_capabilities_cache."""

    def test_clear_specific_url(self):
        """Verify clearing cache for a specific URL."""
        key = _get_cache_key("https://wms.example.com")
        _cache_layers(key, [{"name": "test"}])
        assert _get_cached_layers(key) is not None

        clear_capabilities_cache("https://wms.example.com")
        assert _get_cached_layers(key) is None

    def test_clear_all_without_delete_pattern_logs_warning(self):
        """Verify warning when cache backend lacks delete_pattern."""
        with patch("apps.api.wms_service.logger") as mock_logger:
            clear_capabilities_cache()
            mock_logger.warning.assert_called_once()


class TestCalculateRecommendedMinZoom:
    """Tests for calculate_recommended_min_zoom."""

    def test_zero_returns_zero(self):
        """Verify zero bbox width returns zoom 0."""
        assert calculate_recommended_min_zoom(0) == 0

    def test_negative_returns_zero(self):
        """Verify negative bbox width returns zoom 0."""
        assert calculate_recommended_min_zoom(-1.0) == 0

    def test_small_bbox_returns_zero(self):
        """Verify bbox <= 0.5 degrees returns zoom 0."""
        assert calculate_recommended_min_zoom(0.5) == 0
        assert calculate_recommended_min_zoom(0.1) == 0

    def test_large_bbox_returns_expected_zoom(self):
        """Verify larger bbox returns lower zoom (wider view needed)."""
        assert calculate_recommended_min_zoom(1.0) == 9
        assert calculate_recommended_min_zoom(100.0) == 2

    def test_result_clamped_to_22(self):
        """Verify result is clamped to maximum zoom 22."""
        result = calculate_recommended_min_zoom(1.0)
        assert result <= 22


class TestFetchWmsLayers:
    """Tests for fetch_wms_layers with mocked WebMapService."""

    @patch("apps.api.wms_service.WebMapService")
    def test_successful_fetch(self, mock_wms_cls):
        """Verify layers are returned from WMS capabilities."""
        mock_layer = Mock()
        mock_layer.name = "roads"
        mock_layer.title = "Roads Layer"

        mock_wms = Mock()
        mock_wms.contents = {"roads": mock_layer}
        mock_wms_cls.return_value = mock_wms

        layers = fetch_wms_layers("https://wms.example.com")
        assert len(layers) == 1
        assert layers[0]["name"] == "roads"
        assert layers[0]["title"] == "Roads Layer"

    @patch("apps.api.wms_service.WebMapService")
    def test_version_fallback(self, mock_wms_cls):
        """Verify fallback from 1.3.0 to 1.1.1 on failure."""
        mock_layer = Mock()
        mock_layer.name = "test"
        mock_layer.title = "Test"

        mock_wms = Mock()
        mock_wms.contents = {"test": mock_layer}

        mock_wms_cls.side_effect = [
            Exception("1.3.0 not supported"),
            mock_wms,
        ]

        layers = fetch_wms_layers("https://wms.example.com", use_cache=False)
        assert len(layers) == 1
        assert mock_wms_cls.call_count == 2

    @patch("apps.api.wms_service.WebMapService")
    def test_all_versions_fail_raises_error(self, mock_wms_cls):
        """Verify WMSServiceError raised when all versions fail."""
        mock_wms_cls.side_effect = Exception("Connection failed")

        with pytest.raises(WMSServiceError):
            fetch_wms_layers("https://wms.example.com", use_cache=False)

    @patch("apps.api.wms_service.WebMapService")
    def test_cache_hit_skips_wms_call(self, mock_wms_cls):
        """Verify cached layers are returned without making a WMS request."""
        key = _get_cache_key("https://wms.example.com")
        cached_layers = [{"name": "cached", "title": "Cached"}]
        _cache_layers(key, cached_layers)

        result = fetch_wms_layers("https://wms.example.com")
        assert result == cached_layers
        mock_wms_cls.assert_not_called()

    @patch("apps.api.wms_service.WebMapService")
    def test_use_cache_false_bypasses_cache(self, mock_wms_cls):
        """Verify use_cache=False bypasses cached results."""
        key = _get_cache_key("https://wms.example.com")
        _cache_layers(key, [{"name": "old", "title": "Old"}])

        mock_layer = Mock()
        mock_layer.name = "fresh"
        mock_layer.title = "Fresh"
        mock_wms = Mock()
        mock_wms.contents = {"fresh": mock_layer}
        mock_wms_cls.return_value = mock_wms

        result = fetch_wms_layers("https://wms.example.com", use_cache=False)
        assert result[0]["name"] == "fresh"
        mock_wms_cls.assert_called_once()

    @patch("apps.api.wms_service.WebMapService")
    def test_specific_version_no_fallback(self, mock_wms_cls):
        """Verify specific version does not trigger fallback."""
        mock_wms_cls.side_effect = Exception("Failed")

        with pytest.raises(WMSServiceError):
            fetch_wms_layers(
                "https://wms.example.com", version="1.3.0", use_cache=False
            )

        assert mock_wms_cls.call_count == 1
