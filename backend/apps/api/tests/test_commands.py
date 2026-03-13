"""Tests for management command helper functions."""

import math

import pytest
from apps.api.management.commands.warm_wms_cache import lat_lon_to_tile, tile_to_bbox
from apps.api.management.commands.parse_pg_errors import Command as ParsePgErrorsCommand
from apps.api.models import LogEntry


class TestTileToBbox:
    """Tests for tile_to_bbox coordinate conversion."""

    def test_zoom_zero_covers_world(self):
        """Verify zoom 0 tile (0,0) covers the full world extent."""
        bbox = tile_to_bbox(0, 0, 0)
        parts = [float(p) for p in bbox.split(",")]
        min_x, min_y, max_x, max_y = parts

        assert min_x == pytest.approx(-20037508.343, abs=1)
        assert max_x == pytest.approx(20037508.343, abs=1)

    def test_higher_zoom_produces_smaller_tiles(self):
        """Verify tiles get smaller at higher zoom levels."""
        bbox_z1 = tile_to_bbox(0, 0, 1)
        bbox_z2 = tile_to_bbox(0, 0, 2)

        width_z1 = float(bbox_z1.split(",")[2]) - float(bbox_z1.split(",")[0])
        width_z2 = float(bbox_z2.split(",")[2]) - float(bbox_z2.split(",")[0])

        assert width_z1 > width_z2
        assert width_z1 == pytest.approx(width_z2 * 2, rel=0.001)

    def test_adjacent_tiles_share_edges(self):
        """Verify adjacent tiles share common edges (no gaps)."""
        bbox_left = tile_to_bbox(0, 0, 1)
        bbox_right = tile_to_bbox(1, 0, 1)

        left_max_x = float(bbox_left.split(",")[2])
        right_min_x = float(bbox_right.split(",")[0])

        assert left_max_x == pytest.approx(right_min_x, abs=0.001)


class TestLatLonToTile:
    """Tests for lat_lon_to_tile coordinate conversion."""

    def test_center_of_world(self):
        """Verify (0, 0) at zoom 1 gives expected tile."""
        x, y = lat_lon_to_tile(0, 0, 1)
        assert x == 1
        assert y == 1

    def test_germany_at_zoom_10(self):
        """Verify a known German location converts to valid tile coordinates."""
        x, y = lat_lon_to_tile(51.5, 10.0, 10)
        assert 525 <= x <= 545
        assert 335 <= y <= 345

    def test_roundtrip_point_in_bbox(self):
        """Verify a point falls inside its own tile's BBOX after round-trip."""
        lat, lon, zoom = 52.52, 13.405, 12
        tx, ty = lat_lon_to_tile(lat, lon, zoom)
        bbox = tile_to_bbox(tx, ty, zoom)
        parts = [float(p) for p in bbox.split(",")]
        min_x, min_y, max_x, max_y = parts

        # Convert lat/lon to Web Mercator for comparison
        x_merc = lon * 20037508.343 / 180
        lat_rad = math.radians(lat)
        y_merc = math.log(math.tan(math.pi / 4 + lat_rad / 2)) * 20037508.343 / math.pi

        assert min_x <= x_merc <= max_x
        assert min_y <= y_merc <= max_y

    def test_zoom_zero(self):
        """Verify zoom 0 always returns (0, 0)."""
        x, y = lat_lon_to_tile(0, 0, 0)
        assert x == 0
        assert y == 0


@pytest.mark.django_db
class TestProcessErrorBlock:
    """Tests for parse_pg_errors _process_error_block method."""

    @pytest.fixture
    def command(self):
        """Create a ParsePgErrorsCommand instance."""
        return ParsePgErrorsCommand()

    def test_parses_error_with_detail_and_statement(self, command):
        """Verify parsing a full error block with ERROR, DETAIL, and STATEMENT."""
        lines = [
            'ERROR:  relation "public.missing_table" does not exist',
            "DETAIL:  The requested table was not found.",
            "STATEMENT:  SELECT * FROM public.missing_table",
        ]
        command._process_error_block(lines, "2026-01-09 13:58:50.274 UTC")

        entry = LogEntry.objects.filter(logger_name="postgresql").last()
        assert entry is not None
        assert entry.level == "ERROR"
        assert "missing_table" in entry.message
        assert "Detail:" in entry.message
        assert entry.extra_data["statement"] == "SELECT * FROM public.missing_table"
        assert entry.extra_data["pg_timestamp"] == "2026-01-09 13:58:50.274 UTC"

    def test_parses_error_only(self, command):
        """Verify parsing an error block with just an ERROR line."""
        lines = ["ERROR:  out of memory"]
        command._process_error_block(lines, None)

        entry = LogEntry.objects.filter(logger_name="postgresql").last()
        assert entry is not None
        assert entry.message == "out of memory"

    def test_parses_error_with_hint(self, command):
        """Verify HINT is included in the message."""
        lines = [
            'ERROR:  column "foo" does not exist',
            'HINT:  Perhaps you meant to reference "bar".',
        ]
        command._process_error_block(lines, None)

        entry = LogEntry.objects.filter(logger_name="postgresql").last()
        assert "Hint:" in entry.message

    def test_empty_lines_returns_nothing(self, command):
        """Verify empty lines list creates no log entry."""
        initial_count = LogEntry.objects.filter(logger_name="postgresql").count()
        command._process_error_block([], None)
        assert (
            LogEntry.objects.filter(logger_name="postgresql").count() == initial_count
        )

    def test_no_error_line_returns_nothing(self, command):
        """Verify lines without ERROR prefix create no log entry."""
        initial_count = LogEntry.objects.filter(logger_name="postgresql").count()
        command._process_error_block(["DETAIL: some detail"], None)
        assert (
            LogEntry.objects.filter(logger_name="postgresql").count() == initial_count
        )

    def test_multiline_statement(self, command):
        """Verify multi-line SQL statements are concatenated."""
        lines = [
            "ERROR:  syntax error",
            "STATEMENT:  SELECT *",
            "  FROM table1",
            "  WHERE id = 1",
        ]
        command._process_error_block(lines, None)

        entry = LogEntry.objects.filter(logger_name="postgresql").last()
        assert "SELECT *" in entry.extra_data["statement"]
        assert "FROM table1" in entry.extra_data["statement"]
        assert "WHERE id = 1" in entry.extra_data["statement"]
