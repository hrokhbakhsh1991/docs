# Hostile finance authorization — member-facing matrix

```yaml
audit_id: FINANCE_HOSTILE_AUTHORIZATION
version: "1.1"
date: "2026-07-19"
focus: member-facing finance APIs; POST /finance/receipts
remediation: FINANCE_RECEIPT_SUBMIT_OWNERSHIP_REMEDIATION.md
```

## Direct answers

| # | Question | Verdict |
| - | -------- | ------- |
| 1 | Can member submit receipt for another payment via `POST /finance/receipts`? | **NO** (ownership via `memberOwnsRegistration`) |
| 2 | Can tenant A access tenant B finance data (Prisma path)? | **NO** (auth.tenantId + RLS) |
| 3 | Can workspace policy leak across tenants concurrently? | **NO** (service cached by type; request uses bound ports) |
| 4 | Admin/member separation | **Pass** — approve/view operator-only; receipt submit: member own-registration only |
| 5 | UUID guessing | Hard to brute; ownership gate no longer relies on secrecy of paymentId |

---

## Protection model (as coded)

| Layer | Rule |
| ----- | ---- |
| Capability | `assertEnabled(tenantId)` — supported workspace + finance module |
| Operator | `assertOperatorAccess` → **admin \| owner**, ACTIVE |
| Receipt submit (generic) | `assertReceiptSubmitAccess` → **admin \| owner \| member** (member needs `workspaceId`) |
| Member ownership (after payment load) | Non-operator → `memberOwnsRegistration({ tenantId, registrationId: payment.registrationId, userId })` or `BOOKINGS_FORBIDDEN` |
| Member-safe receipt | `submitMemberReceiptForRegistration` → + `memberOwnsRegistration` (`submittedByUserId === userId`) |
| Data | `auth.tenantId` on reads/writes + `withTenantRls` |

---

## Endpoint matrix

Legend — **Actor**: intended caller. **Risk**: IDOR / over-privilege / leak.

| Endpoint | Actor | Required permission (intended) | Current protection | Risk |
| -------- | ----- | ------------------------------ | ------------------ | ---- |
| `POST /finance/receipts` | member / admin | Own payment **or** operator | `assertReceiptSubmitAccess` + member `memberOwnsRegistration` on `payment.registrationId`; operators skip ownership | **Mitigated** (was P0 IDOR) |
| `POST /bookings/:id/receipt` | Member (own booking) | Own registration | Session + `memberOwnsRegistration` | **Low** — foreign member denied (`BOOKINGS_FORBIDDEN`); tested P6-MR-02 |
| `GET /bookings/:id/receipt/status` (member status) | Member | Own registration | Session + `memberOwnsRegistration` | **Low** |
| `GET /finance/reports/summary` | admin/owner | Operator | `assertOperatorAccess` | **Low** (member → 403; API-9.7-04) |
| `GET /finance/reports/open-payments` | admin/owner | Operator | `assertOperatorAccess` | **Low** |
| `GET /finance/reports/ledger-events` | admin/owner | Operator | `assertOperatorAccess` | **Low** |
| `GET /finance/payments` | admin/owner | Operator | `assertOperatorAccess` | **Low** |
| `POST /finance/payments/manual` | admin/owner | Operator | `assertOperatorAccess` | **Low** (member blocked) |
| `GET /finance/receipts/pending` | admin/owner | Operator | `assertOperatorAccess` | **Low** |
| `PATCH /finance/receipts/:receiptId/review` | admin/owner | Operator (approve/reject) | `assertOperatorAccess` | **Low** for members; any admin is full approver (no finer RBAC) |
| `GET /finance/receipts/:receiptId/url` | admin/owner | Operator | `assertOperatorAccess` + receipt in tenant | **Low** cross-tenant; **Medium** if receiptId leaked to another admin same tenant (expected) |
| `GET /finance/prepayments` | admin/owner | Operator | `assertOperatorAccess` | **Low** |
| `POST /finance/prepayments` | admin/owner | Operator | `assertOperatorAccess` | **Low** |
| `GET /finance/prepayments/booking-sync-degraded` | admin/owner | Operator | `assertOperatorAccess` | **Low** |
| `POST /finance/prepayments/booking-sync-retry` | admin/owner | Operator | `assertOperatorAccess` | **Low** |
| `GET /finance/invoices/:registrationId` | admin/owner | Operator | `assertOperatorAccess` | **Low** (no member invoice API here) |
| `GET /finance/schedules` | admin/owner | Operator | `assertOperatorAccess` | **Low** |
| `GET /finance/schedules/:registrationId` | admin/owner | Operator | `assertOperatorAccess` | **Low** |
| `POST /finance/schedules/generate` | admin/owner | Operator | `assertOperatorAccess` | **Low** |

---

## Verify details

### 1. Resource ownership — `POST /finance/receipts`

```text
submitReceipt:
  gate(tenant)
  assertReceiptSubmitAccess  // member OK with workspaceId
  findPaymentById(tenantId, body.paymentId)
  if role not admin|owner:
    memberOwnsRegistration(tenantId, payment.registrationId, userId)
      else BOOKINGS_FORBIDDEN → HTTP 403
  createReceipt(...)
```

Member path `submitMemberReceiptForRegistration` still checks ownership **before** create/submit (unchanged).

### 2. Tenant isolation

| Path | Result |
| ---- | ------ |
| Prisma HTTP | `auth.tenantId` + RLS — cross-tenant **blocked** |
| Same payment UUID in tenant B | Not visible under tenant A session → `FINANCE_PAYMENT_NOT_FOUND` |
| Memory ledger list | Out of scope for prod; known FAIL if memory used |

### 3. Workspace isolation

Policy/adapters bound per `workspaceType` on cached `FinanceService`. Concurrent A/B/C does not swap policy mid-request. Wrong `tenants.workspace_type` → wrong product rules for that tenant (data error, not cross-tenant leak).

### 4. Admin / member separation

| Action | Member | admin/owner |
| ------ | ------ | ----------- |
| Approve / reject | Denied | Allowed |
| View reports / lists / ledger / proof URL | Denied | Allowed |
| Submit via bookings route | Own only | N/A (operators use `/finance/*`) |
| Submit via `POST /finance/receipts` | **Own registration payment only** | Allowed in-tenant |

No finance-specific roles (viewer / accountant / approver-only).

### 5. ID guessing

| ID | Entropy | Exposure path |
| -- | ------- | ------------- |
| paymentId / receiptId | UUID | Operator lists, responses, logs; member denied without ownership |
| registrationId | UUID | Booking URLs; member status/upload scoped by ownership |

Brute-force impractical; **authorization does not rely on secrecy of paymentId**.

---

## Attack simulation PASS/FAIL

| Attack | Expected | Result | Proof |
| ------ | -------- | ------ | ----- |
| Change / reuse another user's `paymentId` (same tenant) | 403 `BOOKINGS_FORBIDDEN` | **PASS** | `finance-receipt-submit-authz.spec.ts` + AUTHZ-RECEIPT-02 |
| Cross-tenant `paymentId` | 404 `FINANCE_PAYMENT_NOT_FOUND` | **PASS** | AUTHZ-RECEIPT-03 + core cross-tenant case |
| Missing identity | 401/403 | **PASS** | AUTHZ-RECEIPT-04 |
| Expired / inactive session | Denied by auth middleware | **PASS** (platform ingress; unchanged) |
| Positive own payment | 201 | **PASS** | AUTHZ-RECEIPT-01 + core positive |
| Admin bypass ownership | 201 in-tenant | **PASS** | core admin case |

---

## P0 / P1

| Pri | Finding |
| --- | ------- |
| ~~**P0**~~ | ~~Member IDOR on `POST /finance/receipts`~~ → **Mitigated** (v1.1) |
| **P1** | No fine-grained operator RBAC (all admins approve + view all) |
| **P2** | Header-only auth ingress trusts role when no Bearer (platform edge must strip) |
