"""Checks how run options and target URLs are derived."""

from types import SimpleNamespace

import pytest

from qonnectra_loadtest.config import RunOptions, default_urls, internal_api_url


def parsed(**overrides):
    """Return Locust-style parsed options with defaults."""
    values = {
        "projects": "all",
        "cache": "on",
        "wms": True,
        "basemap": True,
        "tile_factor": 2,
        "think": 1.0,
        "viewport": "1600x900",
        "api_url": "https://api.example.com/api/v1",
        "tiles_url": "https://tiles.example.com/",
        "limit_tile_ms": 1000,
        "limit_err_pct": 1.0,
    }
    return SimpleNamespace(**{**values, **overrides})


def test_urls_follow_the_deployment_env():
    """Verify the public URLs are built from the compose .env values."""
    urls = default_urls(
        {
            "APP_DOMAIN": "app.example.com",
            "API_DOMAIN": "api.example.com",
            "PUBLIC_TILE_SERVER_URL": "https://tiles.example.com/",
        }
    )

    assert urls == {
        "app": "https://app.example.com",
        "api": "https://api.example.com/api/v1/",
        "tiles": "https://tiles.example.com",
    }
    assert default_urls({}) == {"app": "", "api": "", "tiles": ""}


def test_internal_api_prefers_the_frontend_setting():
    """Verify the login check uses the same internal URL as SvelteKit."""
    assert (
        internal_api_url({"API_URL": "http://backend:8000/api/v1"})
        == "http://backend:8000/api/v1/"
    )
    assert internal_api_url({}) == "http://nginx/api/v1/"


def test_options_are_normalised():
    """Verify slashes, numbers and the viewport are cleaned up."""
    options = RunOptions.from_parsed(
        parsed(
            tile_factor="0",
            think="0.5",
            viewport="1280X720",
            projects=" ",
            limit_tile_ms="1500",
            limit_err_pct="-1",
        ),
        "https://app.example.com/",
    )

    assert options.app_url == "https://app.example.com"
    assert options.api_url == "https://api.example.com/api/v1/"
    assert options.tiles_url == "https://tiles.example.com"
    assert (options.tile_factor, options.think, options.viewport) == (
        1,
        0.5,
        (1280, 720),
    )
    assert options.projects == "all"
    assert (options.limit_tile_ms, options.limit_err_pct) == (1500, 0.0)


def test_missing_urls_are_refused():
    """Verify a run without app or API URL does not start."""
    with pytest.raises(ValueError):
        RunOptions.from_parsed(parsed(), "")
    with pytest.raises(ValueError):
        RunOptions.from_parsed(parsed(api_url=""), "https://app.example.com")
