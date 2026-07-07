# P7-2 — Tour workspace Denali (additive ops)

```yaml
epic: P7-2
nanos: 8
pack_version: "1.6"
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

```yaml
nano: P7-2-N-001
proof_tier: DEV_API_MEMORY
verify_ref: appendices/P7-VERIFICATION-COMMANDS.yaml#P7-2-N-001
repo_status: NOT_STARTED
forbidden_until: [P7-1-N-009]
```

**Do:** Workspace registrations embed `BookingsCommandCenter` with `tourId` from route param.

**Files:** `apps/web/app/(app)/tours/[id]/workspace/tour-workspace-registrations-client.tsx` · `tour-workspace-registrations-logic.ts`

**Verify:** `tour-workspace-registrations-logic.spec.ts` · `pnpm run p7:staging-workspace-registrations-probe`

**Staging auth prerequisite:** Postgres must have `OPERATOR_SMOKE.ownerMobile` (`+15550001001`) with **ACTIVE owner membership** on tenant `…014`. `seed-operator-smoke-identity-staging.ts` upserts that row; the probe runs it idempotently before OTP on `operator.admin.localhost`.

**Pass signals:**

| Layer | Signal |
| ----- | ------ |
| Dev | `buildTourRegistrationsWorkspaceQuery` / `buildTourRegistrationsBookingsQuery` specs green |
| Staging UI | `data-testid="operator-tour-workspace-registrations-panel"` on `/tours/{tourId}/workspace` |
| Staging links | Register href `/tours/{tourId}/register` · command center `tourId=` query |
| Staging API | Authenticated `GET /api/bookings?tourId=…&view=ops` returns `{ items: [] }` or rows |

---

### P7-2-N-002 — Pending row from portal registration

```yaml
nano: P7-2-N-002
proof_tier: STAGING
verify_ref: appendices/P7-VERIFICATION-COMMANDS.yaml#P7-2-N-002
repo_status: NOT_STARTED
forbidden_until: [P7-2-N-001]
```

**Do:** Portal registration from VS-03 appears in workspace pending list on staging.

**Files:** bookings service · workspace client

**Verify:** After portal register → row visible with party size / guest name · `pnpm run p7:staging-portal-pending-probe`

**Probe flow:** `POST operator.portal.localhost/api/catalog/registrations` → operator.admin OTP → `GET /api/bookings?tourId=…&view=ops` + workspace HTML contains guest name.

---

### P7-2-N-003 — Approve booking from workspace

```yaml
nano: P7-2-N-003
proof_tier: STAGING
verify_ref: appendices/P7-VERIFICATION-COMMANDS.yaml#P7-2-N-003
repo_status: NOT_STARTED
forbidden_until: [P7-2-N-002]
```

**Do:** Operator approves pending booking; status `approved`; outbox emitted.

**Files:** `apps/api/src/bookings/bookings.service.ts` · workspace UI

**Verify:** `bookings-ops.spec.ts` API-9.5-01 · `pnpm run p7:staging-approve-booking-probe` · **VS-06 staging**

**Probe flow:** portal registration → operator OTP → `POST /api/bookings/{id}/approve` (web BFF) → list shows `approved` → `verify-booking-approve-outbox-staging.ts` asserts `registration.approved` outbox row.

---

### P7-2-N-004 — Waitlist promote on staging

```yaml
nano: P7-2-N-004
proof_tier: DEV_API_MEMORY
verify_ref: appendices/P7-VERIFICATION-COMMANDS.yaml#P7-2-N-004
repo_status: NOT_STARTED
forbidden_until: [P7-2-N-003]
```

**Do:** Full path: waitlisted row → promote → approve API.

**Files:** `apps/web/app/(app)/tours/[id]/workspace/waitlist/` · `tour-workspace-waitlist-logic.ts`

**Verify:** `tours-workspace.spec.ts` · `pnpm run p7:staging-waitlist-promote-probe`

**Staging seed:** `seed-operator-smoke-waitlist-staging.ts` upserts booking `…0312` (`Jamal Hosseini`) on tour `…0210` with `status=waitlisted` (idempotent reset before each probe).

**Probe flow:** seed waitlist row → operator OTP → `GET /api/bookings?status=waitlisted&tourId=…` → `POST /api/bookings/{id}/approve` → waitlist empty → outbox `registration.approved`.

---

### P7-2-N-005 — Transport roster from canonical (CONDITIONAL — skip by default)

```yaml
nano: P7-2-N-005
proof_tier: STAGING
verify_ref: appendices/P7-VERIFICATION-COMMANDS.yaml#P7-2-N-005
repo_status: SKIP
conditional: true
forbidden_until: [P7-2-N-004]
```

**Do:** Transport tab reflects tour canonical transport mode and roster on staging tour.

**Files:** `apps/web/app/(app)/tours/[id]/workspace/transport/`

**Verify:** Transport list matches published tour data

**Skip unless:** Walkthrough or customer confirms day-one transport ops — see [P7-EXECUTION-DISCIPLINE.md](appendices/P7-EXECUTION-DISCIPLINE.md)

---

### P7-2-N-006 — Operator register route (CONDITIONAL — skip by default)

```yaml
nano: P7-2-N-006
proof_tier: STAGING
verify_ref: appendices/P7-VERIFICATION-COMMANDS.yaml#P7-2-N-006
repo_status: SKIP
conditional: true
forbidden_until: [P7-2-N-004]
```

**Do:** `(app)/tours/[id]/register` creates pending booking for walk-in operator flow.

**Files:** `apps/web/app/(app)/tours/[id]/register/` · `tour-register-page-client.tsx`

**Verify:** `tours-workspace.spec.ts`

**Skip unless:** Portal-only registration is insufficient for customer day-one — document reason in exit checklist

---

### P7-2-N-007 — Finance hub link for receipt review

```yaml
nano: P7-2-N-007
proof_tier: STAGING
verify_ref: appendices/P7-VERIFICATION-COMMANDS.yaml#P7-2-N-007
repo_status: NOT_STARTED
forbidden_until: [P7-2-N-003]
```

**Do:** Workspace or command center links to `/finance` pending receipts for VS-07 prep.

**Files:** `apps/web/app/(app)/finance/` · `finance-command-center.tsx`

**Verify:** `finance-page.spec.ts` · `finance-dashboard-widget.spec.ts` · `pnpm run p7:staging-finance-hub-probe`

**Staging seed:** `seed-operator-smoke-finance-receipt-staging.ts` upserts registration `…0313` + payment `…0401` + Pending receipt `…0402`.

**Probe flow:** operator OTP → `GET /api/finance/reports/summary` (`pendingReceiptReviews≥1`) → `GET /api/finance/receipts/pending` → `/finance?tab=receipts` HTML has command center + receipts tab link.

---

### P7-2-N-008 — Operator runbook on staging

```yaml
nano: P7-2-N-008
proof_tier: MANUAL
verify_ref: appendices/P7-VERIFICATION-COMMANDS.yaml#P7-2-N-008
repo_status: NOT_STARTED
forbidden_until: [P7-2-N-003]
```

**Do:** Execute [first-customer-operator.md](../../phase-19/p6/runbooks/first-customer-operator.md) VS-06 on staging URLs.

**Files:** runbook · staging admin host

**Verify:** T4 manual VS-06 signed · `pnpm run p7:staging-vs06-runbook-probe` (automated runbook chain on staging)

**Probe maps runbook:** OTP login → portal pending → `/tours/{id}/workspace` panel → pending row → approve → outbox · same as [first-customer-operator.md](../../phase-19/p6/runbooks/first-customer-operator.md) VS-06.

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
