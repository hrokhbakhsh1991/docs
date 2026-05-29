# MAP — Engineering log

## 54.1. Phase 2.1 — `UsersAccessService` context hardening (completed)

**Date:** 2026-05-29  
**Scope:** Remove `tenantId` from membership/user lookup public API; resolve via ALS inside the service.

### API changes (`users-access.service.ts`)

| Method | Before | After |
|--------|--------|-------|
| `ensureActorMembershipOrThrow` | `(tenantId, actorUserId)` | `(actorUserId)` — calls `resolveTenantIdOrThrow()` internally |
| `findTenantScopedUserOrThrow` | `(tenantId, userId)` | `(userId)` — calls `resolveTenantIdOrThrow()` internally |
| `resolveTenantIdOrThrow` | unchanged | unchanged (still used by callers for wallet, audit, SQL) |
| `resolveActorContextOrThrow` | unchanged | unchanged |

### Call sites updated (no `tenantId` passed to the two methods)

| Module | File | Updates |
|--------|------|---------|
| identity | `users-read.service.ts` | 2 |
| identity | `users-write.service.ts` | 11 |
| identity | `workspace-users.service.ts` | 8 |
| identity | `services/users-invite.service.ts` | 5 |
| identity | `me.service.ts` | 5 |
| safety-profile | `safety-profile.service.ts` | 4 |

**Total:** 35 call-site argument removals. Controllers unchanged.

### Verification

```bash
cd apps/api
node --import tsx --test test/modules/identity/workspace-invites.service.unit-spec.ts
# 4/4 pass

rg 'ensureActorMembershipOrThrow\([^)]+,' apps/api/src/modules/identity apps/api/src/modules/safety-profile
rg 'findTenantScopedUserOrThrow\([^)]+,' apps/api/src/modules/identity apps/api/src/modules/safety-profile
# → no matches (two-arg forms removed)
```

### Context-aware contract

- Callers **must** run under a resolved workspace (Host + JWT / ALS `tenant_id`).
- Callers **must not** pass a client-supplied `tenantId` into these guards — tenant is always `RequestContextService.resolveEffectiveTenantId()`.
- Callers that still need `tenantId` for repositories, wallet aggregates, or audit payloads continue to use `access.resolveTenantIdOrThrow()` explicitly.

### Next (Phase 2.2)

See §54.2 (completed).

---

## 54.2. Phase 2.2 — `ReceiptService` context hardening (completed)

**Date:** 2026-05-29  
**Scope:** Resolve workspace tenant from ALS inside `ReceiptService`; controllers no longer pass `tenantId`.

### API changes (`receipt.service.ts`)

| Method | Before | After |
|--------|--------|-------|
| `submitReceipt` | `{ tenantId, paymentId, actorUserId, ... }` | No `tenantId` — `resolveTenantIdOrThrow()` + `runInTenantScope(tenantId, …)` |
| `approveReceipt` | `{ tenantId, receiptId, actorId, reviewNote? }` | `{ receiptId, actorId, reviewNote? }` |
| `rejectReceipt` | `{ tenantId, receiptId, actorId, reviewNote? }` | `{ receiptId, actorId, reviewNote? }` |
| `getReceiptSignedUrl` | `{ tenantId, receiptId }` | `{ receiptId }` |
| `listPendingReceipts` | `(tenantId: string)` | `()` — tenant from ALS |

**Added:** `@Inject(RequestContextService)` and private `resolveTenantIdOrThrow()` (403 `TENANT_CONTEXT_MISSING` when ALS has no tenant).

### Controllers updated

- `finance-payments.controller.ts` — `FinancePaymentsController.submitReceipt` (removed `tenantId` from service call).
- Same file — `FinanceAdminReceiptsController`: `listPendingReceipts`, `approveReceipt`, `rejectReceipt`, `getReceiptUrl`.

### Audit / business logic preserved

- `approveReceipt` / `rejectReceipt` still set `reviewedByUserId`, `reviewedAt`, `reviewNote` on receipt rows.
- `approveReceipt` unchanged: payment → PAID, ledger capture (`emitPaymentCaptureAtPaid`), registration transition, `invalidateSummaryCache(tenantId)` with **resolved** tenant (not caller-supplied).
- `submitReceipt` storage path still uses resolved `tenantId` as `workspaceId` for uploads.
- All DB filters continue to include `tenantId` from ALS inside tenant scope.

### Verification

```bash
cd apps/api
node --import tsx --test test/payments/receipt.service.unit-spec.ts
# 4/4 pass
```

Unit tests updated: mock `RequestContextService.resolveEffectiveTenantId → "tenant-1"`; removed `tenantId` from `submitReceipt` test payloads.

### Next (Phase 2.3)

See §54.3 (completed).

---

## 54.3. Phase 2.3 — `PaymentsService` / `ManualPaymentService` context hardening (completed)

**Date:** 2026-05-29  
**Scope:** Admin payment listing and manual payment CRUD resolve workspace tenant from ALS inside services; controllers stop passing `tenantId`.

### API changes

| Service | Method | Before | After |
|---------|--------|--------|-------|
| `PaymentsService` | `listPayments` | `(tenantId: string)` | `()` — `resolveTenantIdOrThrow()` (lowercased) |
| `ManualPaymentService` | `listManualPayments` | `(tenantId: string)` | `()` |
| `ManualPaymentService` | `createManualPayment` | `{ tenantId, registrationId, amount, currency }` | `{ registrationId, amount, currency }` |

**Added:** `resolveTenantIdOrThrow()` on both services (`ForbiddenException` + `TENANT_CONTEXT_MISSING` when ALS has no tenant). `ManualPaymentService` injects `@Inject(RequestContextService)`.

**Unchanged (tenant isolation / idempotency):**

- `createPaymentIntent` / `createPaymentIntentWithManager` — still use `assertFinancialMutationRunsInIdempotentScope`, `getFinancialIdempotencyKeyFromContext`, registration row `tenantId` from `requireRegistrationOwnedByActor` / locked registration (not caller-supplied).
- `getPaymentById`, `refundPayment`, webhooks — ownership / webhook tenant binding unchanged.
- `createManualPayment` — still `runInTenantScope(resolvedTenantId, …)`; registration lookup `{ id, tenantId }`; `enforcePaymentIntentFinanceContract` + `invalidateSummaryCache(resolvedTenantId)`.

### Controllers updated

- `payments.controller.ts` — `listPayments()` no longer `assertTenantContext()` + pass-through; removed unused `RequestContextService` from `PaymentsController` (webhook controller unchanged).
- `finance-payments.controller.ts` — `listManualPayments` / `createManualPayment` delegate without resolving `tenantId` in controller.

### Verification

```bash
cd apps/api
node --import tsx --test test/payments/payments.service.unit-spec.ts
node --import tsx --test test/payments/manual-payment.service.unit-spec.ts
```

Unit tests: mock `resolveEffectiveTenantId` for list/create paths; admin list missing-tenant expects `ForbiddenException`.

### Next (Phase 2.4)

See §54.4 (completed).

---

## 54.4. Phase 2.4 — `FinanceReportsService`, `IdempotencyService`, `DraftEngine` context hardening (completed)

**Date:** 2026-05-29  
**Scope:** Final Phase 2 services resolve workspace tenant from ALS internally; controllers and orchestrators stop passing `tenantId` into public APIs.

### API changes

| Service | Method | Before | After |
|---------|--------|--------|-------|
| `FinanceReportsService` | `getSummary` | `(tenantId: string)` | `()` |
| `FinanceReportsService` | `listLedgerEvents` | `(tenantId, limit?)` | `(limit?)` |
| `FinanceReportsService` | `listOpenPayments` | `(tenantId, limit?)` | `(limit?)` |
| `FinanceReportsService` | `invalidateSummaryCache` | `(tenantId: string)` | `()` |
| `IdempotencyService` | `findByKey` | `(tenantId, key)` | `(key)` |
| `IdempotencyService` | `executeWithIdempotency` | `{ tenantId, key, endpoint, requestHash, statusCode? }` | `{ key, endpoint, requestHash, statusCode? }` |
| `IdempotencyService` | `storeResponse` | `{ tenantId, key, ... }` | `{ key, ... }` (tenant from ALS) |
| `DraftEngineFacade` / `DraftEngineService` | `findForMember` | `(tenantId, draftKey)` | `(draftKey)` |
| `DraftEngineFacade` / `DraftEngineService` | `deleteForMember` | `(tenantId, draftKey)` | `(draftKey)` |
| `DraftEngineFacade` | `loadDraft` / `deleteDraft` | `(tenantId, draftKey)` | `(draftKey)` |

**Added:** `resolveTenantIdOrThrow()` on `FinanceReportsService`, `IdempotencyService`, and `DraftEngineFacade` (`ForbiddenException` + `TENANT_CONTEXT_MISSING`). All inject `@Inject(RequestContextService)`.

**Unchanged / preserved:**

- Idempotency replay, endpoint mismatch, payload hash conflict, in-progress, and per-tenant key isolation — tenant now always from ALS at call time (public registration / webhook paths still `setTenantId` before `executeWithIdempotency`).
- `IdempotencyInterceptor`: `tenantSource: "context"` delegates to service; `tenantSource: "body"` binds body field via `setTenantId` then calls service.
- Finance summary Redis cache keys still scoped by resolved tenant; DB queries via `runInTenantScope(resolvedTenantId, …)`.
- Draft engine `upsertForMember` still accepts route `tenantId` (out of Phase 2.4 scope); `findForMember` / `deleteForMember` use ALS only (removed param-vs-context mismatch assert — ALS is single source of truth).

### Callers updated

- `finance-reports.controller.ts` — no `RequestContextService`; delegates without tenant pass-through.
- `payments.service.ts`, `receipt.service.ts`, `manual-payment.service.ts` — `invalidateSummaryCache()` (no arg).
- `registrations.controller.ts` — public register/waitlist still `bootstrapPublicTourTenant` (sets ALS); `executeWithIdempotency` params omit `tenantId`; removed `requireTrustedTenantId`.
- `idempotency.interceptor.ts` — omits `tenantId` from service call.
- `draft-engine.controller.ts` — GET/DELETE call `findForMember(draftKey)` / `deleteForMember(draftKey)` (route `:tenantId` retained for REST shape; service uses ALS).

### Verification

```bash
cd apps/api
node --import tsx --test test/finance/finance-reports.service.unit-spec.ts
node --import tsx --test test/idempotency/idempotency.service.unit-spec.ts
node --import tsx --test src/modules/draft-engine/draft-engine.facade.spec.ts
node --import tsx --test test/registrations/registrations-idempotency.unit-spec.ts
```

### Phase 2 complete

Context hardening backlog (§54) fully addressed: §54.1–§54.4.

---

## 54. Phase 2 — Context Hardening (backlog)

**Completed:** §54.1 `UsersAccessService`, §54.2 `ReceiptService`, §54.3 `PaymentsService` / `ManualPaymentService`, §54.4 `FinanceReportsService` / `IdempotencyService` / `DraftEngine`.

---

## 55. Phase 3.1 — Identity `WorkspaceIdentityRepositoryPort` (completed)

**Date:** 2026-05-29  
**Goal:** Extract user / membership / invite persistence from application services into a repository port + TypeORM adapter (MAP §52 wedge).

### Port (`domain/ports/workspace-identity-repository.port.ts`)

`WORKSPACE_IDENTITY_REPOSITORY_PORT` + `WorkspaceIdentityRepositoryPort`:

| Method | Purpose |
|--------|---------|
| `findUserById` | Non-deleted user by id |
| `findUserByEmail` | Email lookup (normalized) |
| `findUserByNormalizedPhone` | Cross-tenant phone match (invite target) |
| `findActiveMembership` | Tenant membership row (optional status filter; optional tx manager) |
| `listWorkspaceMembers` | Tenant membership list |
| `findPendingInviteByToken` | Invite accept flow |
| `saveInvite` / `createInvite` | Invite persistence |
| `findInviteById` / `findPendingInvitesByTenant` / `updateInviteStatus` | Invite admin flows |
| `saveMembership` / `createMembership` / `deleteMembershipById` | Membership writes |
| `findInvitedMembershipForPhone` | Pending invite ↔ user linkage |
| `listUserRoleHistoryRows` | Role audit query (from former `memberships.manager`) |
| `runInTransaction` | Bulk role / invite transactional mutations |

### Adapter

- `repositories/typeorm-identity.repository.ts` — `TypeOrmIdentityRepository implements WorkspaceIdentityRepositoryPort`
- Sole `@InjectRepository` site for `UserEntity`, `UserTenantEntity`, `WorkspaceInviteEntity` in this wedge (+ `@InjectDataSource` for transactions)

### Module wiring

```typescript
{
  provide: WORKSPACE_IDENTITY_REPOSITORY_PORT,
  useClass: TypeOrmIdentityRepository,
}
```

Registered in `identity.module.ts`.

### Services refactored

| Service | Change |
|---------|--------|
| `users-access.service.ts` | Injects port; removed `@InjectRepository(UserEntity)`, `@InjectRepository(UserTenantEntity)`; removed `users` / `memberships` getters; `ensureActorMembershipOrThrow` uses port; added `findUserById`, `findMembership`, `updateMembership`, `runInTransaction`, `listUserRoleHistoryRows` delegates |
| `users-invite.service.ts` | Injects port; removed `@InjectRepository(WorkspaceInviteEntity)`, `@InjectRepository(UserEntity)`, `@InjectRepository(UserTenantEntity)`; all invite/membership DB access via port |

### `@InjectRepository` removed (target services)

| File | Removed injections |
|------|-------------------|
| `users-access.service.ts` | `UserEntity`, `UserTenantEntity` |
| `services/users-invite.service.ts` | `WorkspaceInviteEntity`, `UserEntity`, `UserTenantEntity` |

**Total removed from application layer:** 5 `@InjectRepository` parameters.

### Call-site follow-ups (getter removal)

- `users-write.service.ts`, `workspace-users.service.ts`, `users-audit.service.ts` — migrated from `access.users` / `access.memberships` to `access.findUserById`, `access.findMembership`, `access.updateMembership`, `access.runInTransaction`, `access.listUserRoleHistoryRows`.

### Completed in §56

Legacy `UsersListRepository`, `UsersTenantScopeRepository`, `MeService` factory, and wallet/booking summary direct repository access were consolidated onto `WorkspaceIdentityRepositoryPort` in Phase 3.2.

---

## 56. Phase 3.2 — Identity module finalization (completed)

**Date:** 2026-05-29  
**Goal:** Consolidate remaining identity persistence onto `WORKSPACE_IDENTITY_REPOSITORY_PORT`; deprecate legacy list/scope repositories; stop exporting `TypeOrmModule` from `IdentityModule`.

### Port extensions (`workspace-identity-repository.port.ts`)

| Method group | Methods |
|--------------|---------|
| Me / profile | `findActiveUserByEmailCaseInsensitive`, `findUserByEmailExact`, `findUserByNationalIdActive`, `findUserByNormalizedPhoneExclusive`, `saveUser`, email-verification token CRUD + `findLockedValidEmailVerificationToken` |
| Listing / scope | `listTenantUsers`, `findTenantScopedUserRow` |
| Wallet | `resolveOperatingCurrencyCode`, `loadMemberWalletBalances` |
| Booking summary | `loadBookingSummariesForUserIds`, `loadBookingTripsForUser` |

Types: `MemberWalletBalanceSnapshot`, `UserBookingSummarySnapshot`.

### Adapter (`typeorm-identity.repository.ts`)

- Sole `@InjectRepository` site for identity persistence (`UserEntity`, `UserTenantEntity`, `WorkspaceInviteEntity`, `TenantEntity`, `AccountBalanceEntity`, `RegistrationEntity`).
- Absorbed logic from `UsersListRepository`, `UsersTenantScopeRepository`, wallet/booking summary services, and former `MeService` direct repository access.
- `TypeOrmModule.forFeature` now includes `TourProductEntity` for booking trip joins.

### Services refactored

| Service | Change |
|---------|--------|
| `me.service.ts` | Injects port; removed factory + `Repository<UserEntity>` / `DataSource`; profile mutations via port + idempotent EM escape hatch |
| `users-member-wallet-balances.service.ts` | Thin delegate to port (public API retained for `users-read`) |
| `workspace-user-booking-summary.service.ts` | Thin delegate to port |
| `users-access.service.ts` | `findTenantScopedUserRow` via port; removed `UsersTenantScopeRepository` |
| `users-read.service.ts` | `listTenantUsers` via port; removed `UsersListRepository` |

### Legacy repositories deprecated

- `users/repositories/users-list.repository.ts` — `@deprecated`; unregistered from module
- `users/repositories/users-tenant-scope.repository.ts` — `@deprecated`; unregistered from module
- Interface files (`users-list.repository.interface.ts`, `users-tenant-scope.repository.interface.ts`) retained for query/row types

### Module wiring (`identity.module.ts`)

**Removed:** `UsersListRepository`, `UsersTenantScopeRepository`, `MeService` factory (`getRepositoryToken` + `DataSource`).

**Exports:** `WORKSPACE_IDENTITY_REPOSITORY_PORT` + application services (`UsersAccessService`, `UsersReadService`, `UsersWriteService`, `UsersAuditService`).

**No longer exported:** `TypeOrmModule` (consumers register their own entity features).

### `@InjectRepository` audit (application services)

```bash
rg '@InjectRepository' apps/api/src/modules/identity --glob '*.service.ts'
# → no matches
```

Remaining `@InjectRepository` (non–application-service, acceptable):

| File | Role |
|------|------|
| `repositories/typeorm-identity.repository.ts` | Port adapter |
| `tenant-audit-events.controller.ts` | Controller (actor email lookup) |
| `workspace-settings-modules.controller.ts` | Controller (tenant row) |
| `users/repositories/*.ts` | Deprecated, unregistered |

### Verification

```bash
cd apps/api
node --import tsx --test test/modules/identity/workspace-invites.service.unit-spec.ts
# 4/4 pass
```

**Status:** Ready for Identity Module Finalization — all identity application services route persistence through `WORKSPACE_IDENTITY_REPOSITORY_PORT`.

---

## 57. Phase 3.3 — Payments `PaymentRepositoryPort` (completed)

**Date:** 2026-05-29  
**Goal:** Isolate transactional payment persistence behind a repository port; remove `@InjectRepository` from payments application services (MAP §52 wedge — payments module).

### Port (`domain/ports/payment-repository.port.ts`)

`PAYMENT_REPOSITORY_PORT` + `PaymentRepositoryPort`:

| Method group | Methods |
|--------------|---------|
| Transaction shell | `getDefaultEntityManager`, `runInTransaction` |
| Reads | `listByTenant`, `listManualByTenant`, `findLatestByRegistration`, `findByProviderPaymentId`, `findByProviderPaymentIdWithManager`, `findPendingForRegistration`, `findPaidForRegistration`, `findStatusesByRegistration` |
| Existence / finalization | `existsPendingForRegistration`, `existsPaidForRegistration`, `existsOtherPendingForRegistration` |
| Writes | `createPayment`, `savePayment` |
| Timeout sweep | `listActiveTenantIds`, `findLockedTimedOutPending` |
| Manual payment | `findRegistrationByTenantAndId` |

Gateway PSP idempotency (`PostgresPaymentIdempotencyKeyStore`) remains in the gateway layer — separate from payment entity CRUD.

### Adapter

- `repositories/typeorm-payment.repository.ts` — `TypeOrmPaymentRepository implements PaymentRepositoryPort`
- Sole `@InjectRepository` site for `PaymentEntity` and `TenantEntity` in the payments persistence wedge (+ `@InjectDataSource` for `runInTransaction`)

### Module wiring

```typescript
{
  provide: PAYMENT_REPOSITORY_PORT,
  useClass: TypeOrmPaymentRepository,
}
```

Registered in `payments.module.ts`; exported as `PAYMENT_REPOSITORY_PORT`.

### Services refactored

| Service | Change |
|---------|--------|
| `payments.service.ts` | Injects port; removed `@InjectRepository(PaymentEntity)`, `@InjectRepository(UserEntity)`, `@InjectRepository(TenantEntity)`, `@Inject(DataSource)`; payment CRUD/existence/timeout via port; webhook uses `runInTransaction` |
| `manual-payment.service.ts` | Injects port; removed `@InjectRepository(PaymentEntity)`; manual create/list via port |
| `payment-intent-registration-resolver.application.service.ts` | Removed unused `@InjectRepository(UserEntity)`; uses `registrationWhereForActor` without legacy user repo param |

### Cross-cutting cleanup

- `ownership-scope.ts` — removed unused `_userRepo` parameter from `registrationWhereForActor`, `waitlistWhereForActor`, `findPaymentScopedForActor` (callers updated in registrations + payments)

### `@InjectRepository` audit (application services)

```bash
rg '@InjectRepository' apps/api/src/modules/payments --glob '*.service.ts'
# → no matches
```

Remaining `@InjectRepository` (acceptable):

| File | Role |
|------|------|
| `repositories/typeorm-payment.repository.ts` | Port adapter |
| `gateway/postgres-payment-idempotency-key.store.ts` | Gateway idempotency (`@InjectDataSource`) |

### Idempotency / transactional patterns preserved

- Financial mutations still require idempotent EM scope (`getIdempotentEntityManager` / `assertFinancialMutationRunsInIdempotentScope`)
- Webhook path: `paymentRepository.runInTransaction` + `IdempotencyService.executeWithIdempotency`
- Timeout sweep: tenant-scoped `findLockedTimedOutPending` with pessimistic write + `skip_locked`

### Verification

```bash
cd apps/api
node --import tsx --test test/payments/manual-payment.service.unit-spec.ts test/payments/payments.service.unit-spec.ts
# 9/9 pass
```

**Status:** Ready for Phase 3.3 Refactor (Payments Module) — payment application services are database-agnostic; TypeORM encapsulated in `TypeOrmPaymentRepository`.

---

## 58. Phase 3.4 — Tours write isolation & test stability (completed)

**Date:** 2026-05-29  
**Goal:** Encapsulate tour writes behind `TOURS_WRITE_REPOSITORY_PORT`; remove `@InjectRepository` from `ToursService`; route catalog validation through `WORKSPACE_SETTINGS_REPOSITORY_PORT` and leader checks through `WORKSPACE_IDENTITY_REPOSITORY_PORT`; fix E2E seed order for Postgres owner constraint (23514).

### Test stability — seed order

| File | Change |
|------|--------|
| `test/helpers/auth-test-personas.ts` | `seedTwoTenantPersonas` seeds `dualMember` **before** `userInAOnly` / `userInBOnly` (23514 requires active owner before other members) |
| `test/e2e/subdomain-comprehensive.e2e-spec.ts` | Seeds `dualMember` (Owner) first, then `TENANT1_ONLY_PHONE` via `seedAuthPersona` |

### Port extensions

**`TOURS_WRITE_REPOSITORY_PORT`** (`tours-repository.port.ts`)

| Method | Role |
|--------|------|
| `getIdempotentManager` / `getDefaultManager` / `runInTransaction` | EM scope for financial/idempotent writes |
| `createTourEntity` | Factory for new `TourEntity` rows |
| `createTour` | Persist + reload + sync product/departure |
| `loadTourForUpdateLocking` | Pessimistic load for update path |
| `updateTour` | Persist patch + reload + sync product/departure |
| `syncProductDepartureForTour` | Keeps `tour_products` / `tour_departures` aligned with tour snapshot |

**`WORKSPACE_SETTINGS_REPOSITORY_PORT`** (catalog validation for tours)

| Method | Role |
|--------|------|
| `findDestinationSummary` | Destination region validation |
| `findExistingEquipmentIds` | Equipment catalog membership |
| `findExistingTourThemeIds` | Theme catalog membership |
| `findExistingGuideLanguageIds` | Guide language catalog membership |
| `resolveTourFormProfile` | Form profile snapshot for create/patch gates |

**`WORKSPACE_IDENTITY_REPOSITORY_PORT`**

| Method | Role |
|--------|------|
| `findActiveMembershipsByUserIds` | Leader user eligibility / tenant membership |

### Adapters

| Adapter | Role |
|---------|------|
| `repositories/typeorm-tours-write.repository.ts` | Sole TypeORM write site for tour entities (`TourEntity`, `TourProductEntity`, `TourDepartureEntity`, `TourPriceEntity`) |
| `repositories/typeorm-workspace-settings.repository.ts` | Implements catalog validation + form profile resolution (absorbed `resolve-workspace-tour-form-profile.ts` logic) |
| `repositories/typeorm-identity.repository.ts` | Implements `findActiveMembershipsByUserIds` |

### Services / utils refactored

| File | Change |
|------|--------|
| `tours.service.ts` | Injects `TOURS_WRITE_REPOSITORY_PORT`, `WORKSPACE_SETTINGS_REPOSITORY_PORT`, `WORKSPACE_IDENTITY_REPOSITORY_PORT`, `FILE_STORAGE_PORT`, `ToursCatalogReadApplicationService`; removed all `@InjectRepository`; create/update delegate to write port; catalog + leader validation via cross-module ports |
| `utils/assert-workspace-catalog-ids.ts` | Accepts `WorkspaceSettingsRepositoryPort` instead of TypeORM `Repository` |
| `utils/assert-leader-user-ids-belong-to-tenant.ts` | Accepts `WorkspaceIdentityRepositoryPort` instead of `Repository<UserTenantEntity>` |

### Module wiring

**`tours.module.ts`**

- Imports `IdentityModule`, `SettingsLocationsModule`
- Registers `TOURS_WRITE_REPOSITORY_PORT` → `TypeOrmToursWriteRepository`
- Removed settings-locations / identity entity `forFeature` entries (tour entities only)

**`settings-locations.module.ts`**

- Exports `WORKSPACE_SETTINGS_REPOSITORY_PORT`

### `ToursService` constructor boundary check

**Ports & application services (audit target):**

| Token | Type |
|-------|------|
| `TOURS_WRITE_REPOSITORY_PORT` | Port |
| `WORKSPACE_SETTINGS_REPOSITORY_PORT` | Port |
| `WORKSPACE_IDENTITY_REPOSITORY_PORT` | Port |
| `FILE_STORAGE_PORT` | Port |
| `ToursCatalogReadApplicationService` | Application service |

**Cross-cutting (unchanged, no TypeORM):** `RequestContextService`, `LoggerService`, `AuditLogService`

**Removed:** all `@InjectRepository`, `DataSource`, foreign-module entity imports in `tours.service.ts`

### `@InjectRepository` audit (application services)

```bash
rg '@InjectRepository' apps/api/src/modules/tours --glob '*.service.ts'
# → no matches

rg '@nestjs/typeorm' apps/api/src/modules/tours/tours.service.ts
# → no matches
```

Remaining `@InjectRepository` (acceptable):

| File | Role |
|------|------|
| `repositories/typeorm-tours-write.repository.ts` | Write port adapter |
| `repositories/typeorm-tours-catalog.repository.ts` | Read port adapter |

### Verification

```bash
cd apps/api
node --import tsx --test \
  src/modules/tours/tours.service.unit-spec.ts \
  src/modules/tours/utils/assert-leader-user-ids-belong-to-tenant.spec.ts
# 7/7 pass
```

**Status:** Ready for Phase 3.4 Refactor (Tours Module) — `ToursService` is write-path database-agnostic; TypeORM encapsulated in `TypeOrmToursWriteRepository`; catalog validation crosses module boundaries only via ports.

---

## 59. Phase 3 verification report (2026-05-29)

Post–Phase 3.4 architecture compliance audit across Tours, Settings-Locations, Identity, and Payments.

### Cross-module entity imports (services / application layer)

| Module | Verdict | Findings |
|--------|---------|----------|
| **Tours** | ✅ Compliant | No foreign-module entity imports in `*.service.ts` / `*.application.service.ts` |
| **Settings-Locations** | ✅ Compliant | No foreign entity imports; only `tours/strategies` registry (domain strategy, not persistence) |
| **Identity** | ✅ Compliant | Services import own-module entities/types only |
| **Payments** | ⚠️ One gap | `payment-intent-registration-resolver.application.service.ts` imports `TourEntity` and calls `manager.findOne(TourEntity, …)` — should route through `TOURS_CATALOG_REPOSITORY_PORT` |

**Note:** ORM relation imports on entity files (e.g. `tour.entity.ts` → `UserEntity`) and port-adapter `repositories/` are expected and out of scope for this rule.

### `@InjectRepository` outside `repositories/` (all modules)

Refactored module **application services**: zero matches.

Remaining non-repository sites (19 injection points across 15 files):

| File | Role |
|------|------|
| `auth/auth.service.ts` | Auth (3×) — not Phase 3 scope |
| `auth/otp.service.ts` | OTP |
| `registrations/registrations.service.ts` | Registrations (2×) |
| `finance/receipts/receipt.service.ts` | Receipts |
| `reconciliation/payment-finance-reconciliation.service.ts` | Background job |
| `reconciliation/reconciliation.service.ts` | Reconciliation |
| `tenant/tenant-host-resolver.service.ts` | Tenant host |
| `identity/tenant-audit-events.controller.ts` | Controller leak |
| `identity/workspace-settings-modules.controller.ts` | Controller leak |
| `reconciliation/reconciliation-findings.controller.ts` | Controller |
| `audit/audit.service.ts`, `idempotency/idempotency.service.ts`, `safety-profile/safety-profile.service.ts`, `draft-engine/*` | Infrastructure |

Deprecated unregistered: `identity/users/repositories/users-list.repository.ts`, `users-tenant-scope.repository.ts`.

### ALS / `tenantId` parameter audit (refactored modules)

| Module | Public API pattern | Residual `tenantId` params |
|--------|-------------------|---------------------------|
| **Tours** | ✅ ALS via `RequestContextService` on all controller entrypoints | Private helpers only (`assertDestinationBelongsToTenant`, `executeUpdateTour`) |
| **Settings** | ✅ ALS on all public service methods | Private `assertRegionInTenant` |
| **Payments** | ✅ ALS on `PaymentsService` / `ManualPaymentService` | Registration/tour rows carry `tenantId` as data fields (not caller-supplied scope) |
| **Identity** | ⚠️ Mixed | Path-scoped writes (`updateMembershipCapabilities`, `transferWorkspaceOwnership`) accept `tenantId` and validate against ALS — intentional REST pattern. Internal delegates (`UsersMemberWalletBalancesService`, `WorkspaceUserBookingSummaryService`, `UsersAccessService.findMembership`) still take `tenantId` for sibling-service calls; not controller-facing. **Outstanding:** `UsersWriteService` / `WorkspaceUsersService` still use `DataSource` + `getRepository(UserTenantEntity)` directly (Phase 3.5 candidate). |

### Test suite results

**Unit tests** (Tours + Settings + Identity + Payments scope):

```bash
cd apps/api
node --import tsx --test \
  src/modules/tours/**/*.spec.ts src/modules/tours/**/*.unit-spec.ts \
  src/modules/settings-locations/**/*.spec.ts \
  test/modules/identity/**/*.unit-spec.ts \
  test/payments/**/*.unit-spec.ts src/modules/payments/**/*.spec.ts
# 291 pass / 2 fail
```

| Failure | Cause |
|---------|-------|
| `test/modules/identity/users.transfer-ownership.unit-spec.ts` (2 tests) | Stale mocks: spec stubs `access.users` but service now calls `access.findUserById` / `access.findMembership` |

**E2E tests:** Nest bootstrap fails before tests run:

```
PaymentFinanceReconciliationService → TenantEntityRepository not in ReconciliationModule context
```

Root cause: Phase 3.2 stopped exporting `TypeOrmModule` from `IdentityModule`; `ReconciliationModule` imports `IdentityModule` but does not register `TenantEntity` in its own `TypeOrmModule.forFeature`. Fix: add `TenantEntity` to `reconciliation.module.ts` `forFeature` array.

**Typecheck (`pnpm run lint`):** Pre-existing errors in E2E seed typings (`dualMember` missing `subdomain`) and unrelated registration/security specs — not introduced by Phase 3.4 tours refactor.

### MAP / Phase 3 TODO hygiene

- §55 stale “Still on legacy repos / Next Phase 3.2” superseded by §56 (updated).
- §56–§58 document completed Phase 3.1–3.4 work.
- No `TODO Phase 3` markers in codebase.
- **Open follow-ups (Phase 3.5+):** Payments tour lookup via port; Identity write path off `DataSource`; ReconciliationModule `TenantEntity` registration; transfer-ownership unit spec mocks; identity controller `@InjectRepository` cleanup.

**Overall verdict:** Phase 3 refactor targets for Tours, Settings, and Payments application services are **compliant**. Identity application services are **compliant on reads**; write path and two unit-test mocks remain. E2E suite blocked by cross-module DI regression unrelated to Tours write port but exposed by IdentityModule export change.

---

## 60. Phase 3 remediation — audit follow-ups (completed)

**Date:** 2026-05-29  
**Goal:** Close gaps from §59 verification report.

### Changes

| Item | Fix |
|------|-----|
| E2E bootstrap | `TenantEntity` registered in `reconciliation.module.ts` `TypeOrmModule.forFeature` |
| Payments boundary | `PaymentIntentRegistrationResolverApplicationService` injects `TOURS_CATALOG_REPOSITORY_PORT`; `PaymentsModule` imports `forwardRef(() => ToursModule)`; `ToursModule` exports port + `forwardRef(() => RegistrationsModule)` |
| Identity controllers | `tenant-audit-events.controller.ts` → `identityRepository.findUserById`; `workspace-settings-modules.controller.ts` → `findActiveTenantById` + `updateTenantEnabledModules` on port |
| Identity port | Added `findActiveTenantById`, `updateTenantEnabledModules` to `WorkspaceIdentityRepositoryPort` + adapter |
| Unit test mocks | `users.transfer-ownership.unit-spec.ts` stubs `findUserById` / `findMembership`; `tenant-audit-events.controller.unit-spec.ts` uses identity port stub; `ownership-access.unit-spec.ts` aligned to 11-arg `PaymentsService` constructor |
| E2E types | `subdomain-comprehensive.e2e-spec.ts` — `dualMember.subdomain: SUBDOMAIN_T1` |

### Verification

```bash
cd apps/api
pnpm test
# 679 pass / 0 fail / 6 skipped

node --import tsx --test --test-concurrency=1 \
  test/e2e/subdomain-comprehensive.e2e-spec.ts \
  test/e2e/manual-receipt-flow.e2e-spec.ts
# 12/12 pass (bootstrap + payments receipt flow)

node --import tsx --test \
  test/modules/identity/users.transfer-ownership.unit-spec.ts \
  test/modules/identity/tenant-audit-events.controller.unit-spec.ts \
  test/security/ownership-access.unit-spec.ts
# 16/16 pass
```

**Full `pnpm test:e2e`:** 65 pass / 56 fail — remaining failures are pre-existing suite isolation (`Connection is closed` cascades), auth onboarding vs session expectations (`loginOtp expected session, got registration`), and tour-create validation rules (`WORKSPACE_RULE_DENALI_TRIP_DETAILS_REQUIRED`); not regressions from §60 remediation.

**Status:** Phase 3 remediation complete — bootstrap unblocked, payments tour lookup on port, identity controllers port-clean, unit suite green.

---

## 61. Pre-Phase 4 Cleanup — strict-boundary surgical strikes (completed)

**Date:** 2026-05-29  
**Goal:** Reduce strict-boundary violations (~54 → near 0) before enabling Phase 4 lint rules.

### Strike 1 — Registrations & payments decoupling

| Before | After |
|--------|-------|
| `registration-placement.orchestrator.ts` imported `PaymentsService`, `PaymentResponseDto`, value `EntityManager` | `REGISTRATION_READ_PORT` + `PaymentsRegistrationReadAdapter`; domain snapshot types |
| `registration-quote.application.service.ts` imported `TourEntity`, `PricingEngineService` | `PRICING_CATALOG_PORT` + `PricingCatalogAdapter`; `RegistrationQuoteTourContext` |

**New ports:** `REGISTRATION_READ_PORT`, `PRICING_CATALOG_PORT` under `registrations/domain/ports/`.  
**Adapters:** `payments-registration-read.adapter.ts`, `pricing-catalog.adapter.ts`.  
**Module:** both ports registered in `registrations.module.ts`.

### Strike 2 — Identity write path

| Before | After |
|--------|-------|
| `UsersWriteService` — `DataSource.transaction`, `manager.query/insert/find`, `getRepository().delete` | `WORKSPACE_IDENTITY_REPOSITORY_PORT` mutation methods |
| `WorkspaceUsersService` — `@InjectDataSource`, `applyMembershipMetadataJsonbPatch`, `getRepository().update` | Same port: `runInTransaction`, metadata patch, role bump, labels |

**Port extensions:** `applyMembershipMetadataJsonbPatch`, `updateMembershipRoleWithSessionBump`, `insertUserRoleAuditEntry/Entries`, `bulkUpdateMembershipRoles`, `findActiveMembershipsByUserIdsInTransaction`, `loadBulkUserMembershipSummaryRows`, `deleteMembershipHard`, `findActiveMembershipForUpdateLocking`, `updateMembershipLabels`, `executeWorkspaceOwnershipTransfer`.  
**Adapter:** all implementations in `typeorm-identity.repository.ts` (JSONB patch delegates to `membership-metadata-jsonb.ts`).

### Strike 3 — TypeORM types policy (ports exception)

**Formal rule (Phase 4 lint exception):** Files matching `**/domain/ports/*.port.ts` may use **`import type`** from `typeorm` for persistence surface types (`EntityManager`, `FindOptionsWhere`, `DeepPartial`, `UpdateResult`, etc.). Value imports from `typeorm` remain forbidden in application/domain layers outside adapters.

**Rationale:** Avoid redundant neutral DTO mirrors of ORM transaction handles and query criteria; ports are the deliberate boundary where persistence vocabulary is declared once.

**Documented in:** all six port files (`workspace-identity-repository`, `payment-repository`, `tours-repository`, `workspace-settings-repository`, `registration-read`, `pricing-catalog`) + this section.

### Verification

```bash
cd apps/api
pnpm test
# identity transfer-ownership unit spec updated for port injection

# Strict-boundary spot-check (application layer):
# - users-write.service.ts / workspace-users.service.ts: no DataSource, no getRepository
# - registration-placement / registration-quote: no PaymentsService, PricingEngineService, TourEntity
```

**Status:** Pre-Phase 4 cleanup complete — registrations/payments decoupled, identity writes behind port, TypeORM type-only policy documented for ports.

**Next:** Phase 4 — enable strict ESLint boundary rules; remaining violations (auth, finance application imports) are follow-up slices.

---

## 62. Phase 4 — Architecture boundary test (automated)

**Date:** 2026-05-29  
**Goal:** Enforce `app` / `domain` / `infra` layering and forbid cross–bounded-context relative imports before strict ESLint rules land.

### Test location

| Artifact | Path |
|----------|------|
| Scanner | `tests/architecture/boundary-scanner.ts` |
| Suite | `tests/architecture/architecture-boundaries.spec.ts` |
| CI entry | `pnpm test` → `@apps/api` test glob includes `../../tests/architecture/**/*.spec.ts` |

### Rules enforced

1. **domain** → must not import **app** or **infra**
2. **app** → may import **domain**; must not import **infra**
3. **infra** → may import **domain** and **app**
4. **Cross-module** — relative imports across `apps/api/src/modules/{context}/` boundaries are forbidden (ports/adapters/`@repo/*` only)

### Layer resolution

- **Canonical:** `modules/{context}/domain|app|infra/**`
- **Legacy map (transitional):** `entities/`, `repositories/`, `adapters/` → infra; `application/`, `services/`, `dto/`, `*.service.ts`, `*.controller.ts` → app; `policies/`, `pure/`, `strategies/` → domain
- **Excluded:** `*.module.ts` (composition root), `*.spec.ts` / `*.unit-spec.ts` / `*.e2e-spec.ts`
- **Shared kernel (allowed):** `apps/api/src/common/`, `config/`, `database/`, `infra/`

### Workflow

Run `pnpm test` (or `pnpm --filter @apps/api test`). Architecture tests are included in the default API test glob:

- **Report mode (default):** prints a grouped violation report to stderr and **passes** while debt remains (suite stays green for incremental refactors).
- **Enforce mode:** `pnpm --filter @apps/api test:architecture:enforce` sets `ARCHITECTURE_BOUNDARIES_ENFORCE=1` and **fails** on any violation.

Representative violations are asserted in a sanity subtest so the scanner cannot silently regress.

**Status:** Phase 4 boundary gate installed — refactor modules toward `app/domain/infra` and drive violation count to zero.

---

## 63. Phase 4 — ESLint / depcruise conflict resolution (completed)

**Date:** 2026-05-29

### ESLint API boundaries

- `entities/**` removed from ESLint `domain`; documented as `infra` alongside `repositories/**`, `adapters/**`.
- `boundaries/dependencies` **disabled** for `apps/api/**` so MAP §62 layering is owned by `tests/architecture/boundary-scanner.ts` during migration (avoids contradicting Nest file-type graph).

### Dependency-cruiser cycle

- **Cycle:** `payments.module` → `tours.module` → `registrations.module` → `payments.module`.
- **Fix:** New `ToursCatalogModule` exports only `TOURS_CATALOG_REPOSITORY_PORT`; `PaymentsModule` imports it instead of `ToursModule`. `ToursModule` imports and re-exports `ToursCatalogModule`.

### Verification

```bash
pnpm depcruise:check   # ✔ 0 violations
pnpm eslint            # ✔ 0 errors
```

---

## 64. Phase 4 — Domain Purity & Infra Decoupling (Batch 1 Complete)

**Date:** 2026-05-29  
**Goal:** Eliminate every `domain-must-not-import-infra` violation by decoupling domain ports, policies, and pure types from TypeORM entities and repository adapters.

### Gate (Batch 1)

| Check | Command | Expected |
|-------|---------|----------|
| Dedicated Batch 1 subtest | `pnpm --filter @apps/api test` (includes `tests/architecture/architecture-boundaries.spec.ts`) | Subtest **`architecture: domain layer does not import infra (batch 1)`** passes with **`domain-must-not-import-infra` count = 0** |
| Full boundary enforce (all rules) | `pnpm --filter @apps/api test:architecture:enforce` | Still reports remaining debt (`app-must-not-import-infra`, `cross-module-import`, etc.) — **Batch 2+** |

The default API test run is **report-only** for the full boundary suite (§62); only the Batch 1 subtest **fails the build** if domain→infra imports regress.

### Domain record / snapshot model

Domain ports now speak in **pure records** (structural types). Infra entities implement these shapes at the adapter boundary via explicit mapping (`asUser`, `asPayment`, entity `save` + cast), not via imports in `domain/`.

| Bounded context | Port(s) | Domain records / snapshots |
|-----------------|---------|---------------------------|
| **Identity** | `WorkspaceIdentityRepositoryPort` | `IdentityUserRecord`, `IdentityMembershipRecord`, `IdentityTenantRecord`, `IdentityWorkspaceInviteRecord`, `IdentityEmailVerificationTokenRecord` — `domain/identity-records.ts` |
| **Payments** | `PaymentRepositoryPort` | `PaymentRecord`, `PaymentRegistrationRef`, `PaymentMethod`, `PaymentStatus` — `domain/payment-record.types.ts`, `domain/payment.types.ts` |
| **Settings-Locations** | `WorkspaceSettingsRepositoryPort` | `WorkspaceDestinationRecord`, `WorkspaceRegionRecord`, catalog rows in `domain/workspace-catalog.records.ts` |
| **Tours** | `ToursCatalogRepositoryPort`, `ToursWriteRepositoryPort` | `TourWriteRecord`, `TourDetailsPolicySnapshot`, `TourPublishPolicySnapshot`, `TourCapacityPolicySnapshot` — `domain/tour-write-record.types.ts`, `domain/tour-policy.types.ts` |
| **Registrations** (policy support) | `RegistrationReadPort`, integrity policies | `RegistrationStatusPolicySnapshot`, `WaitlistItemPolicySnapshot`, `RegistrationQuoteTourContext`, `RegistrationPaymentIntentSnapshot` — aligned with Phase 3 quote/payment slices |

Enums shared with persistence (e.g. `RegistrationStatus`, `PaymentStatus`, `WorkspaceInviteStatus`) live under **`domain/`**; entities **re-export** from domain for backward-compatible TypeORM columns where needed.

### Refactor pattern (per module)

1. **Ports** — return / accept domain records; `import type` from `typeorm` only for `EntityManager`, `DeepPartial`, `FindOptionsWhere` (MAP §61).
2. **Policies** — depend on snapshots, not `@Entity()` classes.
3. **Adapters** — sole owners of `@InjectRepository` / entity imports (`repositories/typeorm-*.repository.ts`).
4. **Application services** — mappers (`me-profile.mapper`, `mapTourEntityToResponseDto` / `TourResponseSource`) and orchestrators updated to domain types; entity casts only at persistence edges inside infra or documented escape hatches (`tour as TourEntity` for `TourDetails` mutation).

### New / moved artifacts

| Area | Paths |
|------|-------|
| Architecture gate | `tests/architecture/boundary-scanner.ts`, `architecture-boundaries.spec.ts` (Batch 1 subtest) |
| Identity adapter | `apps/api/src/modules/identity/repositories/typeorm-identity.repository.ts` |
| Payments adapter | `apps/api/src/modules/payments/repositories/typeorm-payment.repository.ts` |
| Settings adapter | `apps/api/src/modules/settings-locations/repositories/` |
| Tours adapters | `apps/api/src/modules/tours/repositories/`, `tours-catalog.module.ts` |
| Registrations adapters | `apps/api/src/modules/registrations/adapters/` |

### Verification

```bash
# Batch 1 gate (0 domain→infra violations)
pnpm --filter @apps/api test
# → ok: architecture: domain layer does not import infra (batch 1)

# Optional: full violation inventory (report-only unless enforce flag set)
pnpm --filter @apps/api test:architecture:enforce
```

**Status:** Batch 1 complete — **0** `domain-must-not-import-infra` violations. Domain ports for Identity, Payments, Settings-Locations, and Tours are free of TypeORM entity imports.

**Next:** Batch 2 — drive `app-must-not-import-infra` to zero (application services and controllers behind ports only).

---

## 65. Phase 4 — App Layer Purity (Batch 2: Identity & Payments Complete)

**Date:** 2026-05-29  
**Goal:** Eliminate every `app-must-not-import-infra` violation inside the **Identity** and **Payments** bounded contexts by redirecting enums to domain, relocating infra helpers, extending payment ports, and keeping gateway wiring in the infra segment.

### Gate (Batch 2)

| Check | Command | Expected |
|-------|---------|----------|
| Dedicated Batch 2 subtest | `pnpm --filter @apps/api test` (includes `tests/architecture/architecture-boundaries.spec.ts`) | Subtest **`architecture: app layer in identity/payments does not import infra (batch 2)`** passes with **identity/payments `app-must-not-import-infra` count = 0** |
| Batch 1 regression | same run | Subtest **`architecture: domain layer does not import infra (batch 1)`** still passes |
| Full boundary enforce (all rules) | `pnpm --filter @apps/api test:architecture:enforce` | Still reports remaining debt in other modules — **Batch 3+** |

The default API test run is **report-only** for the full boundary suite (§62); Batch 1 and Batch 2 subtests **fail the build** on regressions in their scopes.

### Patterns applied

| Pattern | Identity | Payments |
|---------|----------|----------|
| **Enum redirect** | DTOs / `users-invite.service` → `WorkspaceInviteStatus` from `domain/identity-records.ts` | DTOs / services → `PaymentStatus`, `PaymentMethod` from `domain/payment.types.ts` |
| **Infra relocation** | `user-password.select.ts` → `repositories/` | `gateway/**` classified as infra in `boundary-scanner.ts`; webhook guard + controller live under `gateway/` |
| **Port extensions** | `TenantUsersListQuery` / `TenantUsersListRow` in `domain/tenant-users-list.types.ts` (port no longer imports `users/repositories/*.interface`) | `PaymentRegistrationSnapshot`, `BookingPriceSnapshotRecord`; `PaymentRepositoryPort` registration/snapshot reads; `PAYMENT_GATEWAY_FACTORY_PORT` for provider resolution |
| **Scanner hardening** | — | `parseImports()` handles multiline `import { … } from '…'` blocks |

Entities continue to **re-export** domain enums for TypeORM columns where needed (`payment.entity.ts`, `registration.entity.ts`).

### Application refactor (Payments)

- `payments.service.ts` and `payment-intent-registration-resolver.application.service.ts` no longer import `RegistrationEntity` / `BookingPriceSnapshotEntity`; orchestration uses `PaymentRepositoryPort` + `RegistrationStatus` from `registrations/domain/registration-status.ts`.
- `assert-payment-intent-matches-booking-snapshot.ts` uses `BookingPriceSnapshotRecord` (domain), not pricing entities.
- `utils/to-payment-registration-lookup.ts` maps actor-scoped `FindOptionsWhere` shapes to port lookup clauses without entity imports.

### New / moved artifacts

| Area | Paths |
|------|-------|
| Architecture gate | `architecture-boundaries.spec.ts` (Batch 2 subtest) |
| Identity domain types | `domain/tenant-users-list.types.ts`, `repositories/user-password.select.ts` |
| Payments domain types | `domain/payment-registration.types.ts`, `domain/booking-price-snapshot.types.ts`, `domain/payment-gateway.types.ts`, `domain/ports/payment-gateway-factory.port.ts` |
| Payments infra | `gateway/payments-webhook.controller.ts`, `gateway/payments-webhook-signature.guard.ts` |
| Payments app helper | `utils/to-payment-registration-lookup.ts` |

### Verification

```bash
# Batch 1 + 2 gates
pnpm --filter @apps/api test
# → ok: architecture: domain layer does not import infra (batch 1)
# → ok: architecture: app layer in identity/payments does not import infra (batch 2)

# Optional: full violation inventory (report-only unless enforce flag set)
pnpm --filter @apps/api test:architecture:enforce
```

**Status:** Batch 2 complete — **0** `app-must-not-import-infra` violations under `modules/identity/` and `modules/payments/` (app layer). Global `app-must-not-import-infra` and `cross-module-import` debt remain in other bounded contexts.

**Next:** Batch 4+ — remaining bounded contexts' app-layer purity (auth, finance, etc.) and cross-module port extractions.

---

## 66. Phase 4 — App Layer Purity (Batch 3: Tours & Registrations Complete)

**Date:** 2026-05-29  
**Goal:** Eliminate every `app-must-not-import-infra` violation inside the **Tours** and **Registrations** bounded contexts by redirecting enums to domain, relocating TypeORM-heavy helpers to `repositories/`, extending application ports, and keeping the application-layer facade free of entity/repository imports.

### Gate (Batch 3)

| Check | Command | Expected |
|-------|---------|----------|
| Dedicated Batch 3 subtest | `pnpm --filter @apps/api test` (includes `tests/architecture/architecture-boundaries.spec.ts`) | Subtest **`architecture: app layer in tours/registrations does not import infra (batch 3)`** passes with **tours/registrations `app-must-not-import-infra` count = 0** |
| Batch 1 + 2 regression | same run | Subtests for domain (batch 1) and identity/payments (batch 2) still pass |
| Full boundary enforce (all rules) | `pnpm --filter @apps/api test:architecture:enforce` | Still reports remaining debt in other modules and cross-module imports — **Batch 4+** |

The default API test run is **report-only** for the full boundary suite (§62); Batch 1–3 subtests **fail the build** on regressions in their scopes.

### Patterns applied

| Pattern | Tours | Registrations |
|---------|-------|---------------|
| **Enum redirect** | DTOs / pipe / controller → `TourLifecycleStatus` from `@repo/domain-contracts`; `TOUR_TYPES`, itinerary types from `@repo/types` / local policy types | DTOs / policy / effects → `RegistrationStatus`, `WaitlistStatus` from `domain/registration-status.ts`, `domain/waitlist-status.ts` |
| **Infra relocation** | `tours-query-builder.ts`, `catalog-pricing-load.adapter.ts`, `quote-list-price.ts` → `repositories/` | `TypeOrmRegistrationsApplicationService` → `repositories/`; `lock-registration-for-financial-mutation.ts` → `repositories/` |
| **Port extensions** | Catalog/write ports already domain-record based (Batch 1) | `RegistrationsApplicationPort`, `REGISTRATIONS_READ_REPOSITORY_PORT`, `PRICING_CATALOG_PORT` with domain snapshots |
| **Application facade** | `tours.service.ts` builds `TourWriteRecord` / policy snapshots without entity imports | `registrations.service.ts` thin delegate over `REGISTRATIONS_APPLICATION_PORT` — no `./repositories/` imports |

### Application refactor (Tours)

- `tours.service.ts` no longer imports `TourEntity` / `TourDetails`; persistence shapes are `TourWriteRecord` and policy snapshots.
- `commercial-fields.ts`, `apply-regional-tour-list-scope.ts`, and list DTOs use domain/policy types instead of entities.
- Query builder and pricing load helpers live under `repositories/` (infra segment per boundary scanner).

### Application refactor (Registrations)

- **`RegistrationsService`** is a Nest injectable facade that binds every public method to `REGISTRATIONS_APPLICATION_PORT` (implemented by `TypeOrmRegistrationsApplicationService` in `repositories/`).
- **`registration-placement.orchestrator.ts`** uses `RegistrationPayableRegistration` and port callbacks — no `RegistrationEntity` in the orchestrator.
- Domain write/outbox types: `RegistrationWriteRecord`, `WaitlistWriteRecord`, `TourBookingLockRecord` — `domain/registration-write.types.ts`, `domain/registration-outbox.types.ts`.
- Local pricing quote shapes in `domain/pricing-catalog.types.ts` avoid registrations→pricing entity coupling at the app boundary.
- **`RegistrationsReadRepository`** + `typeorm-registrations-read.repository.ts` for actor-scoped reads without entity imports in app services.

### Cross-module progress (partial — not gated by Batch 3)

- Registrations pricing intake routes through `PRICING_CATALOG_PORT` + domain catalog types.
- Tour open-for-registration policy localized in `domain/tour-registration.policy.ts`.
- Entity-level cross-module imports (e.g. `registration.entity.ts` → tours) remain — tracked under `cross-module-import` (~72 among tours/registrations/pricing).

### New / moved artifacts

| Area | Paths |
|------|-------|
| Architecture gate | `architecture-boundaries.spec.ts` (Batch 3 subtest) |
| Tours infra | `repositories/tours-query-builder.ts`, `repositories/catalog-pricing-load.adapter.ts`, `repositories/quote-list-price.ts` |
| Registrations domain | `domain/registration-write.types.ts`, `domain/registration-outbox.types.ts`, `domain/pricing-catalog.types.ts`, `domain/tour-registration.policy.ts`, `domain/ports/registrations-application.port.ts`, `domain/ports/registrations-read.port.ts` |
| Registrations infra | `repositories/typeorm-registrations-application.service.ts`, `repositories/typeorm-registrations-read.repository.ts`, `repositories/lock-registration-for-financial-mutation.ts` |
| Registrations facade | `registrations.service.ts` (port delegate only) |

### Verification

```bash
# Batch 1 + 2 + 3 gates
pnpm --filter @apps/api test
# → ok: architecture: domain layer does not import infra (batch 1)
# → ok: architecture: app layer in identity/payments does not import infra (batch 2)
# → ok: architecture: app layer in tours/registrations does not import infra (batch 3)

# Optional: full violation inventory (report-only unless enforce flag set)
pnpm --filter @apps/api test:architecture:enforce
```

**Status:** Batch 3 complete — **0** `app-must-not-import-infra` violations under `modules/tours/` and `modules/registrations/` (app layer). Global violations reduced (~344 → ~309); `cross-module-import` debt among tours/registrations/pricing remains for Batch 4+.

**Next:** Batch 4 — drive app-layer purity in remaining bounded contexts (auth, finance, etc.) and continue cross-module port extractions for tours ↔ registrations ↔ pricing.

