#!/usr/bin/env bash
# P7 T4 — flip pack to BEHAVIORAL_COMPLETE after customer sign-off
# @see docs/phase-20/p7/runbooks/p7-t4-sign-off-session.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVIDENCE="${P7_EVIDENCE_DIR:-$ROOT/docs/phase-20/p7/evidence/2026-06-23-operator}"
MANIFEST="$EVIDENCE/manifest.yaml"
WALKTHROUGH="$EVIDENCE/walkthrough-results.md"
TRUTH="$ROOT/docs/phase-20/p7/appendices/IMPLEMENTATION-TRUTH-P7.md"
SNAPSHOT="$ROOT/docs/phase-20/p7/AGENT-CURRENT-PHASE.yaml"
CHECKLIST="$ROOT/docs/phase-20/p7/p7-exit-checklist.md"

ARCHITECT="${P7_T4_ARCHITECT:?Set P7_T4_ARCHITECT= name}"
OPERATOR="${P7_T4_OPERATOR:?Set P7_T4_OPERATOR= customer operator name}"
SIGN_DATE="${P7_T4_DATE:-$(date +%Y-%m-%d)}"

fail() { echo "P7_T4_CLOSEOUT_FAIL: $1" >&2; exit 1; }

[[ -f "$MANIFEST" ]] || fail "missing manifest $MANIFEST"
[[ -f "$WALKTHROUGH" ]] || fail "missing walkthrough $WALKTHROUGH"

echo "== p7:t4-closeout architect=$ARCHITECT operator=$OPERATOR date=$SIGN_DATE =="

pnpm run p7:evidence-pack-verify

sed -i "s/^architect:.*/architect: $ARCHITECT/" "$MANIFEST"
sed -i "s/^operator:.*/operator: $OPERATOR/" "$MANIFEST"

# Require architect dry-run or manual session note in walkthrough
grep -q "Architect automated witness.*PASS\|manual.*PASS\|☑\|✅" "$WALKTHROUGH" \
  || fail "walkthrough-results.md has no PASS markers — complete T4 session first"

sed -i 's/^status: STAGING_COMPLETE/status: BEHAVIORAL_COMPLETE/' "$TRUTH"
sed -i 's/^status: STAGING_COMPLETE/status: COMPLETE/' "$SNAPSHOT"
sed -i 's/^current_task: P7-3-N-005/current_task: none/' "$SNAPSHOT"
sed -i 's/^status: STAGING_COMPLETE/status: COMPLETE/' "$CHECKLIST"
sed -i 's/current_task: P7-3-N-005/current_task: none/' "$CHECKLIST"
sed -i 's/\[~\] P7-3-N-005/\[x] P7-3-N-005/' "$CHECKLIST"

pnpm --filter @apps/api exec node --import tsx --test test/p7-pack-integrity.spec.ts \
  || fail "p7-pack-integrity failed after closeout doc edits — sync BOOT-MANIFEST current_task"

echo "P7_T4_CLOSEOUT_OK"
echo "Next: docs/phase-21/AGENT-START.md (P8) when ready"
