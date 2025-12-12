import logging

import openpyxl
from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.http import HttpResponse
from django.utils.translation import gettext_lazy as _
from openpyxl import load_workbook
from pathvalidate import sanitize_filename

from .models import (
    AttributesCompany,
    AttributesConduitType,
    AttributesNetworkLevel,
    AttributesStatus,
    Conduit,
    FeatureFiles,
    Flags,
    Projects,
    StoragePreferences,
)
from .storage import LocalMediaStorage

logger = logging.getLogger(__name__)


def import_conduits_from_excel(file, max_file_size=10 * 1024 * 1024):
    """
    Imports conduits from an Excel file, validates data, and creates new records.

    Args:
        file: The uploaded Excel file object
        max_file_size: Maximum allowed file size in bytes (default 10MB)

    Returns:
        dict: Contains 'success' boolean and either 'created_count' or 'errors' list
    """
    # File size validation
    file.seek(0, 2)  # Seek to end
    file_size = file.tell()
    file.seek(0)  # Seek back to start

    if file_size > max_file_size:
        return {
            "success": False,
            "errors": [
                str(
                    _("File too large. Maximum size is %(size)dMB.")
                    % {"size": max_file_size // (1024 * 1024)}
                )
            ],
        }

    try:
        workbook = load_workbook(file)
    except Exception as e:
        logger.error(f"Failed to load Excel workbook: {e}")
        return {
            "success": False,
            "errors": [str(_("Invalid Excel file. Could not read workbook."))],
        }

    sheet = workbook.active

    errors = []
    warnings = []
    conduits_to_create = []

    # Get translated headers to match the file
    headers_translated = [
        str(h)
        for h in [
            _("Name"),
            _("Type"),
            _("Outer Conduit"),
            _("Status"),
            _("Network Level"),
            _("Owner"),
            _("Constructor"),
            _("Manufacturer"),
            _("Date"),
            _("Project"),
            _("Flag"),
        ]
    ]

    header_from_file = [cell.value for cell in sheet[1]]

    # Validate headers exist
    if not header_from_file or all(h is None for h in header_from_file):
        return {
            "success": False,
            "errors": [str(_("No headers found in Excel file. First row must contain column headers."))],
        }

    # Map file headers to a more usable format
    header_map = {
        headers_translated[0]: "name",
        headers_translated[1]: "conduit_type",
        headers_translated[2]: "outer_conduit",
        headers_translated[3]: "status",
        headers_translated[4]: "network_level",
        headers_translated[5]: "owner",
        headers_translated[6]: "constructor",
        headers_translated[7]: "manufacturer",
        headers_translated[8]: "date",
        headers_translated[9]: "project",
        headers_translated[10]: "flag",
    }

    # Check for required 'Name' header
    if headers_translated[0] not in header_from_file:
        return {
            "success": False,
            "errors": [
                str(
                    _("Required 'Name' column not found. Expected header: '%(header)s'")
                    % {"header": headers_translated[0]}
                )
            ],
        }

    # Check for unrecognized columns (warning, not error)
    unmapped_headers = [h for h in header_from_file if h and h not in header_map]
    if unmapped_headers:
        warnings.append(
            str(
                _("Unrecognized columns will be ignored: %(columns)s")
                % {"columns": ", ".join(unmapped_headers)}
            )
        )

    mapped_header = [header_map.get(h) for h in header_from_file]

    for row_idx, row in enumerate(
        sheet.iter_rows(min_row=2, values_only=True), start=2
    ):
        row_data = dict(zip(mapped_header, row))

        name = row_data.get("name")
        if not name:
            errors.append(_("Row %(row)d: Name is required.") % {"row": row_idx})
            continue

        if Conduit.objects.filter(name=name).exists():
            errors.append(
                _("Row %(row)d: Conduit with name '%(name)s' already exists.")
                % {"row": row_idx, "name": name}
            )
            continue

        try:
            project_val = row_data.get("project")
            project = Projects.objects.get(project=project_val) if project_val else None

            flag_val = row_data.get("flag")
            flag = Flags.objects.get(flag=flag_val) if flag_val else None

            conduit_type_val = row_data.get("conduit_type")
            conduit_type = (
                AttributesConduitType.objects.get(conduit_type=conduit_type_val)
                if conduit_type_val
                else None
            )

            status_val = row_data.get("status")
            status = (
                AttributesStatus.objects.get(status=status_val) if status_val else None
            )

            network_level_val = row_data.get("network_level")
            network_level = (
                AttributesNetworkLevel.objects.get(network_level=network_level_val)
                if network_level_val
                else None
            )

            # Handle company lookups individually for better error reporting
            owner_val = row_data.get("owner")
            owner = None
            if owner_val:
                try:
                    owner = AttributesCompany.objects.get(company=owner_val)
                except AttributesCompany.DoesNotExist:
                    errors.append(
                        f'Row {row_idx}: Owner company "{owner_val}" not found.'
                    )
                    continue

            constructor_val = row_data.get("constructor")
            constructor = None
            if constructor_val:
                try:
                    constructor = AttributesCompany.objects.get(company=constructor_val)
                except AttributesCompany.DoesNotExist:
                    errors.append(
                        f'Row {row_idx}: Constructor company "{constructor_val}" not found.'
                    )
                    continue

            manufacturer_val = row_data.get("manufacturer")
            manufacturer = None
            if manufacturer_val:
                try:
                    manufacturer = AttributesCompany.objects.get(
                        company=manufacturer_val
                    )
                except AttributesCompany.DoesNotExist:
                    errors.append(
                        f'Row {row_idx}: Manufacturer company "{manufacturer_val}" not found.'
                    )
                    continue

            conduit = Conduit(
                name=name,
                conduit_type=conduit_type,
                outer_conduit=row_data.get("outer_conduit"),
                status=status,
                network_level=network_level,
                owner=owner,
                constructor=constructor,
                manufacturer=manufacturer,
                date=row_data.get("date"),
                project=project,
                flag=flag,
            )
            conduits_to_create.append(conduit)

        except Projects.DoesNotExist:
            errors.append(f'Row {row_idx}: Project "{project_val}" not found.')
        except Flags.DoesNotExist:
            errors.append(f'Row {row_idx}: Flag "{flag_val}" not found.')
        except AttributesConduitType.DoesNotExist:
            errors.append(
                f'Row {row_idx}: Conduit Type "{conduit_type_val}" not found.'
            )
        except AttributesStatus.DoesNotExist:
            errors.append(f'Row {row_idx}: Status "{status_val}" not found.')
        except AttributesNetworkLevel.DoesNotExist:
            errors.append(
                f'Row {row_idx}: Network Level "{network_level_val}" not found.'
            )

        except Exception as e:
            errors.append(f"Row {row_idx}: An unexpected error occurred: {e}")

    if errors:
        return {"success": False, "errors": errors, "warnings": warnings}

    try:
        with transaction.atomic():
            Conduit.objects.bulk_create(conduits_to_create)
    except Exception as e:
        logger.error(f"Failed to bulk create conduits: {e}")
        return {"success": False, "errors": [str(_("Failed to save to database: %(error)s") % {"error": str(e)})]}

    result = {"success": True, "created_count": len(conduits_to_create)}
    if warnings:
        result["warnings"] = warnings
    return result


def generate_conduit_import_template():
    """
    Creates a basic Excel workbook and returns it as an HTTP response.
    """
    # Create a workbook and select the active worksheet
    workbook = openpyxl.Workbook()
    worksheet = workbook.active
    worksheet.title = "Conduit Import Template"

    headers = [
        str(h)
        for h in [
            _("Name"),
            _("Type"),
            _("Outer Conduit"),
            _("Status"),
            _("Network Level"),
            _("Owner"),
            _("Constructor"),
            _("Manufacturer"),
            _("Date"),
            _("Project"),
            _("Flag"),
        ]
    ]
    for col, header in enumerate(headers, start=1):
        worksheet.cell(row=1, column=col, value=header)

    # Add one example at row 2
    example_row = [
        "RV1.1.1",
        "12x10/6",
        "",
        "geplant",
        "Hausanschluss-Ebene",
        "Geodock",
        "Geodock",
        "Geodock",
        "2025-01-01",
        "Default",
        "Default",
    ]

    for col, value in enumerate(example_row, start=1):
        worksheet.cell(row=2, column=col, value=value)

    # Prepare the response for Excel format
    response = HttpResponse(
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    response["Content-Disposition"] = (
        'attachment; filename="conduit_import_template.xlsx"'
    )

    # Save the workbook to the response
    workbook.save(response)

    return response


def rename_feature_folder(instance, old_identifier, new_identifier):
    """
    Rename storage folder when a feature's identifier changes.

    Updates both the filesystem folder and all FeatureFiles.file_path entries
    in the database within an atomic transaction.

    Args:
        instance: Model instance (Node, Cable, Conduit, Trench, or Address)
        old_identifier: Previous identifier value (name, id_trench, or address string)
        new_identifier: New identifier value

    Raises:
        OSError: If folder rename fails (rolls back the entire operation)
    """
    prefs = StoragePreferences.objects.first()
    model_name = instance._meta.model_name

    project_name = (
        instance.project.project
        if hasattr(instance, "project") and instance.project
        else "default"
    )
    project_name = sanitize_filename(project_name)

    old_feature_folder = sanitize_filename(str(old_identifier))
    new_feature_folder = sanitize_filename(str(new_identifier))

    if prefs and prefs.folder_structure:
        folder_config = prefs.folder_structure.get(model_name, {})
        if isinstance(folder_config, dict):
            for category, path in folder_config.items():
                if "/" in path:
                    base_folder = path.split("/", 1)[0]
                    break
                else:
                    base_folder = path
                    break
            else:
                base_folder = f"{model_name}s"
        else:
            base_folder = folder_config if folder_config else f"{model_name}s"
    else:
        base_folder = f"{model_name}s"

    old_path = f"{project_name}/{base_folder}/{old_feature_folder}"
    new_path = f"{project_name}/{base_folder}/{new_feature_folder}"

    storage = LocalMediaStorage()
    content_type = ContentType.objects.get_for_model(instance)

    with transaction.atomic():
        folder_existed = storage.rename_folder(old_path, new_path)

        if folder_existed:
            files = FeatureFiles.objects.select_for_update().filter(
                content_type=content_type, object_id=instance.pk
            )
            updated_count = 0
            for f in files:
                old_file_path = f.file_path.name
                if old_path in old_file_path:
                    f.file_path.name = old_file_path.replace(old_path, new_path, 1)
                    f.save(update_fields=["file_path"])
                    updated_count += 1

            logger.info(
                f"Renamed feature folder for {model_name} "
                f"'{old_identifier}' -> '{new_identifier}', "
                f"updated {updated_count} file path(s)"
            )
        else:
            logger.debug(
                f"No folder to rename for {model_name} "
                f"'{old_identifier}' (no files uploaded yet)"
            )


def move_file_to_feature(file_obj, target_feature, target_content_type):
    """
    Move a FeatureFile to a different feature, updating both the database
    and the physical file location.

    Args:
        file_obj: FeatureFiles instance to move
        target_feature: Target model instance (Node, Cable, Conduit, Trench, or Address)
        target_content_type: ContentType for the target model

    Returns:
        tuple: (success: bool, new_path: str or None, error: str or None)
    """
    storage = LocalMediaStorage()
    old_path = file_obj.file_path.name

    prefs = StoragePreferences.objects.first()
    model_name = target_content_type.model

    if model_name == "trench":
        feature_id = target_feature.id_trench
    elif model_name in ("conduit", "cable", "node"):
        feature_id = target_feature.name
    elif model_name == "address":
        suffix = (
            f" {target_feature.house_number_suffix}"
            if target_feature.house_number_suffix
            else ""
        )
        feature_id = (
            f"{target_feature.street} {target_feature.housenumber}{suffix}, "
            f"{target_feature.zip_code} {target_feature.city}"
        )
    else:
        feature_id = str(target_feature.pk)

    feature_id = sanitize_filename(str(feature_id))

    project_name = (
        target_feature.project.project
        if hasattr(target_feature, "project") and target_feature.project
        else "default"
    )
    project_name = sanitize_filename(project_name)

    file_extension = file_obj.file_type or ""
    file_extension = file_extension.lower()

    try:
        from .models import FileTypeCategory

        category_obj = FileTypeCategory.objects.get(extension=file_extension)
        file_category = category_obj.category
    except FileTypeCategory.DoesNotExist:
        file_category = "documents"

    if prefs and prefs.mode == "AUTO" and prefs.folder_structure:
        folder_paths = prefs.folder_structure.get(model_name, {})
        folder_name = folder_paths.get(
            file_category, folder_paths.get("default", model_name + "s")
        )

        if "/" in folder_name:
            base_folder, sub_folder = folder_name.split("/", 1)
            new_path = (
                f"{project_name}/{base_folder}/{feature_id}/{sub_folder}/"
                f"{file_obj.file_name}.{file_obj.file_type}"
            )
        else:
            new_path = (
                f"{project_name}/{folder_name}/{feature_id}/"
                f"{file_obj.file_name}.{file_obj.file_type}"
            )
    else:
        new_path = (
            f"{project_name}/{model_name}s/{feature_id}/"
            f"{file_obj.file_name}.{file_obj.file_type}"
        )

    if storage.exists(new_path):
        return (False, None, f"File already exists at target path: {new_path}")

    try:
        if storage.exists(old_path):
            old_file = storage.open(old_path, "rb")
            content = old_file.read()
            old_file.close()

            from django.core.files.base import ContentFile

            storage.save(new_path, ContentFile(content))

            storage.delete(old_path)

            logger.info(f"Moved file from {old_path} to {new_path}")
        else:
            logger.warning(
                f"Physical file not found at {old_path}, updating database path only"
            )
    except Exception as e:
        logger.error(f"Error moving file from {old_path} to {new_path}: {e}")
        return (False, None, str(e))

    return (True, new_path, None)
