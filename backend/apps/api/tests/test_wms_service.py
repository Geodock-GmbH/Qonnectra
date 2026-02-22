"""Tests for WMS service module."""

import pytest
from unittest.mock import patch, MagicMock

from apps.api.wms_service import fetch_wms_layers, WMSServiceError


class TestFetchWMSLayers:
    """Tests for fetch_wms_layers function."""

    def test_fetch_layers_success(self):
        """Should return list of layers from GetCapabilities."""
        mock_wms = MagicMock()
        mock_wms.contents = {
            "layer1": MagicMock(name="layer1", title="Layer One"),
            "layer2": MagicMock(name="layer2", title="Layer Two"),
        }
        mock_wms.contents["layer1"].name = "layer1"
        mock_wms.contents["layer1"].title = "Layer One"
        mock_wms.contents["layer2"].name = "layer2"
        mock_wms.contents["layer2"].title = "Layer Two"

        with patch("apps.api.wms_service.WebMapService", return_value=mock_wms):
            layers = fetch_wms_layers("https://example.com/wms")

        assert len(layers) == 2
        assert {"name": "layer1", "title": "Layer One"} in layers
        assert {"name": "layer2", "title": "Layer Two"} in layers

    def test_fetch_layers_with_auth(self):
        """Should pass credentials to WMS service."""
        mock_wms = MagicMock()
        mock_wms.contents = {}

        with patch("apps.api.wms_service.WebMapService", return_value=mock_wms) as mock_class:
            fetch_wms_layers("https://example.com/wms", username="user", password="pass")

        mock_class.assert_called_once()
        call_kwargs = mock_class.call_args[1]
        assert call_kwargs.get("username") == "user"
        assert call_kwargs.get("password") == "pass"

    def test_fetch_layers_connection_error(self):
        """Should raise WMSServiceError on connection failure."""
        with patch("apps.api.wms_service.WebMapService", side_effect=Exception("Connection failed")):
            with pytest.raises(WMSServiceError) as exc_info:
                fetch_wms_layers("https://example.com/wms")

        assert "Connection failed" in str(exc_info.value)

    def test_fetch_layers_invalid_url(self):
        """Should raise WMSServiceError for invalid WMS URL."""
        with patch("apps.api.wms_service.WebMapService", side_effect=Exception("Not a valid WMS")):
            with pytest.raises(WMSServiceError):
                fetch_wms_layers("https://not-a-wms.com")
