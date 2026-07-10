"""Tests for automatic cable-micropipe linking via node addresses.

Covers the service layer (auto_link_cable_micropipes,
link_cable_to_chosen_microduct, bulk_auto_link_micropipes_for_nodes)
and the NodeAdmin bulk action.
"""

import pytest
from apps.api.models import MicroductCableConnection
from apps.api.services import (
    auto_link_cable_micropipes,
    link_cable_to_chosen_microduct,
)
from apps.api.tests.factories import (
    AddressFactory,
    CableFactory,
    ConduitFactory,
    MicroductCableConnectionFactory,
    MicroductColorFactory,
    MicroductFactory,
    NodeFactory,
)


def result_for_end(results, end):
    """Return the per-end result dict for 'start' or 'end'."""
    return next(r for r in results if r["end"] == end)


@pytest.mark.django_db
class TestAutoLinkCableMicropipes:
    """Tests for auto_link_cable_micropipes(cable)."""

    def test_single_candidate_creates_connection_and_reports_linked(self):
        address = AddressFactory()
        node = NodeFactory(uuid_address=address)
        microduct = MicroductFactory(uuid_node=node)
        cable = CableFactory(uuid_node_start=node)

        results = auto_link_cable_micropipes(cable)

        start = result_for_end(results, "start")
        assert start["status"] == "linked"
        assert start["microduct"]["microduct_uuid"] == str(microduct.uuid)
        assert MicroductCableConnection.objects.filter(
            uuid_microduct=microduct, uuid_cable=cable
        ).exists()

    def test_no_address_on_node_reports_no_address_and_creates_nothing(self):
        node = NodeFactory(uuid_address=None)
        cable = CableFactory(uuid_node_start=node)

        results = auto_link_cable_micropipes(cable)

        assert result_for_end(results, "start")["status"] == "no_address"
        assert MicroductCableConnection.objects.count() == 0

    def test_missing_end_node_reports_no_node(self):
        cable = CableFactory(uuid_node_start=None, uuid_node_end=None)

        results = auto_link_cable_micropipes(cable)

        assert result_for_end(results, "start")["status"] == "no_node"
        assert result_for_end(results, "end")["status"] == "no_node"

    def test_no_candidates_reports_no_candidates(self):
        address = AddressFactory()
        node = NodeFactory(uuid_address=address)
        cable = CableFactory(uuid_node_start=node)

        results = auto_link_cable_micropipes(cable)

        assert result_for_end(results, "start")["status"] == "no_candidates"
        assert MicroductCableConnection.objects.count() == 0

    def test_multiple_candidates_reports_candidates_without_linking(self):
        address = AddressFactory()
        node = NodeFactory(uuid_address=address)
        other_node = NodeFactory(uuid_address=address)
        microduct_a = MicroductFactory(uuid_node=node)
        microduct_b = MicroductFactory(uuid_node=other_node)
        cable = CableFactory(uuid_node_start=node)

        results = auto_link_cable_micropipes(cable)

        start = result_for_end(results, "start")
        assert start["status"] == "multiple_candidates"
        assert start["microduct"] is None
        candidate_uuids = {c["microduct_uuid"] for c in start["candidates"]}
        assert candidate_uuids == {str(microduct_a.uuid), str(microduct_b.uuid)}
        assert MicroductCableConnection.objects.count() == 0

    def test_candidate_already_linked_reports_already_linked(self):
        address = AddressFactory()
        node = NodeFactory(uuid_address=address)
        microduct = MicroductFactory(uuid_node=node)
        cable = CableFactory(uuid_node_start=node)
        MicroductCableConnectionFactory(uuid_microduct=microduct, uuid_cable=cable)

        results = auto_link_cable_micropipes(cable)

        start = result_for_end(results, "start")
        assert start["status"] == "already_linked"
        assert start["microduct"]["microduct_uuid"] == str(microduct.uuid)
        assert MicroductCableConnection.objects.count() == 1

    def test_multiple_candidates_with_one_already_linked_reports_already_linked(self):
        address = AddressFactory()
        node = NodeFactory(uuid_address=address)
        linked_microduct = MicroductFactory(uuid_node=node)
        MicroductFactory(uuid_node=node)
        cable = CableFactory(uuid_node_start=node)
        MicroductCableConnectionFactory(
            uuid_microduct=linked_microduct, uuid_cable=cable
        )

        results = auto_link_cable_micropipes(cable)

        start = result_for_end(results, "start")
        assert start["status"] == "already_linked"
        assert MicroductCableConnection.objects.count() == 1

    def test_both_ends_with_addresses_link_independently(self):
        address_start = AddressFactory()
        address_end = AddressFactory()
        node_start = NodeFactory(uuid_address=address_start)
        node_end = NodeFactory(uuid_address=address_end)
        microduct_start = MicroductFactory(uuid_node=node_start)
        microduct_end = MicroductFactory(uuid_node=node_end)
        cable = CableFactory(uuid_node_start=node_start, uuid_node_end=node_end)

        results = auto_link_cable_micropipes(cable)

        assert result_for_end(results, "start")["status"] == "linked"
        assert result_for_end(results, "end")["status"] == "linked"
        linked_microducts = set(
            MicroductCableConnection.objects.filter(uuid_cable=cable).values_list(
                "uuid_microduct", flat=True
            )
        )
        assert linked_microducts == {microduct_start.uuid, microduct_end.uuid}

    def test_rerun_is_idempotent(self):
        address = AddressFactory()
        node = NodeFactory(uuid_address=address)
        MicroductFactory(uuid_node=node)
        cable = CableFactory(uuid_node_start=node)

        first = auto_link_cable_micropipes(cable)
        second = auto_link_cable_micropipes(cable)

        assert result_for_end(first, "start")["status"] == "linked"
        assert result_for_end(second, "start")["status"] == "already_linked"
        assert MicroductCableConnection.objects.count() == 1

    def test_candidate_payload_contains_context_fields(self):
        MicroductColorFactory(name_de="blau", hex_code="#0000ff")
        address = AddressFactory()
        node = NodeFactory(uuid_address=address, name="HA-Test")
        other_node = NodeFactory(uuid_address=address)
        conduit = ConduitFactory()
        microduct = MicroductFactory(
            uuid_node=node, uuid_conduit=conduit, number=3, color="blau"
        )
        MicroductFactory(uuid_node=other_node, color="unknown-color")
        other_cable = CableFactory()
        MicroductCableConnectionFactory(
            uuid_microduct=microduct, uuid_cable=other_cable
        )
        cable = CableFactory(uuid_node_start=node)

        results = auto_link_cable_micropipes(cable)

        start = result_for_end(results, "start")
        assert start["status"] == "multiple_candidates"
        assert start["address"] == str(address)
        assert start["node_name"] == "HA-Test"
        by_uuid = {c["microduct_uuid"]: c for c in start["candidates"]}
        candidate = by_uuid[str(microduct.uuid)]
        assert candidate["number"] == 3
        assert candidate["color"] == "blau"
        assert candidate["color_hex"] == "#0000ff"
        assert candidate["conduit_uuid"] == str(conduit.uuid)
        assert candidate["conduit_name"] == conduit.name
        assert "trench_ids" not in candidate
        assert candidate["linked_cables"] == [
            {"uuid": str(other_cable.uuid), "name": other_cable.name}
        ]
        unknown_color_candidate = by_uuid[
            next(u for u in by_uuid if u != str(microduct.uuid))
        ]
        assert unknown_color_candidate["color_hex"] == "#808080"


@pytest.mark.django_db
class TestLinkCableToChosenMicroduct:
    """Tests for link_cable_to_chosen_microduct(cable, microduct)."""

    def test_links_chosen_candidate(self):
        address = AddressFactory()
        node = NodeFactory(uuid_address=address)
        microduct = MicroductFactory(uuid_node=node)
        MicroductFactory(uuid_node=node)
        cable = CableFactory(uuid_node_start=node)

        result = link_cable_to_chosen_microduct(cable, microduct)

        assert result["status"] == "linked"
        assert result["microduct"]["microduct_uuid"] == str(microduct.uuid)
        assert MicroductCableConnection.objects.filter(
            uuid_microduct=microduct, uuid_cable=cable
        ).exists()

    def test_already_linked_chosen_candidate(self):
        address = AddressFactory()
        node = NodeFactory(uuid_address=address)
        microduct = MicroductFactory(uuid_node=node)
        cable = CableFactory(uuid_node_start=node)
        MicroductCableConnectionFactory(uuid_microduct=microduct, uuid_cable=cable)

        result = link_cable_to_chosen_microduct(cable, microduct)

        assert result["status"] == "already_linked"
        assert MicroductCableConnection.objects.count() == 1

    def test_non_candidate_microduct_raises_value_error(self):
        address = AddressFactory()
        node = NodeFactory(uuid_address=address)
        unrelated_node = NodeFactory(uuid_address=AddressFactory())
        microduct = MicroductFactory(uuid_node=unrelated_node)
        cable = CableFactory(uuid_node_start=node)

        with pytest.raises(ValueError):
            link_cable_to_chosen_microduct(cable, microduct)

        assert MicroductCableConnection.objects.count() == 0


@pytest.mark.django_db
class TestNodeAdminAutoLinkAction:
    """Tests for the NodeAdmin auto_link_micropipes_for_cables action."""

    def make_admin(self):
        """Build a NodeAdmin instance with a mocked message_user."""
        from unittest.mock import MagicMock

        from apps.api.admin import NodeAdmin
        from apps.api.models import Node
        from django.contrib.admin.sites import AdminSite

        admin_instance = NodeAdmin(Node, AdminSite())
        admin_instance.message_user = MagicMock()
        return admin_instance

    def make_request(self):
        """Build a bare POST request for the admin action."""
        from django.test import RequestFactory

        return RequestFactory().post("/")

    def test_admin_action_links_unambiguous_ends_and_reports_counts(self):
        from apps.api.models import Node

        address = AddressFactory()
        node = NodeFactory(uuid_address=address)
        microduct = MicroductFactory(uuid_node=node)
        cable = CableFactory(uuid_node_start=NodeFactory(), uuid_node_end=node)

        admin_instance = self.make_admin()
        admin_instance.auto_link_micropipes_for_cables(
            self.make_request(), Node.objects.filter(pk=node.pk)
        )

        assert MicroductCableConnection.objects.filter(
            uuid_microduct=microduct, uuid_cable=cable
        ).exists()
        admin_instance.message_user.assert_called_once()
        message = str(admin_instance.message_user.call_args.args[1])
        assert "1" in message

    def test_admin_action_skips_ambiguous_ends(self):
        from apps.api.models import Node

        address = AddressFactory()
        node = NodeFactory(uuid_address=address)
        MicroductFactory(uuid_node=node)
        MicroductFactory(uuid_node=NodeFactory(uuid_address=address))
        CableFactory(uuid_node_start=node)

        admin_instance = self.make_admin()
        admin_instance.auto_link_micropipes_for_cables(
            self.make_request(), Node.objects.filter(pk=node.pk)
        )

        assert MicroductCableConnection.objects.count() == 0
        message = str(admin_instance.message_user.call_args.args[1])
        assert "skipped" in message.lower() or "1" in message

    def test_admin_action_rerun_reports_already_linked(self):
        from apps.api.models import Node

        address = AddressFactory()
        node = NodeFactory(uuid_address=address)
        MicroductFactory(uuid_node=node)
        CableFactory(uuid_node_start=node)

        admin_instance = self.make_admin()
        queryset = Node.objects.filter(pk=node.pk)
        admin_instance.auto_link_micropipes_for_cables(self.make_request(), queryset)
        admin_instance.auto_link_micropipes_for_cables(self.make_request(), queryset)

        assert MicroductCableConnection.objects.count() == 1
        second_message = str(admin_instance.message_user.call_args.args[1])
        assert "already" in second_message.lower()


@pytest.mark.django_db
class TestDefectiveMicroductExclusion:
    """Defective microducts (status set) must not participate in auto-linking."""

    def test_defective_microduct_is_not_a_candidate(self):
        from apps.api.tests.factories import MicroductStatusFactory

        address = AddressFactory()
        node = NodeFactory(uuid_address=address)
        MicroductFactory(uuid_node=node, microduct_status=MicroductStatusFactory())
        intact = MicroductFactory(uuid_node=node)
        cable = CableFactory(uuid_node_start=node)

        results = auto_link_cable_micropipes(cable)

        start = result_for_end(results, "start")
        assert start["status"] == "linked"
        assert start["microduct"]["microduct_uuid"] == str(intact.uuid)
        assert MicroductCableConnection.objects.filter(
            uuid_microduct=intact, uuid_cable=cable
        ).exists()
        assert MicroductCableConnection.objects.count() == 1

    def test_all_candidates_defective_reports_no_candidates(self):
        from apps.api.tests.factories import MicroductStatusFactory

        address = AddressFactory()
        node = NodeFactory(uuid_address=address)
        MicroductFactory(uuid_node=node, microduct_status=MicroductStatusFactory())
        cable = CableFactory(uuid_node_start=node)

        results = auto_link_cable_micropipes(cable)

        assert result_for_end(results, "start")["status"] == "no_candidates"
        assert MicroductCableConnection.objects.count() == 0

    def test_chosen_defective_microduct_raises_value_error(self):
        from apps.api.tests.factories import MicroductStatusFactory

        address = AddressFactory()
        node = NodeFactory(uuid_address=address)
        defective = MicroductFactory(
            uuid_node=node, microduct_status=MicroductStatusFactory()
        )
        cable = CableFactory(uuid_node_start=node)

        with pytest.raises(ValueError):
            link_cable_to_chosen_microduct(cable, defective)

        assert MicroductCableConnection.objects.count() == 0
