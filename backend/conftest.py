"""Pytest setup for runs started inside ``backend/``."""

from pathlib import Path

import pytest

LOADTEST_TESTS = Path(__file__).resolve().parent.parent / "loadtest" / "tests_backend"


def pytest_configure(config: pytest.Config) -> None:
    """Also collect the load-test add-on's Django tests on a plain ``pytest``.

    The ``testpaths`` in the repository's ``pytest.ini`` only apply when pytest
    starts in the repository root. Started in ``backend/`` without paths, it
    would silently skip the seeder and user tests, so a model change that
    breaks the seeder would pass.

    Args:
        config: The pytest config whose collection arguments are extended.
    """
    if (
        config.args_source == pytest.Config.ArgsSource.INVOCATION_DIR
        and LOADTEST_TESTS.is_dir()
    ):
        config.args.append(str(LOADTEST_TESTS))
