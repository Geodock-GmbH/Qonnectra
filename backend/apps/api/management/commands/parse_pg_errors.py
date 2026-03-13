"""
Django management command to parse PostgreSQL errors from Docker container logs.

This command monitors the PostgreSQL Docker container's stderr for ERROR messages
and creates LogEntry records for WFS-related errors. It replaces the previous
trigger-based NOTIFY system with a simpler approach that relies on PostgreSQL's
native error logging.

Usage:
    python manage.py parse_pg_errors --container krit_gis_db

The command runs continuously until interrupted (Ctrl+C) or until a fatal error occurs.
It uses `docker logs -f` to tail the container logs in real-time and parses multi-line
error blocks (ERROR + DETAIL + STATEMENT).

State Recovery:
    On startup, the command reads the last processed timestamp from a state file
    and uses `docker logs --since` to avoid reprocessing old logs.
"""

import fcntl
import json
import logging
import os
import re
import select
import signal
import subprocess
import time
from pathlib import Path

from apps.api.models import LogEntry
from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Parse PostgreSQL errors from Docker logs and create LogEntry records"

    def __init__(self, *args, **kwargs):
        """Initialize command state for log parsing.

        Args:
            *args: Positional arguments passed to BaseCommand.
            **kwargs: Keyword arguments passed to BaseCommand.
        """
        super().__init__(*args, **kwargs)
        self.should_stop = False
        self.process = None
        self.state_file = Path("/tmp/pg_error_parser_state.json")
        self.last_timestamp = None

    def add_arguments(self, parser):
        """Define CLI arguments for the command.

        Args:
            parser: ArgumentParser instance to register arguments on.
        """
        parser.add_argument(
            "--container",
            type=str,
            default="krit_gis_db",
            help="Name of the PostgreSQL Docker container (default: krit_gis_db)",
        )
        parser.add_argument(
            "--reconnect-delay",
            type=int,
            default=5,
            help="Seconds to wait before reconnecting after error (default: 5)",
        )

    def handle(self, *args, **options):
        """Run the error parser loop, reconnecting on failure until interrupted.

        Args:
            *args: Positional arguments (unused).
            **options: Command options including 'container' and 'reconnect_delay'.
        """
        container = options["container"]
        reconnect_delay = options["reconnect_delay"]

        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

        self._load_state()

        self.stdout.write(
            self.style.SUCCESS(
                f"Starting PostgreSQL error parser for container '{container}' "
                "(press Ctrl+C to stop)..."
            )
        )

        if self.last_timestamp:
            self.stdout.write(
                self.style.NOTICE(f"Resuming from timestamp: {self.last_timestamp}")
            )

        while not self.should_stop:
            try:
                self._tail_logs(container)
            except subprocess.SubprocessError as e:
                logger.error(f"Docker logs process error: {e}")
                self.stdout.write(
                    self.style.ERROR(
                        f"Docker logs error: {e}. Retrying in {reconnect_delay}s..."
                    )
                )
                time.sleep(reconnect_delay)
            except Exception as e:
                logger.exception(f"Unexpected error: {e}")
                self.stdout.write(
                    self.style.ERROR(
                        f"Unexpected error: {e}. Retrying in {reconnect_delay}s..."
                    )
                )
                time.sleep(reconnect_delay)

        self._save_state()
        self.stdout.write(self.style.SUCCESS("PostgreSQL error parser stopped."))

    def _signal_handler(self, signum, frame):
        """Handle shutdown signals by stopping the parser loop.

        Args:
            signum: Signal number received.
            frame: Current stack frame (unused).
        """
        self.stdout.write(
            self.style.WARNING(f"\nReceived signal {signum}, shutting down...")
        )
        self.should_stop = True
        if self.process:
            self.process.terminate()

    def _load_state(self):
        """Load the last processed timestamp from the state file.

        Read the JSON state file at ``self.state_file`` and restore
        ``self.last_timestamp`` so ``docker logs --since`` can skip
        already-processed entries.
        """
        try:
            if self.state_file.exists():
                data = json.loads(self.state_file.read_text())
                self.last_timestamp = data.get("last_timestamp")
                logger.info(f"Loaded state: last_timestamp={self.last_timestamp}")
        except Exception as e:
            logger.warning(f"Failed to load state file: {e}")
            self.last_timestamp = None

    def _save_state(self):
        """Persist the last processed timestamp to the state file."""
        try:
            data = {"last_timestamp": self.last_timestamp}
            self.state_file.write_text(json.dumps(data))
            logger.debug(f"Saved state: last_timestamp={self.last_timestamp}")
        except Exception as e:
            logger.warning(f"Failed to save state file: {e}")

    def _tail_logs(self, container: str):
        """Tail Docker container logs and parse PostgreSQL error blocks.

        Spawn ``docker logs -f`` as a subprocess with non-blocking I/O,
        accumulate multi-line error blocks (ERROR + DETAIL + STATEMENT),
        and flush them to :meth:`_process_error_block` on PID change or
        read timeout.

        Args:
            container: Name of the Docker container to tail.

        Raises:
            subprocess.SubprocessError: If the docker logs process fails.
        """
        cmd = ["docker", "logs", "-f", "--timestamps"]

        if self.last_timestamp:
            cmd.extend(["--since", self.last_timestamp])

        cmd.append(container)

        logger.info(f"Running: {' '.join(cmd)}")

        self.process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            bufsize=0,
        )

        fd = self.process.stdout.fileno()
        flags = fcntl.fcntl(fd, fcntl.F_GETFL)
        fcntl.fcntl(fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

        error_buffer = []
        current_timestamp = None
        current_pid = None
        flush_timeout = 0.5
        read_buffer = b""

        # Docker prepends an ISO timestamp, followed by PostgreSQL's log_line_prefix
        # e.g. 2026-01-09T13:58:50.274Z 2026-01-09 13:58:50.274 UTC [20269] user@db ERROR: ...
        docker_ts_pattern = re.compile(r"^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s+")
        pg_log_pattern = re.compile(
            r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+ \w+) \[(\d+)\] (\w+@\w+)?\s*"
        )

        try:
            while not self.should_stop:
                # Use select to wait for data with timeout
                ready, _, _ = select.select(
                    [self.process.stdout], [], [], flush_timeout
                )

                if not ready:
                    if error_buffer:
                        self._process_error_block(error_buffer, current_timestamp)
                        error_buffer = []
                    continue

                try:
                    chunk = os.read(fd, 65536)
                    if not chunk:
                        break
                    read_buffer += chunk
                except BlockingIOError:
                    pass
                while b"\n" in read_buffer:
                    line_bytes, read_buffer = read_buffer.split(b"\n", 1)
                    line = line_bytes.decode("utf-8", errors="replace").rstrip()

                    if not line:
                        continue

                    docker_match = docker_ts_pattern.match(line)
                    if docker_match:
                        self.last_timestamp = docker_match.group(1)
                        line = line[docker_match.end() :]

                    pg_match = pg_log_pattern.match(line)
                    if pg_match:
                        new_pid = pg_match.group(2)
                        line_content = line[pg_match.end() :]

                        # Flush buffered error when PID changes (new connection)
                        if error_buffer and current_pid and current_pid != new_pid:
                            self._process_error_block(error_buffer, current_timestamp)
                            error_buffer = []

                        current_timestamp = pg_match.group(1)
                        current_pid = new_pid

                        if "ERROR:" in line_content:
                            if error_buffer:
                                self._process_error_block(
                                    error_buffer, current_timestamp
                                )
                            error_buffer = [line_content]
                        elif error_buffer:
                            error_buffer.append(line_content)

                    elif error_buffer and line.strip():
                        error_buffer.append(line)

            if error_buffer:
                self._process_error_block(error_buffer, current_timestamp)

        finally:
            if self.process:
                self.process.terminate()
                self.process.wait()
                self.process = None

    def _process_error_block(self, lines: list[str], timestamp: str | None):
        """Parse a multi-line PostgreSQL error block and persist it as a :model:`api.LogEntry`.

        Extract ERROR, DETAIL, HINT, and STATEMENT parts from the buffered
        lines and create a single LogEntry with source ``wfs``.

        Args:
            lines: Accumulated log lines forming one error block.
            timestamp: PostgreSQL log timestamp string, or None.
        """
        if not lines:
            return

        error_msg = ""
        detail = ""
        hint = ""
        statement = ""

        for line in lines:
            if line.startswith("ERROR:"):
                error_msg = line[6:].strip()
            elif line.startswith("DETAIL:"):
                detail = line[7:].strip()
            elif line.startswith("HINT:"):
                hint = line[5:].strip()
            elif line.startswith("STATEMENT:"):
                statement = line[10:].strip()
            elif statement:
                statement += " " + line.strip()

        if not error_msg:
            return

        message = error_msg
        if detail:
            message += f"\nDetail: {detail}"
        if hint:
            message += f"\nHint: {hint}"

        extra_data = {}
        if statement:
            extra_data["statement"] = statement[:5000]  # Limit statement length
        if timestamp:
            extra_data["pg_timestamp"] = timestamp

        try:
            log_entry = LogEntry.objects.create(
                level="ERROR",
                logger_name="postgresql",
                message=message[:10000],  # Limit message length
                source="wfs",
                extra_data=extra_data if extra_data else None,
                user=None,
                path=None,
                project=None,
            )

            self.stdout.write(
                self.style.SUCCESS(f"[{log_entry.timestamp}] ERROR: {error_msg[:80]}")
            )
            logger.info(f"Created log entry {log_entry.uuid}: {error_msg}")
            self._save_state()

        except Exception as e:
            logger.exception(f"Failed to create log entry: {e}")
            self.stdout.write(self.style.ERROR(f"Failed to create log entry: {e}"))
