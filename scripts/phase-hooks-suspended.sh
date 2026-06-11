#!/usr/bin/env bash
# Returns 0 when any phase hook suspension marker is active (pre-commit should no-op).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

is_marker_active() {
  local marker="$1"
  if [ ! -f "$marker" ]; then
    return 1
  fi
  if grep -Eq '^[[:space:]]*active:[[:space:]]*true([[:space:]]*#.*)?$' "$marker"; then
    return 0
  fi
  return 1
}

MARKERS=(
  "$ROOT/docs/phase-9/appendices/PHASE-9-HOOKS-SUSPENSION.yaml"
  "$ROOT/docs/phase-8/appendices/PHASE-8-HOOKS-SUSPENSION.yaml"
)

for marker in "${MARKERS[@]}"; do
  if is_marker_active "$marker"; then
    exit 0
  fi
done

exit 1
