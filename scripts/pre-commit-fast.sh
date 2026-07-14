#!/usr/bin/env bash
# Fast-path pre-commit — target <60s: doc gate, path-gated guards, lint-staged, test-changed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STAGED="$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null || true)"

staged_matches() {
  local pattern
  for pattern in "$@"; do
    echo "$STAGED" | grep -qE "^${pattern}" && return 0
  done
  return 1
}

run_guard() {
  local id="$1"
  shift
  echo "pre-commit-fast: RUN $id"
  "$@"
}

skip_guard() {
  echo "pre-commit-fast: SKIP $1 (no staged path match)"
}

echo "pre-commit-fast: guard-docs"
sh scripts/guard-docs.sh

# Field-exposure phases 0–11 (path-gated; manifest satisfies guard contract string checks)
# field-exposure-phase-0-guard.mjs
# field-exposure-phase-1-guard.mjs
# field-exposure-phase-2-guard.mjs
# field-exposure-phase-3-guard.mjs
# field-exposure-phase-4-guard.mjs
# field-exposure-phase-5-guard.mjs
# field-exposure-phase-6-guard.mjs
# field-exposure-phase-7-guard.mjs
# field-exposure-phase-8-guard.mjs
# field-exposure-phase-9-guard.mjs
# field-exposure-phase-10-guard.mjs
# field-exposure-phase-11-guard.mjs
FIELD_EXPOSURE_PATTERNS=(
  'apps/api/'
  'packages/platform-core/'
  'packages/workspace-sdk/'
  'packages/workspaces/'
  'apps/web/src/exposure/'
  'apps/web/app/\(app\)/settings/exposure/'
  'apps/web/app/\(app\)/settings/integrations/'
  'docs/architecture/field-exposure-system\.md'
  'docs/architecture/field-policy-system\.md'
  'scripts/guards/field-exposure-'
  'scripts/pre-commit-fast\.sh'
)

if staged_matches "${FIELD_EXPOSURE_PATTERNS[@]}"; then
  for i in $(seq 0 11); do
    run_guard "guard-field-exposure-phase-$i" \
      node "scripts/guards/field-exposure-phase-${i}-guard.mjs"
  done
else
  skip_guard "field-exposure guards (phases 0–11)"
fi

# Wizard post-submit contract
WIZARD_PATTERNS=(
  'apps/web/src/wizard/'
  'apps/web/src/tours/'
  'packages/workspaces/denali/src/ui/chrome/'
  'apps/web/src/bootstrap/workspace-photo-upload-errors-bindings\.generated\.ts'
)
if staged_matches "${WIZARD_PATTERNS[@]}"; then
  run_guard "guard-wizard-post-submit" \
    node scripts/guards/guard-wizard-post-submit-contract.mjs
else
  skip_guard "guard-wizard-post-submit"
fi

# CSS globals import-only
CSS_PATTERNS=(
  'apps/portal/app/globals\.css'
  'apps/marketing/app/globals\.css'
  'apps/web/app/globals\.css'
  '.*/globals\.css'
)
if staged_matches "${CSS_PATTERNS[@]}"; then
  run_guard "guard-css-globals" \
    node scripts/guards/guard-css-globals-import-only.mjs
else
  skip_guard "guard-css-globals"
fi

echo "pre-commit-fast: check-node-engine"
node scripts/guards/check-node-engine.mjs

if [ -n "$(echo "$STAGED" | tr -d '[:space:]')" ]; then
  echo "pre-commit-fast: lint-staged"
  pnpm exec lint-staged
else
  echo "pre-commit-fast: no staged files — skip lint-staged"
fi

echo "pre-commit-fast: test-changed (pre-commit mode)"
bash scripts/test-changed.sh --mode pre-commit

echo "pre-commit-fast: PASS"
