"""Tests for Django admin actions that create or repair data."""

from unittest.mock import patch

import pytest
from apps.api.admin import CableAdmin
from apps.api.models import Cable, Fiber, fiber_layout
from django.contrib.admin.sites import AdminSite
from django.test import RequestFactory

from .factories import (
    CableTypeColorMappingFactory,
    CableTypeFactory,
    FiberColorFactory,
    FlagFactory,
    ProjectFactory,
)

FIBER_FIELDS = (
    "bundle_number",
    "bundle_color",
    "fiber_number_absolute",
    "fiber_number_in_bundle",
    "fiber_color",
    "layer",
)


def make_cable_type(
    bundles: int, fibers_per_bundle: int, mapped_fibers: int | None = None
):
    """Create a cable type with bundle and fiber color mappings.

    Args:
        bundles: Number of bundles of the type.
        fibers_per_bundle: Fibers in each bundle.
        mapped_fibers: Fiber positions that get a mapping; defaults to all.

    Returns:
        AttributesCableType: The cable type.
    """
    cable_type = CableTypeFactory(
        fiber_count=bundles * fibers_per_bundle,
        bundle_count=bundles,
        bundle_fiber_count=fibers_per_bundle,
    )
    colors = [FiberColorFactory() for _ in range(max(bundles, fibers_per_bundle))]
    for position in range(1, bundles + 1):
        CableTypeColorMappingFactory(
            cable_type=cable_type,
            position_type="bundle",
            position=position,
            color=colors[position - 1],
        )
    for position in range(1, (mapped_fibers or fibers_per_bundle) + 1):
        CableTypeColorMappingFactory(
            cable_type=cable_type,
            position_type="fiber",
            position=position,
            color=colors[position - 1],
            layer="outer" if position == 1 else "inner",
        )
    return cable_type


def fiber_rows(cable) -> list[tuple]:
    """Return the layout-relevant fields of a cable's fibers, in order."""
    return list(
        Fiber.objects.filter(uuid_cable=cable)
        .order_by("fiber_number_absolute")
        .values_list(*FIBER_FIELDS)
    )


def run_action(queryset) -> str:
    """Run the admin action on ``queryset`` and return the message it shows."""
    admin = CableAdmin(Cable, AdminSite())
    request = RequestFactory().post("/admin/api/cable/")
    with patch.object(CableAdmin, "message_user") as message_user:
        admin.create_fibers_for_empty_cables(request, queryset)
    return message_user.call_args.args[1]


@pytest.mark.django_db
class TestCreateFibersForEmptyCables:
    """Tests for the CableAdmin action that fills cables without fibers."""

    def test_creates_the_same_fibers_as_the_signal(self):
        """Verify the action rebuilds exactly what the post_save signal created."""
        cable = Cable.objects.create(
            name="Admin Fiber Cable",
            cable_type=make_cable_type(bundles=2, fibers_per_bundle=3),
            project=ProjectFactory(),
            flag=FlagFactory(),
        )
        from_signal = fiber_rows(cable)
        Fiber.objects.filter(uuid_cable=cable).delete()

        run_action(Cable.objects.filter(pk=cable.pk))

        assert len(from_signal) == 6
        assert fiber_rows(cable) == from_signal
        assert {row[-1] for row in from_signal} == {"inner", "outer"}

    def test_skips_cables_that_already_have_fibers(self):
        """Verify a cable with fibers is left untouched."""
        cable = Cable.objects.create(
            name="Full Cable",
            cable_type=make_cable_type(bundles=1, fibers_per_bundle=4),
            project=ProjectFactory(),
            flag=FlagFactory(),
        )

        message = run_action(Cable.objects.filter(pk=cable.pk))

        assert Fiber.objects.filter(uuid_cable=cable).count() == 4
        assert "Created fibers for 0 cable(s)" in message

    def test_skips_cables_with_incomplete_mappings(self):
        """Verify a type whose fiber mappings do not cover a bundle creates nothing."""
        cable_type = make_cable_type(bundles=1, fibers_per_bundle=4, mapped_fibers=2)
        cable = Cable.objects.create(
            name="Unmapped Cable",
            cable_type=cable_type,
            project=ProjectFactory(),
            flag=FlagFactory(),
        )

        message = run_action(Cable.objects.filter(pk=cable.pk))

        assert fiber_layout(cable_type) == []
        assert not Fiber.objects.filter(uuid_cable=cable).exists()
        assert "1 (no type or incomplete color mappings)" in message
