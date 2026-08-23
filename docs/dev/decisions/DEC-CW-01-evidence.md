# DEC-CW-01 — `approved` vs `confirmed` state model evidence packet

**Decision id:** DEC-CW-01  
**Status:** APPROVED — Option B (Architect, 2026-08-23, Wave 3E)
**Prepared:** 2026-08-23 (CW Wave 3A, decision-evidence track)  
**Repository ref:** `main` (post CW4-01..04, DEC-CW-03 Option A implemented)  
**Canonical ledger:** [`docs/dev/composable-workspace-refactor-plan.md`](../composable-workspace-refactor-plan.md) — DEC-CW-01 section  
**Related (approved):** [`DEC-CW-03-evidence.md`](DEC-CW-03-evidence.md) — dual capacity **timing** strategies (Option A)

---

## 1. Decision question

Are `approved` (booking / operator-approval path) and `confirmed` (Urban at-create path) **permanently distinct domain concepts**, **two strategies over a neutral higher-level registration model**, or **targets for eventual vocabulary/persistence convergence**?

DEC-CW-03 already decided **when** capacity is consumed (`operatorApproval` vs `atCreate`). DEC-CW-01 decides **what the status strings and persistence models mean** and whether a shared neutral contract can exist without renaming wire vocabulary.

**Strong preference (ledger):** do **not** normalize strings unless product semantics prove equivalence. CW0-05 proves they are **not** equivalent today.

---

## 2. Current behavior (evidence-backed)

### 2.1 Booking / operator-approval model (`operator_registrations`)

| Aspect | Behavior | Evidence |
|--------|----------|----------|
| Persistence | `operator_registrations` (`OperatorRegistration` Prisma model) | CW0-05; `schema.prisma` `@@map("operator_registrations")` |
| Wire / storage vocabulary | `pending`, `approved`, `waitlisted`, `rejected`, `cancelled` | `booking-status.ts`; CW0-05 fixture |
| Capacity-consuming status | `approved` only | CW0-03 `booking-approved-sum.json`; `sumApprovedPartySizeInTx` |
| Create status | Always `pending` | TRUTH §11, §13; `booking-lifecycle.spec.ts` |
| Capacity timing | Consumed on **approve** (or auto-approve after create) | DEC-CW-03; `booking-approve-capacity.spec.ts` |
| Lifecycle graph | Rich transition table + terminal states | CW0-04 `transition-edges.json`; `booking-lifecycle-transitions.ts` |
| Outbox | `registration.approved`, `registration.waitlisted`, `registration.cancelled`; reject **silent** | CW0-04 `outbox-semantics.json` |
| Operator ops | Approve, reject, waitlist, cancel, **promote waitlist → approved** | `cw4-booking-transition-sot.md`; Denali ops manifest |
| Extra columns | `paymentStatus`, `approvedAt`, `departureAt`, `submittedByUserId`, … | `schema.prisma` `OperatorRegistration` |
| Capability gate | `workspaceBooking` manifest binding | Denali / Harbor manifests |
| Public `spotsRemaining` | Counts **approved** party size only | CW0-06; TRUTH §29 |

### 2.2 Urban at-create model (`urban_registrations`)

| Aspect | Behavior | Evidence |
|--------|----------|----------|
| Persistence | `urban_registrations` (`UrbanRegistration` Prisma model) | CW0-05; `schema.prisma` `@@map("urban_registrations")` |
| Wire / storage vocabulary | `confirmed`, `waitlist`, `cancelled` | `urban-registration.repository.ts`; CW0-05 fixture |
| Capacity-consuming status | `confirmed` only | CW0-03 `urban-confirmed-sum.json`; `sumAcceptedPartySize` |
| Create status | Terminal intake: `confirmed` or `waitlist` | `registration.service.ts`; `registration-capacity.spec.ts` REG-01d |
| Capacity timing | Consumed at create when `confirmed` | DEC-CW-03 Option A; `at-create-strategy.ts` |
| Lifecycle graph | **No** booking transition table; no `pending` | TRUTH §13; CW0-04 applies to booking only |
| Outbox | **None** on Urban registration create | TRUTH §15; no `BookingsService` path |
| Operator ops | No booking ops manifest / approve/reject/promote | Urban uses `catalogRegistrationFlow` HTTP host |
| Extra columns | Minimal intake row (no `paymentStatus`, no `approvedAt`) | `schema.prisma` `UrbanRegistration` |
| Capability gate | **No** `workspaceBooking`; `catalogRegistrationFlow` | `urban/workspace.manifest.json` |
| Finance | **No** `workspaceFinance` binding | Urban README; no finance manifest block |
| Rejection | HTTP errors at create (`REGISTRATION_CAPACITY_EXCEEDED`, `REGISTRATION_CLOSED`) — not a persisted `rejected` status | `at-create-strategy.ts`; Urban HTTP errors |

### 2.3 CW0-05 divergence contract (executable)

Golden `CW0-05-approved-confirmed-divergence` freezes:

```json
{
  "bookingPath": {
    "persistenceTable": "operator_registrations",
    "capacityConsumingStatus": "approved",
    "vocabulary": ["pending", "approved", "waitlisted", "rejected", "cancelled"]
  },
  "urbanPath": {
    "persistenceTable": "urban_registrations",
    "capacityConsumingStatus": "confirmed",
    "vocabulary": ["confirmed", "waitlist", "cancelled"]
  },
  "portalLabelExcludes": ["confirmed", "waitlist"]
}
```

Negative tests: `BOOKING_STATUSES` excludes `confirmed`; Urban vocabulary excludes `approved`; portal `BOOKING_STATUSES` label map excludes Urban strings (`approved-confirmed-divergence.spec.mjs`).

### 2.4 Side-by-side semantics (not interchangeable)

| Dimension | Booking `approved` | Urban `confirmed` |
|-----------|-------------------|-------------------|
| String on wire | `approved` | `confirmed` |
| Typical member meaning | “Operator accepted my request” | “I got a seat at signup” |
| Requires prior `pending` | Yes (or auto-approve immediately after create) | No — assigned at create |
| Paired with operator action | Yes (`approve` / auto-approve) | No operator approve step |
| Outbox `registration.approved` | Yes | No |
| Finance obligation port | Via `operator_registrations` booking snapshot | Not wired today |
| Notification `booking.registration.approved` | On outbox relay | Not emitted |

**Conclusion:** same *occupancy role* (seat consumed) but **different product semantics and observability**. String rename would lie about member/operator meaning.

---

## 3. TRUTH map and spec cross-references

TRUTH citations are from `.architecture-analysis/TOUR-DOMAIN-TRUTH-MAP.md` (ledger mandatory input). Key sections:

| TRUTH § | Topic | DEC-CW-01 relevance |
|---------|-------|-------------------|
| §9 | Capacity consumption (`approved` vs `confirmed`, timing) | Core — consuming status differs by model |
| §11 | Registration creation outcomes | Booking → `pending`; Urban → `confirmed`/`waitlist` at create |
| §13 | `pending` | Booking-only; Urban has no intermediate queue state |
| §14 | `approved` vs `confirmed` | **Primary** — different strings, timing, meaning |
| §16 | `waitlisted` vs `waitlist` | Different lifecycle role (ops queue vs intake outcome) |
| §17 | Waitlist promotion | Booking-only `waitlisted → approved`; Urban has no promotion |
| §27 | Portal member status display | Booking vocabulary only; `confirmed` raw fallback |
| §29 | Public `spotsRemaining` | Booking-approved sum; Urban catalog not enriched same way |
| §SAFE | Shared candidates | Pure capacity math (moved to tour-core per DEC-CW-03) |
| §MUST-NOT | Urban at-create **model** | Do not treat Urban semantics as platform default |

**Executable specs (beyond parity goldens):**

| Spec | Proves |
|------|--------|
| `test/parity/approved-confirmed-divergence.spec.mjs` | CW0-05 contract + portal exclusion |
| `test/parity/registration-lifecycle.golden.spec.mjs` | CW0-04 booking-only lifecycle |
| `test/parity/capacity.golden.spec.mjs` | CW0-03 symmetric sum, asymmetric consuming status |
| `packages/booking-http-contracts/test/booking-lifecycle-transitions.spec.ts` | Booking SoT edges (CW4-02) |
| `apps/api/test/registration-capacity.spec.ts` | Urban at-create status assignment |
| `apps/api/src/bookings/booking-lifecycle.spec.ts` | Outbox on approve/waitlist/cancel |
| `docs/dev/cw4-booking-transition-sot.md` | Host vs Denali transition census |

---

## 4. Parity golden evidence (CW0-04, CW0-05)

### CW0-04 — Registration lifecycle (booking path only)

| Golden id | Fixture | Frozen invariant |
|-----------|---------|------------------|
| `CW0-04-transition-edges` | `registration-lifecycle/transition-edges.json` | `pending` fans out; `waitlisted → approved` allowed |
| `CW0-04-outbox-semantics` | `registration-lifecycle/outbox-semantics.json` | Approve/waitlist/cancel observable; reject silent |

**Implication:** lifecycle + outbox contract is **booking-model scoped**. Urban is intentionally outside this golden set.

### CW0-05 — `approved` / `confirmed` divergence contract

| Golden id | Fixture | Frozen invariant |
|-----------|---------|------------------|
| `CW0-05-approved-confirmed-divergence` | `registration-lifecycle/approved-confirmed-divergence.json` | Separate tables; separate vocabularies; portal labels exclude Urban strings |

**Implication:** refactor must not silently map `confirmed → approved` or merge tables without a new product decision and golden updates.

---

## 5. Options (DEC-CW-01 framing)

### Option A — Permanently distinct domain concepts (no neutral registration model)

**Summary:** Treat booking registrations and Urban registrations as unrelated domain types forever. No shared registration orchestration interface beyond incidental pure math (already in tour-core for at-create capacity).

| Pros | Cons |
|------|------|
| Maximum fidelity to current product language | Blocks CW5-05 / CW4-05 neutral orchestration goals |
| Zero risk of accidental string normalization | Duplicates certification and CW-9 synthetic vertical patterns |
| Aligns with CW0-05 “not equivalent” proof | **Conflicts** with approved DEC-CW-03 dual-strategy direction |

**Assessment:** Too rigid. DEC-CW-03 already approved first-class **strategies**; DEC-CW-01 should define the **state-model contract** those strategies carry, not deny shared structure.

### Option B — Dual registration models with neutral higher-level concepts (recommended PROPOSAL)

**Summary:** Two first-class **registration persistence models** selected by manifest strategy (aligned with DEC-CW-03). Introduce **neutral tour-core / SDK concepts** for occupancy, intake outcome **category**, and strategy selection — while **preserving exact workspace wire strings** at adapter boundaries.

| Pros | Cons |
|------|------|
| Matches DEC-CW-03 Option A (dual strategies) without string renames | Requires CW4-05 / CW5-05 contract design work |
| Enables CW-9 `cert-events` without Urban→booking migration | Portal/reporting still need strategy-aware adapters (DEC-CW-04) |
| CW0-03/05 parity preserved — sum math shared, vocabulary not | Two persistence stores remain (operational complexity) |
| Future similar club picks `operatorApproval`; future event vertical picks `atCreate` | Cross-workspace analytics need explicit aggregation rules |

### Option C — Eventually converge on one normalized state model

**Summary:** Migrate Urban to `workspaceBooking` + `pending`/`approved` vocabulary and/or merge tables.

| Pros | Cons |
|------|------|
| Single lifecycle SoT | **Product reversal** — contradicts TRUTH intentional variation |
| Simpler portal labels if everything becomes booking | Breaks CW0-05; requires persistence migration |
| | Violates ledger non-goals (#2, #13) without explicit product sign-off |
| | Loses at-create intake semantics Urban operators/members expect |

**Assessment:** **Reject** — no product evidence supports convergence; CW0-05 negative tests would need rewriting with semantic justification.

---

## 6. Neutral concepts (Option B — proposed contract layer)

Neutral concepts live in **tour-core / SDK orchestration types**, not in wire enums or DB column values.

| Neutral concept | Meaning | Booking adapter maps to | Urban adapter maps to |
|-----------------|---------|-------------------------|------------------------|
| `registrationCapacityStrategy` | When/how capacity is decided | `operatorApproval` (`workspaceBooking`) | `atCreate` (`catalogRegistrationFlow`) |
| `capacityConsumingRegistrationStatus` | Status string that occupies a seat | `approved` | `confirmed` |
| `occupiesSeat(status)` | Predicate on persisted row | `status === "approved"` | `status === "confirmed"` |
| `intakeAwaitingOperatorDecision` | Row exists but seat not committed | `pending` | **never** (N/A) |
| `queuedWithoutSeat(status)` | Waitlist queue without occupancy | `waitlisted` | `waitlist` |
| `registrationTerminalNegative` | Declined intake | `rejected` | HTTP reject (no row) or N/A |
| `registrationVoided(status)` | Cancelled / voided seat | `cancelled` | `cancelled` |
| `registrationLifecycleProfile` | Whether rich ops graph + outbox applies | `bookingPipeline` (CW0-04 edges) | `atCreateTerminal` (no promotion graph) |

**Not neutralized (remain workspace-local strings):**

- `approved` vs `confirmed`
- `waitlisted` vs `waitlist`
- `pending`, `rejected` (booking-only persisted states)
- Outbox event types (`registration.approved`, …)
- Portal i18n keys under `portalMember.registrations.statusLabels`

**Manifest sketch (CW5-05 work):**

```json
{
  "registrationModel": {
    "strategy": "operatorApproval" | "atCreate",
    "persistence": "operator_registrations" | "vertical_registrations",
    "capacityConsumingStatus": "approved" | "confirmed",
    "vocabulary": { /* workspace-owned string list — not normalized */ }
  }
}
```

Final schema is CW5-05; above illustrates **metadata without string merge**.

---

## 7. What remains distinct (under Option B)

| Area | Booking / operator-approval | Urban / at-create | Converge? |
|------|----------------------------|-------------------|-----------|
| Wire status strings | `approved`, `waitlisted`, … | `confirmed`, `waitlist` | **No** |
| Persistence table | `operator_registrations` | `urban_registrations` | **No** (unless separate migration DEC) |
| Create outcome | `pending` | `confirmed` or `waitlist` | **No** |
| Capacity timing | On approve | On create when `confirmed` | Strategy selection (DEC-CW-03) |
| Lifecycle graph | CW4-02 transition SoT | None (terminal at intake) | **No** |
| Outbox events | Approve/waitlist/cancel | None today | **No** unless product adds Urban events |
| Waitlist promotion | `waitlisted → approved` | No promotion path | **No** |
| Operator ops UI | Bookings ops manifest | Catalog registration flow | **No** |
| `paymentStatus` / finance | Booking row + `workspaceFinance` | Not present | **No** today |
| Portal member labels | i18n for booking statuses | Raw fallback (`DEC-CW-04`) | Display layer only |
| Public `spotsRemaining` | Approved sum enrichment | Not booking-enriched | Separate port work |

---

## 8. Impact analysis

### 8.1 Operator behavior

| Model | Operator experience |
|-------|---------------------|
| **Operator approval** | Pending queue, explicit approve/reject/waitlist/cancel; waitlist promotion; ops chips (`pending`, `approvedToday`, `waitlist`); Denali auto-approve still runs **approve** transition after create |
| **At-create** | No pending queue; intake result immediate; operator sees `confirmed`/`waitlist` rows without approve action; no `promoteWaitlist` ops action |

**Option B:** operator UIs bind to **strategy + local vocabulary**, not a single global status enum.

### 8.2 Capacity consumption

- **Shared invariant (CW0-03):** sum `partySize` for capacity-consuming status only; cancel/reject/waitlist rows excluded from occupancy sum.
- **Divergent consuming string:** `approved` vs `confirmed` — adapters implement `occupiesSeat`, not string normalization.
- **DEC-CW-03:** timing already split; DEC-CW-01 does not change timing math.

### 8.3 Member status

- Portal `localizeMemberRegistrationStatus` translates **booking** `BOOKING_STATUSES` only (`format-member-registration-display.server.ts`).
- Urban members see raw `confirmed` / `waitlist` until **DEC-CW-04** adds Urban-aware display mapping (orthogonal to DEC-CW-01).
- Member **meaning** differs: “approved” implies operator gate; “confirmed” implies automatic seat assignment.

### 8.4 API contracts

- `BookingStatus` / `booking-http-contracts` remain **booking-only** SoT (CW4-02). Do not add `confirmed` to wire enum.
- Urban `POST /urban/registrations` continues returning `status: "confirmed" | "waitlist" | …` from workspace schema.
- Cross-workspace HTTP must not expose a single normalized registration status enum without versioned union per strategy.

### 8.5 Reporting

- Operator Command Center metrics (`approvedToday`, `waitlist` count) query `operator_registrations` with booking vocabulary.
- Urban registrations are invisible to booking ops reports today.
- Cross-vertical reporting (if needed) should aggregate via neutral `occupiesSeat` / strategy dimension — **not** by renaming statuses in SQL.

### 8.6 Finance obligation timing

| Path | Obligation timing | Evidence |
|------|-------------------|----------|
| Booking + `workspaceFinance` | Obligation resolved from **booking snapshot** (`operator_registrations`) via `RegistrationFinanceObligationAdapter`; tied to booking lifecycle / operator workflows — **not** emitted on Urban create | `registration-finance-obligation.adapter.ts`; Denali finance manifest |
| Urban | No finance capability; no obligation port on `urban_registrations` | Urban manifest lacks `workspaceFinance` |
| Outbox-driven side effects | `registration.approved` → in-app notification (`dispatch-registration-approved-notification.ts`) | Booking approve only |

**Implication:** `approved` is coupled to **commercial obligation + notification timing**; `confirmed` is not equivalent even when both occupy a seat.

### 8.7 Waitlist promotion

- **Booking:** `waitlisted → approved` is a core edge (CW0-04); capacity re-checked on promote; outbox `registration.approved`.
- **Urban:** `waitlist` is **intake terminal** under `waitlist` policy — no automatic promotion when seats free (DEC-CW-03 open question #3 remains product-owned).

Neutral concept: `supportsWaitlistPromotion` = true only for `operatorApproval` strategy.

### 8.8 Future similar club (operator approval)

- **CW-9 `cert-club`:** `starter-outdoor` profile + `workspaceBooking` + finance — uses **operator approval model** with `approved` vocabulary and `operator_registrations` (or booking pipeline storage).
- DEC-CW-01 Option B: no pressure to adopt Urban `confirmed` strings.

### 8.9 Future automatic-admission event workspace

- **CW-9 `cert-events` (CW9-05):** synthetic different-vertical workspace should select **`atCreate`** strategy per DEC-CW-03, with **`confirmed`/`waitlist` vocabulary** and vertical persistence pattern (Urban reference implementation).
- DEC-CW-01 Option B: reuse neutral orchestration + Urban table pattern; **do not** force `workspaceBooking` migration.

---

## 9. Persistence impact

| Decision | Persistence impact |
|----------|-------------------|
| **Option B (recommended)** | **Keep** `operator_registrations` and `urban_registrations` separate. No migration. CW4-05 contract documents mapping metadata + certification goldens. New at-create vertical may add a third table or reuse Urban adapter pattern — still not merge without new DEC. |
| **Option C (reject)** | Would require Urban data migration to booking table + vocabulary rename — high risk, breaks CW0-05, contradicts intentional divergence. |

**Prisma today:**

- `OperatorRegistration` — rich booking ops row (`paymentStatus`, `approvedAt`, `departureAt`, …).
- `UrbanRegistration` — lightweight public intake row (`status` default `waitlist`).

Schema shape difference is **product**, not refactor debt to erase silently.

---

## 10. Alignment with DEC-CW-03 (approved)

DEC-CW-03 Option A approved **dual capacity strategies** without vocab/persistence unification. DEC-CW-01 Option B is the **state-model complement**:

| DEC-CW-03 (timing) | DEC-CW-01 (state model) |
|--------------------|-------------------------|
| `operatorApprovalCapacityStrategy` | `approved` consuming status; `pending` intake; booking lifecycle + outbox |
| `atCreateCapacityStrategy` | `confirmed` consuming status; terminal `waitlist`; no booking graph |
| Pure math in `tour-core/at-create-strategy.ts` | Orchestration interfaces in CW5-05 carry strategy metadata |
| Urban strings preserved at adapter | Same — **no** `confirmed` in `BookingStatus` enum |

`tour-core` already documents: “Urban vocabulary (`confirmed` / `waitlist`) is preserved at the adapter boundary — not booking `approved`” (`at-create-strategy.ts`).

---

## 11. Downstream tasks unblocked by DEC-CW-01 resolution

| Task | What DEC-CW-01 unlocks |
|------|------------------------|
| **CW4-05** | Encode decided relationship as SDK contract + certification spec (distinct models + neutral orchestration metadata per Option B). |
| **CW4-08** | Populate divergence ledger rows for `approved`/`confirmed` and `waitlisted`/`waitlist` as `INTENTIONAL(contract)` with CW4-05 link. |
| **CW5-05** | Registration orchestration interfaces expressing **both** strategies with neutral predicates; no forced convergence. |
| **CW9-05** | Synthetic different-vertical (`cert-events`) workspace selecting `atCreate` + Urban vocabulary without booking migration. |

**Transitively unblocked (full closure):** CW9-06 (still needs DEC-CW-04 for display), CW9-07, CW9-09, CW9-10 sign-off for different-vertical track.

**Does not unblock:** DEC-CW-04 (portal display), DEC-CW-02 archive capability details.

**Latest safe point (ledger):** end of CW4-04 — booking SoT complete; start CW4-05 only after DEC-CW-01 recorded.

---

## 12. Recommended choice (PROPOSAL for Architect)

**Recommend Option B — dual registration models with neutral higher-level concepts; reject string normalization and reject convergence (Option C).**

### Binding decisions (if approved)

1. **Do not** globally rename `approved` ↔ `confirmed` or `waitlisted` ↔ `waitlist` (ledger non-goals #2, #13).
2. **Do not** merge `operator_registrations` and `urban_registrations` without a separate product migration decision.
3. **Do** treat registration as **strategy-selected models** aligned with DEC-CW-03:
   - `operatorApproval` → booking pipeline vocabulary + `operator_registrations`
   - `atCreate` → Urban-style vocabulary + vertical persistence
4. **Do** introduce neutral orchestration predicates in tour-core/SDK (`occupiesSeat`, `registrationCapacityStrategy`, `registrationLifecycleProfile`) — implementation in CW4-05 / CW5-05.
5. **Keep** `booking-http-contracts` as booking-only wire SoT; Urban status strings stay in Urban HTTP/workspace packages.
6. **Finance / notifications / waitlist promotion** remain **booking-model features** unless product explicitly extends them to at-create verticals in future DECs.

### Rationale

- CW0-05 executable contract proves vocabulary and persistence are **not equivalent** — normalization would be a product lie.
- TRUTH §14 and §MUST-NOT classify divergence as **intentional product variation**, not debt to eliminate in refactor.
- DEC-CW-03 already committed to dual strategies; Option B completes the architecture story without false unification.
- Option A blocks CW5-05/CW9-05; Option C breaks parity and Urban product semantics without evidence.

### Reject

- **Option C** — no convergence mandate; Urban at-create model is reference implementation for event verticals (CW9-05).
- **Implicit normalization** — any `confirmed` → `approved` mapping in core, SQL, or portal without explicit DEC.

---

## 13. Open questions for decision owners

1. **Third persistence pattern:** May a future at-create vertical reuse `urban_registrations` schema, or must each vertical own a table (FEAS §7)?
2. **Urban finance:** If events vertical later needs obligations at `confirmed`, is that a new finance port + DEC, or must it adopt `workspaceBooking`?
3. **Waitlist promotion for at-create:** Should `waitlist` rows ever auto-promote to `confirmed` when seats free, or stay intake-only forever?
4. **Cross-workspace reporting:** Is a unified operator registration report required, or workspace-scoped reports sufficient?
5. **Portal display:** Confirm DEC-CW-04 will add Urban labels without renaming stored statuses.

---

## 14. Evidence index

| Artifact | Path |
|----------|------|
| Canonical ledger DEC-CW-01 | `docs/dev/composable-workspace-refactor-plan.md` |
| DEC-CW-03 (timing strategies) | `docs/dev/decisions/DEC-CW-03-evidence.md` |
| CW4 booking SoT | `docs/dev/cw4-booking-transition-sot.md` |
| CW0-05 fixture | `test/parity/fixtures/registration-lifecycle/approved-confirmed-divergence.json` |
| CW0-05 spec | `test/parity/approved-confirmed-divergence.spec.mjs` |
| CW0-04 fixtures | `test/parity/fixtures/registration-lifecycle/transition-edges.json`, `outbox-semantics.json` |
| CW0-03 fixtures | `test/parity/fixtures/capacity/booking-approved-sum.json`, `urban-confirmed-sum.json` |
| Booking status enum | `packages/booking-http-contracts/src/booking-status.ts` |
| Booking lifecycle SoT | `packages/booking-http-contracts/src/booking-lifecycle-transitions.ts` |
| At-create strategy | `packages/tour-core/src/capacity/at-create-strategy.ts` |
| Urban create | `packages/workspaces/urban/src/http/registration.service.ts` |
| Urban repository types | `packages/workspaces/urban/src/http/registration.repository.ts` |
| Portal display | `apps/portal/src/me/format-member-registration-display.server.ts` |
| Finance obligation adapter | `apps/api/src/workspace-finance/infrastructure/registration-finance-obligation.adapter.ts` |
| Prisma models | `apps/api/prisma/schema.prisma` (`OperatorRegistration`, `UrbanRegistration`) |
| TRUTH map | `.architecture-analysis/TOUR-DOMAIN-TRUTH-MAP.md` §9–18, §27, §29, §SAFE, §MUST-NOT |

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/decisions/DEC-CW-01-evidence.md`.*
