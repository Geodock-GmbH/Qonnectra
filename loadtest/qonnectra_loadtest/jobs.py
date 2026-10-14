"""Seeding and purging as background subprocesses with a live log.

One job runs at a time. The CLI does the Django work in its own process, so
neither the web UI nor a running test waits for the database.
"""

import subprocess
import sys
import threading
import time
from dataclasses import dataclass, field

MAX_LINES = 400


@dataclass
class Job:
    """One CLI invocation and what it printed so far."""

    label: str
    args: list[str]
    started: float = field(default_factory=time.time)
    ended: float | None = None
    state: str = "running"
    """``running``, ``done`` or ``failed``."""
    lines: list[str] = field(default_factory=list)

    def snapshot(self) -> dict:
        """Return the job as JSON-serialisable data."""
        return {
            "label": self.label,
            "state": self.state,
            "started": self.started,
            "ended": self.ended,
            "lines": self.lines[-MAX_LINES:],
        }


class Jobs:
    """Runs at most one ``python -m qonnectra_loadtest`` job at a time."""

    def __init__(self, on_finish=None):
        """Create an idle job runner.

        Args:
            on_finish: Called without arguments after every job, e.g. to
                drop a cached data overview.
        """
        self.current: Job | None = None
        self.on_finish = on_finish
        self.lock = threading.Lock()

    @property
    def busy(self) -> bool:
        """Return whether a job is running.

        Returns:
            bool: True while the current job has not ended.
        """
        return self.current is not None and self.current.state == "running"

    def start(self, label: str, args: list[str]) -> Job:
        """Start a job in the background.

        Args:
            label: What the UI shows, e.g. ``Seed medium``.
            args: CLI arguments after ``python -m qonnectra_loadtest``.

        Returns:
            Job: The started job.

        Raises:
            RuntimeError: If another job is still running.
        """
        with self.lock:
            if self.busy:
                raise RuntimeError(f"'{self.current.label}' is still running.")
            job = Job(label, args)
            self.current = job
        threading.Thread(target=self._run, args=(job,), daemon=True).start()
        return job

    def _run(self, job: Job):
        """Run the CLI and collect its output line by line."""
        try:
            process = subprocess.Popen(
                [sys.executable, "-m", "qonnectra_loadtest", *job.args],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
            )
            for line in process.stdout:
                job.lines.append(line.rstrip())
            job.state = "done" if process.wait() == 0 else "failed"
        except OSError as error:
            job.lines.append(str(error))
            job.state = "failed"
        job.ended = time.time()
        if self.on_finish:
            self.on_finish()
