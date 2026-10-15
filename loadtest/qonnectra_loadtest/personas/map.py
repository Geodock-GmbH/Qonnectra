"""Map persona: opens a project's map, pans and zooms, and now and then clicks.

One session is one map visit of 10–30 gestures 1–4 s apart. Every view
change requests what OpenLayers would: the app's vector tiles per layer,
WMS tiles of enabled layers in zoom range, and basemap tiles from the tile
server. A click reads the feature drawer like the app does.

Some users have the global view switched on (a saved setting, so it is on
from the start): their feature tiles carry no project filter and cover
every project, and they roam the extent of all projects. Some switch to
another project on the way, which the app does without a page load: it
builds new feature tile sources, reloads the WMS sources and leaves the
view where it was, until the user zooms to the new project. A Check run
does both in one session, by switching the global view on half way.
"""

import random
import time
from dataclasses import dataclass
from urllib.parse import quote

from qonnectra_loadtest.client import Browser, Get
from qonnectra_loadtest.fixtures import Project
from qonnectra_loadtest.tiles import (
    Extent,
    TileCache,
    View,
    fit_zoom,
    step,
    tile_bbox,
    tiles_for_view,
)

VECTOR_LAYERS = ["trench", "address", "node", "area"]

CACHE_TILES = 256
"""Tiles each source keeps, roughly OpenLayers' cache for a large viewport."""

WMS_TOKEN_TTL_SECONDS = 170
"""WMS tokens live 5 minutes; the app's heartbeat renews them every 3."""

DARK_THEME_SHARE = 0.2

GESTURES = {"pan": 5, "zoomIn": 2.5, "zoomOut": 1.5, "click": 1}
CLICKS = {"trench": 6, "node": 2.5, "address": 1.5}


def union(extents: list[Extent]) -> Extent:
    """Return the extent that covers all given extents.

    Args:
        extents: At least one extent.

    Returns:
        Extent: Their bounding box.
    """
    return (
        min(e[0] for e in extents),
        min(e[1] for e in extents),
        max(e[2] for e in extents),
        max(e[3] for e in extents),
    )


def chance(percent: float) -> bool:
    """Return True in ``percent`` of the calls.

    Args:
        percent: 0 to 100.

    Returns:
        bool: The draw.
    """
    return random.random() * 100 < percent


def weighted(weights: dict[str, float]) -> str:
    """Pick one key by weight.

    Args:
        weights: Key to relative weight.

    Returns:
        str: The chosen key.
    """
    return random.choices(list(weights), weights=list(weights.values()))[0]


@dataclass
class Basemap:
    """The tile server's vector source as ol-mapbox-style sets it up."""

    template: str
    min_zoom: int
    max_zoom: int

    def url(self, tile: tuple[int, int, int]) -> str:
        """Return the URL of one basemap tile.

        Args:
            tile: ``(z, x, y)``.

        Returns:
            str: The tile URL from the TileJSON template.
        """
        z, x, y = tile
        return (
            self.template.replace("{z}", str(z))
            .replace("{x}", str(x))
            .replace("{y}", str(y))
        )


def open_basemap(browser: Browser) -> Basemap | None:
    """Load the basemap like ``Map.svelte`` and ol-mapbox-style do.

    Health check, style, then the TileJSON of the style's vector source. When
    any of these fails the app falls back to OSM tiles, which are not ours,
    so the session goes on without basemap tiles.

    Args:
        browser: The user's browser.

    Returns:
        Basemap | None: The tile source, or None without a usable tile server.
    """
    base = browser.options.tiles_url
    if not base or not browser.options.basemap:
        return None
    health = browser.get(f"{base}/health", "basemap:health", method="HEAD")
    if not 200 <= (health.status_code or 0) < 300:
        return None
    theme = "dark" if random.random() < DARK_THEME_SHARE else "light"
    style = browser.get(f"{base}/styles/{theme}/style.json", "basemap:style")
    try:
        sources = style.json().get("sources", {})
    except (ValueError, TypeError, AttributeError):
        return None
    source_url = next(
        (
            source.get("url")
            for source in sources.values()
            if source.get("type") == "vector"
            and str(source.get("url", "")).startswith("http")
        ),
        None,
    )
    if not source_url:
        return None
    try:
        tilejson = browser.get(source_url, "basemap:tilejson").json()
        return Basemap(
            template=tilejson["tiles"][0],
            min_zoom=int(tilejson.get("minzoom", 0)),
            max_zoom=int(tilejson.get("maxzoom", 22)),
        )
    except (ValueError, TypeError, KeyError, IndexError, AttributeError):
        return None


class MapVisit:
    """One user's map session in one project."""

    def __init__(
        self,
        browser: Browser,
        project: Project,
        projects: list[Project],
        global_view: bool = False,
    ):
        """Prepare a session; nothing is requested yet.

        Args:
            browser: The user's browser.
            project: Project whose map is opened.
            projects: Projects of the run, for the global view and switching.
            global_view: Whether the user has the global view switched on.
        """
        self.browser = browser
        self.options = browser.options
        self.projects = projects
        self.global_view = global_view
        self.caches: dict[str, TileCache] = {}
        self.basemap: Basemap | None = None
        self.wms_token: tuple[str, float] | None = None
        self.enter(project)

    def enter(self, project: Project):
        """Make ``project`` the map's project with fresh feature tile sources.

        Args:
            project: The project now in the URL.
        """
        self.project = project
        self.page_path = f"/project/{project.id}/map"
        for layer in VECTOR_LAYERS:
            self.caches[layer] = TileCache(CACHE_TILES)
        self.extent = (
            union([p.extent for p in self.projects])
            if self.global_view
            else project.extent
        )
        self.min_zoom = self.fit(self.extent).zoom - 1
        """Lowest zoom the user zooms out to: one level beyond the whole area."""

    @property
    def lookup_project_id(self) -> str:
        """Return the project id the drawer and search send; empty in the global view."""
        return "" if self.global_view else str(self.project.id)

    def feature_tile(self, layer: str, tile: tuple[int, int, int]) -> Get:
        """Return the request for one feature tile of the current scope.

        Args:
            layer: One of :data:`VECTOR_LAYERS`.
            tile: ``(z, x, y)``.

        Returns:
            Get: The request, named ``tile:global:<layer>`` in the global view.
        """
        z, x, y = tile
        query = [] if self.global_view else [f"project={self.project.id}"]
        if self.options.cache == "bypass":
            query.append(f"_lt={random.getrandbits(48):x}")
        url = f"{self.options.api_url}ol_{layer}_tiles/{z}/{x}/{y}.mvt"
        if query:
            url += "?" + "&".join(query)
        name = f"tile:global:{layer}" if self.global_view else f"tile:{layer}"
        return Get(url, name)

    def current_wms_token(self) -> str:
        """Return a fresh WMS access token, fetching one when the cached one is old."""
        if (
            self.wms_token is None
            or time.time() - self.wms_token[1] > WMS_TOKEN_TTL_SECONDS
        ):
            response = self.browser.api("wms-sources/access_token/", "wms:access_token")
            try:
                token = response.json().get("token", "")
            except (ValueError, TypeError, AttributeError):
                token = ""
            self.wms_token = (token, time.time())
        return self.wms_token[0]

    def view_requests(self, view: View) -> list[Get]:
        """Return every tile request a view change causes.

        Args:
            view: The new view.

        Returns:
            list[Get]: Tiles not yet in the per-source caches.
        """
        tiles = tiles_for_view(view)
        api = self.options.api_url
        gets = []
        for layer in VECTOR_LAYERS:
            for tile in self.caches[layer].missing(tiles):
                gets.extend(
                    self.feature_tile(layer, tile)
                    for _ in range(self.options.tile_factor)
                )

        visible_wms = [
            layer
            for layer in self.project.wms_layers
            if view.zoom > layer.min_zoom
            and (layer.max_zoom is None or view.zoom <= layer.max_zoom)
        ]
        if visible_wms:
            token = quote(self.current_wms_token(), safe="")
            for layer in visible_wms:
                cache = self.caches.setdefault(
                    f"wms:{layer.source}:{layer.name}", TileCache(CACHE_TILES)
                )
                for tile in cache.missing(tiles):
                    gets.append(
                        Get(
                            f"{api}wms-proxy/{layer.source}/?token={token}"
                            "&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image%2Fpng"
                            f"&TRANSPARENT=true&LAYERS={quote(layer.name, safe='')}&CRS=EPSG%3A3857"
                            f"&STYLES=&WIDTH=512&HEIGHT=512&BBOX={tile_bbox(tile)}",
                            "tile:wms",
                        )
                    )

        basemap = self.basemap
        if basemap and tiles and tiles[0][0] >= basemap.min_zoom:
            cache = self.caches.setdefault("basemap", TileCache(CACHE_TILES))
            for tile in cache.missing(tiles_for_view(view, basemap.max_zoom)):
                gets.append(Get(basemap.url(tile), "tile:basemap"))
        return gets

    def click(self):
        """Click a known feature and open some of its drawer tabs."""
        kind = weighted(CLICKS)
        shown = random.choice(self.projects) if self.global_view else self.project
        uuids = shown.features.get(kind) or []
        if not uuids:
            return
        uuid = random.choice(uuids)
        search = f"?feature={kind}:{uuid}"
        self.browser.remote(
            "getFeatureDetails",
            {
                "featureType": kind,
                "featureUuid": uuid,
                "projectId": self.lookup_project_id,
            },
            self.page_path,
            search,
        )
        if kind != "trench":
            return
        self.browser.remote("getConduitsInTrench", uuid, self.page_path, search)
        self.browser.think(1, 3)
        if random.random() < 0.3:
            self.browser.remote("getCablesInTrench", uuid, self.page_path, search)
        if random.random() < 0.2:
            self.browser.remote("getTrenchProfile", uuid, self.page_path, search)

    def fit(self, extent: Extent) -> View:
        """Return the view that shows ``extent``, like ``view.fit()``.

        Args:
            extent: EPSG:3857 extent.

        Returns:
            View: Centered on the extent at the zoom that fits it.
        """
        width, height = self.options.viewport
        return View(
            x=(extent[0] + extent[2]) / 2,
            y=(extent[1] + extent[3]) / 2,
            zoom=fit_zoom(extent, width, height),
            width=width,
            height=height,
        )

    def switch_project(self, view: View) -> View:
        """Pick another project in the project switcher, then zoom to it.

        Args:
            view: The view before the switch, which the map keeps.

        Returns:
            View: The view on the new project.
        """
        browser = self.browser
        self.enter(random.choice([p for p in self.projects if p.id != self.project.id]))
        if self.options.wms:
            browser.api(f"wms-sources/?project={self.project.id}", "wms:sources")
        browser.fetch_all(self.view_requests(view))
        browser.think(1, 3)
        browser.remote(
            "getLayerExtent",
            {"layerType": "trench", "projectId": str(self.project.id)},
            self.page_path,
        )
        view = self.fit(self.project.extent)
        browser.fetch_all(self.view_requests(view))
        return view

    def toggle_global_view(self, view: View):
        """Switch the global view on: new feature tile sources without a project filter.

        Args:
            view: The current view, which stays.
        """
        self.global_view = True
        self.enter(self.project)
        self.browser.fetch_all(self.view_requests(view))

    def run(self, switch: bool = False, toggle_global: bool = False):
        """Open the map and work in it for 10–30 gestures.

        Args:
            switch: Switch to another project at a random gesture.
            toggle_global: Switch the global view on at another random gesture.
        """
        browser = self.browser
        browser.page(self.page_path, "page:map")
        browser.remote("getLayerStyleAttributes", None, self.page_path)
        if self.options.wms:
            self.current_wms_token()
            browser.api(f"wms-sources/?project={self.project.id}", "wms:sources")
        self.basemap = open_basemap(browser)

        view = self.fit(self.project.extent)
        browser.fetch_all(self.view_requests(view))

        gestures = random.randint(10, 30)
        switch_at, toggle_at = random.sample(range(gestures), 2)
        for index in range(gestures):
            browser.think(1, 4)
            if switch and index == switch_at:
                view = self.switch_project(view)
                continue
            if toggle_global and index == toggle_at:
                self.toggle_global_view(view)
                continue
            gesture = weighted(GESTURES)
            if gesture == "click":
                self.click()
                continue
            view = step(view, gesture, self.extent, random.random, self.min_zoom)
            browser.fetch_all(self.view_requests(view))


def map_session(browser: Browser, projects: list[Project], cover_all: bool = False):
    """Run one map session in a random project.

    Args:
        browser: The user's browser.
        projects: Projects of the run.
        cover_all: Switch project and the global view in this session,
            whatever the shares say, so a Check run requests every kind.
    """
    options = browser.options
    can_switch = len(projects) > 1
    if cover_all:
        visit = MapVisit(browser, random.choice(projects), projects)
        visit.run(switch=can_switch, toggle_global=True)
        return
    MapVisit(
        browser,
        random.choice(projects),
        projects,
        global_view=chance(options.global_share),
    ).run(switch=can_switch and chance(options.switch_share))
