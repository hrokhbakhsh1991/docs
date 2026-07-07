#!/usr/bin/env bash
# P6-4-N-006 — staging deploy wiring verify (static; does not deploy)
# @see docs/phase-19/p6/runbooks/staging-deploy.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

required=(
  "docs/phase-19/p6/runbooks/staging-deploy.md"
  "docs/phase-19/p6/runbooks/host-subdomain-map.md"
  "scripts/p6-staging-gate.sh"
  "scripts/p6-staging-preflight.sh"
  "scripts/p6-denali-e2e-gate.sh"
  ".github/workflows/p6-denali-gate.yml"
)

for path in "${required[@]}"; do
  if [[ ! -f "$path" ]]; then
    echo "p6-staging-deploy-verify: missing $path" >&2
    exit 1
  fi
done

if ! grep -q 'run_staging_gate\|p6:staging-gate\|staging' .github/workflows/p6-denali-gate.yml; then
  echo "p6-staging-deploy-verify: p6-denali-gate.yml missing staging workflow hook" >&2
  exit 1
fi

if ! grep -q 'P6-4-N-006\|staging-deploy' docs/phase-19/p6/p6-exit-checklist.md; then
  echo "p6-staging-deploy-verify: exit checklist missing P6-4-N-006 reference" >&2
  exit 1
fi

echo "P6_STAGING_DEPLOY_VERIFY_OK"
