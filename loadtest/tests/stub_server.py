"""A local stand-in for Qonnectra: app pages, remote functions, API and tile server.

It answers like the real services where the load test depends on it, and it
is strict where a mistake would mean wrong load: requests without the user's
token cookie are redirected to the login, remote calls with a wrong module
hash or undecodable payload get SvelteKit's error answer, and the
Server-Timing header only comes back for the right load-test key.
"""

import base64
import json
import re
from collections import Counter
from urllib.parse import parse_qs

from gevent.pywsgi import WSGIServer

from qonnectra_loadtest.remote import REMOTE_FILES, remote_id

TOKEN_PREFIX = "tok-"


class StubQonnectra:
    """WSGI app plus server.

    ``hits`` counts requests per kind; ``paths`` keeps every path with its query.
    """

    def __init__(self, timing_key: str, seeded: bool = True):
        """Create the stub.

        Args:
            timing_key: The key that switches the Server-Timing header on.
            seeded: Whether a ``loadtest-01`` project exists.
        """
        self.timing_key = timing_key
        self.seeded = seeded
        self.hits: Counter = Counter()
        self.paths: list[str] = []
        self.server = WSGIServer(("127.0.0.1", 0), self, log=None, error_log=None)

    @property
    def base(self) -> str:
        """Return the stub's origin."""
        return f"http://127.0.0.1:{self.server.server_port}"

    def start(self):
        """Start serving in the background."""
        self.server.start()

    def stop(self):
        """Stop serving."""
        self.server.stop()

    def __call__(self, environ, start_response):
        """Answer one request."""
        method = environ["REQUEST_METHOD"]
        path = environ["PATH_INFO"]
        query = parse_qs(environ.get("QUERY_STRING", ""))
        cookie = environ.get("HTTP_COOKIE", "")
        query_string = environ.get("QUERY_STRING", "")
        self.paths.append(f"{path}?{query_string}" if query_string else path)
        headers = [("Content-Type", "application/json")]
        signed_in = f"api-access-token={TOKEN_PREFIX}" in cookie or environ.get(
            "HTTP_AUTHORIZATION", ""
        ).startswith(f"Bearer {TOKEN_PREFIX}")

        def reply(status: str, body=b"", kind: str = "", extra=()):
            if kind:
                self.hits[kind] += 1
            data = body if isinstance(body, bytes) else json.dumps(body).encode()
            start_response(status, headers + list(extra))
            return [data]

        if path.startswith("/tiles/"):
            return self.tile_server(path[len("/tiles") :], reply)
        if path == "/login":
            return reply("200 OK", b"<html></html>")
        if not signed_in and path != "/api/v1/config/":
            return reply(
                "303 See Other", b"", "unauthenticated", [("Location", "/login")]
            )
        if path.startswith("/_app/remote/"):
            return self.remote(path, query, environ, reply)
        if path.startswith("/api/v1/"):
            timing = []
            if environ.get("HTTP_X_LOADTEST_TIMING") == self.timing_key:
                timing = [("Server-Timing", "app;dur=12.0, db;dur=4.0, q;dur=3")]
            return self.api(method, path[len("/api/v1/") :], query, reply, timing)
        if re.fullmatch(r"/project/\d+/(map|network-schema|conduit)", path):
            headers[0] = ("Content-Type", "text/html")
            return reply("200 OK", b"<html></html>", f"page:{path.rsplit('/', 1)[1]}")
        return reply("404 Not Found", b"{}", "not-found")

    def remote(self, path, query, environ, reply):
        """Answer a remote query, or SvelteKit's error when the call is malformed."""
        fn = path.rsplit("/", 1)[1]
        ok = fn in REMOTE_FILES and path == f"/_app/remote/{remote_id(fn)}"
        payload = query.get("payload", [""])[0]
        if payload:
            try:
                json.loads(
                    base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4))
                )
            except ValueError:
                ok = False
        if not ok or not environ.get("HTTP_X_SVELTEKIT_PATHNAME"):
            return reply(
                "200 OK", {"type": "error", "error": "bad call"}, "remote-error"
            )
        return reply("200 OK", {"type": "result", "result": "[]"}, f"remote:{fn}")

    def api(self, method, path, query, reply, timing):
        """Answer the Django API endpoints the personas and the discovery use."""
        projects = [{"id": 1, "project": "Kassel"}]
        if self.seeded:
            projects.append({"id": 7, "project": "loadtest-01"})
        sample = {"features": [{"id": f"uuid-{n}"} for n in range(5)]}
        if method == "GET":
            if path == "auth/user/":
                return reply("200 OK", {"username": "admin", "is_superuser": True})
            if path == "config/":
                return reply("200 OK", {}, "", timing)
            if path == "projects/":
                return reply("200 OK", {"results": projects}, "api:projects")
            if path == "layer-extent/":
                return reply("200 OK", {"extent": [1055000, 6671000, 1057000, 6673000]})
            if path in ("trench/", "node/", "address/", "cable/"):
                return reply("200 OK", sample)
            if path == "wms-sources/":
                layers = [
                    {
                        "name": "Flur",
                        "is_enabled": True,
                        "min_zoom": 0,
                        "max_zoom": None,
                    }
                ]
                return reply(
                    "200 OK",
                    [{"id": 3, "is_active": True, "layers": layers}],
                    "wms:sources",
                )
            if path == "wms-sources/access_token/":
                return reply("200 OK", {"token": "wms-token"}, "wms:access_token")
            if path == "attributes_conduit_type/":
                return reply("200 OK", [{"id": 11}])
            if path == "flags/":
                return reply("200 OK", [{"id": 2}])
            tile = re.fullmatch(r"ol_(\w+)_tiles/\d+/\d+/\d+\.mvt", path)
            if tile:
                return reply("200 OK", b"\x1a\x00", f"tile:{tile[1]}", timing)
            if path.startswith("wms-proxy/3/") and query.get("token") == ["wms-token"]:
                return reply("200 OK", b"\x89PNG", "tile:wms", timing)
        if method == "PATCH" and re.fullmatch(r"trench/uuid-\d/", path):
            return reply("200 OK", {}, "write:trench-patch", timing)
        if method == "POST" and path == "conduit/":
            return reply(
                "201 Created", {"uuid": "new-conduit"}, "write:conduit-create", timing
            )
        if method == "DELETE" and path == "conduit/new-conduit/":
            return reply("204 No Content", b"", "write:conduit-delete", timing)
        return reply("404 Not Found", {}, "not-found")

    def tile_server(self, path, reply):
        """Answer like tileserver-gl: health, style, TileJSON and tiles."""
        if path == "/health":
            return reply("200 OK", b"OK", "basemap:health")
        if re.fullmatch(r"/styles/(light|dark)/style\.json", path):
            sources = {
                "openmaptiles": {
                    "type": "vector",
                    "url": f"{self.base}/tiles/data/germany.json",
                }
            }
            return reply("200 OK", {"version": 8, "sources": sources}, "basemap:style")
        if path == "/data/germany.json":
            body = {
                "tiles": [f"{self.base}/tiles/data/germany/{{z}}/{{x}}/{{y}}.pbf"],
                "minzoom": 0,
                "maxzoom": 14,
            }
            return reply("200 OK", body, "basemap:tilejson")
        if re.fullmatch(r"/data/germany/(\d+)/\d+/\d+\.pbf", path):
            zoom = int(path.split("/")[3])
            return reply(
                "200 OK",
                b"\x1a\x00",
                "tile:basemap" if zoom <= 14 else "basemap:too-deep",
            )
        return reply("404 Not Found", b"", "not-found")
