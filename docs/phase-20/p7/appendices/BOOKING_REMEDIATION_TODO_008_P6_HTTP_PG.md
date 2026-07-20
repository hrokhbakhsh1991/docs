# TODO-008 — P6 Booking DoD requires HTTP→Postgres

```yaml
doc_id: BOOKING_REMEDIATION_TODO_008_P6_HTTP_PG
status: ACTIVE
date: "2026-07-20"
severity: P1
```

## Problem

`scripts/p6-denali-product-gate.sh` treated memory `bookings-ops.spec.ts` as Booking product proof. Memory cannot certify RLS, capacity TX, or HTTP→Prisma.

## Fix

P6 gate Booking proof is **`pnpm --filter @apps/api run test:booking-http-postgres`** (requires `DATABASE_URL` + migrations). Memory `bookings-ops.spec.ts` remains a fast unit suite outside P6 DoD.

## Gate fragment

```bash
# requires DATABASE_URL (fail closed if unset)
pnpm --filter @apps/api run test:booking-http-postgres
```

## Authority

- `docs/phase-20/p7/appendices/BOOKING_HTTP_POSTGRES_CERT.md`
- CI job `Booking HTTP PostgreSQL` in `.github/workflows/booking-postgres-gate.yml`
