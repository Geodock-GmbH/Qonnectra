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
