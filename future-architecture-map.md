# Phase 6 to 10 Structural Blueprint

## Phase 6: Domain Events & Shared Outbox Integration
**Findings from `payments.service.ts` & `registrations-effects.ts`:**
The current `PaymentsService` executes cross-module operations synchronously within the main HTTP transaction. Specifically, in `applyPaymentStatus`:
- It directly calls `this.paymentRefundLedgerAuthority.emitPaymentRefundLedgerReversal` (Finance module) and `this.paymentCaptureLedgerAuthority.emitPaymentCaptureAtPaid` (Finance module).
- It directly transitions registration states via `this.registrationPaymentPort.transitionRegistrationForPayment` (Registrations module).
- It emits domain events via `OutboxService` inside `registrations-effects.ts`, but does so *after* synchronous side-effects are already executed in the same transaction.

**Required Steps for Outbox Conversion:**
1. **Purify PaymentsService:** Remove cross-module imports (`PaymentCaptureLedgerAuthorityService`, `PaymentRefundLedgerAuthorityService`, `IRegistrationPaymentPort`). The `PaymentsService` must ONLY update the `PaymentEntity` and insert a `payment.captured` or `payment.refunded` event into the Outbox inside the same transaction.
2. **Async Event Handlers:** Create background worker processes (or local message consumers) that listen to the Outbox events.
3. **Delegated Side-Effects:** The Ledger module will listen to `payment.captured`/`payment.refunded` and append ledger lines asynchronously. The Registrations module will listen to the same events to transition the `RegistrationStatus` to `ACCEPTED_PAID` or `REFUNDED`.

## Phase 7: Microservices Core Ready - Decoupling Module DB Connections
**Findings from TypeORM Cross-Module Ties:**
- `registration.entity.ts` maintains physical foreign key relations to other modules:
  - `@ManyToOne(() => TourEntity)` directly tying to the `tours` module.
  - `@ManyToOne(() => TourDepartureEntity)` directly tying to the `tours` module.
- `typeorm-registrations-application.service.ts` imports and queries `TourEntity` and `TourDepartureEntity` directly (e.g., `manager.findOne(TourEntity)`).

**Required Steps to Cut Physical DB Ties:**
1. **Strip TypeORM Relations:** Remove `@ManyToOne(() => TourEntity)` and `@ManyToOne(() => TourDepartureEntity)` from `registration.entity.ts`. They must be plain string UUID columns (`tourId`, `tourDepartureId`).
2. **Abstract Read Models (Cross-Boundary Sync):** `TypeOrmRegistrationsApplicationService` must stop querying `TourEntity` directly. We must introduce a `RegistrationsTourCatalogPort` contract.
3. **Snapshot Replication:** Instead of SQL joins, the Registrations context should maintain a replicated, eventually-consistent read model of `Tour` inventory updated via domain events (`tour.published`, `tour.capacity_changed`), or perform a pure RPC/API call to the `Tours` context to validate capacity before acceptance.

## Phase 8 to 10: Advanced Financial Ledger, Invoicing, & Wallet Projections
**Findings from `discount-adjustment-ledger.policy.ts` & `immutable-invoice.ts`:**
- **Immutable Snapshots:** `BOOKING_PRICE_SNAPSHOT_IMMUTABLE_POLICY` enforces that `booking_price_snapshots` are strictly append-only. They are never updated.
- **Ledger Offsets:** Operator discounts or price deltas emit balanced offset journal entries (debits/credits) via `DISCOUNT_ADJUSTMENTS_ACCOUNT` rather than altering the snapshot.
- **Wallet Projections:** The `sumWalletBalanceFromLedgerLines` function in `immutable-invoice.ts` derives the wallet balance purely by aggregating `LedgerJournalLine` rows matching the `tenantId` and `bookingWalletId`.

**Required Isolation Mapping & Contracts:**
1. **InvoiceReadModelPort:** A read-only port strictly for fetching derived invoices (`ImmutableInvoice`), totally decoupled from write paths.
2. **Event-Sourced Ledger Rules:** Core registration lifecycle MUST NOT know about "invoices" or "ledgers". Registrations emits `registration.created` and `booking.finalized` events.
3. **Finance Module Autonomy:** The Finance context listens to these events, locks the `bookingWalletId`, and applies Double-Entry Ledger lines via a `LedgerCommandBus`. Invoices are purely materialized views derived at runtime from `ImmutableInvoiceSnapshotRef` + associated `ImmutableInvoiceLedgerLineRef[]`.

# Phase 11 to 15 Scale & Concurrency Blueprint

## Phase 11 & 12: Draft Engine V2 Optimization & Guard Hydration
**Findings from `draft-engine.facade.ts` & `postgres-draft-snapshot.store.ts`:**
- **Concurrent Drafts:** Drafts are concurrently mutated using an optimistic version control strategy (`version` tracking) where mismatches throw a `DraftConflictException`.
- **Guard Hydration Leaks:** When a `DraftConflictException` is thrown, it returns the server's snapshot directly (`details.server.version` / `details.server.data`) instead of gracefully merging. Client-side hydration guards leak here because they crash unhandled upon receiving an unexpected HTTP 409 with raw server state instead of attempting a 3-way merge or reprompting the user safely.

**Required Concurrency Ports & Steps:**
1. **DraftConflictResolverPort:** Implement a deterministic conflict resolver strategy on the backend that handles 3-way merging (CRDT-like) of the draft forms, preventing silent UI failures.
2. **Client-Side Recovery Protocol:** Expose a formalized `/conflict-resolution` endpoint to allow Denali wizards to explicitly hydrate and merge `DraftConflictException` states visually for the user.

## Phase 13 & 14: Distributed Caching & Redis Idempotency Layer Hardening
**Findings from `idempotency.service.ts` & `RedisPaymentIdempotencyKeyStore`:**
- **Redis Payment Gateway Caching:** `RedisPaymentIdempotencyKeyStore` utilizes a composite key digest `redisKey(scope)` relying on `paymentGatewayIdempotencyCompositeKey`. If this key doesn't strictly and cryptographically bind the active `tenantId`, cache poisoning or cross-tenant data leaks can occur.
- **Isolation Breach Risk:** A short-circuited cache read might serve an idempotency payload belonging to Tenant A to a request executed inside Tenant B if the hash key only contained the raw idempotency-key and gateway identifier.

**Required Hardening Steps:**
1. **Cryptographic Tenant Binding:** We must inject `tenantId` into the `PaymentIdempotencyScope` and ensure the `paymentGatewayIdempotencyCompositeKey` performs a cryptographic hash (`createHash("sha256").update(tenantId + ":" + idempotencyKey)`) ensuring absolute namespace isolation.
2. **Cache Read Verification:** Add an explicit `if (cached.tenantId !== activeTenantId) throw` validation immediately after deserializing from Redis to create a defense-in-depth boundary against hash collisions or misconfigurations.

## Phase 15: Concurrency Lock Strategy & Double-Booking Prevention
**Findings from `lockForFinancialMutation` & TypeORM Row Locks:**
- **Database Thread Starvation:** The current capacity and double-booking prevention strategy relies on `lockForFinancialMutation` using `lock: { mode: "pessimistic_write" }` (translates to `SELECT ... FOR UPDATE`).
- **Thundering Herd Weakness:** If 100+ members register concurrently for a floating-capacity tour, PostgreSQL row-level locks on the `registration` and `tour` tables will queue synchronously. This leads to connection pool exhaustion and massive latency spikes, breaking down under scale. Optimistic versioning (`expected_row_version`) helps data integrity but doesn't prevent DB-level lock contention queues.

**Required Scalability Schema & Validation Steps:**
1. **Abstract Distributed Lock Port:** Move capacity reservation to a Redis-based distributed locking layer (e.g., Redlock) or a robust asynchronous queueing mechanism (like an ordered channel).
2. **Ticket/Reservation Pattern:** Instead of eagerly locking DB rows upon request, instantly allocate a "Capacity Reservation Ticket" from Redis. Asynchronously persist the capacity decrements in batches to PostgreSQL via the Outbox or an SQS worker.
3. **Double-Booking Validation:** The final confirmation must atomically decrement the accepted count using a raw DB `UPDATE tours SET acceptedCount = acceptedCount + 1 WHERE id = X AND acceptedCount < totalCapacity;`. If 0 rows are affected, it explicitly rolls back the transaction, guaranteeing zero double-bookings without holding a pessimistic lock during the entire validation phase.

# Phase 16 to 20 Security & Infrastructure Blueprint

## Phase 16 & 17: Dynamic Capability Engines, Role Tiers, & Multi-Tenant Metering
**Findings from `workspace-access.helper.ts` & `jwt-capability-snapshot.ts`:**
- **Capability Snapshots:** Workspace product capabilities (e.g., `tour.form.architect`) are encoded into a compact, sorted CSV claim (`caps`) within the JWT to prevent token bloat (up to 512 bytes).
- **Role Resolution:** `workspace-access.helper.ts` processes raw inputs into tiered RBAC roles (`UserRole.Owner`, `Admin`, `Leader`, `Member`, `Viewer`) for baseline tenant access control.

**Required Dynamic Capability Hooks:**
1. **NestJS CapabilityGuard / Interceptor:** Build a global NestJS Guard or Interceptor that reads the `caps` string array directly from the decoded JWT present on the Request object. It should parse the capabilities using `decodeJwtCapabilitySnapshot`.
2. **Controller Decoupling:** Introduce a `@RequireCapability('tour.form.architect')` metadata decorator. The interceptor evaluates the route's required capability against the JWT's `caps` array, throwing an HTTP 403 Forbidden before the application handler is invoked, keeping business logic pure.
3. **Multi-Tenant Metering Checks:** Implement a `RateLimitMeterInterceptor` that fetches the active tenant's current usage limits (cached in Redis based on their license tier) and preemptively throttles requests (HTTP 429) before reaching the controller.

## Phase 18 & 19: Row-Level Security (RLS) Automation & Multi-Host Subdomain Mesh
**Findings from `tenant-host-resolver.service.ts` & `rls-guardrail.spec.ts`:**
- **Subdomain Mesh:** `tenant-host-resolver.service.ts` correctly extracts the tenant label from the `Host` or `X-Forwarded-Host` header, caching the mapping in Redis.
- **RLS Guardrails:** The test strictly verifies that every public table containing a `tenant_id` column has `FORCE ROW LEVEL SECURITY` and at least one active policy. Currently, the test requires a raw `DATABASE_URL` and uses the standard `pg` client to query internal catalogs.

**Required Automation Steps:**
1. **Context-Switched TypeORM DataSource:** Eliminate the dependency on the raw `pg` client and `DATABASE_URL` in tests and application code by subclassing the TypeORM `QueryRunner` or `DataSource`. 
2. **Session Variable Injection:** The custom query runner must intercept every newly checked-out database connection and automatically execute `SET LOCAL rls.tenant_id = $1` using the active RequestContext. This guarantees RLS context is switched transparently for all TypeORM operations.

## Phase 20: The Ultimate Strict Architecture Guardrail Lock & Production Seal
**Findings from `architecture-boundaries.spec.ts`:**
- **Current Gate:** The boundary scanner explicitly whitelists the core modules (`purified = ["tours", "registrations", "payments", "identity"]`) and enforces a 0-violation rule only for these layers (app must not import infra, domain must not import infra).

**Required Global Enforcement Parameters:**
1. **Remove the Whitelist:** Modify the `gatedViolations` filter to completely remove the `purified` array check. The rule must apply globally across all modules.
2. **Absolute Boundary Check:**
   ```typescript
   const gatedViolations = violations.filter(
     (v) => v.kind === "domain-must-not-import-infra" || v.kind === "app-must-not-import-infra"
   );
   assert.equal(gatedViolations.length, 0);
   ```
3. **Production Seal:** This asserts that across all 20 layers of the repository, the Hexagonal Architecture boundaries are unconditionally enforced, effectively sealing the monorepo architecture from any future regression before production deployment.
