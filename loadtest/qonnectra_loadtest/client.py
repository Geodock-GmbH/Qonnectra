"""How one virtual user talks to Qonnectra, like a signed-in browser tab.

Every request carries the account's token cookies and the load-test timing
key, gets a stable endpoint name (never the concrete URL) for the
statistics, and counts as failed on anything but a 2xx answer. Django's
Server-Timing values go to the recorder under the same name. Like the app,
the tab extends its session every few minutes and keeps the rotated tokens.
"""

import json
import random
import time
from collections.abc import Callable, Iterable
from dataclasses import dataclass

import gevent
from gevent.pool import Pool

from qonnectra_loadtest.analysis import server_timing
from qonnectra_loadtest.remote import (
    COMMANDS,
    encode_remote_arg,
    remote_id,
    remote_result,
)

TIMING_HEADER = "X-Loadtest-Timing"

ACCESS_COOKIE = "api-access-token"
REFRESH_COOKIE = "api-refresh-token"

KEEP_ALIVE_SECONDS = 7 * 60
"""The app's session keep-alive cadence (``DEFAULT_KEEP_ALIVE_INTERVAL_MS``)."""

PARALLEL_TILES = 16
"""Tile requests in flight per user: OpenLayers' TileQueue default (maxTotalLoading)."""

CACHED = {"HIT", "STALE", "UPDATING", "REVALIDATED"}
"""nginx cache states whose response Django did not produce for this request."""


@dataclass(frozen=True)
class Get:
    """One GET of a parallel batch."""

    url: str
    name: str


class Session:
    """One load-test account's sign-in: its token cookies, as the browser holds them.

    Virtual users that share an account share the session, like tabs share
    cookies, so a refresh in one tab rotates the tokens for all of them.
    """

    def __init__(self, access: str, refresh: str):
        """Start a session from freshly minted tokens.

        Args:
            access: Access token.
            refresh: Refresh token.
        """
        self.cookies = {ACCESS_COOKIE: access, REFRESH_COOKIE: refresh}
        self.refreshed_at = time.time()

    @property
    def cookie_header(self) -> str:
        """Return the ``Cookie`` header the browser sends."""
        return "; ".join(f"{name}={value}" for name, value in self.cookies.items())

    def due(self, now: float) -> bool:
        """Return whether the keep-alive interval has passed since the last refresh.

        Args:
            now: Unix time.

        Returns:
            bool: True when the session should be extended.
        """
        return now - self.refreshed_at >= KEEP_ALIVE_SECONDS

    def take_cookies(self, set_cookies: Iterable[str]):
        """Store the token cookies of a response, like the browser does.

        An empty value is a deletion, which signs the session out.

        Args:
            set_cookies: ``Set-Cookie`` header values.
        """
        for header in set_cookies:
            name, _, rest = header.partition("=")
            name = name.strip()
            if name not in (ACCESS_COOKIE, REFRESH_COOKIE):
                continue
            value = rest.split(";", 1)[0].strip().strip('"')
            if value:
                self.cookies[name] = value
            else:
                self.cookies.pop(name, None)


def set_cookies(response) -> list[str]:
    """Return every ``Set-Cookie`` value of a Locust response.

    Args:
        response: A finished ``FastHttpUser`` response.

    Returns:
        list[str]: The header values, empty without any.
    """
    headers = response.headers
    if not headers:
        return []
    if hasattr(headers, "getlist"):
        return headers.getlist("Set-Cookie")
    value = headers.get("Set-Cookie")
    return [value] if value else []


class Browser:
    """One signed-in user's requests, bound to a Locust ``FastHttpUser``."""

    def __init__(self, user, session: Session, run):
        """Bind to a Locust user.

        Args:
            user: The ``FastHttpUser`` whose ``client`` sends the requests.
            session: The account's shared session.
            run: The current :class:`~qonnectra_loadtest.run.Run`.
        """
        self.client = user.client
        self.options = run.options
        self.recorder = run.recorder
        self.session = session
        self.timing_key = run.timing_key
        self.page_path = "/"
        """Path of the page the tab shows, sent with every remote call."""

    @property
    def headers(self) -> dict[str, str]:
        """Return the headers every request carries."""
        return {"Cookie": self.session.cookie_header, TIMING_HEADER: self.timing_key}

    def think(self, low: float, high: float):
        """Pause like a user reading or moving the mouse, scaled by the think option.

        Args:
            low: Shortest pause in seconds.
            high: Longest pause in seconds.
        """
        gevent.sleep(random.uniform(low, high) * self.options.think)
        self.keep_alive()

    def keep_alive(self, force: bool = False):
        """Extend the session when the keep-alive interval has passed, like the app's timer.

        The refresh rotates both tokens; the new ones arrive as cookies. A
        refresh the server turns down counts as a failure and is retried at
        the next interval, where the app would sign the user out.

        Args:
            force: Refresh now, e.g. so a Check run tries it once.
        """
        session = self.session
        if not force and not session.due(time.time()):
            return
        # Marked before the request, so the other tabs of the account do not
        # refresh with the same, soon spent, token meanwhile.
        session.refreshed_at = time.time()
        self.command(
            "refreshSession",
            None,
            self.page_path,
            accept=lambda result: None
            if isinstance(result, dict) and result.get("ok")
            else "session not extended",
        )

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
            self.session.take_cookies(set_cookies(response))
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
        self.page_path = path
        return self._send("GET", f"{self.options.app_url}{path}", name)

    def get(self, url: str, name: str, method: str = "GET"):
        """Request an absolute URL, e.g. on the tile server.

        Returns:
            The finished response.
        """
        return self._send(method, url, name)

    def remote(self, fn: str, arg, page_path: str, search: str = ""):
        """Call a SvelteKit remote query the way the client runtime does.

        Args:
            fn: Query name, a key of ``REMOTE_FILES``.
            arg: Query argument, None for none.
            page_path: Path of the page the call is made from.
            search: Query string of that page, including ``?``.

        Returns:
            The query's return value, or None when it failed.
        """
        payload = encode_remote_arg(arg)
        url = f"{self.options.app_url}/_app/remote/{remote_id(fn)}"
        if payload:
            url += f"?payload={payload}"
        return self._remote("GET", fn, url, page_path, search)

    def command(
        self,
        fn: str,
        arg,
        page_path: str,
        refreshes: Iterable[str] = (),
        accept: Callable[[object], str | None] | None = None,
    ):
        """Call a SvelteKit remote command the way the client runtime does.

        Args:
            fn: Command name, one of ``COMMANDS``.
            arg: Command argument, None for none.
            page_path: Path of the page the call is made from.
            refreshes: Keys of the query instances the page shows and the
                command should refresh in the same request, like
                ``.updates(query)`` sends them.
            accept: Judges the return value; a message makes the call a
                failure.

        Returns:
            The command's return value, or None when it failed.
        """
        body = json.dumps(
            {"payload": encode_remote_arg(arg), "refreshes": list(refreshes)}
        )
        url = f"{self.options.app_url}/_app/remote/{remote_id(fn)}"
        return self._remote("POST", fn, url, page_path, "", body, accept)

    def _remote(
        self,
        method: str,
        fn: str,
        url: str,
        page_path: str,
        search: str,
        body: str | None = None,
        accept: Callable[[object], str | None] | None = None,
    ):
        """Send one remote call and judge its answer.

        SvelteKit answers a failed call with HTTP 200 and ``type: "error"``,
        which also counts as a failure.

        Returns:
            The function's return value, or None when it failed.
        """
        self.page_path = page_path
        kind = "command" if fn in COMMANDS else "remote"
        if (method == "POST") != (kind == "command"):
            raise ValueError(f"{fn} is a {'command' if fn in COMMANDS else 'query'}")
        headers = {
            **self.headers,
            "Origin": self.options.app_url,
            "x-sveltekit-pathname": page_path,
            "x-sveltekit-search": search,
        }
        if body is not None:
            headers["Content-Type"] = "application/json"
        with self.client.request(
            method,
            url,
            name=f"{kind}:{fn}",
            headers=headers,
            data=body,
            catch_response=True,
            allow_redirects=False,
        ) as response:
            self.session.take_cookies(set_cookies(response))
            content = response.content or b""
            result = remote_result(content)
            if response.status_code != 200:
                response.failure(f"HTTP {response.status_code}")
                return None
            if content.startswith(b'{"type":"error"'):
                response.failure(content[:200].decode(errors="replace"))
                return None
            problem = accept(result) if accept else None
            if problem:
                response.failure(problem)
                return None
        return result

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
