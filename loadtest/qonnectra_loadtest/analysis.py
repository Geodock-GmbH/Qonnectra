"""Pure parsing and statistics helpers shared by the recorder and the report."""

import math
import re
from collections import Counter, defaultdict

NGINX_LINE = re.compile(
    r'"(?P<method>\w+) (?P<path>\S+) [^"]*" (?P<status>\d{3}) .*?'
    r"cache_status=(?P<cache>\S*) rt=(?P<rt>[\d.]+) urt=(?P<urt>\S+)"
)
SLOW_LINE = re.compile(
    r"duration: (?P<ms>[\d.]+) ms\s+(?:statement|execute [^:]*|plan):\s*(?P<sql>.*)"
)
SPARK = "▁▂▃▄▅▆▇█"
SIZE_FACTORS = {
    "B": 1 / 2**20,
    "kB": 1 / 1024,
    "KiB": 1 / 1024,
    "KB": 1 / 1024,
    "MiB": 1,
    "MB": 1,
    "GiB": 1024,
    "GB": 1024,
    "TiB": 2**20,
}


def percentile(values: list[float], pct: float) -> float:
    """Return the ``pct`` percentile (0-100) with linear interpolation.

    Args:
        values: Unsorted samples.
        pct: Percentile between 0 and 100.

    Returns:
        float: The percentile, or 0.0 for no samples.
    """
    if not values:
        return 0.0
    ordered = sorted(values)
    rank = (len(ordered) - 1) * pct / 100
    low, high = math.floor(rank), math.ceil(rank)
    return ordered[low] + (ordered[high] - ordered[low]) * (rank - low)


def mean(values: list[float]) -> float | None:
    """Return the arithmetic mean of a series.

    Args:
        values: Samples.

    Returns:
        float | None: The mean, or None for no samples.
    """
    return sum(values) / len(values) if values else None


def sparkline(values: list[float], width: int = 60) -> str:
    """Render values as a unicode sparkline scaled to their own maximum.

    Args:
        values: Series to draw.
        width: Maximum characters; longer series are thinned evenly.

    Returns:
        str: One block character per drawn value.
    """
    values = values[:: max(1, math.ceil(len(values) / width))]
    top = max(values, default=0) or 1
    return "".join(
        SPARK[min(len(SPARK) - 1, int(v / top * (len(SPARK) - 1)))] for v in values
    )


def short_container(name: str) -> str:
    """Map ``qonnectra_backend_wms_prod`` style names to ``backend_wms``.

    Args:
        name: Docker container name.

    Returns:
        str: Name without project prefix and environment suffix.
    """
    return re.sub(r"^qonnectra_|_(prod|dev)$", "", name)


def parse_size(text: str) -> float:
    """Convert a docker stats size such as ``1.2GiB`` to MiB.

    Args:
        text: Size with unit.

    Returns:
        float: Size in MiB, 0.0 when unreadable.
    """
    match = re.match(r"([\d.]+)\s*([kKMGT]?i?B)", text.strip())
    if not match:
        return 0.0
    return float(match.group(1)) * SIZE_FACTORS.get(match.group(2), 1)


def parse_container_stat(row: dict) -> tuple[str, float, float] | None:
    """Read one ``docker stats --format '{{json .}}'`` row.

    Args:
        row: Parsed JSON row.

    Returns:
        tuple | None: ``(short name, CPU %, RAM MiB)``, or None for rows of
            containers outside this stack.
    """
    name = row.get("Name", "")
    if not name.startswith("qonnectra_"):
        return None
    cpu = float(row.get("CPUPerc", "0").rstrip("%") or 0)
    memory = parse_size(row.get("MemUsage", "0B").split("/")[0])
    return short_container(name), cpu, memory


def nginx_group(path: str) -> str:
    """Return the route group of an nginx request path.

    Args:
        path: Request path with query string.

    Returns:
        str: ``vector tiles``, ``wms proxy``, ``api (other)`` or ``other``.
    """
    if "/ol_" in path and "_tiles/" in path:
        return "vector tiles"
    if "/wms-proxy/" in path:
        return "wms proxy"
    if path.startswith("/api/"):
        return "api (other)"
    return "other"


def summarise_nginx(lines: list[str]) -> dict[str, dict]:
    """Group nginx access log lines by route, with cache status and timings.

    Args:
        lines: Access log lines in the ``main`` format with ``rt``/``urt``.

    Returns:
        dict[str, dict]: Per group ``requests``, ``cache`` counts and the
            p95 of ``rt`` (nginx total) and ``urt`` (Django) in ms.
    """
    groups: dict[str, dict] = defaultdict(
        lambda: {"cache": Counter(), "rt": [], "urt": []}
    )
    for line in lines:
        match = NGINX_LINE.search(line)
        if not match:
            continue
        group = groups[nginx_group(match["path"])]
        group["cache"][match["cache"] or "-"] += 1
        group["rt"].append(float(match["rt"]) * 1000)
        upstream = match["urt"].split(",")[-1].strip()
        if upstream not in ("-", ""):
            group["urt"].append(float(upstream) * 1000)
    return {
        name: {
            "requests": sum(data["cache"].values()),
            "cache": dict(data["cache"]),
            "rt_p95": percentile(data["rt"], 95),
            "urt_p95": percentile(data["urt"], 95) if data["urt"] else None,
        }
        for name, data in sorted(groups.items())
    }


def slow_statements(lines: list[str], limit: int = 20) -> dict:
    """Collect slow-statement log entries.

    Args:
        lines: PostgreSQL log lines.
        limit: Maximum entries kept.

    Returns:
        dict: ``count`` of all entries and ``top``, the slowest ones as
            ``{"ms", "sql"}`` with the first 300 characters of the statement.
    """
    found = []
    for line in lines:
        match = SLOW_LINE.search(line)
        if match:
            found.append({"ms": float(match["ms"]), "sql": match["sql"][:300]})
    found.sort(key=lambda entry: entry["ms"], reverse=True)
    return {"count": len(found), "top": found[:limit]}


def server_timing(header: str | None) -> dict[str, float]:
    """Parse a ``Server-Timing`` header of the load-test middleware.

    Args:
        header: e.g. ``app;dur=12.0, db;dur=3.1, q;dur=4``.

    Returns:
        dict[str, float]: ``app``, ``db`` and ``q`` when present.
    """
    parts: dict[str, float] = {}
    for part in (header or "").split(","):
        key, _, value = part.strip().partition(";dur=")
        try:
            parts[key] = float(value)
        except ValueError:
            continue
    return parts
