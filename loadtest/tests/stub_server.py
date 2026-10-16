"""A local stand-in for Qonnectra: app pages, remote functions, API and tile server.

It answers like the real services where the load test depends on it, and it
is strict where a mistake would mean wrong load: requests without the user's
token cookie are redirected to the login, remote calls with a wrong module
hash, the wrong method, an undecodable payload or an argument the app's
schema would reject get SvelteKit's error answer, a refresh token can be
used once (Django rotates and blacklists it), and the Server-Timing header
only comes back for the right load-test key.
"""

import base64
import json
import re
from collections import Counter
from urllib.parse import parse_qs

from gevent.pywsgi import WSGIServer

from qonnectra_loadtest.remote import (
    COMMANDS,
    REMOTE_FILES,
    devalue_parse,
    devalue_stringify,
    remote_id,
)

TOKEN_PREFIX = "tok-"
REFRESH_PREFIX = "ref-"

ADDRESS = {
    "uuid": "uuid-1",
    "id_address": "A-1",
    "id_address_2": None,
    "street": "Lastweg",
    "housenumber": 4,
    "house_number_suffix": "",
    "zip_code": "34117",
    "city": "Kassel",
    "district": "",
    "status_development": {"id": 5, "status": "planned"},
    "flag": None,
}


def decode_arg(payload: str):
    """Decode a remote argument like SvelteKit's server; raises ValueError when it cannot."""
    if not payload:
        return None
    return devalue_parse(
        base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)).decode()
    )


def tokens(user: str, generation: int) -> tuple[str, str]:
    """Return the access and refresh token of one account's ``generation``."""
    return f"{TOKEN_PREFIX}{user}-{generation}", f"{REFRESH_PREFIX}{user}-{generation}"


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
        self.refresh_tokens: dict[str, str] = {}
        """Each account's refresh token that is still valid."""
        self.commands: list[tuple[str, object, list[str]]] = []
        """Every command with its argument and refresh keys."""
        self.server = WSGIServer(("127.0.0.1", 0), self, log=None, error_log=None)

    def sign_in(self, user: str) -> dict:
        """Mint an account's first tokens, like the users CLI.

        Args:
            user: Account name.

        Returns:
            dict: ``username``, ``access`` and ``refresh``.
        """
        access, refresh = tokens(user, 0)
        self.refresh_tokens[user] = refresh
        return {"username": user, "access": access, "refresh": refresh}

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

        access = re.search(rf"api-access-token={TOKEN_PREFIX}([^-;]+)-(\d+)", cookie)
        current = self.refresh_tokens.get(access[1], "") if access else ""
        if access and current and int(current.rsplit("-", 1)[1]) > int(access[2]):
            self.hits["stale-access"] += 1

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
            return self.remote(method, path, query, environ, reply)
        if path.startswith("/api/v1/"):
            timing = []
            if environ.get("HTTP_X_LOADTEST_TIMING") == self.timing_key:
                timing = [("Server-Timing", "app;dur=12.0, db;dur=4.0, q;dur=3")]
            return self.api(method, path[len("/api/v1/") :], query, reply, timing)
        if re.fullmatch(
            r"/project/\d+/(map|network-schema(/node/[\w-]+)?|conduit|address)", path
        ):
            headers[0] = ("Content-Type", "text/html")
            return reply("200 OK", b"<html></html>", f"page:{path.rsplit('/', 1)[1]}")
        return reply("404 Not Found", b"{}", "not-found")

    def remote(self, method, path, query, environ, reply):
        """Answer a remote call, or SvelteKit's error when the call is malformed."""
        fn = path.rsplit("/", 1)[1]
        known = fn in REMOTE_FILES and path == f"/_app/remote/{remote_id(fn)}"
        refreshes: list[str] = []
        try:
            if method == "POST":
                body = json.loads(environ["wsgi.input"].read() or b"{}")
                payload = body.get("payload", "")
                refreshes = body.get("refreshes", [])
                for key in refreshes:
                    head, _, key_payload = key.rpartition("/")
                    _, _, name = head.partition("/")
                    if name not in REMOTE_FILES or head != remote_id(name):
                        raise ValueError(f"bad refresh key {key}")
                    decode_arg(key_payload)
            else:
                payload = query.get("payload", [""])[0]
            arg = decode_arg(payload)
        except (ValueError, KeyError, AttributeError):
            known = False
        wrong_method = (method == "POST") != (fn in COMMANDS)
        if not known or wrong_method or not environ.get("HTTP_X_SVELTEKIT_PATHNAME"):
            return reply(
                "200 OK", {"type": "error", "error": "bad call"}, "remote-error"
            )
        if fn in COMMANDS:
            self.commands.append((fn, arg, refreshes))
        if fn == "refreshSession":
            return self.refresh_session(environ.get("HTTP_COOKIE", ""), reply)
        try:
            data = self.remote_value(fn, arg)
        except (ValueError, TypeError, KeyError):
            return reply(
                "200 OK", {"type": "error", "error": "invalid"}, "remote-invalid"
            )
        kind = "command" if fn in COMMANDS else "remote"
        body = {"type": "result", "data": devalue_stringify(data)}
        return reply("200 OK", body, f"{kind}:{fn}")

    @staticmethod
    def remote_value(fn: str, arg) -> dict:
        """Return the remote data envelope, checking arguments like the app's schemas.

        Raises:
            ValueError: If the argument would fail the function's schema.
        """
        if fn == "createConduit":
            if not isinstance(arg["projectId"], int) or not arg["name"]:
                raise ValueError(arg)
            return {"_": {"uuid": "new-conduit", "name": arg["name"]}}
        if fn in ("getConduit", "deleteConduit"):
            if arg != "new-conduit":
                raise ValueError(arg)
            return {} if fn == "deleteConduit" else {"_": {"uuid": arg, "name": "c"}}
        if fn == "updateConduit":
            if arg["uuid"] != "new-conduit" or not arg["name"]:
                raise ValueError(arg)
            return {"_": {"uuid": arg["uuid"], "name": arg["name"]}}
        if fn == "getNodeDetails":
            return {
                "_": {
                    "type": "Feature",
                    "properties": {"uuid": arg, "canvas_x": 100.0, "canvas_y": -20.0},
                }
            }
        if fn == "saveNodeGeometry":
            if not all(isinstance(arg[k], float | int) for k in ("x", "y")):
                raise ValueError(arg)
            return {"_": {"uuid": arg["nodeId"]}}
        if fn == "getAddress":
            return {"_": {**ADDRESS, "uuid": arg}}
        if fn == "updateAddress":
            for field in ("street", "house_number_suffix", "zip_code", "city"):
                if not isinstance(arg[field], str):
                    raise ValueError(field)
            if arg["housenumber"] is not None and not isinstance(
                arg["housenumber"], int
            ):
                raise ValueError("housenumber")
            return {"_": {**ADDRESS, "uuid": arg["uuid"]}}
        if fn == "getLayerExtent":
            return {"_": {"extent": [1055000, 6671000, 1057000, 6673000]}}
        return {"_": []}

    def refresh_session(self, cookie: str, reply):
        """Rotate an account's tokens like Django's refresh view behind ``refreshSession``.

        The refresh token is valid once; a reused one answers ``ok: false``.
        """
        match = re.search(rf"api-refresh-token={REFRESH_PREFIX}([^-;]+)-(\d+)", cookie)
        user = match[1] if match else ""
        presented = match[0].split("=", 1)[1] if match else ""
        if not user or self.refresh_tokens.get(user) != presented:
            body = {"type": "result", "data": devalue_stringify({"_": {"ok": False}})}
            return reply("200 OK", body, "session-refused")
        access, refresh = tokens(user, int(match[2]) + 1)
        self.refresh_tokens[user] = refresh
        result = {"_": {"ok": True, "expiresInMs": 900000}}
        return reply(
            "200 OK",
            {"type": "result", "data": devalue_stringify(result)},
            "command:refreshSession",
            [
                ("Set-Cookie", f"api-access-token={access}; Path=/; HttpOnly"),
                ("Set-Cookie", f"api-refresh-token={refresh}; Path=/; HttpOnly"),
            ],
        )

    def api(self, method, path, query, reply, timing):
        """Answer the Django API endpoints the personas and the discovery use."""
        projects = [{"id": 1, "project": "Kassel"}]
        if self.seeded:
            projects.append({"id": 7, "project": "loadtest-01"})
        sample = {
            "features": [
                {"id": f"uuid-{n}", "properties": {"id_trench": f"T{n}"}}
                for n in range(5)
            ]
        }
        if method == "GET":
            if path == "auth/user/":
                return reply("200 OK", {"username": "admin", "is_superuser": True})
            if path == "config/":
                return reply("200 OK", {}, "", timing)
            if path == "projects/":
                return reply("200 OK", {"results": projects}, "api:projects")
            if path == "layer-extent/":
                return reply("200 OK", {"extent": [1055000, 6671000, 1057000, 6673000]})
            if path == "node/all/" and query.get("minimal") == ["true"]:
                configured = query.get("project") == ["7"]
                metadata = {
                    "excluded_node_type_ids": [4] if configured else [],
                    "child_view_enabled_node_type_ids": [5] if configured else [],
                }
                return reply("200 OK", {"nodes": [], "metadata": metadata})
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
                scope = "" if "project" in query else "global:"
                return reply("200 OK", b"\x1a\x00", f"tile:{scope}{tile[1]}", timing)
            if path.startswith("wms-proxy/3/") and query.get("token") == ["wms-token"]:
                return reply("200 OK", b"\x89PNG", "tile:wms", timing)
        if (
            method == "PATCH"
            and re.fullmatch(r"trench/T\d/", path)
            and query.get("project") == ["7"]
        ):
            return reply("200 OK", {}, "write:trench-patch", timing)
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
