"""Small stand-ins for ``requests`` used by the unit tests."""

from dataclasses import dataclass, field


@dataclass
class FakeHeaders:
    """Response headers with ``getlist`` like urllib3's."""

    values: dict[str, list[str]] = field(default_factory=dict)

    def getlist(self, name: str) -> list[str]:
        """Return all values of a header."""
        return self.values.get(name, [])


@dataclass
class FakeRaw:
    """The ``raw`` attribute of a response."""

    headers: FakeHeaders


@dataclass
class FakeResponse:
    """A canned HTTP answer."""

    status_code: int = 200
    body: object = None
    set_cookies: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        """Whether the status is below 400."""
        return self.status_code < 400

    @property
    def raw(self) -> FakeRaw:
        """Return headers with the Set-Cookie values."""
        return FakeRaw(FakeHeaders({"Set-Cookie": self.set_cookies}))

    def json(self):
        """Return the canned body."""
        return self.body

    def raise_for_status(self):
        """Raise for 4xx and 5xx like requests does."""
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


class FakeHttp:
    """Answers GET and POST by URL suffix and records every call."""

    def __init__(self, routes: dict[str, FakeResponse | object]):
        """Create the fake.

        Args:
            routes: URL suffix (path and query) to response or JSON body.
        """
        self.routes = routes
        self.calls: list[tuple[str, str, dict]] = []

    def _answer(self, method: str, url: str, headers: dict | None) -> FakeResponse:
        """Find the route for a URL."""
        self.calls.append((method, url, headers or {}))
        for suffix, answer in self.routes.items():
            if url.endswith(suffix):
                return (
                    answer
                    if isinstance(answer, FakeResponse)
                    else FakeResponse(body=answer)
                )
        return FakeResponse(status_code=404)

    def get(self, url, headers=None, **_kwargs):
        """Answer a GET."""
        return self._answer("GET", url, headers)

    def post(self, url, headers=None, **_kwargs):
        """Answer a POST."""
        return self._answer("POST", url, headers)
