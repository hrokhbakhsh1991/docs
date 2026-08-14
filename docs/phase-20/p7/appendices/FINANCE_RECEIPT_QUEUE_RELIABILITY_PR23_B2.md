# Receipt queue reliability — scope-before-limit + cursor (PR23-B2)

```yaml
doc_id: FINANCE_RECEIPT_QUEUE_RELIABILITY_PR23_B2
version: "2026-08-09-v1"
status: READY_FOR_REVIEW
phase: PR23-B2
related:
  - docs/phase-20/p7/appendices/FINANCE_RECEIPT_QUEUE_CLARITY_PR23_B1.md
  - packages/finance-core/src/application/finance.service.ts
  - packages/finance-core/src/ports/finance-repository.port.ts
  - packages/finance-http/src/finance.routes.ts
  - apps/web/src/finance/finance-receipts-panel.tsx
locks:
  lifecycle_mutation: forbidden
  approve_reject_ux: frozen
  ownership_sla_bulk: deferred_PR23_B3
  fake_totals: forbidden
  sla_semantics: forbidden
```

## Audit (before)

| Layer | Behavior |
| ----- | -------- |
| UI | `GET /api/finance/receipts/pending?limit=50` (+ optional registration/tour) |
| HTTP | `handleFinancePendingReceipts` → `listPendingReceipts(auth, limit, registrationId?, tourId?)` → `{ items }` |
| Domain | Repository `take(limit)` **then** `filterListRowsByScope` |
| Prisma | `where: Pending`, `orderBy: createdAt asc`, `take: limit` — **no scope in SQL** |
| In-memory | Filter Pending, **unsorted** `slice(0, limit)` |
| Summary | `pendingReceiptReviews` tenant count (not list total for scoped views) |

**Failure mode:** registration-scoped UI could show empty while a matching Pending receipt existed beyond the first global page.

## After (this slice)

### Scope-before-limit

Repository applies:

1. `tenantId` + `status = Pending`
2. `registrationId` and/or `registrationIds` (tour resolved in FinanceService via `RegistrationDisplayPort.listRegistrationIdsByTourId`)
3. Keyset cursor (`createdAt ASC`, `id ASC`)
4. `limit` (+1 probe for `hasMore`)

Invariant: a registration-scoped query returns matching receipts even when they are not in the first global page.

### Pagination contract

```json
{
  "items": [],
  "nextCursor": "… or null",
  "hasMore": false
}
```

- Stable order: `createdAt ASC`, then `id ASC`
- Cursor: opaque keyset (`createdAt` + `id`); no offset pages
- `hasMore === true` iff more rows exist after the returned page
- Aligns with existing cursor/`nextCursor` style used elsewhere in the monorepo; adds explicit `hasMore` for operators

### Presentation (PR23-B1 frozen)

Aging bands, FIFO hint, and honesty copy remain. Load-more uses `nextCursor` / `hasMore`. No invented totals.

## Explicit non-goals

Ownership, SLA, bulk review, approve/reject changes, payment vocabulary, ledger/settlement mutations.

## Status

`READY_FOR_REVIEW`
