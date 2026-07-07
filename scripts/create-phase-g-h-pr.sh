#!/usr/bin/env bash
# Create DEV→main PR for Phase G+H+I closure (requires gh auth).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPARE_URL="https://github.com/hrokhbakhsh1991/docs/compare/main...DEV?expand=1"

echo "Running phase-i:closure before PR..."
pnpm run phase-i:closure

if ! command -v gh >/dev/null 2>&1; then
  echo "create-phase-g-h-pr: FAIL — gh CLI not installed"
  echo "Manual PR: $COMPARE_URL"
  echo "Body: docs/dev/phase-g-h-pr-body.md"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "create-phase-g-h-pr: run 'gh auth login' then re-run this script"
  echo ""
  echo "Manual PR (closure already verified above):"
  echo "  $COMPARE_URL"
  echo "  Title: Phase G+H+I: registry modularization, production certification, scale hardening"
  echo "  Body:  docs/dev/phase-g-h-pr-body.md"
  exit 1
fi

git push -u origin DEV

gh pr create \
  --base main \
  --head DEV \
  --title "Phase G+H+I: registry modularization, production certification, scale hardening" \
  --body-file docs/dev/phase-g-h-pr-body.md

echo "create-phase-g-h-pr: done"
echo "GHA phase-10-guard: https://github.com/hrokhbakhsh1991/docs/actions/workflows/phase-10-guard.yml"
