"""Checks who gets into the load-test UI."""

from qonnectra_loadtest.auth import SuperuserGate, without_secure
from tests.fakes import FakeHttp, FakeResponse

API = "http://backend:8000/api/v1/"


def gate(
    user: FakeResponse, refresh: FakeResponse | None = None
) -> tuple[SuperuserGate, FakeHttp]:
    """Return a gate whose API answers auth/user/ and the refresh with the given responses."""
    http = FakeHttp(
        {"auth/user/": user, "auth/token/refresh/": refresh or FakeResponse(401)}
    )
    return SuperuserGate(API, http=http), http


def test_superuser_is_allowed_and_cached():
    """Verify a superuser gets in and Django is asked only once."""
    checker, http = gate(FakeResponse(body={"is_superuser": True}))

    assert checker.check({"api-access-token": "a"}).allowed
    assert checker.check({"api-access-token": "a"}).allowed
    assert len(http.calls) == 1
    assert http.calls[0][2]["Cookie"] == "api-access-token=a"


def test_regular_user_is_forbidden():
    """Verify a signed-in non-superuser is refused, not sent to login."""
    checker, _ = gate(FakeResponse(body={"is_superuser": False}))

    verdict = checker.check({"api-access-token": "a"})

    assert (verdict.allowed, verdict.reason) == (False, "forbidden")


def test_no_session_goes_to_login():
    """Verify a visitor without cookies is sent to the login page."""
    checker, http = gate(FakeResponse(body={"is_superuser": True}))

    verdict = checker.check({})

    assert (verdict.allowed, verdict.reason) == (False, "login")
    assert http.calls == []


def test_expired_token_is_refreshed_once_and_cookies_passed_on():
    """Verify a rejected token is refreshed and parallel requests share the refresh."""
    new_cookie = "api-access-token=fresh; Domain=.example.com; HttpOnly; Path=/; Secure"
    http = FakeHttp({})
    http.routes = {
        "auth/token/refresh/": FakeResponse(
            set_cookies=[new_cookie, "api-refresh-token=r2; Secure"]
        ),
    }
    checker = SuperuserGate(API, http=http)
    answers = {
        "stale": FakeResponse(401),
        "fresh": FakeResponse(body={"is_superuser": True}),
    }
    original = http._answer

    def answer(method, url, headers):
        if url.endswith("auth/user/"):
            http.calls.append((method, url, headers))
            return answers[headers["Cookie"].split("=", 1)[1]]
        return original(method, url, headers)

    http._answer = answer
    cookies = {"api-access-token": "stale", "api-refresh-token": "r1"}

    first = checker.check(cookies, secure=False)
    second = checker.check(cookies, secure=False)

    assert first.allowed and second.allowed
    assert (
        first.set_cookies[0]
        == "api-access-token=fresh; Domain=.example.com; HttpOnly; Path=/"
    )
    assert sum(1 for _, url, _ in http.calls if url.endswith("refresh/")) == 1


def test_failed_refresh_goes_to_login():
    """Verify an expired session without a valid refresh token ends at the login."""
    checker, _ = gate(FakeResponse(401), FakeResponse(401))

    verdict = checker.check({"api-access-token": "old", "api-refresh-token": "spent"})

    assert (verdict.allowed, verdict.reason) == (False, "login")


def test_without_secure_keeps_other_attributes():
    """Verify only the Secure flag is dropped for plain-HTTP setups."""
    assert (
        without_secure("a=b; Secure; Path=/; SameSite=Lax")
        == "a=b; Path=/; SameSite=Lax"
    )
