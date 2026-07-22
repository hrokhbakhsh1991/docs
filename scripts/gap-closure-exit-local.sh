#!/usr/bin/env bash
# Gap Closure Architect exit-local proofs.
# Default: wave-i0:guard + E.4b-d in-memory create (fast).
# Pass --full to also run E.4b-d2 --package-build (matches GHA e4b-d).
# @see docs/dev/saas-platform-remediation.mdoc
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FULL=0
for arg in "$@"; do
  case "$arg" in
    --full) FULL=1 ;;
    --) ;;
    *)
      echo "Unknown option: $arg" >&2
      echo "Usage: bash scripts/gap-closure-exit-local.sh [--full]" >&2
      exit 1
      ;;
  esac
done

echo "== gap-closure:exit-local =="
pnpm run wave-i0:guard

if [[ "$FULL" -eq 1 ]]; then
  echo "== E.4b-d2 package-build =="
  pnpm run build:workspace-sdk-for-guards
  bash scripts/ci/gap-closure-e4b-create.sh --package-build
else
  echo "== E.4b-d in-memory create =="
  bash scripts/ci/gap-closure-e4b-create.sh
fi

echo "gap-closure:exit-local: PASS"
echo "Next: green GHA gap-closure-e4b + Architect maturity acknowledgment (do not claim DONE without both)."
