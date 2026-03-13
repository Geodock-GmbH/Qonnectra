"""Custom pagination classes for the Qonnectra API."""

from rest_framework.pagination import PageNumberPagination


class CustomPagination(PageNumberPagination):
    """Page-number-based pagination with configurable page size.

    Allow clients to override page size via the ``page_size`` query
    parameter, capped at 100 results per page.
    """

    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100
