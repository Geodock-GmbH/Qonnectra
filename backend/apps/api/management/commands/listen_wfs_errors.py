"""
Django management command to listen for WFS error notifications from PostgreSQL.

This command establishes a persistent connection to PostgreSQL and listens on the
'wfs_error_channel' for notifications sent by database triggers when QGIS/WFS
operations fail validation.

The PostgreSQL NOTIFY system is used with autonomous transactions (via dblink) to
ensure notifications are delivered even when the main transaction rolls back. This
allows us to log validation errors that would otherwise be lost when triggers raise
exceptions to reject invalid data.

Usage:
    python manage.py listen_wfs_errors

The command runs continuously until interrupted (Ctrl+C) or until a fatal error occurs.

Found on: https://stackoverflow.com/questions/1113277/how-do-i-do-large-non-blocking-updates-in-postgresql/22163648#22163648
"""

import json
import logging
import signal
import time

import psycopg
from apps.api.models import LogEntry, Projects
from django.conf import settings
from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        "Listen for WFS error notifications from PostgreSQL and create LogEntry records"
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.should_stop = False
        self.conn = None
        self.cursor = None

    def add_arguments(self, parser):
        parser.add_argument(
            "--reconnect-delay",
            type=int,
            default=5,
            help="Seconds to wait before reconnecting after connection loss (default: 5)",
        )
        parser.add_argument(
            "--heartbeat-interval",
            type=int,
            default=60,
            help="Seconds between heartbeat checks (default: 60)",
        )

    def handle(self, *args, **options):
        """Main command handler."""
        reconnect_delay = options["reconnect_delay"]
        heartbeat_interval = options["heartbeat_interval"]

        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

        self.stdout.write(
            self.style.SUCCESS("Starting WFS error listener (press Ctrl+C to stop)...")
        )

        last_heartbeat = time.time()

        while not self.should_stop:
            try:
                if self.conn is None or getattr(self.conn, "closed", True):
                    self._connect()
                    last_heartbeat = time.time()

                gen = self.conn.notifies(timeout=5)

                try:
                    for notify in gen:
                        self._process_notification(notify)

                        if self.should_stop:
                            gen.close()
                            break
                except StopIteration:
                    pass

                if time.time() - last_heartbeat > heartbeat_interval:
                    self._heartbeat()
                    last_heartbeat = time.time()

            except psycopg.OperationalError as e:
                logger.error(f"Database connection error: {e}")
                self.stdout.write(
                    self.style.ERROR(
                        f"Lost database connection: {e}. Reconnecting in {reconnect_delay}s..."
                    )
                )
                self._cleanup_connection()
                time.sleep(reconnect_delay)

            except Exception as e:
                logger.exception(f"Unexpected error in listener: {e}")
                self.stdout.write(
                    self.style.ERROR(f"Unexpected error: {e}. Reconnecting...")
                )
                self._cleanup_connection()
                time.sleep(reconnect_delay)

        self._cleanup_connection()
        self.stdout.write(self.style.SUCCESS("WFS error listener stopped."))

    def _connect(self):
        """Establish connection to PostgreSQL and start listening."""
        try:
            db_config = settings.DATABASES["default"]

            conn_params = {
                "dbname": db_config["NAME"],
                "user": db_config["USER"],
                "password": db_config["PASSWORD"],
                "host": db_config["HOST"],
                "port": db_config.get("PORT", 5432),
            }

            self.conn = psycopg.connect(**conn_params, autocommit=True)
            self.cursor = self.conn.cursor()

            self.cursor.execute("LISTEN wfs_error_channel;")

            self.stdout.write(
                self.style.SUCCESS(
                    "Connected to database and listening on 'wfs_error_channel'"
                )
            )
            logger.info("WFS error listener connected and listening")

        except Exception as e:
            logger.exception(f"Failed to connect to database: {e}")
            self.stdout.write(self.style.ERROR(f"Connection failed: {e}"))
            raise

    def _cleanup_connection(self):
        """Clean up database connection."""
        if self.cursor:
            try:
                self.cursor.close()
            except Exception:
                pass
            self.cursor = None

        if self.conn:
            try:
                self.conn.close()
            except Exception:
                pass
            self.conn = None

    def _signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully."""
        self.stdout.write(
            self.style.WARNING(f"\nReceived signal {signum}, shutting down...")
        )
        self.should_stop = True

    def _heartbeat(self):
        """Send a simple query to keep connection alive and verify it's working."""
        try:
            self.cursor.execute("SELECT 1;")
            logger.debug("Heartbeat check successful")
        except Exception as e:
            logger.error(f"Heartbeat check failed: {e}")
            raise

    def _process_notification(self, notify):
        """
        Process a notification from PostgreSQL.

        Args:
            notify: psycopg3 Notify object with 'payload' attribute containing JSON data
        """
        try:
            data = json.loads(notify.payload)

            level = data.get("level", "ERROR")
            logger_name = data.get("logger_name", "trigger.unknown")
            message = data.get("message", "Unknown error")
            extra_data = data.get("extra_data", {})
            project_id = data.get("project_id")

            project = None
            if project_id:
                try:
                    project = Projects.objects.get(id=project_id)
                except Projects.DoesNotExist:
                    logger.warning(
                        f"Project with id {project_id} not found for log entry"
                    )

            log_entry = LogEntry.objects.create(
                level=level,
                logger_name=logger_name,
                message=message,
                source="wfs",
                extra_data=extra_data,
                project=project,
                user=None,  # WFS operations don't have direct user association
                path=None,  # Not applicable for database triggers
            )

            self.stdout.write(
                self.style.SUCCESS(f"[{log_entry.timestamp}] {level}: {message[:80]}")
            )
            logger.info(
                f"Created log entry {log_entry.uuid} from WFS notification: {message}"
            )

        except json.JSONDecodeError as e:
            logger.error(
                f"Failed to parse notification payload: {notify.payload} - {e}"
            )
            self.stdout.write(
                self.style.ERROR(f"Invalid JSON in notification: {notify.payload}")
            )

        except Exception as e:
            logger.exception(f"Error processing notification: {e}")
            self.stdout.write(self.style.ERROR(f"Failed to process notification: {e}"))
