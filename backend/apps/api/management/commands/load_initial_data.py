"""
Management command to load initial fixture data idempotently.

This command checks if data already exists before loading fixtures,
preventing IntegrityError on container restarts.
"""

from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.apps import apps


class Command(BaseCommand):
    help = "Load initial fixture data (skips if data already exists)"

    # Fixture groups with their fixtures and a model to check for existing data
    # Format: (check_model_name, [fixture_names])
    FIXTURE_GROUPS = [
        # Group 1: Basic company and construction attributes
        (
            "AttributesCompany",
            [
                "attributes_company",
                "attributes_construction_type",
                "attributes_conduit_type",
                "attributes_phase",
            ],
        ),
        # Group 2: Status, surface, storage, file types, projects, flags
        (
            "AttributesStatus",
            [
                "attributes_status",
                "attributes_surface",
                "storage_preference",
                "file_type_categories",
                "projects",
                "flags",
            ],
        ),
        # Group 3: Network and node attributes
        (
            "AttributesNetworkLevel",
            [
                "attributes_network_level",
                "attributes_node_type",
                "attributes_status_development",
                "attributes_area_types",
            ],
        ),
        # Group 4: Pipe branch, network schema, fiber/microduct status
        (
            "PipeBranchSettings",
            [
                "pipe_branch_settings",
                "network_schema_settings",
                "attributes_fiber_status",
                "attributes_microduct_status",
            ],
        ),
        # Group 5: Color mappings (these have unique constraints!)
        (
            "AttributesMicroductColor",
            [
                "attributes_microduct_color",
                "attributes_cable_type",
                "attributes_fiber_color",
                "conduit_type_color_mapping",
                "cable_type_color_mapping",
            ],
        ),
        # Group 6: Component and residential unit attributes
        (
            "AttributesComponentType",
            [
                "attributes_component_type",
                "attributes_component_structure",
                "attributes_residential_unit_type",
                "attributes_residential_unit_status",
            ],
        ),
    ]

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Force reload all fixtures (may cause errors if data exists)",
        )

    def handle(self, *args, **options):
        force = options.get("force", False)

        for check_model_name, fixtures in self.FIXTURE_GROUPS:
            try:
                model = apps.get_model("api", check_model_name)
            except LookupError:
                self.stderr.write(
                    self.style.WARNING(f"Model {check_model_name} not found, skipping group")
                )
                continue

            if not force and model.objects.exists():
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Skipping {', '.join(fixtures)} (data already exists in {check_model_name})"
                    )
                )
                continue

            self.stdout.write(f"Loading fixtures: {', '.join(fixtures)}")
            try:
                call_command("loaddata", *fixtures, verbosity=0)
                self.stdout.write(
                    self.style.SUCCESS(f"Loaded: {', '.join(fixtures)}")
                )
            except Exception as e:
                self.stderr.write(
                    self.style.ERROR(f"Failed to load {', '.join(fixtures)}: {e}")
                )
                raise

        self.stdout.write(self.style.SUCCESS("Initial data loading complete"))
