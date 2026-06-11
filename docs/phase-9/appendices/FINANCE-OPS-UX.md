# Phase 9.7 — Finance Command Center (Operator UX + ledger architecture)

```yaml
ux_spec_id: FINANCE-OPS-UX
version: "2026-06-08-v1"
status: LOCKED
decisions: [DEC-P9-002, DEC-P9-008, DEC-P9-013, DEC-P9-016, DEC-P9-017]
subphase: "9.7"
scope: "Denali finance operator surfaces — payments, prepayment, installments, ledger, reconciliation"
authority: subphases/9.7-finance-denali.md · finance-api-dispatch-addendum.md · phase-6/subphases/6.4-finance-slice.md
pattern: BOOKINGS-OPS-UX.md · USERS-DIRECTORY-UX.md · ADMIN-SHELL-UX.md
legacy_reference:
  - legacy/apps/web/app/(app)/finance/
  - legacy/apps/web/app/(app)/settings/reconciliation-triage/
  - legacy/apps/web/app/(app)/dashboard/finance-workspace-summary-card.tsx
  - legacy/apps/api/src/modules/finance/
  - legacy/apps/api/src/modules/payments/
  - legacy/packages/shared-contracts/src/finance/finance.schemas.ts
  - legacy/apps/api/docs/AUTHORITATIVE-FINANCIAL-CUTOVER.md
trunk_baseline:
  - packages/workspaces/denali/src/finance/
  - packages/workspaces/denali/src/finance/finance-ops-manifest.ts
  - apps/api/src/denali-finance/
  - apps/web/app/finance/
  - apps/web/src/finance/finance-nav-access.ts
  - infra/sql/008_finance_payments_delta.sql
  - docs/phase-6/subphases/6.4-finance-slice.md
forbidden:
  - apps/api/src/modules/finance/** # P9-F-008
  - packages/workspaces/urban/** finance hooks # INV-P9-006
```

> **Problem:** Finance must become one of the **most capable** operator surfaces — prepayment, manual/online payments, installment schedules, receipt review, ledger audit, reconciliation triage — not a two-panel MVP. Legacy already runs pricing, booking wallet, double-entry ledger outbox, and reconciliation; trunk has **Phase 6 outbox slice + R1 partial** (API + placeholder UI). Phase 9.7 documents **progressive delivery** with **mobile-first** UX and architectural headroom so installments land without rewriting the payment spine.

---

## 1. Product north star

| Principle                  | Implementation                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Command center**         | Tabbed finance hub — **R1 interim:** `app/finance` (DEC-P9-017) · **target:** `(app)/finance` when 9.2 shell lands |
| **Money spine integrity**  | All journals via `finance.ledger.double_entry_applied` outbox (Phase 5/6) — no shadow ledger                       |
| **Prepayment first-class** | Booking wallet credits (`registration_prepayment_*`) visible in UI and registration detail                         |
| **Installments planned**   | Schedule contract + API stubs in 9.7-R2; full UX in 9.7-R3 — schema locked now                                     |
| **Manifest-driven panels** | `FinanceOpsManifest` in Denali plugin — workspace toggles panels without core edits                                |
| **Minor units only**       | Amounts as integer minor strings end-to-end (IRR rials / USD cents)                                                |
| **Denali-only**            | Urban tenants: nav hidden · routes 404 (INV-P9-006)                                                                |
| **Admin/owner + module**   | `enabled_modules` includes `finance` + `isAdminOrOwner` (DEC-P9-015)                                               |
| **Mobile-first**           | KPI strip + card queues on `<768px`; tables progressive enhancement (DEC-P9-013)                                   |

---

## 2. Gap analysis (audit 2026-06-08)

### 2.1 Documentation (resolved S9.7-R0)

| Artifact                           | Status                            |
| ---------------------------------- | --------------------------------- |
| `9.7-finance-denali.md`            | **expanded** — rounds · CP matrix |
| `FINANCE-OPS-UX.md`                | **LOCKED** — master spec          |
| `finance-api-dispatch-addendum.md` | **v2** — full route catalog       |
| `TRACEABILITY-MATRIX-9.7.md`       | **LOCKED**                        |
| `FINANCE-RISK-REGISTER-P9.md`      | **LOCKED**                        |
| `DEC-P9-016`                       | progressive finance architecture  |
| JSON schemas                       | summary · payment-schedule item   |

### 2.2 Runtime (trunk) — `PARTIAL_R1` (sync 2026-06-08)

| Layer                                  | R1 trunk                                                                                           | Gap                                                |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Finance hub (interim)                  | ✅ placeholder [`apps/web/app/finance/`](../../../../apps/web/app/finance/) · nav gate · tab shell | Live API wiring · migrate to `(app)/finance` (9.2) |
| Finance reports API                    | ✅ [`apps/api/src/denali-finance/`](../../../../apps/api/src/denali-finance/)                      | Redis summary cache                                |
| Manual payment + receipts              | ✅ + [`finance-ops.spec.ts`](../../../../apps/api/test/finance-ops.spec.ts)                        | MinIO file upload (R1 uses `fileKey` body)         |
| `(app)/settings/reconciliation-triage` | ✅ R1 findings board (summary + schedules)                                                         | Ledger adjust + legacy findings adapter (R4)       |
| Booking wallet / prepayment UI         | ❌                                                                                                 | registration financial panel (R2)                  |
| Installment schedules                  | ❌                                                                                                 | contract only — R2–R3                              |
| Phase 6 outbox consumer                | ✅                                                                                                 | TourCreated → ledger hook                          |
| Dashboard finance widget               | ✅ [`finance-dashboard-widget.tsx`](../../../../apps/web/src/finance/finance-dashboard-widget.tsx) | —                                                  |
| `finance.schemas.ts` (legacy)          | reference                                                                                          | Port to trunk contracts when wiring                |

### 2.3 Legacy parity inventory

| Feature                   | Legacy                                     | 9.7 target                                        |
| ------------------------- | ------------------------------------------ | ------------------------------------------------- |
| Finance page              | receipt review + upload panels             | **Command center** superset                       |
| Dashboard widget          | summary KPIs + ledger count                | same + link to hub                                |
| GET reports/summary       | pending manual · receipts · paid/failed    | same                                              |
| GET reports/open-payments | manual pending list                        | same + filters                                    |
| GET reports/ledger-events | outbox-derived lines                       | same + registration link                          |
| POST manual payment       | operator creates debt row                  | same + booking context                            |
| POST receipt upload       | member/operator proof                      | same                                              |
| PATCH receipt review      | approve/reject → ledger                    | same                                              |
| Reconciliation triage     | settings explorer                          | same + finance hub link                           |
| Invoice read model        | paid vs balance due                        | expose on registration + installments             |
| Pricing engine            | registration quote                         | **read-only** in finance — mutate in booking flow |
| Prepayment ledger events  | `registration_prepayment_received/cleared` | surface in ledger tab                             |

---

## 3. Domain architecture

### 3.1 Payment spine (authoritative)

```text
Registration quote (pricing engine)
        │
        ▼
BookingPriceSnapshot (immutable at booking time)
        │
        ├──► InvoiceReadModel ──► invoiceTotalMinor · paidAmountMinor · balanceDueMinor
        │
        ├──► PaymentIntent[] (Online | Manual) ──► PSP or manual debt
        │         │
        │         └──► PaymentReceipt[] (Manual proof) ──► review ──► Paid
        │
        ├──► BookingWallet (ledger projection: booking:{registrationId})
        │         │
        │         └──► prepayment credits / clears (leader/operator PATCH)
        │
        └──► PaymentSchedule (9.7-R2+) ──► InstallmentItem[] due dates + amounts
                    │
                    └──► each installment links to PaymentIntent or wallet credit

All money mutations ──► BookingLedgerAuthority / PaymentCaptureAuthority
        │
        └──► finance.ledger.double_entry_applied (Phase 5 outbox)
```

**Forbidden:** duplicate ledger tables · in-memory shadow balances · Nest `modules/finance` tree on trunk.

### 3.2 Prepayment semantics

| Concept             | Definition                                                                               |
| ------------------- | ---------------------------------------------------------------------------------------- |
| **Prepayment**      | Credit to `booking:{registrationId}` wallet before invoice fully settled                 |
| **Ledger kind**     | `registration_prepayment_received` · `registration_prepayment_cleared`                   |
| **UI visibility**   | Registration financial strip + finance hub «Prepayments» queue                           |
| **Operator action** | Record prepayment (amount minor + method + note) → ledger outbox                         |
| **Balance math**    | `paidAmountMinor = min(walletNet, invoiceTotalMinor)` · `balanceDueMinor = total − paid` |

Port: `compile-invoice-balances.ts` · `booking-ledger-authority.service.ts` (legacy reference).

### 3.3 Installment schedule (forward design — DEC-P9-016)

Legacy has **no** first-class installment UI; product requires it in Phase 9 stretch goals.

```typescript
/** Locked contract — implement storage in 9.7-R2, UX in 9.7-R3 */
export type InstallmentItemStatus =
  | "scheduled" // future due date
  | "due" // due date reached · unpaid
  | "partial" // wallet credit < installment amount
  | "paid" // settled
  | "overdue" // past grace period
  | "waived"; // operator waiver + audit

export type PaymentScheduleItem = {
  id: string;
  registrationId: string;
  sequence: number; // 1..n (0 = deposit/prepayment slot optional)
  label: string; // e.g. "پیش‌پرداخت" · "قسط ۲"
  dueAt: string; // ISO date
  amountMinor: string;
  paidMinor: string;
  status: InstallmentItemStatus;
  linkedPaymentId?: string;
  graceDays?: number;
};
```

**Schedule sources (manifest):**

| Source                     | Use                                                         |
| -------------------------- | ----------------------------------------------------------- |
| Tour `paymentPlanTemplate` | Default deposit % + N installments (settings 9.6 extension) |
| Operator override          | Custom schedule on manual booking create (9.5)              |
| Auto-deposit               | First row = prepayment due at registration approve          |

**Rules:**

- Sum(installments) + discounts = `invoiceTotalMinor` (tolerance 0 — integer minor).
- Prepayment row may be paid before approval completes.
- Overdue triggers dashboard badge + optional notification hook (outbox — not email in 9.7 MVP).

Schema: [`schemas/PAYMENT-SCHEDULE-ITEM.schema.json`](schemas/PAYMENT-SCHEDULE-ITEM.schema.json).

---

## 4. Progressive delivery (9.7 rounds)

| Round       | Scope                                                                                                        | 9.8 gate required?                   |
| ----------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| **S9.7-R0** | Doc pack · DEC-P9-016 · traceability                                                                         | yes (doc)                            |
| **S9.7-R1** | Legacy parity: finance page · reports API · manual pay · receipts · dashboard widget · reconciliation triage | **yes**                              |
| **S9.7-R2** | Prepayment recording API · booking wallet panel · `PaymentSchedule` persistence · schedule generator | **in progress** — trunk API + web tabs |
| **S9.7-R3** | Installments tab · overdue queue · bulk remind · tour payment plan template (settings)                       | stretch                              |
| **S9.7-R4** | Ledger explorer · export CSV · advanced reconciliation KPIs                                                  | stretch                              |

**Maneuver rule:** R1 must not block on installment tables — schedule tables migrate independently (`008_finance_schedule_delta.sql`).

---

## 5. Finance Command Center — information architecture

> **Route (DEC-P9-017):** Trunk R1 ships at `/finance` (`apps/web/app/finance/`). Target after 9.2 admin shell: `(app)/finance` — same tab model, new route group.

```text
/finance  (interim — apps/web/app/finance/)
  ?tab=overview      ← default · KPI + alerts
  ?tab=payments      ← open + historical payments
  ?tab=receipts      ← review queue (admin)
  ?tab=prepayments   ← booking wallet credits (R2)
  ?tab=installments  ← schedule board (R3)
  ?tab=ledger        ← outbox journal browser

(app)/finance        ← target path when 9.2 (app)/ layout lands

(app)/settings/reconciliation-triage   ← linked from overview · manage Reconciliation

(app)/bookings/[id]                    ← financial strip embed (9.5 integration)
```

### 5.1 Tab: Overview

| Zone          | Content                                                                         |
| ------------- | ------------------------------------------------------------------------------- |
| KPI strip     | pending manual · pending receipts · overdue installments (R3) · balance at risk |
| Alert cards   | deep-link to receipts / overdue / reconciliation open findings                  |
| Recent ledger | last 5 `finance.ledger.*` events                                                |
| Quick actions | create manual payment · open triage                                             |

### 5.2 Tab: Payments

| Feature | Detail                                                                                     |
| ------- | ------------------------------------------------------------------------------------------ |
| Filters | status · method · date range · registrationId                                              |
| Row     | amount · currency · method badge · status · registration link                              |
| Actions | view detail · upload receipt (manual pending) · refund stub (read-only until gateway port) |

### 5.3 Tab: Receipts (review queue)

Port `AdminReceiptReviewPanel` — approve/reject with note · image preview · ledger confirmation toast.

### 5.4 Tab: Prepayments (R2)

| Feature         | Detail                                                           |
| --------------- | ---------------------------------------------------------------- |
| List            | registrations with wallet credit > 0 or recent prepayment events |
| Record form     | registration picker · amount · method · note → POST prepayment   |
| Balance display | paid / total / due from InvoiceReadModel                         |

### 5.5 Tab: Installments (R3)

| Feature | Detail                                                                |
| ------- | --------------------------------------------------------------------- |
| Board   | columns: overdue · due this week · upcoming · paid                    |
| Row     | participant · tour · installment label · due date · amount · paid bar |
| Actions | record payment · waive (audit) · reschedule (owner/admin)             |
| Mobile  | swipe cards per status column                                         |

### 5.6 Tab: Ledger

Read-only outbox-derived journal lines — registration filter · **export CSV (R4)**.

| Feature | Detail |
| ------- | ------ |
| List | `GET /api/finance/reports/ledger-events` BFF → `FinanceLedgerPanel` |
| Export CSV | Client download of currently loaded rows (no server export route) — columns: `outboxEventId`, `eventType`, `journalId`, `registrationId`, `domainEventId`, `lineCount`, `createdAt` |
| Logic | `buildFinanceLedgerCsvContent` · `buildFinanceLedgerCsvFilename` in `finance-reports-logic.ts` |
| Landmark | `data-testid=finance-ledger-export-csv` on Ledger tab toolbar |
| Proof | `finance-reports-logic.spec.ts` **WEB-9.7-R4-01..02** |

### 5.7 Reconciliation triage (`/settings/reconciliation-triage`)

R1 ships a **findings board** composed from existing finance read APIs — no dedicated reconciliation DB table yet.

| Source API | Finding category |
| ---------- | ---------------- |
| `GET /finance/reports/summary` | pending manual payments · pending receipt reviews · failed payments |
| `GET /finance/schedules` | overdue installment rows (board classifier) |
| `GET /finance/reports/ledger-events` | **R4 KPI** — ledger journal gap when `paidPayments > 0` and zero journal rows loaded |

| Artifact | Path |
| -------- | ---- |
| Finding builder | `apps/web/src/finance/reconciliation-triage-logic.ts` |
| Triage UI | `apps/web/app/(app)/settings/reconciliation-triage/reconciliation-triage-client.tsx` |
| Proof | `apps/web/test/reconciliation-triage.spec.ts` WEB-9.7-TRI-01..03 · E2E **SMK-P9-11** |

**R4 stretch (read-only):** `ledger-journal-gap` surfaces outbox/ledger drift without a server-side adjust route. Manual ledger adjust + `reconciliation.ledger.adjustment_applied` outbox remains deferred (R-P9-F05).

Admin/owner only (`isAdminOrOwnerRole`). Each finding deep-links to the matching Finance tab. Empty state when all counts are zero.

---

## 6. API catalog (summary)

Full dispatch: [`finance-api-dispatch-addendum.md`](finance-api-dispatch-addendum.md) v2.

| Domain         | Key routes                                                          |
| -------------- | ------------------------------------------------------------------- |
| Reports        | `GET /finance/reports/summary` · `open-payments` · `ledger-events`  |
| Payments       | `POST /finance/payments/manual` · `GET /finance/payments`           |
| Receipts       | `POST /finance/receipts` · `PATCH /finance/receipts/{id}/review`    |
| Prepayment     | `POST /finance/prepayments` · `GET /finance/prepayments` (R2)       |
| Schedule       | `GET /finance/schedules` · `POST /finance/schedules/generate` (R2)  |
| Installments   | `PATCH /finance/schedules/{id}/items/{itemId}` (R3)                 |
| Reconciliation | workspace reconciliation-findings (existing legacy paths → adapter) |
| Invoice        | `GET /finance/invoices/{registrationId}` — derived read model       |

All routes: **denali workspace gate** · tenant RLS · fail-closed CASL.

---

## 7. `FinanceOpsManifest` (Denali plugin)

```typescript
/** packages/workspaces/denali/src/finance/finance-ops-manifest.ts */
export type FinanceOpsManifest = {
  version: "1";
  panels: {
    overview: boolean;
    payments: boolean;
    receipts: boolean;
    prepayments: boolean; // default true when finance module on
    installments: boolean; // default false until R3 tenant flag
    ledger: boolean;
  };
  installmentDefaults?: {
    enabled: boolean;
    depositPercent?: number; // 0-100
    installmentCount?: number; // 1-24
    graceDays?: number;
  };
  currencies: readonly string[]; // e.g. ["IRR", "USD"]
};
```

Loaded via `WorkspacePlugin.financeOps` — validated at plugin boot (mirror `registrationOps` pattern DEC-P9-011).

---

## 8. RBAC matrix

| Surface                           | Owner | Admin | Member |
| --------------------------------- | :---: | :---: | :----: |
| Finance hub read                  | ✅\*  | ✅\*  |   ❌   |
| Receipt review                    | ✅\*  | ✅\*  |   ❌   |
| Manual payment create             | ✅\*  | ✅\*  |   ❌   |
| Receipt upload (own registration) |  ✅   |  ✅   | ✅\*\* |
| Prepayment record                 | ✅\*  | ✅\*  |   ❌   |
| Installment waive/reschedule      | ✅\*  | ✅\*  |   ❌   |
| Reconciliation triage manage      | ✅\*  | ✅\*  |   ❌   |

\* Requires tenant `finance` module.  
\*\* Member upload only for own registration manual payment (legacy `assertActorMayUploadReceiptForRegistration`).

CASL subjects: `FinanceManualPayment` · `FinanceReceipt` · `FinanceReceiptReview` · `Reconciliation` · `operator.finance.read`.

---

## 9. Web file tree (target + R1 interim)

### 9.1 R1 interim (on trunk — DEC-P9-017)

```text
apps/web/app/(app)/finance/
  page.tsx                         # server gate · session → client
  finance-command-center.tsx       # tab shell (overview · payments · receipts · ledger · R2/R3)

apps/web/src/finance/
  finance-nav-access.ts            # shouldShowFinanceNav · parseFinanceTab
  finance-reports-logic.ts           # R1 — summary · ledger parse · KPI helpers
  finance-payments-logic.ts        # R1 — manual payment list/create validation
  finance-receipts-logic.ts        # R1 — pending receipt queue · review validation
  finance-overview-panel.tsx       # R1 — KPI strip · recent ledger · quick links
  finance-payments-panel.tsx       # R1 — payment list + manual create form
  finance-receipts-panel.tsx        # R1 — review queue approve/reject
  finance-ledger-panel.tsx           # R1 — full ledger event browser
  finance-dashboard-widget.tsx       # R1 — dashboard KPI card → /finance
  proxy-finance-api.server.ts      # shared BFF proxy helper
  finance-prepayments-logic.ts     # R2 — list/record types · validation · formatters
  finance-prepayments-panel.tsx    # R2 — list + record form (BFF /api/finance/prepayments)
  finance-installments-logic.ts    # R3 — board column classifier · schedule types
  finance-installments-panel.tsx   # R3 — column board + generate schedule form

apps/web/app/api/finance/
  reports/summary/route.ts         # GET BFF (R1)
  reports/ledger-events/route.ts   # GET BFF (R1)
  payments/route.ts                # GET BFF (R1)
  payments/manual/route.ts         # POST BFF (R1)
  receipts/pending/route.ts        # GET BFF (R1)
  receipts/route.ts                # POST BFF submit (R1)
  receipts/[id]/review/route.ts    # PATCH BFF (R1)
  invoices/[registrationId]/route.ts # GET BFF (R2)
  prepayments/route.ts             # GET/POST BFF
  schedules/route.ts               # GET BFF (R3)
  schedules/generate/route.ts      # POST BFF (R3)
```

### 9.2 Target (post-9.2 admin shell)

```text
apps/web/app/(app)/finance/
  page.tsx
  finance-command-center.tsx      # tab shell + URL sync
  tabs/
    finance-overview-tab.tsx
    finance-payments-tab.tsx
    finance-receipts-tab.tsx
    finance-prepayments-tab.tsx   # R2
    finance-installments-tab.tsx  # R3
    finance-ledger-tab.tsx
  components/
    finance-kpi-strip.tsx
    manual-payment-form.tsx
    receipt-review-panel.tsx
    receipt-upload-panel.tsx
    installment-board.tsx         # R3
    prepayment-record-form.tsx      # R2
  finance-page.module.css

apps/web/app/(app)/settings/reconciliation-triage/   # port legacy explorer

apps/api/src/denali-finance/
  finance.routes.ts               # R1; may split into reports/ · payments/ · receipts/ in R2+
  prepayments/                    # R2
  schedules/                      # R2-R3
  reconciliation/                 # adapters

packages/workspaces/denali/src/finance/
  finance-ops-manifest.ts
  finance-outbox-consumer.ts      # existing Phase 6
  handlers/
  extract-invoice-projection.ts
```

---

## 10. Integration points

| Subphase         | Integration                                                         |
| ---------------- | ------------------------------------------------------------------- |
| **9.5 Bookings** | Registration detail financial strip · manual booking seeds schedule |
| **9.6 Settings** | `paymentPlanTemplate` resource module (R3)                          |
| **9.2 Shell**    | Nav finance item · dashboard `FinanceWidget`                        |
| **Phase 6**      | Extend outbox consumer — do not fork                                |
| **Phase 5**      | Outbox enqueue for all ledger writes                                |

---

## 11. Completion proof matrix

| ID        | Check                                     | Round | Pass         |
| --------- | ----------------------------------------- | ----- | ------------ |
| CP-9.7-01 | Finance hub loads denali + finance module | R1    | 200          |
| CP-9.7-02 | Urban tenant `/finance`                   | R1    | 404 / hidden |
| CP-9.7-03 | No `apps/api/modules/finance` tree        | R1    | audit        |
| CP-9.7-04 | Phase 6 outbox regression                 | R1    | green        |
| CP-9.7-05 | Reconciliation triage loads               | R1    | web spec     |
| CP-9.7-06 | Reports summary matches legacy counts     | R1    | API spec + overview panel |
| CP-9.7-07 | Manual payment + receipt E2E              | R1    | integration + web panels  |
| CP-9.7-08 | Receipt approve posts ledger outbox       | R1    | integration + receipts panel |
| CP-9.7-09 | Dashboard finance widget KPIs             | R1    | web spec + dashboard widget |
| CP-9.7-10 | Record prepayment updates wallet          | R2    | `finance-prepayments.spec.ts` (Postgres) + web panel · E2E **SMK-P9-12** (shell) |
| CP-9.7-11 | Invoice balance due correct               | R2    | unit + API spec + prepayments lookup |
| CP-9.7-12 | Generate schedule from template           | R2    | API spec + web panel |
| CP-9.7-13 | Installments board overdue column         | R3    | web spec     |
| CP-9.7-14 | Schedule sum equals invoice total         | R3    | unit         |
| CP-9.7-15 | Mobile finance tabs `<768px`              | R1    | web spec     |

---

## 12. Anti-hollow assertions

| ID        | Assertion                              | Detection                      |
| --------- | -------------------------------------- | ------------------------------ |
| AH-9.7-01 | Finance on urban                       | **FAIL** INV-P9-006            |
| AH-9.7-02 | Nest finance module tree               | **FAIL** P9-F-008              |
| AH-9.7-03 | Ledger write bypassing outbox          | **FAIL** TQ-P9-006             |
| AH-9.7-04 | Float money amounts                    | **FAIL** — minor string only   |
| AH-9.7-05 | Installment sum ≠ invoice              | **FAIL** CP-9.7-14             |
| AH-9.7-06 | Finance hub = single upload panel only | **FAIL** — command center tabs |

---

## 13. Verification bundle

```bash
pnpm --filter @app-tour/workspace-denali exec node --import tsx --test test/finance-admin.spec.ts
pnpm --filter @app-tour/workspace-denali exec node --import tsx --test test/finance-outbox-consumer.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/denali-finance-outbox.integration.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/finance-ops.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/finance-prepayments.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/dashboard-smoke.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/finance-dashboard-widget.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/finance-reports-logic.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/finance-payments-logic.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/compile-invoice-balances.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/finance-invoice.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/finance-invoice-logic.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/finance-prepayments-logic.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/finance-installments-logic.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/reconciliation-triage.spec.ts
pnpm run phase-9:guard
```

### R1 reports & payments BFF (web)

| Method | Web BFF                              | Backend proxy                         |
| ------ | ------------------------------------ | ------------------------------------- |
| GET    | `/api/finance/reports/summary`       | `GET /finance/reports/summary`        |
| GET    | `/api/finance/reports/ledger-events` | `GET /finance/reports/ledger-events`  |
| GET    | `/api/finance/payments`              | `GET /finance/payments`               |
| POST   | `/api/finance/payments/manual`       | `POST /finance/payments/manual`       |
| GET    | `/api/finance/receipts/pending`      | `GET /finance/receipts/pending`       |
| POST   | `/api/finance/receipts`              | `POST /finance/receipts`              |
| PATCH  | `/api/finance/receipts/{id}/review`  | `PATCH /finance/receipts/{id}/review` |

### R2 prepayment BFF (web)

| Method | Web BFF                         | Backend proxy              |
| ------ | ------------------------------- | -------------------------- |
| GET    | `/api/finance/prepayments`      | `GET /finance/prepayments` |
| POST   | `/api/finance/prepayments`      | `POST /finance/prepayments` |

### R3 schedule BFF (web)

| Method | Web BFF                              | Backend proxy                       |
| ------ | ------------------------------------ | ----------------------------------- |
| GET    | `/api/finance/schedules`             | `GET /finance/schedules`            |
| POST   | `/api/finance/schedules/generate`    | `POST /finance/schedules/generate`  |

Session bearer forwarded via `readSessionTokenFromRequest` — same pattern as `/api/bookings`.

---

## 14. Risk reference

See [`FINANCE-RISK-REGISTER-P9.md`](FINANCE-RISK-REGISTER-P9.md) — ledger drift, installment rounding, reconciliation adjust authority, urban bleed.
