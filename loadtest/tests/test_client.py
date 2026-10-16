"""Checks how a virtual user's session keeps its token cookies, like a browser."""

from qonnectra_loadtest import client
from qonnectra_loadtest.client import Session


def test_rotated_tokens_replace_the_old_ones():
    """Verify Set-Cookie values from a refresh become the next Cookie header."""
    session = Session("a1", "r1")

    session.take_cookies(
        [
            "api-access-token=a2; Domain=.example.com; HttpOnly; Path=/; Secure",
            'api-refresh-token="r2"; Path=/',
            "PARAGLIDE_LOCALE=de; Path=/",
        ]
    )

    assert session.cookie_header == "api-access-token=a2; api-refresh-token=r2"


def test_a_cleared_cookie_signs_the_session_out():
    """Verify an emptied token cookie is no longer sent, as the browser drops it."""
    session = Session("a1", "r1")

    session.take_cookies(
        ["api-access-token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/"]
    )

    assert session.cookie_header == "api-refresh-token=r1"


def test_refresh_is_due_after_the_keep_alive_interval():
    """Verify the session asks for a refresh on the app's cadence."""
    session = Session("a1", "r1")

    assert not session.due(session.refreshed_at + client.KEEP_ALIVE_SECONDS - 1)
    assert session.due(session.refreshed_at + client.KEEP_ALIVE_SECONDS)
