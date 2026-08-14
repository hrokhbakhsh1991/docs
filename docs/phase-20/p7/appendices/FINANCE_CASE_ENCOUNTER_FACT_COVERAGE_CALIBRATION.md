# Finance Case Encounter Fact Coverage Calibration (PR15-D / PR15-E)

```yaml
doc_id: FINANCE_CASE_ENCOUNTER_FACT_COVERAGE_CALIBRATION
version: "2026-08-07-v2"
status: CALIBRATION
phase: PR15-E
pilot_tenant: "00000000-0000-4000-8000-000000000003"
related:
  - docs/phase-20/p7/appendices/FINANCE_CASE_VALIDATION_RUNBOOK.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_INTERPRETER_BOUNDARY.md
  - apps/api/src/workspace-finance/case/observation/fact-coverage-diagnostics.ts
  - apps/api/src/workspace-finance/case/observation/calibrate-live-encounter-coverage.ts
  - packages/workspaces/denali/src/finance/unwrap-denali-tour-canonical-document.ts
  - packages/workspaces/denali/src/finance/resolve-denali-registration-obligation.ts
```

## Purpose

Explain live pilot `INCOMPLETE_INSPECT` results **without** changing interpreter rules, inventing zeros, expanding allowlist, enabling shadow, or adding command UI.

**PR15-E** implements the adapter-only obligation envelope fix selected after PR15-D calibration (finance-core / interpreter / CaseOutput / EncounterView / completeness semantics unchanged).

## Method

1. Report-only diagnostics (`buildEncounterFactCoverageDiagnostic`) — field presence + provider attribution + completeness reason inference (mirrors `evaluateCompleteness`, does not alter verdicts).
2. Live execution via `executeFinanceCase` + Denali Host providers for pilot tenant samples.
3. Direct SoT probe of `resolveRegistrationObligation` / tour canonical shape.

Hard locks honored: finance-core unchanged; FinanceService not mutated; Case ephemeral; Encounter read-only; pilot tenant only.

---

## Semantic correctness

| Statement | Verdict |
| --------- | ------- |
| `INCOMPLETE_INSPECT` = facts insufficient for stronger reading | **True** |
| Means provider crash / HTTP 500 | **False** (Encounter GET 200) |
| Means Case persistence failure | **False** (no Case DB) |
| Means payment / booking mutation failure | **False** (classic finance green under pilot) |
| Means ownership failure | **False** (`owner=finance`, posture=`inspect`, `decisionReady=false` by design) |

Operator headline (“Decisive facts are incomplete — inspect before deciding”) is **semantically correct** for the FactSnapshot Case received.

---

## Live sample matrix (n=9, pilot `…000003`)

| Kind | Registration | Reading | Completeness | Cause bucket |
| ---- | ------------ | ------- | ------------ | ------------ |
| receipt_submitted | `…0529` | INCOMPLETE_INSPECT | inspect_forced | obligation_unread |
| paid | `b0142f15-…` | INCOMPLETE_INSPECT | inspect_forced | obligation_unread |
| paid | `…0544` | INCOMPLETE_INSPECT | inspect_forced | obligation_unread |
| receipt_approved | `…0527` | INCOMPLETE_INSPECT | inspect_forced | obligation_unread |
| receipt_rejected | `…0528` | INCOMPLETE_INSPECT | inspect_forced | obligation_unread |
| pending_payment | `…0536` | INCOMPLETE_INSPECT | inspect_forced | obligation_unread |
| edge_cancelled | `…0550` | INCOMPLETE_INSPECT | inspect_forced | obligation_unread |
| edge_waitlisted | `8d1b3275-…` | INCOMPLETE_INSPECT | inspect_forced | obligation_unread |
| receipt_submitted (post-approve) | `…0523` | INCOMPLETE_INSPECT | inspect_forced | obligation_unread |

**Incomplete rate: 100% (9/9).**

### Aggregates

| Cause | Count | % |
| ----- | ----- | -- |
| obligation_unread | 9 | 100% |
| eligibility_unknown | 0 | 0% |
| evidence_gap | 0 | 0% |
| payment_gap | 0 | 0% |
| lifecycle_closed_ambiguity | 0 | 0% |
| optional_ledger_signal | 0 | 0% |

Completeness reasons observed:

- `money_meaning_unknown` — 9/9 (both `collectionPolicy` and `remaining` unknown)
- `obligation_unknown_with_evidence` — 1/9 (pending receipt + unknown obligation)

### Required vs optional gaps

**Required unknown (all samples):** entire money group via reason `obligation_amount_unread`:

- `money.obligationPresent`
- `money.collectionPolicy`
- `money.amountDue`
- `money.remaining`
- `money.currency`
- `money.scheduleKind`
- `money.partialScopeDeclared`

**Typically known (not the incompleteness driver):** lifecycle eligibility, payment intent/settlement, evidence progress (when receipt exists).

**Optional:** ledger/signal may be degraded or sparse — **not** forcing `inspect_forced` here.

---

## Fixture expectation vs live reality

| Dimension | Fixture assumption | Live reality |
| --------- | ------------------ | ------------ |
| Money facts | Known obligation + remaining from Denali pricing | All money TriFacts **unknown** (`obligation_amount_unread`) |
| Completeness | Often `act_complete` / `wait_complete` → normal Encounter | Always `inspect_forced` |
| Reading | e.g. `AWAITING_FINANCE` / `SETTLED_CAPTURED` | Always `INCOMPLETE_INSPECT` |
| Tour canonical | Flat `{ pricing.basePricePerPerson, … }` in tests | Stored as wizard envelope `{ data, roots, schemaVersion }` with pricing under **`data.pricing`** |
| Obligation port | Returns minor amount | `resolveRegistrationObligation` → **null** |
| Host SoT read | `obligationMinor` populated | `readObligation` returns `ok` with `obligationMinor: null` |
| Mapper | Field-level unknowns | `mapDenaliObligationToMoneyFacts` collapses to **full** `unknownMoneyFacts` when amount unread |

### Classification of root cause

| Hypothesis | Result |
| ---------- | ------ |
| Missing adapter mapping | **Yes — primary** |
| Unavailable SoT read (booking/payment missing) | No (bookings/payments/receipts load) |
| Intentionally unsupported state | No (pricing exists on tour) |
| Legitimate commercial ambiguity | No (price `2500000` IRR present under `data.pricing`) |
| Interpreter bug / false incompleteness | **No** — given unknown money, inspect is correct |

### Causal chain (proven)

```text
Tour.canonical = { data: { pricing: { paymentMode, basePricePerPerson: 2500000 } }, roots, schemaVersion }
        ↓
resolveDenaliRegistrationObligationMinor reads pricing.* at canonical ROOT
        ↓
basePerPerson = null → returns null
        ↓
HostDenaliCaseReadSource.readObligation → obligationMinor: null (collectionMode still "offline")
        ↓
mapDenaliObligationToMoneyFacts → unknownMoneyFacts("obligation_amount_unread")
        ↓
evaluateCompleteness → money_meaning_unknown → inspect_forced
        ↓
interpret → INCOMPLETE_INSPECT
```

Direct probe: `data.pricing.paymentMode=offline_receipt`, `data.pricing.basePricePerPerson=2500000`, but `resolveDenaliRegistrationObligationMinor(tour.canonical)` → `null`.

---

## Observation tooling added (report-only)

| Artifact | Role |
| -------- | ---- |
| `observation/fact-coverage-diagnostics.ts` | Field inventory, reason inference, cause classification, semantic note |
| `observation/calibrate-live-encounter-coverage.ts` | Live pilot sample runner → JSON report |
| `observation/fact-coverage-diagnostics.spec.ts` | Unit proofs (unknown≠zero; money_meaning_unknown) |

Forbidden actions **not** taken: interpreter rule changes, fake defaults, rollout expansion, shadow, command UI.

Re-run:

```bash
cd apps/api
FINANCE_CASE_ENCOUNTER_MODE=pilot \
FINANCE_CASE_ENCOUNTER_PILOT_TENANTS=00000000-0000-4000-8000-000000000003 \
FINANCE_CASE_SHADOW_ENABLED=false \
PR15D_OUT=/tmp/pr15d-coverage-calibration.json \
node --import tsx --env-file=.env --env-file=.env.local \
  src/workspace-finance/case/observation/calibrate-live-encounter-coverage.ts
```

---

## Adapter fixes required (PR15-D) → implemented (PR15-E)

1. **Primary — Denali obligation bind unwrap / path parity** — **DONE in PR15-E**
   - Chosen design: explicit `unwrapDenaliTourCanonicalDocument` boundary (Option A-style unwrap), then **unchanged** `pricing.*` domain reads on the document root.
   - Not chosen: dual `data.pricing.*` path forks, generic deep search, or fake zero amounts.
   - Shared unwrap also used by `resolveDenaliPaymentCollectionMode` (removes local `asDataRoot` duplicate).

2. **Secondary (optional precision) — obligation mapper coarseness** — **deferred**
   - Today: null amount → all money facts unknown (including `collectionPolicy`), even when Host knows `collectionMode=offline`.
   - Narrower mapping could keep `collectionPolicy` known from collection mode while leaving `amountDue`/`remaining` unknown — **still must not invent amounts**.
   - Alone this does **not** unlock `act_complete` without a real obligation amount; primary fix was (1).

3. **Do not** adjust completeness presentation to hide `INCOMPLETE_INSPECT` while money is unknown — **still locked**.

---

## PR15-E — Denali obligation adapter coverage fix

### Root cause (unchanged from PR15-D)

Live wizard/Prisma tour storage:

```text
{ data: { pricing: { basePricePerPerson, paymentMode, … } }, roots, schemaVersion }
```

Pre-fix resolver read `pricing.*` on the **storage root**, missed nested document → `null` → Host `obligationMinor: null` → full money unknown → `money_meaning_unknown` → `INCOMPLETE_INSPECT`.

### Adapter boundary fix

```text
tourCanonical (storage)
        ↓
unwrapDenaliTourCanonicalDocument
  - "data" key present → require plain-object data, else null
  - else → treat root as flat legacy document
        ↓
document root (hosts pricing.*)
        ↓
resolveDenaliRegistrationObligationMinor  (pricing path logic unchanged)
```

Locks preserved: finance-core unchanged; interpreter / CaseOutput / EncounterView / completeness semantics unchanged; no allowlist expand; no shadow; no command UI; missing price stays `null` (unknown), never coerced to `0` except explicit `paymentCollection: free`.

### Before / after completeness behavior

| Scenario | Before (PR15-D) | After (PR15-E) |
| -------- | --------------- | -------------- |
| Known `data.pricing` + pending payment | money unknown → `inspect_forced` / `INCOMPLETE_INSPECT` | obligation money TriFacts known → completeness can leave inspect when other facts suffice |
| Receipt submitted (priced tour) | same obligation gap | evidence/payment facts unchanged; obligation now available |
| Missing / malformed pricing | unknown (correct) | still unknown → still `INCOMPLETE_INSPECT` |
| Flat legacy `{ pricing.* }` fixtures | known | known (parity preserved) |

### Regression tests (adapter output only)

- `packages/workspaces/denali/test/finance-obligation.spec.ts` — flat, wrapped envelope, missing pricing, malformed envelope, flat≡wrapped
- `packages/workspaces/denali/test/unwrap-denali-tour-canonical-document.spec.ts` — unwrap boundary
- Existing free-collection + payment-collection envelope cases remain green

### Pilot recommendation after fix

**CONTINUE** single-tenant pilot (`…000003` only). Do **not** expand allowlist / enable shadow / add command UI until remaining non-obligation inspect outliers (if any) are understood — but obligation coverage is no longer the blocker.

### Live re-calibration after PR15-E (n=9, same matrix)

| Metric | PR15-D (before) | PR15-E (after) |
| ------ | --------------- | -------------- |
| Incomplete rate | **100%** (9/9) | **11%** (1/9) |
| Cause `obligation_unread` | **9/9** | **0/9** |
| Sample `…0529` (receipt submitted) | `INCOMPLETE_INSPECT` / money unknown | **`AWAITING_FINANCE`** / `act_complete` / obligation known |
| Sample `…0536` (pending payment) | `INCOMPLETE_INSPECT` | **`INTENT_OPEN_NO_PROOF`** / `wait_complete` |
| Paid / approved cohorts | inspect | **`SETTLED_CAPTURED`** / `wait_complete` |
| Remaining incomplete `…0523` | obligation_unread | **not** obligation — `requiredUnknown=[]`, obligation provider 7/7 known; optional ledger degraded; reading still `INCOMPLETE_INSPECT` (separate inspect path; out of PR15-E adapter scope) |

Artifact: `/tmp/pr15e-coverage-calibration.json` (local; re-run command below).

Scenario C (missing pricing): `resolveDenaliRegistrationObligationMinor({ data: { title } })` → **`null`** (unknown preserved; never zero).

---

## Encounter UX acceptability

| Question | Answer |
| -------- | ------ |
| Safe for pilot observation? | **Yes** — fail-closed on incomplete money; no false settle/approve |
| Useful for operators (pre-fix)? | **Limited** — nearly every case showed inspect-forced |
| Useful for operators (post PR15-E)? | **Improved** where tours carry real `data.pricing`; missing price still inspect |
| Expand allowlist? | **No** until live incomplete rate drops and non-inspect readings appear |

---

## Recommendation

### PR15-D (historical): **FIX adapter coverage**

Keep single-tenant pilot running for observation, but treat Denali obligation canonical-envelope mapping as a **blocking calibration defect** before any EXPAND / shadow / command UI.

### PR15-E (current): **CONTINUE pilot** after adapter fix

Adapter coverage defect addressed in `@app-tour/workspace-denali` finance resolvers. Re-run live calibrator; expand remains blocked until exit criteria below.

**Follow-up:** PR15-F live pilot validation — see [`FINANCE_CASE_ENCOUNTER_PILOT_VALIDATION.md`](./FINANCE_CASE_ENCOUNTER_PILOT_VALIDATION.md) (recommendation remains **CONTINUE**; residual inspect is settlement/remaining coherence, not obligation envelope).

Not chosen:

- ADJUST completeness presentation — would mask true money-fact gaps
- HOLD / disable pilot — Encounter wiring healthy; defect was adapter mapping
- EXPAND allowlist / shadow / command UI in this change

### Exit criteria before expand

1. Live samples show money facts known for priced offline tours (`…0220`).
2. Incomplete rate for paid / pending-receipt cohorts drops materially (target: inspect reserved for true unknowns).
3. At least one live `AWAITING_FINANCE` (pending receipt) and one non-inspect reading for settled/paid where facts support it.
4. Still no shadow / command UI / allowlist expansion in the same change.
