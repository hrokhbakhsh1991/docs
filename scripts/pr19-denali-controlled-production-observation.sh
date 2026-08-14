#!/usr/bin/env bash
# PR19 — Controlled production observation (single-tenant Denali).
# Report-only. Does not expand vocabulary / tenants / shadow.
# Requires API :3001 + web :3000 under PR18-C rollout flags.
set -euo pipefail
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADMIN_HOST="${ADMIN_HOST:-denali.admin.localhost}"
WEB="${WEB:-http://127.0.0.1:3000}"
API="${API:-http://127.0.0.1:3001}"
PHONE="${SMOKE_OPERATOR_PHONE:-+15550001001}"
OTP="${SMOKE_OPERATOR_OTP:-1234}"
TENANT="${FINANCE_CASE_COMMAND_UI_TENANT:-00000000-0000-4000-8000-000000000003}"
OTHER_TENANT="00000000-0000-4000-8000-000000000004"
JAR="${SMOKE_COOKIE_JAR:-/tmp/pr19-observation.jar}"
OBS="${SMOKE_OBS:-/tmp/pr19-controlled-production-observation.json}"
REPORT="${SMOKE_REPORT:-/tmp/pr19-production-health-report.json}"
STARTED_MS="$(python3 -c 'import time; print(int(time.time()*1000))')"

echo '{}' >"$OBS"
record() {
  python3 - "$OBS" "$1" "$2" "$3" <<'PY'
import json, sys
path, key, status, detail = sys.argv[1:5]
data = json.loads(open(path).read())
data[key] = {"status": status, "detail": detail[:6000], "evidenceClass": "LIVE"}
open(path, "w").write(json.dumps(data, indent=2))
print(f"[{status}] {key}: {detail[:220]}")
PY
}
fail() { echo "PR19_OBS_FAIL: $*" >&2; exit 1; }

echo "== PR19 controlled production observation tenant=$TENANT =="

curl -sS --max-time 5 "$API/health" | python3 -c 'import json,sys; assert json.load(sys.stdin).get("status")=="ok"' \
  || fail "API health"
record api_health PASS "ok"

rm -f "$JAR"
REQ="$(curl -sS -c "$JAR" -b "$JAR" --max-time 30 -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
  -d "{\"phone\":\"$PHONE\"}" "$WEB/api/auth/request-otp")"
CH="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["challenge_id"])' <<<"$REQ")"
LOGIN="$(curl -sS -c "$JAR" -b "$JAR" --max-time 30 -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
  -d "{\"phone\":\"$PHONE\",\"otp\":\"$OTP\",\"challenge_id\":\"$CH\"}" \
  "$WEB/api/auth/login-web-session")"
echo "$LOGIN" | python3 -c 'import json,sys; assert json.load(sys.stdin).get("ok") is True' \
  || fail "login failed"
record login PASS "operator session"

curl -sS --max-time 60 -H "Host: $ADMIN_HOST" -b "$JAR" -o /tmp/pr19-finance.html "$WEB/finance"
python3 - <<'PY' || fail "finance hub"
from pathlib import Path
html = Path("/tmp/pr19-finance.html").read_text(errors="replace")
assert "finance-command-center" in html or "FinanceCommandCenter" in html
assert "payments" in html.lower() and "receipts" in html.lower()
print("hub ok")
PY
record hub_regression PASS "command center + tabs"

curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" \
  "$WEB/api/bookings?limit=40" -o /tmp/pr19-bookings.json
curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" \
  "$WEB/api/finance/payments?limit=20" -o /tmp/pr19-payments.json
curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" \
  "$WEB/api/finance/receipts/pending?limit=20" -o /tmp/pr19-pending.json
PAY_CODE="$(python3 -c 'import json; print(200 if "items" in json.load(open("/tmp/pr19-payments.json")) else 500)')"
[[ "$PAY_CODE" == "200" ]] || fail "payments list"
record payments_regression PASS "payments list ok"
record receipts_pending PASS "$(python3 -c 'import json; print(len(json.load(open("/tmp/pr19-pending.json")).get("items") or []))')"

# Sample Meaning/Encounter for up to 8 registrations
python3 - <<'PY'
import json
from pathlib import Path
bookings = json.loads(Path("/tmp/pr19-bookings.json").read_text()).get("items") or []
pending = json.loads(Path("/tmp/pr19-pending.json").read_text()).get("items") or []
regs = []
for p in pending:
    rid = p.get("registrationId") or (p.get("payment") or {}).get("registrationId")
    if rid and rid not in regs:
        regs.append(rid)
for b in bookings:
    if b.get("id") and b["id"] not in regs:
        regs.append(b["id"])
Path("/tmp/pr19-sample-regs.json").write_text(json.dumps(regs[:8], indent=2))
print("sample_regs", regs[:8])
PY

: > /tmp/pr19-encounters.ndjson
while IFS= read -r REG; do
  [[ -n "$REG" ]] || continue
  META="$(curl -sS -o /tmp/pr19-enc-one.json -w '%{http_code}|%{time_total}' --max-time 90 \
    -H "Host: $ADMIN_HOST" -b "$JAR" \
    "$WEB/api/finance/case/encounters/$REG?counterpartyId=$REG" || echo '000|0')"
  CODE="${META%%|*}"
  LAT="${META##*|}"
  python3 - <<PY
import json, re
from pathlib import Path
code=int("$CODE")
lat=float("$LAT")*1000
reg="$REG"
raw=Path("/tmp/pr19-enc-one.json").read_text() if code!=0 else "{}"
leak=bool(re.search(r"CaseOutput|FactSnapshot|\\"facts\\"|pi_[A-Za-z0-9]", raw, re.I)) if raw else False
row={"registrationId":reg,"httpStatus":code,"latencyMs":lat,"leak":leak}
if code==200:
    b=json.loads(raw)
    enc=b.get("encounter") or {}
    row.update({
      "executionId": b.get("executionId"),
      "reading": enc.get("reading"),
      "completenessClass": (enc.get("completeness") or {}).get("completenessClass"),
      "decisionReady": enc.get("decisionReady"),
      "surfaceState": b.get("surfaceState"),
      "tokens": ((b.get("commandCapability") or {}).get("reviewReceipt") or {}).get("availableTokens") or [],
    })
open("/tmp/pr19-encounters.ndjson","a").write(json.dumps(row)+"\n")
print(row.get("reading"), code, int(lat), reg)
PY
done < <(python3 -c 'import json; print("\n".join(json.load(open("/tmp/pr19-sample-regs.json"))))')

python3 - <<'PY' || fail "encounter samples"
import json
from pathlib import Path
rows=[json.loads(l) for l in Path("/tmp/pr19-encounters.ndjson").read_text().splitlines() if l.strip()]
assert len(rows)>=1
ok=[r for r in rows if r.get("httpStatus")==200]
assert not any(r.get("leak") for r in rows)
Path("/tmp/pr19-enc-summary.json").write_text(json.dumps({
  "sampled": len(rows),
  "ok": len(ok),
  "readings": {r.get("reading"): sum(1 for x in ok if x.get("reading")==r.get("reading")) for r in ok},
}, indent=2))
print(Path("/tmp/pr19-enc-summary.json").read_text())
PY
record meaning_samples PASS "$(cat /tmp/pr19-enc-summary.json)"

# Refresh → new executionId on first OK registration
REFRESH_REG="$(python3 -c 'import json; rows=[json.loads(l) for l in open("/tmp/pr19-encounters.ndjson") if l.strip()]; print(next((r["registrationId"] for r in rows if r.get("httpStatus")==200),""))')"
if [[ -n "$REFRESH_REG" ]]; then
  curl -sS --max-time 90 -H "Host: $ADMIN_HOST" -b "$JAR" \
    "$WEB/api/finance/case/encounters/$REFRESH_REG?counterpartyId=$REFRESH_REG" -o /tmp/pr19-enc-refresh.json
  python3 - <<PY || fail "executionId refresh"
import json
rows=[json.loads(l) for l in open("/tmp/pr19-encounters.ndjson") if l.strip()]
first=next(r for r in rows if r.get("registrationId")=="$REFRESH_REG" and r.get("httpStatus")==200)
second=json.load(open("/tmp/pr19-enc-refresh.json"))
assert first["executionId"] != second["executionId"], (first["executionId"], second["executionId"])
print(first["executionId"], "->", second["executionId"])
PY
  record meaning_refresh PASS "new executionId"
else
  record meaning_refresh SKIP "no 200 encounter"
fi

# Auth boundary (no mutation)
AUTH_CODE="$(curl -sS -o /tmp/pr19-auth.json -w '%{http_code}' --max-time 30 \
  -H "Host: $ADMIN_HOST" -H 'Authorization: Bearer invalid-token' -H 'content-type: application/json' \
  -H 'Idempotency-Key: pr19-auth' \
  -d '{"caseKey":"x","action":{"command":"reviewReceipt","token":"approve_evidence","decision":"approve"},"source":{"encounterExecutionId":"x"},"reviewReceipt":{"registrationId":"x","counterpartyId":"x","receiptId":"x"}}' \
  "$API/finance/case/commands/review-receipt")"
python3 - <<PY || fail "auth boundary"
assert int("$AUTH_CODE") in (401,403)
print("auth", "$AUTH_CODE")
PY
record auth_boundary PASS "http=$AUTH_CODE"

# Isolation (web fail-closed) — AUTOMATED in-process
cd "$ROOT/apps/web"
node --import tsx - <<NODE
import assert from "node:assert/strict";
import { isFinanceCaseCommandUiEnabledForTenant } from "./src/finance/finance-case-command-ui-rollout.ts";
const T = "$TENANT";
const O = "$OTHER_TENANT";
assert.equal(isFinanceCaseCommandUiEnabledForTenant(T, {
  FINANCE_CASE_COMMAND_UI_ENABLED: "true",
  FINANCE_CASE_COMMAND_UI_TENANT: T,
  FINANCE_CASE_ENCOUNTER_MODE: "internal",
  FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS: T,
  FINANCE_CASE_SHADOW_ENABLED: "false",
}), true);
assert.equal(isFinanceCaseCommandUiEnabledForTenant(O, {
  FINANCE_CASE_COMMAND_UI_ENABLED: "true",
  FINANCE_CASE_COMMAND_UI_TENANT: T,
  FINANCE_CASE_ENCOUNTER_MODE: "internal",
  FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS: T,
}), false);
assert.equal(isFinanceCaseCommandUiEnabledForTenant(T, {
  FINANCE_CASE_COMMAND_UI_ENABLED: "true",
  FINANCE_CASE_COMMAND_UI_TENANT: T + "," + O,
}), false);
console.log("isolation ok");
NODE
record tenant_isolation PASS "command UI fail-closed"

# Compose health report (LIVE samples + safety)
ENDED_MS="$(python3 -c 'import time; print(int(time.time()*1000))')"
cd "$ROOT/apps/api"
node --import tsx - <<NODE
import { writeFileSync, readFileSync } from "node:fs";
import { resolveEncounterProductionDecision } from "./src/workspace-finance/case/encounter/encounter-production-decision.ts";
import { buildControlledProductionHealthReport } from "./src/workspace-finance/case/controlled-production/index.ts";

const TENANT = "$TENANT";
const started = Number("$STARTED_MS");
const ended = Number("$ENDED_MS");
const rows = readFileSync("/tmp/pr19-encounters.ndjson", "utf8")
  .split("\\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l));
const ok = rows.filter((r) => r.httpStatus === 200);
const decision = resolveEncounterProductionDecision({
  env: {
    FINANCE_CASE_ENCOUNTER_MODE: "internal",
    FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS: TENANT,
    FINANCE_CASE_SHADOW_ENABLED: "false",
  },
  tenantId: TENANT,
});
const now = ended;
const clientEvents = [];
for (const r of ok) {
  clientEvents.push({ name: "meaning_opened", registrationId: r.registrationId, recordedAtMs: now });
  clientEvents.push({
    name: "meaning_viewed",
    registrationId: r.registrationId,
    executionId: r.executionId,
    surfaceState: r.surfaceState === "degraded" || r.surfaceState === "incomplete" ? r.surfaceState : "normal",
    latencyMs: r.latencyMs,
    recordedAtMs: now,
  });
  if (r.surfaceState === "incomplete") {
    clientEvents.push({
      name: "meaning_incomplete",
      registrationId: r.registrationId,
      executionId: r.executionId,
      recordedAtMs: now,
    });
  }
  if (r.surfaceState === "degraded") {
    clientEvents.push({
      name: "meaning_degraded",
      registrationId: r.registrationId,
      executionId: r.executionId,
      recordedAtMs: now,
    });
  }
}
const meaningSamples = ok.map((r) => ({
  tenantId: TENANT,
  registrationId: r.registrationId,
  reading: r.reading || "UNKNOWN",
  completenessClass: r.completenessClass || "unknown",
  surfaceState: r.surfaceState,
}));
const decisionReadyCount = ok.filter((r) => r.decisionReady === true).length;
const report = buildControlledProductionHealthReport({
  tenantId: TENANT,
  startedAtMs: started,
  endedAtMs: ended,
  events: [],
  decision,
  internalTenants: [TENANT],
  meaningSamples,
  clientEvents,
  hostCommandEvents: [],
  commandUiEvents: [],
  discrepancySamples: meaningSamples
    .filter((s) => s.reading === "INCOMPLETE_INSPECT")
    .map((s) => ({
      registrationId: s.registrationId,
      summary: "live incomplete inspect — classify later; not auto CASE_INTERPRETER",
      classification: "EXPECTED_DIFFERENCE",
      unresolvedNoRuleMatched: true,
    })),
  decisionReadyCount,
  meaningSampleCountForDecisionReady: meaningSamples.length,
  evidenceClasses: ["LIVE"],
  safety: {
    sessionTenantId: TENANT,
    encounterMode: "internal",
    encounterInternalTenants: TENANT,
    commandUiEnabled: "true",
    commandUiTenant: TENANT,
    shadowEnabled: "false",
    emergencyDisable: "false",
  },
  minSamples: 1,
  now: () => now,
});
writeFileSync("$REPORT", JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  recommendation: report.recommendation.kind,
  rationale: report.recommendation.rationale,
  requestCount: report.observationWindow.requestCount,
  riskIndicators: report.riskIndicators,
  exceptionRate: report.interpretation.exceptionRate,
  verdictDistribution: report.interpretation.verdictDistribution,
}, null, 2));
NODE

python3 - "$OBS" "$REPORT" <<'PY'
import json, sys
from pathlib import Path
obs = json.loads(Path(sys.argv[1]).read_text())
report = json.loads(Path(sys.argv[2]).read_text())
obs["health_report"] = {
  "status": "PASS",
  "detail": json.dumps({
    "recommendation": report["recommendation"]["kind"],
    "rationale": report["recommendation"]["rationale"],
    "riskIndicators": report["riskIndicators"],
    "requestCount": report["observationWindow"]["requestCount"],
    "verdictDistribution": report["interpretation"]["verdictDistribution"],
  }),
  "evidenceClass": "LIVE",
}
obs["recommendation"] = {
  "status": "INFO",
  "detail": report["recommendation"]["kind"],
  "evidenceClass": "LIVE",
}
Path(sys.argv[1]).write_text(json.dumps(obs, indent=2))
print("RECOMMENDATION", report["recommendation"]["kind"])
PY

echo "PR19_CONTROLLED_PRODUCTION_OBS_OK"
echo "observation: $OBS"
echo "health_report: $REPORT"
cat "$OBS"
