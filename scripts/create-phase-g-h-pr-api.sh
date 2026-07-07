#!/usr/bin/env bash
# Create DEV→main PR via GitHub REST API (no gh auth login required).
# Usage: GITHUB_TOKEN=ghp_... bash scripts/create-phase-g-h-pr-api.sh
# Or:    export GITHUB_TOKEN=... && pnpm run phase-g-h:create-pr-api
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPO="${GITHUB_REPOSITORY:-hrokhbakhsh1991/docs}"
OWNER="${REPO%%/*}"
NAME="${REPO##*/}"
COMPARE_URL="https://github.com/${REPO}/compare/main...DEV?expand=1"
TITLE="Phase G+H+I: registry modularization, production certification, scale hardening"

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "create-phase-g-h-pr-api: set GITHUB_TOKEN (repo scope PAT or fine-grained PR write)"
  echo "  export GITHUB_TOKEN=ghp_..."
  echo "  pnpm run phase-g-h:create-pr-api"
  echo ""
  echo "Or: ${COMPARE_URL}"
  exit 1
fi

echo "Checking for existing open PR (DEV → main)..."
EXISTING="$(curl -fsS \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${OWNER}/${NAME}/pulls?head=${OWNER}:DEV&base=main&state=open")"

OPEN_COUNT="$(python3 -c "import json,sys; print(len(json.load(sys.stdin)))" <<<"$EXISTING")"
if [ "$OPEN_COUNT" != "0" ]; then
  echo "Open PR already exists:"
  python3 -c "import json,sys; [print(p['html_url']) for p in json.load(sys.stdin)]" <<<"$EXISTING"
  exit 0
fi

BODY="$(cat docs/dev/phase-g-h-pr-body.md)"
PAYLOAD="$(TITLE="$TITLE" python3 -c "
import json, os, sys
print(json.dumps({
  'title': os.environ['TITLE'],
  'head': 'DEV',
  'base': 'main',
  'body': sys.stdin.read(),
}))
" <<<"$BODY")"

echo "Creating pull request..."
RESPONSE="$(curl -fsS -X POST \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${OWNER}/${NAME}/pulls" \
  -d "$PAYLOAD")"

URL="$(python3 -c "import json,sys; print(json.load(sys.stdin)['html_url'])" <<<"$RESPONSE")"
echo "create-phase-g-h-pr-api: done"
echo "$URL"
