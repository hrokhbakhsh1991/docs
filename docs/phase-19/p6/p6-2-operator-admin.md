# P6-2 — Operator admin (full Denali depth)

```yaml
epic: P6-2
nanos: 16
status: COMPLETE
priority: 3
prerequisite: P6-1-N-014 GUEST_SLICE_OK
app: apps/web (app)/
payment: offline_receipt
finance_note: appendices/FINANCE-OPS-P6-NOTE.md
operator_runbook: runbooks/first-customer-operator.md
```

## Goal

After guest slice works, **complete Denali admin** — bookings approve, finance receipt review, settings stable for daily club ops.

**Assumes:** P6-1 guest chain green. **Finance DB depth:** see [FINANCE-OPS-P6-NOTE.md](appendices/FINANCE-OPS-P6-NOTE.md).

---

## Nano file matrix (agent quick index)

| Nano | Primary files | Prove with |
| ---- | ------------- | ---------- |
| N-001 | `apps/api/src/bookings/bookings.service.ts` · `create-bookings-repository.ts` · `prisma-bookings.repository.ts` | `bookings-ops.spec.ts` |
| N-002 | `apps/api/src/bookings/bookings.routes.ts` · approve/reject handlers | `bookings-ops.spec.ts` API-9.5-01 · `bookings-command-center.spec.ts` |
| N-003 | `apps/web/app/(app)/tours/[id]/workspace/waitlist/tour-workspace-waitlist-client.tsx` · `tour-workspace-waitlist-logic.ts` | `tours-workspace.spec.ts` |
| N-004 | `apps/web/app/(app)/tours/[id]/workspace/tour-workspace-registrations-client.tsx` · `tour-workspace-registrations-logic.ts` | `tour-workspace-registrations-logic.spec.ts` |
| N-005 | `apps/web/app/(app)/tours/[id]/register/page.tsx` · `tour-register-page-client.tsx` | `tours-workspace.spec.ts` |
| N-006 | `apps/web/app/(app)/finance/page.tsx` · `finance-command-center.tsx` | `finance-page.spec.ts` |
| N-007 | `apps/api/src/workspace-finance/` · receipt review route | `finance-ops.spec.ts` (DB) · runbook VS-07 |
| N-008 | finance upload + `apps/portal/app/api/me/registrations/[id]/receipt/route.ts` | `p6-offline-receipt-gate.spec.ts` |
| N-009 | `apps/web/app/(app)/tours/new/` wizard routes | wizard specs · runbook note |
| N-010 | `apps/web/app/(app)/settings/**` · `apps/api/src/settings/` | `settings-*.spec.ts` matrix |
| N-011 | `apps/web/app/(app)/dashboard/` · `dashboard-widgets-logic.ts` | `dashboard-widgets-logic.spec.ts` |
| N-012 | `apps/web/src/finance/finance-overview-panel.tsx` | finance widget specs |
| N-013 | `apps/web/app/(app)/settings/reconciliation-triage/page.tsx` · link from `finance-overview-panel.tsx` | `reconciliation-triage.spec.ts` |
| N-014 | `apps/api/test/p6-offline-receipt-gate.spec.ts` | in `p6:gate` |
| N-015 | `apps/api/test/p6-preservation-gate.spec.ts` | in `p6:gate` |
| N-016 | `runbooks/first-customer-operator.md` | manual VS-06/07 |

**Authority:** `BOOKINGS-OPS-UX.md` · `FINANCE-OPS-UX.md` · [FINANCE-OPS-P6-NOTE.md](appendices/FINANCE-OPS-P6-NOTE.md)

---

## Nanos

### P6-2-N-001 — Bookings persistence audit

**Do:** Production path uses `STORAGE_DRIVER=prisma` → `PrismaBookingsRepository`; memory only in test.

**Files:** `apps/api/src/bookings/create-bookings-repository.ts` · `prisma-bookings.repository.ts` · `bookings.service.ts`

**Verify:** `bookings-ops.spec.ts` (in `p6:gate`)

---

### P6-2-N-002 — Approve/reject production path

**Do:** Transactional approve/reject + domain outbox in one txn.

**Files:** `apps/api/src/bookings/bookings.routes.ts` · `bookings.service.ts`

**Verify:** `bookings-ops.spec.ts` API-9.5-01 · `bookings-command-center.spec.ts`

---

### P6-2-N-003 — Waitlist promote

**Do:** Workspace waitlist tab promotes waitlisted row → bookings approve API.

**Files:** `apps/web/app/(app)/tours/[id]/workspace/waitlist/tour-workspace-waitlist-client.tsx` · `src/features/tours/tour-workspace-waitlist-logic.ts`

**Verify:** `tours-workspace.spec.ts` · approve calls `status=waitlisted` filter

---

### P6-2-N-004 — Tour workspace registrations embed

**Do:** Workspace embeds `BookingsCommandCenter` with `tourId` preset from route param.

**Files:** `apps/web/app/(app)/tours/[id]/workspace/tour-workspace-registrations-client.tsx` · `tour-workspace-registrations-logic.ts`

**Verify:** `tour-workspace-registrations-logic.spec.ts`

---

### P6-2-N-005 — Operator tour register

**Do:** Operator-initiated pending booking on tour register route.

**Files:** `apps/web/app/(app)/tours/[id]/register/page.tsx` · `tour-register-page-client.tsx` · `tour-register-gate.ts`

**Verify:** `tours-workspace.spec.ts`

---

### P6-2-N-006 — Finance receipts panel live

**Do:** `(app)/finance` receipts tab wired to live BFF/API.

**Files:** `apps/web/app/(app)/finance/page.tsx` · `finance-command-center.tsx`

**Verify:** `finance-page.spec.ts`

---

### P6-2-N-007 — Receipt review → ledger

**Do:** PATCH approve receipt → ledger outbox (`offline_receipt` model).

**Files:** `apps/api/src/workspace-finance/` (receipt review handler)

**Verify:** `finance-ops.spec.ts` when `DATABASE_URL` set — see [FINANCE-OPS-P6-NOTE.md](appendices/FINANCE-OPS-P6-NOTE.md) · runbook VS-07

---

### P6-2-N-008 — MinIO upload path

**Do:** Receipt file upload path aligned between member portal BFF and operator finance review.

**Files:** `apps/portal/app/api/me/registrations/[id]/receipt/route.ts` · finance receipts POST handler

**Verify:** `p6-offline-receipt-gate.spec.ts`

---

### P6-2-N-009 — Wizard UX bug sweep

**Do:** Time-box guest-blocking wizard fixes only; log remainder in operator runbook.

**Files:** `apps/web/app/(app)/tours/new/**` · workspace wizard bridge

**Verify:** targeted wizard specs · document known issues in `first-customer-operator.md`

---

### P6-2-N-010 — Settings persist check

**Do:** Audit 9 settings modules — PUT round-trip persists.

**Files:** `apps/web/app/(app)/settings/**` · `apps/api/src/settings/`

**Verify:** `settings-resources.spec.ts` · `settings-manifest.spec.ts` · per-module specs

---

### P6-2-N-011 — Dashboard pending KPI

**Do:** Dashboard shows pending bookings count from live summary API.

**Files:** `apps/web/app/(app)/dashboard/` · `src/features/dashboard/dashboard-widgets-logic.ts`

**Verify:** `dashboard-widgets-logic.spec.ts`

---

### P6-2-N-012 — Finance dashboard widget live

**Do:** Finance overview widget uses `GET /finance/reports/summary` BFF.

**Files:** `apps/web/src/finance/finance-overview-panel.tsx`

**Verify:** finance widget / overview specs

---

### P6-2-N-013 — Reconciliation triage depth

**Do:** Triage board live; finance hub links to `/settings/reconciliation-triage`.

**Files:** `apps/web/app/(app)/settings/reconciliation-triage/page.tsx` · `finance-overview-panel.tsx` (Link)

**Verify:** `reconciliation-triage.spec.ts` · `reconciliation-triage-server-prefetch.spec.ts`

---

### P6-2-N-014 — offline_receipt enforcement

**Do:** Static gate proves offline receipt routes + portal BFF exist.

**Files:** `apps/api/test/p6-offline-receipt-gate.spec.ts`

**Verify:** in `p6:gate`

---

### P6-2-N-015 — Preservation PC-01..10

**Do:** Gate proves denali plugin, rules, bookings service not deleted.

**Files:** `apps/api/test/p6-preservation-gate.spec.ts` · [p6-denali-safety.md](p6-denali-safety.md)

**Verify:** in `p6:gate`

---

### P6-2-N-016 — Operator runbook

**Do:** Manual VS-06 approve booking · VS-07 approve receipt documented.

**Files:** [runbooks/first-customer-operator.md](runbooks/first-customer-operator.md)

**Verify:** steps reference canonical admin host `operator.admin.localhost:3000`

---

## EPIC exit

Operator runs club daily: approve bookings, review receipts, settings stable.

---

## Gaps (trunk vs nano — post-closure)

| Nano | Status | Proof |
| ---- | ------ | ----- |
| N-001 | ✅ | `bookings-ops.spec.ts` in `p6:gate` |
| N-002 | ✅ | Approve + outbox + reject path on trunk |
| N-003 | ✅ | Waitlist promote wired (workspace tab) |
| N-004 | ✅ | Command center `tourId` preset |
| N-005 | ✅ | `(app)/tours/[id]/register` |
| N-006–007 | ✅ | Finance routes + receipt review |
| N-008 | ✅ | Receipt upload aligned with P6-3 BFF |
| N-009 | ✅ | Wizard blockers time-boxed in runbook |
| N-010 | ✅ | Settings specs matrix on trunk |
| N-011–012 | ✅ | Dashboard KPI + finance widget |
| N-013 | ✅ | Reconciliation triage linked |
| N-014 | ✅ | `p6-offline-receipt-gate.spec.ts` |
| N-015 | ✅ | `p6-preservation-gate.spec.ts` |
| N-016 | ✅ | [first-customer-operator.md](runbooks/first-customer-operator.md) |
