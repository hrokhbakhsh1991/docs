# P7-3 — Delivery exit (customer sign-off)

```yaml
epic: P7-3
nanos: 5
status: PLANNED
priority: 4
prerequisite: [P7-0, P7-1, P7-2]
exit: P7-3-N-005
exit_signal: VS-01..08 on staging + customer sign-off
```

## Goal

**Vertical slice کامل روی staging** — مهمان + اپراتور + member — با sign-off مشتری اول.

---

## Verification tiers (frozen from P6)

| Tier | Artifact | Required for P7 exit |
| ---- | -------- | -------------------- |
| T1 | `pnpm run p7:gate` | every PR |
| T2 | [p6-e2e-smoke.md](../../phase-19/p6/runbooks/p6-e2e-smoke.md) on staging URLs | pre-sign-off |
| T3 | [FINANCE-OPS-P6-NOTE.md](../../phase-19/p6/appendices/FINANCE-OPS-P6-NOTE.md) | staging Postgres |
| T4 | [p7-customer-sign-off.md](runbooks/p7-customer-sign-off.md) | manual VS-01..08 |

---

## Nanos

### P7-3-N-001 — T2 E2E on staging URLs

**Do:** Run SMK-P6-* Playwright/smoke suite against staging base URLs (not localhost).

**Files:** [p6-e2e-smoke.md](../../phase-19/p6/runbooks/p6-e2e-smoke.md) · `apps/marketing/tests/e2e/` · `apps/portal/tests/e2e/`

**Verify:** SMK-MKT-03 · SMK-PTL-01..04 green on staging env matrix profile B or C

---

### P7-3-N-002 — T3 finance-ops on staging Postgres

**Do:** `finance-ops.spec.ts` green with staging `DATABASE_URL`.

**Files:** `apps/api/test/finance-ops.spec.ts` · migration `008_finance_payments_delta.sql`

**Verify:**

```bash
export DATABASE_URL=postgresql://...@staging:5432/tour_db
pnpm --filter @apps/api exec node --import tsx --test test/finance-ops.spec.ts
```

---

### P7-3-N-003 — p7:gate composition documented

**Do:** Document and extend gate script beyond pack integrity when behavioral specs land.

**Files:** [scripts/p7-denali-delivery-gate.sh](../../../scripts/p7-denali-delivery-gate.sh)

**Current composition:**

```bash
pnpm run p6:gate
pnpm --filter @apps/api exec node --import tsx --test test/p7-pack-integrity.spec.ts
```

**Do not add** `p7-staging-smoke.spec.ts` until staging URLs are stable — use manual T2 ([p6-e2e-smoke.md](../../phase-19/p6/runbooks/p6-e2e-smoke.md)) per [P7-EXECUTION-DISCIPLINE.md](appendices/P7-EXECUTION-DISCIPLINE.md).

**Verify:** `pnpm run p7:gate` → `P7_DENALI_DELIVERY_GATE_OK`

---

### P7-3-N-004 — Customer sign-off runbook

**Do:** Handoff checklist for first customer without dev assistance.

**Files:** [runbooks/p7-customer-sign-off.md](runbooks/p7-customer-sign-off.md)

**Verify:** T4 checklist completed · Architect + customer initials

---

### P7-3-N-005 — Exit nano

**Do:** All VS-01..08 staging columns ✅ in exit checklist · `p7:gate` green · IMPLEMENTATION-TRUTH-P7 → `BEHAVIORAL_COMPLETE`.

**Verify:** [p7-exit-checklist.md](p7-exit-checklist.md) · AGENT-CURRENT-PHASE.yaml status

---

## VS live checklist

- [ ] VS-01 publish active (customer tour)
- [ ] VS-02 marketing lists tour
- [ ] VS-03 portal register
- [ ] VS-04 `/me` row
- [ ] VS-05 member receipt
- [ ] VS-06 operator approve booking
- [ ] VS-07 operator approve receipt
- [ ] VS-08 `p7:gate` + `p6:gate`

---

## EPIC exit

مشتری اول بدون dev یک register + approve اپراتور انجام می‌دهد.

## References

- [platform-denali-vertical-slice.mdoc](../../phase-19/platform-denali-vertical-slice.mdoc)
- [IMPLEMENTATION-TRUTH-P7.md](appendices/IMPLEMENTATION-TRUTH-P7.md)
