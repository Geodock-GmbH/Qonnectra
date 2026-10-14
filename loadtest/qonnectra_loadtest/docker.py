"""Container stats and logs through the Docker CLI on the mounted socket.

The backend image already ships the Docker CLI for the pg-error-parser. Every
call degrades to an empty result when the socket is missing, so a run still
works without container data.
"""

import json
import re
import subprocess

from qonnectra_loadtest.analysis import parse_container_stat


def _docker(*args: str, timeout: float = 30) -> str | None:
    """Run a docker command and return its output, or None on any failure."""
    try:
        result = subprocess.run(
            ["docker", *args],
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if result.returncode != 0:
        return None
    return result.stdout + result.stderr


def available() -> bool:
    """Return whether the Docker socket answers."""
    return _docker("version", "--format", "{{.Server.Version}}", timeout=5) is not None


def container_names() -> list[str]:
    """Return the names of all running containers."""
    output = _docker("ps", "--format", "{{.Names}}", timeout=10) or ""
    return [line.strip() for line in output.splitlines() if line.strip()]


def find_container(service: str, names: list[str]) -> str | None:
    """Return the container of a compose service, e.g. ``qonnectra_db_prod``.

    Args:
        service: Service part of the name, e.g. ``db`` or ``nginx``.
        names: Running container names.

    Returns:
        str | None: The first ``qonnectra_<service>_<env>`` match.
    """
    pattern = re.compile(rf"^qonnectra_{re.escape(service)}_[a-z]+$")
    return next((name for name in names if pattern.match(name)), None)


def stats() -> list[tuple[str, float, float]]:
    """Return CPU % and RAM MiB of every container of this stack.

    ``docker stats`` measures over about two seconds before it answers.

    Returns:
        list[tuple]: ``(short name, CPU %, RAM MiB)`` per container.
    """
    output = _docker("stats", "--no-stream", "--format", "{{json .}}") or ""
    rows = []
    for line in output.splitlines():
        try:
            parsed = parse_container_stat(json.loads(line))
        except (json.JSONDecodeError, ValueError):
            continue
        if parsed:
            rows.append(parsed)
    return rows


def logs(container: str, since: str, until: str) -> list[str]:
    """Return a container's log lines between two times.

    Args:
        container: Container name.
        since: Start as RFC 3339 time.
        until: End as RFC 3339 time.

    Returns:
        list[str]: stdout and stderr lines; empty when unavailable.
    """
    output = _docker("logs", "--since", since, "--until", until, container, timeout=120)
    return output.splitlines() if output else []
