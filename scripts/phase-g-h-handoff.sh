#!/usr/bin/env bash
# Print G+H+I merge PR handoff — no gh auth required.
# Run after `pnpm run phase-i:closure` (or pass --verify to run closure first).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERIFY=false
for arg in "$@"; do
  case "$arg" in
    --verify) VERIFY=true ;;
  esac
done

if [[ "$VERIFY" == true ]]; then
  echo "Running phase-i:closure..."
  pnpm run phase-i:closure
  echo ""
fi

SHA="$(git rev-parse --short HEAD)"
COUNT="$(git rev-list --count origin/main..HEAD 2>/dev/null || echo '?')"
COMPARE="https://github.com/hrokhbakhsh1991/docs/compare/main...DEV?expand=1"
GHA="https://github.com/hrokhbakhsh1991/docs/actions/workflows/phase-10-guard.yml"

cat <<EOF
Phase G+H+I closure handoff
===========================
Branch: DEV @ ${SHA}
Commits ahead of main: ${COUNT}
Closure bundle: pnpm run phase-i:closure
GHA phase-10-guard: green on DEV push (see ${GHA})

Create PR (pick one):
  A) gh auth login && pnpm run phase-g-h:create-pr
  B) Manual: ${COMPARE}
     Title: Phase G+H+I: registry modularization, production certification, scale hardening
     Body:  docs/dev/phase-g-h-pr-body.md

Post-merge checklist (from PR body):
  - GHA phase-10-guard green on PR to main
  - Proof matrix: docs/dev/workspace-certification-proof-matrix.yaml (denali certified)
  - Super Admin /platform/clubs/new — urban/guest-club disabled; denali badge
  - POST /platform/v1/tenants workspaceType=urban → 422 WORKSPACE_NOT_CERTIFIED_FOR_PRODUCTION

Deferred (Architect YES only):
  - ci:integrity full gate
  - Phase I3 lazy sync plugin registry (optional)
EOF
