from django.contrib import admin

from .models import (
    AttributesCableType,
    AttributesCompany,
    AttributesConduitType,
    AttributesConstructionType,
    AttributesMicroductColor,
    AttributesMicroductStatus,
    AttributesNetworkLevel,
    AttributesNodeType,
    AttributesPhase,
    AttributesStatus,
    AttributesStatusDevelopment,
    AttributesSurface,
    Cable,
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
    fields = ("position", "color")
    ordering = ("position",)


@admin.register(AttributesConduitType)
class AttributesConduitTypeAdmin(admin.ModelAdmin):
    list_display = ("conduit_type", "conduit_count", "manufacturer")
    inlines = [ConduitTypeColorMappingInline]


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


admin.site.register(AttributesSurface)
admin.site.register(AttributesStatusDevelopment)
admin.site.register(AttributesConstructionType)
admin.site.register(AttributesStatus)
admin.site.register(AttributesPhase)
admin.site.register(AttributesCompany)
admin.site.register(AttributesCableType)
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
