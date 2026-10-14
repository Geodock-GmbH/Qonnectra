"""How one virtual user talks to Qonnectra, like a signed-in browser tab.

Every request carries the user's access token cookie and the load-test
timing key, gets a stable endpoint name (never the concrete URL) for the
statistics, and counts as failed on anything but a 2xx answer. Django's
Server-Timing values go to the recorder under the same name.
"""

import random
from dataclasses import dataclass

import gevent
from gevent.pool import Pool

from qonnectra_loadtest.analysis import server_timing
from qonnectra_loadtest.remote import encode_remote_arg, remote_id

TIMING_HEADER = "X-Loadtest-Timing"

PARALLEL_TILES = 16
"""Tile requests in flight per user: OpenLayers' TileQueue default (maxTotalLoading)."""

CACHED = {"HIT", "STALE", "UPDATING", "REVALIDATED"}
"""nginx cache states whose response Django did not produce for this request."""


@dataclass(frozen=True)
class Get:
    """One GET of a parallel batch."""

    url: str
    name: str


class Browser:
    """One signed-in user's requests, bound to a Locust ``FastHttpUser``."""

    def __init__(self, user, token: str, run):
        """Bind to a Locust user.

        Args:
            user: The ``FastHttpUser`` whose ``client`` sends the requests.
            token: The user's access token.
            run: The current :class:`~qonnectra_loadtest.run.Run`.
        """
        self.client = user.client
        self.options = run.options
        self.recorder = run.recorder
        self.headers = {
            "Cookie": f"api-access-token={token}",
            TIMING_HEADER: run.timing_key,
        }
        self.token = token

    def think(self, low: float, high: float):
        """Pause like a user reading or moving the mouse, scaled by the think option.

        Args:
            low: Shortest pause in seconds.
            high: Longest pause in seconds.
        """
        gevent.sleep(random.uniform(low, high) * self.options.think)

    def _send(
        self,
        method: str,
        url: str,
        name: str,
        headers: dict | None = None,
        **kwargs,
    ):
        """Send one request and judge its answer.

        Redirects are not followed: a 3xx here means a lost session or a
        moved route, and counts as a failure.

        Returns:
            The finished response.
        """
        with self.client.request(
            method,
            url,
            name=name,
            headers={**self.headers, **(headers or {})},
            catch_response=True,
            allow_redirects=False,
            **kwargs,
        ) as response:
            status = response.status_code or 0
            if not 200 <= status < 300:
                response.failure(f"HTTP {status}")
            elif response.headers:
                cache = response.headers.get("X-Cache-Status")
                header = response.headers.get("Server-Timing")
                if header and cache not in CACHED:
                    self.recorder.server_timing(name, server_timing(header))
        return response

    def api(self, path: str, name: str, **kwargs):
        """GET a Django API path below the API base.

        Args:
            path: e.g. ``trench/?project=1``.
            name: Endpoint name.

        Returns:
            The finished response.
        """
        return self._send("GET", f"{self.options.api_url}{path}", name, **kwargs)

    def api_write(self, method: str, path: str, name: str, body: dict | None = None):
        """Send a write request with a JSON body to the Django API.

        Returns:
            The finished response.
        """
        return self._send(method, f"{self.options.api_url}{path}", name, json=body)

    def page(self, path: str, name: str):
        """Load a SvelteKit page with SSR, as on a full page load.

        Returns:
            The finished response.
        """
        return self._send("GET", f"{self.options.app_url}{path}", name)

    def get(self, url: str, name: str, method: str = "GET"):
        """Request an absolute URL, e.g. on the tile server.

        Returns:
            The finished response.
        """
        return self._send(method, url, name)

    def remote(self, fn: str, arg, page_path: str, search: str = ""):
        """Call a SvelteKit remote query the way the client runtime does.

        SvelteKit answers a failed query with HTTP 200 and ``type: "error"``,
        which also counts as a failure.

        Args:
            fn: Remote function name, a key of ``REMOTE_FILES``.
            arg: Query argument, None for none.
            page_path: Path of the page the call is made from.
            search: Query string of that page, including ``?``.

        Returns:
            The finished response.
        """
        name = f"remote:{fn}"
        payload = encode_remote_arg(arg)
        url = f"{self.options.app_url}/_app/remote/{remote_id(fn)}"
        if payload:
            url += f"?payload={payload}"
        with self.client.get(
            url,
            name=name,
            headers={
                **self.headers,
                "Origin": self.options.app_url,
                "x-sveltekit-pathname": page_path,
                "x-sveltekit-search": search,
            },
            catch_response=True,
            allow_redirects=False,
        ) as response:
            body = response.content or b""
            if response.status_code != 200:
                response.failure(f"HTTP {response.status_code}")
            elif body.startswith(b'{"type":"error"'):
                response.failure(body[:200].decode(errors="replace"))
        return response

    def fetch_all(self, gets: list[Get]):
        """Run GETs in parallel, like the browser's tile queue.

        Args:
            gets: Requests of one view change.
        """
        if not gets:
            return
        pool = Pool(PARALLEL_TILES)
        for get in gets:
            pool.spawn(self._send, "GET", get.url, get.name)
        pool.join()
