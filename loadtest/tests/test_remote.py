"""Checks the remote-function wire format against SvelteKit's own code.

A SvelteKit upgrade that changes the hash or the argument encoding fails here
instead of silently turning every remote call of a run into an error. The
comparison runs SvelteKit's modules from frontend/node_modules with Node.
"""

import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

from qonnectra_loadtest.remote import (
    REMOTE_FILES,
    encode_remote_arg,
    kit_hash,
    remote_id,
)

FRONTEND = Path(__file__).resolve().parents[2] / "frontend"
KIT = FRONTEND / "node_modules" / "@sveltejs" / "kit" / "src"

ARGS = [
    "7c2a0c5e-6d6e-4c38-9a0f-0d2f7a8b1c11",
    {"searchQuery": "Teststraße 12", "projectId": "3"},
    {"featureType": "trench", "featureUuid": "abc", "projectId": ""},
    {"projectId": "1", "search": "", "page": 2, "pageSize": 50},
    {"nested": {"list": [1, "two", None, True]}},
    {"emoji": "€ 🙂", "float": 2.5},
]
HASHED = list(dict.fromkeys(REMOTE_FILES.values())) + ["äöü/ß", "🙂 x"]

NODE_SCRIPT = """
const { hash } = await import(process.argv[1] + '/utils/hash.js');
const { parse_remote_arg } = await import(process.argv[1] + '/runtime/shared.js');
const input = JSON.parse(process.argv[2]);
console.log(JSON.stringify({
  hashes: input.hashed.map((text) => hash(text)),
  args: input.encoded.map((payload) => parse_remote_arg(payload, {}))
}));
"""


@pytest.fixture(scope="module")
def sveltekit():
    """Return SvelteKit's answers for the test inputs, computed by Node."""
    if shutil.which("node") is None or not KIT.exists():
        pytest.fail(
            "Needs Node and frontend/node_modules (run npm install in frontend)."
        )
    payload = json.dumps(
        {"hashed": HASHED, "encoded": [encode_remote_arg(arg) for arg in ARGS]}
    )
    result = subprocess.run(
        ["node", "--input-type=module", "-e", NODE_SCRIPT, str(KIT), payload],
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


def test_no_argument_encodes_to_nothing():
    """Verify argument-less queries send no payload."""
    assert encode_remote_arg(None) == ""


@pytest.mark.parametrize("name", sorted(REMOTE_FILES))
def test_every_remote_query_still_exists(name):
    """Verify each query the personas call is still exported by its file."""
    source = (FRONTEND / REMOTE_FILES[name]).read_text()

    assert re.search(rf"export const {name} = query\(", source), name
    assert remote_id(name) == f"{kit_hash(REMOTE_FILES[name])}/{name}"
