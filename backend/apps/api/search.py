"""Reusable trigram search utilities using PostgreSQL pg_trgm extension."""

from django.contrib.postgres.search import TrigramWordSimilarity
from django.db.models import F, Q, QuerySet, Value
from django.db.models.functions import Coalesce, Greatest

SIMILARITY_THRESHOLD = 0.3

SEARCH_RESULT_LIMIT = 50
"""Most rows a map search endpoint returns; nobody reads past the first few."""

_ADDRESS_ICONTAINS_FIELDS = (
    "street",
    "housenumber",
    "house_number_suffix",
    "zip_code",
    "city",
    "district",
    "id_address",
)


def _address_similarity_for_token(token):
    """Build a Greatest() expression across all address text fields for one token.

    Args:
        token: Single search token to compute similarity against.

    Returns:
        Greatest: Expression yielding the max TrigramWordSimilarity
            across street, city, zip_code, and district.
    """
    return Greatest(
        TrigramWordSimilarity(token, "street"),
        TrigramWordSimilarity(token, "city"),
        TrigramWordSimilarity(token, "zip_code"),
        Coalesce(
            TrigramWordSimilarity(token, "district"),
            Value(0.0),
        ),
    )


def trigram_address_search(queryset: QuerySet, search_term: str) -> QuerySet:
    """Filter and rank addresses by trigram similarity across multiple fields.

    Tokenize the search term on whitespace and AND tokens together.
    Each token is matched against street, city, zip_code, and district
    using TrigramWordSimilarity. Tokens shorter than 3 characters fall
    back to icontains since trigrams require at least 3 characters.
    Non-text fields (housenumber, id_address) are always matched via
    icontains as an OR alternative to the trigram filter.
    Results are annotated with a ``similarity`` score and ordered descending.

    Args:
        queryset: Base :model:`api.Address` queryset to filter.
        search_term: Raw search input; tokenized on whitespace.

    Returns:
        QuerySet: Filtered and similarity-ordered queryset with a
            ``similarity`` annotation.
    """
    if not search_term or not search_term.strip():
        return queryset

    tokens = search_term.strip().split()

    trigram_tokens = [t for t in tokens if len(t) >= 3]
    short_tokens = [t for t in tokens if len(t) < 3]

    for short in short_tokens:
        q = Q()
        for field in _ADDRESS_ICONTAINS_FIELDS:
            q |= Q(**{f"{field}__icontains": short})
        queryset = queryset.filter(q)

    if not trigram_tokens:
        return queryset

    for i, token in enumerate(trigram_tokens):
        sim_alias = f"_sim_{i}"
        icontains_q = Q(**{"housenumber__icontains": token}) | Q(
            **{"id_address__icontains": token}
        )
        queryset = queryset.annotate(
            **{sim_alias: _address_similarity_for_token(token)}
        ).filter(Q(**{f"{sim_alias}__gte": SIMILARITY_THRESHOLD}) | icontains_q)

    queryset = queryset.annotate(similarity=F("_sim_0"))
    return queryset.order_by("-similarity")


def trigram_name_search(
    queryset: QuerySet,
    search_term: str,
    field: str = "name",
    or_icontains: str | None = None,
) -> QuerySet:
    """Filter and rank a queryset by trigram similarity on a single text field.

    Every returned queryset carries a ``similarity`` annotation. A blank
    term filters nothing, scores 0 and keeps the queryset's ordering. Terms
    shorter than 3 characters fall back to icontains and score 0. Matches
    are ordered by descending ``similarity``, ties by ``field``, so a sliced
    result keeps the best matches and, for short terms, the first by name.

    ``or_icontains`` adds a second match in the same query instead of an OR
    of two querysets, which would need a ``DISTINCT`` over every column,
    geometries included. A row found only through it keeps the similarity
    of its ``field``.

    Args:
        queryset: Base queryset to filter.
        search_term: Raw search input.
        field: Model field name to match against. Defaults to ``"name"``.
        or_icontains: Lookup path that also matches when it contains the
            term, e.g. ``"node_type__node_type"``.

    Returns:
        QuerySet: Filtered, ordered queryset with a ``similarity``
            annotation.
    """
    search_term = (search_term or "").strip()

    if not search_term:
        return queryset.annotate(similarity=Value(0.0))

    if len(search_term) < 3:
        similarity = Value(0.0)
        match = Q(**{f"{field}__icontains": search_term})
    else:
        similarity = TrigramWordSimilarity(search_term, field)
        match = Q(similarity__gte=SIMILARITY_THRESHOLD)

    if or_icontains:
        match |= Q(**{f"{or_icontains}__icontains": search_term})

    return (
        queryset.annotate(similarity=similarity)
        .filter(match)
        .order_by("-similarity", field)
    )
