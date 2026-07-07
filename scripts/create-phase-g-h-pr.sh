#!/usr/bin/env bash
# Create DEV→main PR for Phase G+H closure (requires gh auth).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v gh >/dev/null 2>&1; then
  echo "create-phase-g-h-pr: FAIL — gh CLI not installed"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "create-phase-g-h-pr: run 'gh auth login' first"
  echo "Or open: https://github.com/hrokhbakhsh1991/docs/compare/main...DEV?expand=1"
  exit 1
fi

echo "Running phase-i:closure before PR..."
pnpm run phase-i:closure

git push -u origin DEV

gh pr create \
  --base main \
  --head DEV \
  --title "Phase G+H+I: registry modularization, production certification, scale hardening" \
  --body-file docs/dev/phase-g-h-pr-body.md

echo "create-phase-g-h-pr: done"
