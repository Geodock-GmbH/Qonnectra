from django.contrib import admin
from django.db import models
from django.utils.translation import gettext_lazy as _
from django_json_widget.widgets import JSONEditorWidget

from .models import (
    AttributesCableType,
    AttributesCompany,
    AttributesConduitType,
    AttributesConstructionType,
    AttributesFiberColor,
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
    FileTypeCategory,
    Flags,
    LogEntry,
    Microduct,
    Projects,
    QGISProject,
    StoragePreferences,
    Trench,
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


admin.site.register(AttributesSurface)
admin.site.register(AttributesStatusDevelopment)
admin.site.register(AttributesConstructionType)
admin.site.register(AttributesStatus)
admin.site.register(AttributesPhase)
admin.site.register(AttributesCompany)
admin.site.register(Cable)
admin.site.register(Projects)
admin.site.register(FileTypeCategory)
admin.site.register(Flags)
admin.site.register(AttributesNetworkLevel)
admin.site.register(AttributesNodeType)
admin.site.register(AttributesMicroductStatus)
admin.site.register(Microduct)


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
