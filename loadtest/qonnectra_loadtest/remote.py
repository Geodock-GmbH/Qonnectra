"""SvelteKit remote-function wire format, so personas call the app like its client does.

A query is ``GET /_app/remote/{hash}/{export}?payload={arg}``, a command is a
``POST`` to the same path with ``{"payload": arg, "refreshes": [keys]}``.
``hash`` is SvelteKit's djb2 hash of the ``.remote.ts`` path relative to the
frontend root and ``arg`` is URL-safe base64 of the devalue-serialised
argument. Both answer ``{"type": "result", "data": devalue}`` with the
function's return value under ``_``. ``tests/test_remote.py`` checks the
format against SvelteKit's own code.
"""

import base64
import json

CONDUITS = "src/lib/remote/conduit/conduits.remote.ts"
ADDRESSES = "src/lib/remote/address/addresses.remote.ts"

REMOTE_FILES = {
    "getLayerStyleAttributes": "src/lib/remote/map/layers.remote.ts",
    "getLayerExtent": "src/lib/remote/map/layers.remote.ts",
    "searchFeatures": "src/lib/remote/map/feature-search.remote.ts",
    "getFeatureDetails": "src/lib/remote/map/feature-search.remote.ts",
    "getConduitsInTrench": "src/lib/remote/map/trenches.remote.ts",
    "getCablesInTrench": "src/lib/remote/map/trenches.remote.ts",
    "getTrenchProfile": "src/lib/remote/map/trenches.remote.ts",
    "getNodeDetails": "src/lib/remote/network-schema/nodes.remote.ts",
    "saveNodeGeometry": "src/lib/remote/network-schema/nodes.remote.ts",
    "getCableDetails": "src/lib/remote/network-schema/cables.remote.ts",
    "getFibersForCable": "src/lib/remote/network-schema/fibers.remote.ts",
    "getConduitList": CONDUITS,
    "getConduit": CONDUITS,
    "createConduit": CONDUITS,
    "updateConduit": CONDUITS,
    "deleteConduit": CONDUITS,
    "getAddressList": ADDRESSES,
    "getAddress": ADDRESSES,
    "getAddressLinks": ADDRESSES,
    "updateAddress": ADDRESSES,
    "getStatusDevelopmentOptions": "src/lib/remote/address/attribute-options.remote.ts",
    "getFlagOptions": "src/lib/remote/address/attribute-options.remote.ts",
    "refreshSession": "src/lib/remote/auth/session.remote.ts",
}
"""Remote functions the personas call, mapped to the file that exports them."""

COMMANDS = frozenset(
    {
        "createConduit",
        "updateConduit",
        "deleteConduit",
        "saveNodeGeometry",
        "updateAddress",
        "refreshSession",
    }
)
"""The entries of :data:`REMOTE_FILES` that are commands; all others are queries."""

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
    """Return the path segment after ``/_app/remote/`` for a remote function.

    Args:
        name: Exported function name, a key of :data:`REMOTE_FILES`.

    Returns:
        str: ``{hash}/{name}``.
    """
    return f"{kit_hash(REMOTE_FILES[name])}/{name}"


def devalue_stringify(value) -> str:
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
    """Encode a remote function argument the way SvelteKit's client does.

    Args:
        arg: The argument, or None for argument-less functions.

    Returns:
        str: The ``payload`` query-string value, empty for no argument.
    """
    if arg is None:
        return ""
    raw = base64.urlsafe_b64encode(devalue_stringify(arg).encode())
    return raw.decode().rstrip("=")


def remote_key(name: str, arg) -> str:
    """Return the key of one query instance, as a command's ``refreshes`` lists it.

    Args:
        name: Query name, a key of :data:`REMOTE_FILES`.
        arg: The argument the query instance was called with.

    Returns:
        str: ``{hash}/{name}/{payload}``.
    """
    return f"{remote_id(name)}/{encode_remote_arg(arg)}"


_UNDEFINED, _HOLE, _NAN, _INFINITY, _NEGATIVE_INFINITY, _NEGATIVE_ZERO = range(
    -1, -7, -1
)
_SPECIAL = {
    _UNDEFINED: None,
    _HOLE: None,
    _NAN: float("nan"),
    _INFINITY: float("inf"),
    _NEGATIVE_INFINITY: float("-inf"),
    _NEGATIVE_ZERO: -0.0,
}


def devalue_parse(text: str):
    """Revive devalue's flat format into plain Python data.

    Covers what Django's JSON can turn into on the way through SvelteKit:
    plain values, objects, arrays, and the ``Date``, ``Set``, ``Map``,
    ``BigInt`` and ``null`` (prototype-less object) types. Dates stay ISO
    strings, sets become lists, ``undefined`` and holes become None.

    Args:
        text: devalue JSON text.

    Returns:
        The revived value.

    Raises:
        ValueError: If the text is not devalue output or uses another type.
    """
    values = json.loads(text)
    if isinstance(values, int):
        if values in _SPECIAL:
            return _SPECIAL[values]
        raise ValueError("Invalid devalue input")
    if not isinstance(values, list) or not values:
        raise ValueError("Invalid devalue input")
    revived: dict[int, object] = {}

    def hydrate(index):
        """Revive the entry at ``index``, reusing entries revived before."""
        if index in _SPECIAL:
            return _SPECIAL[index]
        if index in revived:
            return revived[index]
        value = values[index]
        if isinstance(value, dict):
            result = revived[index] = {}
            for key, child in value.items():
                result[key] = hydrate(child)
        elif isinstance(value, list) and value and isinstance(value[0], str):
            kind = value[0]
            if kind == "Date":
                revived[index] = value[1]
            elif kind == "BigInt":
                revived[index] = int(value[1])
            elif kind == "Set":
                result = revived[index] = []
                result.extend(hydrate(child) for child in value[1:])
            elif kind in ("Map", "null"):
                result = revived[index] = {}
                pairs = value[1:]
                for key, child in zip(pairs[::2], pairs[1::2], strict=True):
                    result[key if kind == "null" else hydrate(key)] = hydrate(child)
            else:
                raise ValueError(f"Unsupported devalue type {kind}")
        elif isinstance(value, list):
            result = revived[index] = []
            result.extend(hydrate(child) for child in value)
        else:
            revived[index] = value
        return revived[index]

    return hydrate(0)


def remote_result(body: bytes):
    """Return what a remote function returned, from its HTTP answer.

    Args:
        body: Response body of a query or command.

    Returns:
        The function's return value, or None when the body is not a result.
    """
    try:
        envelope = json.loads(body)
        if envelope.get("type") != "result":
            return None
        return devalue_parse(envelope["data"]).get("_")
    except (ValueError, TypeError, KeyError, AttributeError):
        return None
