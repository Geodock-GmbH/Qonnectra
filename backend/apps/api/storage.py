import base64
import logging
import os
from urllib.parse import urljoin, urlparse

import requests
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import Storage
from django.utils.deconstruct import deconstructible
from django.core.exceptions import ImproperlyConfigured

logger = logging.getLogger(__name__)


@deconstructible
class NextcloudStorage(Storage):
    """
    Custom storage class for storing files in Nextcloud
    """

    # ASK: Should the files not be in the public folder and not in a user specific folder?
    def __init__(self):
        # Get settings from Django settings or environment variables
        self.nextcloud_url = getattr(settings, "NEXTCLOUD_URL", "http://krit_nextcloud")
        self.nextcloud_public_url = getattr(
            settings, "NEXTCLOUD_PUBLIC_URL", "http://localhost:8080"
        )
        self.nextcloud_username = getattr(settings, "NEXTCLOUD_USERNAME", "admin")
        self.nextcloud_password = getattr(settings, "NEXTCLOUD_PASSWORD", "admin")
        self.base_path = getattr(settings, "NEXTCLOUD_BASE_PATH", "/krit_gis_files")
        self.verify_setting = getattr(settings, "NEXTCLOUD_VERIFY_SSL", True)

        # Validate internal URL
        if not self.nextcloud_url:
            raise ImproperlyConfigured("NEXTCLOUD_URL setting is missing or empty.")
        parsed_internal_url = urlparse(self.nextcloud_url)
        if not parsed_internal_url.scheme:
            raise ImproperlyConfigured(
                f"NEXTCLOUD_URL setting ('{self.nextcloud_url}') is missing a scheme."
            )

        # Validate public URL
        if not self.nextcloud_public_url:
            raise ImproperlyConfigured(
                "NEXTCLOUD_PUBLIC_URL setting is missing or empty."
            )
        parsed_public_url = urlparse(self.nextcloud_public_url)
        if not parsed_public_url.scheme:
            raise ImproperlyConfigured(
                f"NEXTCLOUD_PUBLIC_URL setting ('{self.nextcloud_public_url}') is missing a scheme."
            )

        if self.nextcloud_username is None:
            raise ImproperlyConfigured("NEXTCLOUD_USERNAME setting is not configured.")

    def _get_headers(self):
        """Return headers with basic auth for Nextcloud API requests"""
        credentials = f"{self.nextcloud_username}:{self.nextcloud_password}"
        auth = base64.b64encode(credentials.encode()).decode()
        return {
            "Authorization": f"Basic {auth}",
            "OCS-APIRequest": "true",
            "Content-Type": "application/octet-stream",
        }

    def create_base_directory(self):
        """Create the base directory if it doesn't exist"""
        try:
            # Check if base directory exists
            response = requests.head(
                urljoin(
                    self.nextcloud_url,
                    f"remote.php/dav/files/{self.nextcloud_username}{self.base_path}",
                ),
                headers=self._get_headers(),
                verify=self.verify_setting,
            )

            # If directory doesn't exist (404), create it
            if response.status_code == 404:
                create_response = requests.request(
                    "MKCOL",
                    urljoin(
                        self.nextcloud_url,
                        f"remote.php/dav/files/{self.nextcloud_username}{self.base_path}",
                    ),
                    headers=self._get_headers(),
                    verify=self.verify_setting,
                )

                if create_response.status_code == 201:
                    logger.info(f"Created base directory: {self.base_path}")
                elif create_response.status_code != 405:  # 405 means already exists
                    logger.error(
                        f"Failed to create base directory: {self.base_path}, status: {create_response.status_code}"
                    )

        except Exception as e:
            logger.error(f"Error creating base directory: {str(e)}")

    def _ensure_directories_exist(self, path):
        """
        Recursively create directories in the path if they don't exist.
        """
        # Split the path into directory components
        directory = os.path.dirname(path)
        if not directory:
            return

        # Build the directory structure one level at a time
        parts = directory.split("/")
        current_path = self.base_path  # Start with the base path

        for part in parts:
            if not part:  # Skip empty parts
                continue

            current_path = f"{current_path}/{part}"

            # Check if directory exists
            try:
                response = requests.head(
                    urljoin(
                        self.nextcloud_url,
                        f"remote.php/dav/files/{self.nextcloud_username}{current_path}",
                    ),
                    headers=self._get_headers(),
                    verify=self.verify_setting,
                )

                # If directory doesn't exist (404), create it
                if response.status_code == 404:
                    create_response = requests.request(
                        "MKCOL",
                        urljoin(
                            self.nextcloud_url,
                            f"remote.php/dav/files/{self.nextcloud_username}{current_path}",
                        ),
                        headers=self._get_headers(),
                        verify=self.verify_setting,
                    )

                    # Check if directory was created successfully
                    if create_response.status_code not in (
                        201,
                        405,
                    ):  # 201 Created, 405 Method Not Allowed (already exists)
                        logger.error(
                            f"Failed to create directory {current_path}: {create_response.status_code} {create_response.text}"
                        )
                        raise IOError(
                            f"Failed to create directory in Nextcloud: {create_response.text}"
                        )

            except Exception as e:
                # Log the error but continue trying to create the directory
                logger.error(
                    f"Error checking/creating directory {current_path}: {str(e)}"
                )

    def _save(self, name, content):
        """
        Save a new file using the Nextcloud WebDAV API
        """

        # Normalize the name to use forward slashes and remove any leading slash
        name = name.replace("\\", "/")
        name = name.lstrip("/")

        self.create_base_directory()

        # Ensure the directory structure exists
        self._ensure_directories_exist(name)

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
                verify=self.verify_setting,
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
        # Normalize the name to use forward slashes and remove any leading slash
        name = name.replace("\\", "/")
        name = name.lstrip("/")

        full_path = os.path.join(self.base_path, name)
        if not full_path.startswith("/"):
            full_path = "/" + full_path

        download_url = urljoin(
            self.nextcloud_url,
            f"remote.php/dav/files/{self.nextcloud_username}{full_path}",
        )

        response = requests.get(
            download_url,
            headers=self._get_headers(),
            verify=self.verify_setting,
        )

        if response.status_code != 200:
            raise IOError(f"Failed to retrieve file from Nextcloud: {response.text}")

        return ContentFile(response.content)

    def delete(self, name):
        """
        Delete a file from Nextcloud
        """
        # Normalize the name to use forward slashes and remove any leading slash
        name = name.replace("\\", "/")
        name = name.lstrip("/")

        full_path = os.path.join(self.base_path, name)
        if not full_path.startswith("/"):
            full_path = "/" + full_path

        delete_url = urljoin(
            self.nextcloud_url,
            f"remote.php/dav/files/{self.nextcloud_username}{full_path}",
        )

        response = requests.delete(
            delete_url,
            headers=self._get_headers(),
            verify=self.verify_setting,
        )

        if response.status_code not in [200, 204]:
            raise IOError(f"Failed to delete file from Nextcloud: {response.text}")

    def exists(self, name):
        """
        Check if a file exists in Nextcloud
        """
        # Normalize the name to use forward slashes and remove any leading slash
        name = name.replace("\\", "/")
        name = name.lstrip("/")

        full_path = os.path.join(self.base_path, name)
        if not full_path.startswith("/"):
            full_path = "/" + full_path

        check_url = urljoin(
            self.nextcloud_url,
            f"remote.php/dav/files/{self.nextcloud_username}{full_path}",
        )

        response = requests.head(
            check_url,
            headers=self._get_headers(),
            verify=self.verify_setting,
        )

        return response.status_code == 200

    def url(self, name):
        """
        Return URL for accessing the file through Nextcloud's public URL
        """
        # Normalize the name to use forward slashes and remove any leading slash
        name = name.replace("\\", "/")
        name = name.lstrip("/")

        full_path = os.path.join(self.base_path, name)
        if not full_path.startswith("/"):
            full_path = "/" + full_path

        # Use the PUBLIC url for generating links
        return urljoin(
            self.nextcloud_public_url,  # Use the public URL setting here
            f"remote.php/dav/files/{self.nextcloud_username}{full_path}",
        )
