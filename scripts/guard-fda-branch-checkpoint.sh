#!/usr/bin/env sh
# FDA-001 branch checkpoint verifier — read-only session lock vs git state.
# Usage: guard-fda-branch-checkpoint.sh [sessionId]
#   sessionId defaults to FDA_SESSION_ID env or newest .cache/feature-delivery/* dir.
set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "guard-fda-branch-checkpoint: skip (not a git repository)"
  exit 0
fi

SESSION_ID="${1:-${FDA_SESSION_ID:-}}"
if [ -z "$SESSION_ID" ]; then
  CACHE_ROOT="$ROOT/.cache/feature-delivery"
  if [ -d "$CACHE_ROOT" ]; then
    SESSION_ID="$(ls -1t "$CACHE_ROOT" 2>/dev/null | head -n 1 || true)"
  fi
fi

if [ -z "$SESSION_ID" ]; then
  echo "guard-fda-branch-checkpoint: skip (no sessionId; set FDA_SESSION_ID or pass arg)"
  exit 0
fi

LOCK_FILE="$ROOT/.cache/feature-delivery/$SESSION_ID/SESSION.lock"
CHECKPOINT_FILE="$ROOT/.cache/feature-delivery/$SESSION_ID/branch-checkpoint.json"

if [ ! -f "$LOCK_FILE" ] && [ ! -f "$CHECKPOINT_FILE" ]; then
  echo "guard-fda-branch-checkpoint: skip (no SESSION.lock or branch-checkpoint.json for $SESSION_ID)"
  exit 0
fi

CURRENT_BRANCH="$(git branch --show-current 2>/dev/null || true)"
CURRENT_HEAD="$(git rev-parse HEAD 2>/dev/null || true)"

LOCKED_BRANCH=""
if [ -f "$LOCK_FILE" ]; then
  LOCKED_BRANCH="$(node -e "
    const fs = require('fs');
    const j = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    process.stdout.write(String(j.lockedBranch || ''));
  " "$LOCK_FILE" 2>/dev/null || true)"
fi

if [ -z "$LOCKED_BRANCH" ] && [ -f "$CHECKPOINT_FILE" ]; then
  LOCKED_BRANCH="$(node -e "
    const fs = require('fs');
    const j = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    process.stdout.write(String(j.lockedSessionBranch || j.current?.branch || ''));
  " "$CHECKPOINT_FILE" 2>/dev/null || true)"
fi

if [ -z "$LOCKED_BRANCH" ]; then
  echo "guard-fda-branch-checkpoint: skip (could not read lockedBranch from session artifacts)"
  exit 0
fi

if [ "$CURRENT_BRANCH" != "$LOCKED_BRANCH" ]; then
  echo "guard-fda-branch-checkpoint: FAIL (SC-GIT-01)" >&2
  echo "  expected branch: $LOCKED_BRANCH" >&2
  echo "  actual branch:   ${CURRENT_BRANCH:-<detached>}" >&2
  echo "  HEAD:            $CURRENT_HEAD" >&2
  echo "  sessionId:       $SESSION_ID" >&2
  exit 1
fi

echo "guard-fda-branch-checkpoint: PASS (branch=$CURRENT_BRANCH head=${CURRENT_HEAD:0:8} session=$SESSION_ID)"
exit 0
