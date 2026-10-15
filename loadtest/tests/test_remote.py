"""Checks the remote-function wire format against SvelteKit's own code.

A SvelteKit upgrade that changes the hash, the argument encoding or the
result encoding fails here instead of silently turning every remote call of
a run into an error. The comparison runs SvelteKit's and devalue's modules
from frontend/node_modules with Node.
"""

import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

from qonnectra_loadtest.remote import (
    COMMANDS,
    REMOTE_FILES,
    encode_remote_arg,
    kit_hash,
    remote_id,
    remote_key,
    remote_result,
)

FRONTEND = Path(__file__).resolve().parents[2] / "frontend"
KIT = FRONTEND / "node_modules" / "@sveltejs" / "kit" / "src"
DEVALUE = FRONTEND / "node_modules" / "devalue" / "index.js"

ARGS = [
    "7c2a0c5e-6d6e-4c38-9a0f-0d2f7a8b1c11",
    {"searchQuery": "Teststraße 12", "projectId": "3"},
    {"featureType": "trench", "featureUuid": "abc", "projectId": ""},
    {"projectId": "1", "search": "", "page": 2, "pageSize": 50},
    {"nested": {"list": [1, "two", None, True]}},
    {"emoji": "€ 🙂", "float": 2.5},
]
HASHED = list(dict.fromkeys(REMOTE_FILES.values())) + ["äöü/ß", "🙂 x"]
REFRESHED = {"projectId": "1", "search": "", "page": 2, "pageSize": 50}

RESULTS = """[
  { _: { uuid: 'c1', name: 'Rohr', date: null, missing: undefined, tags: ['a', 'b'] } },
  { _: { ok: true, expiresInMs: 900000 } },
  { _: { when: new Date('2026-10-15T08:00:00.000Z'), ids: new Set([1, 2]), big: 12n } },
  { _: { byKey: new Map([['x', 1]]), bare: Object.assign(Object.create(null), { k: 'v' }) } },
  { _: (() => { const shared = { id: 1 }; return [shared, shared]; })() },
  {}
]"""
"""What remote functions return, as JavaScript; ``{}`` is a command without a result."""

DECODED = [
    {"uuid": "c1", "name": "Rohr", "date": None, "missing": None, "tags": ["a", "b"]},
    {"ok": True, "expiresInMs": 900000},
    {"when": "2026-10-15T08:00:00.000Z", "ids": [1, 2], "big": 12},
    {"byKey": {"x": 1}, "bare": {"k": "v"}},
    [{"id": 1}, {"id": 1}],
    None,
]

NODE_SCRIPT = (
    """
const { hash } = await import(process.argv[1] + '/utils/hash.js');
const { parse_remote_arg, split_remote_key } = await import(process.argv[1] + '/runtime/shared.js');
const devalue = await import(process.argv[3]);
const input = JSON.parse(process.argv[2]);
const results = """
    + RESULTS
    + """;
console.log(JSON.stringify({
  hashes: input.hashed.map((text) => hash(text)),
  args: input.encoded.map((payload) => parse_remote_arg(payload, {})),
  keys: input.keys.map((key) => {
    const { id, payload } = split_remote_key(key);
    return { id, arg: parse_remote_arg(payload, {}) };
  }),
  results: results.map((data) => JSON.stringify({ type: 'result', data: devalue.stringify(data) }))
}));
"""
)


@pytest.fixture(scope="module")
def sveltekit():
    """Return SvelteKit's answers for the test inputs, computed by Node."""
    if shutil.which("node") is None or not KIT.exists() or not DEVALUE.exists():
        pytest.fail(
            "Needs Node and frontend/node_modules (run npm install in frontend)."
        )
    payload = json.dumps(
        {
            "hashed": HASHED,
            "encoded": [encode_remote_arg(arg) for arg in ARGS],
            "keys": [remote_key("getConduitList", REFRESHED)],
        }
    )
    result = subprocess.run(
        [
            "node",
            "--input-type=module",
            "-e",
            NODE_SCRIPT,
            str(KIT),
            payload,
            str(DEVALUE),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(result.stdout)


def test_kit_hash_matches_sveltekit(sveltekit):
    """Verify the module ids hash exactly like SvelteKit's hash()."""
    assert [kit_hash(text) for text in HASHED] == sveltekit["hashes"]


def test_encoded_args_round_trip_through_sveltekit(sveltekit):
    """Verify SvelteKit decodes every encoded argument back to the original."""
    assert sveltekit["args"] == ARGS


def test_results_decode_like_the_client_runtime(sveltekit):
    """Verify what devalue writes for a remote answer comes back as the returned value."""
    assert [remote_result(body.encode()) for body in sveltekit["results"]] == DECODED


def test_error_answers_have_no_result():
    """Verify SvelteKit's error answer and junk decode to nothing."""
    error = b'{"type":"error","error":{"message":"Internal Error"},"status":500}'

    assert remote_result(error) is None
    assert remote_result(b"<html>") is None


def test_no_argument_encodes_to_nothing():
    """Verify argument-less functions send no payload."""
    assert encode_remote_arg(None) == ""


def test_refresh_keys_split_into_query_and_argument(sveltekit):
    """Verify a command's server finds the query and its argument in a refresh key."""
    assert sveltekit["keys"] == [{"id": remote_id("getConduitList"), "arg": REFRESHED}]


@pytest.mark.parametrize("name", sorted(REMOTE_FILES))
def test_every_remote_function_still_exists(name):
    """Verify each function the personas call is still exported by its file, as the same kind."""
    source = (FRONTEND / REMOTE_FILES[name]).read_text()
    kind = "command" if name in COMMANDS else "query"

    assert re.search(rf"export const {name} = {kind}\(", source), (name, kind)
    assert remote_id(name) == f"{kit_hash(REMOTE_FILES[name])}/{name}"
