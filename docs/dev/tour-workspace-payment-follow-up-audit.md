# Tour Workspace Payment Follow-up Audit

Date: 2026-08-13

## Goal

Redesign the tour workspace payment detail card so it is:

- clear for operators
- aligned with common travel/tour payment workflows
- additive to the existing finance and workspace infrastructure
- safe for workspace boundaries and future workspace-specific extension

This audit is the Phase 0 implementation guardrail for the upcoming work.

## Current Boundaries

### Web feature ownership

Tour workspace payment UI is currently feature-owned in:

- `apps/web/src/features/tours/tour-workspace-finance-client.tsx`
- `apps/web/src/features/tours/tour-workspace-finance-logic.ts`
- `apps/web/src/features/tours/use-tour-workspace-finance-data.ts`

App routes re-export and host these feature modules rather than owning the business logic:

- `apps/web/app/(app)/tours/[id]/workspace/...`

This is the correct direction and should be preserved.

### Finance domain ownership

Financial write/read logic lives in finance-core and finance-http:

- `packages/finance-core/src/application/finance.service.ts`
- `packages/finance-http/src/finance.routes.ts`
- `packages/finance-http-contracts/src/workspace-finance-ports.ts`

The workspace web layer should not reimplement payment rules, settlement rules, or receipt approval rules.

### Workspace-specific extension points

Workspace-specific pricing and collection behavior already exist behind ports/adapters:

- `apps/api/src/workspace-finance/infrastructure/registration-finance-obligation.adapter.ts`
- `apps/api/src/workspace-finance/finance-obligation.factory.ts`
- `packages/workspaces/denali/src/finance/resolve-denali-registration-obligation.ts`

This is the correct place for workspace-specific commercial rules.

## Phase 2 Boundary Notes

### Safe to implement entirely in `apps/web`

The following improvements are presentation/orchestration only and should stay inside:

- `apps/web/src/features/tours/tour-workspace-finance-client.tsx`
- small tour-workspace-specific helper components under `apps/web/src/features/tours/*`
- locale copy in `apps/web/messages/*/tours.json`

These include:

- clearer section layout in the left detail card
- operator action grouping and gating
- richer receipt evidence presentation using already-exposed receipt fields
- reusing existing finance web components such as receipt proof preview

### Do not reimplement in the workspace web layer

The workspace UI must not invent or recompute:

- settlement truth
- remaining due math
- overdue policy
- receipt review outcomes
- override persistence semantics

Those stay finance-owned and come from existing APIs / parsers.

### Confirmed contract gap

Current `FinancePendingReceipt` data is sufficient for:

- receipt id
- file key / proof preview
- payment amount
- linked payment status
- created date
- note

Current `FinancePendingReceipt` data is not sufficient for:

- reliable uploader provenance such as `member` vs `operator`

So:

- the workspace detail card can safely show richer receipt evidence immediately
- if product later requires an explicit `uploaded by member/operator` label, that should be an additive finance read-contract field rather than UI inference

## What Already Exists

### 1. Outstanding-balance follow-up list

The tour workspace payment tab already has a tour-scoped follow-up list built from outstanding balances:

- `packages/finance-core/src/application/finance-outstanding-operator.ts`
- `apps/web/src/features/tours/tour-workspace-finance-logic.ts`

This gives us:

- current unpaid registrations
- current partial-payment registrations
- tour-scoped filtering

### 2. Receipt upload and receipt review infrastructure

The system already supports:

- member receipt upload from portal
- operator receipt upload
- pending receipt queue
- receipt review and approval

Relevant modules:

- `apps/portal/app/me/registrations/[id]/member-receipt-upload-form.tsx`
- `apps/api/src/workspace-finance/receipt-proof-storage.ts`
- `apps/api/src/workspace-finance/finance-receipt-upload.ts`
- `packages/finance-core/src/application/finance.service.ts`

This means we do not need a new receipt subsystem. We need better presentation and linkage in the workspace detail card.

### 3. Manual payment intent

The system already supports creating a manual pending payment:

- `packages/finance-core/src/application/finance.service.ts` via `createManualPayment`
- `apps/web/src/finance/finance-registration-payment-actions.tsx`

Important behavior:

- it creates a `Pending` manual payment
- it does not settle the debt by itself
- it is guarded against parallel pending intents
- suggested amount comes from invoice `balanceDueMinor`

This is not a discount or write-off mechanism.

### 4. Obligation override

The system already has a commercial override mechanism for "what this registration owes":

- `packages/finance-core/src/application/finance.service.ts` via `setRegistrationObligationOverride`
- `apps/api/src/workspace-finance/infrastructure/registration-finance-obligation.adapter.ts`
- `packages/finance-core/src/domain/obligation-override.ts`
- `packages/finance-http/src/finance.routes.ts`

Important behavior:

- override persistence is additive
- override stays in a finance-owned commercial port
- free collection can be applied after override write

This is the strongest existing candidate for the requested "current expected amount" and "no payment required" flows.

### 5. Payment schedule / installment infrastructure

The system already supports payment schedule generation and patching:

- `packages/finance-core/src/application/finance.service.ts`
- `packages/finance-core/src/domain/schedule.ts`
- `apps/web/src/finance/finance-installments-logic.ts`
- `apps/web/src/finance/finance-installments-panel.tsx`

Supported concepts:

- scheduled installments
- partial installment payment
- overdue installments
- waived installments
- rescheduled installments

This likely gives us a reusable model for "current required payment" without inventing a parallel ad hoc workflow.

## UX Problems Confirmed

### 1. The detail card mixes intent, evidence, and summary

The current operator detail surface mixes:

- invoice summary
- operator action
- receipt submission support
- case navigation

But it does not answer these core operator questions in a clean order:

1. What is this guest's current financial state?
2. What amount do we expect right now?
3. What can the operator do?
4. What has the guest already submitted?

### 2. "Confirmed" and "settled" are not clearly separated

For the target workflow, these must stay separate:

- tour approval / booking approval
- paid to date
- remaining due
- no-payment-required decision

### 3. Manual pending payment is too ambiguous as a UI concept

The domain behavior is valid, but the operator-facing meaning is unclear.

Without structure, operators can misread it as:

- a confirmed payment
- a discount
- a debt write-off
- a generic "mark as handled" action

### 4. Portal-uploaded receipts are not visible enough in the workspace detail surface

The receipt system exists, but the operator's tour-scoped detail card does not present receipt evidence as a first-class, readable section.

## Standard States Needed

Based on common tour/travel flows and the existing system shape, the detail card should support these operator-visible states:

- `approved + balance_due`
- `approved + payment_under_review`
- `approved + paid_in_full`
- `approved + no_payment_required`
- `approved + overdue`

Optional later states:

- `approved + credit_balance`
- `cancelled_for_non_payment`

These should be UI states derived from finance-core truth, not a second conflicting state machine in the web app.

## Phase 1 State Matrix

This matrix is the implementation contract for the workspace payment follow-up surface.

### List inclusion rules

- Show in the workspace follow-up list only when the registration is approved and still needs operator payment follow-up.
- Keep `approved + unpaid`, `approved + partial`, and `approved + overdue` in the list.
- Keep `approved + payment_under_review` visible only while the guest still has an unresolved balance and a receipt is waiting for review.
- Remove `approved + paid_in_full` from the list.
- Remove `approved + no_payment_required` from the list.
- Remove `approved + credit_balance` from the list.

### Detail state precedence

When multiple signals exist at once, the workspace detail state should resolve in this order:

1. `no_payment_required`
2. `credit_balance`
3. `paid_in_full`
4. `payment_under_review`
5. `overdue`
6. `needs_payment`

Important rule:

- Pending receipt review must outrank overdue follow-up, because once the guest has submitted proof the next operator job is review, not a second collection action.

### Per-state UI contract

#### `approved + needs_payment`

- Keep in follow-up list
- Show current expected amount
- Show operator collection actions
- Show guest receipts/evidence section

#### `approved + overdue`

- Keep in follow-up list
- Show overdue wording in summary and current requirement
- Keep operator collection actions enabled
- Show receipts/evidence section

#### `approved + payment_under_review`

- Keep in follow-up list if balance is still unresolved
- Highlight receipt review as the next action
- Hide conflicting operator collection actions from the detail card
- Show uploaded receipts prominently with amount and date

#### `approved + paid_in_full`

- Remove from follow-up list
- Detail card becomes read-only when opened through direct link/history
- Link operators to payment history rather than collection actions

#### `approved + no_payment_required`

- Remove from follow-up list
- Detail card becomes read-only when opened through direct link/history
- Show that the current required amount is zero by operator decision/commercial rule

#### `approved + credit_balance`

- Remove from follow-up list
- Detail card becomes read-only
- Surface that the guest has paid more than the current obligation

## Recommended Left Detail Card Structure

The left detail card should be sectioned in this order:

### Section A. Summary

Keep the current high-signal top area, but clarify labels:

- guest name
- booking status
- payment status
- total price
- paid to date
- balance due

### Section B. Current Payment Requirement

New or upgraded section backed by obligation/schedule data:

- current expected amount
- collection mode / explanation
- due date if applicable
- note if no payment is currently required

This section answers: "What do we expect from this guest right now?"

### Section C. Operator Actions

Operator-only actions, clearly separated from guest evidence:

- record operator payment
- create pending manual payment
- change current expected amount
- mark as no payment required
- restore back to needs payment

These actions should map to existing finance ports where possible:

- manual payment create
- obligation override
- schedule patch/generate

### Section D. Guest Uploads and Payment Evidence

Read-only evidence section:

- uploaded receipts
- amount
- uploaded date
- review status
- source: member / operator
- open proof link

This section answers: "What has already been submitted?"

### Section E. Financial Activity History

Small, additive history section:

- last operator actions
- last receipt review result
- obligation changes

This can initially be a narrow activity feed if a broader audit timeline is not already exposed.

## Reuse Strategy

To avoid infrastructure debt, implement by reuse first:

### Reuse as-is

- tour-scoped outstanding follow-up list
- registration invoice lookup
- manual pending payment create
- receipt upload and receipt review backend
- obligation override port
- schedule domain and schedule UI logic

### Adapt, do not duplicate

- schedule concepts for current expected payment
- receipt queue data for detail-card evidence
- finance payment actions for workspace operator actions

### Avoid

- new workspace-specific payment rule engine in web
- direct workspace imports into finance-core
- duplicating receipt state logic in the tour feature
- introducing a second "expected amount" source of truth

## Gaps To Fill

These are the likely implementation gaps:

### Gap 1. Tour workspace detail card does not read obligation/schedule explicitly

We need a clean tour-scoped detail read model for:

- current required amount
- no-payment-required state
- due date / schedule context

### Gap 2. No first-class operator-facing "no payment required" action in the workspace card

The domain can support zero-obligation behavior through override/free collection, but the workspace detail card does not currently expose it clearly.

### Gap 3. Portal-uploaded receipt evidence is not surfaced in the detail card

We need a compact tour-scoped evidence section rather than forcing operators to infer receipt activity from status banners or leave the tab.

### Gap 4. Operator actions are not framed as distinct business intents

The current UI needs explicit separation between:

- record payment
- ask for payment
- change current expected amount
- waive/no payment required

## Implementation Safety Rules

The next phases must preserve these constraints:

1. `packages/finance-core` must remain workspace-agnostic.
2. Workspace-specific commerce rules stay behind generated bindings and adapters.
3. `apps/web/src/features/tours/*` owns the tour workspace detail composition.
4. App route files remain thin hosts / re-exports.
5. Tour workspace must stay tour-scoped and must not leak global finance rows.

## Proposed Build Order

### Phase 1

Define a concrete read-model contract for the left detail card:

- summary
- current payment requirement
- operator actions model
- receipt evidence list
- small activity list

### Phase 2

Expose or compose the minimal missing backend data using existing ports:

- obligation override read/write
- schedule read
- receipt evidence read

### Phase 3

Refactor the workspace detail card into section components under:

- `apps/web/src/features/tours/`

### Phase 4

Add tests:

- unit: state mapping
- unit: section rendering logic
- integration: tour scoping
- targeted E2E: partial paid, no payment required, receipt uploaded, admin-recorded payment

## Recommendation

The best low-debt path is:

- keep the current tour-scoped list
- redesign only the detail card first
- reuse obligation override and schedule infrastructure for "current required amount"
- surface receipt evidence without moving receipt review fully into the workspace card

This keeps the redesign additive and aligned with the existing workspace and finance infrastructure.

## Local Payment Follow-up UX Closure (2026-08-26)

### Operator outcomes (no new finance states)

| Outcome | API path | UI surface |
| ------- | -------- | ---------- |
| A. Reject registration | `POST /api/bookings/:id/reject` | Bookings inspection — «رد ثبت‌نام» |
| B. Approve + payment required | `POST /api/bookings/:id/approve` | Bookings — «تأیید و منتظر پرداخت»; finance tab follow-up |
| C. Approve + no payment required | approve → `PUT obligation-override` `obligationMinor: "0"` | Bookings — «تأیید بدون نیاز به پرداخت»; finance advanced override (unchanged) |

Case C does **not** record cash; obligation zero is finance SoT for waived payable.

### Clutter reduction

- Finance guest list: compact `TourWorkspacePaymentFollowUpRow` (avatar, name, follow-up badge, payment badge, amount).
- Detail panel: summary grid + one-line recommendation on surface; requirement block + evidence behind `<details>`; advanced tools remain in existing advanced toggle.

### State sync

After obligation override or approve-without-payment:

1. `invalidateFinanceRegistrationCaches(registrationId)`
2. `invalidateTourWorkspaceFinanceCache(tourId)` when tour scope known
3. Parent `refreshWorkspaceFinanceView()` / bookings `refreshData()`

Root cause of slow refresh: override path omitted finance + tour cache invalidation before this batch.

### Tests added

- `apps/web/test/booking-approve-actions-logic.spec.ts`
- `apps/web/test/tour-workspace-payment-follow-up-row.spec.ts`
- `apps/web/test/tour-workspace-payment-follow-up-cache.spec.ts`
- extended `tour-workspace-payment-follow-up-state.spec.ts` (zero-balance settled)

### Invariants

- Primary labels avoid internal finance jargon and do not imply cash received on waiver.
- No optimistic financial success before server confirms.
- Finance domain unchanged; workspace web owns composition only.

### 2026-08-26 final pass

- Guest list now uses **operational roster + pending bookings** (`useTourWorkspacePaymentFollowUpList`) — `paymentDueAt` from DP-2 projection (no duplicate Finance SoT).
- Row: avatar, name, registration + payment badges, amount, deadline, inline primary/secondary actions.
- Detail flicker fix: keep prior invoice/payments/schedule while refetching.
- **Local runtime:** port **3000** may be unrelated; run app-tour web with `cd apps/web && pnpm exec next dev --port 3010` (API on **3001**).
