#!/usr/bin/env bash
# P7 T4 — architect automated witness (API + infra; browser smokes via p7:staging-e2e-probe)
# @see docs/phase-20/p7/runbooks/p7-t4-sign-off-session.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVIDENCE_DIR="${P7_EVIDENCE_DIR:-$ROOT/docs/phase-20/p7/evidence/2026-06-23-operator}"
LOG="$EVIDENCE_DIR/architect-dry-run.log"
VPS_HOST="${VPS_HOST:-89.45.89.206}"
VPS_USER="${VPS_USER:-root}"
SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=15)
API_PORT="${STAGING_API_PORT:-23001}"
MKT_PORT="${STAGING_MARKETING_PORT:-23002}"
TENANT="00000000-0000-4000-8000-000000000014"
TOUR="00000000-0000-4000-8000-000000000210"

mkdir -p "$EVIDENCE_DIR"
exec > >(tee "$LOG") 2>&1

fail() { echo "P7_T4_ARCHITECT_DRY_RUN_FAIL: $1" >&2; exit 1; }

echo "== p7:t4-architect-dry-run $(date -Iseconds) =="

echo "== VS-08 p7:gate =="
cd "$ROOT"
if [[ "${P7_T4_SKIP_GATE:-}" == "1" ]]; then
  echo "skip p7:gate (P7_T4_SKIP_GATE=1)"
else
  pnpm run p7:gate
fi

echo "== infra p7:staging-remote-smoke =="
pnpm run p7:staging-remote-smoke

API="http://127.0.0.1:${API_PORT}"
MKT="http://127.0.0.1:${MKT_PORT}"

echo "== VS-01 catalog active + draft hidden =="
ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s <<EOF
set -euo pipefail
API="${API}"
MKT="${MKT}"
TENANT="${TENANT}"
TOUR="${TOUR}"
DRAFT="00000000-0000-4000-8000-000000000211"

active_code=\$(curl -s -o /tmp/p7-vs01-list.json -w '%{http_code}' -H "x-tenant-id: \${TENANT}" "\${API}/denali/catalog")
[[ "\$active_code" == "200" ]] || { echo "catalog list expected 200 got \$active_code" >&2; exit 1; }
grep -q "\${TOUR}" /tmp/p7-vs01-list.json || { echo "published tour missing" >&2; exit 1; }
draft_code=\$(curl -s -o /dev/null -w '%{http_code}' -H "x-tenant-id: \${TENANT}" "\${API}/denali/catalog/\${DRAFT}")
[[ "\$draft_code" == "404" ]] || { echo "draft tour should 404 got \$draft_code" >&2; exit 1; }
mkt_body=\$(curl -sf -H "Host: operator.localhost" "\${MKT}/tours")
echo "\$mkt_body" | grep -q "North Ridge Trek" || { echo "marketing /tours missing North Ridge Trek" >&2; exit 1; }
EOF
echo "VS-01 OK"

echo "== VS-02 marketing lists tour =="
echo "VS-02 OK (verified in VS-01 SSH block)"

echo "== VS-03..07 browser smokes (T2 probe) =="
pnpm run p7:staging-e2e-probe

echo "P7_T4_ARCHITECT_DRY_RUN_OK log=$LOG"
