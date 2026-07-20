# Hostile security audit — finance module

```yaml
audit_id: FINANCE_HOSTILE_SECURITY
version: "1.0"
date: "2026-07-19"
focus: authorization, data exposure, API abuse, admin/audit
method: code evidence (not architecture narrative)
```

## Executive verdict

| Area | Verdict |
| ---- | ------- |
| Operator vs member role split | **Mostly solid** for reports / approve / create payment |
| Member receipt paths | **Mitigated** — booking binary upload checks ownership **before** `putMemberReceiptProof` (MR-P0-010); `POST /finance/receipts` requires `memberOwnsRegistration` for members |
| Cross-tenant data | **PASS** on Prisma+RLS (known caveats) |
| Idempotency / replay | **Strong** for create/approve/submit; **reject gap** |
| Admin audit trail | **Weak** — reviewer id only; no immutable finance audit log |

**Top severity:** **P0** same-tenant receipt IDOR via `POST /finance/receipts` for any `member` with a payment UUID.

---

## Authorization

### Who can create payment?

| Gate | Evidence |
| ---- | -------- |
| Capability | `FinanceService.gate` → `capability.assertEnabled` → module + supported workspace |
| Authz | `authorization.assertOperatorAccess` → **admin \| owner** only (`assert-finance-access.ts`) |
| HTTP | `POST /finance/payments/manual` → `createManualPayment` |

Members → `FORBIDDEN_OPERATOR_FORBIDDEN`. Test: `API-9.7-04` covers summary 403 for member (same assertOperatorAccess family).

**Gaps:** No check that `registrationId` exists as a booking in-tenant before insert (orphan payment integrity). Amount is unbounded digit string (no max minor units).

### Who can approve?

| Gate | Evidence |
| ---- | -------- |
| Authz | `assertOperatorAccess` (admin/owner) on `reviewReceipt` |
| HTTP | `PATCH /finance/receipts/:id/review` with `decision: approve` |
| Idempotency | Required for approve; HTTP + business replay |

Members cannot approve. Concurrent approve → `FINANCE_APPROVE_CONFLICT` → safe replay if winner committed.

### Who can submit receipt?

| Path | Who | Ownership check? |
| ---- | --- | ---------------- |
| `POST /bookings/:id/receipt` → `submitMemberReceiptForRegistration` | Session user (member intended) | **Yes** — `memberOwnsRegistration` (`submittedByUserId === userId`) |
| `POST /finance/receipts` → `submitReceipt` | **admin \| owner \| member** (`assertReceiptSubmitAccess`) | **Yes for members** — `memberOwnsRegistration` on `payment.registrationId` after load; operators skip |

**Mitigated (was P0):** Members cannot attach proofs to another registration’s payment. See `FINANCE_RECEIPT_SUBMIT_OWNERSHIP_REMEDIATION.md`.

Evidence:

```15:17:packages/finance-core/src/ports/finance-access.port.ts
export interface FinanceAuthorizationPort {
  assertOperatorAccess(auth: FinanceActorContext): void;
  assertReceiptSubmitAccess(auth: FinanceActorContext): void;
}
```

```50:57:apps/api/src/workspace-finance/assert-finance-access.ts
export function assertFinanceReceiptSubmitAccess(auth: TenantAuthContext): void {
  if (!isAuthzGranted(auth)) {
    throw new Error("FORBIDDEN_OPERATOR_FORBIDDEN");
  }
  if (!isAdminOrOwner(auth) && auth.role !== "member") {
    throw new Error("FORBIDDEN_OPERATOR_FORBIDDEN");
  }
}
```

```329:357:packages/finance-core/src/application/finance.service.ts
  async submitReceipt(...) {
    await this.gate(auth);
    this.authorization.assertReceiptSubmitAccess(auth);
    // ... findPaymentById(auth.tenantId, body.paymentId) — no memberOwns*
```

Contrast (safe path):

```368:378:packages/finance-core/src/application/finance.service.ts
    const owns = await this.bookingPayments.memberOwnsRegistration({...});
    if (!owns) {
      throw new Error("BOOKINGS_FORBIDDEN");
    }
```

Test coverage: `P6-MR-02` blocks foreign member on **booking** route; **no** hostile test that member `POST /finance/receipts` with another’s `paymentId` is denied.

### Workspace permission boundaries

| Control | Behavior |
| ------- | -------- |
| Unsupported workspace | `FINANCE_WORKSPACE_UNSUPPORTED` |
| Module disabled | `FORBIDDEN_FINANCE_MODULE_DISABLED` (`API-9.7-02`) |
| Role model | Binary: operator (admin/owner) vs receipt-submit (member+) — **no** finance-specific RBAC (viewer, accountant, approver) |
| Web nav | Ops panels / tabs — UX only; **not** API enforcement |

**P1:** No separation of “create payment” vs “approve” vs “view ledger” among operators — any admin/owner is full finance god-mode.

---

## Data

### Tenant leakage

| Check | Verdict | Evidence |
| ----- | ------- | -------- |
| Prisma reads/writes | **PASS** | `withTenantRls` + most `where: { tenantId }` |
| Cross-tenant approve IDEM | **PASS** | `APPROVE-IDEM-04` |
| Receipt proof read | **PASS** | `assertMemberReceiptProofKeyScope` prefix `receipts/{tenantId}/` |
| Memory `listLedgerEvents` | **FAIL** if memory driver | Prior isolation audit P0 |
| `updateReceiptReview` by id | **P1** | `where: { id: receiptId }` relies on FORCE RLS |

### ID guessing

| Resource | ID type | Risk |
| -------- | ------- | ---- |
| Payment / receipt | UUID v4 | Hard to brute-force; **still fatal if leaked** (logs, URLs, list APIs) with member IDOR above |
| Registration | UUID | Same |

Enum/list: operators can list open payments / pending receipts (intended). Members must not call those (operator assert) — **except** if they abuse submit IDOR after learning payment id another way.

### Sensitive financial data exposure

| Surface | Data | Risk |
| ------- | ---- | ---- |
| Operator lists | amount, currency, status, `fileKey`, registration display (tour + guest label) | Expected for operators; **no field-level redaction** |
| `GET .../receipts/:id/url` | Signed URL (300s TTL) or fallback `/internal/finance/receipts/...` | Operator-only; fallback path is sensitive if internal routes are reachable |
| `POST /finance/receipts` body | Client-supplied `fileKey` (max 512) | **P1** — no write-time scope check; can store arbitrary key string; read later fails if wrong tenant prefix |
| Ledger list | Full `lines[]` in payload | Operator-only; accounting detail |

---

## API

### Replay attacks

| Operation | Protection |
| --------- | ---------- |
| Create manual payment | HTTP idempotency (`tenantId`+key+requestHash) + `creationIdempotencyKey` hash + conflict if body differs |
| Submit receipt (HTTP) | Same + optional `idempotencyKeyHash` on receipt |
| Approve | Required Idempotency-Key; completed replay; in-progress poll |
| Reject | **No** HTTP idempotency wrapper |

Replay of completed approve/create with same key+body → safe. Same key different body → `IDEMPOTENCY_PAYLOAD_MISMATCH` / finance conflict codes.

### Idempotency abuse

| Mode | Outcome |
| ---- | ------- |
| Flood distinct keys | Creates many payments/receipts (rateLimit write only) — **P2** DoS/storage |
| Key reclaim after stale processing | Intentional retry; tests cover reclaim |
| Cross-tenant same key | Isolated by `tenantId` in idempotency store |

### Race conditions

| Race | Outcome |
| ---- | ------- |
| Double approve | `updateMany` Pending guards → conflict → winner replay |
| Approve vs reject | Service checks Pending then reject uses non-conditional `update` by id — **P1** TOCTOU; reject may not use `updateMany`+Pending |
| Double pending receipt | `pendingCount > 0` guard |
| Empty `ledgerCapture.lines` | Paid/Approved **without** outbox enqueue — **P0 integrity** (malicious/buggy adapter = silent non-ledger) |

---

## Admin

### Dangerous operations

| Op | Who | Danger |
| -- | --- | ------ |
| Approve receipt | admin/owner | Marks Paid, syncs booking, may enqueue ledger |
| Record prepayment | admin/owner | Money movement + outbox |
| Retry booking sync | admin/owner | Compensating sync |
| Generate/overwrite schedules | admin/owner | Installment plan mutation |
| Create manual payment | admin/owner | Arbitrary amount/registrationId (no booking FK) |
| Member `POST /finance/receipts` | member | **IDOR attach proof** (above) |

No soft-delete / void / reverse-payment HTTP surface found in finance-http manifest (reduces blast radius; also limits legitimate correction paths).

### Missing audit trail

| Present | Missing |
| ------- | ------- |
| `reviewedByUserId` / `reviewedAt` / `reviewNote` on receipt | Dedicated immutable `FinanceAuditEvent` (who/what/before/after) |
| Pino `HostFinanceLogAdapter` warn/error | Structured audit on create payment, reject, prepayment, schedule generate |
| Outbox domain events | Operator action log queryable for compliance |

**P1:** Hostile admin actions (approve wrong receipt, invent prepayment) leave thin forensic trail.

---

## Severity ranking

### P0 — fix before hostile production trust

1. **Same-tenant receipt IDOR** — `POST /finance/receipts` allows `member` without payment/registration ownership. Evidence: `assertReceiptSubmitAccess` + `submitReceipt` without `memberOwnsRegistration`. Fix direction: operator-only on this route **or** require ownership for members (prefer operator-only; members use booking route).
2. **Empty ledger lines → Paid without ledger outbox** — integrity / fraud via adapter. Evidence: `approveManualReceiptAtomic` only enqueues when `lines.length > 0`.

### P1

1. No fine-grained operator RBAC (approve vs view vs create).
2. `updateReceiptReview` / some updates by primary key rely solely on RLS.
3. Reject path lacks HTTP idempotency; TOCTOU vs approve.
4. `fileKey` accepted without write-time tenant/registration scope assert.
5. Create payment without verifying registration exists in tenant.
6. No immutable finance audit log for admin mutations.
7. Header-only auth ingress trusts role headers when no Bearer/cookie (`require-operator-session.ts`) — **P0 if API edge does not strip** in prod.

### P2

1. Unbounded payment/prepayment amount (digit string only).
2. Idempotency key flood → storage growth.
3. Operator list responses include full `fileKey` + ledger lines (needful but sensitive).
4. Web finance nav is not a security boundary.

---

## Direct answers

| Question | Answer |
| -------- | ------ |
| Who can create payment? | **admin/owner** + finance module enabled |
| Who can approve? | **admin/owner** |
| Who can submit receipt? | **Safe:** owner of registration via bookings route. **Unsafe:** any tenant **member** via `POST /finance/receipts` |
| Workspace boundaries? | Supported type + module flag; not per-permission finance RBAC |
| Tenant leakage? | Prisma path OK; memory ledger list / RLS-off updates are the failure modes |
| ID guessing? | UUIDs hard; IDOR makes leak catastrophic within tenant |
| Sensitive exposure? | Operator-appropriate; `fileKey` + signed URLs need careful routing |
| Replay / idempotency? | Strong for create/submit/approve; reject weaker |
| Races? | Approve races handled; empty ledger + reject TOCTOU remain |
| Admin danger / audit? | Full god-mode for admins; audit trail thin |

---

## Evidence index

| Artifact | Path |
| -------- | ---- |
| Authz rules | `apps/api/src/workspace-finance/assert-finance-access.ts` |
| Host adapter | `apps/api/src/workspace-finance/infrastructure/host-finance-access.adapter.ts` |
| Service gates | `packages/finance-core/src/application/finance.service.ts` |
| HTTP handlers | `packages/finance-http/src/finance.routes.ts` |
| Route map | `apps/api/src/http/workspace-http-routes.generated.ts` |
| Member-safe upload | `apps/api/src/bookings/bookings.routes.ts` (`handlePostBookingReceipt`) |
| Proof key scope | `apps/api/src/workspace-finance/receipt-proof-storage.ts` |
| Approve TX / empty lines | `apps/api/src/workspace-finance/infrastructure/prisma-finance.repository.ts` |
| Idempotency | `apps/api/src/http/http-idempotency.ts` |
| Member summary 403 | `apps/api/test/finance-ops.spec.ts` `API-9.7-04` |
| Member ownership tests | `apps/api/test/p6-member-receipt-flow.spec.ts` `P6-MR-02` |
