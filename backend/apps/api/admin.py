from django.contrib import admin

from .models import (
    AttributesCableType,
    AttributesCompany,
    AttributesConduitType,
    AttributesConstructionType,
    AttributesMicroductStatus,
    AttributesNetworkLevel,
    AttributesNodeType,
    AttributesPhase,
    AttributesStatus,
    AttributesStatusDevelopment,
    AttributesSurface,
    Cable,
    Conduit,
    FileTypeCategory,
    Flags,
    GtPkMetadata,
    Microduct,
    Projects,
    StoragePreferences,
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
admin.site.register(AttributesConduitType)
admin.site.register(AttributesNetworkLevel)
admin.site.register(AttributesNodeType)
admin.site.register(AttributesMicroductStatus)
admin.site.register(Conduit)
admin.site.register(Microduct)
admin.site.register(GtPkMetadata)
