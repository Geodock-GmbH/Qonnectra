"""Viewport-to-tile math for the map persona, mirroring OpenLayers in the app.

The view is EPSG:3857 with 256 px based zoom levels. Feature, WMS and
basemap sources all use a 512 px XYZ grid, so tile zoom = round(view zoom)
- 1. The basemap additionally stops at its TileJSON ``maxzoom`` and
overzooms beyond it, like ol-mapbox-style's tile grid.
"""

import math
from collections import OrderedDict
from dataclasses import dataclass, replace

HALF_WORLD = 20037508.342789244
WORLD = HALF_WORLD * 2
RESOLUTION_Z0 = WORLD / 256

MIN_VIEW_ZOOM = 3
MAX_VIEW_ZOOM = 21

Extent = tuple[float, float, float, float]
Tile = tuple[int, int, int]
"""``(z, x, y)`` of one XYZ tile."""


@dataclass(frozen=True)
class View:
    """What one browser window shows of the map."""

    x: float
    y: float
    zoom: int
    width: int
    height: int


def resolution(zoom: float) -> float:
    """Return the view resolution in metres per pixel.

    Args:
        zoom: View zoom.

    Returns:
        float: Metres per CSS pixel.
    """
    return RESOLUTION_Z0 / 2**zoom


def tile_zoom(zoom: float) -> int:
    """Return the 512 px tile zoom OpenLayers picks for a view zoom.

    Args:
        zoom: View zoom.

    Returns:
        int: Tile zoom, at least 0.
    """
    return max(0, round(zoom) - 1)


def view_extent(view: View) -> Extent:
    """Return the extent a view shows.

    Args:
        view: The browser view.

    Returns:
        Extent: ``(min_x, min_y, max_x, max_y)`` in EPSG:3857.
    """
    half_w = view.width * resolution(view.zoom) / 2
    half_h = view.height * resolution(view.zoom) / 2
    return (view.x - half_w, view.y - half_h, view.x + half_w, view.y + half_h)


def tiles_for_view(view: View, max_zoom: int | None = None) -> list[Tile]:
    """List the tiles that cover a view.

    Args:
        view: The browser view.
        max_zoom: Highest tile zoom the source has; deeper views reuse its
            tiles (overzoom), so fewer distinct tiles cover the view.

    Returns:
        list[Tile]: Tiles in column-major order.
    """
    z = tile_zoom(view.zoom)
    if max_zoom is not None:
        z = min(z, max_zoom)
    count = 2**z
    size = WORLD / count
    min_x, min_y, max_x, max_y = view_extent(view)

    def clamp(value: int) -> int:
        """Keep a tile index inside the grid."""
        return min(count - 1, max(0, value))

    x0 = clamp(math.floor((min_x + HALF_WORLD) / size))
    x1 = clamp(math.floor((max_x + HALF_WORLD) / size))
    y0 = clamp(math.floor((HALF_WORLD - max_y) / size))
    y1 = clamp(math.floor((HALF_WORLD - min_y) / size))
    return [(z, x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)]


def tile_bbox(tile: Tile) -> str:
    """Return a tile's bounding box in EPSG:3857, as WMS GetMap expects it.

    Args:
        tile: ``(z, x, y)``.

    Returns:
        str: ``min_x,min_y,max_x,max_y``.
    """
    z, x, y = tile
    size = WORLD / 2**z
    min_x = -HALF_WORLD + x * size
    max_y = HALF_WORLD - y * size
    return f"{min_x},{max_y - size},{min_x + size},{max_y}"


def fit_zoom(extent: Extent, width: int, height: int) -> int:
    """Return the integer view zoom at which an extent fills the viewport.

    Like ``view.fit()`` when the map opens on a project.

    Args:
        extent: EPSG:3857 extent.
        width: Viewport width in pixels.
        height: Viewport height in pixels.

    Returns:
        int: Zoom between :data:`MIN_VIEW_ZOOM` and :data:`MAX_VIEW_ZOOM`.
    """
    span_x = max(extent[2] - extent[0], 1)
    span_y = max(extent[3] - extent[1], 1)
    zoom = math.floor(
        math.log2(min(RESOLUTION_Z0 * width / span_x, RESOLUTION_Z0 * height / span_y))
    )
    return min(MAX_VIEW_ZOOM, max(MIN_VIEW_ZOOM, zoom))


def step(view: View, gesture: str, extent: Extent, random, min_zoom: int) -> View:
    """Move a view by one user gesture.

    A pan moves 30-70 % of the viewport in a random direction, a zoom moves
    one level around the center. The center stays inside ``extent``.

    Args:
        view: Current view.
        gesture: ``pan``, ``zoomIn`` or ``zoomOut``.
        extent: Area the user works in.
        random: Source of [0, 1) numbers, e.g. ``random.random``.
        min_zoom: Lowest zoom the user zooms out to.

    Returns:
        View: The next view.
    """
    if gesture == "zoomIn":
        return replace(view, zoom=min(MAX_VIEW_ZOOM, view.zoom + 1))
    if gesture == "zoomOut":
        return replace(view, zoom=max(min_zoom, view.zoom - 1))

    angle = random() * 2 * math.pi
    fraction = 0.3 + random() * 0.4
    res = resolution(view.zoom)
    x = view.x + math.cos(angle) * fraction * view.width * res
    y = view.y + math.sin(angle) * fraction * view.height * res
    return replace(
        view,
        x=min(extent[2], max(extent[0], x)),
        y=min(extent[3], max(extent[1], y)),
    )


class TileCache:
    """Remember loaded tiles like an OpenLayers source tile cache.

    A pan then only requests the tiles that newly came into view. The least
    recently used tiles are evicted first.
    """

    def __init__(self, capacity: int):
        """Create an empty cache.

        Args:
            capacity: Tiles kept before eviction.
        """
        self.capacity = capacity
        self.keys: OrderedDict[Tile, None] = OrderedDict()

    def missing(self, tiles: list[Tile]) -> list[Tile]:
        """Return the tiles not cached yet and mark all of them as cached.

        Args:
            tiles: Tiles the view needs.

        Returns:
            list[Tile]: Tiles to request.
        """
        result = []
        for tile in tiles:
            if tile in self.keys:
                self.keys.move_to_end(tile)
            else:
                result.append(tile)
                self.keys[tile] = None
        while len(self.keys) > self.capacity:
            self.keys.popitem(last=False)
        return result
