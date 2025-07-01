from django.contrib import admin

from .models import (
    AttributesCompany,
    AttributesConduitType,
    AttributesConstructionType,
    AttributesNetworkLevel,
    AttributesNodeType,
    AttributesPhase,
    AttributesStatus,
    AttributesStatusDevelopment,
    AttributesSurface,
    FileTypeCategory,
    Flags,
    GtPkMetadata,
    Projects,
    StoragePreferences,
)

admin.site.register(AttributesSurface)
admin.site.register(AttributesStatusDevelopment)
admin.site.register(AttributesConstructionType)
admin.site.register(AttributesStatus)
admin.site.register(AttributesPhase)
admin.site.register(AttributesCompany)
admin.site.register(Projects)
admin.site.register(StoragePreferences)
admin.site.register(FileTypeCategory)
admin.site.register(Flags)
admin.site.register(AttributesConduitType)
admin.site.register(AttributesNetworkLevel)
admin.site.register(AttributesNodeType)
admin.site.register(GtPkMetadata)
