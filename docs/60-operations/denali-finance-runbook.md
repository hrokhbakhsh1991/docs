# Denali finance module — operations runbook

**Workspace:** Denali pilot tenant (`finance` + `form_builder` in `tenants.enabled_modules`).

**Pricing rules (product):** [`docs/30-domain/denali_pricing_rules.md`](../30-domain/denali_pricing_rules.md)

## Prerequisites

- API + Postgres + Redis + MinIO running (`infra/docker-compose.yml`; MinIO API **9002** on host).
- Tenant provisioned: `pnpm --dir apps/api exec tsx src/scripts/provision-denali-tenant.ts`
- `enabled_modules` includes `finance` (not `module.finance` — DB stores slug `finance`).

## Capability matrix

| Surface | Requirement |
|---------|-------------|
| `POST /api/v2/payments/intent` | JWT + `module.finance` |
| `POST /api/v2/tours/:id/register` (paid tour) | `finance` module + `cost_context.requiresPayment` |
| Finance manual payment / receipt APIs | `module.finance` + CASL `FinanceManualPayment` / `FinanceReceipt` |
| Finance reports (`/finance/reports/*`) | `module.finance` |
| Web dashboard finance card | `useFinanceModuleAccess` + leader role |

## Paid tour signup (public)

1. Create tour with **requires payment** in wizard (maps to `tours.cost_context.requiresPayment`) and **base price > 0** before publish (`PAID_TOUR_REQUIRES_AMOUNT` on Open).
2. Public register with `Idempotency-Key` → `201` + `paymentIntent` when capacity available.
3. PSP webhook `POST /internal/payments/webhook` (HMAC + Redis replay dedupe in non-test env).
4. Registration → `AcceptedPaid` when webhook status is `Paid`.

## Settlement rule (pilot)

- If a registration already has a **Paid** payment (online webhook or receipt approve), `POST /api/v2/finance/payments/manual` returns **409** `PAYMENT_DEBT_AFTER_SETTLEMENT_FORBIDDEN`.
- Recovery: after online **Failed** (no Paid, no Pending), manual debt creation is allowed.

## Manual receipt flow

1. `POST /api/v2/finance/payments/manual` — pending manual payment.
2. `POST /api/v2/finance/payments/:id/receipt` — multipart upload (MinIO bucket `receipts`). Pilot: only **Admin/Owner/Leader** or a **Member whose phone matches** `registration.participantContactPhone`.
3. Admin: `POST /api/v2/admin/finance/receipts/:id/approve` → payment `Paid`, registration paid.

## Production payment provider

- Set `DEFAULT_PAYMENT_PROVIDER=stripe` or `zibal` (not `mock_provider`).
- `env.schema` rejects `mock_provider` when `NODE_ENV=production`.
- Configure `STRIPE_*` or `ZIBAL_*` per `apps/api/.env.example`.

## Health checks

- `GET /health` — includes `dependencies.storage` (`ok` | `unavailable` | `skipped` in test).
- `GET /health/ready` — PostgreSQL only (storage degradation surfaces on `/health`, not readiness).

## Verification commands

```bash
pnpm --filter @apps/api run build
cd apps/api && node --import tsx --test test/finance/finance-reports.service.unit-spec.ts
cd apps/api && node --import tsx --test test/infra/storage-health.service.unit-spec.ts
pnpm test:e2e:ci
```

## Reports cache

- `GET /finance/reports/summary` cached in Redis 30s per tenant.
- Invalidated on manual payment create, receipt approve/reject, and payment status changes (webhook Paid/Failed, timeout).

## Pilot limitations

- **One pending receipt per payment** — duplicate upload returns `409` `RECEIPT_PENDING_ALREADY_EXISTS_FOR_PAYMENT`.
- **`ledger-events`** lists `finance.ledger.double_entry_applied` for manual receipt approve and online Paid capture; leader-only PATCH paths may still differ.
- **Summary cache** — at most ~30s stale if Redis invalidation fails (falls back to DB on read errors).
- **`/health/ready`** is Postgres-only; MinIO degradation appears on `GET /health` → `dependencies.storage`.
