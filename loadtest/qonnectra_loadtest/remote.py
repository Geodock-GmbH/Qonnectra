"""SvelteKit remote-function wire format, so personas call queries like the app.

A query is ``GET /_app/remote/{hash}/{export}?payload={arg}``, where ``hash``
is SvelteKit's djb2 hash of the ``.remote.ts`` path relative to the frontend
root and ``arg`` is URL-safe base64 of the devalue-serialised argument.
``tests/test_remote.py`` checks both against SvelteKit's own code.
"""

import base64
import json

REMOTE_FILES = {
    "getLayerStyleAttributes": "src/lib/remote/map/layers.remote.ts",
    "getLayerExtent": "src/lib/remote/map/layers.remote.ts",
    "searchFeatures": "src/lib/remote/map/feature-search.remote.ts",
    "getFeatureDetails": "src/lib/remote/map/feature-search.remote.ts",
    "getConduitsInTrench": "src/lib/remote/map/trenches.remote.ts",
    "getCablesInTrench": "src/lib/remote/map/trenches.remote.ts",
    "getTrenchProfile": "src/lib/remote/map/trenches.remote.ts",
    "getNodeDetails": "src/lib/remote/network-schema/nodes.remote.ts",
    "getCableDetails": "src/lib/remote/network-schema/cables.remote.ts",
    "getFibersForCable": "src/lib/remote/network-schema/fibers.remote.ts",
    "getConduitList": "src/lib/remote/conduit/conduits.remote.ts",
}
"""Remote queries the personas call, mapped to the file that exports them."""

_BASE36 = "0123456789abcdefghijklmnopqrstuvwxyz"


def _to_int32(value: int) -> int:
    """Wrap an integer to a signed 32-bit value, like JavaScript's ``^`` does."""
    value &= 0xFFFFFFFF
    return value - 0x100000000 if value >= 0x80000000 else value


def kit_hash(value: str) -> str:
    """Return SvelteKit's ``hash()`` of a string.

    Ported from ``@sveltejs/kit/src/utils/hash.js``: djb2 over UTF-16 code
    units from the end, with JavaScript's 32-bit wrap-around, in base 36.

    Args:
        value: Text to hash, e.g. ``src/lib/remote/map/layers.remote.ts``.

    Returns:
        str: The base-36 hash SvelteKit uses as the remote module id.
    """
    encoded = value.encode("utf-16-le")
    units = [
        int.from_bytes(encoded[i : i + 2], "little") for i in range(0, len(encoded), 2)
    ]
    result = 5381
    for unit in reversed(units):
        result = _to_int32(result * 33) ^ unit
    number = result & 0xFFFFFFFF
    digits = ""
    while True:
        number, rest = divmod(number, 36)
        digits = _BASE36[rest] + digits
        if number == 0:
            return digits


def remote_id(name: str) -> str:
    """Return the path segment after ``/_app/remote/`` for a remote query.

    Args:
        name: Exported function name, a key of :data:`REMOTE_FILES`.

    Returns:
        str: ``{hash}/{name}``.
    """
    return f"{kit_hash(REMOTE_FILES[name])}/{name}"


def _devalue(value) -> str:
    """Serialise JSON-like data in devalue's flat format.

    The first array entry is the root; objects and arrays reference other
    entries by index. Object keys are sorted like SvelteKit's remote-arg
    reducer does.

    Args:
        value: Strings, numbers, booleans, None, lists and dicts.

    Returns:
        str: devalue JSON text.
    """
    values: list = []

    def flatten(thing) -> int:
        """Append ``thing`` and its children, returning its index."""
        index = len(values)
        values.append(None)
        if isinstance(thing, dict):
            values[index] = {key: flatten(thing[key]) for key in sorted(thing)}
        elif isinstance(thing, (list, tuple)):
            values[index] = [flatten(item) for item in thing]
        elif isinstance(thing, float) and thing.is_integer():
            values[index] = int(thing)
        else:
            values[index] = thing
        return index

    flatten(value)
    return json.dumps(values, separators=(",", ":"), ensure_ascii=False)


def encode_remote_arg(arg) -> str:
    """Encode a remote query argument the way SvelteKit's client does.

    Args:
        arg: The query argument, or None for argument-less queries.

    Returns:
        str: The ``payload`` query-string value, empty for no argument.
    """
    if arg is None:
        return ""
    raw = base64.urlsafe_b64encode(_devalue(arg).encode())
    return raw.decode().rstrip("=")
