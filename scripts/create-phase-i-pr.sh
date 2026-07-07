#!/usr/bin/env bash
# Create DEV→main PR for Phase I-only follow-up (G+H already on main).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPARE_URL="https://github.com/hrokhbakhsh1991/docs/compare/main...DEV?expand=1"

echo "Running phase-i:closure before PR..."
pnpm run phase-i:closure

if ! command -v gh >/dev/null 2>&1; then
  echo "create-phase-i-pr: FAIL — gh CLI not installed"
  echo "Manual PR: $COMPARE_URL"
  echo "Body: docs/dev/phase-i-pr-body.md"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "create-phase-i-pr: run 'gh auth login' then re-run"
  echo "Prefer combined PR: pnpm run phase-g-h:create-pr"
  echo "Manual: $COMPARE_URL"
  exit 1
fi

git push -u origin DEV

gh pr create \
  --base main \
  --head DEV \
  --title "Phase I: workspace scale hardening (theme budget + plugin load cache)" \
  --body-file docs/dev/phase-i-pr-body.md

echo "create-phase-i-pr: done"
