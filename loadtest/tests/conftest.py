"""Test setup for the Locust side.

Locust monkey-patches the standard library with gevent on import. That has
to happen before anything imports ``ssl`` (requests does), or ssl recurses.
"""

import locust  # noqa: F401
