# P7 — Receipt upload + MinIO on staging (VS-05 / VS-07)

```yaml
runbook_id: P7-RECEIPT-MINIO-STAGING
vs: [VS-05, VS-07]
nano: P7-3-N-002 · P7-2-N-007
authority: PAYMENT-LEDGER-BOUNDARY.md · finance-ops.spec.ts
```

---

## Chain

```text
Portal multipart → BFF fileKey → POST /bookings/{id}/receipts
  → MinIO object store
  → finance pending tab → operator PATCH review → ledger outbox (Postgres T3)
```

Payment ingress only — ledger spine unchanged per [PAYMENT-LEDGER-BOUNDARY.md](../appendices/PAYMENT-LEDGER-BOUNDARY.md).

---

## VPS env (`/etc/app-tour/api.env`)

```bash
STORAGE_DRIVER=prisma
MINIO_ENDPOINT=http://127.0.0.1:9002
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
MINIO_BUCKET=app-tour-prod
```

Verify MinIO listening:

```bash
curl -fsS http://127.0.0.1:9002/minio/health/live
```

---

## Manual proof (VS-05)

1. Portal register + `/me/registrations` (VS-04)
2. Upload receipt on registration detail
3. Expect `201` from BFF · receipt row `Pending`

Spec reference: `portal-member-smoke.spec.ts` SMK-PTL-04 (localhost) · [p7-staging-e2e.md](p7-staging-e2e.md) on staging URLs.

---

## Operator proof (VS-07)

1. Admin `/finance` → pending receipts tab
2. Approve receipt · finance summary updates

E2E: `p6-operator-receipt-approve-smoke.spec.ts` SMK-P6-ADM-02  
API depth: `finance-ops.spec.ts` (T3 — requires `DATABASE_URL`)

```bash
export DATABASE_URL=postgresql://app_tour:...@127.0.0.1:5433/tour_db_prod
pnpm --filter @apps/api exec node --import tsx --test test/finance-ops.spec.ts
```

Or: `pnpm run p7:staging-gate` with `DATABASE_URL` set.

---

## Failure triage

| Symptom | Check |
| ------- | ----- |
| Upload 500 | MinIO creds · bucket exists · API logs `minio` |
| Receipt not in finance | `STORAGE_DRIVER=prisma` not memory · wrong tenant |
| T3 fails | migrations `008_finance_payments_delta.sql` applied |
| VS-07 E2E fail fa-IR | expect `تأییدشده` not `approved` |

---

## References

- [FINANCE-OPS-P6-NOTE.md](../../phase-19/p6/appendices/FINANCE-OPS-P6-NOTE.md)
- [P7-FINANCE-PATH-BOUNDARY.md](../appendices/P7-FINANCE-PATH-BOUNDARY.md)
