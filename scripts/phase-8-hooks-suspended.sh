#!/usr/bin/env bash
# Returns 0 when Phase 8 hook suspension marker is active (pre-commit should no-op).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MARKER="$ROOT/docs/phase-8/appendices/PHASE-8-HOOKS-SUSPENSION.yaml"

if [ ! -f "$MARKER" ]; then
  exit 1
fi

if grep -Eq '^[[:space:]]*active:[[:space:]]*true([[:space:]]*#.*)?$' "$MARKER"; then
  exit 0
fi

exit 1
