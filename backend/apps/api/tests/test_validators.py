"""
Tests for validators in the API app.
"""

import pytest
from django.core.exceptions import ValidationError

from apps.api.validators import (
    validate_folder_path,
    validate_storage_preferences_structure,
)


class TestValidateFolderPath:
    """Tests for the validate_folder_path function."""

    def test_valid_simple_path(self):
        """Test that a simple valid path passes validation."""
        validate_folder_path("folders")
        validate_folder_path("documents")
        validate_folder_path("photos")

    def test_valid_nested_path(self):
        """Test that valid nested paths pass validation."""
        validate_folder_path("folders/subfolder")
        validate_folder_path("nodes/photos")
        validate_folder_path("trenches/documents")

    def test_valid_deep_nested_path(self):
        """Test that deeply nested paths pass validation."""
        validate_folder_path("level1/level2/level3")
        validate_folder_path("project/nodes/2024/photos")

    def test_valid_german_names(self):
        """Test that German folder names pass validation."""
        validate_folder_path("netzknoten")
        validate_folder_path("netzknoten/fotos")
        validate_folder_path("gräben/dokumente")

    def test_empty_path_rejected(self):
        """Test that empty paths are rejected."""
        with pytest.raises(ValidationError, match="cannot be empty"):
            validate_folder_path("")

        with pytest.raises(ValidationError, match="cannot be empty"):
            validate_folder_path("   ")

    def test_windows_reserved_names_rejected(self):
        """Test that Windows reserved names are rejected."""
        reserved_names = [
            "CON", "PRN", "AUX", "NUL",
            "COM1", "COM2", "COM9",
            "LPT1", "LPT5", "LPT9"
        ]

        for name in reserved_names:
            with pytest.raises(ValidationError, match="reserved system name"):
                validate_folder_path(name)

            # Test case-insensitive
            with pytest.raises(ValidationError, match="reserved system name"):
                validate_folder_path(name.lower())

            # Test with extension
            with pytest.raises(ValidationError, match="reserved system name"):
                validate_folder_path(f"{name}.txt")

            # Test in nested path
            with pytest.raises(ValidationError, match="reserved system name"):
                validate_folder_path(f"folders/{name}/subdir")

    def test_unix_reserved_names_rejected(self):
        """Test that Unix reserved names are rejected."""
        with pytest.raises(ValidationError, match="reserved system name"):
            validate_folder_path(".")

        with pytest.raises(ValidationError, match="reserved system name"):
            validate_folder_path("..")

        with pytest.raises(ValidationError, match="reserved system name"):
            validate_folder_path("folders/../etc")

    def test_path_traversal_rejected(self):
        """Test that path traversal attempts are rejected."""
        with pytest.raises(ValidationError, match="reserved system name"):
            validate_folder_path("..")

        with pytest.raises(ValidationError, match="reserved system name"):
            validate_folder_path("../../../etc/passwd")

        with pytest.raises(ValidationError, match="reserved system name"):
            validate_folder_path("folders/../../etc")

    def test_absolute_paths_rejected(self):
        """Test that absolute paths are rejected."""
        with pytest.raises(ValidationError, match="cannot be an absolute path"):
            validate_folder_path("/etc/passwd")

        with pytest.raises(ValidationError, match="cannot be an absolute path"):
            validate_folder_path("/tmp")

        # Windows absolute paths
        with pytest.raises(ValidationError, match="cannot be an absolute path"):
            validate_folder_path("C:/Windows")

        with pytest.raises(ValidationError, match="cannot be an absolute path"):
            validate_folder_path("D:/Data")

    def test_invalid_characters_rejected(self):
        """Test that paths with invalid characters are rejected."""
        invalid_chars = ['<', '>', ':', '"', '|', '?', '*']

        for char in invalid_chars:
            with pytest.raises(ValidationError, match="invalid characters"):
                validate_folder_path(f"folder{char}name")

            with pytest.raises(ValidationError, match="invalid characters"):
                validate_folder_path(f"folders/{char}subdir")

    def test_control_characters_rejected(self):
        """Test that control characters are rejected."""
        with pytest.raises(ValidationError, match="invalid characters"):
            validate_folder_path("folder\x00name")

        with pytest.raises(ValidationError, match="invalid characters"):
            validate_folder_path("folder\x1fname")

    def test_trailing_dots_rejected(self):
        """Test that segments ending with dots are rejected."""
        with pytest.raises(ValidationError, match="ends with a dot"):
            validate_folder_path("folder.")

        with pytest.raises(ValidationError, match="ends with a dot"):
            validate_folder_path("folders/subdir.")

    def test_leading_trailing_spaces_rejected(self):
        """Test that segments with leading/trailing spaces are rejected."""
        with pytest.raises(ValidationError, match="leading or trailing spaces"):
            validate_folder_path(" folder")

        with pytest.raises(ValidationError, match="leading or trailing spaces"):
            validate_folder_path("folder ")

        with pytest.raises(ValidationError, match="leading or trailing spaces"):
            validate_folder_path("folders/ subdir")

    def test_empty_segments_rejected(self):
        """Test that paths with empty segments are rejected."""
        with pytest.raises(ValidationError, match="empty segments"):
            validate_folder_path("folder//subfolder")

        with pytest.raises(ValidationError, match="empty segments"):
            validate_folder_path("folders///subdir")

    def test_non_string_rejected(self):
        """Test that non-string values are rejected."""
        with pytest.raises(ValidationError, match="must be a string"):
            validate_folder_path(123)

        with pytest.raises(ValidationError, match="must be a string"):
            validate_folder_path(["folder"])

        with pytest.raises(ValidationError, match="must be a string"):
            validate_folder_path(None)


class TestValidateStoragePreferencesStructure:
    """Tests for the validate_storage_preferences_structure function."""

    def test_valid_structure(self):
        """Test that a valid structure passes validation."""
        valid_structure = {
            "node": {
                "default": "nodes",
                "photos": "nodes/photos",
                "documents": "nodes/documents",
            },
            "trench": {
                "default": "trenches",
                "photos": "trenches/photos",
            },
        }
        validate_storage_preferences_structure(valid_structure)

    def test_valid_german_structure(self):
        """Test that German folder names pass validation."""
        valid_structure = {
            "node": {
                "default": "netzknoten",
                "photos": "netzknoten/fotos",
            },
            "trench": {
                "default": "gräben",
                "documents": "gräben/dokumente",
            },
        }
        validate_storage_preferences_structure(valid_structure)

    def test_empty_structure_valid(self):
        """Test that an empty structure is valid."""
        validate_storage_preferences_structure({})

    def test_non_dict_rejected(self):
        """Test that non-dictionary values are rejected."""
        with pytest.raises(ValidationError, match="must be a dictionary"):
            validate_storage_preferences_structure([])

        with pytest.raises(ValidationError, match="must be a dictionary"):
            validate_storage_preferences_structure("string")

        with pytest.raises(ValidationError, match="must be a dictionary"):
            validate_storage_preferences_structure(123)

    def test_non_string_feature_type_rejected(self):
        """Test that non-string feature type keys are rejected."""
        with pytest.raises(ValidationError, match="Feature type keys must be strings"):
            validate_storage_preferences_structure({
                123: {"default": "folders"}
            })

    def test_non_dict_categories_rejected(self):
        """Test that non-dictionary category values are rejected."""
        with pytest.raises(ValidationError, match="must map to a dictionary"):
            validate_storage_preferences_structure({
                "node": "folders"
            })

        with pytest.raises(ValidationError, match="must map to a dictionary"):
            validate_storage_preferences_structure({
                "node": ["folders"]
            })

    def test_non_string_category_key_rejected(self):
        """Test that non-string category keys are rejected."""
        with pytest.raises(ValidationError, match="Category keys must be strings"):
            validate_storage_preferences_structure({
                "node": {
                    123: "folders"
                }
            })

    def test_invalid_path_in_structure_rejected(self):
        """Test that invalid paths in the structure are rejected."""
        # Reserved name
        with pytest.raises(ValidationError, match="reserved system name"):
            validate_storage_preferences_structure({
                "node": {
                    "default": "CON"
                }
            })

        # Path traversal
        with pytest.raises(ValidationError, match="reserved system name"):
            validate_storage_preferences_structure({
                "node": {
                    "default": "../etc"
                }
            })

        # Absolute path
        with pytest.raises(ValidationError, match="cannot be an absolute path"):
            validate_storage_preferences_structure({
                "node": {
                    "default": "/tmp"
                }
            })

        # Invalid characters
        with pytest.raises(ValidationError, match="invalid characters"):
            validate_storage_preferences_structure({
                "node": {
                    "default": "folder<name>"
                }
            })

    def test_complex_valid_structure(self):
        """Test a complex but valid structure."""
        complex_structure = {
            "node": {
                "default": "nodes",
                "photos": "nodes/photos",
                "documents": "nodes/documents",
                "package": "nodes/packages",
            },
            "trench": {
                "default": "trenches",
                "photos": "trenches/photos",
                "drawings": "trenches/technical/drawings",
            },
            "address": {
                "default": "addresses",
            },
            "featurefiles": {
                "default": "attachments",
            },
            "residentialunit": {
                "default": "residential_units",
            },
        }
        validate_storage_preferences_structure(complex_structure)


class TestStoragePreferencesModelValidation:
    """Tests for StoragePreferences model validation."""

    def test_model_clean_with_valid_structure(self):
        """Test that model.clean() passes with valid structure."""
        from apps.api.models import StoragePreferences

        prefs = StoragePreferences(
            mode="AUTO",
            folder_structure={
                "node": {
                    "default": "nodes",
                    "photos": "nodes/photos",
                }
            }
        )
        prefs.clean()  # Should not raise

    def test_model_clean_with_invalid_structure(self):
        """Test that model.clean() raises with invalid structure."""
        from apps.api.models import StoragePreferences

        prefs = StoragePreferences(
            mode="AUTO",
            folder_structure={
                "node": {
                    "default": "CON"  # Reserved name
                }
            }
        )
        with pytest.raises(ValidationError):
            prefs.clean()

    def test_model_clean_with_path_traversal(self):
        """Test that model.clean() raises with path traversal attempt."""
        from apps.api.models import StoragePreferences

        prefs = StoragePreferences(
            mode="AUTO",
            folder_structure={
                "node": {
                    "default": "../../../etc/passwd"
                }
            }
        )
        with pytest.raises(ValidationError):
            prefs.clean()
