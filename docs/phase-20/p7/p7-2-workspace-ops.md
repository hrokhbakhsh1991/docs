# P7-2 — Tour workspace Denali (additive ops)

```yaml
epic: P7-2
nanos: 8
status: PLANNED
priority: 3
prerequisite: P7-1-N-009
zone: Z3 additive
exit_signal: VS-06 live on staging — operator approves portal booking from workspace
```

## Goal

اپراتور روی **همان تور مشتری** کار روز اول را کند — workspace موجود را پایدار کن؛ فقط قابلیت‌های **ضروری** additive.

## Reality (trunk)

```text
/tours/[id]/workspace           → registrations (command center embed)
/tours/[id]/workspace/waitlist  → waitlist promote
/tours/[id]/workspace/transport → transport roster
/tours/[id]/register            → operator-initiated booking
```

P6 wired these paths — P7 proves them on **staging with customer data**.

---

## Nanos

### P7-2-N-001 — Registrations tab tourId preset

**Do:** Workspace registrations embed `BookingsCommandCenter` with `tourId` from route param.

**Files:** `apps/web/app/(app)/tours/[id]/workspace/tour-workspace-registrations-client.tsx` · `tour-workspace-registrations-logic.ts`

**Verify:** `tour-workspace-registrations-logic.spec.ts` · staging UI shows tour-scoped inbox

---

### P7-2-N-002 — Pending row from portal registration

**Do:** Portal registration from VS-03 appears in workspace pending list on staging.

**Files:** bookings service · workspace client

**Verify:** After portal register → row visible with party size / guest name

---

### P7-2-N-003 — Approve booking from workspace

**Do:** Operator approves pending booking; status `approved`; outbox emitted.

**Files:** `apps/api/src/bookings/bookings.service.ts` · workspace UI

**Verify:** `bookings-ops.spec.ts` API-9.5-01 · **VS-06 staging** · SMK-P9-04 alias

---

### P7-2-N-004 — Waitlist promote on staging

**Do:** Full path: waitlisted row → promote → approve API.

**Files:** `apps/web/app/(app)/tours/[id]/workspace/waitlist/` · `tour-workspace-waitlist-logic.ts`

**Verify:** `tours-workspace.spec.ts` · manual staging when capacity full

---

### P7-2-N-005 — Transport roster from canonical (CONDITIONAL — skip by default)

**Do:** Transport tab reflects tour canonical transport mode and roster on staging tour.

**Files:** `apps/web/app/(app)/tours/[id]/workspace/transport/`

**Verify:** Transport list matches published tour data

**Skip unless:** Walkthrough or customer confirms day-one transport ops — see [P7-EXECUTION-DISCIPLINE.md](appendices/P7-EXECUTION-DISCIPLINE.md)

---

### P7-2-N-006 — Operator register route (CONDITIONAL — skip by default)

**Do:** `(app)/tours/[id]/register` creates pending booking for walk-in operator flow.

**Files:** `apps/web/app/(app)/tours/[id]/register/` · `tour-register-page-client.tsx`

**Verify:** `tours-workspace.spec.ts`

**Skip unless:** Portal-only registration is insufficient for customer day-one — document reason in exit checklist

---

### P7-2-N-007 — Finance hub link for receipt review

**Do:** Workspace or command center links to `/finance` pending receipts for VS-07 prep.

**Files:** `apps/web/app/(app)/finance/` · `finance-command-center.tsx`

**Verify:** After VS-05 member upload → receipt visible in finance pending tab on staging

---

### P7-2-N-008 — Operator runbook on staging

**Do:** Execute [first-customer-operator.md](../../phase-19/p6/runbooks/first-customer-operator.md) VS-06 on staging URLs.

**Files:** runbook · staging admin host

**Verify:** T4 manual VS-06 signed · checklist staging column

---

## FORBIDDEN

```text
❌ Refactor (app)/ admin shell
❌ Merge workspace logic into wizard package
❌ New workspace tabs without P0 justification
❌ Finance per-tour tab (Z4)
```

## EPIC exit

VS-06 live on staging from workspace or command center.

## References

- [p6-2-operator-admin.md](../../phase-19/p6/p6-2-operator-admin.md)
- [first-customer-operator.md](../../phase-19/p6/runbooks/first-customer-operator.md)
