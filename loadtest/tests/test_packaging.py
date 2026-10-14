"""Checks that the image, the compose service and the dev environment agree."""

import re
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LOADTEST = ROOT / "loadtest"


def test_image_and_dev_environment_pin_the_same_locust():
    """Verify the Dockerfile installs the Locust version the tests run with."""
    dockerfile = (LOADTEST / "Dockerfile").read_text()
    pyproject = tomllib.loads((LOADTEST / "pyproject.toml").read_text())

    [image_pin] = re.findall(r"locust==([\d.]+)", dockerfile)
    [dev_pin] = [
        d.split("==")[1]
        for d in pyproject["project"]["dependencies"]
        if d.startswith("locust==")
    ]

    assert image_pin == dev_pin


def test_image_starts_the_locustfile_under_the_proxied_path():
    """Verify the container command matches the package and the Caddy route."""
    dockerfile = (LOADTEST / "Dockerfile").read_text()
    caddy = (ROOT / "deployment" / "Caddyfile.production").read_text()

    assert (LOADTEST / "qonnectra_loadtest" / "locustfile.py").exists()
    assert '"qonnectra_loadtest/locustfile.py"' in dockerfile
    assert '"/loadtest/runner"' in dockerfile
    assert "handle /loadtest* {" in caddy and "reverse_proxy loadtest:8089" in caddy


def test_compose_service_is_opt_in():
    """Verify the service only starts with the loadtest profile and builds on the backend."""
    compose = (ROOT / "deployment" / "docker-compose.yml").read_text()
    service = compose[compose.index("  loadtest:\n") :].split("\n\n")[0]

    assert 'profiles: ["loadtest"]' in service
    assert "backend: service:backend" in service
    assert "container_name: qonnectra_loadtest_prod" in service
