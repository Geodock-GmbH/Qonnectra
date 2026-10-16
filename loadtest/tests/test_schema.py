"""Checks which network schema pages a planning session opens."""

import random

import pytest

from qonnectra_loadtest.config import RunOptions
from qonnectra_loadtest.fixtures import Fixture, Project
from qonnectra_loadtest.personas import edit
from qonnectra_loadtest.personas.edit import edit_session
from qonnectra_loadtest.personas.schema import schema_session


class RecordingBrowser:
    """Stands in for the user's browser and records the pages it opens."""

    def __init__(self, unconfigured_share: float = 0.0):
        self.options = RunOptions(
            app_url="https://app",
            api_url="https://api/api/v1/",
            tiles_url="",
            unconfigured_share=unconfigured_share,
        )
        self.pages: list[tuple[str, str]] = []

    def page(self, path: str, name: str):
        """Record a page load."""
        self.pages.append((name, path))

    def remote(self, *_args, **_kwargs):
        """Answer remote calls with nothing; this test is about pages."""
        return {}

    def command(self, *_args, **_kwargs):
        """Answer commands with nothing."""
        return {}

    def think(self, *_args):
        """Skip the pause."""


def project(project_id: int, configured: bool, parents=()) -> Project:
    """Return a project with or without a configured network schema."""
    return Project(
        id=project_id,
        name=f"loadtest-0{project_id}",
        extent=(0, 0, 1, 1),
        features={"node": ["n1"]},
        schema_configured=configured,
        schema_parents=list(parents),
    )


CONFIGURED = project(1, True, ["nvt-1"])
UNCONFIGURED = project(2, False)


def main_pages(browser: RecordingBrowser) -> set[tuple[str, str]]:
    """Return the main schema pages the browser opened."""
    return {
        (name, path)
        for name, path in browser.pages
        if name.startswith("page:network-schema") and "/node/" not in path
    }


@pytest.fixture(autouse=True)
def fixed_random():
    """Make the shares draw the same way on every run."""
    random.seed(3)


def test_without_share_only_configured_projects_open():
    """Verify the default keeps the unconfigured project out of the run."""
    browser = RecordingBrowser(unconfigured_share=0.0)

    for _ in range(50):
        schema_session(browser, [CONFIGURED, UNCONFIGURED])

    assert main_pages(browser) == {("page:network-schema", "/project/1/network-schema")}


def test_full_share_opens_the_unconfigured_project_under_its_own_name():
    """Verify unconfigured loads never mix into the configured statistics."""
    browser = RecordingBrowser(unconfigured_share=100.0)

    for _ in range(50):
        schema_session(browser, [CONFIGURED, UNCONFIGURED])

    assert main_pages(browser) == {
        ("page:network-schema:unconfigured", "/project/2/network-schema")
    }


def test_a_run_without_configured_projects_still_opens_the_schema():
    """Verify an old seed without settings is measured, and named for what it is."""
    browser = RecordingBrowser(unconfigured_share=0.0)

    schema_session(browser, [UNCONFIGURED])

    assert main_pages(browser) == {
        ("page:network-schema:unconfigured", "/project/2/network-schema")
    }


def test_some_sessions_open_the_sub_schema_of_a_parent_node():
    """Verify planners sometimes drill into an NVt, but not every time."""
    sessions = []
    for _ in range(40):
        browser = RecordingBrowser()
        schema_session(browser, [CONFIGURED])
        sessions.append(
            [path for name, path in browser.pages if name == "page:network-schema:node"]
        )

    opened = [paths for paths in sessions if paths]
    assert 0 < len(opened) < len(sessions)
    assert all(paths == ["/project/1/network-schema/node/nvt-1"] for paths in opened)


def test_no_sub_schema_without_parent_nodes():
    """Verify a project without child-view nodes never opens a sub schema."""
    browser = RecordingBrowser(unconfigured_share=100.0)

    for _ in range(40):
        schema_session(browser, [UNCONFIGURED])

    assert not any("/node/" in path for _, path in browser.pages)


def test_check_opens_every_schema_page_once():
    """Verify a Check run covers the configured, sub and unconfigured schema."""
    browser = RecordingBrowser(unconfigured_share=0.0)

    schema_session(browser, [CONFIGURED, UNCONFIGURED], cover_all=True)

    names = [name for name, _ in browser.pages if name.startswith("page:network")]
    assert sorted(names) == [
        "page:network-schema",
        "page:network-schema:node",
        "page:network-schema:unconfigured",
    ]


@pytest.mark.parametrize(
    ("share", "expected"),
    [
        (0.0, {("page:network-schema", "/project/1/network-schema")}),
        (
            100.0,
            {("page:network-schema:unconfigured", "/project/2/network-schema")},
        ),
    ],
)
def test_editor_follows_the_unconfigured_share(monkeypatch, share, expected):
    """Verify node drags in seeded projects respect the share and its naming."""
    monkeypatch.setattr(edit, "TASKS", {"node": 1})
    browser = RecordingBrowser(unconfigured_share=share)
    fixture = Fixture(
        projects=[CONFIGURED, UNCONFIGURED], conduit_type_id=None, flag_id=None
    )

    for _ in range(30):
        edit_session(browser, fixture)

    assert main_pages(browser) == expected
