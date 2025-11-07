"""
Validators for API models.
"""

import re
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _


# OS-specific reserved names
WINDOWS_RESERVED_NAMES = {
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
}

UNIX_RESERVED_NAMES = {
    ".", "..",
}

# Combined reserved names from all operating systems
ALL_RESERVED_NAMES = WINDOWS_RESERVED_NAMES | UNIX_RESERVED_NAMES

# Invalid characters for filenames/paths across different operating systems
# Windows: < > : " | ? * and control characters (0-31)
# Unix/Linux: null character (\0)
# We'll be strict and block Windows invalid chars on all platforms
INVALID_PATH_CHARS = r'[<>:"|?*\x00-\x1f]'


def validate_folder_path(path: str, field_name: str = "folder path") -> None:
    """
    Validate a single folder path string.

    Checks for:
    - OS-specific reserved names
    - Path traversal attempts
    - Invalid characters
    - Leading/trailing spaces or dots
    - Absolute paths

    Args:
        path: The folder path to validate
        field_name: Name of the field for error messages

    Raises:
        ValidationError: If the path is invalid
    """
    if not isinstance(path, str):
        raise ValidationError(
            _("%(field)s must be a string, got %(type)s"),
            params={"field": field_name, "type": type(path).__name__},
        )

    if not path or not path.strip():
        raise ValidationError(
            _("%(field)s cannot be empty"),
            params={"field": field_name},
        )

    # Check for absolute paths
    if path.startswith("/") or (len(path) > 1 and path[1] == ":"):
        raise ValidationError(
            _("%(field)s cannot be an absolute path: %(path)s"),
            params={"field": field_name, "path": path},
        )

    # Split path into segments and validate each
    segments = path.split("/")

    for segment in segments:
        if not segment:
            # Empty segment (e.g., from "folder//subfolder")
            raise ValidationError(
                _("%(field)s contains empty segments: %(path)s"),
                params={"field": field_name, "path": path},
            )

        # Check for reserved names first (case-insensitive) - important to check before other validations
        segment_upper = segment.upper()

        # Check exact match for reserved names (. and .. from Unix, and Windows reserved names)
        if segment_upper in ALL_RESERVED_NAMES:
            raise ValidationError(
                _("%(field)s segment '%(segment)s' is a reserved system name and cannot be used"),
                params={"field": field_name, "segment": segment},
            )

        # Check for Windows reserved names with extensions (e.g., "CON.txt")
        base_name = segment_upper.split(".")[0]
        if base_name in WINDOWS_RESERVED_NAMES:
            raise ValidationError(
                _(
                    "%(field)s segment '%(segment)s' starts with reserved system name '%(reserved)s' "
                    "and cannot be used"
                ),
                params={"field": field_name, "segment": segment, "reserved": base_name},
            )

        # Check for leading/trailing spaces
        if segment != segment.strip():
            raise ValidationError(
                _("%(field)s segment '%(segment)s' has leading or trailing spaces"),
                params={"field": field_name, "segment": segment},
            )

        # Check for trailing dots (but only after we've checked for reserved names)
        if segment.endswith("."):
            raise ValidationError(
                _("%(field)s segment '%(segment)s' ends with a dot, which is not allowed"),
                params={"field": field_name, "segment": segment},
            )

        # Check for invalid characters
        if re.search(INVALID_PATH_CHARS, segment):
            invalid_chars = "".join(set(re.findall(INVALID_PATH_CHARS, segment)))
            raise ValidationError(
                _("%(field)s segment '%(segment)s' contains invalid characters: %(chars)s"),
                params={"field": field_name, "segment": segment, "chars": repr(invalid_chars)},
            )


def validate_storage_preferences_structure(value: dict) -> None:
    """
    Validate the entire folder_structure JSON field.

    Expected structure:
    {
        "feature_type": {
            "category": "folder/path",
            "default": "folder/path"
        }
    }

    Args:
        value: The JSON dictionary to validate

    Raises:
        ValidationError: If the structure or any path is invalid
    """
    if not isinstance(value, dict):
        raise ValidationError(
            _("Storage preferences must be a dictionary/object, got %(type)s"),
            params={"type": type(value).__name__},
        )

    # Validate each feature type and its categories
    for feature_type, categories in value.items():
        if not isinstance(feature_type, str):
            raise ValidationError(
                _("Feature type keys must be strings, got %(type)s for key %(key)s"),
                params={"type": type(feature_type).__name__, "key": repr(feature_type)},
            )

        if not isinstance(categories, dict):
            raise ValidationError(
                _("Feature type '%(feature)s' must map to a dictionary, got %(type)s"),
                params={"feature": feature_type, "type": type(categories).__name__},
            )

        # Validate each category path
        for category, folder_path in categories.items():
            if not isinstance(category, str):
                raise ValidationError(
                    _(
                        "Category keys must be strings in feature type '%(feature)s', "
                        "got %(type)s for key %(key)s"
                    ),
                    params={
                        "feature": feature_type,
                        "type": type(category).__name__,
                        "key": repr(category),
                    },
                )

            # Validate the folder path
            field_name = f"{feature_type}.{category}"
            try:
                validate_folder_path(folder_path, field_name=field_name)
            except ValidationError:
                # Re-raise the original error - it already has the field_name context
                raise
