"""Tests for report.py against a synthetic run directory.

Run: python3 -m unittest discover loadtest/collect
"""

import csv
import gzip
import json
import tempfile
import unittest
from pathlib import Path

import report

K6_HEADER = [
    "metric_name",
    "timestamp",
    "metric_value",
    "error_code",
    "expected_response",
    "method",
    "name",
    "scenario",
    "status",
    "extra_tags",
    "metadata",
]
START = 1_800_000_000


def write_run(path: Path, tile_ms: list[float], queries: int) -> None:
    """Write the files run.sh produces, with two minutes of tile traffic."""
    with gzip.open(path / "k6.csv.gz", "wt", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(K6_HEADER)
        for index, ms in enumerate(tile_ms):
            ts = START + index * (120 // len(tile_ms))
            tags = ["true", "GET", "tile:trench", "map", "200", "z=16", ""]
            writer.writerow(["http_req_duration", ts, ms, "", *tags])
            writer.writerow(["http_req_failed", ts, 0, "", *tags])
            writer.writerow(
                [
                    "db_queries",
                    ts,
                    queries,
                    "",
                    "",
                    "",
                    "tile:trench",
                    "map",
                    "",
                    "",
                    "",
                ]
            )
            writer.writerow(
                ["db_ms", ts, ms / 2, "", "", "", "tile:trench", "map", "", "", ""]
            )
        writer.writerow(
            [
                "http_req_duration",
                START + 5,
                400,
                "",
                "false",
                "GET",
                "remote:searchFeatures",
                "search",
                "500",
                "",
                "",
            ]
        )
        writer.writerow(
            [
                "http_req_failed",
                START + 5,
                1,
                "",
                "false",
                "GET",
                "remote:searchFeatures",
                "search",
                "500",
                "",
                "",
            ]
        )
        writer.writerow(["vus", START, 3, "", "", "", "", "", "", "", ""])
        writer.writerow(["vus", START + 70, 8, "", "", "", "", "", "", "", ""])

    (path / "summary.json").write_text(
        json.dumps(
            {
                "metrics": {
                    "http_reqs": {"values": {"count": len(tile_ms) + 1, "rate": 2.5}},
                    "http_req_duration": {"values": {"p(95)": max(tile_ms)}},
                    "http_req_failed": {
                        "values": {"rate": 0.02},
                        "thresholds": {"rate<0.01": {"ok": False}},
                    },
                    "vus_max": {"values": {"max": 8}},
                }
            }
        )
    )
    (path / "meta.json").write_text(
        json.dumps(
            {
                "profile": "ramp",
                "git_sha": "abc123",
                "host_cpus": 8,
                "host_mem_kb": 16 * 2**20,
            }
        )
    )
    (path / "containers.csv").write_text(
        "ts,container,cpu_pct,mem_usage,net_io,block_io\n"
        f"{START},qonnectra_db_prod,350.5%,1.5GiB / 6GiB,1MB / 2MB,0B / 0B\n"
        f"{START},qonnectra_backend_prod,120.0%,800MiB / 2GiB,1MB / 2MB,0B / 0B\n"
        f"{START + 61},qonnectra_db_prod,710.0%,1.6GiB / 6GiB,1MB / 2MB,0B / 0B\n"
    )
    (path / "pg_activity.csv").write_text(
        "ts,role,state,wait_event_type,wait_event,connections\n"
        f"{START},qonnectra,active,LWLock,BufferMapping,4\n"
        f"{START},qonnectra,idle,Client,ClientRead,10\n"
        f"{START + 61},qgis,active,,,2\n"
    )
    (path / "top_sql.csv").write_text(
        "role,calls,total_ms,mean_ms,max_ms,rows,shared_blks_hit,shared_blks_read,temp_blks_written,pct,query\n"
        'qonnectra,500,90000.0,180.00,900.0,500,1,2,0,81.0,"WITH bounds AS (SELECT ST_TileEnvelope($1, $2, $3)) SELECT ST_AsMVT(mvtgeom)"\n'
    )
    (path / "pg_db_before.csv").write_text(
        "ts,xact_commit,blks_read,blks_hit,temp_bytes\n1,100,10,90,0\n"
    )
    (path / "pg_db_after.csv").write_text(
        "ts,xact_commit,blks_read,blks_hit,temp_bytes\n2,600,20,980,1048576\n"
    )
    (path / "nginx.log").write_text(
        '1.2.3.4 - - [14/Oct/2026:10:00:00 +0000] "GET /api/v1/ol_trench_tiles/16/1/2.mvt?project=1 HTTP/1.1" 200 512 "-" "k6" "-" cache_status=MISS rt=0.250 urt=0.248\n'
        '1.2.3.4 - - [14/Oct/2026:10:00:01 +0000] "GET /api/v1/ol_trench_tiles/16/1/2.mvt?project=1 HTTP/1.1" 200 512 "-" "k6" "-" cache_status=HIT rt=0.001 urt=-\n'
        '1.2.3.4 - - [14/Oct/2026:10:00:02 +0000] "GET /api/v1/trench/?uuid=x HTTP/1.1" 200 99 "-" "node" "-" cache_status=- rt=0.040 urt=0.039\n'
    )
    (path / "pg.log").write_text(
        "2026-10-14 10:00:00.000 UTC [42] qonnectra@qn LOG:  duration: 812.204 ms  statement: SELECT 1\n"
        "2026-10-14 10:00:01.000 UTC [43] qonnectra@qn LOG:  duration: 1500.000 ms  execute <unnamed>: SELECT 2\n"
    )


class ReportTest(unittest.TestCase):
    """End-to-end checks of the aggregation and the rendered sections."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "run-a"
        self.path.mkdir()
        write_run(self.path, [100, 200, 300, 400, 900, 1200], queries=2)
        self.run = report.Run(self.path)

    def tearDown(self):
        self.tmp.cleanup()

    def test_endpoint_stats_include_server_timing(self):
        rows = {row["name"]: row for row in self.run.endpoint_rows()}

        tiles = rows["tile:trench"]
        self.assertEqual(tiles["count"], 6)
        self.assertEqual(tiles["queries"], 2)
        self.assertAlmostEqual(
            tiles["db_ms"], sum([100, 200, 300, 400, 900, 1200]) / 2 / 6
        )
        self.assertEqual(rows["remote:searchFeatures"]["err_pct"], 100)

    def test_timeline_buckets_minutes_with_users_and_cpu(self):
        self.assertEqual(sorted(self.run.minutes), [0, 1])
        self.assertEqual(self.run.minutes[1]["vus"], 8)
        self.assertEqual(self.run.minutes[1]["cpu"]["db"], [710.0])

    def test_report_has_all_sections(self):
        text = report.render(self.run)

        for heading in (
            "## Thresholds",
            "## Timeline",
            "## Endpoints",
            "## Containers",
            "## Postgres",
            "### Top SQL",
            "### Slow statement log",
            "## nginx",
        ):
            self.assertIn(heading, text)
        self.assertIn("**FAIL**", text)
        self.assertIn("LWLock:BufferMapping", text)
        self.assertIn("ST_AsMVT", text)
        self.assertIn("| vector tiles | 2 | 1 | 1 | 0 |", text)

    def test_slow_log_sorted_slowest_first(self):
        self.assertEqual([ms for ms, _ in self.run.slow], [1500.0, 812.204])

    def test_compare_shows_change(self):
        other = Path(self.tmp.name) / "run-b"
        other.mkdir()
        write_run(other, [50, 60, 70, 80, 90, 100], queries=1)

        text = report.render_compare(self.run, report.Run(other))

        self.assertIn("`tile:trench`", text)
        self.assertIn("-", text.split("`tile:trench`")[1].split("\n")[0])

    def test_missing_files_still_render(self):
        empty = Path(self.tmp.name) / "empty"
        empty.mkdir()

        self.assertIn("# Load test empty", report.render(report.Run(empty)))


if __name__ == "__main__":
    unittest.main()
