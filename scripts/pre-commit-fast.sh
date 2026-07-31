#!/usr/bin/env bash
# Fast-path pre-commit — target <=60s: path-gated guards, lint-staged, test-changed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FAST_PATH_BUDGET_SECONDS="${FAST_PATH_BUDGET_SECONDS:-60}"
REPORT_DIR="${PRE_COMMIT_FAST_REPORT_DIR:-$ROOT/.cache/pre-commit-fast}"
REPORT_FILE="$REPORT_DIR/latest.tsv"
STARTED_AT="$(date +%s)"
mkdir -p "$REPORT_DIR"
printf "step\tstatus\tduration_seconds\n" >"$REPORT_FILE"

record_step() {
  local id="$1"
  local status="$2"
  local duration="$3"
  printf "%s\t%s\t%s\n" "$id" "$status" "$duration" >>"$REPORT_FILE"
}

finish_report() {
  local exit_code="$1"
  local finished_at total status
  finished_at="$(date +%s)"
  total=$((finished_at - STARTED_AT))
  status="PASS"
  if [ "$exit_code" -ne 0 ]; then
    status="FAIL"
  fi
  record_step "TOTAL" "$status" "$total"
  echo "pre-commit-fast: $status (${total}s; report: .cache/pre-commit-fast/latest.tsv)"
  if [ "$total" -gt "$FAST_PATH_BUDGET_SECONDS" ]; then
    echo "pre-commit-fast: WARN budget exceeded (${total}s > ${FAST_PATH_BUDGET_SECONDS}s); correctness result unchanged" >&2
  fi
}

trap 'finish_report $?' EXIT

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
  run_step "$id" "$@"
}

skip_guard() {
  local id="$1"
  echo "pre-commit-fast: SKIP $id (no staged path match)"
  record_step "$id" "SKIP" "0"
}

run_step() {
  local id="$1"
  local started_at finished_at duration exit_code
  shift
  started_at="$(date +%s)"
  echo "pre-commit-fast: RUN $id"
  if "$@"; then
    finished_at="$(date +%s)"
    duration=$((finished_at - started_at))
    record_step "$id" "PASS" "$duration"
    echo "pre-commit-fast: PASS $id (${duration}s)"
    return 0
  else
    exit_code=$?
    finished_at="$(date +%s)"
    duration=$((finished_at - started_at))
    record_step "$id" "FAIL" "$duration"
    echo "pre-commit-fast: FAIL $id (${duration}s; exit $exit_code)" >&2
    return "$exit_code"
  fi
}

run_step "guard-docs" sh scripts/guard-docs.sh

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
  'apps/api/package\.json'
  'apps/api/prisma/migrations/.*(exposure|integration.*delivery)'
  'apps/api/prisma/schema\.prisma'
  'apps/api/src/app\.ts'
  'apps/api/src/(exposure|integrations)/'
  'apps/api/src/health/migration-consistency-check\.ts'
  'apps/api/src/observability/metrics(\.spec)?\.ts'
  'apps/api/src/openapi/dispatch-routes\.ts'
  'apps/api/src/settings/settings-exposure-'
  'apps/api/test/(4-integration/)?field-exposure-'
  'apps/web/app/api/(integrations|workspaces/.*/exposure)/'
  'apps/web/src/exposure/'
  'apps/web/src/features/settings/denali-required-settings-modules\.generated\.ts'
  'apps/web/src/integrations/'
  'apps/web/playwright\.exposure\.config\.ts'
  'apps/web/test/.*exposure'
  'apps/web/tests/e2e/.*exposure'
  'apps/web/app/\(app\)/settings/exposure/'
  'apps/web/app/\(app\)/settings/integrations/'
  'packages/workspace-sdk/src/(exposure/|plugin/workspace-plugin\.contract\.ts|reference/starter-field-policy\.manifest\.ts)'
  'packages/workspaces/[^/]+/(src|test)/.*(exposure|plugin|settings\.manifest)'
  'docs/(architecture/(README\.md|field-(exposure|policy)-system\.md)|dev/.*exposure|dev/runbooks/integration-gate-blocked\.mdoc|dev/workspace-integration-plugin-system\.md)'
  'scripts/generate-denali-settings-modules\.mjs'
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

run_step "check-node-engine" node scripts/guards/check-node-engine.mjs

if [ -n "$(echo "$STAGED" | tr -d '[:space:]')" ]; then
  run_step "lint-staged" pnpm exec lint-staged
else
  echo "pre-commit-fast: no staged files — skip lint-staged"
  record_step "lint-staged" "SKIP" "0"
fi

run_step "test-changed" bash scripts/test-changed.sh --mode pre-commit
