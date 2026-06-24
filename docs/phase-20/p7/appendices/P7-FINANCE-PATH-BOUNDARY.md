# P7 — Finance code path boundary

```yaml
boundary_id: P7-FINANCE-PATH-BOUNDARY
pack_version: "1.6"
authority: PAYMENT-LEDGER-BOUNDARY.md · p7:gate
```

> Which finance module to edit during P7 — avoid fixing the wrong tree.

---

## Rule (normative)

| Path | P7 policy | Gate proof |
| ---- | --------- | ---------- |
| `apps/api/src/workspace-finance/` | **EDIT HERE** for P7 finance fixes | `finance-ops.spec.ts` · `p6:gate` |
| `apps/api/src/denali-finance/` | **DO NOT EDIT** in P7 | legacy parallel tree |

`createFinanceRepository()` in `workspace-finance/finance.repository.ts` selects Postgres vs memory via `STORAGE_DRIVER`.

---

## Staging requirement

```bash
STORAGE_DRIVER=prisma
DATABASE_URL=postgresql://...
```

Never enable `InMemoryFinanceRepository` on staging to "unblock" T3.

---

## VS mapping

| VS | Surface |
| -- | ------- |
| VS-05 | Portal receipt ingress → workspace finance receipts |
| VS-07 | Operator review → `PATCH /finance/receipts/{id}/review` + ledger outbox |

Runbook: [p7-receipt-minio-staging.md](../runbooks/p7-receipt-minio-staging.md)

---

## References

- [PAYMENT-LEDGER-BOUNDARY.md](PAYMENT-LEDGER-BOUNDARY.md)
- [IMPLEMENTATION-TRUTH-P7.md](IMPLEMENTATION-TRUTH-P7.md)
