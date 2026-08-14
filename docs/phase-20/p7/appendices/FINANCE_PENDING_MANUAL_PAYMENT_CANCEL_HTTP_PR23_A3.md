# Pending manual payment cancel — HTTP boundary (PR23-A3)

```yaml
doc_id: FINANCE_PENDING_MANUAL_PAYMENT_CANCEL_HTTP_PR23_A3
version: "2026-08-09-v1"
status: IMPLEMENTED
phase: PR23-A3
related:
  - docs/phase-20/p7/appendices/FINANCE_PENDING_MANUAL_PAYMENT_CANCEL_PR23_A2.md
  - packages/finance-http/src/finance.routes.ts
  - packages/finance-http-contracts/src/finance-request.schemas.ts
locks:
  finance_service_mutation_authority: true
  http_transport_only: true
  ui_in_this_pr: forbidden
  reuse_failed_for_abandon: forbidden
```

## Principle

**HTTP is transport only; FinanceService owns cancellation semantics.**

The API handler validates the request envelope, resolves auth/tenant context, forwards to
`FinanceService.cancelPendingManualPayment`, and maps domain errors to HTTP. It must not
re-implement debt-gate, receipt guards, status transitions, or audit writes.

## Route contract

```http
POST /finance/payments/:paymentId/cancel
Idempotency-Key: <required>
Content-Type: application/json

{
  "reasonCode": "abandoned" | "wrong_amount" | "superseded" | "other",
  "reasonNote": "<optional string; required by domain when reasonCode=other>"
}
```

### Success `200`

```json
{
  "paymentId": "<uuid>",
  "status": "Cancelled",
  "cancellationEventId": "payment-cancelled:<paymentId>",
  "occurredAt": "<ISO-8601>",
  "reasonCode": "abandoned",
  "replay": false
}
```

Omitted from the public envelope: outbox row internals, repository fields, ledger ids,
booking mutation fields, full audit payload blob.

### Headers

- Existing session/auth (operator) — unchanged
- `Idempotency-Key` — required (same write pattern as create manual payment)

## Error mapping

| Domain error | HTTP | Client `code` / `error` |
| ------------ | ---- | ----------------------- |
| `PAYMENT_NOT_FOUND` | 404 | `PAYMENT_NOT_FOUND` |
| `PAYMENT_NOT_IN_SCOPE` | 404 | `PAYMENT_NOT_FOUND` (no tenant leak) |
| `PAYMENT_CANCEL_ONLY_MANUAL` | 409 | `PAYMENT_CANCEL_ONLY_MANUAL` |
| `PAYMENT_NOT_CANCELLABLE` | 409 | `PAYMENT_NOT_CANCELLABLE` |
| `PAYMENT_HAS_PENDING_RECEIPT` | 409 | `PAYMENT_HAS_PENDING_RECEIPT` |
| `PAYMENT_CANCEL_REASON_INVALID` | 400 | `PAYMENT_CANCEL_REASON_INVALID` |
| Zod transport shape | 400 | `ZOD_VALIDATION_FAILED` |
| Missing Idempotency-Key | 400 | existing `IDEMPOTENCY_KEY_REQUIRED` |

## Security boundary

- Operator access enforced inside FinanceService (existing authorization port)
- Tenant id only from auth context — never from body
- Cross-tenant payment id → `404 PAYMENT_NOT_FOUND`
- No new roles in this PR

## Idempotency

1. First call with key K: domain `Pending → Cancelled`, HTTP stores response under K
2. Replay same K + same body hash: HTTP returns stored `200` (may include `replay: true` from domain on later domain calls)
3. Domain still treats already-`Cancelled` as idempotent success (`replay: true`)
4. `Cancelled → Paid` remains impossible (approve requires `Pending`)

## Examples

### Cancel abandoned intent

```bash
curl -X POST "$API/finance/payments/$PAYMENT_ID/cancel" \
  -H "Authorization: Bearer …" \
  -H "Idempotency-Key: cancel-$PAYMENT_ID-1" \
  -H "Content-Type: application/json" \
  -d '{"reasonCode":"abandoned"}'
```

### Blocked by pending receipt

Domain throws `PAYMENT_HAS_PENDING_RECEIPT` → HTTP **409**. Operator must reject/approve the receipt first (no auto-reject).

## Out of scope (PR23-A4 UI)

- Payments list Cancel button
- Cancelled vocabulary / i18n
- Confirmation modal / reason UX
