# Finance Case Validation Runbook (PR15-A / PR15-B)

```yaml
doc_id: FINANCE_CASE_VALIDATION_RUNBOOK
version: "2026-08-08-v10"
status: RUNBOOK
phase: PR15-A…PR20-B (SoT paid-vs-remaining policy gate)
related:
  - docs/phase-20/p7/appendices/FINANCE_CASE_COMMAND_BRIDGE.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_INTERPRETER_BOUNDARY.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_OPERATOR_ENCOUNTER_HARDENING.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_OPERATOR_EXPERIENCE.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_INTERNAL_ROLLOUT.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_ENCOUNTER_FACT_COVERAGE_CALIBRATION.md
  - scripts/pr15b-denali-finance-stage1-smoke.sh
  - scripts/pr15c-denali-encounter-pilot-smoke.sh
  - scripts/pr18c-denali-command-ui-smoke.sh
  - scripts/pr19-denali-controlled-production-observation.sh
  - scripts/pr20-denali-controlled-command-usage.sh
  - scripts/pr20a-denali-command-observation-completion.sh
  - docs/phase-20/p7/appendices/FINANCE_CASE_SOT_PAID_VS_REMAINING_POLICY.md
```

## Purpose

Close validation gaps **before** product integration (UI buttons, command BFF, Command Center merge).

Hard locks:

- finance-core unchanged during validation
- Case remains ephemeral / read-only interpretation
- FinanceService remains SoT mutation authority
- No Case persistence
- No UI mutation actions in this phase

---

## Prerequisites

| Item | Requirement |
| ---- | ----------- |
| API | `@apps/api` listening on `PORT` (default **3001**) |
| Web | `@apps/web` on **3000** (optional for Stage 1 browser; required for Encounter UI Stage 2) |
| Env files | `apps/api/.env` + `apps/api/.env.local` present (copy from `*.example` if missing) |
| Database | When `DATABASE_URL` set: Postgres reachable (dev compose). Boot logs `CONSISTENCY_OK` then `@apps/api listening` |
| Denali web plugin (web unit tests) | `ALLOW_DENALI_WEB_PLUGIN=1` for `finance-page.spec.ts` / plugin bootstrap |
| Operator session | Valid operator JWT/cookies for live HTTP (dev bootstrap) |

### Discoverable finance routes (validation inventory)

From `@app-tour/finance-http` `FINANCE_HTTP_ROUTE_MANIFEST` (Denali `httpRoutes` codegen):

| Method | Path | Stage |
| ------ | ---- | ----- |
| GET | `/finance/reports/summary` | 1 |
| GET | `/finance/payments` | 1 |
| POST | `/finance/payments/manual` | 1 |
| POST | `/finance/receipts` | 1 |
| GET | `/finance/receipts/pending` | 1 |
| PATCH | `/finance/receipts/:receiptId/review` | 1 |
| GET | `/finance/case/encounters/:registrationId` | 2 |
| POST | `/finance/case/commands/review-receipt` | 4 (API only; **no web BFF yet**) |

Web BFF mirrors under `apps/web/app/api/finance/**` (Encounter GET exists; **command POST BFF deferred**).

### Finance hub bootstrap

| Concern | SoT |
| ------- | --- |
| Hub availability | `capabilities.financeNav.supported` (Denali plugin: `true`) |
| Tab visibility | `capabilities.financeOps.resolveManifest(theme)` → panels |
| Default Denali panels | overview, payments, receipts, prepayments, installments, ledger — all **on** |
| Route | `/finance` → `FinanceCommandCenter` |

Do **not** change production finance behavior for validation.

---

## Required env flags

### Stage 1 — all Case off

```bash
# Unset or explicitly disabled:
# FINANCE_CASE_ENCOUNTER_MODE=   (omit)
# FINANCE_CASE_ENCOUNTER_ENABLED=  (omit / false)
# FINANCE_CASE_SHADOW_ENABLED=     (omit / false)
# FINANCE_CASE_PAYMENT_MODE=       (omit; Case composition defaults manual when Encounter off)
```

Defaults (empty env): Encounter **disabled**, Shadow **false**.

### Stage 2 — Encounter pilot only

```bash
FINANCE_CASE_ENCOUNTER_MODE=pilot
FINANCE_CASE_ENCOUNTER_PILOT_TENANTS=<test-tenant-id>
# Do NOT set FINANCE_CASE_SHADOW_ENABLED
# Do NOT call command bridge
```

Optional:

```bash
FINANCE_CASE_ENCOUNTER_TIMEOUT_MS=8000
# Emergency / hold (must stay off for happy path):
# FINANCE_CASE_ENCOUNTER_EMERGENCY_DISABLE=
# FINANCE_CASE_ENCOUNTER_HEALTH_HOLD=
```

### Stage 3 — Shadow

```bash
FINANCE_CASE_SHADOW_ENABLED=1
FINANCE_CASE_SHADOW_TENANTS=<internal-tenant-a>,<internal-tenant-b>   # required; empty fails closed
# When MODE=internal, tenants must also be on FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS
# FINANCE_CASE_SHADOW_SAMPLE_RATE=1
# FINANCE_CASE_SHADOW_TRIGGERS=                 # empty = all triggers
# See FINANCE_CASE_SHADOW_COMPARISON.md (PR16-B)
```

Keep Encounter pilot flags if also validating read path.

### Stage 4 — Command bridge API

```bash
# Encounter should be usable for source executionId / meaningFingerprint:
FINANCE_CASE_ENCOUNTER_MODE=pilot
FINANCE_CASE_ENCOUNTER_PILOT_TENANTS=<test-tenant-id>
# Shadow optional
```

Call Host API directly (no UI / no BFF):

`POST /finance/case/commands/review-receipt`  
Approve requires `Idempotency-Key`.

---

## Stage 1 — Finance regression (Case disabled)

**Goal:** Production Denali finance works; Case does not execute.

### Steps

1. Confirm API listen: `curl -sS http://127.0.0.1:3001/ready` (or health endpoint used by deploy).
2. Open `/finance` as operator (Denali tenant).
3. Payments tab → create manual payment.
4. Submit receipt (upload + `POST /finance/receipts` path).
5. Receipts tab → approve and reject (classic `PATCH /finance/receipts/:id/review`).

### Expected

| Outcome | Expect |
| ------- | ------ |
| Hub tabs | Load per financeOps |
| Mutations | FinanceService only |
| Encounter GET | `CASE_ENCOUNTER_DISABLED` / 503 disabled path when flagged off |
| Shadow | No Case provider fan-out |

### Automated proxies

- `apps/api/.../finance.service.spec.ts`
- `apps/web/test/finance-payments-logic.spec.ts`
- `apps/web/test/finance-receipts-logic.spec.ts`
- Encounter hardening: flag off → zero execution

---

## Stage 2 — Encounter pilot

**Goal:** Read-only Case interpretation for allowlisted tenants.

### Steps

1. Set Stage 2 env; restart API.
2. For registrations: pending manual payment, submitted receipt, approved receipt, rejected receipt.
3. UI: `/finance/case/[registrationId]`
4. API/BFF: `GET /api/finance/case/encounters/:registrationId` → `/finance/case/encounters/:registrationId`

### Expected HTTP 200 body keys

**Required:** `encounter`, `executionId`, `surfaceState`, `commandCapability`  
**Optional additive:** `meaningFingerprint`

**Forbidden anywhere in JSON:** `CaseOutput`, `FactSnapshot`, `"facts"`, gateway ids (`pi_*`, stripe customer / webhook payloads).

### Expected behavior

| Check | Expect |
| ----- | ------ |
| Pilot tenant | 200 presentation |
| Non-pilot | disabled / no Case execution |
| Hub | Unchanged; classic review still SoT UI |
| Signals / recon attention | Display only — not ownership verdict |

### Automated proxies

- `encounter-pilot-activation.spec.ts`
- `encounter-production-hardening.spec.ts`
- `finance-case-encounter-ui` `guard:presentation`

---

## Stage 3 — Shadow

**Goal:** Post-success observational Case only.

### Steps

1. Enable `FINANCE_CASE_SHADOW_ENABLED=1` (+ tenant allowlist).
2. Perform FinanceService mutations (receipt submit/approve).
3. Observe logs/metrics sink (fail-open).

### Expected

| Check | Expect |
| ----- | ------ |
| Primary mutation result | Unchanged |
| Shadow failure | Swallowed; no HTTP failure |
| Latency | Shadow scheduled async (`void` / post-success) — must not block mutation response |
| Persistence | No Case tables / Case status |

### Automated proxies

- `finance-case-host-wiring.spec.ts`
- `finance-case-calibration.spec.ts`

---

## Stage 4 — Command bridge API (no UI)

**Goal:** Controlled `reviewReceipt` via Host bridge only.

### Cases

1. Valid approve (Idempotency-Key)
2. Valid reject
3. Unauthorized operator → `CASE_COMMAND_AUTH_DENIED`
4. Stale `source.encounterExecutionId` / meaning fingerprint → `CASE_COMMAND_STALE`
5. SoT rejection → `CASE_COMMAND_SOT_REJECTED` (no fake Case)

### Expected

| Check | Expect |
| ----- | ------ |
| Order | Authz → preflight → stale → vocabulary → SoT → postflight |
| Success body | Fresh Encounter presentation + `executionId` |
| Leakage | No Prisma/gateway internals in error messages |
| Classic UI | Still uses `PATCH .../review` (unchanged) |

### Automated proxies

- `finance-case-command-bridge.spec.ts`
- `finance-case-command-bridge-architecture.spec.ts`
- `finance-case-command-bridge-production.spec.ts`

---

## Rollback procedure

1. **Unset / disable Case flags** (Encounter MODE omit or `disabled`; Shadow off; Emergency disable optional).
2. **Restart API** — confirm Encounter GET returns disabled; hub classic finance still works.
3. **Do not** roll back FinanceService schema or receipt APIs for Case issues.
4. If API boot fails after Case-related edits: revert Case Host wiring only; production finance composition (`createFinanceService`) must remain green.
5. `FINANCE_CASE_ENCOUNTER_EMERGENCY_DISABLE=1` — fail-closed Encounter without touching mutation SoT.

---

## API :3001 unavailable — investigation notes (PR15-A)

Observed root cause class (not Finance Case):

| Finding | Detail |
| ------- | ------ |
| Env present | `apps/api/.env` and `.env.local` exist; `PORT=3001` loads |
| Clean boot | `pnpm run dev` reaches `CONSISTENCY_OK` then `@apps/api listening` on 3001 within ~1s when Postgres available |
| Prior “unavailable” | Terminal session showed `pnpm run dev` as running but **no LISTEN on :3001** — hung/orphaned shell after `fuser -k 3001` / incomplete restart |
| Not Case flags | Default Case flags are off; boot path does not require Encounter |

**Operator fix:** kill stale listeners (`fuser -k 3001/tcp`), ensure DB up, `cd apps/api && pnpm run dev`, wait for `listening` log. Isolate from Finance Case PRs.

---

## Ready for live Stage 1?

Checklist:

- [x] API listens on 3001
- [x] Operator can open `/finance`
- [x] All `FINANCE_CASE_*` unset / Encounter MODE=disabled / Shadow=false
- [x] Manual payment + receipt + classic review succeed once

Then proceed Stage 2 pilot on a single tenant **only after Architect YES**.

---

## PR15-B — Denali live smoke (executed 2026-08-07)

### Boot

| Item | Result |
| ---- | ------ |
| Command | `cd apps/api && FINANCE_CASE_ENCOUNTER_MODE=disabled FINANCE_CASE_SHADOW_ENABLED=false pnpm run dev` |
| Required env | `apps/api/.env` + `.env.local` (`PORT=3001`, `DATABASE_URL`, `STORAGE_DRIVER=prisma`, JWT keys, `AUTH_ALLOW_DEV_STATIC_OTP=true`). **No** `FINANCE_CASE_*` required for boot. |
| Health | `GET http://127.0.0.1:3001/health` → `{"status":"ok","checks":{"database":{"status":"ok"}}}` |
| Case flags in process | `FINANCE_CASE_ENCOUNTER_MODE=disabled`, `FINANCE_CASE_SHADOW_ENABLED=false` |
| Startup failures | Prior “:3001 unavailable” = hung/orphan `dev` after incomplete kill — **not** missing Case flags. Clean restart listens. |

### Routes discovered (live, Denali tenant `…000003`)

| Route | Live result |
| ----- | ----------- |
| `GET /finance/reports/summary` | 200 |
| `GET /finance/payments` | 200 |
| `GET /finance/receipts/pending` | 200 |
| `GET /finance/case/encounters/:id` | **503** `CASE_ENCOUNTER_DISABLED` (zero Case execution) |
| `POST /finance/case/commands/review-receipt` | Registered (empty body ≠ 404; Stage 4 only) |

Denali capability: `financeNav.supported=true`; default `financeOps` panels overview/payments/receipts/prepayments/installments/ledger all **on**.

### Stage 1 actions (PASS/FAIL)

| Action | Status | Notes |
| ------ | ------ | ----- |
| `/finance` hub loads | **PASS** | `finance-command-center` + title مرکز مالی; tab tokens present |
| Finance tabs / manifest | **PASS** | overview, payments, receipts, prepayments, installments, ledger |
| Create manual payment | **PASS** | `POST /api/finance/payments/manual` → 201 |
| Receipt upload | **PASS** | Raw `Content-Type: image/jpeg` + `x-receipt-file-name` (multipart `-F` → `RECEIPT_PROOF_CONTENT_TYPE_INVALID`) |
| Submit receipt | **PASS** | `POST /api/finance/receipts` → 201 |
| Review approve | **PASS** | `PATCH .../review` requires `Idempotency-Key` on approve |
| Review reject | **PASS** | 200 `Rejected` |
| Booking payment sync | **PASS** | approve → `bookingPaymentStatus=paid`; booking list unpaid→paid |
| FinanceService owns mutation | **PASS** | payloads have payment/receipt ids; no `encounter` / CaseOutput |
| Case disabled zero execution | **PASS** | Encounter 503 before & after mutations; no CaseOutput leakage |

Helper: [`scripts/pr15b-denali-finance-stage1-smoke.sh`](../../../../scripts/pr15b-denali-finance-stage1-smoke.sh) (validation only; does **not** enable Case flags).

### Stage 2 readiness (pilot **not** enabled)

| Check | Status |
| ----- | ------ |
| Encounter route in `FINANCE_HTTP_ROUTE_MANIFEST` | Ready |
| Pilot mode + `FINANCE_CASE_ENCOUNTER_PILOT_TENANTS` allowlist code | Ready |
| Live Encounter while Stage 1 flags hold | Remains **503 disabled** |

### Operator notes from live run

1. Admin host: `denali.admin.localhost:3000` · OTP `09174070937` / `1234` · cookie `atour_op_session`.
2. Approve review needs `Idempotency-Key`; reject may succeed without (SoT rule on approve).
3. Receipt upload: send **raw image bytes**, not `multipart/form-data`, unless UI already converts (BFF forwards body as-is).
4. Encounter disabled reason string may read `(emergency_disabled)` when `MODE=disabled` — naming quirk in production decision mapper; still means Case off (not an emergency flag set).

### Remaining blockers before Encounter pilot

1. Architect explicit YES to enable `FINANCE_CASE_ENCOUNTER_MODE=pilot` + pilot tenant allowlist.
2. Choose single Denali tenant id for allowlist (dev club `…000003` or dedicated pilot).
3. Confirm observation/telemetry sink destination for pilot window (report-only).
4. Do **not** enable shadow or command UI in the same step.

---

## PR15-C — Denali Encounter pilot activation (executed 2026-08-07)

### Pilot selection

| Item | Value |
| ---- | ----- |
| Pilot tenant | `00000000-0000-4000-8000-000000000003` (Denali club / `denali.admin.localhost`) |
| Mode | `FINANCE_CASE_ENCOUNTER_MODE=pilot` |
| Allowlist | `FINANCE_CASE_ENCOUNTER_PILOT_TENANTS=00000000-0000-4000-8000-000000000003` |
| Explicitly **not** set | `FINANCE_CASE_SHADOW_ENABLED`, sampled/full/internal modes, command UI, emergency disable |

### Boot

```bash
cd apps/api
fuser -k 3001/tcp 2>/dev/null || true
FINANCE_CASE_ENCOUNTER_MODE=pilot \
FINANCE_CASE_ENCOUNTER_PILOT_TENANTS=00000000-0000-4000-8000-000000000003 \
FINANCE_CASE_SHADOW_ENABLED=false \
pnpm run dev
```

Helper: [`scripts/pr15c-denali-encounter-pilot-smoke.sh`](../../../../scripts/pr15c-denali-encounter-pilot-smoke.sh)

### Isolation contract

| Tenant | Expect |
| ------ | ------ |
| Pilot `…000003` | Encounter GET **200** presentation DTO |
| Non-pilot | **503** `CASE_ENCOUNTER_DISABLED` with reason `tenant_not_allowed` (or equivalent excluded) — **zero** Case execution |

### Read-only surface checks

Required body keys: `encounter`, `executionId`, `surfaceState`, `commandCapability`  
Optional: `meaningFingerprint`  
Forbidden: `CaseOutput`, `FactSnapshot`, `"facts"`, `pi_*` / webhook / provider DTOs  

`executionId` must change across refreshes (ephemeral Case).

### Classic finance while pilot on

Mutations must continue via FinanceService without Encounter requirement (create payment / submit / review).

### Recommendation field

Record live: **HOLD** / **CONTINUE** / **EXPAND** — no auto-adjust of rollout flags.

### Live results (2026-08-07)

| Check | Result |
| ----- | ------ |
| Pilot flags in process | `MODE=pilot`, `PILOT_TENANTS=…000003`, `SHADOW=false` |
| Encounter GET (pilot) | **200** ~20–25ms; keys `encounter`, `executionId`, `surfaceState`, `commandCapability`, `meaningFingerprint` |
| `executionId` refresh | **Changes** each request (ephemeral) |
| Leakage | **None** (no CaseOutput / FactSnapshot / gateway ids) |
| Non-pilot isolation | **503** `CASE_ENCOUNTER_DISABLED (tenant_not_allowed)`; zero Case execution |
| Scenario A (live manual) | Presentation OK; reading often `INCOMPLETE_INSPECT` / `surfaceState=incomplete` (fact coverage inspect-forced — observe; do not invent verdicts) |
| Scenario B (online) | Fixture suite **PASS**; live `FINANCE_CASE_PAYMENT_MODE` unset (manual) |
| Scenario C (degradation) | Fixture suite **PASS** |
| Classic finance while pilot | create / upload / submit / approve **PASS**; booking sync paid; no Encounter required |
| Shadow | Remains **false** |
| Telemetry sink | Default sink **unset** at boot (fail-open); decisions + HTTP latency captured manually |

**Recommendation: CONTINUE** — keep single-tenant pilot; do **not** expand allowlist / enable shadow / wire command UI until incomplete-fact rate is calibrated and a production telemetry sink is optionally wired (report-only).

---

## PR15-D — Fact coverage calibration

See [`FINANCE_CASE_ENCOUNTER_FACT_COVERAGE_CALIBRATION.md`](./FINANCE_CASE_ENCOUNTER_FACT_COVERAGE_CALIBRATION.md).

Live pilot samples (n=9) were **100%** `INCOMPLETE_INSPECT` / `inspect_forced`, all caused by **obligation_amount_unread** (`money_meaning_unknown`). Root cause: Denali tour canonical stores pricing under `data.pricing.*`, while `resolveDenaliRegistrationObligationMinor` reads root `pricing.*` → null obligation → Host money facts all unknown. Interpreter behavior is **correct**; adapter mapping must be fixed before expand.

**Recommendation: FIX adapter coverage** (keep pilot; do not expand allowlist).

---

## PR15-E — Denali obligation adapter coverage fix

See [`FINANCE_CASE_ENCOUNTER_FACT_COVERAGE_CALIBRATION.md`](./FINANCE_CASE_ENCOUNTER_FACT_COVERAGE_CALIBRATION.md) §PR15-E.

| Lock | Status |
| ---- | ------ |
| finance-core / interpreter / CaseOutput / EncounterView | unchanged |
| Completeness semantics | unchanged (unknown money still inspect) |
| Allowlist / shadow / command UI | unchanged (pilot only) |

**Fix:** `unwrapDenaliTourCanonicalDocument` + obligation/collection resolvers read `pricing.*` on unwrapped document.

**Live expectations:**

- A — known pricing + pending payment → obligation known; incompleteness not forced by `obligation_amount_unread`
- B — receipt submitted → evidence/payment unchanged; obligation now available
- C — missing pricing → still `INCOMPLETE_INSPECT`

**Recommendation: CONTINUE** single-tenant pilot after live re-calibration; do not expand.

---

## PR15-F — Continue Denali Encounter pilot validation

See [`FINANCE_CASE_ENCOUNTER_PILOT_VALIDATION.md`](./FINANCE_CASE_ENCOUNTER_PILOT_VALIDATION.md).

Observation-only on existing pilot (`MODE=pilot`, tenant `…000003`, shadow=false, no command UI). finance-core unchanged.

**Live (n=9):**

| Signal | Result |
| ------ | ------ |
| Incomplete rate | **11%** (1/9) — was 100% pre-PR15-E |
| `obligation_unread` | **0** |
| Verdict mix | SETTLED_CAPTURED×3, INTENT_OPEN_NO_PROOF×2, AWAITING_FINANCE×1, CLOSED_IDLE×1, AWAITING_COUNTERPARTY×1, INCOMPLETE_INSPECT×1 |
| Completeness | act_complete×1, wait_complete×8, inspect_forced×0 |
| Refresh | `executionId` changes; `meaningFingerprint` + reading stable; no leakage |
| Residual `…0523` | `no_rule_matched`: settlement `captured` + remaining `900000` + `partialScopeDeclared=false` (adapter coherence candidate; not obligation envelope) |

**Recommendation: CONTINUE** — not HOLD; not READY_FOR_INTERNAL until residual paid/remaining class + ledger degradation characterized.

---

## PR15-G — Paid-with-remaining calibration

See [`FINANCE_CASE_PAID_WITH_REMAINING_CALIBRATION.md`](./FINANCE_CASE_PAID_WITH_REMAINING_CALIBRATION.md).

| Classification | Detail |
| -------------- | ------ |
| SoT | Booking `paid` on receipt approve while invoice paid `1600000` / due `2500000` |
| Adapter gap | Host never emitted `meaningConflictProven` for paid + positive remaining |
| Portable category | Existing `exceptionCues.meaningConflict` → `EXCEPTION` (no new CaseReading) |
| Fix | Host coherence helper + `readLifecycle` sets conflict cue; no finance-core mutation; no partial fabrication |

**Recommendation: CONTINUE** after live `…0523` reads `EXCEPTION`.

---

## PR15-H — Optional ledger degradation

See [`FINANCE_CASE_LEDGER_DEGRADATION.md`](./FINANCE_CASE_LEDGER_DEGRADATION.md).

| Decision | Detail |
| -------- | ------ |
| Verdict dependency | Ledger **not** required |
| Completeness | Optional audit cues never force inspect |
| Live | Incomplete **0%** with optional ledger often degraded under parallel assemble |
| Telemetry | `provider_degradation` events (frequency / tenant / reason / optional flag) |
| Adapter FIX | Deferred (concurrent RLS + journal aggregateId match) — non-blocking |
| Rollout | **ACCEPT degradation** → **CONTINUE** pilot; not HOLD; no expand / shadow / command UI |

---

## PR16-A — Controlled internal rollout preparation

See [`FINANCE_CASE_INTERNAL_ROLLOUT.md`](./FINANCE_CASE_INTERNAL_ROLLOUT.md).

| Item | Status |
| ---- | ------ |
| Modes | `disabled` / `pilot` / `internal` (empty allowlist fail closed; emergency disable) |
| Health report | availability, latency, verdict/completeness distributions, exception rate, provider degradation, authz |
| Multi-tenant | allowlisted Denali + excluded urban isolation proofs |
| Shadow / command UI | false |
| Recommendation | **READY_FOR_INTERNAL** (manual flag flip; no auto-apply) |

---

## PR17-C — Commercial Meaning internal read + feedback calibration

See [`FINANCE_CASE_OPERATOR_EXPERIENCE.md`](./FINANCE_CASE_OPERATOR_EXPERIENCE.md) §PR17-C and [`FINANCE_CASE_INTERNAL_ROLLOUT.md`](./FINANCE_CASE_INTERNAL_ROLLOUT.md).

### Activation (manual)

```bash
FINANCE_CASE_ENCOUNTER_MODE=internal
FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS=<allowlisted-tenant-uuids>
FINANCE_CASE_ENCOUNTER_EMERGENCY_DISABLE=false
FINANCE_CASE_SHADOW_ENABLED=false
# Do NOT set sampled/full; do NOT enable command UI
```

Empty `INTERNAL_TENANTS` while `MODE=internal` → **fail closed** (zero Encounter).

### Live checks

| Check | Expect |
| ----- | ------ |
| Allowlisted tenant · Command Center Meaning | GET Encounter 200; Meaning states load; classic Operational tabs unchanged |
| Non-allowlisted tenant | Encounter **503** / Meaning unavailable; **zero** Case execute (`warmFinanceService` / presentation not called) |
| Emergency disable | Even allowlisted → 503; zero Case execute |
| Telemetry sink failure | Request still succeeds (fail-open) |
| Mutation path | FinanceService POST/PATCH routes unchanged; Meaning has no command buttons |

### Collect window → report

1. Capture Meaning client events: `meaning_opened` / `viewed` / `unavailable` / `timeout` / `incomplete` / `degraded` / `operator_returned_to_operational_view`.
2. Capture Encounter Host telemetry + optional verdict samples.
3. Run `buildCommercialMeaningInternalHealthReport` + `calibrateCommercialMeaningFeedback`.
4. Record recommendation (`HOLD` / `CONTINUE` / `READY_FOR_COMMAND_UI_PREP`) — **manual apply only**; never auto-flip flags; never edit interpreter from calibration.

### Rollback

- `FINANCE_CASE_ENCOUNTER_EMERGENCY_DISABLE=1`, or
- `FINANCE_CASE_ENCOUNTER_MODE=disabled` (or `pilot` with pilot allowlist only)

### Proofs

- `apps/api/.../commercial-meaning-internal-rollout.spec.ts`
- `apps/web/test/finance-commercial-meaning-pr17c.spec.ts`

---

## PR18-C — Single-tenant internal Command UI validation

See [`FINANCE_CASE_COMMAND_BRIDGE.md`](./FINANCE_CASE_COMMAND_BRIDGE.md) §PR18-C and [`FINANCE_CASE_OPERATOR_EXPERIENCE.md`](./FINANCE_CASE_OPERATOR_EXPERIENCE.md) §PR18-C.

**Goal:** Validate complete `reviewReceipt` path against **one** Denali tenant. No vocabulary expansion. Classic review path remains.

### Exact rollout configuration

```bash
# API — Encounter internal (unchanged allowlist pattern)
FINANCE_CASE_ENCOUNTER_MODE=internal
FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS=00000000-0000-4000-8000-000000000003
FINANCE_CASE_ENCOUNTER_EMERGENCY_DISABLE=false
FINANCE_CASE_SHADOW_ENABLED=false

# Web (+ BFF gate) — Command UI single tenant only
FINANCE_CASE_COMMAND_UI_ENABLED=true
FINANCE_CASE_COMMAND_UI_TENANT=00000000-0000-4000-8000-000000000003
```

Do **not** set multi-tenant command UI lists (fail closed). Do **not** enable capture/refund/settlement UI.

### Live smoke

```bash
# With API :3001 + web :3000 running under the env above:
bash scripts/pr18c-denali-command-ui-smoke.sh
# Results: /tmp/pr18c-command-ui-smoke.json
```

### Matrix (must capture)

| Scenario | Expect |
| -------- | ------ |
| Happy path | Confirm → BFF → Host → FinanceService; receipt + booking sync; presentation-only response; new `executionId`; Meaning reflects SoT |
| Operational parity | Classic Receipts shows same SoT; no duplicate mutation |
| Stale | Classic mutate then old intent → `CASE_COMMAND_STALE`; no second mutation; Meaning refresh OK |
| Authz | Unauthorized → `CASE_COMMAND_AUTH_DENIED` before SoT write |
| SoT reject | `CASE_COMMAND_SOT_REJECTED`; no fake Case state; Meaning refreshable |
| Rollout isolation | Other tenant / empty / multi-tenant config → Command UI disabled; Encounter allowlist unchanged |
| Regression | Hub / payments / receipts / classic review; Encounter off → no Case execute; no CaseOutput/FactSnapshot/gateway leak |

### Recommendation vocabulary

`CONTINUE` · `HOLD` · `READY_FOR_CONTROLLED_PRODUCTION`

### Live evidence (executed 2026-08-07 / recorded 2026-08-08)

| Item | Evidence |
| ---- | -------- |
| Stack | API `:3001` + web `:3000`; Host `denali.admin.localhost`; operator OTP session |
| Tenant | `00000000-0000-4000-8000-000000000003` |
| Receipt / reg | `…000931` / `…000531` |
| Happy path | HTTP **200**; `approve_evidence` → reading `SETTLED_CAPTURED`; post `executionId` `pr18c-20260807204309:post` |
| SoT before → after | Booking payment **unpaid → paid**; receipt removed from pending list |
| Meaning refresh | `executionId` `e73d57d0-…` → `731774bd-…`; reading `SETTLED_CAPTURED` |
| Stale replay | HTTP **409** `CASE_COMMAND_STALE` (old intent after SoT mutate) |
| Classic then stale | Classic PATCH **200** on `…000932`, then command **409** `CASE_COMMAND_STALE` |
| Authz | Invalid bearer → API **401** (no session / no SoT write) |
| Isolation | Other tenant / empty / comma-list Command UI → disabled (unit + smoke) |
| Regression | `/finance` hub + payments list **200** |
| Artifact | `/tmp/pr18c-command-ui-smoke.json` |

**Automated:**

| Spec | Result |
| ---- | ------ |
| `apps/web/test/finance-case-command-ui-pr18c.spec.ts` | 3/3 pass |
| `apps/api/.../finance-case-command-ui-internal-validation.spec.ts` | 3/3 pass |

**Failure paths covered (live + automated):**

| Path | Coverage |
| ---- | -------- |
| `CASE_COMMAND_STALE` | Live smoke (replay + classic-then-stale) |
| Auth boundary | Live **401**; Host map → `CASE_COMMAND_AUTH_DENIED` in unit |
| `CASE_COMMAND_SOT_REJECTED` / `CASE_COMMAND_REEXECUTE_FAILED` | Host unit (injected bridge; never 200 success) |
| Provider / re-execute UI | Web unit — `parseFinanceCaseCommandClientResult` never `ok` for those codes |
| Fail-closed Command UI | Empty tenant / multi-tenant list → disabled |

**Not exercised live (infrastructure):** forced FinanceService reject mid-flight and live provider_unavailable — covered by Host unit + client parse contracts; no fake Case state on those codes.

### Decision

**READY_FOR_CONTROLLED_PRODUCTION** — keep Command UI enabled for tenant `…000003` only. Do **not** expand vocabulary. Do **not** remove classic review. Do **not** multi-tenant enable.

### Proofs

- `scripts/pr18c-denali-command-ui-smoke.sh` (live) → `/tmp/pr18c-command-ui-smoke.json`
- `apps/web/test/finance-case-command-ui-pr18c.spec.ts`
- `apps/api/.../command-bridge/finance-case-command-ui-internal-validation.spec.ts`

---

## PR19 — Controlled production observation

**Goal:** Observe single-tenant Command UI + Commercial Meaning under controlled production. Report-only readiness gate. **No** vocabulary expand, **no** multi-tenant enable, **no** shadow auto-on, **no** classic-path removal, **no** finance-core / interpreter / FinanceService policy changes.

### Exact rollout (unchanged from PR18-C)

```bash
# API
FINANCE_CASE_ENCOUNTER_MODE=internal
FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS=00000000-0000-4000-8000-000000000003
FINANCE_CASE_SHADOW_ENABLED=false

# Web
FINANCE_CASE_COMMAND_UI_ENABLED=true
FINANCE_CASE_COMMAND_UI_TENANT=00000000-0000-4000-8000-000000000003
# Optional parity for fail-closed mismatch checks (same single tenant):
FINANCE_CASE_ENCOUNTER_MODE=internal
FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS=00000000-0000-4000-8000-000000000003
```

Fail closed: empty / multi Command UI tenant; Encounter↔Command tenant mismatch; emergency disable.

### Observation surfaces

| Domain | Signals |
| ------ | ------- |
| Commercial Meaning | opened / viewed / unavailable / timeout / degraded / incomplete / exception; latency p50/p95/p99; execution success/failure |
| reviewReceipt | discovered / confirmation / submitted / success / auth / vocabulary / stale / sot / provider / reexecute; latency |
| Operator | Meaning→Operational return; attempt/success rates; stale frequency; retries; classic review usage |
| Safety | isolation; allowlist; no mutation on auth/stale deny; no optimistic Meaning; new `executionId` on refresh |
| Interpretation quality | verdict / completeness / EXCEPTION / INCOMPLETE / decisionReady / provider degradation / unresolved `no_rule_matched` |

Semantic discrepancies classify as `HOST_MAPPING` · `SOT_POLICY` · `CASE_INTERPRETER` · `EXPECTED_DIFFERENCE` — **never** auto-edit interpreter from production frequency alone.

### Live observation

```bash
bash scripts/pr19-denali-controlled-production-observation.sh
# → /tmp/pr19-controlled-production-observation.json
# → /tmp/pr19-production-health-report.json
```

Evidence classes in reports: **LIVE** · **AUTOMATED** · **FIXTURE** (never blend without labels).

### Recommendation vocabulary

`CONTINUE` · `HOLD` · `READY_FOR_EXPANSION`

Never auto-flip rollout flags.

### Decision

**CONTINUE** — keep single-tenant controlled production (`…000003`). Do **not** expand tenants / vocabulary / shadow. Revisit expansion only after a longer command-volume window.

### Live evidence (executed 2026-08-08)

| Item | Evidence class | Result |
| ---- | -------------- | ------ |
| Stack | LIVE | API `:3001` + web `:3000`; `denali.admin.localhost` operator session |
| Hub / payments / receipts | LIVE | `/finance` OK; payments list OK; pending count **2** |
| Meaning samples | LIVE | **8/8** Encounter HTTP 200; readings `AWAITING_FINANCE`×2, `AWAITING_COUNTERPARTY`×1, `SETTLED_CAPTURED`×1, `CLOSED_IDLE`×4 |
| Latency | LIVE | p50 ≈ **70ms**, p95 ≈ **1.2s**, p99 ≈ **1.6s** (n=8) |
| Availability | LIVE | **1.0** |
| EXCEPTION / INCOMPLETE rates | LIVE | **0** / **0** |
| decisionReadyRate | LIVE | **0.25** |
| Meaning refresh | LIVE | new `executionId` on re-GET |
| Auth boundary | LIVE | invalid bearer → **401** |
| Tenant isolation | LIVE+AUTOMATED | other/empty/multi Command UI → disabled |
| Leakage | LIVE | no CaseOutput / FactSnapshot / gateway ids in Encounter JSON |
| Command mutations this window | LIVE | **0** submitted (observation-only; no forced mutate) |
| Prior command proof | LIVE (PR18-C) | happy path + stale 409 + classic-then-stale — see §PR18-C |
| Health artifact | LIVE | `/tmp/pr19-production-health-report.json` |
| Observation artifact | LIVE | `/tmp/pr19-controlled-production-observation.json` |

**Automated:**

| Spec | Result |
| ---- | ------ |
| `apps/api/.../controlled-production-observation.spec.ts` | 3/3 pass |
| `apps/web/test/finance-case-command-ui-pr19.spec.ts` | 3/3 pass |

**Failure taxonomy (this window):** no LIVE command failures. Host failure mapping remains: auth / vocabulary / stale / sot / provider / reexecute (AUTOMATED + PR18-C LIVE).

**Operator behavior:** Meaning reads healthy; classic review path retained (usage counter wired; not exercised in this observation mutate-free window). Command attempt rate N/A (0 submits).

**Risk indicators:** none.

### Proofs

- `scripts/pr19-denali-controlled-production-observation.sh`
- `apps/api/.../controlled-production/controlled-production-observation.spec.ts`
- `apps/web/test/finance-case-command-ui-pr19.spec.ts`

---

## PR20 — Controlled command usage observation

**Goal:** Collect **LIVE** `reviewReceipt` Command UI usage on the existing single tenant. Evidence gate only — **no** vocabulary expand, **no** multi-tenant, **no** shadow, **no** finance-core / interpreter / FinanceService policy changes, **no** auto flag flips.

### Exact rollout (unchanged)

```bash
# API
FINANCE_CASE_ENCOUNTER_MODE=internal
FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS=00000000-0000-4000-8000-000000000003
FINANCE_CASE_SHADOW_ENABLED=false

# Web
FINANCE_CASE_COMMAND_UI_ENABLED=true
FINANCE_CASE_COMMAND_UI_TENANT=00000000-0000-4000-8000-000000000003
FINANCE_CASE_ENCOUNTER_MODE=internal
FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS=00000000-0000-4000-8000-000000000003
```

### Controlled LIVE matrix

| ID | Scenario | Expect |
| -- | -------- | ------ |
| A | Pending → Command UI **approve** | SoT mutate; booking sync; Meaning new `executionId`; classic parity |
| B | Pending → Command UI **reject** | Same invariants |
| C | Classic mutate then old Command intent | `CASE_COMMAND_STALE`; no second mutation |
| D | Unauthorized session | 401/403; no SoT write |
| E | Tenant mismatch / fail-closed | Command UI disabled outside `…000003` |
| F | SoT / provider failure | LIVE if safe; else **AUTOMATED-only** (never fabricate) |

Invariant: Command UI → Host Bridge → **FinanceService** → SoT → fresh Encounter. Never Command UI → Case mutation.

Classic vs Command discrepancies classify as `HOST_MAPPING` · `SOT_POLICY` · `CASE_INTERPRETER` · `CLASSIC_UI_BEHAVIOR` · `EXPECTED_DIFFERENCE`.

### Live script

```bash
bash scripts/pr20-denali-controlled-command-usage.sh
# → /tmp/pr20-controlled-command-usage.json
# → /tmp/pr20-production-health-report.json
```

Human feedback: report **NO_HUMAN_FEEDBACK** when no operator interview exists.

### Recommendation vocabulary

`CONTINUE` · `HOLD` · `READY_FOR_EXPANSION`

Expansion requires sufficient **REAL** command volume + safety (existing advisory thresholds in Host recommendation). Never invent new numeric gates beyond architecture.

### Decision

**CONTINUE** — keep single-tenant Command UI (`…000003`). LIVE command volume = 2 successes (+ intentional stale). Not `READY_FOR_EXPANSION` (existing advisory floor ≥3 successes; residual post-approve EXCEPTION classified `SOT_POLICY` without interpreter edit). Never auto-flip flags.

### Live evidence (executed 2026-08-08)

| Scenario | Evidence | Result |
| -------- | -------- | ------ |
| A approve | LIVE | HTTP **200**; reg `…522` receipt `3dc67203-…`; unpaid→**paid**; `executionId` rotated; latency ~84ms; post Meaning **EXCEPTION** (`SOT_POLICY` residual) |
| B reject | LIVE | HTTP **200**; reg `…520`; booking stays **unpaid**; pending cleared; Meaning → `INTENT_OPEN_NO_PROOF`; latency ~72ms |
| C stale | LIVE | Classic PATCH **200** then Command **409** `CASE_COMMAND_STALE`; no second mutation |
| D auth | LIVE | invalid bearer → **401** |
| E isolation | LIVE | other/empty/multi Command UI → disabled |
| F SoT/provider | AUTOMATED | not safely forced LIVE; Host unit mapping remains |

**Classic vs Command**

| Finding | Classification |
| ------- | -------------- |
| A+B receipt/booking/Meaning refresh aligned with SoT via FinanceService | — |
| Post-approve Meaning EXCEPTION while booking paid | `SOT_POLICY` (do not edit interpreter from frequency) |
| Classic then Command refusal | `EXPECTED_DIFFERENCE` / stale protection |
| Classic can approve under Meaning EXCEPTION (empty Command tokens) | `CLASSIC_UI_BEHAVIOR` (observed earlier in session; classic still SoT) |

**Operator:** confirmationCompletion=2; **NO_HUMAN_FEEDBACK**.

**Safety:** no unauthorized mutation; no stale second write; no Case direct mutation; isolation intact.

Artifacts: `/tmp/pr20-controlled-command-usage.json`, `/tmp/pr20-production-health-report.json`, `/tmp/pr20-command-usage-report.json`

**Automated:** `controlled-command-usage.spec.ts` 3/3; `finance-case-command-ui-pr20.spec.ts` 3/3.

### Proofs

- `scripts/pr20-denali-controlled-command-usage.sh`
- `apps/api/.../controlled-production/controlled-command-usage.spec.ts`
- `apps/web/test/finance-case-command-ui-pr20.spec.ts`

---

## PR20-A — Command observation completion gate

**Goal:** Complete the PR20 LIVE command floor (≥3 successful `reviewReceipt` Command UI mutations) without architecture change. Evidence-only — **not** a feature PR.

### Exact rollout (unchanged — do not expand allowlist)

```bash
# API
FINANCE_CASE_ENCOUNTER_MODE=internal
FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS=00000000-0000-4000-8000-000000000003
FINANCE_CASE_SHADOW_ENABLED=false

# Web
FINANCE_CASE_COMMAND_UI_ENABLED=true
FINANCE_CASE_COMMAND_UI_TENANT=00000000-0000-4000-8000-000000000003
FINANCE_CASE_ENCOUNTER_MODE=internal
FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS=00000000-0000-4000-8000-000000000003
```

### Floor

Existing advisory expansion floor: **≥3 LIVE successful** Command UI mutations. **LIVE / AUTOMATED / FIXTURE** must stay separated — automated/fixture never count toward the floor.

### Live script

```bash
bash scripts/pr20a-denali-command-observation-completion.sh
# → /tmp/pr20a-command-observation.json
# → /tmp/pr20a-production-health-report.json
# → /tmp/pr20a-command-usage-report.json
```

If no suitable pending receipt: report **INSUFFICIENT_LIVE_TRAFFIC** (do not manufacture success).

### Decision

**CONTINUE** — third LIVE success obtained; floor ≥3 met; safety clean; residual understood as `SOT_POLICY`. **Not** `READY_FOR_EXPANSION`: advisory health still shows `exception_pressure` (EXCEPTION rate ~0.67 on post-approve paid bookings) and intentional stale sample pressure; Meaning health not yet “expansion-clean.” **Do not** auto-expand allowlist / flip flags (`mutatesFlags: false`, `expandsAllowlist: false`).

### LIVE command totals (cumulative PR20 + PR20-A)

| Class | Count | Notes |
| ----- | ----- | ----- |
| LIVE successful commands | **3** | PR20 A approve + PR20 B reject + PR20-A third approve |
| LIVE approve | **2** | `…522`, `…518` |
| LIVE reject | **1** | `…520` |
| LIVE stale | 1 | intentional classic→Command; **not** a success |
| LIVE auth failure | 1 | 401; no SoT write |
| LIVE isolation | PASS | fail-closed |
| AUTOMATED | lock specs only | **not** in LIVE floor |
| FIXTURE | 0 | — |

### Third LIVE command evidence (PR20-A)

| Field | Value |
| ----- | ----- |
| command | `reviewReceipt` / `approve_evidence` / `approve` |
| receipt | `febc8ab4-64ef-470a-b525-1adbb1fd42af` |
| registration | `00000000-0000-4000-8000-000000000518` |
| SoT before → after | booking `unpaid` → `paid`; receipt pending cleared |
| executionId before | `88ae4561-1e76-49dd-a146-f19db6dc0cd6` |
| executionId after | `ed6c0cf8-dfc9-4e83-94a0-8ab2c2bd2b60` |
| commandExecutionId | `pr20a-third-20260807212014:post` |
| latency | ~3216 ms |
| Meaning after | **EXCEPTION** (decisionReady false; empty Command tokens) |
| path | Command UI → CaseCommandIntent → Host authz → vocabulary/coherence → stale guard → `FinanceService.reviewReceipt` → SoT → fresh Encounter |
| idempotencyKey | `pr20a-third-20260807212014` |

Prior PR20 A/B unchanged: approve `…522` / reject `…520` (artifacts `/tmp/pr20-scenario-A.json`, `/tmp/pr20-scenario-B.json`).

### EXCEPTION residual classification

Paid booking + Case `EXCEPTION` re-probed on:

- `…000518` (PR20-A post-approve) — **repeatable**
- `…000522` (PR20 post-approve) — **repeatable**

| Axis | Result |
| ---- | ------ |
| Classification | **`SOT_POLICY`** |
| Isolated historical? | **No** — B) repeatable FinanceService write-policy / commercial artifact conflict |
| Interpreter defect? | **No** — not `CASE_INTERPRETER` |
| Adapter inconsistency? | **No** — not `ADAPTER` / `HOST_MAPPING` |
| Expected commercial exception? | **Yes** under current SoT+interpreter (headline: product meaning conflicts with financial artifacts / outstanding remaining class) |

**Do not** flip EXCEPTION→SETTLED. **Do not** edit interpreter laws in this PR. Document as SoT policy issue for later Architect-approved FinanceService work if remaining stays positive while booking is marked paid.

### Stale / auth / isolation (re-proof)

| Check | Result |
| ----- | ------ |
| Stale | Classic PATCH **200** then old Command intent → **409** `CASE_COMMAND_STALE` (reg `…516`, receipt `2e5f2c97-…`); exactly one SoT mutation; no optimistic Meaning; fresh GET after failure; no Case mutation |
| Auth | invalid session → **401** |
| Isolation | non-pilot / empty / multi-tenant Command UI config → fail-closed; Encounter↔Command tenant mismatch → no execution; unauthorizedMutation=0; crossTenantMutation=0 |

### Production health (controlled report)

| Metric | Value | Evidence class |
| ------ | ----- | -------------- |
| LIVE successful commands | 3 | LIVE |
| LIVE approve / reject | 2 / 1 | LIVE |
| stale count | 1 (intentional) | LIVE |
| auth failure count | 1 | LIVE |
| provider / reexecute failure | 0 / 0 | LIVE |
| command latency p50 / p95 / p99 | ~84 / ~3216 / ~3216 ms | LIVE samples |
| Meaning latency p50 / p95 / p99 | ~84 / ~2903 / ~3154 ms | LIVE samples |
| EXCEPTION rate | ~0.67 (2/3 post-command readings) | LIVE — classified `SOT_POLICY` |
| INCOMPLETE rate | 0 | LIVE |
| unauthorized / cross-tenant mutations | 0 / 0 | LIVE |
| refresh correctness | PASS (new `executionId` after success) | LIVE |
| SoT mutation correctness | PASS (FinanceService sole writer) | LIVE |
| Risk indicators | `exception_pressure`, `stale_pressure` | advisory |
| Recommendation | **CONTINUE** | `controlled_production_healthy_enough_to_continue_single_tenant` |

Regression: `/finance` hub, payments list, classic receipts path unchanged in this window.

Artifacts: `/tmp/pr20a-command-observation.json`, `/tmp/pr20a-production-health-report.json`, `/tmp/pr20a-command-usage-report.json`.

### Proofs

- `scripts/pr20a-denali-command-observation-completion.sh`
- `apps/api/.../controlled-production/controlled-command-observation-completion.spec.ts` (AUTOMATED floor lock)
- Prior PR20 LIVE A/B + PR20-A third LIVE approve

---

## PR20-B — SoT paid vs remaining policy gate

**Goal:** Decide whether `booking.paymentStatus=paid` + invoice remaining > 0 (Case `EXCEPTION`) is intentional SoT policy or incomplete FinanceService write policy — **before** expansion.

**Investigation only** — no FinanceService / finance-core / interpreter implementation in this gate.

Canonical write-up: [`FINANCE_CASE_SOT_PAID_VS_REMAINING_POLICY.md`](./FINANCE_CASE_SOT_PAID_VS_REMAINING_POLICY.md).

### Exact rollout (unchanged)

```bash
FINANCE_CASE_ENCOUNTER_MODE=internal
FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS=00000000-0000-4000-8000-000000000003
FINANCE_CASE_SHADOW_ENABLED=false
FINANCE_CASE_COMMAND_UI_ENABLED=true
FINANCE_CASE_COMMAND_UI_TENANT=00000000-0000-4000-8000-000000000003
```

### Decision

| Item | Result |
| ---- | ------ |
| Option | **B** — SoT policy incorrect/incomplete (approve always → `paid`; prepayment already uses `partial`) |
| Case | **KEEP_CASE** — interpreter unchanged |
| SoT | **CHANGE_SOT_POLICY** — **implemented**: underpay approve → `partial`; full cover → `paid` |
| Rollout | **CONTINUE** — live classic + Command proven; no allowlist expand |

### Live (2026-08-08)

| Scenario | Booking | Remaining | Case |
| -------- | ------- | --------- | ---- |
| Classic underpay `…514` | partial | 1000000 | `INCOMPLETE_INSPECT` (not false EXCEPTION) |
| Classic full `…532` | paid | 0 | `SETTLED_CAPTURED` |
| Command underpay `…519` | partial | 1000000 | `INCOMPLETE_INSPECT` |

Auth **401**; stale fail-closed **409**. Script: `scripts/pr20b-denali-sot-paid-remaining-live.sh`.

---

## PR20-C — Denali Finance product acceptance audit

**Scope:** classic Denali Finance SoT (Finance Case out of scope).

Canonical report: [`DENALI_FINANCE_PRODUCT_ACCEPTANCE_AUDIT.md`](./DENALI_FINANCE_PRODUCT_ACCEPTANCE_AUDIT.md).

**Decision:** **`ACCEPTED_WITH_BLOCKERS`** — one-shot full collect works; second manual payment blocked after Paid underpay; overpay approve returns HTTP 500.

---

## PR22 — Denali Finance first-customer closeout & production observation

**Goal:** Close the Denali Finance first-customer delivery track (observation + contract health). **Not** feature development.

Canonical report: [`DENALI_FINANCE_FIRST_CUSTOMER_CLOSEOUT.md`](./DENALI_FINANCE_FIRST_CUSTOMER_CLOSEOUT.md).

### Live gate

```bash
# API + web up; fail-closed flags unchanged
python3 scripts/pr22-denali-finance-closeout-gate.py
# → /tmp/pr22-closeout.json
# → /tmp/pr22-safety.json
# → /tmp/pr22-observation.json
```

Optional observation tooling (existing):

```bash
bash scripts/pr19-denali-controlled-production-observation.sh
```

### Decision

| Item | Result |
| ---- | ------ |
| Verdict | **`READY_FOR_FINANCE_CLOSEOUT`** |
| BLOCKER / CUSTOMER_RISK | **0 / 0** |
| Product code | **none** |
| Rollout expand | **forbidden** (unchanged) |
| Production volume metrics | **INSUFFICIENT_SAMPLE** (controlled smoke only) |
| Next | **CUSTOMER-DRIVEN DEVELOPMENT** |

Do not invent follow-on Finance PRs merely to enlarge architecture. Future work requires real Denali requirements, observed production problems, or approved roadmap items.
