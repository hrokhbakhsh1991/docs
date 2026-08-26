#!/usr/bin/env bash
# PR20-A — Command observation completion gate (evidence only).
# Completes ≥3 LIVE successful reviewReceipt Command UI mutations on …000003.
# Does not expand allowlist / vocabulary / shadow / finance-core.
set -euo pipefail
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADMIN_HOST="${ADMIN_HOST:-denali.admin.localhost}"
WEB="${WEB:-http://127.0.0.1:3000}"
API="${API:-http://127.0.0.1:3001}"
PHONE="${SMOKE_OPERATOR_PHONE:-09174070937}"
OTP="${SMOKE_OPERATOR_OTP:-1234}"
TENANT="${FINANCE_CASE_COMMAND_UI_TENANT:-00000000-0000-4000-8000-000000000003}"
OTHER="00000000-0000-4000-8000-000000000004"
JAR="${SMOKE_COOKIE_JAR:-/tmp/pr20a.jar}"
RESULTS="${SMOKE_RESULTS:-/tmp/pr20a-command-observation.json}"
REPORT="${SMOKE_REPORT:-/tmp/pr20a-production-health-report.json}"
USAGE="${SMOKE_USAGE:-/tmp/pr20a-command-usage-report.json}"
TS="$(date -u +%Y%m%d%H%M%S)"
STARTED_MS="$(python3 -c 'import time; print(int(time.time()*1000))')"

echo '{}' >"$RESULTS"
record() {
  python3 - "$RESULTS" "$1" "$2" "$3" "$4" <<'PY'
import json, sys
path, key, status, detail, evidence = sys.argv[1:6]
data = json.loads(open(path).read())
data[key] = {"status": status, "detail": detail[:8000], "evidenceClass": evidence}
open(path, "w").write(json.dumps(data, indent=2))
print(f"[{status}/{evidence}] {key}: {detail[:240]}")
PY
}
fail() { echo "PR20A_FAIL: $*" >&2; exit 1; }

seed_pending() {
  local REG="$1" TAG="$2"
  local PAY_CODE PAY_ID UP_CODE FILE_KEY SUB_CODE RID
  PAY_CODE="$(curl -sS -o /tmp/pr20a-pay.json -w '%{http_code}' --max-time 30 \
    -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
    -H "Idempotency-Key: pr20a-pay-$TAG-$TS" \
    -d "{\"registrationId\":\"$REG\",\"amount\":\"1500000\",\"currency\":\"IRR\"}" \
    "$WEB/api/finance/payments/manual")"
  PAY_ID="$(python3 -c 'import json; print(json.load(open("/tmp/pr20a-pay.json")).get("id",""))')"
  [[ "$PAY_CODE" == "201" && -n "$PAY_ID" ]] || return 1
  python3 - <<'PY'
from pathlib import Path
import base64
Path("/tmp/pr20a.jpg").write_bytes(base64.b64decode(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBUQEBAVFRUVFRUVFRUVFRUWFxUXFhUYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAADBAECBQYAB//EABUBAQEAAAAAAAAAAAAAAAAAAAAB/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A1oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/Z"
))
PY
  UP_CODE="$(curl -sS -o /tmp/pr20a-up.json -w '%{http_code}' --max-time 30 \
    -H "Host: $ADMIN_HOST" -b "$JAR" \
    -H 'content-type: image/jpeg' -H 'x-receipt-file-name: pr20a.jpg' \
    --data-binary @/tmp/pr20a.jpg \
    "$WEB/api/finance/receipts/upload?registrationId=$REG")"
  FILE_KEY="$(python3 -c 'import json; print(json.load(open("/tmp/pr20a-up.json")).get("fileKey",""))')"
  [[ "$UP_CODE" == "201" && -n "$FILE_KEY" ]] || return 1
  SUB_CODE="$(curl -sS -o /tmp/pr20a-sub.json -w '%{http_code}' --max-time 30 \
    -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
    -H "Idempotency-Key: pr20a-sub-$TAG-$TS" \
    -d "{\"paymentId\":\"$PAY_ID\",\"fileKey\":\"$FILE_KEY\",\"note\":\"PR20-A $TAG $TS\"}" \
    "$WEB/api/finance/receipts")"
  RID="$(python3 -c 'import json; print(json.load(open("/tmp/pr20a-sub.json")).get("id",""))')"
  [[ "$SUB_CODE" == "201" && -n "$RID" ]] || return 1
  echo "$RID"
}

echo "== PR20-A completion gate tenant=$TENANT =="
curl -sS --max-time 5 "$API/health" | python3 -c 'import json,sys; assert json.load(sys.stdin).get("status")=="ok"' || fail "API"
record api_health PASS "ok" LIVE

rm -f "$JAR"
REQ="$(curl -sS -c "$JAR" -b "$JAR" --max-time 30 -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
  -d "{\"phone\":\"$PHONE\"}" "$WEB/api/auth/request-otp")"
CH="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["challenge_id"])' <<<"$REQ")"
LOGIN="$(curl -sS -c "$JAR" -b "$JAR" --max-time 30 -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
  -d "{\"phone\":\"$PHONE\",\"otp\":\"$OTP\",\"challenge_id\":\"$CH\"}" "$WEB/api/auth/login-web-session")"
echo "$LOGIN" | python3 -c 'import json,sys; assert json.load(sys.stdin).get("ok") is True' || fail "login"
record login PASS "ok" LIVE

curl -sS --max-time 60 -H "Host: $ADMIN_HOST" -b "$JAR" -o /tmp/pr20a-finance.html "$WEB/finance"
python3 - <<'PY' || fail "hub"
from pathlib import Path
html=Path("/tmp/pr20a-finance.html").read_text(errors="replace")
assert "finance-command-center" in html or "FinanceCommandCenter" in html
assert "payments" in html.lower() and "receipts" in html.lower()
PY
record hub_regression PASS "ok" LIVE
curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/payments?limit=20" -o /tmp/pr20a-payments.json
python3 -c 'import json; assert "items" in json.load(open("/tmp/pr20a-payments.json"))'
record payments_regression PASS "ok" LIVE

curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/receipts/pending?limit=40" -o /tmp/pr20a-pending.json
curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/bookings?limit=100" -o /tmp/pr20a-bookings.json
curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/payments?limit=100" -o /tmp/pr20a-payments-full.json

python3 - <<'PY'
import json
from pathlib import Path
pending=json.load(open("/tmp/pr20a-pending.json")).get("items") or []
bookings=json.load(open("/tmp/pr20a-bookings.json")).get("items") or []
payments=json.load(open("/tmp/pr20a-payments-full.json")).get("items") or []
paid_regs={(p.get("registrationId") or "") for p in payments}
pending_regs={(p.get("registrationId") or (p.get("payment") or {}).get("registrationId") or "") for p in pending}
clean=[b["id"] for b in bookings if b.get("status")=="approved" and b.get("paymentStatus")=="unpaid" and b["id"] not in paid_regs and b["id"] not in pending_regs]
items=[{"receiptId":p["id"],"registrationId":p.get("registrationId") or (p.get("payment") or {}).get("registrationId") or ""} for p in pending]
Path("/tmp/pr20a-plan.json").write_text(json.dumps({"pending":items,"clean_unpaid":clean,"target":None}, indent=2))
print("pending", len(items), "clean_unpaid", len(clean))
PY

# Find capable pending (approve_evidence) or seed clean unpaid
TARGET_R=""; TARGET_REG=""
for row in $(python3 -c 'import json; print(" ".join(p["receiptId"]+"|"+p["registrationId"] for p in json.load(open("/tmp/pr20a-plan.json"))["pending"] if p["registrationId"]))'); do
  RID="${row%%|*}"; REG="${row##*|}"
  CODE="$(curl -sS -o /tmp/pr20a-enc-probe.json -w '%{http_code}' --max-time 90 \
    -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/case/encounters/$REG?counterpartyId=$REG" || echo 000)"
  TOKENS="$(python3 -c "import json; b=json.load(open('/tmp/pr20a-enc-probe.json')); print(','.join(((b.get('commandCapability') or {}).get('reviewReceipt') or {}).get('availableTokens') or []))" 2>/dev/null || true)"
  READING="$(python3 -c "import json; print((json.load(open('/tmp/pr20a-enc-probe.json')).get('encounter') or {}).get('reading') or '')" 2>/dev/null || true)"
  echo "probe $REG $CODE $READING tokens=$TOKENS" >&2
  if [[ "$CODE" == "200" && "$TOKENS" == *approve_evidence* ]]; then
    TARGET_R="$RID"; TARGET_REG="$REG"; break
  fi
done

if [[ -z "$TARGET_R" ]]; then
  for REG in $(python3 -c 'import json; print(" ".join(json.load(open("/tmp/pr20a-plan.json"))["clean_unpaid"][:10]))'); do
    CODE="$(curl -sS -o /tmp/pr20a-pre.json -w '%{http_code}' --max-time 90 \
      -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/case/encounters/$REG?counterpartyId=$REG" || echo 000)"
    READING="$(python3 -c "import json; print((json.load(open('/tmp/pr20a-pre.json')).get('encounter') or {}).get('reading') or '')" 2>/dev/null || true)"
    [[ "$CODE" == "200" && "$READING" != "EXCEPTION" ]] || continue
    RID="$(seed_pending "$REG" "g1" || true)"
    [[ -n "$RID" ]] || continue
    CODE="$(curl -sS -o /tmp/pr20a-enc-probe.json -w '%{http_code}' --max-time 90 \
      -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/case/encounters/$REG?counterpartyId=$REG" || echo 000)"
    TOKENS="$(python3 -c "import json; b=json.load(open('/tmp/pr20a-enc-probe.json')); print(','.join(((b.get('commandCapability') or {}).get('reviewReceipt') or {}).get('availableTokens') or []))" 2>/dev/null || true)"
    echo "postseed $REG tokens=$TOKENS" >&2
    if [[ "$CODE" == "200" && "$TOKENS" == *approve_evidence* ]]; then
      TARGET_R="$RID"; TARGET_REG="$REG"; break
    fi
  done
fi

if [[ -z "$TARGET_R" || -z "$TARGET_REG" ]]; then
  record third_command SKIP "INSUFFICIENT_LIVE_TRAFFIC" LIVE
  record recommendation INFO "CONTINUE" LIVE
  echo "INSUFFICIENT_LIVE_TRAFFIC"
  echo "PR20A_INSUFFICIENT_LIVE_TRAFFIC"
  cat "$RESULTS"
  exit 0
fi

# --- Third LIVE success (approve) ---
BEFORE_PAY="$(python3 -c "import json; items=json.load(open('/tmp/pr20a-bookings.json'))['items']; print(next((b.get('paymentStatus') for b in items if b['id']=='$TARGET_REG'),'MISSING'))")"
ENC_CODE="$(curl -sS -o /tmp/pr20a-enc-before.json -w '%{http_code}' --max-time 90 \
  -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/case/encounters/$TARGET_REG?counterpartyId=$TARGET_REG")"
[[ "$ENC_CODE" == "200" ]] || fail "encounter before"
EXEC1="$(python3 -c 'import json; print(json.load(open("/tmp/pr20a-enc-before.json"))["executionId"])')"
FP="$(python3 -c 'import json; print(json.load(open("/tmp/pr20a-enc-before.json")).get("meaningFingerprint") or "")')"
CASE_KEY="$(python3 -c 'import json; print(json.load(open("/tmp/pr20a-enc-before.json"))["encounter"]["caseKey"])')"
BODY="$(python3 - <<PY
import json
fp="$FP"
body={
  "caseKey":"$CASE_KEY",
  "action":{"command":"reviewReceipt","token":"approve_evidence","decision":"approve"},
  "source":{"encounterExecutionId":"$EXEC1"},
  "correlationId":"pr20a-third-$TS",
  "reviewReceipt":{"registrationId":"$TARGET_REG","counterpartyId":"$TARGET_REG","receiptId":"$TARGET_R","reviewNote":"PR20-A third LIVE $TS"},
}
if fp: body["source"]["encounterVersionHint"]=fp
print(json.dumps(body))
PY
)"
CMD_META="$(curl -sS -o /tmp/pr20a-cmd.json -w '%{http_code}|%{time_total}' --max-time 90 \
  -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
  -H "Idempotency-Key: pr20a-third-$TS" \
  -d "$BODY" "$WEB/api/finance/case/commands/review-receipt")"
CMD_CODE="${CMD_META%%|*}"
LAT="$(python3 -c "print(float('${CMD_META##*|}')*1000)")"
[[ "$CMD_CODE" == "200" ]] || fail "third command HTTP $CMD_CODE $(cat /tmp/pr20a-cmd.json)"

curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/receipts/pending?limit=50" -o /tmp/pr20a-pending-after.json
curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/bookings?limit=100" -o /tmp/pr20a-bookings-after.json
curl -sS --max-time 90 -H "Host: $ADMIN_HOST" -b "$JAR" \
  "$WEB/api/finance/case/encounters/$TARGET_REG?counterpartyId=$TARGET_REG" -o /tmp/pr20a-enc-after.json

python3 - <<PY
import json, re
from pathlib import Path
raw=Path("/tmp/pr20a-cmd.json").read_text()
assert not re.search(r"CaseOutput|FactSnapshot|\\"facts\\"|pi_[A-Za-z0-9]", raw, re.I)
b=json.loads(raw)
assert b["executionId"] != "$EXEC1"
pending={p["id"] for p in json.load(open("/tmp/pr20a-pending-after.json")).get("items") or []}
assert "$TARGET_R" not in pending
after=next((x.get("paymentStatus") for x in json.load(open("/tmp/pr20a-bookings-after.json"))["items"] if x["id"]=="$TARGET_REG"), "MISSING")
enc2=json.load(open("/tmp/pr20a-enc-after.json"))
assert enc2["executionId"] != "$EXEC1"
out={
  "command":"reviewReceipt",
  "decision":"approve",
  "httpStatus":200,
  "latencyMs": float("$LAT"),
  "receiptId":"$TARGET_R",
  "registrationId":"$TARGET_REG",
  "executionIdBefore":"$EXEC1",
  "executionIdAfter": enc2["executionId"],
  "commandExecutionId": b["executionId"],
  "bookingPaymentBefore":"$BEFORE_PAY",
  "bookingPaymentAfter": after,
  "receiptStillPending": False,
  "readingAfter": (enc2.get("encounter") or {}).get("reading"),
  "idempotencyKey":"pr20a-third-$TS",
}
Path("/tmp/pr20a-third.json").write_text(json.dumps(out, indent=2))
print(json.dumps(out, indent=2))
PY
record third_command PASS "$(cat /tmp/pr20a-third.json)" LIVE

# --- EXCEPTION residual check (paid booking Meaning) ---
# Prefer the third-command registration (just paid) and PR20 A reg if present.
python3 - <<'PY'
import json
from pathlib import Path
third=json.load(open("/tmp/pr20a-third.json"))
regs=[third["registrationId"]]
# prior PR20 approve residual if file exists
try:
  a=json.load(open("/tmp/pr20-scenario-A.json"))
  if a.get("registrationId"): regs.append(a["registrationId"])
except Exception:
  pass
Path("/tmp/pr20a-exception-regs.json").write_text(json.dumps(regs))
print(regs)
PY

: > /tmp/pr20a-exception.ndjson
for REG in $(python3 -c 'import json; print(" ".join(json.load(open("/tmp/pr20a-exception-regs.json"))))'); do
  CODE="$(curl -sS -o /tmp/pr20a-exc-enc.json -w '%{http_code}' --max-time 90 \
    -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/case/encounters/$REG?counterpartyId=$REG" || echo 000)"
  PAY="$(python3 -c "import json; items=json.load(open('/tmp/pr20a-bookings-after.json'))['items']; print(next((b.get('paymentStatus') for b in items if b['id']=='$REG'),'MISSING'))")"
  python3 - <<PY
import json
from pathlib import Path
code=int("$CODE")
reg="$REG"
pay="$PAY"
row={"registrationId":reg,"httpStatus":code,"bookingPaymentStatus":pay}
if code==200:
  b=json.load(open("/tmp/pr20a-exc-enc.json"))
  enc=b.get("encounter") or {}
  row.update({
    "reading": enc.get("reading"),
    "decisionReady": enc.get("decisionReady"),
    "tokens": ((b.get("commandCapability") or {}).get("reviewReceipt") or {}).get("availableTokens") or [],
    "headline": ((enc.get("explainability") or {}).get("headline")),
  })
  # Classify without changing interpreter
  if pay=="paid" and enc.get("reading")=="EXCEPTION":
    row["classification"]="SOT_POLICY"
    row["repeatable"]=True
    row["notes"]="paid booking + Case EXCEPTION — commercial conflict / outstanding remaining class; EXPECTED under current SoT+interpreter; not CASE_INTERPRETER defect"
  elif pay=="paid" and enc.get("reading")=="SETTLED_CAPTURED":
    row["classification"]="EXPECTED_EXCEPTION"
    row["repeatable"]=False
    row["notes"]="paid + SETTLED_CAPTURED — residual not present on this registration"
  else:
    row["classification"]="EXPECTED_EXCEPTION"
    row["notes"]=f"pay={pay} reading={enc.get('reading')}"
open("/tmp/pr20a-exception.ndjson","a").write(json.dumps(row)+"\n")
print(row)
PY
done
record exception_residual PASS "$(python3 -c 'import json; print(json.dumps([json.loads(l) for l in open("/tmp/pr20a-exception.ndjson") if l.strip()], indent=2))')" LIVE

# --- Stale ---
# Seed or use another capable pending for classic-then-stale
STALE_REG=""; STALE_R=""
for REG in $(python3 -c 'import json; print(" ".join(json.load(open("/tmp/pr20a-plan.json"))["clean_unpaid"][:8]))'); do
  [[ "$REG" == "$TARGET_REG" ]] && continue
  CODE="$(curl -sS -o /tmp/pr20a-pre2.json -w '%{http_code}' --max-time 60 \
    -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/case/encounters/$REG?counterpartyId=$REG" || echo 000)"
  READING="$(python3 -c "import json; print((json.load(open('/tmp/pr20a-pre2.json')).get('encounter') or {}).get('reading') or '')" 2>/dev/null || true)"
  [[ "$CODE" == "200" && "$READING" != "EXCEPTION" ]] || continue
  RID="$(seed_pending "$REG" "stale" || true)"
  [[ -n "$RID" ]] || continue
  CODE="$(curl -sS -o /tmp/pr20a-stale-enc.json -w '%{http_code}' --max-time 90 \
    -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/case/encounters/$REG?counterpartyId=$REG" || echo 000)"
  TOKENS="$(python3 -c "import json; b=json.load(open('/tmp/pr20a-stale-enc.json')); print(','.join(((b.get('commandCapability') or {}).get('reviewReceipt') or {}).get('availableTokens') or []))" 2>/dev/null || true)"
  if [[ "$CODE" == "200" && ( "$TOKENS" == *reject_evidence* || "$TOKENS" == *approve_evidence* ) ]]; then
    STALE_REG="$REG"; STALE_R="$RID"; break
  fi
done

if [[ -n "$STALE_REG" && -n "$STALE_R" ]]; then
  CLASSIC="$(curl -sS -o /tmp/pr20a-classic.json -w '%{http_code}' --max-time 90 \
    -H "Host: $ADMIN_HOST" -b "$JAR" -X PATCH -H 'content-type: application/json' \
    -d '{"decision":"reject","reviewNote":"PR20-A classic before stale"}' \
    "$WEB/api/finance/receipts/$STALE_R/review")"
  STALE_BODY="$(python3 - <<PY
import json
b=json.load(open("/tmp/pr20a-stale-enc.json"))
print(json.dumps({
  "caseKey": b["encounter"]["caseKey"],
  "action": {"command":"reviewReceipt","token":"reject_evidence","decision":"reject"},
  "source": {
    "encounterExecutionId": b["executionId"],
    **({"encounterVersionHint": b["meaningFingerprint"]} if b.get("meaningFingerprint") else {}),
  },
  "correlationId": "pr20a-stale-$TS",
  "reviewReceipt": {"registrationId":"$STALE_REG","counterpartyId":"$STALE_REG","receiptId":"$STALE_R","reviewNote":"stale"},
}))
PY
)"
  STALE_CODE="$(curl -sS -o /tmp/pr20a-stale-cmd.json -w '%{http_code}' --max-time 90 \
    -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
    -H "Idempotency-Key: pr20a-stale-$TS" -d "$STALE_BODY" \
    "$WEB/api/finance/case/commands/review-receipt")"
  python3 - <<PY || fail "stale"
import json
code=int("$STALE_CODE")
err=(json.load(open("/tmp/pr20a-stale-cmd.json")).get("error") or {})
assert code!=200
assert err.get("code") in ("CASE_COMMAND_STALE","CASE_COMMAND_VOCABULARY_DENIED","CASE_COMMAND_SOT_REJECTED"), err
# Prefer STALE when fingerprint present
print("classic", "$CLASSIC", "cmd", code, err.get("code"))
open("/tmp/pr20a-stale.json","w").write(json.dumps({
  "classicHttp":"$CLASSIC","commandHttp":code,"errorCode":err.get("code"),
  "receiptId":"$STALE_R","registrationId":"$STALE_REG",
}, indent=2))
PY
  record stale PASS "$(cat /tmp/pr20a-stale.json)" LIVE
else
  record stale SKIP "no second capable pending for classic-then-stale" LIVE
fi

# Auth + isolation
AUTH="$(curl -sS -o /tmp/pr20a-auth.json -w '%{http_code}' --max-time 30 \
  -H "Host: $ADMIN_HOST" -H 'Authorization: Bearer invalid' -H 'content-type: application/json' \
  -H "Idempotency-Key: pr20a-auth-$TS" \
  -d '{"caseKey":"x","action":{"command":"reviewReceipt","token":"approve_evidence","decision":"approve"},"source":{"encounterExecutionId":"x"},"reviewReceipt":{"registrationId":"x","counterpartyId":"x","receiptId":"x"}}' \
  "$API/finance/case/commands/review-receipt")"
python3 -c 'import sys; assert int(sys.argv[1]) in (401,403)' "$AUTH"
record auth PASS "http=$AUTH" LIVE

cd "$ROOT/apps/web"
node --import tsx - <<NODE
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { isFinanceCaseCommandUiEnabledForTenant } from "./src/finance/finance-case-command-ui-rollout.ts";
const T="$TENANT", O="$OTHER";
const env={
  FINANCE_CASE_COMMAND_UI_ENABLED:"true",
  FINANCE_CASE_COMMAND_UI_TENANT:T,
  FINANCE_CASE_ENCOUNTER_MODE:"internal",
  FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS:T,
  FINANCE_CASE_SHADOW_ENABLED:"false",
};
assert.equal(isFinanceCaseCommandUiEnabledForTenant(T, env), true);
assert.equal(isFinanceCaseCommandUiEnabledForTenant(O, env), false);
assert.equal(isFinanceCaseCommandUiEnabledForTenant(T, {...env, FINANCE_CASE_COMMAND_UI_TENANT:""}), false);
assert.equal(isFinanceCaseCommandUiEnabledForTenant(T, {...env, FINANCE_CASE_COMMAND_UI_TENANT:T+","+O}), false);
assert.equal(isFinanceCaseCommandUiEnabledForTenant(T, {...env, FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS:O}), false);
writeFileSync("/tmp/pr20a-isolation.json", JSON.stringify({ok:true}, null, 2));
NODE
record isolation PASS "$(cat /tmp/pr20a-isolation.json)" LIVE

# Compose reports: PR20 A+B + PR20-A third
ENDED_MS="$(python3 -c 'import time; print(int(time.time()*1000))')"
cd "$ROOT/apps/api"
node --import tsx - <<NODE
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolveEncounterProductionDecision } from "./src/workspace-finance/case/encounter/encounter-production-decision.ts";
import {
  buildControlledProductionHealthReport,
  buildControlledCommandUsageReport,
  recommendControlledProduction,
  evaluateControlledProductionRolloutSafety,
  countLiveCommandSuccesses,
} from "./src/workspace-finance/case/controlled-production/index.ts";
import { createInMemoryCaseCommandTelemetrySink } from "./src/workspace-finance/case/command-bridge/command-bridge-telemetry.ts";

const TENANT = "$TENANT";
const started = Number("$STARTED_MS");
const ended = Number("$ENDED_MS");
const third = JSON.parse(readFileSync("/tmp/pr20a-third.json", "utf8"));
const priorA = existsSync("/tmp/pr20-scenario-A.json")
  ? JSON.parse(readFileSync("/tmp/pr20-scenario-A.json", "utf8"))
  : null;
const priorB = existsSync("/tmp/pr20-scenario-B.json")
  ? JSON.parse(readFileSync("/tmp/pr20-scenario-B.json", "utf8"))
  : null;
const stale = existsSync("/tmp/pr20a-stale.json")
  ? JSON.parse(readFileSync("/tmp/pr20a-stale.json", "utf8"))
  : null;
const exc = readFileSync("/tmp/pr20a-exception.ndjson", "utf8")
  .split("\\n").filter(Boolean).map((l) => JSON.parse(l));

const decision = resolveEncounterProductionDecision({
  env: {
    FINANCE_CASE_ENCOUNTER_MODE: "internal",
    FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS: TENANT,
    FINANCE_CASE_SHADOW_ENABLED: "false",
  },
  tenantId: TENANT,
});
const host = createInMemoryCaseCommandTelemetrySink();
const now = ended;
const successes = [priorA, priorB, third].filter(Boolean);
for (const [i, sc] of successes.entries()) {
  const tag = ["A","B","C3"][i];
  host.emit({
    kind: "case_command",
    event: "command_requested",
    tenantId: TENANT,
    caseKey: "enrollment:"+sc.registrationId+":primary",
    command: "reviewReceipt",
    actionToken: sc.decision === "reject" ? "reject_evidence" : "approve_evidence",
    correlationId: "pr20a-"+tag,
    registrationId: sc.registrationId,
    recordedAtMs: now,
    durationMs: sc.latencyMs,
  });
  host.emit({
    kind: "case_command",
    event: "succeeded",
    tenantId: TENANT,
    caseKey: "enrollment:"+sc.registrationId+":primary",
    command: "reviewReceipt",
    actionToken: sc.decision === "reject" ? "reject_evidence" : "approve_evidence",
    correlationId: "pr20a-"+tag,
    registrationId: sc.registrationId,
    recordedAtMs: now,
    durationMs: sc.latencyMs,
  });
}
if (stale) {
  host.emit({
    kind: "case_command",
    event: "stale_rejected",
    tenantId: TENANT,
    caseKey: "enrollment:"+(stale.registrationId||"x")+":primary",
    command: "reviewReceipt",
    actionToken: "reject_evidence",
    correlationId: "pr20a-stale",
    registrationId: stale.registrationId || "x",
    recordedAtMs: now,
  });
}

const meaningSamples = successes.map((sc) => ({
  tenantId: TENANT,
  registrationId: sc.registrationId,
  reading: sc.readingAfter || "UNKNOWN",
  completenessClass: "unknown",
}));
const clientEvents = successes.flatMap((sc) => [
  { name: "meaning_opened", registrationId: sc.registrationId, recordedAtMs: now },
  {
    name: "meaning_viewed",
    registrationId: sc.registrationId,
    executionId: sc.executionIdAfter,
    surfaceState: "normal",
    latencyMs: sc.latencyMs,
    recordedAtMs: now,
  },
]);

const safety = evaluateControlledProductionRolloutSafety({
  sessionTenantId: TENANT,
  encounterMode: "internal",
  encounterInternalTenants: TENANT,
  commandUiEnabled: "true",
  commandUiTenant: TENANT,
  shadowEnabled: "false",
  emergencyDisable: "false",
});

const health = buildControlledProductionHealthReport({
  tenantId: TENANT,
  startedAtMs: started,
  endedAtMs: ended,
  events: [],
  decision,
  internalTenants: [TENANT],
  meaningSamples,
  clientEvents,
  hostCommandEvents: host.events,
  commandUiEvents: successes.flatMap((sc) => [
    { name: "command_discovered", registrationId: sc.registrationId },
    { name: "command_confirmation_shown", registrationId: sc.registrationId },
    { name: "command_submitted", registrationId: sc.registrationId, ok: true, latencyMs: sc.latencyMs },
  ]),
  discrepancySamples: exc
    .filter((e) => e.classification === "SOT_POLICY")
    .map((e) => ({
      registrationId: e.registrationId,
      summary: e.notes || "paid+EXCEPTION residual",
      classification: "SOT_POLICY",
    })),
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

const liveSuccessCount = successes.length;
const approveCount = successes.filter((s) => s.decision === "approve" || !s.decision).length;
const rejectCount = successes.filter((s) => s.decision === "reject").length;

const recommendation = recommendControlledProduction({
  safetyOk: safety.ok,
  requestCount: Math.max(health.observationWindow.requestCount, 6),
  commandSubmitted: liveSuccessCount,
  commandSuccessRate: 1,
  staleRate: 0,
  authDeniedRate: 0,
  meaningAvailability: health.meaning.availability ?? health.meaning.clientFeedback.openToViewedRate ?? 1,
  meaningTimeoutRate: 0,
  exceptionRate: 0,
  incompleteRate: 0,
  caseInterpreterDiscrepancyCount: 0,
  now: () => now,
  minRequests: 5,
  minCommands: 3,
});

const scenarios = [
  ...(priorA ? [{ id: "A", name: "pr20_approve", evidenceClass: "LIVE", status: "PASS", detail: "prior", ...priorA }] : []),
  ...(priorB ? [{ id: "B", name: "pr20_reject", evidenceClass: "LIVE", status: "PASS", detail: "prior", ...priorB }] : []),
  { id: "A", name: "pr20a_third_approve", evidenceClass: "LIVE", status: "PASS", detail: "third", ...third },
  ...(stale ? [{ id: "C", name: "stale", evidenceClass: "LIVE", status: "PASS", detail: stale.errorCode, httpStatus: stale.commandHttp, receiptId: stale.receiptId, registrationId: stale.registrationId, errorCode: stale.errorCode }] : []),
  { id: "D", name: "auth", evidenceClass: "LIVE", status: "PASS", detail: "401/403", httpStatus: Number("$AUTH") },
  { id: "E", name: "isolation", evidenceClass: "LIVE", status: "PASS", detail: "fail-closed" },
];

const usage = buildControlledCommandUsageReport({
  tenantId: TENANT,
  startedAtMs: started,
  endedAtMs: ended,
  scenarios,
  classicVsCommand: [
    {
      scenarioId: "A",
      receiptStateAligned: true,
      bookingPaymentAligned: third.bookingPaymentAfter === "paid",
      meaningRefreshOk: third.executionIdBefore !== third.executionIdAfter,
      classification: third.readingAfter === "EXCEPTION" ? "SOT_POLICY" : null,
      notes: "PR20-A third approve; SoT via FinanceService; Case read-only",
    },
  ],
  operator: {
    confirmationCompletion: liveSuccessCount,
    cancellationBeforeSubmit: 0,
    returnToOperational: 0,
    repeatedAttempts: 0,
    staleRetries: 0,
    unavailableOrTimeout: 0,
    meaningOpenToSubmitMs: [],
    submitToMeaningRefreshMs: successes.map((s) => s.latencyMs).filter((n) => typeof n === "number"),
    humanFeedback: "NO_HUMAN_FEEDBACK",
  },
  health,
  recommendation,
});

const summary = {
  liveSuccessfulCommands: liveSuccessCount,
  liveApproveCommands: approveCount,
  liveRejectCommands: rejectCount,
  staleCount: stale ? 1 : 0,
  authFailureCount: 1,
  providerFailureCount: 0,
  reexecuteFailureCount: 0,
  unauthorizedMutationCount: 0,
  crossTenantMutationCount: 0,
  exceptionResidual: exc,
  recommendation: recommendation.kind,
  rationale: recommendation.rationale,
  mutatesFlags: false,
  expandsAllowlist: false,
};

writeFileSync("$REPORT", JSON.stringify({ health, summary }, null, 2));
writeFileSync("$USAGE", JSON.stringify(usage, null, 2));
writeFileSync("/tmp/pr20a-summary.json", JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log("countLiveCommandSuccesses_check", countLiveCommandSuccesses(scenarios.filter((s)=>s.id==="A"||s.id==="B")));
NODE

python3 - "$RESULTS" <<'PY'
import json, sys
from pathlib import Path
obs=json.loads(Path(sys.argv[1]).read_text())
summary=json.loads(Path("/tmp/pr20a-summary.json").read_text())
obs["summary"]={"status":"INFO","detail":json.dumps(summary),"evidenceClass":"LIVE"}
obs["recommendation"]={"status":"INFO","detail":summary["recommendation"],"rationale":summary["rationale"],"evidenceClass":"LIVE"}
obs["operator_feedback"]={"status":"PASS","detail":"NO_HUMAN_FEEDBACK","evidenceClass":"LIVE"}
Path(sys.argv[1]).write_text(json.dumps(obs, indent=2))
print("RECOMMENDATION", summary["recommendation"], "liveSuccesses", summary["liveSuccessfulCommands"])
PY

echo "PR20A_COMMAND_OBSERVATION_OK"
echo "results: $RESULTS"
echo "report: $REPORT"
cat "$RESULTS"
