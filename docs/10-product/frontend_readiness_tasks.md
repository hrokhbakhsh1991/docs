# Frontend Readiness Tasks (Epic + Backlog)

## Purpose

This document tracks **gaps between backend runtime behavior, the OpenAPI contract, and product/UX documentation** (wireflows, screen state specs). It is the single backlog for decisions and edits that should land **before or alongside** serious frontend implementation.

**Scope:** checklist items reference likely repo paths (e.g. `docs/10-product/wireflows_must_have_journeys_v2.md`). Where the exact file or owner is uncertain, tasks include `TODO: confirm…` for a human to resolve.

**Out of scope for this epic document:** changing application code in this pass—only this file is added unless follow-up work is explicitly tracked below.

---

## Summary — Frontend readiness status

| Dimension | Status |
|-----------|--------|
| **Backend business logic & API (runtime + Swagger)** | **READY WITH CONDITIONS** — aligned with backend freeze per project decision; OpenAPI generated at `apps/api/openapi.json`. |
| **E2E infrastructure** | **PARTIAL** — Docker Compose, pnpm scripts, env templates, CI workflow exist; **E2E tests still fail at runtime** (e.g. DI / `tsx` execution issues). Treat as **test harness debt**, not business-logic freeze blocker, until fixed. |
| **Product / UX alignment with API & async behavior** | **NOT COMPLETE** — several wireflows and screen specs need updates so FE can implement without guessing. |
| **Overall FE architecture readiness** | **CONDITIONAL GO** — core participant flows can start once canonical registration + payment/async UX are agreed and documented; leader dashboard / reconciliation flows are **blocked or require redesign** until contracts exist or UX changes. |

**Suggested label:** `FE Architecture Readiness: Conditional Go` — backend frozen; **product/UX alignment tasks remain** (see sections below).

---

## Section A — API & Contract Alignment

### A1. Dashboard & Reconciliation Endpoints

- **ID:** A1  
- **Type:** API / Contract  
- **Priority:** HIGH  
- **Description:** Wireflows (e.g. leader dashboard and reconciliation journeys) reference endpoints such as aggregated leader workspace data and CSV reconciliation export. Those routes **may not appear** in `apps/api/openapi.json` while product docs still assume them. Frontend cannot implement those screens faithfully without either **shipping those endpoints** or **rewiring UX** to only use documented `/api/v2` routes.  
- **Tasks:**
  - [ ] Audit `apps/api/openapi.json` for presence of leader dashboard and reconciliation export paths (exact paths as assumed in product docs — TODO: list confirmed paths after audit).
  - [ ] If missing: decide **extend API** vs **change UX** (single owner: product + backend).
  - [ ] Update `docs/10-product/wireflows_must_have_journeys_v2.md` (or TODO: confirm exact filename) so journey matrices match **actual** OpenAPI paths.
  - [ ] If API is extended: regenerate OpenAPI (`pnpm --dir apps/api build` or project-standard command — TODO: confirm) and reference new operations in wireflows.
  - [ ] Document limitations for FE if UX is narrowed (e.g. “no CSV export in v1”).

---

### A2. Canonical Public Registration Flow

- **ID:** A2  
- **Type:** Flow / Product / Contract  
- **Priority:** HIGH  
- **Description:** For **v1 public registration**, the canonical flow is fixed as follows (aligned with `docs/runtime-lifecycle.md` and the public route in `apps/api/openapi.json`):

  - **Endpoint:** `POST /api/v2/tours/{tourId}/register` (path parameter `tourId`; request body `CreateRegistrationDto` per OpenAPI).
  - **When capacity exists:** the backend creates a registration whose **`Registration.status` initial value is `Accepted`** — there is **no** `Pending` “application received, awaiting review” state for this **public** path in v1.
  - **When capacity is full:** the response does **not** create a normal registration in the success sense; the user is placed on the **waitlist** with waitlist item status **`Waiting`** (see runtime waitlist lifecycle).
  - **Conceptual split for FE:** the intake form completes **registration placement** (accepted seat or waitlist). **Payment** (when the tour requires it) is handled **after** that step via the **payment intent** path and async confirmation — see **Section B** and **A2.1** below. This avoids modelling a misleading “Pending registration” screen for the public funnel and matches runtime: accepted placement first, then payment lifecycle.

  **Why this helps FE:** one primary mutation for anonymous/public signup, a single success semantics (`Accepted` vs waitlist), and payment screens layered on top instead of conflating intake with payment status.

- **Tasks:**
  - [ ] Update the wireflow document that defines **J-P-01** / public registration so the primary touchpoint is **`POST /api/v2/tours/{tourId}/register`**, not **`POST /api/v2/registrations`**, and remove any requirement that the **first** status after public submit is **`Pending`**. (Primary file: `docs/10-product/wireflows_must_have_journeys_v2.md` — TODO: confirm exact filename if renamed.)
  - [ ] Update `docs/10-product/screen_state_spec_v2.md` (TODO: confirm exact filename) so **S-PART-02** success / **S-PART-03** first paint for the **public** path assumes **`Accepted`** (or waitlist outcome), not **`Pending`**, unless documenting a separate authenticated-only flow.
  - [ ] Search product docs for assumptions such as “public **`POST /api/v2/registrations`**” or “initial **`Pending`**” and align or explicitly scope them as **authenticated-only** — TODO: confirm all files (e.g. `docs/10-product/screens_overview.md`, `docs/10-product/epic_contract_alignment.md`, traceability matrices — TODO: list).
  - [ ] Add or extend a short “Public vs authenticated registration” note in `docs/runtime-lifecycle.md` **or** the canonical wireflow doc — TODO: confirm target file per team convention.

---

### A2.1 — Canonical Public Registration Flow (v1) — Mini Spec

This mini spec is the **single reference** for Product + FE for the **v1 public** path. Details not fully spelled out in OpenAPI response schemas are marked **TODO**.

#### Endpoint

- **Method / path:** `POST /api/v2/tours/{tourId}/register`
- **Headers:** Optional `idempotency-key` (see OpenAPI). TODO: confirm retry / mismatch error codes in `docs/20-architecture/contracts/error_response_taxonomy_v2.md` (TODO: confirm path).

#### Required fields (request body)

Per **`CreateRegistrationDto`** in `apps/api/openapi.json` **`required`** array:

- `tenantId`
- `tourId`
- `participantFullName`
- `participantContactPhone`
- `transportMode` (enum: `self_vehicle` | `group_vehicle` | `other`)
- `entryMode` (enum: `telegram` | `web`)

Optional fields exist in the same schema (e.g. `telegramUserId` when `entryMode` is `telegram`, notes, vehicle capacity). TODO: confirm conditional validation rules match runtime.

#### Returned states (201 response — conceptual)

OpenAPI documents **`201`** with a generic object schema (`additionalProperties: true`). Runtime behavior (see `docs/runtime-lifecycle.md`):

- **Capacity available:** response includes a **`registration`** projection (including **`status: Accepted`** when a registration row is created) and may include payment-related payloads when the tour requires payment — TODO: confirm exact JSON keys and presence of `paymentIntent` in register response from controller/OpenAPI examples.
- **Capacity full / waitlist path:** response reflects **waitlist** outcome (`Waiting`), not a primary registration record — TODO: confirm exact response keys (`waitlistItemId`, `queuePosition`, etc.) against runtime or E2E fixtures.

#### Registration.status transitions (public funnel + payment)

- After successful public register with capacity: **`Accepted`** (initial).
- Payment success (webhook-driven, async): **`Accepted` → `AcceptedPaid`** (see `docs/runtime-lifecycle.md`).
- Payment failure (webhook-driven): **`Accepted` → `Rejected`** (per runtime doc).
- Further transitions (cancel, refund, etc.): see `docs/runtime-lifecycle.md` — TODO: map each to FE screens in **Section B** and **Section F** (registration status coverage).

#### Capacity-full behavior

- User does not get an **`Accepted`** registration when the tour is already at capacity; backend routes to **waitlist** semantics instead of blocking without outcome — TODO: align exact UX copy with wireflow error vs success branch.

#### Waitlist fallback

- Waitlist item lifecycle: **`Waiting` → `Converted` | `Cancelled`** (`docs/runtime-lifecycle.md`).
- Separate explicit public endpoint exists: `POST /api/v2/tours/{tourId}/waitlist` — TODO: document when FE uses `/register` only vs explicit `/waitlist`.

#### Error codes FE must handle

TODO: produce a definitive list from OpenAPI operation responses + global exception filter / error taxonomy. Minimum candidates to verify:

- Validation / bad request (e.g. `VALIDATION_*`) — TODO: confirm codes.
- **`CAPACITY_FULL`** — when applicable to mutations (confirm contexts).
- **`IDEMPOTENCY_KEY_REPLAY_MISMATCH`** (or equivalent) — when idempotency header replay does not match stored request hash — TODO: confirm code string and HTTP status from runtime.

#### High-level UX expectations (example FE states)

| FE phase | Example UI state | Backend alignment |
|----------|------------------|-------------------|
| Submitting intake | `loading` on **S-PART-02** | Single **POST** to `/tours/{tourId}/register`. |
| Accepted with seat | success on **S-PART-03** showing **`Accepted`** | No **`Pending`** as initial public outcome in v1. |
| Waitlisted | success / dedicated branch showing **waitlist** position or acknowledgement | **`Waiting`**; TODO: dedicated screen ID if any. |
| Payment required next | Navigate to payment / intent (Section B) | Registration already **`Accepted`**; payment async. |
| Errors | **S-PART-02** `error` / mapped codes | TODO: full code → banner matrix. |

---

## Section B — Payment & Async UX

### B1. Payment State Model (Participant)

- **ID:** B1  
- **Type:** UX / Status Semantics  
- **Priority:** HIGH  
- **Description:** FE must model **two parallel axes** (see `docs/runtime-lifecycle.md` and `apps/api/openapi.json`):

  **1) Payment record (`PaymentResponseDto.status`)** — lifecycle of the **payment entity** (gateway + webhook):

  | Backend `Payment.status` | Suggested FE UX label (draft — finalize in design pass) |
  |--------------------------|-----------------------------------------------------------|
  | `Pending` | **Payment Pending Confirmation** (awaiting verification — aligns with **WF-PAY-ASYNC-01**) |
  | `Paid` | **Payment Successful** (money captured per provider event — still confirm registration projection) |
  | `Failed` | **Payment Failed** (aligns with **WF-PAY-FAIL-01**) |
  | `Refunded` | **Payment Refunded** |
  | `Cancelled` | **Payment Cancelled** |

  **2) Registration (`RegistrationResponseDto.status`)** — placement and eligibility relative to the tour:

  | Backend `Registration.status` (payment-relevant) | Suggested FE UX label (draft) |
  |--------------------------------------------------|--------------------------------|
  | `Accepted` | Registration accepted — **payment may still be pending** |
  | `AcceptedPaid` | Registration confirmed paid |
  | `Rejected` | **Registration rejected** (includes outcome when **`Payment.status` → `Failed`** per runtime — see `docs/runtime-lifecycle.md`) |
  | `Refunded` | Registration refunded (after refund flow — `AcceptedPaid -> Refunded` in runtime doc) |

  **Why two fields:** **Registration placement** for the public flow is established synchronously when capacity allows (**`Accepted`** after successful register — Section A2). **Payment settlement** is **asynchronous**: webhook updates **`Payment.status`** and then **registration** transitions (**`Accepted` → `AcceptedPaid`** on paid event, **`Accepted` → `Rejected`** on failed payment per runtime). FE must not collapse these into a single “payment badge” without stating which object it reflects.

  **`registration.paymentStatus`** (`NotPaid` | `Partial` | `Paid` in OpenAPI `RegistrationResponseDto`) is a **summary** on the registration aggregate; the **authoritative payment lifecycle** for troubleshooting and pending/failed/refunded edge cases is **`Payment.status`** on the payment record (and optional **`payment`** snapshot on registration — TODO: confirm shape and freshness vs `GET` payment by id if exposed to participant).

- **Tasks:**
  - [ ] Define **final user-facing labels** per locale for each row above (product/design owner).
  - [ ] Update `docs/10-product/screen_state_spec_v2.md` (TODO: confirm exact filename) — **S-PART-03**, **S-PART-04**: document simultaneous display rules for **`registration.status`** + **`payment`** / **`Payment.status`** semantics.
  - [ ] Update `docs/10-product/wireflows_must_have_journeys_v2.md` (TODO: confirm exact filename) — journeys **J-P-03**, payment-related leader journeys — so steps match async model.
  - [ ] Cross-check enums against **`PaymentResponseDto`** and **`RegistrationResponseDto`** in `apps/api/openapi.json` — TODO: note any drift vs runtime if discovered.

---

### B2. Async Payment Confirmation (Webhook Delay)

- **ID:** B2  
- **Type:** UX / Flow  
- **Priority:** HIGH  
- **Conceptual wireframe ID:** **`WF-PAY-ASYNC-01` — “Payment Pending Confirmation”**  
  This state **must** be represented in `docs/10-product/screen_state_spec_v2.md` (TODO: confirm exact filename), typically on **S-PART-03** / **S-PART-04** or a dedicated step after gateway return.

- **Description:** After redirect back from the payment gateway:

  - **`Payment.status`** may still be **`Pending`** until the provider webhook is processed.
  - **`Registration.status`** typically remains **`Accepted`** until the payment succeeds or fails — **do not** show “registration fully confirmed” copy that implies **`AcceptedPaid`** while payment is still pending.
  - FE **must not** treat gateway redirect alone as success.
  - FE **must** show a **pending verification** experience (**WF-PAY-ASYNC-01**) with clear copy (“Confirming payment…”).
  - FE **must** refresh state by polling **`GET /api/v2/registrations/{registrationId}`** (source of registration + embedded **`payment`** snapshot per OpenAPI — TODO: confirm polling cadence and backoff policy with team).
  - **Polling timeout / stale pending:** if **`Payment.status`** stays **`Pending`** beyond a policy threshold — TODO: confirm timeout (e.g. show support / refresh / “still processing” with manual retry); typical UX fallback is non-blocking banner + primary action **Refresh status** + link to support — TODO: product decision.
  - **User closes browser before redirect completes:** on next app load / deep link, FE **must** resume from **`GET /api/v2/registrations/{id}`** (and payment context) — recover state from history load, not from in-memory gateway callback alone.

  **Rationale (provider contract):** OpenAPI documents **`POST /internal/payments/webhook`** as **always HTTP `200`** to the payment provider, **even when internal processing errors or is slow** — therefore **HTTP status from webhook is not a FE-visible signal**. Final truth for the user is **polling registration** (and any payment snapshot fields returned there).

- **Tasks:**
  - [ ] Add **`WF-PAY-ASYNC-01`** explicitly to `docs/10-product/screen_state_spec_v2.md` (TODO: confirm filename) with mandatory states (`loading` / success pending branch / error / retry).
  - [ ] Update `docs/10-product/wireflows_must_have_journeys_v2.md` (TODO: confirm filename) — payment journey: **no “success” step** tied only to return URL from gateway.
  - [ ] Document polling interval, max duration, and timeout UX — TODO: confirm owners (FE + product).
  - [ ] Document “resume after close tab” behavior in wireflow — TODO: confirm deep-link strategy.

---

### B3. Payment Failure and Capacity Release

- **ID:** B3  
- **Type:** UX / Flow  
- **Priority:** HIGH  
- **Conceptual wireframe ID:** **`WF-PAY-FAIL-01` — “Payment Failed”**

- **Description:** When **`Payment.status`** becomes **`Failed`** (webhook-driven per `docs/runtime-lifecycle.md`):

  - Backend transitions **`Registration.status`**: **`Accepted` → `Rejected`** (payment failure path).
  - **Capacity** tied to the registration is **released** when leaving capacity-consuming states (see capacity rule in `docs/runtime-lifecycle.md`: e.g. **`Accepted` → `Rejected`**).
  - **Waitlist promotion:** a **`Waiting`** item may be promoted when capacity frees — **exact ordering and triggers** depend on backend queue logic — TODO: confirm with `docs/runtime-lifecycle.md` / waitlist implementation notes (TODO: confirm doc paths).

  FE **must** show a **dedicated failure state** (**WF-PAY-FAIL-01**), not only a toast:

  - **Reason:** show failure detail **if** the API exposes it — `PaymentWebhookDto` includes optional **`reason`** for webhook payloads; participant-facing registration response — TODO: confirm whether **`registration.payment`** snapshot or another field surfaces user-visible failure reason (TODO: confirm field names from OpenAPI examples / DTO).
  - **Impact:** copy must state that **registration is rejected** and the **seat is released** (aligned with runtime).
  - **Next actions (draft):** retry payment **if** product allows a new attempt / new intent — TODO: confirm business rules; browse other tours; join waitlist where applicable (cross-ref **Section C**).

- **Tasks:**
  - [ ] Update `docs/10-product/wireflows_must_have_journeys_v2.md` (TODO: confirm filename) with **WF-PAY-FAIL-01** branch and recovery paths.
  - [ ] Update `docs/10-product/screen_state_spec_v2.md` (TODO: confirm filename) — **S-PART-03** / **S-PART-04** — for **`Failed`** payment + **`Rejected`** registration combination.
  - [ ] Document state transitions in product docs: link **`Payment.status` `Failed`** ↔ **`Registration.status` `Rejected`** ↔ capacity release — cite `docs/runtime-lifecycle.md`.

---

### B4 — Payment Lifecycle Mini-Spec (FE Contract)

This subsection is the **FE-facing contract summary** for payment. Authoritative backend behavior is **`docs/runtime-lifecycle.md`**; shapes are in **`apps/api/openapi.json`** (`PaymentResponseDto`, `RegistrationResponseDto`, `PaymentWebhookDto`, `CreatePaymentIntentDto`).

#### Source of truth

- **Payment entity lifecycle:** `Pending` → `Paid` | `Failed`; `Paid` → `Refunded` | `Cancelled`; terminal states per runtime (`docs/runtime-lifecycle.md` § Payment Lifecycle).
- **Registration transitions driven by payment results** (same doc):  
  - Webhook **`Paid`** → **`Accepted` → AcceptedPaid**  
  - Webhook **`Failed`** → **`Accepted` → Rejected**  
  - Refund flow → **`AcceptedPaid` → Refunded** (and related payment **`Refunded`**)

#### Text-only combined flow (happy path + branches)

```
Public register (capacity OK) → Registration.status = Accepted
        → (if tour requires payment) create payment intent → user completes gateway
        → redirect to app: typically Payment.status = Pending, Registration.status = Accepted
        → webhook processes:
              Paid   → Payment.status = Paid,   Registration.status = AcceptedPaid
              Failed → Payment.status = Failed, Registration.status = Rejected (capacity released; waitlist may move — TODO: confirm)
              Refunded (after Paid) → Payment.status = Refunded, Registration transitions per refund rules (AcceptedPaid → Refunded)
              Cancelled (edge) → Payment.status = Cancelled — TODO: confirm resulting Registration.status mapping for FE (not fully enumerated here)
```

#### Backend → FE UX mapping (summary table)

| Payment.status | Registration.status (typical) | FE UX state ID |
|----------------|---------------------------------|----------------|
| `Pending` | `Accepted` | **WF-PAY-ASYNC-01** |
| `Paid` | `AcceptedPaid` | Success path (paid + confirmed) |
| `Failed` | `Rejected` | **WF-PAY-FAIL-01** |
| `Refunded` | `Refunded` (from paid/refund path) | Refunded / support messaging |
| `Cancelled` | TODO: confirm mapping | Cancelled messaging |

#### Error surfaces (non-exhaustive — TODO: confirm with backend & support playbooks)

| Situation | FE expectation |
|-----------|----------------|
| Duplicate payment / second intent when one pending exists | Surface API error — TODO: confirm error code from OpenAPI / runtime for “pending payment already exists”. |
| Timeout (webhook delayed or lost) | Continue **WF-PAY-ASYNC-01**; escalate per timeout policy — TODO: confirm ops SLA. |
| User closes page before redirect completes | Resume via **`GET /api/v2/registrations/{id}`** on next visit. |
| Webhook returns 200 but internal processing fails | User still polls registration; may remain **`Pending`** or show inconsistent state — TODO: confirm reconciliation UX / support path. |
| Partial failures | TODO: define (e.g. paid at provider but registration transition conflict) — confirm with backend. |

---

## Section C — Waitlist & Capacity

### C1 — Capacity Behaviour

- **ID:** C1  
- **Type:** UX / Product / Status Semantics  
- **Priority:** MEDIUM–HIGH  
- **Description:** Capacity rules and outcomes are defined in **`docs/runtime-lifecycle.md`** (§ Capacity Rule, § Registration Lifecycle, § Waitlist Lifecycle). FE must distinguish **`Registration`** rows from **`WaitlistItem`** rows (see OpenAPI **`RegistrationResponseDto`** vs **`WaitlistItemResponseDto`**).

  **When capacity is available** at successful public registration commit:

  - **`Registration.status = Accepted`** (`docs/runtime-lifecycle.md` — public path when capacity exists).

  **When capacity is full** at registration commit:

  - Outcome is **waitlist placement**: **`WaitlistItem.status = Waiting`**.  
  - **`Registration.status = Waiting` does not exist** on the registration entity — the user is **on the waitlist**, but the backend enum for that concept is on **`WaitlistItem`**, not **`Registration`** (see **`WaitlistItemResponseDto.status`** in **`apps/api/openapi.json`**). FE may still show copy like “waiting list” that maps to this state.

  **On payment failure** (webhook **`Failed`**):

  - **`Registration.status`:** **`Accepted` → `Rejected`** (`docs/runtime-lifecycle.md`).  
  - **Capacity is released** when leaving capacity-consuming statuses (same doc, § Capacity Rule — example **`Accepted` → `Rejected`**).

  **On refund (`AcceptedPaid` → `Refunded`):**

  - **`docs/runtime-lifecycle.md`** lists **`AcceptedPaid -> Refunded`** and states capacity decreases when leaving consuming statuses (includes **`AcceptedPaid -> Refunded`** in examples).  
  - **TODO:** Confirm product semantics: does a **refunded** seat always return to the pool for waitlist promotion in every scenario? Confirm **`acceptedCount`** behavior with backend policy.

  **Synchronous capacity check / reservation:**

  - Capacity for **`Accepted`** is enforced in the registration transaction path (per runtime overview).  
  - **TODO:** Confirm whether any **soft hold** exists during **`Payment.status = Pending`** without consuming capacity — **`docs/runtime-lifecycle.md`** states **`Accepted`** and **`AcceptedPaid`** consume capacity; do **not** assume an undocumented reservation.

  **Race / concurrent submit:**

  - Last-seat contention may yield capacity-full or conflict outcomes — TODO: map **`CAPACITY_FULL`** / **`CONCURRENCY_CONFLICT`** (confirm strings) from **`apps/api/openapi.json`** and error taxonomy. Extend UX beyond generic banner (**seat lost during submit** pattern).

- **Tasks:**
  - [ ] Confirm **seat release** logic in **`docs/runtime-lifecycle.md`** (§ Capacity Rule and transitions); extend with backend pointer — TODO: confirm if extra ops doc needed.
  - [ ] Document **refund → capacity / waitlist** impact for FE after business sign-off (TODO: owner).
  - [ ] Update wireflows — **`docs/10-product/wireflows_must_have_journeys_v2.md`** (TODO: confirm exact filename): **Accepted** vs **waitlist `Waiting`** branches (correct enums).
  - [ ] Update **`docs/10-product/screen_state_spec_v2.md`** (TODO: confirm exact filename) — copy for accepted vs waitlisted paths.

---

### C2 — Waitlist Placement & Promotion

- **ID:** C2  
- **Type:** UX / Flow  
- **Priority:** MEDIUM–HIGH  

#### Waitlist placement

- **Trigger:** Capacity full when **`POST /api/v2/tours/{tourId}/register`** (or aligned public endpoint) is processed.  
- **Backend outcome:** **`WaitlistItem.status = Waiting`** (`docs/runtime-lifecycle.md`).  
- **FE must show** clear messaging (draft): **“You are on the waiting list.”**  
- **Payment intent at this stage:** Registration row may be **absent** for this signup; **`docs/runtime-lifecycle.md`** ties payment intent to registration when payment is required **after** **`Accepted`**. **TODO:** Confirm from **`apps/api/openapi.json`** / actual **`201`** body whether **`paymentIntent`** is **`null`** when the response is waitlist-only.

#### Promotion flow (canonical)

1. A seat becomes available (e.g. payment failure **`Accepted` → `Rejected`**, leader **`Cancelled`**, capacity increase — **`docs/runtime-lifecycle.md`**; **TODO:** confirm all triggers).  
2. Backend promotes the **first eligible `WaitlistItem` in `Waiting`** (**TODO:** confirm ordering — FIFO vs other). Promotion lifecycle: **`Waiting` → `Converted`** (same doc). *(This is not “promoting a Registration in Waiting status” — registration rows do not use **`Waiting`**.)*  
3. The promoted user ends up with **`Registration.status = Accepted`** (new or linked registration — **TODO:** confirm **`promotedRegistrationId`** and discovery in API).  
4. **FE detection:** **`GET /api/v2/registrations/{registrationId}`** when **`registrationId`** exists; **TODO:** confirm whether a **list** endpoint (or other) is required for dashboards — verify **`apps/api/openapi.json`** for participant-accessible **GET** routes. If user only has **`waitlistItemId`**, confirm polling strategy — **TODO:** participant **GET** by waitlist id in OpenAPI (may be absent).

- **Promotion is async** — user may be offline; **recover on next load** via refetch.  
- **UX state `WF-WAIT-PROMOTED-01`:** e.g. **“You have been promoted from the waitlist”** → then guide to **payment** if required (Section B).  
- **Auto-start payment:** assume **NO** until product says otherwise — user-triggered CTA — **TODO:** confirm.  
- **TODO:** Payment deadline after promotion — **not** specified in **`docs/runtime-lifecycle.md`**.  
- **TODO:** Queue ordering (**FIFO** vs other) — confirm with backend.

- **Tasks:**
  - [ ] Add **`WF-WAIT-PROMOTED-01`** to `docs/10-product/screen_state_spec_v2.md` (TODO: confirm exact filename).
  - [ ] Update `docs/10-product/wireflows_must_have_journeys_v2.md` (TODO: confirm exact filename) — promotion + payment handoff.
  - [ ] Clarify **payment window** after promotion — TODO: product owner.
  - [ ] Document **queue ordering** — TODO: confirm with backend.
  - [ ] Decide participant-facing **waitlist status** surface (variant of **S-PART-03**, new screen, or deep link) — update `docs/10-product/screens_overview.md` (TODO: confirm exact filename).

---

### C3 — Waitlist & Capacity Mini-Spec (FE Contract)

Authoritative: **`docs/runtime-lifecycle.md`**; tour fields: **`TourResponseDto`** in **`apps/api/openapi.json`** (`totalCapacity`, `acceptedCount`).

#### Source of truth

- **`Registration.status`** — booking row when present.  
- **`WaitlistItem.status`** — **`Waiting` | `Converted` | `Cancelled`**.  
- **Capacity:** **`acceptedCount`** / **`totalCapacity`** on tour projections — TODO: list which GET endpoints return them for participant FE.

#### Text lifecycle diagram

**Compact (FE mental model):**

```
register
  → if capacity available at commit → Registration.status = Accepted
  → else → WaitlistItem.status = Waiting   (not Registration.status — see C1)

WaitlistItem Waiting
  → if promoted → typically new Registration with status Accepted (TODO: confirm API)
  → if cancelled (user/leader) → Cancelled
  → if tour closed / archived while Waiting → TODO: confirm outcome (Rejected registration? WaitlistItem cancelled? — not explicit in runtime-lifecycle excerpt)

Registration Accepted
  → if payment succeeds (async) → AcceptedPaid
  → if payment fails (async) → Rejected (capacity released)

Registration AcceptedPaid
  → refund path → Refunded (capacity impact per runtime doc — TODO: edge cases)
```

**Aligned with public `POST` path (detail):**

```
POST .../register
  → capacity OK  → Registration.status = Accepted
  → capacity full → WaitlistItem.status = Waiting (TODO: confirm response body keys in OpenAPI examples)

WaitlistItem Waiting
  → promoted → Converted; user typically gains Registration Accepted (TODO: confirm discovery API)
```

#### Mapping table (draft FE labels)

| Backend signal | Suggested FE UX label |
|----------------|------------------------|
| `WaitlistItem.status = Waiting` | **On waitlist** |
| `Registration.status = Accepted` after promotion | **Seat available — complete payment** (if payment required) — TODO: copy |
| `Registration.status = Rejected` (payment failure) | **Registration rejected** |
| `Registration.status = AcceptedPaid` | **Confirmed** |

#### Edge cases (TODO unless documented elsewhere)

| Edge case | Note |
|-----------|------|
| Two promotions at the same time | TODO: backend ordering — FE refreshes read models |
| Promoted but payment not completed in time | TODO: confirm rule (timeout / auto-release) |
| Capacity manually increased by admin | TODO: product/backend |
| Tour **archived** or **cancelled** while user is **`Waiting`** | TODO: confirm outcome for waitlist item / any registration |
| Concurrent registration race | See **C1** — TODO error codes |

---

## Section D — Admin Overrides & Manual Status Changes

Operators (**leader** and/or **admin** roles per product — TODO: confirm RBAC) may change lifecycle states via **`PATCH /api/v2/registrations/{registrationId}/status`**, **`PATCH /api/v2/registrations/{registrationId}/payment`**, waitlist **convert/cancel**, **`POST /api/v2/payments/intent`**, **`POST .../admin/payments/{id}/refund`**, and tour updates — **only where documented in `apps/api/openapi.json`**. This section describes **FE tolerance** for outcomes that **did not** originate from the participant’s own clicks (manual reconciliation, support actions, internal tools).

**FE rule:** Treat **`GET /api/v2/registrations/{id}`** (and related reads) as **source of truth** on refresh; do not assume the UI’s optimistic path matches the server after an admin change.

---

### D1 — Manual Registration Status Changes

- **ID:** D1  
- **Type:** UX / Operations  
- **Priority:** MEDIUM–HIGH  
- **Description:** Manual updates may apply transitions allowed by backend rules (see **`docs/runtime-lifecycle.md`** and **`UpdateRegistrationStatusDto`** / **`targetStatus`** enum in **`apps/api/openapi.json`**). Examples **not exhaustive — TODO: confirm policy**:

  - **`Accepted` → `Rejected`** (operator rejects a confirmed placement).
  - **`Accepted` → `AcceptedPaid`** — **TODO:** confirm whether admins can set **`AcceptedPaid`** directly via status endpoint vs only via payment flows; do not assume without backend confirmation.
  - **Waitlist → accepted placement:** operational **conversion** is modeled as **`WaitlistItem` `Waiting` → `Converted`** with a linked **`Registration`** (typically **`Accepted`**) — **TODO:** confirm manual vs automatic paths (see **`POST /api/v2/waitlist-items/{id}/convert`** in OpenAPI).

  **FE implications:**

  - **Backend status is authoritative** on every load.
  - **Do not assume** transitions occur only from participant UI (gateway, forms).
  - Show neutral sync messaging where useful — TODO: product copy for **“Updated by organizer”** / audit (**TODO:** confirm if API exposes `updatedAt` / actor — OpenAPI `RegistrationResponseDto` has timestamps; actor — TODO).

- **Tasks:**
  - [ ] Document **admin-driven** transitions alongside automated ones in **`docs/runtime-lifecycle.md`** or ops appendix — TODO: confirm target file.
  - [ ] Update **`docs/10-product/screen_state_spec_v2.md`** (TODO: confirm exact filename) — banners when status changes without local user action (refresh / polling).
  - [ ] Add UX copy for **“Updated by organizer”** / similar — TODO: localization owner.

---

### D2 — Admin Capacity Changes

- **ID:** D2  
- **Type:** UX / Operations  
- **Priority:** MEDIUM  
- **Description:** Tour **`totalCapacity`** may change via **`PATCH /api/v2/tours/{tourId}`** (leader per OpenAPI — TODO: confirm admin role if any). Effects:

  - **Increase:** May free logical room for **waitlist promotion** — **`docs/runtime-lifecycle.md`** describes promotion when capacity is released; **TODO:** confirm whether increasing **`totalCapacity`** alone triggers the same promotion jobs as a cancellation/refund, or only after reconciliation cycle.
  - **Decrease:** **TODO:** confirm whether backend allows decreasing capacity below **`acceptedCount`** and resulting behavior (errors, forced transitions).

  **Waitlist chain (conceptual — align with Section C):** **`WaitlistItem.status`**: **`Waiting` → `Converted`** when promoted; resulting **`Registration.status`** typically **`Accepted`**. Do **not** label backend enum as “Promoted” — use **`Converted`** per **`WaitlistItemResponseDto`**.

- **Tasks:**
  - [ ] Clarify whether promotion runs **automatically** when capacity increases — TODO: backend/product.
  - [ ] Update waitlist / capacity docs (**`docs/runtime-lifecycle.md`** or wireflows — TODO: confirm file) after confirmation.
  - [ ] Define **FE recovery**: on reload, **`GET`** tour + registration/waitlist reads reflect new capacity — polling strategy TODO.

---

### D3 — Admin Payment Overrides

- **ID:** D3  
- **Type:** UX / Operations  
- **Priority:** MEDIUM–HIGH  
- **Description:** Overrides may use **leader** registration payment patch and/or **admin** payment APIs **as listed in OpenAPI** — do not invent routes.

  **Payment record (`Payment.status` per `PaymentResponseDto`):** transitions in **`docs/runtime-lifecycle.md`** include **`Pending` → `Paid` | `Failed`**, **`Paid` → `Refunded` | `Cancelled`**. Manual actions might mirror webhook outcomes — **TODO:** map each admin UI action to actual endpoint (`PATCH` registration payment vs **`POST .../admin/payments/{id}/refund`** vs intent creation).

  **Registration impact (from runtime doc — automated webhook path):** **`Paid` → `AcceptedPaid`**, **`Failed` → `Rejected`**, refund path **`AcceptedPaid` → `Refunded`**. **Manual `PATCH` payment** on registration uses **`UpdateRegistrationPaymentDto`** enum **`NotPaid` | `Partial` | `Paid`** — **different surface** from **`Payment.status`**; FE must not conflate without a mapping table (**TODO:** confirm how manual **`Paid`** aligns with **`Payment`** entity).

  **Payment `Cancelled` → Registration:** **TODO:** confirm resulting **`Registration.status`** (e.g. **`Rejected`** vs unchanged) — **not** fully enumerated in **`docs/runtime-lifecycle.md`** excerpt for admin cancel.

  **FE UX:** After refresh, show whatever **`GET /api/v2/registrations/{id}`** returns; optional banner **“Updated by organizer”** — TODO: copy.

- **Tasks:**
  - [ ] Produce admin vs participant permission matrix — TODO: `apps/api/openapi.json` + roles only.
  - [ ] Update **`docs/10-product/screen_state_spec_v2.md`** (TODO: confirm filename) for payment/registrations panels when override occurs.
  - [ ] Document **`registration.paymentStatus`** vs **`payment`** snapshot divergence after manual edits — TODO: backend confirmation.

---

### D4 — Admin Lifecycle Mini-Spec (FE Contract)

#### Source of truth (same aggregates as B4 / C3)

- **`Registration.status`**
- **`Payment.status`** (payment entity)
- **`WaitlistItem.status`**
- **Tour:** **`acceptedCount`**, **`totalCapacity`** (`TourResponseDto`)

#### Important rule

FE must render the **latest backend state** from reads (`GET`), even when it **contradicts** the user’s last action (e.g. user still sees “Pending” locally while admin marked paid).

#### Example scenario

| Step | User sees (wrong if stale) | After refresh (`GET` registration) |
|------|----------------------------|-------------------------------------|
| User left on payment **Pending** | Local UI **Pending** | **`Payment.status`** may be **`Paid`**, **`Registration.status`** **`AcceptedPaid`** |
| Admin rejects registration | User thought **Accepted** | **`Rejected`** |

#### Mapping table (backend change → FE UX — draft labels)

| Backend signal (illustrative) | FE UX state / copy |
|-------------------------------|---------------------|
| **`Payment.status`** → **`Paid`** (incl. manual) | **Payment confirmed** / **Paid** |
| **`Registration.status`** → **`Rejected`** (admin or payment failure) | **Registration rejected** — TODO: distinguish organizer vs payment |
| **`WaitlistItem`** promoted (**`Converted`**) + **`Registration Accepted`** | **Seat available — complete payment** (Section C **WF-WAIT-PROMOTED-01**) |
| **`Registration.status`** → **`Refunded`** | **Refunded** / support messaging |

**TODO:** Confirm whether API exposes **reason** or **actor** for manual changes for copy differentiation.

---

## Section E — Idempotency & Duplicate Submission

### E1. Global Idempotency UX Pattern

- **ID:** E1  
- **Type:** UX / Global  
- **Priority:** HIGH  
- **Description:** Many mutations require **idempotency keys**. Backend can return replay-related errors (e.g. **IDEMPOTENCY_KEY_REPLAY_MISMATCH** — confirm exact code in taxonomy). Frontend needs a **global pattern**: disable double submit, stable idempotency key generation, and user-facing message on mismatch—not only per-form ad hoc handling.  
- **Tasks:**
  - [ ] Document FE standards: header names (`Idempotency-Key` vs `idempotency-key` — TODO: confirm per endpoint from `apps/api/openapi.json`).
  - [ ] Add **global UX pattern** section (new subsection in `screen_state_spec_v2.md` or separate FE guideline doc — TODO: confirm location).
  - [ ] Map **IDEMPOTENCY_KEY_REPLAY_MISMATCH** (TODO: confirm string) to a dedicated UI outcome in error crosswalk — TODO: confirm file (`wireflows_must_have_journeys_v2.md` error crosswalk section).

---

## Section F — Registration Status Coverage

### F1. Add AcceptedPaid & Refunded to Participant Status

- **ID:** F1  
- **Type:** UX / Status Semantics  
- **Priority:** MEDIUM–HIGH  
- **Description:** `RegistrationResponseDto` in OpenAPI includes statuses such as **AcceptedPaid** and **Refunded**. Participant registration status view in `screen_state_spec_v2.md` lists canonical statuses but **does not fully treat AcceptedPaid / Refunded** as first-class success/outcomes where applicable—risk of wrong empty states or copy.  
- **Tasks:**
  - [ ] Update **S-PART-03** success states in `docs/10-product/screen_state_spec_v2.md` to explicitly include **AcceptedPaid** and **Refunded** with user-facing labels.
  - [ ] Cross-check `docs/runtime-lifecycle.md` transitions (payment success → AcceptedPaid, refund paths → Refunded).
  - [ ] Update wireflow completion criteria if “final” registration state definitions change — TODO: confirm journeys **J-P-02**, **J-P-03**.

---

## Section G — Session & Network

### G1. Session Expired Mid-Journey

- **ID:** G1  
- **Type:** Global / UX  
- **Priority:** MEDIUM  
- **Description:** **401** / auth failures can occur mid-form or after returning from payment. Screen specs include **permission_denied** in places but may not define a **consistent session-expired journey** (recovery, preserve draft — TODO: product decision).  
- **Tasks:**
  - [ ] Define global behavior: redirect to login, toast, modal — TODO: owner (design).
  - [ ] Document session expiry for **payment return path** specifically (deep link / token refresh — TODO: confirm app architecture).
  - [ ] Add references in `screen_state_spec_v2.md` or app-wide FE guidelines — TODO: confirm filename.

---

### G2. Network / Offline Error States

- **ID:** G2  
- **Type:** Global / UX  
- **Priority:** MEDIUM  
- **Description:** Network failures are often indistinguishable from generic **error** states; optional distinction (**offline**, **retry with backoff**) improves trust but is not fully specified.  
- **Tasks:**
  - [ ] Decide minimum bar for v1: generic **error + retry** only vs dedicated **offline** state — TODO: product call.
  - [ ] If dedicated offline state is in scope, extend **S-PART-02**, **S-PART-04**, leader panels in `screen_state_spec_v2.md` — TODO: which screens are P0.

---

## Section H — Status Dictionary (Cross-Entity, FE Contract)

**Purpose:** One place to map **backend-truth** enums (from `apps/api/openapi.json`) and **`docs/runtime-lifecycle.md`** to **FE labels** and rough **when-it-happens** notes. This is a **contract summary**, not a substitute for OpenAPI or runtime docs.

**Sources of truth:** `RegistrationResponseDto.status`, `PaymentResponseDto.status`, `WaitlistItemResponseDto.status` in **`apps/api/openapi.json`**; transition narratives in **`docs/runtime-lifecycle.md`**. Where runtime lists behaviors but omits an enumeration detail, use **TODO**.

**Optional — Refund as its own entity:** OpenAPI exposes **`RefundPaymentDto`** (request body) and payment/refund **routes**; there is **no** separate `Refund` aggregate with its own `status` enum in the sampled schemas. Treat **refund outcomes** via **`Payment.status`** (`Refunded`) and **`Registration.status`** (`Refunded` per runtime) — **TODO:** confirm if any additional refund-only read model exists.

---

### H1 — Registration Status Dictionary

Enums from **`RegistrationResponseDto.status`** in **`apps/api/openapi.json`** (exact strings).

| Entity | Status | Meaning (backend truth) | When it occurs | FE label (draft) | Notes / TODO |
|--------|--------|-------------------------|----------------|------------------|--------------|
| Registration | `Pending` | Registration row exists but not yet committed to **`Accepted`** semantics for this flow | **`docs/runtime-lifecycle.md`** notes **`Pending`** in transition logic; **v1 public register** path aims for **`Accepted`** first paint when capacity exists (**Section A2**) — TODO: document non-public / legacy paths that yield **`Pending`** | Application / pending review (draft) | **TODO:** Do not use **`Pending`** as the default public-success state (**Section A2**). |
| Registration | `Accepted` | Placement confirmed; may still owe payment | Public register with capacity (**Section A2**); after waitlist conversion per **Section C** / runtime | Seat reserved / accepted (draft) | With tour payment: pair with **`Payment.status`** for “pay now” vs paid (**H4**). |
| Registration | `AcceptedPaid` | Paid in full per business rules | Runtime: **`Accepted` → `AcceptedPaid`** when payment webhook is **`Paid`** | Registration confirmed / paid (draft) | Runtime: **`Accepted`** and **`AcceptedPaid`** both consume capacity. |
| Registration | `Rejected` | Not admitted or placement revoked | Runtime: **`Accepted` → `Rejected`** (payment **`Failed`** or manual status); runtime also allows transitions **into** **`Rejected`** from **`AcceptedPaid`** — TODO: FE copy for payment vs operator | Registration rejected (draft) | **TODO:** Map to **`Payment.Failed`** vs leader action (**Section D**). |
| Registration | `Cancelled` | Registration cancelled | Runtime: **`Accepted` → `Cancelled`** (manual); **`AcceptedPaid` → `Cancelled`** | Cancelled (draft) | **TODO:** Participant-initiated vs operator (**Section D**). |
| Registration | `NoShow` | Attendance / ops outcome | Listed in OpenAPI and runtime “observed”; **`docs/runtime-lifecycle.md`** does not enumerate transitions **into** **`NoShow`** — TODO: confirm rules | No-show (draft) | **TODO:** Lifecycle doc vs OpenAPI — add transitions or mark ops-only. |
| Registration | `Refunded` | Money returned; registration outcome | Runtime: **`AcceptedPaid` → `Refunded`** | Refunded (draft) | Align with **`Payment.Refunded`** (**H2**). |

---

### H2 — Payment Status Dictionary

Enums from **`PaymentResponseDto.status`** in **`apps/api/openapi.json`**.

| Entity | Status | Meaning (backend truth) | When it occurs | FE label (draft) | Notes / TODO |
|--------|--------|-------------------------|----------------|------------------|--------------|
| Payment | `Pending` | Settlement not finalized | Intent created; awaiting gateway / webhook | Payment pending (draft) | Pair with **`Registration.Accepted`** when payment still required (**H4**). |
| Payment | `Paid` | Successful settlement | Runtime: **`Pending` → `Paid`** | Paid / confirmed (draft) | Drives **`Registration` → `AcceptedPaid`** per runtime (async). |
| Payment | `Failed` | Settlement failed | Runtime: **`Pending` → `Failed`** | Payment failed (draft) | Runtime ties to **`Registration` → `Rejected`** from **`Accepted`** path. |
| Payment | `Refunded` | Charge reversed | Runtime: **`Paid` → `Refunded`** | Refunded (draft) | Terminal for payment; align **`Registration.Refunded`** (**H1**). |
| Payment | `Cancelled` | Payment voided / cancelled | Runtime documents **`Paid` → `Cancelled`**; **`Pending` → `Cancelled`** is **not** listed in **`docs/runtime-lifecycle.md`** — TODO: confirm if possible via code paths | Payment cancelled (draft) | **TODO:** Registration side effect when payment **`Cancelled`** (**Section D**). |

---

### H3 — WaitlistItem Status Dictionary

Enums from **`WaitlistItemResponseDto.status`** in **`apps/api/openapi.json`**.

| Entity | Status | Meaning (backend truth) | When it occurs | FE label (draft) | Notes / TODO |
|--------|--------|-------------------------|----------------|------------------|--------------|
| WaitlistItem | `Waiting` | On queue | Capacity full at intake or explicit waitlist path; runtime: initial waitlist state | On waiting list (draft) | **Not** a **`Registration.status`** — **Section C**. |
| WaitlistItem | `Converted` | Promoted / linked to placement | Runtime: **`Waiting` → `Converted`** (manual conversion or automatic promotion when capacity released) | Seat available — proceed (draft) | Typically accompany **`Registration.Accepted`** — TODO: always paired on read model? |
| WaitlistItem | `Cancelled` | Waitlist entry cancelled | Runtime: **`Waiting` → `Cancelled`** (manual cancellation) | Removed from waitlist (draft) | OpenAPI has **`Cancelled`** only — **no** `Rejected` on **`WaitlistItem`** — TODO: admin “reject waitlist” maps to **`Cancelled`** vs **TODO: confirm**. |

---

### H4 — Cross-Entity Combined Labels

Representative **user-facing** bundles (draft copy — **TODO:** product + localization). Align with **Sections B, C, D** where cited.

| Combined backend signal | FE UX label / state (draft) |
|-------------------------|-------------------------------|
| **`Registration.Accepted`** + **`Payment.Pending`** (payment required) | Seat reserved — complete payment |
| **`Registration.Accepted`** + payment not required / settled outside snapshot | TODO: **`registration.paymentStatus`** vs **`payment`** — confirm which field FE trusts (**Section B**) |
| **`Registration.AcceptedPaid`** | Registration confirmed |
| **`Registration.Rejected`** (after payment failure from **`Accepted`**) | Registration rejected — payment failed (draft) |
| **`Registration.Rejected`** (operator-driven from **`Accepted`**) | Registration cancelled by organizer (draft) — **TODO:** distinguish if API exposes reason (**Section D**) |
| **`Registration.Cancelled`** | Registration cancelled |
| **`Registration.Refunded`** | Refunded |
| **`Registration.NoShow`** | Did not attend / no-show (draft) |
| **`WaitlistItem.Waiting`** | On waiting list |
| **`WaitlistItem.Converted`** + **`Registration.Accepted`** (typical) | Seat available — proceed to payment (see **Section C** **WF-WAIT-PROMOTED-01**) |
| **`WaitlistItem.Cancelled`** | No longer on waiting list |

---

## Section I — Global Lifecycle Diagram (Textual)

**Purpose:** Single **text** view of the end-to-end story aligned with **`docs/runtime-lifecycle.md`**, **Section H** (status dictionary), and **Sections A–G** (no PNG). **Waitlist** state lives on **`WaitlistItem`**, not **`Registration.status`**.

**Legend:** `→` = runtime-documented transition where stated; **TODO** = not fully specified in `docs/runtime-lifecycle.md` or needs code confirmation.

```
Participant journey (contract-level)

Register (POST tour register — Section A2)
 ├─ capacity available
 │    └─ Registration.Accepted
 │         ├─ (if payment required) Payment.Pending
 │         │    ├─ webhook / settlement Paid → Registration.AcceptedPaid  [runtime: Accepted→AcceptedPaid; Payment Pending→Paid]
 │         │    ├─ webhook / settlement Failed → Registration.Rejected     [runtime: Accepted→Rejected; Payment Pending→Failed]
 │         │    └─ Admin / manual overrides → Section D / TODO detail
 │         ├─ Registration.Accepted → Cancelled          [runtime: manual]
 │         └─ Registration.AcceptedPaid → Refunded | Cancelled | Rejected   [runtime]
 │
 └─ capacity full / waitlist path
      └─ WaitlistItem.Waiting
           ├─ Waiting → Converted → (typically) Registration.Accepted   [runtime; then payment branch as above]
           ├─ Waiting → Cancelled                                       [runtime: manual cancellation]
           └─ promotion when capacity released: automatic vs manual → TODO confirm job ordering vs Section C

Capacity (runtime): Accepted and AcceptedPaid consume acceptedCount; decreases on leaving consuming states (see runtime doc).

Tour archived / cancelled mid-flight → TODO: confirm waitlist + registration outcomes (Section C edge cases).

Terminal pointers (non-exhaustive):
 • Payment: Failed, Refunded, Cancelled are terminal in payment rules [runtime]
 • WaitlistItem: Converted and Cancelled terminal in operational flow [runtime]
 • Registration: multiple terminals (Rejected, Cancelled, Refunded, NoShow, …) — TODO: full terminal matrix for FE “done” screens
```

---

## Section J — Screen → API Mapping Matrix (FE Contract)

**Purpose:**  
Single mapping from **screens / UX surfaces** to **`apps/api/openapi.json`** paths so FE can wire clients, mocks, and permissions without guessing.

**Sources of truth:**  
- `apps/api/openapi.json` (path + method + `operationId` only — no invented routes)  
- Semantics already captured in **Sections A–I**  
- **TODO** wherever a wireframe assumes an operation that is **not** listed in OpenAPI.

---

### J1 — Dashboard / Leader Workspace

| Screen | Required API | Method | Purpose | Notes |
|--------|--------------|--------|---------|-------|
| Dashboard (leader workspace) | **TODO:** no `GET /api/v2/…/dashboard/…` or `leader-workspace` path in `apps/api/openapi.json` | — | Aggregate leader summary | **Section A1** — extend API vs narrow UX |
| Dashboard → Tours index | `/api/v2/tours` | GET | List tours (tenant scope) | OpenAPI `ToursController_list` |
| Dashboard → Tour detail / capacity | `/api/v2/tours/{tourId}` | GET | Tour metadata incl. `totalCapacity` / `acceptedCount` | OpenAPI `ToursController_getById` |
| Dashboard → Registrations table | **TODO:** `GET /api/v2/registrations` **not** in OpenAPI (`/api/v2/registrations` exposes **POST** only) | — | Tabular registrations | **Section A1** — list/filter gap |
| Dashboard → Payments | `/api/v2/admin/payments` | GET | Recent payments (admin list) | OpenAPI `PaymentsController_listPayments` — `parameters: []`; **TODO:** confirm runtime filters (registration/tour) if any |

---

### J2 — Public Registration Flow

| Step | Endpoint | Method | Purpose | Notes |
|------|----------|--------|---------|-------|
| Register (capacity-aware) | `/api/v2/tours/{tourId}/register` | POST | Public registration entry | **Section A2** — optional header `idempotency-key` per OpenAPI |
| Authenticated create registration | `/api/v2/registrations` | POST | Create registration (participant or leader) | Requires `idempotency-key` header per OpenAPI |
| Payment intent | `/api/v2/payments/intent` | POST | Create payment intent | **Section B** — requires `Idempotency-Key` header per OpenAPI |
| Registration state poll (primary) | `/api/v2/registrations/{registrationId}` | GET | `Accepted` ↔ `AcceptedPaid`; `payment` snapshot when present | **Section B4** — canonical async UX |
| Payment record by id (admin) | `/api/v2/admin/payments/{id}` | GET | Payment entity by id | OpenAPI `PaymentsController_getPayment` — admin **security** in spec; **TODO:** participant apps must not rely on this unless product confirms role |

**TODO:** There is **no** `GET /api/v2/payments/{id}` (non-admin) in `apps/api/openapi.json` — poll **`GET /api/v2/registrations/{registrationId}`** unless BE adds a participant-safe payment GET.

---

### J3 — Payment Result Surfaces

| Screen | Endpoint | Method | Purpose | Notes |
|--------|----------|--------|---------|-------|
| Payment Pending / async | `/api/v2/registrations/{registrationId}` | GET | Poll registration + embedded payment | Align with **Section B** / **B4** |
| Payment Success | `/api/v2/registrations/{registrationId}` | GET | Confirm `AcceptedPaid` | |
| Payment Failed | `/api/v2/registrations/{registrationId}` | GET | Confirm `Rejected` / failed payment path per runtime | |
| Admin payment diagnostic | `/api/v2/admin/payments/{id}` | GET | Confirm `Failed` / `Cancelled` / etc. on `Payment.status` | Admin-only in OpenAPI |
| Provider webhook (backend) | `/internal/payments/webhook` | POST | Ingest provider events | **Not** a browser FE route — internal |

**TODO:** Clarify whether `Pending` → `Cancelled` on **`Payment`** surfaces only via admin reads or always mirrored on **`GET /api/v2/registrations/{registrationId}`** ( **Section H** / runtime).

---

### J4 — Waitlist Flows

| Surface | Endpoint | Method | Purpose | Notes |
|---------|----------|--------|---------|-------|
| Join waitlist (public, explicit) | `/api/v2/tours/{tourId}/waitlist` | POST | Create waitlist placement | Response shape includes `waitlistItemId`, `queuePosition` per OpenAPI schema |
| Create waitlist item (authenticated) | `/api/v2/waitlist-items` | POST | Create `WaitlistItem` | Requires bearer + `idempotency-key` per OpenAPI |
| Convert waitlist item | `/api/v2/waitlist-items/{waitlistItemId}/convert` | POST | Leader conversion / promotion | OpenAPI `RegistrationsController_convertWaitlistItem` |
| Cancel waitlist item | `/api/v2/waitlist-items/{waitlistItemId}/cancel` | POST | Cancel waitlist entry | OpenAPI `RegistrationsController_cancelWaitlistItem` |
| View waitlist item by id | **TODO:** no `GET /api/v2/waitlist-items/{waitlistItemId}` in `apps/api/openapi.json` | — | Poll `Waiting` / `Converted` | **Section C2** — discovery gap; **TODO:** derive state via leader tools or future GET |
| Post-promotion registration | `/api/v2/registrations/{registrationId}` | GET | Poll **`Accepted`** and payment | After **`Converted`**, follow **Section C** / **B** — **TODO:** confirm FE never needs a second `POST /api/v2/tours/{tourId}/register` vs convert-only path |

---

### J5 — Admin / Leader Overrides (from Section D)

| Action | Endpoint | Method | Purpose | Notes |
|--------|----------|--------|---------|-------|
| Manual registration status | `/api/v2/registrations/{registrationId}/status` | PATCH | `targetStatus` per `UpdateRegistrationStatusDto` | OpenAPI `RegistrationsController_updateRegistrationStatus` |
| Manual payment fields on registration | `/api/v2/registrations/{registrationId}/payment` | PATCH | `paymentStatus` / `paidAmount` per `UpdateRegistrationPaymentDto` | OpenAPI — **not** a separate `…/mark-paid` route in OpenAPI |
| Admin refund | `/api/v2/admin/payments/{id}/refund` | POST | Refund + reconcile registration | OpenAPI `PaymentsController_refundPayment` — body `RefundPaymentDto`; `Idempotency-Key` required |
| Tour / capacity update | `/api/v2/tours/{tourId}` | PATCH | Update tour fields (`UpdateTourDto`) | OpenAPI `ToursController_update` — **TODO:** which fields map to capacity (**Section D2**) |

**TODO:** No `POST /api/v2/…/mark-paid` in OpenAPI — use **`PATCH …/payment`** or payment/webhook flows per product.

---

### J6 — Exports / Reports

| Screen | Endpoint | Method | Purpose | Notes |
|--------|----------|--------|---------|-------|
| Export registrations CSV | **TODO:** `/api/v2/reconciliation/export.csv` **not** in `apps/api/openapi.json` | — | — | **Section A1** |
| Export waitlist CSV | **TODO:** `/api/v2/reconciliation/export-waitlist.csv` **not** in `apps/api/openapi.json` | — | — | **Section A1** |

---

### J7 — FE TODO: Missing APIs Needed for UX

Cross-check **Sections A–I** and `apps/api/openapi.json`. Each item should either map to an existing operation after verification or become a **product/BE ticket**.

- **TODO:** Aggregated **leader dashboard** — no documented dashboard workspace GET; see **J1** / **Section A1**.
- **TODO:** **List registrations** (by `tourId`, status, date) — no `GET /api/v2/registrations` in OpenAPI; only single **`GET /api/v2/registrations/{registrationId}`**.
- **TODO:** **Single tour** for first-screen marketing — **`GET /api/v2/tours/{tourId}`** exists (authenticated per OpenAPI `security`); **TODO:** confirm public anonymous tour marketing endpoint if needed.
- **TODO:** **Participant payment polling** without admin role — prefer registration GET; confirm embedded `payment` always sufficient (**Section B**).
- **TODO:** **Waitlist item GET** for participant status screen — path absent in OpenAPI (**J4**).
- **TODO:** **Cancel registration** as a dedicated mutation — verify whether **`PATCH /api/v2/registrations/{registrationId}/status`** with `Cancelled` is the only contract or a dedicated route is required.
- **TODO:** **Query params** on **`GET /api/v2/admin/payments`** — OpenAPI lists none; confirm server behavior for filtering.
- **TODO:** **Session** surfaces — `POST /api/v2/auth/web/session`, `POST /api/v2/auth/telegram/session`, `POST /api/v2/auth/link-telegram` per OpenAPI (**Section G**).

---

## Appendix — Test harness note (non-blocking for UX epic)

- **E2E failures:** Infrastructure exists (`docker-compose.e2e`, pnpm scripts, CI); tests still fail due to **runtime/DI/tsx** issues. Track under engineering QA backlog—not as a substitute for completing sections **A–J**.

---

## Revision history

| Date | Change |
|------|--------|
| TODO: add date | Initial creation of `frontend_readiness_tasks.md` — fill date on merge. |
