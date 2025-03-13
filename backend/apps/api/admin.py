from django.contrib import admin

from .models import (
    AttributesCompany,
    AttributesConstructionType,
    AttributesPhase,
    AttributesStatus,
    AttributesSurface,
    FileTypeCategory,
    StoragePreferences,
)

# TODO: Model names should be translated in the admin interface
admin.site.register(AttributesSurface)
admin.site.register(AttributesConstructionType)
admin.site.register(AttributesStatus)
admin.site.register(AttributesPhase)
admin.site.register(AttributesCompany)
admin.site.register(StoragePreferences)
admin.site.register(FileTypeCategory)
