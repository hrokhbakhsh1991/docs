#!/usr/bin/env bash
# P7 T4 — GO/NO-GO checklist before scheduling customer session
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

EVIDENCE="${P7_EVIDENCE_DIR:-$ROOT/docs/phase-20/p7/evidence/2026-06-23-operator}"
MANIFEST="$EVIDENCE/manifest.yaml"
FAIL=0

mark() {
  if [[ "$1" == OK ]]; then
    echo "  ✅ $2"
  else
    echo "  ❌ $2"
    FAIL=1
  fi
}

echo "== p7:t4-ready — customer session preflight =="

pnpm run p7:staging-remote-smoke >/tmp/p7-t4-ready-smoke.log 2>&1 \
  && mark OK "VPS remote smoke" \
  || { tail -5 /tmp/p7-t4-ready-smoke.log >&2; mark FAIL "VPS remote smoke"; }

pnpm run p7:evidence-pack-verify >/tmp/p7-t4-ready-evidence.log 2>&1 \
  && mark OK "Evidence pack schema" \
  || { tail -3 /tmp/p7-t4-ready-evidence.log >&2; mark FAIL "Evidence pack schema"; }

if [[ -f "$MANIFEST" ]]; then
  for key in p7_gate p7_staging_gate p7_staging_e2e finance_ops_t3; do
    if grep -q "${key}: PASS" "$MANIFEST"; then
      mark OK "manifest gates.$key"
    else
      mark FAIL "manifest gates.$key"
    fi
  done
  for vs in VS-01 VS-02 VS-03 VS-04 VS-05 VS-06 VS-07 VS-08; do
    if grep -q "${vs}: PASS" "$MANIFEST"; then
      mark OK "manifest vertical_slice.$vs"
    else
      mark FAIL "manifest vertical_slice.$vs"
    fi
  done
else
  mark FAIL "manifest missing at $MANIFEST"
fi

pnpm run p7:gate >/tmp/p7-t4-ready-gate.log 2>&1 \
  && mark OK "p7:gate (VS-08 static)" \
  || { tail -5 /tmp/p7-t4-ready-gate.log >&2; mark FAIL "p7:gate"; }

if [[ "$FAIL" -eq 0 ]]; then
  echo ""
  echo "P7_T4_READY_OK — schedule customer session"
  echo "  pnpm run p7:t4-session-brief"
  echo "  docs/phase-20/p7/runbooks/p7-t4-sign-off-session-fa.md"
  exit 0
fi

echo ""
echo "P7_T4_READY_FAIL — fix blockers before scheduling T4"
exit 1
