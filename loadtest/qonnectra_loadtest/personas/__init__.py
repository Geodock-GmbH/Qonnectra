"""The four kinds of users, weighted like a working team: mostly on the map.

Each class is one entry in the runner's persona picker. Weights are shares
of the running users; untick a persona to leave it out.
"""

from locust import FastHttpUser, constant, task
from locust.exception import StopUser

from qonnectra_loadtest import run
from qonnectra_loadtest.client import PARALLEL_TILES, Browser
from qonnectra_loadtest.personas.edit import edit_session
from qonnectra_loadtest.personas.map import map_session
from qonnectra_loadtest.personas.schema import schema_session
from qonnectra_loadtest.personas.search import search_session


class Persona(FastHttpUser):
    """A signed-in load-test user that runs one kind of session over and over."""

    abstract = True
    concurrency = PARALLEL_TILES
    wait_time = constant(0)
    network_timeout = 60.0
    connection_timeout = 15.0

    def on_start(self):
        """Sign in, or stop when the run could not be prepared.

        A session older than the keep-alive interval is extended first, as
        the app does on the first page load. A Check run always extends it
        once, so the refresh is part of every check.
        """
        current = run.current
        if current is None or not current.ready:
            raise StopUser()
        self.run = current
        self.browser = Browser(self, current.next_session(), current)
        self.browser.keep_alive(force=current.once)

    def session(self):
        """Run one session of this persona."""
        raise NotImplementedError

    @task
    def visit(self):
        """Run sessions back to back; the Check profile stops after one."""
        self.session()
        if self.run.once:
            raise StopUser()


class MapUser(Persona):
    """Opens a project map, pans, zooms and clicks features."""

    weight = 60

    def session(self):
        """Run one map session."""
        map_session(self.browser, self.run.fixture.projects, cover_all=self.run.once)


class SearchUser(Persona):
    """Searches in the map's search panel and opens a result."""

    weight = 15

    def session(self):
        """Run one search session."""
        search_session(self.browser, self.run.fixture.projects)


class SchemaUser(Persona):
    """Works in the network schema and the conduit table."""

    weight = 15

    def session(self):
        """Run one planning session."""
        schema_session(self.browser, self.run.fixture.projects)


class EditUser(Persona):
    """Edits trenches and conduits in seeded projects only."""

    weight = 10

    def session(self):
        """Run one editing session."""
        edit_session(self.browser, self.run.fixture, cover_all=self.run.once)
