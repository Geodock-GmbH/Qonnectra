"""
Management command to pre-warm WMS tile cache.

Fetches tiles for common zoom levels via the proxy endpoint to populate
the Nginx cache, reducing cold-start latency for users.
"""

import math
import time

import requests
from django.core.management.base import BaseCommand

from apps.api.models import WMSSource


def tile_to_bbox(x, y, z):
    """Convert Web Mercator tile coordinates to BBOX in EPSG:3857."""
    n = 2**z
    tile_size = 40075016.686 / n  # Web Mercator extent / number of tiles

    min_x = -20037508.343 + x * tile_size
    max_x = min_x + tile_size
    max_y = 20037508.343 - y * tile_size
    min_y = max_y - tile_size

    return f"{min_x},{min_y},{max_x},{max_y}"


def lat_lon_to_tile(lat, lon, zoom):
    """Convert lat/lon to tile x,y coordinates."""
    lat_rad = math.radians(lat)
    n = 2**zoom
    x = int((lon + 180) / 360 * n)
    y = int((1 - math.asinh(math.tan(lat_rad)) / math.pi) / 2 * n)
    return x, y


class Command(BaseCommand):
    help = "Pre-warm WMS tile cache for common zoom levels"

    def add_arguments(self, parser):
        parser.add_argument(
            "--source-id",
            type=str,
            help="Specific WMS source UUID (default: all active sources)",
        )
        parser.add_argument(
            "--zoom-min",
            type=int,
            default=10,
            help="Minimum zoom level to warm (default: 10)",
        )
        parser.add_argument(
            "--zoom-max",
            type=int,
            default=14,
            help="Maximum zoom level to warm (default: 14)",
        )
        parser.add_argument(
            "--delay",
            type=float,
            default=0.2,
            help="Delay between requests in seconds (default: 0.2)",
        )
        parser.add_argument(
            "--bbox",
            type=str,
            help="Bounding box as 'min_lon,min_lat,max_lon,max_lat' in WGS84",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be done without making requests",
        )
        parser.add_argument(
            "--proxy-url",
            type=str,
            default="http://nginx/api/v1/wms-proxy",
            help="Base URL for WMS proxy (default: http://nginx/api/v1/wms-proxy)",
        )

    def handle(self, *args, **options):
        source_id = options.get("source_id")
        zoom_min = options["zoom_min"]
        zoom_max = options["zoom_max"]
        delay = options["delay"]
        bbox_str = options.get("bbox")
        dry_run = options["dry_run"]
        proxy_url = options["proxy_url"]

        if source_id:
            sources = WMSSource.objects.filter(id=source_id, is_active=True)
        else:
            sources = WMSSource.objects.filter(is_active=True)

        if not sources.exists():
            self.stdout.write(self.style.WARNING("No active WMS sources found"))
            return

        # Default BBOX: Germany approximate extent in WGS84
        if bbox_str:
            min_lon, min_lat, max_lon, max_lat = map(float, bbox_str.split(","))
        else:
            min_lon, min_lat, max_lon, max_lat = 5.8, 47.2, 15.1, 55.1
            self.stdout.write(f"Using default BBOX (Germany): {min_lon},{min_lat},{max_lon},{max_lat}")

        total_tiles = 0
        cached_tiles = 0
        failed_tiles = 0

        for source in sources:
            layers = source.layers.filter(is_enabled=True)
            if not layers.exists():
                self.stdout.write(f"Skipping source '{source.name}': no enabled layers")
                continue

            self.stdout.write(f"\nWarming cache for source: {source.name}")

            for layer in layers:
                layer_zoom_min = max(zoom_min, layer.min_zoom or 0)
                layer_zoom_max = min(zoom_max, layer.max_zoom or 22)

                self.stdout.write(f"  Layer: {layer.name} (zoom {layer_zoom_min}-{layer_zoom_max})")

                for zoom in range(layer_zoom_min, layer_zoom_max + 1):
                    min_tile_x, max_tile_y = lat_lon_to_tile(min_lat, min_lon, zoom)
                    max_tile_x, min_tile_y = lat_lon_to_tile(max_lat, max_lon, zoom)

                    tiles_at_zoom = (max_tile_x - min_tile_x + 1) * (max_tile_y - min_tile_y + 1)
                    self.stdout.write(f"    Zoom {zoom}: {tiles_at_zoom} tiles")

                    if dry_run:
                        total_tiles += tiles_at_zoom
                        continue

                    for x in range(min_tile_x, max_tile_x + 1):
                        for y in range(min_tile_y, max_tile_y + 1):
                            total_tiles += 1
                            bbox = tile_to_bbox(x, y, zoom)

                            url = f"{proxy_url}/{source.id}/"
                            params = {
                                "SERVICE": "WMS",
                                "REQUEST": "GetMap",
                                "VERSION": "1.3.0",
                                "LAYERS": layer.name,
                                "CRS": "EPSG:3857",
                                "BBOX": bbox,
                                "WIDTH": "256",
                                "HEIGHT": "256",
                                "FORMAT": "image/png",
                                "TRANSPARENT": "true",
                            }

                            try:
                                response = requests.get(url, params=params, timeout=60)
                                if response.status_code == 200:
                                    cache_status = response.headers.get("X-Cache-Status", "UNKNOWN")
                                    if cache_status == "HIT":
                                        cached_tiles += 1
                                    self.stdout.write(
                                        f"      Tile {x},{y} z{zoom}: {cache_status}",
                                        ending="\r",
                                    )
                                else:
                                    failed_tiles += 1
                                    self.stderr.write(
                                        f"      Tile {x},{y} z{zoom}: HTTP {response.status_code}"
                                    )
                            except requests.RequestException as e:
                                failed_tiles += 1
                                self.stderr.write(f"      Tile {x},{y} z{zoom}: {e}")

                            time.sleep(delay)

                    self.stdout.write("")  # Newline after zoom level

        self.stdout.write("")
        if dry_run:
            self.stdout.write(self.style.SUCCESS(f"Dry run: would fetch {total_tiles} tiles"))
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Cache warming complete: {total_tiles} tiles processed, "
                    f"{cached_tiles} already cached, {failed_tiles} failed"
                )
            )
