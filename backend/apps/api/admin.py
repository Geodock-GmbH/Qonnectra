"""Django admin configuration for the Qonnectra API models."""

import logging
import os

from django import forms
from django.contrib import admin, messages
from django.contrib.contenttypes.models import ContentType
from django.db import models, transaction
from django.db.models import Case, Exists, IntegerField, OuterRef, Q, Value, When
from django.shortcuts import redirect, render
from django.urls import path, reverse
from django.utils.html import format_html
from django.utils.translation import gettext_lazy as _
from django_json_widget.widgets import JSONEditorWidget
from simple_history.admin import SimpleHistoryAdmin

from .models import (
    Address,
    Area,
    AttributesAreaType,
    AttributesCableType,
    AttributesCompany,
    AttributesComponentStructure,
    AttributesComponentType,
    AttributesConduitType,
    AttributesConstructionType,
    AttributesFiberColor,
    AttributesFiberStatus,
    AttributesMicroductColor,
    AttributesMicroductStatus,
    AttributesNetworkLevel,
    AttributesNodeType,
    AttributesPhase,
    AttributesResidentialUnitStatus,
    AttributesResidentialUnitType,
    AttributesStatus,
    AttributesStatusDevelopment,
    AttributesSurface,
    Cable,
    CableTypeColorMapping,
    Conduit,
    ConduitTypeColorMapping,
    ContainerType,
    FeatureFiles,
    Fiber,
    FileTypeCategory,
    Flags,
    GeoPackageSchemaConfig,
    LogEntry,
    Microduct,
    ModelPermission,
    NetworkSchemaSettings,
    Node,
    PipeBranchSettings,
    Projects,
    QGISProject,
    QGISProjectDataFile,
    ResidentialUnit,
    RoutePermission,
    StoragePreferences,
    Trench,
    WMSLayer,
    WMSSource,
)
from .services import (
    GEOPACKAGE_LAYER_CONFIG,
    generate_geopackage_schema,
    move_file_to_feature,
)
from .storage import LocalMediaStorage
from .wms_service import WMSServiceError, fetch_wms_layers, scan_wms_capabilities

logger = logging.getLogger(__name__)


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
        """Populate layer choices from the GeoPackage config registry."""
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

    def clean_selected_layers(self) -> list[str]:
        """Return the selected layers as a plain list for JSONField storage."""
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
        """Validate that the uploaded file has a .qgs or .qgz extension."""
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
        """Register custom URL for the QGIS project conversion view."""
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
        """Handle upload and conversion of OGR datasources to PostgreSQL in a QGIS project."""
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
        """Return the number of selected layers."""
        return len(obj.selected_layers) if obj.selected_layers else 0

    @admin.display(description=_("Selected Layers"))
    def layer_preview(self, obj):
        """Return a comma-separated preview of the first five selected layers."""
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


FEATURE_MODEL_MAP: dict = {
    "trench": Trench,
    "conduit": Conduit,
    "cable": Cable,
    "node": Node,
    "address": Address,
    "residentialunit": ResidentialUnit,
    "area": Area,
}
"""Map content-type model names to their Django model classes."""


@admin.register(AttributesSurface)
class AttributesSurfaceAdmin(admin.ModelAdmin):
    """Admin for :model:`api.AttributesSurface` lookup table."""

    list_display = ("id", "surface", "sealing")


@admin.register(AttributesStatusDevelopment)
class AttributesStatusDevelopmentAdmin(admin.ModelAdmin):
    """Admin for :model:`api.AttributesStatusDevelopment` lookup table."""

    list_display = ("id", "status")


@admin.register(AttributesResidentialUnitType)
class AttributesResidentialUnitTypeAdmin(admin.ModelAdmin):
    """Admin for :model:`api.AttributesResidentialUnitType` lookup table."""

    list_display = ("id", "residential_unit_type")


@admin.register(AttributesResidentialUnitStatus)
class AttributesResidentialUnitStatusAdmin(admin.ModelAdmin):
    """Admin for :model:`api.AttributesResidentialUnitStatus` lookup table."""

    list_display = ("id", "status")


@admin.register(AttributesConstructionType)
class AttributesConstructionTypeAdmin(admin.ModelAdmin):
    """Admin for :model:`api.AttributesConstructionType` lookup table."""

    list_display = ("id", "construction_type")


@admin.register(AttributesStatus)
class AttributesStatusAdmin(admin.ModelAdmin):
    """Admin for :model:`api.AttributesStatus` lookup table."""

    list_display = ("id", "status")


@admin.register(AttributesPhase)
class AttributesPhaseAdmin(admin.ModelAdmin):
    """Admin for :model:`api.AttributesPhase` lookup table."""

    list_display = ("id", "phase")


@admin.register(AttributesCompany)
class AttributesCompanyAdmin(admin.ModelAdmin):
    """Admin for :model:`api.AttributesCompany` lookup table."""

    list_display = ("id", "company", "city", "phone", "email")


@admin.register(AttributesAreaType)
class AttributesAreaTypeAdmin(admin.ModelAdmin):
    """Admin for :model:`api.AttributesAreaType` lookup table."""

    list_display = ("id", "area_type")


@admin.register(AttributesComponentType)
class AttributesComponentTypeAdmin(admin.ModelAdmin):
    """Admin for :model:`api.AttributesComponentType` lookup table."""

    list_display = ("id", "component_type", "occupied_slots", "manufacturer")


class BulkCreatePortsForm(forms.Form):
    """Form for bulk-creating In/Out port pairs for a component type."""

    component_type = forms.ModelChoiceField(
        queryset=AttributesComponentType.objects.all(),
        label=_("Component Type"),
        help_text=_("Select the component type to create ports for."),
    )
    number_of_ports = forms.IntegerField(
        min_value=1,
        max_value=1000,
        label=_("Number of Ports"),
        help_text=_(
            "Number of In ports and Out ports to create. "
            "E.g. 4 creates In 1-4 and Out 1-4 (8 entries total)."
        ),
    )
    start_position = forms.IntegerField(
        min_value=1,
        initial=1,
        label=_("Start Position"),
        help_text=_(
            "Port numbering starts at this position. "
            "Useful when adding ports to an existing component."
        ),
    )


@admin.register(AttributesComponentStructure)
class AttributesComponentStructureAdmin(admin.ModelAdmin):
    """Admin for :model:`api.AttributesComponentStructure` lookup table."""

    list_display = ("id", "component_type", "in_or_out", "port", "port_alias")
    list_filter = ("component_type", "in_or_out")
    change_list_template = "admin/api/attributescomponentstructure/change_list.html"

    def get_urls(self):
        """Register custom URL for bulk port creation."""
        urls = super().get_urls()
        custom_urls = [
            path(
                "bulk-create-ports/",
                self.admin_site.admin_view(self.bulk_create_ports_view),
                name="api_attributescomponentstructure_bulk_create_ports",
            ),
        ]
        return custom_urls + urls

    def bulk_create_ports_view(self, request):
        """Handle bulk creation of In/Out port pairs for a component type."""
        if request.method == "POST":
            form = BulkCreatePortsForm(request.POST)
            if form.is_valid():
                component_type = form.cleaned_data["component_type"]
                num_ports = form.cleaned_data["number_of_ports"]
                start = form.cleaned_data["start_position"]

                structures = []
                for port_num in range(start, start + num_ports):
                    for direction in ("in", "out"):
                        structures.append(
                            AttributesComponentStructure(
                                component_type=component_type,
                                in_or_out=direction,
                                port=port_num,
                            )
                        )

                try:
                    with transaction.atomic():
                        AttributesComponentStructure.objects.bulk_create(structures)
                    messages.success(
                        request,
                        _(
                            "Created %(count)d ports (%(num)d In + %(num)d Out) "
                            "for %(type)s."
                        )
                        % {
                            "count": len(structures),
                            "num": num_ports,
                            "type": component_type,
                        },
                    )
                except Exception as e:
                    messages.error(
                        request,
                        _("Error creating ports: %(error)s") % {"error": str(e)},
                    )

                return redirect(
                    reverse("admin:api_attributescomponentstructure_changelist")
                )
        else:
            form = BulkCreatePortsForm()

        context = {
            **self.admin_site.each_context(request),
            "title": _("Bulk Create Ports"),
            "form": form,
            "opts": self.model._meta,
        }
        return render(
            request,
            "admin/api/attributescomponentstructure/bulk_create_ports.html",
            context,
        )


admin.site.register(FileTypeCategory)


@admin.register(Cable)
class CableAdmin(SimpleHistoryAdmin):
    """Admin interface for Cable model with action to create missing fibers."""

    list_display = (
        "name",
        "cable_type",
        "project",
        "flag",
        "fiber_count_display",
        "has_color_mappings",
    )
    list_filter = ("cable_type", "project", "flag")
    search_fields = ("name",)
    actions = ["create_fibers_for_empty_cables"]

    @admin.display(description=_("Fibers"))
    def fiber_count_display(self, obj):
        """Display the number of fibers for this cable."""
        return obj.fiber_set.count()

    @admin.display(boolean=True, description=_("Type Has Mappings"))
    def has_color_mappings(self, obj):
        """Check if the cable's type has complete color mappings configured."""
        if not obj.cable_type:
            return False
        cable_type = obj.cable_type
        bundle_count = CableTypeColorMapping.objects.filter(
            cable_type=cable_type, position_type="bundle"
        ).count()
        fiber_count = CableTypeColorMapping.objects.filter(
            cable_type=cable_type, position_type="fiber"
        ).count()
        return (
            bundle_count >= cable_type.bundle_count
            and fiber_count >= cable_type.bundle_fiber_count
        )

    @admin.action(description=_("Create fibers for selected cables (only if empty)"))
    def create_fibers_for_empty_cables(self, request, queryset):
        """
        Create fibers for selected cables that don't have any.
        Only processes cables with zero fibers - no partial filling.
        Uses the same logic as the create_fibers_for_cable signal.
        """
        from django.db.models import Count

        created_count = 0
        skipped_has_fibers = 0
        skipped_no_mappings = 0

        queryset = queryset.annotate(fiber_count=Count("fiber"))

        for cable in queryset:
            if cable.fiber_count > 0:
                skipped_has_fibers += 1
                continue

            cable_type = cable.cable_type
            if not cable_type:
                skipped_no_mappings += 1
                continue

            bundle_mappings = (
                CableTypeColorMapping.objects.filter(
                    cable_type=cable_type, position_type="bundle"
                )
                .select_related("color")
                .order_by("position")
            )

            fiber_mappings = (
                CableTypeColorMapping.objects.filter(
                    cable_type=cable_type, position_type="fiber"
                )
                .select_related("color")
                .order_by("position")
            )

            if not bundle_mappings.exists() or not fiber_mappings.exists():
                skipped_no_mappings += 1
                continue

            bundle_count = cable_type.bundle_count
            bundle_fiber_count = cable_type.bundle_fiber_count

            if (
                bundle_mappings.count() < bundle_count
                or fiber_mappings.count() < bundle_fiber_count
            ):
                skipped_no_mappings += 1
                continue

            fibers_to_create = []
            fiber_number_absolute = 1
            for bundle_number in range(1, bundle_count + 1):
                bundle_mapping = bundle_mappings.filter(position=bundle_number).first()
                bundle_color = (
                    bundle_mapping.color.name_de
                    if bundle_mapping
                    else f"Bundle {bundle_number}"
                )

                for fiber_in_bundle in range(1, bundle_fiber_count + 1):
                    fiber_mapping = fiber_mappings.filter(
                        position=fiber_in_bundle
                    ).first()
                    fiber_color = (
                        fiber_mapping.color.name_de
                        if fiber_mapping
                        else f"Fiber {fiber_in_bundle}"
                    )
                    layer = fiber_mapping.layer if fiber_mapping else "inner"

                    fibers_to_create.append(
                        Fiber(
                            uuid_cable=cable,
                            bundle_number=bundle_number,
                            bundle_color=bundle_color,
                            fiber_number_absolute=fiber_number_absolute,
                            fiber_number_in_bundle=fiber_in_bundle,
                            fiber_color=fiber_color,
                            active=True,
                            fiber_status=None,
                            flag=cable.flag,
                            project=cable.project,
                            layer=layer,
                        )
                    )
                    fiber_number_absolute += 1

            if fibers_to_create:
                Fiber.objects.bulk_create(fibers_to_create)
                created_count += 1

        self.message_user(
            request,
            _(
                "Created fibers for %(created)d cable(s). "
                "Skipped %(has_fibers)d (already have fibers), "
                "%(no_mappings)d (no type or incomplete color mappings)."
            )
            % {
                "created": created_count,
                "has_fibers": skipped_has_fibers,
                "no_mappings": skipped_no_mappings,
            },
        )


@admin.register(Area)
class AreaAdmin(SimpleHistoryAdmin):
    """Admin for :model:`api.Area` geographic areas."""

    list_display = ("name", "area_type", "project", "flag")
    list_filter = ("area_type", "project", "flag")
    search_fields = ("name", "project__project", "flag__flag", "area_type__area_type")


@admin.register(Flags)
class FlagsAdmin(SimpleHistoryAdmin):
    """Admin for :model:`api.Flags` project flags."""

    list_display = ("id", "flag")


@admin.register(AttributesNetworkLevel)
class AttributesNetworkLevelAdmin(admin.ModelAdmin):
    """Admin for :model:`api.AttributesNetworkLevel` lookup table."""

    list_display = ("id", "network_level")


@admin.register(AttributesNodeType)
class AttributesNodeTypeAdmin(admin.ModelAdmin):
    """Admin for :model:`api.AttributesNodeType` lookup table."""

    list_display = ("id", "node_type", "dimension", "group", "company")


@admin.register(AttributesMicroductStatus)
class AttributesMicroductStatusAdmin(admin.ModelAdmin):
    """Admin for :model:`api.AttributesMicroductStatus` lookup table."""

    list_display = ("id", "microduct_status")


@admin.register(Microduct)
class MicroductAdmin(SimpleHistoryAdmin):
    """Admin for :model:`api.Microduct` cable pathway records."""

    list_display = ("uuid", "uuid_conduit", "number", "color")
    list_filter = ("uuid_conduit", "microduct_status")
    search_fields = ("uuid_conduit__name", "color")


@admin.register(AttributesFiberStatus)
class AttributesFiberStatusAdmin(admin.ModelAdmin):
    """Admin for :model:`api.AttributesFiberStatus` lookup table."""

    list_display = ("id", "fiber_status")


class NetworkSchemaSettingsInline(admin.StackedInline):
    """Inline admin for Network Schema Settings within Project admin."""

    model = NetworkSchemaSettings
    can_delete = False
    verbose_name = _("Network Schema Settings")
    verbose_name_plural = _("Network Schema Settings")
    filter_horizontal = ("excluded_node_types", "child_view_enabled_node_types")


class PipeBranchSettingsInline(admin.StackedInline):
    """Inline admin for Pipe Branch Settings within Project admin."""

    model = PipeBranchSettings
    can_delete = False
    verbose_name = _("Pipe Branch Settings")
    verbose_name_plural = _("Pipe Branch Settings")
    filter_horizontal = ("allowed_node_types",)


@admin.register(Projects)
class ProjectsAdmin(SimpleHistoryAdmin):
    """Admin interface for Projects with Network Schema and Pipe Branch Settings."""

    list_display = (
        "id",
        "project",
        "description",
        "active",
        "excluded_types_display",
        "child_view_types_display",
        "allowed_pipe_branch_types_display",
    )
    list_filter = ("active",)
    search_fields = ("project", "description")
    inlines = [NetworkSchemaSettingsInline, PipeBranchSettingsInline]

    @admin.display(description=_("Excluded Node Types"))
    def excluded_types_display(self, obj):
        """Return a comma-separated preview of excluded node types."""
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

    @admin.display(description=_("Child View Types"))
    def child_view_types_display(self, obj):
        """Return a comma-separated preview of child-view-enabled node types."""
        try:
            settings = obj.network_schema_settings
            count = settings.child_view_enabled_node_types.count()
            if count > 0:
                types = settings.child_view_enabled_node_types.all()[:3]
                names = [t.node_type for t in types]
                suffix = f"... (+{count - 3})" if count > 3 else ""
                return ", ".join(names) + suffix
            return _("None")
        except NetworkSchemaSettings.DoesNotExist:
            return format_html(
                '<span style="color: #dc3545;">⚠ {}</span>',
                _("Not configured"),
            )

    @admin.display(description=_("Pipe Branch Types"))
    def allowed_pipe_branch_types_display(self, obj):
        """Return a comma-separated preview of allowed pipe-branch node types."""
        try:
            settings = obj.pipe_branch_settings
            count = settings.allowed_node_types.count()
            if count > 0:
                types = settings.allowed_node_types.all()[:3]
                names = [t.node_type for t in types]
                suffix = f"... (+{count - 3})" if count > 3 else ""
                return ", ".join(names) + suffix
            return _("None configured")
        except PipeBranchSettings.DoesNotExist:
            return format_html(
                '<span style="color: #ffc107;">⚠ {}</span>',
                _("Not configured"),
            )


@admin.register(NetworkSchemaSettings)
class NetworkSchemaSettingsAdmin(admin.ModelAdmin):
    """Standalone admin for Network Schema Settings."""

    list_display = (
        "project",
        "excluded_count",
        "excluded_types_preview",
        "child_view_count",
        "child_view_types_preview",
    )
    list_filter = ("project",)
    search_fields = ("project__project",)
    filter_horizontal = ("excluded_node_types", "child_view_enabled_node_types")
    autocomplete_fields = ["project"]

    @admin.display(description=_("Excluded Count"))
    def excluded_count(self, obj):
        """Return the total number of excluded node types."""
        return obj.excluded_node_types.count()

    @admin.display(description=_("Excluded Types"))
    def excluded_types_preview(self, obj):
        """Return a comma-separated preview of excluded node types."""
        types = obj.excluded_node_types.all()[:5]
        names = [t.node_type for t in types]
        suffix = "..." if obj.excluded_node_types.count() > 5 else ""
        return ", ".join(names) + suffix if names else _("None")

    @admin.display(description=_("Child View Count"))
    def child_view_count(self, obj):
        """Return the total number of child-view-enabled node types."""
        return obj.child_view_enabled_node_types.count()

    @admin.display(description=_("Child View Types"))
    def child_view_types_preview(self, obj):
        """Return a comma-separated preview of child-view-enabled node types."""
        types = obj.child_view_enabled_node_types.all()[:5]
        names = [t.node_type for t in types]
        suffix = "..." if obj.child_view_enabled_node_types.count() > 5 else ""
        return ", ".join(names) + suffix if names else _("None")


@admin.register(PipeBranchSettings)
class PipeBranchSettingsAdmin(admin.ModelAdmin):
    """Standalone admin for Pipe Branch Settings."""

    list_display = ("project", "allowed_count", "allowed_types_preview")
    list_filter = ("project",)
    search_fields = ("project__project",)
    filter_horizontal = ("allowed_node_types",)
    autocomplete_fields = ["project"]

    @admin.display(description=_("Allowed Count"))
    def allowed_count(self, obj):
        """Return the total number of allowed node types."""
        return obj.allowed_node_types.count()

    @admin.display(description=_("Allowed Types"))
    def allowed_types_preview(self, obj):
        """Return a comma-separated preview of allowed node types."""
        types = obj.allowed_node_types.all()[:5]
        names = [t.node_type for t in types]
        suffix = "..." if obj.allowed_node_types.count() > 5 else ""
        return ", ".join(names) + suffix if names else _("None")


@admin.register(Address)
class AddressAdmin(SimpleHistoryAdmin):
    """Admin for :model:`api.Address` postal address records."""

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
        "house_number_suffix",
        "zip_code",
        "city",
        "district",
        "status_development__status",
        "flag__flag",
        "project__project",
    )


@admin.register(ResidentialUnit)
class ResidentialUnitAdmin(SimpleHistoryAdmin):
    """Admin for :model:`api.ResidentialUnit` dwelling unit records."""

    list_display = (
        "uuid",
        "uuid_address",
        "floor",
        "side",
        "residential_unit_type",
        "status",
    )
    list_filter = ("residential_unit_type", "status")
    search_fields = ("id_residential_unit", "resident_name")
    ordering = ("uuid_address", "floor", "side")


class ConduitTypeColorMappingInline(admin.TabularInline):
    """Inline for conduit type color mappings within conduit type admin."""

    model = ConduitTypeColorMapping
    extra = 1
    fields = ("uuid", "position", "color")
    ordering = ("position",)


class CableTypeColorMappingInline(admin.TabularInline):
    """Inline for cable type fiber color mappings within cable type admin."""

    model = CableTypeColorMapping
    extra = 1
    fields = ("uuid", "position_type", "position", "color", "layer")
    ordering = ("position_type", "position")
    can_delete = True
    verbose_name = _("Fiber Color Mapping")
    verbose_name_plural = _("Fiber Color Mappings")


@admin.register(AttributesConduitType)
class AttributesConduitTypeAdmin(admin.ModelAdmin):
    """Admin for :model:`api.AttributesConduitType` with color mapping inlines."""

    list_display = ("id", "conduit_type", "conduit_count", "manufacturer")
    inlines = [ConduitTypeColorMappingInline]


@admin.register(AttributesCableType)
class AttributesCableTypeAdmin(admin.ModelAdmin):
    """Admin for :model:`api.AttributesCableType` with fiber color mapping inlines."""

    list_display = (
        "id",
        "cable_type",
        "fiber_count",
        "bundle_count",
        "bundle_fiber_count",
        "manufacturer",
    )
    inlines = [CableTypeColorMappingInline]


@admin.register(AttributesMicroductColor)
class AttributesMicroductColorAdmin(admin.ModelAdmin):
    """Admin for :model:`api.AttributesMicroductColor` color definitions."""

    list_display = (
        "id",
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
    """Admin for :model:`api.AttributesFiberColor` color definitions."""

    list_display = (
        "id",
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
    """Admin for :model:`api.StoragePreferences` file storage configuration."""

    list_display = ("mode", "__str__")
    formfield_overrides = {
        models.JSONField: {"widget": JSONEditorWidget(height="600px", width="90%")},
    }


class QGISProjectDataFileInline(admin.TabularInline):
    """Inline for uploading data files alongside a QGIS project."""

    model = QGISProjectDataFile
    extra = 1
    readonly_fields = ("original_filename", "uploaded_at")
    fields = ("data_file", "original_filename", "uploaded_at")

    def get_formset(self, request, obj=None, **kwargs):
        """Make data_file not required so existing rows can be deleted without re-uploading."""
        formset = super().get_formset(request, obj, **kwargs)
        formset.form.base_fields["data_file"].required = False
        return formset


@admin.register(QGISProject)
class QGISProjectAdmin(admin.ModelAdmin):
    """Admin for :model:`api.QGISProject` with WMS/WFS URL display and datasource conversion."""

    list_display = ("display_name", "name", "created_at", "created_by")
    list_filter = ("name", "created_at")
    search_fields = ("name", "display_name", "description")
    readonly_fields = (
        "created_at",
        "updated_at",
        "created_by",
        "get_wms_url",
        "get_wfs_url",
        "get_wfs3_url",
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
            _("Access URLs"),
            {
                "fields": ("get_wms_url", "get_wfs_url", "get_wfs3_url"),
                "description": _(
                    "Use these URLs to access the QGIS project via WMS/WFS/WFS3 services"
                ),
            },
        ),
        (
            _("Metadata"),
            {
                "fields": ("created_at", "updated_at", "created_by"),
                "classes": ("collapse",),
            },
        ),
    )
    actions = ["download_with_postgres_datasources"]
    inlines = [QGISProjectDataFileInline]

    def save_related(self, request, form, formsets, change):
        """Save inlines then convert datasources with uploaded data filenames.

        After saving related inlines, auto-populate ``original_filename``
        on newly created :model:`api.QGISProjectDataFile` records and
        trigger QGS XML datasource conversion with file-path rewriting.

        Args:
            request: The current HTTP request.
            form: The parent model form.
            formsets: List of inline formsets.
            change: Whether this is a change (True) or add (False).
        """
        super().save_related(request, form, formsets, change)

        obj = form.instance

        # Auto-populate original_filename on newly saved data files
        for data_file in obj.data_files.filter(original_filename=""):
            if data_file.data_file:
                data_file.original_filename = os.path.basename(data_file.data_file.name)
                data_file.save(update_fields=["original_filename"])

        if not obj.project_file:
            return

        data_filenames = list(
            obj.data_files.values_list("original_filename", flat=True)
        )

        try:
            from .services import (
                convert_qgs_to_postgres,
                handle_qgis_file,
                repackage_qgz,
            )

            file_content = obj.project_file.read()
            filename = os.path.basename(obj.project_file.name)

            qgs_content, is_qgz = handle_qgis_file(file_content, filename)
            converted_content = convert_qgs_to_postgres(
                qgs_content,
                data_filenames=data_filenames if data_filenames else None,
                project_name=obj.name if data_filenames else None,
            )

            if is_qgz:
                final_content = repackage_qgz(converted_content, file_content)
            else:
                final_content = converted_content

            # Overwrite the stored project file with converted content
            from django.core.files.base import ContentFile

            obj.project_file.save(
                os.path.basename(obj.project_file.name),
                ContentFile(final_content),
                save=False,
            )
            # Use update to avoid re-triggering save_model
            type(obj).objects.filter(pk=obj.pk).update(
                project_file=obj.project_file.name
            )

            from django.contrib import messages

            if data_filenames:
                messages.info(
                    request,
                    _("Datasources converted: %(count)s data file path(s) rewritten.")
                    % {"count": len(data_filenames)},
                )

        except Exception as e:
            from django.contrib import messages

            messages.error(
                request,
                _("Error converting project datasources: %(error)s")
                % {"error": str(e)},
            )

    def save_model(self, request, obj, form, change):
        """Set ``created_by`` to the current user on first save."""
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
        """Return the WMS access URL for display in admin."""
        if obj.project_file:
            return obj.get_wms_url()
        return "-"

    get_wms_url.short_description = _("WMS URL")

    def get_wfs_url(self, obj):
        """Return the WFS access URL for display in admin."""
        if obj.project_file:
            return obj.get_wfs_url()
        return "-"

    get_wfs_url.short_description = _("WFS URL")

    def get_wfs3_url(self, obj):
        """Return the WFS3 (OGC API Features) access URL for display in admin."""
        if obj.project_file:
            return obj.get_wfs3_url()
        return "-"

    get_wfs3_url.short_description = _("WFS3 URL (OGC API Features)")

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
class NodeAdmin(SimpleHistoryAdmin):
    """Admin for :model:`api.Node` network junction points."""

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
class ConduitAdmin(SimpleHistoryAdmin):
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


@admin.register(Trench)
class TrenchAdmin(SimpleHistoryAdmin):
    """Admin for :model:`api.Trench` linear excavation features."""

    list_display = (
        "id_trench",
        "surface",
        "construction_type",
        "status",
        "phase",
        "owner",
        "constructor",
        "project",
        "flag",
    )
    list_filter = (
        "surface",
        "construction_type",
        "status",
        "phase",
        "owner",
        "constructor",
        "project",
        "flag",
    )
    search_fields = (
        "id_trench",
        "construction_details",
        "comment",
        "project__project",
        "flag__flag",
    )
    actions = ["regenerate_trench_ids"]

    @admin.action(description=_("Regenerate IDs for trenches with old format"))
    def regenerate_trench_ids(self, request, queryset):
        """
        Regenerate id_trench for selected trenches that don't match the TR-XXXXXXX format.
        Uses the same fn_generate_trench_id function as the trigger.
        """
        import re

        from django.db import connection

        id_pattern = re.compile(r"^TR-[ABCDEFGHJKLMNPQRSTUVWXYZ234567]{7}$")
        regenerated_count = 0
        skipped_count = 0

        with connection.cursor() as cursor:
            for trench in queryset:
                if id_pattern.match(trench.id_trench or ""):
                    skipped_count += 1
                    continue

                cursor.execute(
                    "SELECT fn_generate_trench_id(%s)",
                    [trench.project_id],
                )
                new_id = cursor.fetchone()[0]

                trench.id_trench = new_id
                trench.save(update_fields=["id_trench"])
                regenerated_count += 1

        self.message_user(
            request,
            _(
                "Regenerated IDs for %(regenerated)d trench(es). "
                "Skipped %(skipped)d (already have correct format)."
            )
            % {
                "regenerated": regenerated_count,
                "skipped": skipped_count,
            },
        )


class WFSErrorFilter(admin.SimpleListFilter):
    """Filter for WFS-related errors in LogEntry."""

    title = _("WFS Errors")
    parameter_name = "wfs_errors"

    def lookups(self, request, model_admin):
        """Return filter choices for WFS log categories."""
        return (
            ("wfs_all", _("All WFS logs")),
            ("wfs_errors", _("WFS errors only")),
            ("wfs_node", _("Node errors")),
            ("wfs_address", _("Address errors")),
            ("wfs_trench", _("Trench errors")),
        )

    def queryset(self, request, queryset):
        """Filter the queryset by the selected WFS error category."""
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
    list_per_page = 100
    actions = ["bulk_delete_selected", "delete_all_filtered"]
    show_full_result_count = False

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

    def get_actions(self, request):
        """Replace default delete with efficient bulk delete."""
        actions = super().get_actions(request)
        if "delete_selected" in actions:
            del actions["delete_selected"]
        return actions

    def has_add_permission(self, request):
        """Disable adding log entries manually."""
        return False

    def has_change_permission(self, request, obj=None):
        """Disable editing log entries."""
        return False

    @admin.action(description=_("Delete selected log entries"))
    def bulk_delete_selected(self, request, queryset):
        """Delete selected log entries using efficient bulk queryset deletion."""
        count = queryset.count()
        queryset.delete()
        messages.success(
            request,
            _("Successfully deleted %(count)d log entry/entries.") % {"count": count},
        )

    @admin.action(description=_("Delete ALL log entries matching current filters"))
    def delete_all_filtered(self, request, queryset):
        """Delete all log entries matching the current filter, ignoring selection.

        When triggered, this rebuilds the filtered queryset from the request
        parameters so it deletes ALL matching entries, not just the selected page.
        """
        cl = self.get_changelist_instance(request)
        full_queryset = cl.queryset

        count = full_queryset.count()
        full_queryset.delete()
        messages.success(
            request,
            _("Successfully deleted all %(count)d filtered log entry/entries.")
            % {"count": count},
        )

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
        """Return filter choices for orphaned vs valid files."""
        self._model_admin = model_admin
        return (
            ("orphaned", _("Orphaned files only")),
            ("valid", _("Valid files only")),
        )

    def queryset(self, request, queryset):
        """Filter the queryset to orphaned or valid files based on selection."""
        if self.value() == "orphaned":
            return self._model_admin.get_orphaned_files(queryset)
        elif self.value() == "valid":
            orphaned_ids = self._model_admin.get_orphaned_files(queryset).values_list(
                "uuid", flat=True
            )
            return queryset.exclude(uuid__in=orphaned_ids)
        return queryset


FEATURE_PROJECT_FIELD: dict = {
    "trench": "project",
    "conduit": "project",
    "cable": "project",
    "node": "project",
    "address": "project",
    "residentialunit": "uuid_address__project",
    "area": "project",
}
"""Map content-type model names to their project lookup path."""


class ProjectFilter(admin.SimpleListFilter):
    """Filter FeatureFiles by the project of their linked feature."""

    title = _("Project")
    parameter_name = "project"

    def lookups(self, request, model_admin):
        """Return all projects as filter choices."""
        return [(p.id, p.project) for p in Projects.objects.all().order_by("project")]

    def queryset(self, request, queryset):
        """Filter files whose linked feature belongs to the selected project."""
        if self.value() is None:
            return queryset

        project_id = int(self.value())
        matching_uuids = []

        for model_name, model_class in FEATURE_MODEL_MAP.items():
            project_field = FEATURE_PROJECT_FIELD.get(model_name)
            if not project_field:
                continue

            try:
                content_type = ContentType.objects.get(
                    app_label="api", model=model_name
                )
            except ContentType.DoesNotExist:
                continue

            feature_uuids = set(
                model_class.objects.filter(**{project_field: project_id}).values_list(
                    "uuid", flat=True
                )
            )
            file_uuids = queryset.filter(
                content_type=content_type, object_id__in=feature_uuids
            ).values_list("uuid", flat=True)
            matching_uuids.extend(file_uuids)

        return queryset.filter(uuid__in=matching_uuids)


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
            ("residentialunit", _("Residential Unit")),
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
        "preview_link",
        "feature_type_display",
        "feature_identifier_display",
        "orphan_status_display",
        "created_at",
    )
    list_filter = (
        OrphanedFilesFilter,
        ProjectFilter,
        "content_type",
        "file_type",
        "created_at",
    )
    search_fields = ("file_name", "file_path", "description")
    readonly_fields = (
        "uuid",
        "file_name",
        "file_type",
        "created_at",
        "file_path",
        "preview_link",
        "content_type",
        "object_id",
    )
    ordering = ("-created_at",)
    actions = ["delete_orphaned_files", "move_to_feature"]

    def get_queryset(self, request):
        """Annotate queryset with ``_is_orphaned`` flag for sorting and display."""
        queryset = super().get_queryset(request)
        orphaned_conditions = []

        for model_name, model_class in FEATURE_MODEL_MAP.items():
            try:
                content_type = ContentType.objects.get(
                    app_label="api", model=model_name
                )
            except ContentType.DoesNotExist:
                continue

            feature_exists = Exists(
                model_class.objects.filter(uuid=OuterRef("object_id"))
            )
            orphaned_conditions.append(
                When(Q(content_type=content_type) & ~feature_exists, then=Value(1))
            )

        unknown_content_types = ContentType.objects.filter(app_label="api").exclude(
            model__in=FEATURE_MODEL_MAP.keys()
        )
        if unknown_content_types.exists():
            orphaned_conditions.append(
                When(content_type__in=unknown_content_types, then=Value(1))
            )

        queryset = queryset.annotate(
            _is_orphaned=Case(
                *orphaned_conditions, default=Value(0), output_field=IntegerField()
            )
        )

        return queryset

    def get_urls(self):
        """Register custom URL for the move-files form view."""
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
        """Return a queryset of FeatureFiles whose linked feature no longer exists.

        Args:
            queryset: Optional base queryset to filter. Defaults to all FeatureFiles.

        Returns:
            QuerySet[FeatureFiles]: Only the orphaned file records.
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

    def is_orphaned(self, obj) -> bool:
        """Check whether the linked feature for a FeatureFiles instance still exists."""
        model_class = FEATURE_MODEL_MAP.get(obj.content_type.model)
        if not model_class:
            return True
        return not model_class.objects.filter(uuid=obj.object_id).exists()

    @admin.display(description=_("Preview"))
    def preview_link(self, obj):
        """Return a clickable link or inline image preview via the API endpoint."""
        url = reverse("feature-files-preview", kwargs={"pk": obj.uuid})
        image_types = ("jpg", "jpeg", "png", "gif", "bmp", "webp", "svg")
        if obj.file_type and obj.file_type.lower() in image_types:
            return format_html(
                '<a href="{url}" target="_blank">'
                '<img src="{url}" style="max-height:200px; max-width:300px;" />'
                "</a>",
                url=url,
            )
        return format_html('<a href="{}" target="_blank">Preview</a>', url)

    @admin.display(description=_("Feature Type"))
    def feature_type_display(self, obj):
        """Return the content type model name in title case."""
        return obj.content_type.model.title()

    @admin.display(description=_("Feature Identifier"))
    def feature_identifier_display(self, obj):
        """Return the feature identifier, or a 'deleted' label if orphaned."""
        if self.is_orphaned(obj):
            return format_html(
                '<span style="color: #999; font-style: italic;">{} ({})</span>',
                _("Feature deleted"),
                str(obj.object_id)[:8] + "...",
            )
        return FeatureFiles.get_feature_identifier(obj)

    @admin.display(description=_("Status"), ordering="_is_orphaned")
    def orphan_status_display(self, obj):
        """Return a color-coded orphan/valid status badge."""
        is_orphaned = getattr(obj, "_is_orphaned", None)
        if is_orphaned is None:
            is_orphaned = 1 if self.is_orphaned(obj) else 0

        if is_orphaned:
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
        """Delete orphaned files from storage and remove their database entries.

        Skip files that still have a valid linked feature.
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
        """Render and process the form for moving files to another feature."""
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


@admin.register(ContainerType)
class ContainerTypeAdmin(SimpleHistoryAdmin):
    """Admin interface for managing container types (global definitions)."""

    list_display = ("name", "display_order", "is_active")
    list_filter = ("is_active",)
    list_editable = ("display_order", "is_active")
    search_fields = ("name", "description")
    ordering = ("display_order", "name")

    fieldsets = (
        (None, {"fields": ("name", "description")}),
        (
            _("Display Settings"),
            {"fields": ("icon", "color", "display_order", "is_active")},
        ),
    )

    def color_preview(self, obj):
        """Display color swatch in admin list."""
        if obj.color:
            return format_html(
                '<span style="background-color: {}; padding: 2px 10px; '
                'border-radius: 3px;">&nbsp;</span> {}',
                obj.color,
                obj.color,
            )
        return "-"

    color_preview.short_description = _("Color")


class WMSLayerInline(admin.TabularInline):
    """Inline admin for WMS layers."""

    model = WMSLayer
    extra = 0
    readonly_fields = ["name", "title"]
    fields = [
        "name",
        "title",
        "is_enabled",
        "sort_order",
        "min_zoom",
        "max_zoom",
        "opacity",
    ]
    ordering = ["sort_order", "name"]


class WMSSourceAdminForm(forms.ModelForm):
    """Custom form for WMSSource admin with password field."""

    password = forms.CharField(
        widget=forms.PasswordInput(render_value=True),
        required=False,
        label=_("Password"),
        help_text=_(
            "Password for authenticated WMS services. Leave blank if not required."
        ),
    )

    class Meta:
        model = WMSSource
        fields = [
            "project",
            "name",
            "url",
            "username",
            "password",
            "sort_order",
            "is_active",
        ]

    def __init__(self, *args, **kwargs):
        """Pre-populate the password placeholder when editing an existing source."""
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk and self.instance._password:
            self.fields["password"].widget.attrs["placeholder"] = "••••••••"

    def save(self, commit=True):
        """Save the form and set the encrypted password if provided."""
        instance = super().save(commit=False)
        password = self.cleaned_data.get("password")
        if password:
            instance.password = password
        if commit:
            instance.save()
        return instance


@admin.register(WMSSource)
class WMSSourceAdmin(admin.ModelAdmin):
    """Admin for WMS sources."""

    form = WMSSourceAdminForm
    list_display = [
        "id",
        "name",
        "project",
        "url",
        "is_active",
        "layer_count",
        "sort_order",
    ]
    list_filter = ["project", "is_active"]
    search_fields = ["name", "url"]
    ordering = ["project", "sort_order", "name"]
    inlines = [WMSLayerInline]
    actions = ["scan_capabilities"]

    fieldsets = (
        (
            None,
            {
                "fields": ("project", "name", "url", "sort_order", "is_active"),
            },
        ),
        (
            _("Authentication"),
            {
                "fields": ("username", "password"),
                "classes": ("collapse",),
            },
        ),
        (
            _("PDF Export"),
            {
                "fields": ("attribution",),
                "description": _(
                    "Attribution text is required for including this WMS in PDF exports. "
                    "Check the WMS provider's license for required attribution."
                ),
            },
        ),
    )

    def layer_count(self, obj):
        """Return the number of enabled WMS layers for this source."""
        return obj.layers.filter(is_enabled=True).count()

    layer_count.short_description = _("Enabled Layers")

    def save_model(self, request, obj, form, change):
        """Auto-fetch WMS layers when a new source is created or its URL changes."""
        super().save_model(request, obj, form, change)

        if not change or "url" in form.changed_data:
            try:
                layers_data = fetch_wms_layers(
                    obj.url,
                    username=obj.username or None,
                    password=obj.password or None,
                )
                for i, layer_data in enumerate(layers_data):
                    WMSLayer.objects.update_or_create(
                        source=obj,
                        name=layer_data["name"],
                        defaults={
                            "title": layer_data["title"],
                            "sort_order": i,
                        },
                    )
                messages.success(
                    request, _("Fetched %d layers from WMS.") % len(layers_data)
                )
            except WMSServiceError as e:
                messages.error(request, _("Failed to fetch WMS layers: %s") % e)

    def scan_capabilities(self, request, queryset):
        """Scan WMS capabilities and apply recommended min_zoom settings to layers."""
        for source in queryset:
            try:
                result = scan_wms_capabilities(
                    source.url,
                    username=source.username or None,
                    password=source.password or None,
                )
                layers_info = result.get("layers", [])
                updated_count = 0
                for layer_info in layers_info:
                    try:
                        layer = source.layers.get(name=layer_info["name"])
                        recommended_zoom = layer_info.get("recommended_min_zoom", 8)
                        if layer.min_zoom != recommended_zoom:
                            layer.min_zoom = recommended_zoom
                            layer.save(update_fields=["min_zoom"])
                            updated_count += 1
                    except WMSLayer.DoesNotExist:
                        continue

                if updated_count > 0:
                    messages.success(
                        request,
                        _("Updated min_zoom for %(count)d layers in '%(source)s'.")
                        % {
                            "count": updated_count,
                            "source": source.name,
                        },
                    )
                else:
                    messages.info(
                        request,
                        _(
                            "No changes needed for '%(source)s'. All layers already have recommended settings."
                        )
                        % {
                            "source": source.name,
                        },
                    )

            except WMSServiceError as e:
                messages.error(
                    request,
                    _("Failed to scan '%(source)s': %(error)s")
                    % {
                        "source": source.name,
                        "error": str(e),
                    },
                )

    scan_capabilities.short_description = _("Scan & apply recommended settings")


@admin.register(ModelPermission)
class ModelPermissionAdmin(admin.ModelAdmin):
    """Admin for :model:`api.ModelPermission` group-level model access control."""

    list_display = ["group", "model_name", "access_level"]
    list_filter = ["group", "access_level", "model_name"]
    list_editable = ["access_level"]
    search_fields = ["model_name", "group__name"]
    ordering = ["group__name", "model_name"]
    list_per_page = 50


@admin.register(RoutePermission)
class RoutePermissionAdmin(admin.ModelAdmin):
    """Admin for :model:`api.RoutePermission` group-level route access control."""

    list_display = ["group", "route_pattern", "allowed"]
    list_filter = ["group", "allowed"]
    list_editable = ["allowed"]
    search_fields = ["route_pattern", "group__name"]
    ordering = ["group__name", "route_pattern"]
