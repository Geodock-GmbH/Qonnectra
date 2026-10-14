"""Checks the map persona's tile math, so a run requests what a real viewport needs."""

import random

from qonnectra_loadtest.tiles import (
    TileCache,
    View,
    fit_zoom,
    step,
    tile_bbox,
    tile_zoom,
    tiles_for_view,
    view_extent,
)

KASSEL = (1056000.0, 6672000.0)


def kassel(zoom: int) -> View:
    """Return a 1600x900 view over Kassel."""
    return View(x=KASSEL[0], y=KASSEL[1], zoom=zoom, width=1600, height=900)


def test_512px_grid_uses_one_zoom_level_below_the_view():
    """Verify OpenLayers' 512 px tile zoom."""
    assert tile_zoom(17) == 16
    assert tile_zoom(16.6) == 16
    assert tile_zoom(0) == 0


def test_a_1600x900_view_needs_about_4x3_tiles():
    """Verify the tile count of a typical desktop window."""
    tiles = tiles_for_view(kassel(17))

    assert 6 <= len(tiles) <= 12
    assert all(z == 16 for z, _, _ in tiles)


def test_tiles_cover_the_whole_view():
    """Verify the union of tile boxes contains the view extent."""
    view = kassel(15)
    min_x, min_y, max_x, max_y = view_extent(view)
    boxes = [
        list(map(float, tile_bbox(tile).split(","))) for tile in tiles_for_view(view)
    ]

    assert min(b[0] for b in boxes) <= min_x
    assert min(b[1] for b in boxes) <= min_y
    assert max(b[2] for b in boxes) >= max_x
    assert max(b[3] for b in boxes) >= max_y


def test_basemap_overzooms_beyond_its_max_zoom():
    """Verify deep views reuse the basemap's deepest tiles, so fewer are needed."""
    deep = kassel(19)

    capped = tiles_for_view(deep, max_zoom=14)

    assert {z for z, _, _ in capped} == {14}
    assert len(capped) < len(tiles_for_view(deep))
    assert tiles_for_view(kassel(15), max_zoom=14) == tiles_for_view(kassel(15))


def test_fit_zoom_fits_a_5km_extent():
    """Verify the opening zoom shows the whole project extent."""
    extent = (KASSEL[0] - 2500, KASSEL[1] - 2500, KASSEL[0] + 2500, KASSEL[1] + 2500)
    zoom = fit_zoom(extent, 1600, 900)
    min_x, min_y, max_x, max_y = view_extent(kassel(zoom))

    assert max_x - min_x >= 5000 and max_y - min_y >= 5000
    assert 13 <= zoom <= 15


def test_a_pan_keeps_the_center_inside_the_work_extent():
    """Verify panning never leaves the project area."""
    extent = (0.0, 0.0, 100.0, 100.0)
    view = View(x=50, y=50, zoom=10, width=1600, height=900)
    for _ in range(20):
        view = step(view, "pan", extent, random.random, 5)

    assert 0 <= view.x <= 100 and 0 <= view.y <= 100


def test_zoom_gestures_respect_the_limits():
    """Verify zooming out stops at the minimum zoom."""
    view = View(x=0, y=0, zoom=6, width=10, height=10)

    assert step(view, "zoomOut", (0, 0, 1, 1), random.random, 6).zoom == 6
    assert step(view, "zoomIn", (0, 0, 1, 1), random.random, 6).zoom == 7


def test_tile_cache_only_reports_new_tiles():
    """Verify a pan requests only the tiles that came into view."""
    cache = TileCache(100)
    view = kassel(17)
    first = cache.missing(tiles_for_view(view))
    again = cache.missing(tiles_for_view(view))
    panned = cache.missing(
        tiles_for_view(View(view.x + 600, view.y, view.zoom, view.width, view.height))
    )

    assert again == []
    assert 0 < len(panned) < len(first)


def test_tile_cache_evicts_the_least_recently_used():
    """Verify the cache forgets the oldest tiles beyond its capacity."""
    cache = TileCache(2)
    cache.missing([(1, 0, 0), (1, 1, 0), (1, 0, 1)])

    assert cache.missing([(1, 0, 0)]) == [(1, 0, 0)]
