#!/usr/bin/env bash
# Incremental integrity gate for explicit file paths (used by dev:integrity watcher).
#
# Usage (from repo root):
#   bash scripts/ci-integrity-check-changed.sh path/to/file.ts [more...]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

if [ "$#" -eq 0 ]; then
  echo "ci-integrity-check-changed: no files provided" >&2
  exit 1
fi

exec node scripts/run-integrity-for-changed.mjs "$@"
