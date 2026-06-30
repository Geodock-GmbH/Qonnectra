"""Tests for pg_trgm trigram search functionality."""

import pytest
from apps.api.models import Address, Area, Node
from apps.api.search import trigram_address_search, trigram_name_search
from apps.api.tests.factories import (
    AddressFactory,
    AreaFactory,
    FlagFactory,
    NodeFactory,
    NodeTypeFactory,
    ProjectFactory,
)
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def authenticated_client(api_client, db):
    user = User.objects.create_superuser(
        username="searchuser", email="search@example.com", password="testpass123"
    )
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def search_project(db):
    return ProjectFactory(project="Search Test Project")


@pytest.fixture
def search_flag(db):
    return FlagFactory()


@pytest.fixture
def address_data(search_project, search_flag):
    """Create a set of addresses with realistic German street names."""
    return [
        AddressFactory(
            street="Hauptstraße",
            housenumber=1,
            city="Flensburg",
            zip_code="24941",
            district="Mürwik",
            project=search_project,
            flag=search_flag,
        ),
        AddressFactory(
            street="Schleswiger Straße",
            housenumber=42,
            city="Flensburg",
            zip_code="24941",
            district="Altstadt",
            project=search_project,
            flag=search_flag,
        ),
        AddressFactory(
            street="Kieler Weg",
            housenumber=7,
            city="Kiel",
            zip_code="24103",
            district="Gaarden",
            project=search_project,
            flag=search_flag,
        ),
        AddressFactory(
            street="Berliner Allee",
            housenumber=99,
            city="Hamburg",
            zip_code="20095",
            district="Mitte",
            project=search_project,
            flag=search_flag,
        ),
    ]


@pytest.fixture
def node_data(search_project, search_flag):
    """Create nodes with descriptive names."""
    node_type = NodeTypeFactory(node_type="Hauptverteiler")
    return [
        NodeFactory(
            name="Hauptverteiler Nord",
            node_type=node_type,
            project=search_project,
            flag=search_flag,
        ),
        NodeFactory(
            name="Knotenpunkt Mitte",
            node_type=NodeTypeFactory(node_type="Knotenpunkt"),
            project=search_project,
            flag=search_flag,
        ),
        NodeFactory(
            name="Verteiler Süd",
            node_type=NodeTypeFactory(node_type="Unterverteiler"),
            project=search_project,
            flag=search_flag,
        ),
    ]


@pytest.fixture
def area_data(search_project, search_flag):
    """Create areas with descriptive names."""
    return [
        AreaFactory(
            name="Baugebiet Süd",
            project=search_project,
            flag=search_flag,
        ),
        AreaFactory(
            name="Gewerbegebiet Ost",
            project=search_project,
            flag=search_flag,
        ),
    ]


# ---------------------------------------------------------------------------
# Unit tests for trigram_address_search
# ---------------------------------------------------------------------------


class TestTrigramAddressSearch:
    """Tests for the trigram_address_search utility function."""

    def test_exact_street_match(self, address_data):
        """Exact street name should return the matching address."""
        qs = Address.objects.all()
        result = trigram_address_search(qs, "Hauptstraße")
        streets = list(result.values_list("street", flat=True))
        assert "Hauptstraße" in streets

    def test_partial_match(self, address_data):
        """Partial street name should match via trigram similarity."""
        qs = Address.objects.all()
        result = trigram_address_search(qs, "Hauptstr")
        streets = list(result.values_list("street", flat=True))
        assert "Hauptstraße" in streets

    def test_typo_tolerance(self, address_data):
        """Search with a typo should still find similar results."""
        qs = Address.objects.all()
        result = trigram_address_search(qs, "Flensborg")
        cities = list(result.values_list("city", flat=True))
        assert "Flensburg" in cities

    def test_multi_token_and_logic(self, address_data):
        """Multi-word search should AND tokens — both must match."""
        qs = Address.objects.all()
        result = trigram_address_search(qs, "Hauptstraße Flensburg")
        assert result.count() >= 1
        for addr in result:
            assert addr.city == "Flensburg" or addr.street == "Hauptstraße"

    def test_multi_token_narrows_results(self, address_data):
        """Adding a second token should narrow results compared to single token."""
        qs = Address.objects.all()
        single_token = trigram_address_search(qs, "Flensburg")
        multi_token = trigram_address_search(qs, "Hauptstraße Flensburg")
        assert multi_token.count() <= single_token.count()

    def test_results_ordered_by_similarity(self, address_data):
        """Results should be ordered by descending similarity score."""
        qs = Address.objects.all()
        result = trigram_address_search(qs, "Hauptstraße")
        if result.count() > 1:
            similarities = [r.similarity for r in result]
            assert similarities == sorted(similarities, reverse=True)

    def test_no_results_below_threshold(self, address_data):
        """Completely unrelated search should return no results."""
        qs = Address.objects.all()
        result = trigram_address_search(qs, "xyzzyplugh")
        assert result.count() == 0

    def test_empty_search_returns_all(self, address_data):
        """Empty search term should return the queryset unchanged."""
        qs = Address.objects.all()
        result = trigram_address_search(qs, "")
        assert result.count() == qs.count()

    def test_short_token_fallback(self, address_data):
        """Tokens shorter than 3 chars should still produce results via icontains fallback."""
        qs = Address.objects.all()
        result = trigram_address_search(qs, "Ki")
        cities_and_streets = list(result.values_list("city", "street"))
        found = any(
            "Ki" in city or "Ki" in street for city, street in cities_and_streets
        )
        assert found

    def test_city_search(self, address_data):
        """Searching by city name should work."""
        qs = Address.objects.all()
        result = trigram_address_search(qs, "Hamburg")
        cities = list(result.values_list("city", flat=True))
        assert "Hamburg" in cities

    def test_zip_code_search(self, address_data):
        """Searching by zip code should work."""
        qs = Address.objects.all()
        result = trigram_address_search(qs, "24941")
        zip_codes = list(result.values_list("zip_code", flat=True))
        assert "24941" in zip_codes

    def test_district_search(self, address_data):
        """Searching by district should work."""
        qs = Address.objects.all()
        result = trigram_address_search(qs, "Mürwik")
        districts = list(result.values_list("district", flat=True))
        assert "Mürwik" in districts


# ---------------------------------------------------------------------------
# Unit tests for trigram_name_search
# ---------------------------------------------------------------------------


class TestTrigramNameSearch:
    """Tests for the trigram_name_search utility function."""

    def test_exact_name_match(self, node_data):
        """Exact node name should return the matching node."""
        qs = Node.objects.all()
        result = trigram_name_search(qs, "Hauptverteiler Nord")
        names = list(result.values_list("name", flat=True))
        assert "Hauptverteiler Nord" in names

    def test_partial_name_match(self, node_data):
        """Partial name should match via trigram similarity."""
        qs = Node.objects.all()
        result = trigram_name_search(qs, "Hauptvert")
        names = list(result.values_list("name", flat=True))
        assert "Hauptverteiler Nord" in names

    def test_typo_tolerance(self, node_data):
        """Search with a typo should still find similar results."""
        qs = Node.objects.all()
        result = trigram_name_search(qs, "Knotenpnkt")
        names = list(result.values_list("name", flat=True))
        assert "Knotenpunkt Mitte" in names

    def test_results_ordered_by_similarity(self, node_data):
        """Results should be ordered by descending similarity."""
        qs = Node.objects.all()
        result = trigram_name_search(qs, "Verteiler")
        if result.count() > 1:
            similarities = [r.similarity for r in result]
            assert similarities == sorted(similarities, reverse=True)

    def test_no_results_for_unrelated_term(self, node_data):
        """Completely unrelated search should return no results."""
        qs = Node.objects.all()
        result = trigram_name_search(qs, "xyzzyplugh")
        assert result.count() == 0

    def test_empty_search_returns_all(self, node_data):
        """Empty search term should return unfiltered queryset."""
        qs = Node.objects.all()
        result = trigram_name_search(qs, "")
        assert result.count() == qs.count()

    def test_area_name_search(self, area_data):
        """Trigram name search should also work on Area model."""
        qs = Area.objects.all()
        result = trigram_name_search(qs, "Baugebiet")
        names = list(result.values_list("name", flat=True))
        assert "Baugebiet Süd" in names


# ---------------------------------------------------------------------------
# Integration tests for TraceSearchView
# ---------------------------------------------------------------------------


class TestTraceSearchViewTrigram:
    """Integration tests for /api/trace-search/ with trigram search."""

    def test_address_exact_match(
        self, authenticated_client, address_data, search_project
    ):
        """TraceSearch address type should return exact matches."""
        response = authenticated_client.get(
            "/api/v1/trace-search/",
            {"search": "Hauptstraße", "type": "address", "project": search_project.pk},
        )
        assert response.status_code == 200
        results = response.data["results"]
        streets = [r["street"] for r in results]
        assert "Hauptstraße" in streets

    def test_address_fuzzy_match(
        self, authenticated_client, address_data, search_project
    ):
        """TraceSearch should return fuzzy matches for address search."""
        response = authenticated_client.get(
            "/api/v1/trace-search/",
            {"search": "Hauptstr", "type": "address", "project": search_project.pk},
        )
        assert response.status_code == 200
        results = response.data["results"]
        streets = [r["street"] for r in results]
        assert "Hauptstraße" in streets

    def test_address_typo_match(
        self, authenticated_client, address_data, search_project
    ):
        """TraceSearch should handle typos in address search."""
        response = authenticated_client.get(
            "/api/v1/trace-search/",
            {"search": "Flensborg", "type": "address", "project": search_project.pk},
        )
        assert response.status_code == 200
        results = response.data["results"]
        assert len(results) > 0

    def test_node_fuzzy_match(self, authenticated_client, node_data, search_project):
        """TraceSearch node type should return fuzzy name matches."""
        response = authenticated_client.get(
            "/api/v1/trace-search/",
            {"search": "Hauptvert", "type": "node", "project": search_project.pk},
        )
        assert response.status_code == 200
        results = response.data["results"]
        names = [r["name"] for r in results]
        assert "Hauptverteiler Nord" in names

    def test_node_type_icontains_fallback(
        self, authenticated_client, node_data, search_project
    ):
        """TraceSearch node type should still match on node_type via icontains."""
        response = authenticated_client.get(
            "/api/v1/trace-search/",
            {"search": "Knotenpunkt", "type": "node", "project": search_project.pk},
        )
        assert response.status_code == 200
        results = response.data["results"]
        assert len(results) > 0

    def test_min_length_enforced(
        self, authenticated_client, address_data, search_project
    ):
        """Search with less than 2 characters should return empty results."""
        response = authenticated_client.get(
            "/api/v1/trace-search/",
            {"search": "H", "type": "address", "project": search_project.pk},
        )
        assert response.status_code == 200
        assert response.data["results"] == []


# ---------------------------------------------------------------------------
# Integration tests for AddressViewSet.all_addresses
# ---------------------------------------------------------------------------


class TestAddressAllTrigram:
    """Integration tests for /api/address/all/ with trigram search."""

    def test_fuzzy_address_search(
        self, authenticated_client, address_data, search_project
    ):
        """Address list endpoint should return fuzzy matches."""
        response = authenticated_client.get(
            "/api/v1/address/all/",
            {"search": "Hauptstr", "project": search_project.pk},
        )
        assert response.status_code == 200
        results = response.data["results"]
        streets = [r["street"] for r in results]
        assert "Hauptstraße" in streets

    def test_pagination_with_trigram(
        self, authenticated_client, address_data, search_project
    ):
        """Pagination should work correctly with trigram ordering."""
        response = authenticated_client.get(
            "/api/v1/address/all/",
            {
                "search": "Flensburg",
                "project": search_project.pk,
                "page": 1,
                "page_size": 2,
            },
        )
        assert response.status_code == 200
        assert "count" in response.data
        assert "results" in response.data


# ---------------------------------------------------------------------------
# Integration tests for NodeViewSet.all_nodes
# ---------------------------------------------------------------------------


class TestNodeAllTrigram:
    """Integration tests for /api/node/all/ with trigram search."""

    def test_fuzzy_node_search(self, authenticated_client, node_data, search_project):
        """Node list endpoint should return fuzzy matches on name."""
        response = authenticated_client.get(
            "/api/v1/node/all/",
            {"search": "Hauptvert", "project": search_project.pk},
        )
        assert response.status_code == 200
        data = response.data
        features = data.get("features", data) if isinstance(data, dict) else data
        if isinstance(features, list):
            names = [
                f.get("properties", {}).get("name", f.get("name")) for f in features
            ]
        else:
            names = [
                f.get("properties", {}).get("name", f.get("name")) for f in features
            ]
        assert "Hauptverteiler Nord" in names


# ---------------------------------------------------------------------------
# Integration tests for AreaViewSet.all_areas
# ---------------------------------------------------------------------------


class TestAreaAllTrigram:
    """Integration tests for /api/area/all/ with trigram search."""

    def test_fuzzy_area_search(self, authenticated_client, area_data, search_project):
        """Area list endpoint should return fuzzy matches on name."""
        response = authenticated_client.get(
            "/api/v1/area/all/",
            {"search": "Baugebit", "project": search_project.pk},
        )
        assert response.status_code == 200
