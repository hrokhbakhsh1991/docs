# P6-2 — Operator admin (full Denali depth)

```yaml
epic: P6-2
nanos: 16
priority: 3
prerequisite: P6-1-N-014 GUEST_SLICE_OK
app: apps/web (app)/
payment: offline_receipt
```

## Goal

After guest slice works, **complete Denali admin** — fix small errors, wire bookings/finance/settings for daily club ops.

**Assumes:** tours publish, catalog, and portal register already work (P6-1).

---

## Nanos

### P6-2-N-001 — Bookings persistence audit

**Do:** Trace in-memory vs Prisma; fix for production first customer.

**Files:** `apps/api/src/bookings/`

**Verify:** `bookings-ops.spec.ts`

---

### P6-2-N-002 — Approve/reject production path

**Do:** Transactional approve/reject + outbox.

**Verify:** `bookings-approve.spec.ts`, `bookings-command-center.spec.ts`

---

### P6-2-N-003 — Waitlist promote

**Do:** Waitlist → approved from command center or workspace tab.

**Verify:** CP-9.5-07 equivalent

---

### P6-2-N-004 — Tour workspace registrations embed

**Do:** Workspace embeds `BookingsCommandCenter` with `tourId` preset.

**Files:** `(app)/tours/[id]/workspace/page.tsx`

**Verify:** web spec

---

### P6-2-N-005 — Operator tour register

**Do:** `(app)/tours/[id]/register` operator-initiated pending booking.

**Verify:** register route specs

---

### P6-2-N-006 — Finance receipts panel live

**Do:** `(app)/finance` receipts tab wired to APIs.

**Verify:** `finance-page.spec.ts`

---

### P6-2-N-007 — Receipt review → ledger

**Do:** PATCH approve → ledger outbox (`offline_receipt`).

**Verify:** `finance-ops.spec.ts`

---

### P6-2-N-008 — MinIO upload path

**Do:** Real file upload (align with P6-3 member upload).

**Verify:** minio/finance upload spec

---

### P6-2-N-009 — Wizard UX bug sweep

**Do:** Fix top guest-blocking wizard errors (list from team backlog); document in runbook.

**Verify:** targeted wizard specs green

---

### P6-2-N-010 — Settings persist check

**Do:** Audit 9 settings modules persistence; fix blockers.

**Verify:** per-module specs

---

### P6-2-N-011 — Dashboard pending KPI

**Do:** Pending bookings count on dashboard.

**Verify:** dashboard test

---

### P6-2-N-012 — Finance dashboard widget live

**Do:** Widget uses live summary API.

**Verify:** finance widget spec

---

### P6-2-N-013 — Reconciliation triage depth

**Do:** Triage board wired; link from finance hub.

**Verify:** `reconciliation-triage.spec.ts`

---

### P6-2-N-014 — offline_receipt enforcement

**Do:** `apps/api/test/p6-offline-receipt-gate.spec.ts`

**Verify:** in p6:gate

---

### P6-2-N-015 — Preservation PC-01..10

**Do:** `apps/api/test/p6-preservation-gate.spec.ts`

**Verify:** green

---

### P6-2-N-016 — Operator runbook

**Do:** `docs/phase-19/p6/runbooks/first-customer-operator.md`

**Verify:** VS-06 · VS-07 manual steps documented

---

## EPIC exit

Operator runs club daily: approve bookings, review receipts, settings stable.
