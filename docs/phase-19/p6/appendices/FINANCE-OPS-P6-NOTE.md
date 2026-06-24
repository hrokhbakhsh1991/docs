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

**Preferred (P6 staging gates — bootstraps `tour_db` + migrate automatically):**

```bash
pnpm run infra:up   # if Docker Postgres not running
P6_FINANCE_OPS=1 pnpm run p6:staging-gate
# or:
export DATABASE_URL=postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db
unset DATABASE_URL_ADMIN   # stale postgres:postgres from old docs breaks auth
pnpm run p6:staging-preflight
```

`scripts/ensure-p6-finance-postgres.sh` creates `tour_db`, applies `01-app-role.sql`, runs `db:migrate:deploy`, and exports matching `DATABASE_URL` / `DATABASE_URL_ADMIN` (`app_tour` role — **not** `postgres:postgres` on local Docker).

**Manual (single spec only):**

```bash
eval "$(bash scripts/ensure-p6-finance-postgres.sh)"
pnpm --filter @apps/api exec node --import tsx --test test/finance-ops.spec.ts
```

{% callout type="warning" %}
Do **not** set `DATABASE_URL_ADMIN=postgresql://postgres:postgres@127.0.0.1:5434/...` on local `pnpm infra:up` — that user is not provisioned. Use `app_tour:app_tour` or omit `DATABASE_URL_ADMIN` (spec falls back to `DATABASE_URL`).
{% /callout %}

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

## Verified (2026-06-22 — Bundle E)

Local Postgres with `DATABASE_URL` set:

```bash
pnpm run p6:staging-preflight   # → P6_STAGING_PREFLIGHT_OK (includes finance-ops)
pnpm run p6:staging-gate        # → P6_STAGING_GATE_OK
```

**Pass:** `finance-ops.spec.ts` API-9.7-01..04 — manual payment → receipt → approve → ledger outbox.

---

## Staging checklist (Architect YES)

1. `pnpm run p6:gate` green
2. `pnpm run p6:e2e-gate` → `P6_E2E_GATE_OK`
3. `pnpm run p6:staging-preflight` or `p6:staging-gate` with staging `DATABASE_URL` (runs `finance-ops.spec.ts`)
4. Manual sign-off optional: [first-customer-operator.md](../runbooks/first-customer-operator.md) on staging hosts

---

## References

- [IMPLEMENTATION-TRUTH-P6.md](IMPLEMENTATION-TRUTH-P6.md)
- [TRACEABILITY-MATRIX-P6.md](TRACEABILITY-MATRIX-P6.md) — P6-2 rows
- [runbooks/first-customer-operator.md](../runbooks/first-customer-operator.md)
