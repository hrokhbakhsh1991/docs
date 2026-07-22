#!/usr/bin/env bash
# Gap Closure E.4b-d — disposable guest workspace create proof (no trunk leftover).
# Pass-through: --package-build enables E.4b-d2 trunk filter build/test.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
exec node scripts/ci/gap-closure-e4b-create.mjs "$@"
