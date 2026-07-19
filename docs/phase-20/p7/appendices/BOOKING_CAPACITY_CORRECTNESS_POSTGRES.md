# Booking Capacity Correctness — PostgreSQL Proof

```yaml
doc_id: BOOKING_CAPACITY_CORRECTNESS_POSTGRES
status: SUPERSEDED_BY
superseded_by: BOOKING_CAPACITY_CONCURRENCY_CERT
date: "2026-07-20"
```

Canonical concurrency model + stress certification:

[`BOOKING_CAPACITY_CONCURRENCY_CERT.md`](./BOOKING_CAPACITY_CONCURRENCY_CERT.md)

Legacy scenario harness (A–E) remains as `pnpm run test:booking-capacity-postgres`.
Stress: `pnpm run test:booking-capacity-stress` (≥100 iterations, hundreds of concurrent ops).
