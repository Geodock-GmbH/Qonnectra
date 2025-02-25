import base64
import logging
import os
from urllib.parse import urljoin

import requests
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import Storage
from django.utils.deconstruct import deconstructible

logger = logging.getLogger(__name__)


@deconstructible
class NextcloudStorage(Storage):
    """
    Custom storage class for storing files in Nextcloud
    """

    def __init__(self):
        # Get settings from Django settings or environment variables
        self.nextcloud_url = getattr(settings, "NEXTCLOUD_URL", "http://krit_nextcloud")
        self.nextcloud_username = getattr(settings, "NEXTCLOUD_USERNAME", "admin")
        self.nextcloud_password = getattr(settings, "NEXTCLOUD_PASSWORD", "admin")
        self.base_path = getattr(settings, "NEXTCLOUD_BASE_PATH", "/krit_gis_files")

    def _get_headers(self):
        """Return headers with basic auth for Nextcloud API requests"""
        credentials = f"{self.nextcloud_username}:{self.nextcloud_password}"
        auth = base64.b64encode(credentials.encode()).decode()
        return {
            "Authorization": f"Basic {auth}",
            "OCS-APIRequest": "true",
            "Content-Type": "application/octet-stream",
        }

    def _ensure_directory_exists(self, path):
        """Ensure the directory exists in Nextcloud by creating each level of the path"""
        if not path.startswith("/"):
            path = "/" + path

        # Split the path into components and create each level
        parts = path.split("/")
        current_path = ""

        for part in parts:
            if not part:  # Skip empty parts
                continue

            current_path += f"/{part}"
            dir_url = urljoin(
                self.nextcloud_url,
                f"remote.php/dav/files/{self.nextcloud_username}{current_path}",
            )

            # Check if directory exists
            response = requests.head(
                dir_url,
                headers=self._get_headers(),
                verify=False,
            )

            if response.status_code == 404:
                # Create directory
                response = requests.request(
                    "MKCOL",
                    dir_url,
                    headers=self._get_headers(),
                    verify=False,
                )

                # 201: Created successfully
                # 405: Directory already exists
                # 409: Parent directory doesn't exist (should be handled by our recursive approach)
                if response.status_code not in [201, 405, 409]:
                    logger.error(
                        f"Failed to create directory {current_path}: {response.text}"
                    )
                    raise IOError(
                        f"Failed to create directory in Nextcloud: {response.text}"
                    )

    def _save(self, name, content):
        """
        Save a new file using the Nextcloud WebDAV API
        """
        # Normalize the name to use forward slashes and remove any leading slash
        name = name.replace("\\", "/")
        name = name.lstrip("/")

        # Ensure the directory structure exists
        directory = os.path.dirname(name)
        if directory:
            full_directory = os.path.join(self.base_path, directory)
            self._ensure_directory_exists(full_directory)

        # Prepare the full path for the file
        full_path = os.path.join(self.base_path, name)
        if not full_path.startswith("/"):
            full_path = "/" + full_path

        upload_url = urljoin(
            self.nextcloud_url,
            f"remote.php/dav/files/{self.nextcloud_username}{full_path}",
        )

        try:
            response = requests.put(
                upload_url,
                data=content.read(),
                headers=self._get_headers(),
                verify=False,
            )

            if response.status_code not in [200, 201, 204]:
                logger.error(f"Failed to save file: {response.text}")
                raise IOError(f"Failed to save file to Nextcloud: {response.text}")

            return name

        except requests.exceptions.RequestException as e:
            logger.error(f"Network error while saving file: {str(e)}")
            raise IOError(f"Network error while saving file to Nextcloud: {str(e)}")

    def _open(self, name, mode="rb"):
        """
        Retrieve a file from Nextcloud
        """
        full_path = os.path.join(self.base_path, name)
        download_url = urljoin(
            self.nextcloud_url,
            f"remote.php/dav/files/{self.nextcloud_username}/{full_path}",
        )

        response = requests.get(
            download_url,
            headers=self._get_headers(),
            verify=False,  # For development only, remove in production
        )

        if response.status_code != 200:
            raise IOError(f"Failed to retrieve file from Nextcloud: {response.text}")

        return ContentFile(response.content)

    def delete(self, name):
        """
        Delete a file from Nextcloud
        """
        full_path = os.path.join(self.base_path, name)
        delete_url = urljoin(
            self.nextcloud_url,
            f"remote.php/dav/files/{self.nextcloud_username}/{full_path}",
        )

        response = requests.delete(
            delete_url,
            headers=self._get_headers(),
            verify=False,  # For development only, remove in production
        )

        if response.status_code not in [200, 204]:
            raise IOError(f"Failed to delete file from Nextcloud: {response.text}")

    def exists(self, name):
        """
        Check if a file exists in Nextcloud
        """
        full_path = os.path.join(self.base_path, name)
        check_url = urljoin(
            self.nextcloud_url,
            f"remote.php/dav/files/{self.nextcloud_username}/{full_path}",
        )

        response = requests.head(
            check_url,
            headers=self._get_headers(),
            verify=False,  # For development only, remove in production
        )

        return response.status_code == 200

    def url(self, name):
        """
        Return URL for accessing the file through Nextcloud's public URL
        """
        return urljoin(
            self.nextcloud_url,
            f"remote.php/dav/files/{self.nextcloud_username}/{self.base_path}/{name}",
        )
