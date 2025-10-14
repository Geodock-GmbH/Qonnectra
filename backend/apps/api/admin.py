from django.contrib import admin

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
    GtPkMetadata,
    Microduct,
    Projects,
    StoragePreferences,
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


admin.site.register(AttributesSurface)
admin.site.register(AttributesStatusDevelopment)
admin.site.register(AttributesConstructionType)
admin.site.register(AttributesStatus)
admin.site.register(AttributesPhase)
admin.site.register(AttributesCompany)
admin.site.register(Cable)
admin.site.register(Projects)
admin.site.register(StoragePreferences)
admin.site.register(FileTypeCategory)
admin.site.register(Flags)
admin.site.register(AttributesNetworkLevel)
admin.site.register(AttributesNodeType)
admin.site.register(AttributesMicroductStatus)
admin.site.register(Conduit)
admin.site.register(Microduct)
admin.site.register(GtPkMetadata)
