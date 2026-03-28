"""Custom storage backends for local filesystem and QGIS project files."""

import logging
import os
import unicodedata

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.utils.deconstruct import deconstructible

logger = logging.getLogger(__name__)


@deconstructible
class LocalMediaStorage(FileSystemStorage):
    """Local filesystem storage with folder organisation by feature type.

    Organize uploaded files in a structured hierarchy under MEDIA_ROOT::

        project_name/
        ├── trenches/<id>/{photos,documents,drawings}/
        ├── nodes/
        ├── addresses/
        └── residentialunits/

    Overwrite existing files with the same name and preserve Unicode
    filenames (including umlauts) via NFC normalisation.
    """

    def __init__(self, location=None, base_url=None):
        """Initialize the storage backend.

        Args:
            location: Root directory for media files. Defaults to ``MEDIA_ROOT``.
            base_url: Base URL for serving files. Defaults to ``MEDIA_URL``.
        """
        if location is None:
            location = settings.MEDIA_ROOT
        if base_url is None:
            base_url = settings.MEDIA_URL

        super().__init__(location=location, base_url=base_url)
        logger.info(f"LocalMediaStorage initialized with location: {location}")

    def get_valid_name(self, name):
        """Preserve Unicode characters including umlauts.

        Django's default strips diacritical marks via NFD decomposition.
        NFC normalisation keeps composed characters (ä, ö, ü) intact.

        Args:
            name: The original filename.

        Returns:
            str: Filename normalised to NFC form.
        """
        return unicodedata.normalize("NFC", name)

    def get_available_name(self, name, max_length=None):
        """Return a filename, overwriting any existing file with the same name.

        Args:
            name: Desired filename.
            max_length: Unused; kept for API compatibility.

        Returns:
            str: The unchanged filename.
        """
        if self.exists(name):
            logger.info(f"File {name} already exists, will be overwritten")
            os.remove(os.path.join(self.location, name))
        return name

    def _save(self, name, content):
        """Save a file, creating intermediate directories as needed.

        Args:
            name: Relative path for the file.
            content: File content (``File`` instance).

        Returns:
            str: The name of the saved file.
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
        """Delete a file from the storage system.

        Args:
            name: Relative path of the file to delete.
        """
        try:
            super().delete(name)
            logger.info(f"Deleted file: {name}")
        except Exception as e:
            logger.error(f"Error deleting file {name}: {e}")
            raise

    def url(self, name):
        """Return the URL for accessing the file.

        Served through Nginx with authentication via X-Accel-Redirect.

        Args:
            name: Relative path of the file.

        Returns:
            str: URL to access the file.

        Raises:
            ValueError: If no ``base_url`` is configured.
        """
        if self.base_url is None:
            raise ValueError("This file is not accessible via a URL.")

        url = super().url(name)
        logger.debug(f"Generated URL for {name}: {url}")
        return url

    def rename_folder(self, old_folder_path, new_folder_path):
        """Rename a folder when a feature's identifier changes.

        Keep the folder structure consistent when e.g. a Node or Cable
        is renamed.

        Args:
            old_folder_path: Relative path from MEDIA_ROOT
                (e.g. ``"Project/nodes/OldName"``).
            new_folder_path: New relative path
                (e.g. ``"Project/nodes/NewName"``).

        Returns:
            bool: True if the folder was renamed, False if it did not exist.

        Raises:
            OSError: If the target folder already exists or rename fails.
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
    """Storage backend for QGIS project files.

    Store ``.qgs`` files in ``deployment/qgis/projects/``, which is
    mounted as a read-only volume in the QGIS Server container.
    """

    def __init__(self, location=None, base_url=None):
        """Initialize the QGIS project storage backend.

        Auto-detect the environment to choose the storage path:

        - Docker: ``/app/qgis/projects``
        - Development: ``{project_root}/deployment/qgis/projects``

        Args:
            location: Override for the storage directory.
            base_url: Unused — QGIS projects are served via QGIS Server.
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

        base_url = None

        super().__init__(location=location, base_url=base_url)
        logger.info(f"QGISProjectStorage initialized with location: {location}")

    def get_valid_name(self, name):
        """Preserve the exact filename via NFC normalisation.

        Args:
            name: The original filename.

        Returns:
            str: Filename normalised to NFC form.
        """
        return unicodedata.normalize("NFC", name)

    def get_available_name(self, name, max_length=None):
        """Return the filename, overwriting any existing project file.

        Args:
            name: Desired filename.
            max_length: Unused; kept for API compatibility.

        Returns:
            str: The unchanged filename.
        """
        if self.exists(name):
            logger.info(f"QGIS project {name} already exists, will be overwritten")
            os.remove(os.path.join(self.location, name))
        return name

    def _save(self, name, content):
        """Save a QGIS project file, creating directories as needed.

        Args:
            name: Relative path for the project file.
            content: File content (``File`` instance).

        Returns:
            str: The name of the saved file.
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
        """Delete a QGIS project file.

        Args:
            name: Relative path of the file to delete.
        """
        try:
            super().delete(name)
            logger.info(f"Deleted QGIS project: {name}")
        except Exception as e:
            logger.error(f"Error deleting QGIS project {name}: {e}")
            raise


@deconstructible
class QGISDataFileStorage(FileSystemStorage):
    """Storage backend for QGIS project data files (DXF, SHP, GeoJSON, etc.).

    Store data files in ``deployment/qgis/data/``, which is mounted as a
    read-only volume in the QGIS Server container at ``/data``.
    """

    def __init__(self, location=None, base_url=None):
        """Initialize the QGIS data file storage backend.

        Auto-detect the environment to choose the storage path:

        - Docker: ``/app/qgis/data``
        - Development: ``{project_root}/deployment/qgis/data``

        Args:
            location: Override for the storage directory.
            base_url: Unused — data files are served via QGIS Server.
        """
        if location is None:
            if os.path.exists("/app") and os.path.isdir("/app"):
                location = "/app/qgis/data"
                logger.info("QGISDataFileStorage: Docker environment detected")
            else:
                project_root = os.path.dirname(
                    os.path.dirname(
                        os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                    )
                )
                location = os.path.join(project_root, "deployment", "qgis", "data")
                logger.info("QGISDataFileStorage: local dev environment detected")

        base_url = None
        super().__init__(location=location, base_url=base_url)
        logger.info(f"QGISDataFileStorage initialized with location: {location}")

    def get_valid_name(self, name):
        """Preserve the exact filename via NFC normalisation.

        Args:
            name: The original filename.

        Returns:
            str: Filename normalised to NFC form.
        """
        return unicodedata.normalize("NFC", name)

    def get_available_name(self, name, max_length=None):
        """Return the filename, overwriting any existing data file.

        Args:
            name: Desired filename.
            max_length: Unused; kept for API compatibility.

        Returns:
            str: The unchanged filename.
        """
        if self.exists(name):
            logger.info(f"Data file {name} already exists, will be overwritten")
            os.remove(os.path.join(self.location, name))
        return name

    def _save(self, name, content):
        """Save a data file, creating directories as needed.

        Args:
            name: Relative path for the data file.
            content: File content (``File`` instance).

        Returns:
            str: The name of the saved file.
        """
        full_path = self.path(name)
        directory = os.path.dirname(full_path)

        if not os.path.exists(directory):
            try:
                os.makedirs(directory, exist_ok=True)
                logger.info(f"Created data file directory: {directory}")
            except OSError as e:
                logger.error(f"Error creating data file directory {directory}: {e}")
                raise

        result = super()._save(name, content)

        if os.path.exists(full_path):
            file_size = os.path.getsize(full_path)
            logger.info(f"Saved data file: {name} ({file_size} bytes)")
        else:
            logger.error(f"Data file not saved to expected location: {full_path}")

        return result

    def delete(self, name):
        """Delete a data file from the storage system.

        Args:
            name: Relative path of the file to delete.
        """
        try:
            super().delete(name)
            logger.info(f"Deleted data file: {name}")
        except Exception as e:
            logger.error(f"Error deleting data file {name}: {e}")
            raise
