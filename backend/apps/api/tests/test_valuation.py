"""Tests for the Wertermittlung (valuation) calculation service."""

import pytest
from django.contrib.gis.geos import LineString, Point
from rest_framework.test import APIClient

from apps.api.models import ValuationCostRate
from apps.api.services import calculate_valuation

from .factories import (
    AreaFactory,
    NodeFactory,
    NodeTypeFactory,
    ProjectFactory,
    TrenchFactory,
    ValuationCostRateFactory,
)

# A 100 x 100 metre square area in SRID 25832.
AREA_WKT = "POLYGON((0 0, 100 0, 100 100, 0 100, 0 0))"


def _row(result, name):
    """Return the result row for a given cost-rate name."""
    return next(r for r in result["categories"] if r["name"] == name)


@pytest.mark.django_db
class TestCalculateValuation:
    """Tests for calculate_valuation."""

    def test_node_count_multiplies_rate_within_area(self):
        """A per-piece row counts nodes of its types inside the area."""
        project = ProjectFactory()
        pop_type = NodeTypeFactory()
        ValuationCostRateFactory(
            project=project,
            name="POP",
            amount=100000,
            unit=ValuationCostRate.Unit.PER_PIECE,
            node_types=[pop_type],
        )
        area = AreaFactory(project=project, geom=AREA_WKT)

        # Two POP nodes inside, one outside.
        NodeFactory(project=project, node_type=pop_type, geom=Point(10, 10, srid=25832))
        NodeFactory(project=project, node_type=pop_type, geom=Point(50, 50, srid=25832))
        NodeFactory(
            project=project, node_type=pop_type, geom=Point(500, 500, srid=25832)
        )

        result = calculate_valuation(project.id, area_uuids=[area.uuid])

        pop = _row(result, "POP")
        assert pop["quantity"] == 2
        assert float(pop["gp"]) == pytest.approx(200000.0)
        assert float(result["total"]) == pytest.approx(200000.0)

    def test_per_meter_length_clipped_to_area(self):
        """A per-meter row sums trench length clipped to the area boundary."""
        project = ProjectFactory()
        ValuationCostRateFactory(
            project=project,
            name="Tiefbau",
            amount=115,
            unit=ValuationCostRate.Unit.PER_METER,
        )
        area = AreaFactory(project=project, geom=AREA_WKT)

        # Trench runs from x=0 to x=200 along y=50; only 0..100 is inside.
        TrenchFactory(
            project=project,
            geom=LineString((0, 50), (200, 50), srid=25832),
            length=200.0,
        )

        result = calculate_valuation(project.id, area_uuids=[area.uuid])

        tiefbau = _row(result, "Tiefbau")
        assert float(tiefbau["quantity"]) == pytest.approx(100.0, rel=1e-6)
        assert float(tiefbau["gp"]) == pytest.approx(115 * 100.0, rel=1e-6)

    def test_gesamt_uses_whole_project_uncllipped(self):
        """With no area (Gesamt) the whole project is summed, unclipped."""
        project = ProjectFactory()
        ValuationCostRateFactory(
            project=project,
            name="Tiefbau",
            amount=115,
            unit=ValuationCostRate.Unit.PER_METER,
        )
        TrenchFactory(
            project=project,
            geom=LineString((0, 50), (200, 50), srid=25832),
            length=200.0,
        )

        result = calculate_valuation(project.id, area_uuids=None)

        tiefbau = _row(result, "Tiefbau")
        assert float(tiefbau["quantity"]) == pytest.approx(200.0, rel=1e-6)

    def test_kpis(self):
        """KPIs = total / house-connection count and total / trench length."""
        project = ProjectFactory()
        ha_type = NodeTypeFactory()
        ValuationCostRateFactory(
            project=project,
            name="Tiefbau",
            amount=100,
            unit=ValuationCostRate.Unit.PER_METER,
        )
        ValuationCostRateFactory(
            project=project,
            name="Hausanschluss",
            amount=1500,
            unit=ValuationCostRate.Unit.PER_PIECE,
            is_house_connection=True,
            node_types=[ha_type],
        )
        area = AreaFactory(project=project, geom=AREA_WKT)
        TrenchFactory(
            project=project,
            geom=LineString((0, 50), (100, 50), srid=25832),
            length=100.0,
        )
        NodeFactory(project=project, node_type=ha_type, geom=Point(10, 10, srid=25832))
        NodeFactory(project=project, node_type=ha_type, geom=Point(20, 20, srid=25832))

        result = calculate_valuation(project.id, area_uuids=[area.uuid])

        # total = 100m*100 + 2*1500 = 10000 + 3000 = 13000
        assert float(result["total"]) == pytest.approx(13000.0)
        assert float(result["cost_per_house_connection"]) == pytest.approx(6500.0)
        assert float(result["cost_per_meter"]) == pytest.approx(130.0)

    def test_house_connection_flag_drives_ha_kpi(self):
        """Only rows flagged is_house_connection feed the cost/HA KPI."""
        project = ProjectFactory()
        ha_type = NodeTypeFactory()
        pop_type = NodeTypeFactory()
        ValuationCostRateFactory(
            project=project,
            name="Hausanschluss",
            amount=1000,
            unit=ValuationCostRate.Unit.PER_PIECE,
            is_house_connection=True,
            node_types=[ha_type],
        )
        # A non-HA row whose nodes must NOT count toward the HA denominator.
        ValuationCostRateFactory(
            project=project,
            name="POP",
            amount=5000,
            unit=ValuationCostRate.Unit.PER_PIECE,
            is_house_connection=False,
            node_types=[pop_type],
        )
        area = AreaFactory(project=project, geom=AREA_WKT)
        # 4 HA nodes, 1 POP node.
        for _ in range(4):
            NodeFactory(
                project=project, node_type=ha_type, geom=Point(10, 10, srid=25832)
            )
        NodeFactory(project=project, node_type=pop_type, geom=Point(20, 20, srid=25832))

        result = calculate_valuation(project.id, area_uuids=[area.uuid])

        # total = 4*1000 + 1*5000 = 9000; denominator = 4 HA nodes only.
        assert float(result["total"]) == pytest.approx(9000.0)
        assert float(result["cost_per_house_connection"]) == pytest.approx(2250.0)

    def test_kpis_guard_divide_by_zero(self):
        """KPIs are None when the denominator is zero."""
        project = ProjectFactory()
        pop_type = NodeTypeFactory()
        ValuationCostRateFactory(
            project=project,
            name="POP",
            amount=100000,
            unit=ValuationCostRate.Unit.PER_PIECE,
            node_types=[pop_type],
        )
        area = AreaFactory(project=project, geom=AREA_WKT)
        NodeFactory(project=project, node_type=pop_type, geom=Point(10, 10, srid=25832))

        result = calculate_valuation(project.id, area_uuids=[area.uuid])

        assert result["cost_per_house_connection"] is None
        assert result["cost_per_meter"] is None

    def test_future_projection(self):
        """Projection compounds the total by the yearly correction."""
        project = ProjectFactory()
        pop_type = NodeTypeFactory()
        ValuationCostRateFactory(
            project=project,
            name="POP",
            amount=100,
            unit=ValuationCostRate.Unit.PER_PIECE,
            node_types=[pop_type],
        )
        area = AreaFactory(project=project, geom=AREA_WKT)
        NodeFactory(project=project, node_type=pop_type, geom=Point(10, 10, srid=25832))

        result = calculate_valuation(
            project.id,
            area_uuids=[area.uuid],
            base_year=2025,
            annual_correction=0.025,
            projection_years=2,
        )

        projection = result["projection"]
        assert projection[0]["year"] == 2025
        assert float(projection[0]["net_value"]) == pytest.approx(100.0)
        assert projection[0]["increase"] is None
        assert projection[1]["year"] == 2026
        assert float(projection[1]["net_value"]) == pytest.approx(102.5)
        assert float(projection[1]["increase"]) == pytest.approx(2.5)

    def test_no_projection_without_inputs(self):
        """No projection is returned when base_year is not given."""
        project = ProjectFactory()
        area = AreaFactory(project=project, geom=AREA_WKT)

        result = calculate_valuation(project.id, area_uuids=[area.uuid])

        assert result["projection"] is None


@pytest.mark.django_db
class TestValuationEndpoints:
    """Tests for the valuation REST endpoints."""

    def test_calculate_endpoint(self, user):
        """POST valuation/calculate/ returns the computed totals as JSON."""
        api_client = APIClient()
        api_client.force_authenticate(user=user)
        project = ProjectFactory()
        pop_type = NodeTypeFactory()
        ValuationCostRateFactory(
            project=project,
            name="POP",
            amount=100000,
            unit=ValuationCostRate.Unit.PER_PIECE,
            node_types=[pop_type],
        )
        area = AreaFactory(project=project, geom=AREA_WKT)
        NodeFactory(project=project, node_type=pop_type, geom=Point(10, 10, srid=25832))

        response = api_client.post(
            "/api/v1/valuation/calculate/",
            {"project": project.id, "area_uuids": [str(area.uuid)]},
            format="json",
        )

        assert response.status_code == 200
        body = response.json()
        assert float(body["total"]) == pytest.approx(100000.0)
        pop = next(r for r in body["categories"] if r["name"] == "POP")
        assert pop["quantity"] == 1

    def test_rates_endpoint_filters_by_project(self, user):
        """GET valuation-rates/?project= only returns that project's rates."""
        api_client = APIClient()
        api_client.force_authenticate(user=user)
        project = ProjectFactory()
        other = ProjectFactory()
        ValuationCostRateFactory(project=project, name="POP")
        ValuationCostRateFactory(project=other, name="MFG")

        response = api_client.get(f"/api/v1/valuation-rates/?project={project.id}")

        assert response.status_code == 200
        body = response.json()
        results = body["results"] if isinstance(body, dict) else body
        assert len(results) == 1
        assert results[0]["project"] == project.id
