# P6 — Finance ops verification note

```yaml
note_id: FINANCE-OPS-P6-NOTE
epic: P6-2
nanos: [P6-2-N-006, P6-2-N-007, P6-2-N-014]
authority: FINANCE-OPS-UX.md · p6-2-operator-admin.md
```

## Why `finance-ops.spec.ts` is not in `p6:gate`

| Fact | Detail |
| ---- | ------ |
| Spec file | `apps/api/test/finance-ops.spec.ts` |
| Skip condition | `describe(..., { skip: !hasDatabase })` when `DATABASE_URL` unset |
| P6 product gate | Static + in-memory API specs only — **no Postgres required** |
| P6-2 closure proof | `p6-offline-receipt-gate.spec.ts` (route/BFF existence) + operator runbook VS-07 |

**This is intentional** — same pattern as Phase 9.7: integration depth when DB present; product gate stays fast.

---

## Finance SoT (P6 frozen)

| Layer | Path |
| ----- | ---- |
| API finance | `apps/api/src/workspace-finance/` (workspace dispatch) |
| Legacy removed | `apps/api/src/denali-finance/` — **do not resurrect** |
| Admin UI | `apps/web/app/(app)/finance/` |
| Member receipt BFF | `apps/portal/app/api/me/registrations/[id]/receipt/route.ts` |
| Reconciliation | `apps/web/app/(app)/settings/reconciliation-triage/` |

---

## When to run `finance-ops.spec.ts`

```bash
# Requires Postgres + migration 008_finance_payments_delta.sql
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5434/tour_db
export DATABASE_URL_ADMIN="$DATABASE_URL"

pnpm --filter @apps/api exec node --import tsx --test test/finance-ops.spec.ts
```

**Pass signals (API-9.7):**

- `GET /finance/reports/summary` → 200
- `POST /finance/receipts` → 201
- `PATCH /finance/receipts/{id}/review` approve → ledger outbox

---

## P6 gate substitutes (no DB)

| Nano | Gate spec | Asserts |
| ---- | --------- | ------- |
| N-014 offline_receipt | `p6-offline-receipt-gate.spec.ts` | finance receipts route + portal BFF exist |
| N-007 receipt review | `first-customer-operator.md` VS-07 | manual approve path |
| N-006 receipts panel | `finance-page.spec.ts` (web unit) | panel wired when run in web test suite |

---

## Staging checklist (Architect YES)

1. `pnpm run p6:gate` green
2. `finance-ops.spec.ts` green with staging `DATABASE_URL`
3. Manual VS-07 on `operator.admin.localhost:3000`
4. Member VS-05 receipt visible in finance pending tab

---

## References

- [IMPLEMENTATION-TRUTH-P6.md](IMPLEMENTATION-TRUTH-P6.md)
- [TRACEABILITY-MATRIX-P6.md](TRACEABILITY-MATRIX-P6.md) — P6-2 rows
- [runbooks/first-customer-operator.md](../runbooks/first-customer-operator.md)
