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
admin.site.register(Conduit)
admin.site.register(Microduct)
admin.site.register(Trench)
