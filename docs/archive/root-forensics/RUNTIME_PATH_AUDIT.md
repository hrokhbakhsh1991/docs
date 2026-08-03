# RUNTIME_PATH_AUDIT

```yaml
audit_id: RUNTIME_PATH_AUDIT
role: Senior Backend Engineer — Hostile Runtime Path Audit
date: "2026-07-20"
method: code execution tracing only (docs ignored)
sha_context: working tree on booking/capacity-concurrency-cert @ f6a820a1 + dirty remediations
```

## Canonical paths traced

```text
BOOKING OPS
  HTTP /bookings* → app.ts → bookings.routes → requireOperatorSession
    → create-bookings-service façade → resolveBookingWorkspaceTypeForTenant
    → BookingRuntime.service → PrismaBookingsRepository|InMemory
    → withTenantRls → operator_registrations (+ outbox_events)
    → optional invokeApproveReaction (in-process only)

BOOKING PUBLIC
  Denali/registration → HostBookingPublicAdapter.createPendingBooking
    → createPublicGuestBooking (role:"none") → executeCreatePipeline → repository

PAYMENTS / RECEIPTS
  HTTP /bookings/:id/receipts → FinanceService (finance-core)
    → BookingPaymentAdapter → getBookingsRepository()  [BYPASSES BookingsService]
  HTTP /finance/* → generated handlers → FinanceService
    → PrismaFinanceRepository.approveManualReceiptAtomic → raisePaidInTx

IDENTITY
  requireOperatorSession → resolveTenantContextFromRequest → hydrateMembershipFromDb(sess_ver=undefined)

TENANT / WORKSPACE
  resolveWorkspaceTypeForTenant → resolveRegisteredTenantById (admin pool / cache / DEV_TENANTS)
    → booking|finance filters (isBookingSupportedWorkspace / isFinanceSupportedWorkspace)

OUTBOX
  enqueueOutboxEvent (same TX as aggregate) → claimPendingOutboxBatch (ADMIN prisma, SKIP LOCKED)
    → publish (only if OUTBOX_RELAY_ENABLED)
```

---

## Findings

### F-01 — Finance/booking payment projection bypasses `BookingsService`

| Field | Detail |
| ----- | ------ |
| **Severity** | **P0** |
| **Evidence** | `BookingPaymentAdapter.syncStatus` / `raisePaidInTx` / `getPaymentStatus` / `memberOwnsRegistration` in `apps/api/src/workspace-finance/infrastructure/booking-payment.adapter.ts` call `getBookingsRepository()` directly. Composition: `apps/api/src/boot/lazy-finance-service.ts` `getPlatformBookingPayments()`. Service sync: `packages/finance-core/src/application/finance.service.ts` `raiseBookingPaymentStatus` → `bookingPayments.syncStatus`. |
| **Runtime impact** | Payment status mutations skip booking capability gates, tenant↔workspace binding asserts on the service, authorization port, and any future domain invariants on `BookingsService`. Second write authority on `operator_registrations.payment_status`. |
| **Recommended fix** | Inject a narrow `BookingPaymentProjectionPort` implemented by `BookingsService` (or a dedicated application service that still runs binding + authz policy). Forbid finance packages from importing `create-bookings-repository`. |
| **Verification** | Depcruise/guard: `workspace-finance` + `finance-core` must not import `create-bookings-repository`. Spec: receipt approve fails closed when booking runtime binding mismatches. |

---

### F-02 — `raisePaidInTx` updates registration by primary key only

| Field | Detail |
| ----- | ------ |
| **Severity** | **P0** |
| **Evidence** | `BookingPaymentAdapter.raisePaidInTx` (`booking-payment.adapter.ts`): `findFirst({ id, tenantId })` then `operatorRegistration.update({ where: { id: registrationId } })` — **no `tenantId` in update where**. Same pattern in `PrismaBookingsRepository.updatePaymentStatus` (`prisma-bookings.repository.ts` ~553–557). Contrast: `approveManualReceiptAtomic` correctly uses `payment.updateMany({ id, tenantId, status })`. |
| **Runtime impact** | Relies entirely on RLS `app.current_tenant_id`. If RLS mis-set, session var missing, or admin/bypass client used, cross-tenant payment projection write is possible. Defense-in-depth absent. |
| **Recommended fix** | Always `update`/`updateMany` with `{ id, tenantId }` (and expected `paymentStatus` CAS where applicable). |
| **Verification** | Adversarial test: wrong-tenant TX session + victim registration UUID → 0 rows / error. Static grep ban on `operatorRegistration.update({ where: { id:` without tenantId. |

---

### F-03 — Binary receipt upload writes object storage before ownership check

| Field | Detail |
| ----- | ------ |
| **Severity** | **P0** |
| **Evidence** | `handlePostBookingReceipt` in `bookings.routes.ts` ~270–291: `putMemberReceiptProof({ tenantId, registrationId: bookingId, ... })` **then** `financeService.submitMemberReceiptForRegistration` which checks `memberOwnsRegistration`. |
| **Runtime impact** | Authenticated callers can force object writes for arbitrary `bookingId` in-tenant before `BOOKINGS_FORBIDDEN`. Orphan objects, storage cost DoS, possible key enumeration side effects. |
| **Recommended fix** | Check ownership (or ops role policy) **before** `putMemberReceiptProof`; or upload to staging key then attach after authz. |
| **Verification** | Integration: member A uploads for member B’s bookingId → no object created (or deleted), HTTP 403. |

---

### F-04 — Operator session hydrate never passes `sessionVersion`

| Field | Detail |
| ----- | ------ |
| **Severity** | **P0** |
| **Evidence** | `requireOperatorSession` (`identity/require-operator-session.ts` ~67–68): `hydrateMembershipFromDb(auth.userId, auth.tenantId, undefined)`. Hydrate compares claim only when defined (`hydrate-membership.ts` ~45–49). |
| **Runtime impact** | Role revoke / session bump in DB does not invalidate outstanding JWTs until expiry. Booking + finance operator routes trust stale JWT role after hydrate “success” with ignored version. |
| **Recommended fix** | Parse `sess_ver` / `sessionVersion` from JWT; pass into hydrate; reject mismatch as `AuthTokenRevokedError`. |
| **Verification** | Bump `session_version` in DB mid-test → next `/bookings` approve returns 401 revoked. |

---

### F-05 — Header-only auth ingress skips membership hydrate

| Field | Detail |
| ----- | ------ |
| **Severity** | **P0** (non-production) / **P1** (misdeploy) |
| **Evidence** | `requireOperatorSession`: `headerOnlyIngress` when no Authorization/cookie → returns `resolveTenantContextFromRequest` result **without** hydrate (`require-operator-session.ts` ~57–64). Kernel allows header auth when not production (`tenant-kernel.ts` ~69–73). Production requires bearer (`~37–38`). |
| **Runtime impact** | Any process with `NODE_ENV≠production` accepts `x-user-id` / `x-tenant-id` / role headers as identity. Staging “prodlike” clusters are forgeable. |
| **Recommended fix** | Restrict header ingress to `NODE_ENV=test` only (or mTLS gateway that strips headers). |
| **Verification** | Boot matrix: `development` + header auth → reject; `test` → allow. |

---

### F-06 — Dual SoT: memory repositories share production composition root

| Field | Detail |
| ----- | ------ |
| **Severity** | **P0** |
| **Evidence** | `getBookingsRepository` / `createTourStorageRepository` / `createFinanceRepository` switch on `resolveStorageDriver()` → `InMemory*` when not prisma. In-memory booking path has **no** `pg_advisory_xact_lock` (lock only in `prisma-bookings.repository.ts` `acquireTourCapacityLock`). Harness on committed SHA can skip production storage assert. |
| **Runtime impact** | Capacity races “pass” in memory; HTTP gates historically green on fake SoT; prodlike misconfig runs without RLS/locks. |
| **Recommended fix** | Fail-closed: memory driver illegal unless `NODE_ENV=test`. Split test DI from production composition. |
| **Verification** | Boot `NODE_ENV=production` + `STORAGE_DRIVER=memory` throws. Capacity race test must refuse memory driver. |

---

### F-07 — Guest duplicate rule is check-then-act without DB uniqueness

| Field | Detail |
| ----- | ------ |
| **Severity** | **P1** |
| **Evidence** | `findGuestBookingDuplicateMatch` → `findActiveGuestDuplicate` (`prisma-bookings.repository.ts` ~330–400) is `findFirst` only. `createBooking` does not re-check duplicate under capacity lock. No `@@unique` on `(tenantId, tourId, guestEmail)` for `OperatorRegistration` (contrast urban registration unique). Public adapter exposes four find* wrappers (`host-booking-public.adapter.ts`). |
| **Runtime impact** | Concurrent public creates → duplicate active bookings for same guest/email/nationalId. Application rule appears enforced; PostgreSQL does not. |
| **Recommended fix** | Partial unique indexes (active statuses) + catch P2002 in create; or duplicate assert inside locked TX. |
| **Verification** | Parallel two creates same email → one 201, one conflict. |

---

### F-08 — Authz is role-string only (no CASL / capability on booking HTTP)

| Field | Detail |
| ----- | ------ |
| **Severity** | **P1** |
| **Evidence** | `HostBookingAuthorizationAdapter.assertOpsAccess`: `role !== admin && role !== owner` → forbid. Used by list(ops)/summary/create/approve/… Finance: `assertFinanceOperatorAccess` same pattern (`assert-finance-access.ts`). |
| **Runtime impact** | Any JWT/membership with `admin`/`owner` gets full booking ops; no resource-level or permission-bit checks. Stolen admin token = full approve/reject/cancel. |
| **Recommended fix** | Align with CASL operator ability (or explicit permission claims) per action. |
| **Verification** | Admin without `bookings:approve` capability → 403 on approve. |

---

### F-09 — Default `GET /bookings` is ops view (broad list)

| Field | Detail |
| ----- | ------ |
| **Severity** | **P1** |
| **Evidence** | `parseBookingsListQuery`: `view = viewRaw === "mine" ? "mine" : "ops"` (`packages/booking-http-contracts/src/booking-request.parsers.ts`). `listBookings` only filters `submittedByUserId` when `view===mine`; ops path lists tenant-wide after `assertOpsAccess`. |
| **Runtime impact** | Correct for ops, but accidental clients omitting `view=mine` escalate to full tenant list if they have admin/owner. Members hitting default ops get 403 (good) — still footgun for token confusion. |
| **Recommended fix** | Require explicit `view=`; default deny or default `mine`. |
| **Verification** | Contract test: missing view → 400. |

---

### F-10 — `createPendingBooking` synthesizes `role: "none"` actor

| Field | Detail |
| ----- | ------ |
| **Severity** | **P1** |
| **Evidence** | `HostBookingPublicAdapter.createPendingBooking` → `createPublicGuestBooking({ role: "none", status: "ACTIVE", ... })`. Public path skips `assertOpsAccess` (intentional) but still runs tenant binding + capabilities. |
| **Runtime impact** | If any code path later assumes “auth always has real role” or hydrates from this actor, privilege confusion. Registration must be the only caller. |
| **Recommended fix** | Distinct `GuestBookingActor` type; refuse `role:"none"` on operator façades. |
| **Verification** | Type/guard: operator `createBooking` rejects role none. |

---

### F-11 — Workspace type silent fallback to `"starter"`

| Field | Detail |
| ----- | ------ |
| **Severity** | **P1** |
| **Evidence** | `resolveWorkspaceTypeForTenant` (`tenant/resolve-workspace-type.ts`): `return registered?.workspaceType ?? "starter"`. Env override `URBAN_TEST_WORKSPACE_TYPE` for urban smoke tenants. |
| **Runtime impact** | Missing tenant row → `"starter"` then booking/finance unsupported errors **or** wrong composition if starter ever becomes supported. Test env override can rewrite workspace type in non-test if set. |
| **Recommended fix** | Fail closed on missing tenant; gate env overrides to `NODE_ENV=test`. |
| **Verification** | Unknown tenantId → explicit `TENANT_NOT_FOUND`, never starter. |

---

### F-12 — Outbox durable write ≠ external effect (relay opt-in)

| Field | Detail |
| ----- | ------ |
| **Severity** | **P1** |
| **Evidence** | Approve TX calls `enqueueOutboxEvent` (`prisma-bookings.repository.ts` approveWithOutbox). Relay starts only via `startOutboxRelayIfEnabled` when `OUTBOX_RELAY_ENABLED=true` (`main.ts`, `outbox-relay-config.ts`). CI booking workflow sets relay **false**. `invokeApproveReaction` no-ops unless capability `in-process` (Denali/booking-ws2 currently Option A off). |
| **Runtime impact** | Approve “succeeds”; consumers never see events unless relay/worker deployed. Operators assume side effects that never run. |
| **Recommended fix** | Production boot require relay worker role or in-process publisher; alert on pending lag. |
| **Verification** | Approve → row pending → with relay on → processed; with relay off → boot warn/fail in production. |

---

### F-13 — Outbox claim uses admin pool (BYPASS RLS by design)

| Field | Detail |
| ----- | ------ |
| **Severity** | **P1** |
| **Evidence** | `claimPendingOutboxBatch` (`outbox/outbox-relay.ts` ~93–96): `getPrismaAdmin()`, global `WHERE status='pending' ORDER BY created_at`, `FOR UPDATE SKIP LOCKED`. |
| **Runtime impact** | Correct for cross-tenant drain **if** admin URL is distinct and locked down. If `DATABASE_URL_ADMIN` equals app URL or leaks to app process, entire outbox is readable/writable without tenant RLS. Claim ordering by `created_at` may starve under load without status-leading index. |
| **Recommended fix** | Enforce URL inequality at boot (exists); network-restrict admin; index `(status, created_at)` / tenant-ordered mode metrics. |
| **Verification** | Boot fails when URLs equal; EXPLAIN claim query; chaos: app role cannot claim globally. |

---

### F-14 — `payment.update({ where: { id } })` still present on non-atomic paths

| Field | Detail |
| ----- | ------ |
| **Severity** | **P1** |
| **Evidence** | `PrismaFinanceRepository.markPaymentPaid` / `revertPaymentToPending` (`prisma-finance.repository.ts` ~686–718): update by `id` only inside `withTenantRls`. Atomic approve path uses `updateMany` with tenantId (better). |
| **Runtime impact** | Compensating/legacy paths weaker than atomic approve; same RLS-only bet as F-02. |
| **Recommended fix** | Convert all payment mutations to `updateMany` with `tenantId` + status CAS. |
| **Verification** | Cross-tenant payment id under wrong RLS → count 0. |

---

### F-15 — Reject is silent (no outbox); cancel is observable — split brain for consumers

| Field | Detail |
| ----- | ------ |
| **Severity** | **P2** |
| **Evidence** | `BookingsService.rejectBooking` comment + repo reject without enqueue; `cancelBooking` enqueues cancel outbox. |
| **Runtime impact** | Downstream systems tracking registrations never learn rejects; capacity freed without event. Duplicated “terminal” semantics. |
| **Recommended fix** | Emit `registration.rejected` or document consumer contract as cancel-only and enforce product UX accordingly. |
| **Verification** | Contract test: reject → 0 outbox; cancel → 1 outbox. |

---

### F-16 — Capacity rule reused for approve (`assertCreateCapacity`)

| Field | Detail |
| ----- | ------ |
| **Severity** | **P2** |
| **Evidence** | `buildApproveCapacityAssert` calls `capacityPolicy.assertCreateCapacity` (`bookings.service.ts` ~409–430). |
| **Runtime impact** | Approve may inherit create-time validation side effects if policy mixes shape + occupancy. Risk of duplicated / wrong business rule if policies diverge later. |
| **Recommended fix** | Explicit `assertApproveCapacity` on port. |
| **Verification** | Policy mock: create vs approve hooks called distinctly. |

---

### F-17 — Advisory lock is hash-based (collision class) + READ COMMITTED assumptions

| Field | Detail |
| ----- | ------ |
| **Severity** | **P2** |
| **Evidence** | `acquireTourCapacityLock`: `pg_advisory_xact_lock` on two int4 slices of `md5(tenantId:tourId)` (`prisma-bookings.repository.ts` ~34–46). Occupancy = `sum` of approved party sizes under lock. |
| **Runtime impact** | Theoretical cross-tour lock collision (md5 64-bit truncated). Under READ COMMITTED, lock + re-read pattern is sound **only** when all writers take the same lock — memory path does not (F-06). Long TX holds lock → approve latency spikes. |
| **Recommended fix** | Prefer `pg_advisory_xact_lock` on dedicated lock table row per tour UUID; keep TX short. |
| **Verification** | Concurrency cert already exists — extend with distinct tour ids crafted for hash collision if feasible; assert memory driver excluded. |

---

### F-18 — Bulk approve: partial success + sequential reactions outside TX

| Field | Detail |
| ----- | ------ |
| **Severity** | **P2** |
| **Evidence** | `bulkApproveWithOutbox` commits approved set; then `bulkApproveBookings` loops `invokeApproveReaction` per id (`bookings.service.ts` ~526–528). Capacity skip continues without failing batch. |
| **Runtime impact** | DB durable approve can succeed while in-process reactions partially fail; clients get `approvedIds`/`skippedIds` but side effects diverge. |
| **Recommended fix** | Rely on outbox-only reactions; or transactional outbox + async workers only. |
| **Verification** | Inject reaction failure mid-bulk → outbox still complete; reaction retried by worker. |

---

### F-19 — `getOrCreateBookingRuntimeForWorkspaceType` is a tenant-bypass entry

| Field | Detail |
| ----- | ------ |
| **Severity** | **P2** |
| **Evidence** | Exported from `create-bookings-service.ts`; caches by workspaceType; used heavily in specs. HTTP façades resolve tenant first — but any future route importing this helper can bind wrong policies for a tenant. |
| **Recommended fix** | Make workspaceType entry `@internal` / test-only; HTTP must only use `*ForTenant`. |
| **Verification** | Guard: `apps/api/src/**/*.routes.ts` must not call `getOrCreateBookingRuntimeForWorkspaceType`. |

---

### F-20 — List+count race (non-transactional read pair)

| Field | Detail |
| ----- | ------ |
| **Severity** | **P2** |
| **Evidence** | `listBookings`: `Promise.all([listByTenantPage, countByTenantFilters])` (`bookings.service.ts` ~239–247) — two separate `withTenantRls` transactions. |
| **Runtime impact** | `total` vs `items` can disagree under concurrent writes; UI pagination flicker. Not a security leak if both RLS-scoped. |
| **Recommended fix** | Single TX for page+count or keyset-only without total. |
| **Verification** | Concurrent approve during list → document tolerance or assert same snapshot. |

---

### F-21 — Platform ops / tenant registry on admin pool with process cache

| Field | Detail |
| ----- | ------ |
| **Severity** | **P1** |
| **Evidence** | `resolve-registered-tenant.ts` uses `getPrismaAdmin` + in-memory tenant cache. Workspace resolution for booking/finance depends on this. |
| **Runtime impact** | Stale `workspaceType` after ops patch until cache TTL/invalidation; wrong BookingRuntime capabilities. Admin pool concentration. |
| **Recommended fix** | Invalidate cache on tenant update; short TTL; prefer app-role read of non-sensitive columns where possible. |
| **Verification** | Patch workspaceType → next booking call uses new type without restart. |

---

### F-22 — Duplicate payment-status raise logic across layers

| Field | Detail |
| ----- | ------ |
| **Severity** | **P2** |
| **Evidence** | `raiseBookingPaymentStatus` in `bookings/booking-payment-status.ts` used by repository `updatePaymentStatus` and adapter `raisePaidInTx`. FinanceService also wraps sync with logging (`raiseBookingPaymentStatus` private method name collision in finance-core). |
| **Runtime impact** | Behavior drift risk if one path adds statuses and another does not; harder incident response. |
| **Recommended fix** | Single domain function owned by booking application layer. |
| **Verification** | One module exports rank table; both call sites import it only. |

---

### F-23 — Member receipt path always requires registration ownership (ops footgun)

| Field | Detail |
| ----- | ------ |
| **Severity** | **P2** |
| **Evidence** | `submitMemberReceiptForRegistration` always `memberOwnsRegistration` (`finance.service.ts` ~467–474). General `submitReceipt` allows admin/owner without ownership (~432–441). Booking HTTP only calls member path. |
| **Runtime impact** | Operators using `/bookings/:id/receipts` cannot attach proofs unless they are `submittedByUserId` — pushes them to `/finance/receipts` or fails. Split authorization models. |
| **Recommended fix** | Booking route: if ops role, use operator submit; if member, ownership. |
| **Verification** | Admin receipt on other’s booking via `/bookings/.../receipts` → 201. |

---

### F-24 — Test abort hooks reachable in production TX paths

| Field | Detail |
| ----- | ------ |
| **Severity** | **P1** |
| **Evidence** | `shouldAbortAtomicTx` in `enqueueOutboxEvent` and `approveManualReceiptAtomic` (`test-hooks/atomic-tx-test-abort`). |
| **Runtime impact** | If env flag left set outside test, production TXs abort mid-approve (payment paid then rollback / partial depending on hook point). |
| **Recommended fix** | Compile-out or hard-require `NODE_ENV=test` inside hook. |
| **Verification** | Production boot + hook env → ignore or throw at boot. |

---

## Path-by-path summary

| Domain | Service boundary integrity | TX integrity | Authz | Tenant isolation | Events |
| ------ | -------------------------- | ------------ | ----- | ---------------- | ------ |
| Booking ops HTTP | Strong (service + façade) | Approve/create locked TX good | Role-only | RLS + tenantId filters | Enqueue yes; effect optional |
| Booking public | Service used | Create TX + lock | None (guest) | Binding assert | None on create |
| Payments/receipts | **Weak — repo bypass** | Atomic approve good; other updates weak | Role + ownership mix | RLS-dependent updates | Finance outbox on approve |
| Identity | N/A | N/A | **sess_ver hole; header hole** | JWT tenant claims | N/A |
| Workspace resolve | N/A | N/A | N/A | Admin read + **starter fallback** | N/A |
| Outbox | N/A | Enqueue in TX | Admin claim | Admin global claim | Relay opt-in |

---

## Recommended fix order (runtime only)

1. F-04 sess_ver + F-05 header gate  
2. F-01/F-02 payment projection through service + composite where  
3. F-03 receipt upload authz ordering  
4. F-06 memory illegal outside test  
5. F-12/F-13 outbox relay production posture  
6. F-07 duplicate uniqueness  
7. F-11 fail-closed workspace resolve  
8. F-08/F-09 authz + list view defaults  
9. Remaining P2  

---

## Verification strategy (overall)

- **Static:** import-boundary guards for repository bypass; grep bans for `update({ where: { id:` on tenant tables.  
- **Adversarial HTTP:** cross-tenant IDs, stale sess_ver, header auth under wrong NODE_ENV, receipt upload without ownership.  
- **Concurrency:** existing booking PG capacity/approve jobs **must** run with `STORAGE_DRIVER=prisma` only.  
- **Effects:** approve with relay on/off matrix; assert pending lag alerts.  
- **No doc sign-off** — only failing tests on the above close findings.

---

Architect, documentation status: **Updated**. Link to docs: [`RUNTIME_PATH_AUDIT.md`](./RUNTIME_PATH_AUDIT.md).
