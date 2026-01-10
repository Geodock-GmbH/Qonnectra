import os

from django import forms
from django.contrib import admin, messages
from django.contrib.contenttypes.models import ContentType
from django.db import models, transaction
from django.shortcuts import redirect, render
from django.urls import path, reverse
from django.utils.html import format_html
from django.utils.translation import gettext_lazy as _
from django_json_widget.widgets import JSONEditorWidget

from .models import (
    Address,
    Area,
    AttributesAreaType,
    AttributesCableType,
    AttributesCompany,
    AttributesConduitType,
    AttributesConstructionType,
    AttributesFiberColor,
    AttributesFiberStatus,
    AttributesMicroductColor,
    AttributesMicroductStatus,
    AttributesNetworkLevel,
    AttributesNodeType,
    AttributesPhase,
    AttributesStatus,
    AttributesStatusDevelopment,
    AttributesSurface,
    Cable,
    CableTypeColorMapping,
    Conduit,
    ConduitTypeColorMapping,
    FeatureFiles,
    FileTypeCategory,
    Flags,
    GeoPackageSchemaConfig,
    LogEntry,
    Microduct,
    NetworkSchemaSettings,
    Node,
    Projects,
    QGISProject,
    StoragePreferences,
    Trench,
)
from .services import (
    GEOPACKAGE_LAYER_CONFIG,
    generate_geopackage_schema,
    move_file_to_feature,
)
from .storage import LocalMediaStorage


class GeoPackageSchemaConfigForm(forms.ModelForm):
    """Form for GeoPackageSchemaConfig with FilteredSelectMultiple widget."""

    selected_layers = forms.MultipleChoiceField(
        label=_("Selected Layers"),
        required=False,
        widget=admin.widgets.FilteredSelectMultiple(
            verbose_name=_("Layers"),
            is_stacked=False,
        ),
        help_text=_("Select layers to include in the GeoPackage schema download."),
    )

    class Meta:
        model = GeoPackageSchemaConfig
        fields = ["name", "selected_layers"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        choices = []
        for layer_name, config in GEOPACKAGE_LAYER_CONFIG.items():
            geom_type = config.get("geometry_type")
            label = (
                f"{layer_name} ({geom_type})" if geom_type else f"{layer_name} (Table)"
            )
            choices.append((layer_name, label))
        self.fields["selected_layers"].choices = choices

        if self.instance and self.instance.pk:
            self.fields["selected_layers"].initial = self.instance.selected_layers or []

    def clean_selected_layers(self):
        """Convert the list back to a format suitable for JSONField."""
        return list(self.cleaned_data.get("selected_layers", []))


class QGISProjectConvertForm(forms.Form):
    """Form for uploading QGS/QGZ file to convert OGR to PostgreSQL datasources."""

    qgis_file = forms.FileField(
        label=_("QGIS Project File"),
        help_text=_(
            "Upload a QGS or QGZ file to convert OGR/GeoPackage datasources to PostgreSQL."
        ),
    )

    def clean_qgis_file(self):
        uploaded_file = self.cleaned_data.get("qgis_file")
        if uploaded_file:
            filename = uploaded_file.name.lower()
            if not filename.endswith((".qgs", ".qgz")):
                raise forms.ValidationError(_("Only .qgs and .qgz files are allowed."))
        return uploaded_file


@admin.register(GeoPackageSchemaConfig)
class GeoPackageSchemaConfigAdmin(admin.ModelAdmin):
    """Admin for GeoPackage schema configuration with filter_horizontal-style UI."""

    form = GeoPackageSchemaConfigForm
    list_display = ("name", "layer_count", "layer_preview")
    actions = ["download_geopackage_schema"]
    change_list_template = "admin/api/geopackageschemaconfig/change_list.html"

    class Media:
        css = {"all": ["admin/css/widgets.css"]}
        js = ["admin/js/core.js"]

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                "convert-qgis/",
                self.admin_site.admin_view(self.convert_qgis_view),
                name="api_geopackageschemaconfig_convert",
            ),
        ]
        return custom_urls + urls

    def convert_qgis_view(self, request):
        """View to upload and convert QGIS project file."""
        from django.http import HttpResponse

        from .services import convert_qgs_to_postgres, handle_qgis_file, repackage_qgz

        if request.method == "POST":
            form = QGISProjectConvertForm(request.POST, request.FILES)
            if form.is_valid():
                uploaded_file = form.cleaned_data["qgis_file"]
                filename = uploaded_file.name

                try:
                    file_content = uploaded_file.read()

                    qgs_content, is_qgz = handle_qgis_file(file_content, filename)
                    converted_content = convert_qgs_to_postgres(qgs_content)

                    if is_qgz:
                        final_content = repackage_qgz(converted_content, file_content)
                        content_type = "application/zip"
                    else:
                        final_content = converted_content
                        content_type = "application/xml"

                    response = HttpResponse(final_content, content_type=content_type)
                    response["Content-Disposition"] = (
                        f'attachment; filename="{filename}"'
                    )
                    return response

                except Exception as e:
                    messages.error(
                        request,
                        _("Error converting file: %(error)s") % {"error": str(e)},
                    )
        else:
            form = QGISProjectConvertForm()

        context = {
            **self.admin_site.each_context(request),
            "title": _("Convert QGIS Project to PostgreSQL Datasources"),
            "form": form,
            "opts": self.model._meta,
        }
        return render(
            request, "admin/api/geopackageschemaconfig/convert_form.html", context
        )

    @admin.display(description=_("Layers"))
    def layer_count(self, obj):
        return len(obj.selected_layers) if obj.selected_layers else 0

    @admin.display(description=_("Selected Layers"))
    def layer_preview(self, obj):
        layers = (obj.selected_layers or [])[:5]
        suffix = "..." if len(obj.selected_layers or []) > 5 else ""
        return ", ".join(layers) + suffix if layers else _("None selected")

    @admin.action(
        description=_("Download GeoPackage schema for selected configuration")
    )
    def download_geopackage_schema(self, request, queryset):
        """Download GeoPackage schema with selected layers."""
        if queryset.count() != 1:
            self.message_user(
                request,
                _("Please select exactly one configuration to download."),
                level=messages.ERROR,
            )
            return

        config = queryset.first()
        layer_names = config.get_layer_names()

        if not layer_names:
            self.message_user(
                request,
                _("No layers selected. Please select at least one layer."),
                level=messages.ERROR,
            )
            return

        try:
            return generate_geopackage_schema(layers=layer_names)
        except Exception as e:
            self.message_user(
                request,
                _("Error generating GeoPackage: %(error)s") % {"error": str(e)},
                level=messages.ERROR,
            )


FEATURE_MODEL_MAP = {
    "trench": Trench,
    "conduit": Conduit,
    "cable": Cable,
    "node": Node,
    "address": Address,
    "area": Area,
}

admin.site.register(AttributesSurface)
admin.site.register(AttributesStatusDevelopment)
admin.site.register(AttributesConstructionType)
admin.site.register(AttributesStatus)
admin.site.register(AttributesPhase)
admin.site.register(AttributesCompany)
admin.site.register(AttributesAreaType)
admin.site.register(Cable)
admin.site.register(FileTypeCategory)
admin.site.register(Area)
admin.site.register(Flags)
admin.site.register(AttributesNetworkLevel)
admin.site.register(AttributesNodeType)
admin.site.register(AttributesMicroductStatus)
admin.site.register(Microduct)
admin.site.register(AttributesFiberStatus)


class NetworkSchemaSettingsInline(admin.StackedInline):
    """Inline admin for Network Schema Settings within Project admin."""

    model = NetworkSchemaSettings
    can_delete = False
    verbose_name = _("Network Schema Settings")
    verbose_name_plural = _("Network Schema Settings")
    filter_horizontal = ("excluded_node_types",)


@admin.register(Projects)
class ProjectsAdmin(admin.ModelAdmin):
    """Admin interface for Projects with Network Schema Settings."""

    list_display = ("project", "description", "active", "excluded_types_display")
    list_filter = ("active",)
    search_fields = ("project", "description")
    inlines = [NetworkSchemaSettingsInline]

    @admin.display(description=_("Excluded Node Types"))
    def excluded_types_display(self, obj):
        """Display excluded node types for list view."""
        try:
            settings = obj.network_schema_settings
            count = settings.excluded_node_types.count()
            if count > 0:
                types = settings.excluded_node_types.all()[:3]
                names = [t.node_type for t in types]
                suffix = f"... (+{count - 3})" if count > 3 else ""
                return ", ".join(names) + suffix
            return _("None")
        except NetworkSchemaSettings.DoesNotExist:
            return format_html(
                '<span style="color: #dc3545;">⚠ {}</span>',
                _("Not configured"),
            )


@admin.register(NetworkSchemaSettings)
class NetworkSchemaSettingsAdmin(admin.ModelAdmin):
    """Standalone admin for Network Schema Settings."""

    list_display = ("project", "excluded_count", "excluded_types_preview")
    list_filter = ("project",)
    search_fields = ("project__project",)
    filter_horizontal = ("excluded_node_types",)
    autocomplete_fields = ["project"]

    @admin.display(description=_("Excluded Count"))
    def excluded_count(self, obj):
        return obj.excluded_node_types.count()

    @admin.display(description=_("Excluded Types"))
    def excluded_types_preview(self, obj):
        types = obj.excluded_node_types.all()[:5]
        names = [t.node_type for t in types]
        suffix = "..." if obj.excluded_node_types.count() > 5 else ""
        return ", ".join(names) + suffix if names else _("None")


@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = (
        "street",
        "housenumber",
        "house_number_suffix",
        "zip_code",
        "city",
        "district",
        "status_development",
        "flag",
        "project",
    )
    list_filter = (
        "street",
        "housenumber",
        "house_number_suffix",
        "zip_code",
        "city",
        "district",
        "status_development",
        "flag",
        "project",
    )
    search_fields = (
        "street",
        "housenumber",
        "house_number_suffix",
        "zip_code",
        "city",
        "district",
        "status_development",
        "flag",
        "project",
    )


class ConduitTypeColorMappingInline(admin.TabularInline):
    model = ConduitTypeColorMapping
    extra = 1
    fields = ("uuid", "position", "color")
    ordering = ("position",)


class CableTypeColorMappingInline(admin.TabularInline):
    model = CableTypeColorMapping
    extra = 1
    fields = ("uuid", "position_type", "position", "color", "layer")
    ordering = ("position_type", "position")
    can_delete = True
    verbose_name = "Fiber Color Mapping"
    verbose_name_plural = "Fiber Color Mappings"


@admin.register(AttributesConduitType)
class AttributesConduitTypeAdmin(admin.ModelAdmin):
    list_display = ("conduit_type", "conduit_count", "manufacturer")
    inlines = [ConduitTypeColorMappingInline]


@admin.register(AttributesCableType)
class AttributesCableTypeAdmin(admin.ModelAdmin):
    list_display = (
        "cable_type",
        "fiber_count",
        "bundle_count",
        "bundle_fiber_count",
        "manufacturer",
    )
    inlines = [CableTypeColorMappingInline]


@admin.register(AttributesMicroductColor)
class AttributesMicroductColorAdmin(admin.ModelAdmin):
    list_display = (
        "name_de",
        "name_en",
        "hex_code",
        "hex_code_secondary",
        "is_active",
        "display_order",
    )
    list_filter = ("is_active",)
    ordering = ("display_order", "name_de")
    fields = (
        "name_de",
        "name_en",
        "hex_code",
        "hex_code_secondary",
        "display_order",
        "is_active",
        "description",
    )


@admin.register(AttributesFiberColor)
class AttributesFiberColorAdmin(admin.ModelAdmin):
    list_display = (
        "name_de",
        "name_en",
        "hex_code",
        "hex_code_secondary",
        "is_active",
        "display_order",
    )
    list_filter = ("is_active",)
    ordering = ("display_order", "name_de")
    fields = (
        "name_de",
        "name_en",
        "hex_code",
        "hex_code_secondary",
        "display_order",
        "is_active",
        "description",
    )


@admin.register(StoragePreferences)
class StoragePreferencesAdmin(admin.ModelAdmin):
    list_display = ("mode", "__str__")
    formfield_overrides = {
        models.JSONField: {"widget": JSONEditorWidget(height="600px", width="90%")},
    }


@admin.register(QGISProject)
class QGISProjectAdmin(admin.ModelAdmin):
    list_display = ("display_name", "name", "created_at", "created_by")
    list_filter = ("name", "created_at")
    search_fields = ("name", "display_name", "description")
    readonly_fields = (
        "created_at",
        "updated_at",
        "created_by",
        "get_wms_url",
        "get_wfs_url",
    )
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "name",
                    "display_name",
                    "description",
                    "project_file",
                )
            },
        ),
        (
            "Access URLs",
            {
                "fields": ("get_wms_url", "get_wfs_url"),
                "description": _(
                    "Use these URLs to access the QGIS project via WMS/WFS services"
                ),
            },
        ),
        (
            "Metadata",
            {
                "fields": ("created_at", "updated_at", "created_by"),
                "classes": ("collapse",),
            },
        ),
    )
    actions = ["download_with_postgres_datasources"]

    def save_model(self, request, obj, form, change):
        """Auto-populate created_by field."""
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

        from django.contrib import messages

        messages.warning(
            request,
            _(
                "QGIS project saved successfully. Please restart QGIS Server manually using docker-compose."
            ),
        )

    def get_wms_url(self, obj):
        """Display WMS access URL in admin."""
        if obj.project_file:
            return obj.get_wms_url()
        return "-"

    get_wms_url.short_description = "WMS URL"

    def get_wfs_url(self, obj):
        """Display WFS access URL in admin."""
        if obj.project_file:
            return obj.get_wfs_url()
        return "-"

    get_wfs_url.short_description = "WFS URL"

    def download_with_postgres_datasources(self, request, queryset):
        """
        Download QGIS project with datasources converted from GeoPackage to PostgreSQL.

        Only works with single selection.
        """
        from django.http import HttpResponse

        from .services import convert_qgs_to_postgres, handle_qgis_file, repackage_qgz

        if queryset.count() != 1:
            self.message_user(
                request,
                _("Please select exactly one project to convert."),
                level=messages.ERROR,
            )
            return

        project = queryset.first()

        if not project.project_file:
            self.message_user(
                request,
                _("Selected project has no file attached."),
                level=messages.ERROR,
            )
            return

        try:
            file_content = project.project_file.read()
            filename = os.path.basename(project.project_file.name)

            qgs_content, is_qgz = handle_qgis_file(file_content, filename)
            converted_content = convert_qgs_to_postgres(qgs_content)

            if is_qgz:
                final_content = repackage_qgz(converted_content, file_content)
                content_type = "application/zip"
            else:
                final_content = converted_content
                content_type = "application/xml"

            response = HttpResponse(final_content, content_type=content_type)
            response["Content-Disposition"] = f'attachment; filename="{filename}"'
            return response

        except Exception as e:
            self.message_user(
                request,
                _("Error converting project: %(error)s") % {"error": str(e)},
                level=messages.ERROR,
            )
            return

    download_with_postgres_datasources.short_description = _(
        "Download with PostgreSQL datasources"
    )


@admin.register(Node)
class NodeAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "node_type",
        "status",
        "network_level",
        "owner",
        "constructor",
    )
    list_filter = ("node_type", "status", "network_level", "owner", "constructor")
    search_fields = ("name",)


@admin.register(Conduit)
class ConduitAdmin(admin.ModelAdmin):
    """Admin interface for Conduit model with action to create missing microducts."""

    list_display = ("name", "conduit_type", "microduct_count", "has_color_mappings")
    list_filter = ("conduit_type",)
    search_fields = ("name",)
    actions = ["create_microducts_for_empty_conduits"]

    @admin.display(description=_("Microducts"))
    def microduct_count(self, obj):
        """Display the number of microducts for this conduit."""
        return obj.microduct_set.count()

    @admin.display(boolean=True, description=_("Type Has Mappings"))
    def has_color_mappings(self, obj):
        """Check if the conduit's type has color mappings configured."""
        if not obj.conduit_type:
            return False
        return obj.conduit_type.color_mappings.exists()

    @admin.action(
        description=_("Create microducts for selected conduits (only if empty)")
    )
    def create_microducts_for_empty_conduits(self, request, queryset):
        """
        Create microducts for selected conduits that don't have any.
        Only processes conduits with zero microducts - no partial filling.
        """
        from django.db.models import Count

        created_count = 0
        skipped_has_microducts = 0
        skipped_no_mappings = 0

        queryset = queryset.annotate(md_count=Count("microduct"))

        for conduit in queryset:
            if conduit.md_count > 0:
                skipped_has_microducts += 1
                continue

            if not conduit.conduit_type:
                skipped_no_mappings += 1
                continue

            color_mappings = (
                ConduitTypeColorMapping.objects.filter(
                    conduit_type=conduit.conduit_type
                )
                .select_related("color")
                .order_by("position")
            )

            if not color_mappings.exists():
                skipped_no_mappings += 1
                continue

            for mapping in color_mappings:
                Microduct.objects.create(
                    uuid_conduit=conduit,
                    number=mapping.position,
                    color=mapping.color.name_de,
                )
            created_count += 1

        self.message_user(
            request,
            _(
                "Created microducts for %(created)d conduit(s). "
                "Skipped %(has_microducts)d (already have microducts), "
                "%(no_mappings)d (no type or no color mappings)."
            )
            % {
                "created": created_count,
                "has_microducts": skipped_has_microducts,
                "no_mappings": skipped_no_mappings,
            },
        )


admin.site.register(Trench)


class WFSErrorFilter(admin.SimpleListFilter):
    """Filter for WFS-related errors in LogEntry."""

    title = _("WFS Errors")
    parameter_name = "wfs_errors"

    def lookups(self, request, model_admin):
        return (
            ("wfs_all", _("All WFS logs")),
            ("wfs_errors", _("WFS errors only")),
            ("wfs_node", _("Node errors")),
            ("wfs_address", _("Address errors")),
            ("wfs_trench", _("Trench errors")),
        )

    def queryset(self, request, queryset):
        if self.value() == "wfs_all":
            return queryset.filter(source="wfs")
        elif self.value() == "wfs_errors":
            return queryset.filter(source="wfs", level="ERROR")
        elif self.value() == "wfs_node":
            return queryset.filter(source="wfs", logger_name="trigger.node")
        elif self.value() == "wfs_address":
            return queryset.filter(source="wfs", logger_name="trigger.address")
        elif self.value() == "wfs_trench":
            return queryset.filter(source="wfs", logger_name="trigger.trench")
        return queryset


@admin.register(LogEntry)
class LogEntryAdmin(admin.ModelAdmin):
    """Admin interface for LogEntry model."""

    list_display = (
        "timestamp",
        "level",
        "source",
        "username",
        "project",
        "logger_name",
        "short_message",
        "error_type_display",
    )
    list_filter = (
        "level",
        "source",
        WFSErrorFilter,
        "project",
        "timestamp",
        "logger_name",
    )
    search_fields = ("message", "logger_name", "user__username", "project__project")
    readonly_fields = (
        "uuid",
        "timestamp",
        "level",
        "logger_name",
        "message",
        "user",
        "source",
        "path",
        "extra_data",
        "project",
    )
    date_hierarchy = "timestamp"
    ordering = ("-timestamp",)

    fieldsets = (
        (
            _("Log Information"),
            {"fields": ("uuid", "timestamp", "level", "logger_name", "source")},
        ),
        (_("Message"), {"fields": ("message",)}),
        (_("User & Context"), {"fields": ("user", "project", "path")}),
        (_("Extra Data"), {"fields": ("extra_data",), "classes": ("collapse",)}),
    )

    formfield_overrides = {
        models.JSONField: {"widget": JSONEditorWidget},
    }

    def has_add_permission(self, request):
        """Disable adding log entries manually."""
        return False

    def has_change_permission(self, request, obj=None):
        """Disable editing log entries."""
        return False

    def username(self, obj):
        """Display username instead of user object."""
        return obj.user.username if obj.user else "-"

    username.short_description = _("User")

    def short_message(self, obj):
        """Display truncated message in list view."""
        return obj.message[:100] + "..." if len(obj.message) > 100 else obj.message

    short_message.short_description = _("Message")

    def error_type_display(self, obj):
        """Display error type from extra_data if available."""
        if obj.extra_data and isinstance(obj.extra_data, dict):
            error_type = obj.extra_data.get("error_type", "")
            if error_type:
                return error_type.replace("_", " ").title()
        return "-"

    error_type_display.short_description = _("Error Type")


class OrphanedFilesFilter(admin.SimpleListFilter):
    """Filter to show only orphaned FeatureFiles (where the linked feature no longer exists)."""

    title = _("Orphan Status")
    parameter_name = "orphan_status"

    def lookups(self, request, model_admin):
        self._model_admin = model_admin
        return (
            ("orphaned", _("Orphaned files only")),
            ("valid", _("Valid files only")),
        )

    def queryset(self, request, queryset):
        if self.value() == "orphaned":
            return self._model_admin.get_orphaned_files(queryset)
        elif self.value() == "valid":
            orphaned_ids = self._model_admin.get_orphaned_files(queryset).values_list(
                "uuid", flat=True
            )
            return queryset.exclude(uuid__in=orphaned_ids)
        return queryset


class MoveFilesForm(forms.Form):
    """Form for selecting target feature to move orphaned files to."""

    target_feature_type = forms.ChoiceField(
        label=_("Target Feature Type"),
        choices=[
            ("trench", _("Trench")),
            ("conduit", _("Conduit")),
            ("cable", _("Cable")),
            ("node", _("Node")),
            ("address", _("Address")),
            ("area", _("Area")),
        ],
    )
    target_feature_id = forms.UUIDField(
        label=_("Target Feature UUID"),
        help_text=_("Enter the UUID of the feature to move the files to."),
    )


@admin.register(FeatureFiles)
class FeatureFilesAdmin(admin.ModelAdmin):
    """
    Admin interface for FeatureFiles with orphan detection and management.

    Allows administrators to:
    - View all feature files with their associated feature info
    - Filter to show only orphaned files (where the feature was deleted)
    - Move orphaned files to another existing feature
    - Delete orphaned files and their database entries
    """

    def get_actions(self, request):
        """Remove the default delete action to prevent orphaning files on disk."""
        actions = super().get_actions(request)
        if "delete_selected" in actions:
            del actions["delete_selected"]
        return actions

    list_display = (
        "file_name",
        "file_type",
        "feature_type_display",
        "feature_identifier_display",
        "orphan_status_display",
        "created_at",
    )
    list_filter = (OrphanedFilesFilter, "content_type", "file_type", "created_at")
    search_fields = ("file_name", "file_path", "description")
    readonly_fields = (
        "uuid",
        "file_name",
        "file_type",
        "created_at",
        "file_path",
        "content_type",
        "object_id",
    )
    ordering = ("-created_at",)
    actions = ["delete_orphaned_files", "move_to_feature"]

    def get_urls(self):
        """Add custom URL for move files form."""
        urls = super().get_urls()
        custom_urls = [
            path(
                "move-files/",
                self.admin_site.admin_view(self.move_files_view),
                name="api_featurefiles_move",
            ),
        ]
        return custom_urls + urls

    def get_orphaned_files(self, queryset=None):
        """
        Find all FeatureFiles where the linked feature no longer exists.

        Returns a queryset of orphaned FeatureFiles.
        """
        if queryset is None:
            queryset = FeatureFiles.objects.all()

        orphaned_uuids = []

        for content_type in ContentType.objects.filter(
            app_label="api",
            model__in=FEATURE_MODEL_MAP.keys(),
        ):
            model_class = FEATURE_MODEL_MAP.get(content_type.model)
            if not model_class:
                continue

            file_object_ids = queryset.filter(content_type=content_type).values_list(
                "object_id", flat=True
            )

            if not file_object_ids:
                continue

            existing_feature_ids = set(
                model_class.objects.filter(uuid__in=file_object_ids).values_list(
                    "uuid", flat=True
                )
            )

            for file_obj in queryset.filter(content_type=content_type):
                if file_obj.object_id not in existing_feature_ids:
                    orphaned_uuids.append(file_obj.uuid)

        return queryset.filter(uuid__in=orphaned_uuids)

    def is_orphaned(self, obj):
        """Check if a single FeatureFiles instance is orphaned."""
        model_class = FEATURE_MODEL_MAP.get(obj.content_type.model)
        if not model_class:
            return True
        return not model_class.objects.filter(uuid=obj.object_id).exists()

    @admin.display(description=_("Feature Type"))
    def feature_type_display(self, obj):
        """Display the feature type (model name)."""
        return obj.content_type.model.title()

    @admin.display(description=_("Feature Identifier"))
    def feature_identifier_display(self, obj):
        """Display the feature identifier or indicate if orphaned."""
        if self.is_orphaned(obj):
            return format_html(
                '<span style="color: #999; font-style: italic;">{} ({})</span>',
                _("Feature deleted"),
                str(obj.object_id)[:8] + "...",
            )
        return FeatureFiles.get_feature_identifier(obj)

    @admin.display(description=_("Status"))
    def orphan_status_display(self, obj):
        """Display orphan status with color indicator."""
        if self.is_orphaned(obj):
            return format_html(
                '<span style="color: #dc3545; font-weight: bold;">⚠ {}</span>',
                _("Orphaned"),
            )
        return format_html(
            '<span style="color: #28a745;">✓ {}</span>',
            _("Valid"),
        )

    @admin.action(description=_("Delete selected orphaned files and their data"))
    def delete_orphaned_files(self, request, queryset):
        """
        Delete orphaned files from storage and remove their database entries.

        Only processes files that are actually orphaned.
        """
        storage = LocalMediaStorage()
        deleted_count = 0
        skipped_count = 0

        with transaction.atomic():
            for file_obj in queryset:
                if not self.is_orphaned(file_obj):
                    skipped_count += 1
                    continue

                try:
                    if file_obj.file_path and storage.exists(file_obj.file_path.name):
                        storage.delete(file_obj.file_path.name)
                except Exception as e:
                    messages.warning(
                        request,
                        _("Could not delete file %(path)s: %(error)s")
                        % {"path": file_obj.file_path.name, "error": str(e)},
                    )

                file_obj.delete()
                deleted_count += 1

        if deleted_count > 0:
            messages.success(
                request,
                _("Successfully deleted %(count)d orphaned file(s).")
                % {"count": deleted_count},
            )
        if skipped_count > 0:
            messages.info(
                request,
                _("Skipped %(count)d file(s) that are not orphaned.")
                % {"count": skipped_count},
            )

    @admin.action(description=_("Move selected files to another feature"))
    def move_to_feature(self, request, queryset):
        """Redirect to move files form."""
        selected = queryset.values_list("uuid", flat=True)
        selected_str = ",".join(str(uuid) for uuid in selected)
        return redirect(f"{reverse('admin:api_featurefiles_move')}?ids={selected_str}")

    def move_files_view(self, request):
        """Handle the move files form submission."""
        ids_param = request.GET.get("ids", "")
        if not ids_param:
            messages.error(request, _("No files selected."))
            return redirect("admin:api_featurefiles_changelist")

        file_uuids = [uuid.strip() for uuid in ids_param.split(",") if uuid.strip()]
        files = FeatureFiles.objects.filter(uuid__in=file_uuids)

        if request.method == "POST":
            form = MoveFilesForm(request.POST)
            if form.is_valid():
                target_type = form.cleaned_data["target_feature_type"]
                target_id = form.cleaned_data["target_feature_id"]

                model_class = FEATURE_MODEL_MAP.get(target_type)
                if not model_class:
                    messages.error(request, _("Invalid target feature type."))
                    return redirect("admin:api_featurefiles_changelist")

                if not model_class.objects.filter(uuid=target_id).exists():
                    messages.error(
                        request,
                        _("Target feature with UUID %(uuid)s does not exist.")
                        % {"uuid": target_id},
                    )
                    return redirect("admin:api_featurefiles_changelist")

                target_content_type = ContentType.objects.get_for_model(model_class)

                target_feature = model_class.objects.get(uuid=target_id)

                moved_count = 0
                failed_files = []

                with transaction.atomic():
                    for file_obj in files:
                        success, new_path, error = move_file_to_feature(
                            file_obj, target_feature, target_content_type
                        )

                        if not success:
                            failed_files.append((file_obj.file_name, error))
                            continue

                        file_obj.content_type = target_content_type
                        file_obj.object_id = target_id
                        if new_path:
                            file_obj.file_path.name = new_path
                        file_obj.save(
                            update_fields=["content_type", "object_id", "file_path"]
                        )
                        moved_count += 1

                if moved_count > 0:
                    messages.success(
                        request,
                        _("Successfully moved %(count)d file(s) to %(type)s %(uuid)s.")
                        % {
                            "count": moved_count,
                            "type": target_type,
                            "uuid": str(target_id)[:8] + "...",
                        },
                    )

                if failed_files:
                    for file_name, error in failed_files:
                        messages.error(
                            request,
                            _("Failed to move %(file)s: %(error)s")
                            % {"file": file_name, "error": error},
                        )

                return redirect("admin:api_featurefiles_changelist")
        else:
            form = MoveFilesForm()

        context = {
            **self.admin_site.each_context(request),
            "title": _("Move Files to Another Feature"),
            "form": form,
            "files": files,
            "opts": self.model._meta,
        }
        return render(request, "admin/api/featurefiles/move_files.html", context)
