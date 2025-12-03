"""
Custom storage backend for local filesystem storage.
"""

import logging
import os
import unicodedata

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.utils.deconstruct import deconstructible

logger = logging.getLogger(__name__)


@deconstructible
class LocalMediaStorage(FileSystemStorage):
    """
    Custom storage class for storing files on the local filesystem.

    This storage backend provides:
    - Automatic folder organization based on feature type and file category
    - Simple, fast local filesystem access
    - Integration with Django's FileField

    Files are organized in a structured hierarchy:
    media/
    project_name/
    ├── trenches/
    │   ├── [trench_id]/
    │   │   ├── photos/
    │   │   ├── documents/
    │   │   └── drawings/
    ├── nodes/
    ├── addresses/
    └── residentialunits/
    """

    def __init__(self, location=None, base_url=None):
        """
        Initialize the storage backend.

        Args:
            location: Root directory for media files (defaults to settings.MEDIA_ROOT)
            base_url: Base URL for serving files (defaults to settings.MEDIA_URL)
        """
        if location is None:
            location = settings.MEDIA_ROOT
        if base_url is None:
            base_url = settings.MEDIA_URL

        super().__init__(location=location, base_url=base_url)
        logger.info(f"LocalMediaStorage initialized with location: {location}")

    def get_valid_name(self, name):
        """
        Preserve Unicode characters including umlauts.

        Django's default get_valid_name() strips diacritical marks due to
        Unicode normalization issues (NFD vs NFC). This override normalizes
        to NFC form to preserve umlauts (ä, ö, ü) and other accented characters
        while ensuring cross-platform compatibility.

        Args:
            name: The original filename

        Returns:
            The filename normalized to NFC form
        """
        # Normalize to NFC (composed form) to preserve accented characters
        return unicodedata.normalize("NFC", name)

    def get_available_name(self, name, max_length=None):
        """
        Return a filename that's available in the storage mechanism.

        Overrides the default behavior to allow replacing existing files
        with the same name, rather than appending random strings.
        """
        # Remove the file if it already exists to allow overwriting
        if self.exists(name):
            logger.info(f"File {name} already exists, will be overwritten")
            os.remove(os.path.join(self.location, name))
        return name

    def _save(self, name, content):
        """
        Save a file to the storage system.

        Args:
            name: The filename to save
            content: File content

        Returns:
            The name of the saved file
        """
        full_path = self.path(name)
        directory = os.path.dirname(full_path)

        if not os.path.exists(directory):
            try:
                os.makedirs(directory, exist_ok=True)
                logger.info(f"Created directory: {directory}")
            except OSError as e:
                logger.error(f"Error creating directory {directory}: {e}")
                raise

        return super()._save(name, content)

    def delete(self, name):
        """
        Delete a file from the storage system.

        Args:
            name: The filename to delete
        """
        try:
            super().delete(name)
            logger.info(f"Deleted file: {name}")
        except Exception as e:
            logger.error(f"Error deleting file {name}: {e}")
            raise

    def url(self, name):
        """
        Return the URL for accessing the file.

        The URL will be served through Nginx with authentication via X-Accel-Redirect.

        Args:
            name: The filename

        Returns:
            The URL to access the file
        """
        if self.base_url is None:
            raise ValueError("This file is not accessible via a URL.")

        url = super().url(name)
        logger.debug(f"Generated URL for {name}: {url}")
        return url

    def rename_folder(self, old_folder_path, new_folder_path):
        """
        Rename a folder in the storage filesystem.

        Used when a feature's identifier changes (e.g., Node name, Cable name)
        to keep the folder structure consistent with the feature's current name.

        Args:
            old_folder_path: Relative path from MEDIA_ROOT (e.g., "Project/nodes/OldName")
            new_folder_path: New relative path (e.g., "Project/nodes/NewName")

        Returns:
            bool: True if folder was renamed, False if old folder doesn't exist

        Raises:
            OSError: If rename fails (permissions, new path already exists, etc.)
        """
        old_full = os.path.join(self.location, old_folder_path)
        new_full = os.path.join(self.location, new_folder_path)

        if not os.path.exists(old_full):
            logger.debug(f"Folder does not exist, skipping rename: {old_folder_path}")
            return False

        if os.path.exists(new_full):
            raise OSError(f"Target folder already exists: {new_folder_path}")

        os.rename(old_full, new_full)
        logger.info(f"Renamed folder: {old_folder_path} -> {new_folder_path}")
        return True


@deconstructible
class QGISProjectStorage(FileSystemStorage):
    """
    Custom storage class for QGIS project files.

    Stores project files in deployment/qgis/projects/ directory
    which is mounted as a read-only volume in the QGIS Server container.
    """

    def __init__(self, location=None, base_url=None):
        """
        Initialize the storage backend for QGIS projects.

        Files are stored in:
        - Docker: /app/qgis/projects (mounted from host ./qgis/projects)
        - Development: {project_root}/deployment/qgis/projects
        """
        if location is None:
            if os.path.exists("/app") and os.path.isdir("/app"):
                location = "/app/qgis/projects"
                logger.info("Detected Docker environment, using container path")
            else:
                project_root = os.path.dirname(
                    os.path.dirname(
                        os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                    )
                )
                location = os.path.join(project_root, "deployment", "qgis", "projects")
                logger.info(
                    "Detected local development environment, using relative path"
                )

        # QGIS projects don't need a base URL (served via QGIS Server, not Django)
        base_url = None

        super().__init__(location=location, base_url=base_url)
        logger.info(f"QGISProjectStorage initialized with location: {location}")

    def get_valid_name(self, name):
        """
        Preserve the exact filename for QGIS projects.
        """
        return unicodedata.normalize("NFC", name)

    def get_available_name(self, name, max_length=None):
        """
        Allow overwriting existing project files.
        """
        if self.exists(name):
            logger.info(f"QGIS project {name} already exists, will be overwritten")
            os.remove(os.path.join(self.location, name))
        return name

    def _save(self, name, content):
        """
        Save QGIS project file to deployment/qgis/projects/.
        """
        full_path = self.path(name)
        directory = os.path.dirname(full_path)

        logger.info(f"QGISProjectStorage._save() called with name: {name}")
        logger.info(f"Full file path will be: {full_path}")
        logger.info(f"Storage location: {self.location}")

        if not os.path.exists(directory):
            try:
                os.makedirs(directory, exist_ok=True)
                logger.info(f"Created QGIS projects directory: {directory}")
            except OSError as e:
                logger.error(f"Error creating QGIS projects directory {directory}: {e}")
                raise

        result = super()._save(name, content)

        if os.path.exists(full_path):
            file_size = os.path.getsize(full_path)
            logger.info(
                f"Successfully saved QGIS project: {name} to {full_path} (size: {file_size} bytes)"
            )
        else:
            logger.error(
                f"QGIS project file was not saved to expected location: {full_path}"
            )

        return result

    def delete(self, name):
        """
        Delete QGIS project file.
        """
        try:
            super().delete(name)
            logger.info(f"Deleted QGIS project: {name}")
        except Exception as e:
            logger.error(f"Error deleting QGIS project {name}: {e}")
            raise
