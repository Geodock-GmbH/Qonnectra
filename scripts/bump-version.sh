#!/usr/bin/env bash
set -euo pipefail

# Bump version across VERSION, backend/pyproject.toml, and frontend/package.json
# Usage: ./scripts/bump-version.sh 1.2.0

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ $# -ne 1 ]]; then
    echo "Usage: $0 <new-version>"
    echo "Example: $0 1.2.0"
    exit 1
fi

NEW_VERSION="$1"

# Validate semver format (basic check)
if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Error: Version must be in semver format (e.g., 1.2.0)"
    exit 1
fi

OLD_VERSION=$(cat "$REPO_ROOT/VERSION" | tr -d '[:space:]')

echo "Bumping version: $OLD_VERSION → $NEW_VERSION"

# 1. Update VERSION file
echo "$NEW_VERSION" > "$REPO_ROOT/VERSION"
echo "✓ Updated VERSION"

# 2. Update backend/pyproject.toml
if [[ -f "$REPO_ROOT/backend/pyproject.toml" ]]; then
    sed -i.bak -E "s/^version = \"[0-9]+\.[0-9]+\.[0-9]+\"/version = \"$NEW_VERSION\"/" "$REPO_ROOT/backend/pyproject.toml"
    rm -f "$REPO_ROOT/backend/pyproject.toml.bak"
    echo "✓ Updated backend/pyproject.toml"
else
    echo "⚠ backend/pyproject.toml not found, skipping"
fi

# 3. Update frontend/package.json
if [[ -f "$REPO_ROOT/frontend/package.json" ]]; then
    sed -i.bak -E "s/\"version\": \"[0-9]+\.[0-9]+\.[0-9]+\"/\"version\": \"$NEW_VERSION\"/" "$REPO_ROOT/frontend/package.json"
    rm -f "$REPO_ROOT/frontend/package.json.bak"
    echo "✓ Updated frontend/package.json"
else
    echo "⚠ frontend/package.json not found, skipping"
fi

echo ""
echo "Done! Next steps:"
echo "  git add VERSION backend/pyproject.toml frontend/package.json"
echo "  git commit -m \"chore: bump version to $NEW_VERSION\""
echo "  git tag v$NEW_VERSION"
echo "  git push origin main --tags"
