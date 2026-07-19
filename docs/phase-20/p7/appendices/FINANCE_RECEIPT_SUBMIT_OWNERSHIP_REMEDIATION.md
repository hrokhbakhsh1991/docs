# Finance receipt submit — ownership remediation

```yaml
doc_id: FINANCE_RECEIPT_SUBMIT_OWNERSHIP_REMEDIATION
version: "1.0"
date: "2026-07-19"
target: POST /finance/receipts
constraint: existing ports only (IBookingPaymentPort.memberOwnsRegistration)
```

## Audit (pre-fix)

| Concern | Finding |
| ------- | ------- |
| Identity | `resolveTenantContextFromRequest` → `FinanceActorContext` (`userId`, `tenantId`, `role`, `status`, `workspaceId`) |
| Tenant binding | `auth.tenantId` on all repository calls + RLS |
| Workspace binding | `capability.assertEnabled` → workspaceType for composition; not ownership |
| Payment ownership | **Was missing** for members on `submitReceipt` |

## Fix

After `findPaymentById(auth.tenantId, paymentId)`, if actor is **not** admin/owner:

```text
memberOwnsRegistration({ tenantId, registrationId: payment.registrationId, userId })
→ false ⇒ BOOKINGS_FORBIDDEN
```

Operators unchanged (may submit for any in-tenant payment).

## Attack matrix (post-fix)

| Attack | Expected | Result |
| ------ | -------- | ------ |
| Member changes paymentId to another’s | **403** `BOOKINGS_FORBIDDEN` | **PASS** |
| Reuse another user’s payment ID (same tenant) | **403** | **PASS** |
| Cross-tenant payment ID | **404** `FINANCE_PAYMENT_NOT_FOUND` (tenant scope) | **PASS** |
| Missing identity | **401/403** (host auth) | **PASS** |
| Admin submits any in-tenant payment | **201** (operator) | **PASS** |
| Member submits own registration’s payment | **201** | **PASS** |

## Tests

- `packages/finance-core/test/finance-receipt-submit-authz.spec.ts` — 4/4 unit
- `apps/api/test/finance-ops.spec.ts` — AUTHZ-RECEIPT-01..04 (Postgres)
