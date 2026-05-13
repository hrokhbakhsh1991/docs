# Tour Management → Secure Multi-Tenant Financial Platform

**Document type:** Project execution design (implementation-ready)  
**Output:** This file is the single source for phased delivery, modules, risks, and Phase 1 execution.

---

## 1. Executive overview

| Item | Description |
|------|-------------|
| **Program goal** | Refactor the tour management product into a **secure multi-tenant** system with **registration/booking** and **finance**, with auditable, server-enforced controls. |
| **Delivery model** | Four sequential phases; each phase ships stabilizing or enabling work before the next expands scope. |
| **Core engineering rules** | Tenant from **server context only**; **RBAC** on every mutation; **Zod** at API boundaries; **domain events** + **transactional outbox** for cross-module effects; **audit** for money and privilege. |

---

## 2. Phased roadmap

### Phase 1 — Critical fixes & stabilization

| Dimension | Detail |
|-----------|--------|
| **Goals** | Remove tenant and authorization foot-guns; standardize API errors and observability; lock data integrity basics; document request pipeline and RBAC matrix. |
| **Tasks** | Map all tenant-scoped tables; enforce `tenantId`/`workspaceId` from membership/token pipeline only; add/repair guards on write routes; RBAC matrix tests or route meta-tests; standard error JSON; critical FKs/unique indexes; structured logging with correlation IDs; feature flags for risky UI/API paths; incident/rollback runbook. |
| **Deliverables** | Signed-off request-context diagram; failing CI on unguarded writes (if tooling adopted); error contract doc; DB constraint review notes; Phase 1 checklist **§6**; operational stubs **§8**. |

---

### Phase 2 — Module refactoring & event-driven foundations

| Dimension | Detail |
|-----------|--------|
| **Goals** | **Bounded modules**, acyclic dependencies, **application services** as orchestration; **domain events** and **transactional outbox** (or approved interim) for reliable side effects. |
| **Tasks** | Split or label packages: identity, rbac, users, tours-wizard, booking, finance, settings; forbid cross-layer “reach-in” imports; introduce event catalog; outbox table + publisher worker; idempotent consumers; optional shared `contracts` package (Zod + event types). |
| **Deliverables** | Module dependency diagram; event catalog v1; outbox in production path with monitoring; coding standard for imports and use-case entry points. |
| **Architecture extensions** | See **§12–§15** (finance bounded context, domain events, repository pattern, pricing snapshots) — design-only for Phase 2 execution. |

---

### Phase 3 — Feature enhancement (registration, booking, finance)

| Dimension | Detail |
|-----------|--------|
| **Goals** | First-class **booking** aggregate with lifecycle and capacity rules; **payments/refunds** and reconciliation; rich **audit** on financial and role changes; optional **shadow mode** for pricing experiments. |
| **Tasks** | Booking state machine; idempotency keys on create/confirm; payment capture/refund use cases; signed PSP webhooks + deduplication; reconciliation job; admin/support audit export or UI; integrate wizard/tour offerings with booking read model. |
| **Deliverables** | OpenAPI (or equivalent) for booking and finance routes; integration tests for webhooks and idempotency; shadow pricing metrics if used. |
| **Architecture extensions** | See **§17–§21** (pricing engine, payment gateway abstraction + idempotency, safety profiles, ledger / wallet / credits, Phase 3 execution notes) — **design only**; no PSP integration code in this document. |

---

### Phase 4 — Optimization, audit hardening & legacy cleanup

| Dimension | Detail |
|-----------|--------|
| **Goals** | Scale and cost control under multi-tenant load; **audit completeness** review; remove legacy code paths after measured zero use behind flags. |
| **Tasks** | Load test hot paths; index/query tuning; N+1 elimination; per-tenant job quotas; pen-test remediation; delete deprecated tour-create/wizard duplicates after N releases at zero traffic. |
| **Deliverables** | Load-test summary; audit gap closure or risk acceptance with expiry; legacy removal changelog. |
| **Production readiness extensions** | See **§22–§26** (audit trail UI + logged events, list virtualization + caching, legacy string-role cleanup, CI tenant/RBAC checks, Phase 4 execution notes). |

---

## 3. Modules & domains

### 3.1 Auth & identity

| Area | Specification |
|------|----------------|
| **Responsibilities** | Authentication (session/JWT/OAuth-ready), principal resolution (`userId`, subject), token lifecycle, secure binding to subsequent authorization and tenant resolution. |
| **Inputs** | Credentials, refresh tokens, (future) OAuth callback payloads. |
| **Outputs** | Authenticated `Principal`; session or access token; **no** unsanctioned tenant claims without membership lookup. |
| **Dependencies** | User store (minimal), secrets/KMS, tenant membership service. |
| **Best practices** | Short-lived access tokens; rate limiting on auth endpoints; rotation runbooks; avoid PII in logs beyond policy. |

---

### 3.2 RBAC

| Area | Specification |
|------|----------------|
| **Responsibilities** | Role-to-ability mapping; enforce on **every** mutating use case; stable deny/allow semantics; optional billing-scoped roles. |
| **Inputs** | `Principal`, `tenantId`, resource type, action, optional resource id. |
| **Outputs** | Allow/deny + internal reason codes for logs; HTTP 403 with safe client message. |
| **Dependencies** | Membership records, policy config, ability factory (e.g. CASL) per request. |
| **Best practices** | Type-safe `Role` / `Action` enums; deny-by-default; policy matrix unit tests; CI guard for new routes. |

---

### 3.3 User management

| Area | Specification |
|------|----------------|
| **Responsibilities** | Directory, invites, profiles, labels, suspension; role changes; list APIs that never leak cross-tenant PII. |
| **Inputs** | Admin commands: invite, change role, update profile, suspend. |
| **Outputs** | Filtered DTOs; domain events e.g. `RoleChanged`, `UserInvited`. |
| **Dependencies** | Auth & identity, RBAC, audit, notifications. |
| **Best practices** | Cursor pagination; emit events for cache invalidation and audit; optional dual-control for destructive org actions. |

---

### 3.4 Tours wizard

| Area | Specification |
|------|----------------|
| **Responsibilities** | Tour aggregate aligned to wizard steps; themes/presets from settings; trip details / form-profile versioning; clone/edit where in scope. |
| **Inputs** | Wizard patches, create/update DTOs (Zod-validated), preset/theme ids validated server-side. |
| **Outputs** | Tour read models; validation errors with stable `code` for UI. |
| **Dependencies** | RBAC, settings, (later) booking read models for availability. |
| **Best practices** | Single mapper from wizard → domain command; feature-flag schema changes; validate preset application twice (write + apply). |

---

### 3.5 Registration & booking

| Area | Specification |
|------|----------------|
| **Responsibilities** | Offerings/capacity; booking lifecycle; pricing snapshot at book time; participants; cancellation/waitlist if in scope; idempotent creation. |
| **Inputs** | Commands e.g. create/confirm/cancel with `idempotencyKey` where required. |
| **Outputs** | `bookingId`, status, next steps (e.g. payment required); `409`/`422` with machine-readable codes. |
| **Dependencies** | Tours wizard/read models, finance, users, RBAC, audit. |
| **Best practices** | Explicit state machine; optimistic locking; events `BookingCreated`, `BookingConfirmed`, `BookingCancelled`; outbox for downstream work. |

---

### 3.6 Finance

| Area | Specification |
|------|----------------|
| **Responsibilities** | Capture, refunds, credits, invoices/receipt artifacts; PSP webhooks; reconciliation; internal ledger or append-only money facts. |
| **Inputs** | Internal payment/refund commands; signed webhooks with raw payload storage. |
| **Outputs** | Payment/refund ids; ledger lines; invoice URLs; events `PaymentCaptured`, `RefundIssued`. |
| **Dependencies** | Booking state, users (billing), settings (currency/tax hooks), audit. |
| **Best practices** | Webhook signature + idempotency; no balance changes only in memory; shadow pricing optional (log diff, legacy charge until flag ON). |

---

### 3.7 Settings

| Area | Specification |
|------|----------------|
| **Responsibilities** | Tenant defaults: tour themes/presets, form defaults, finance profile references; integration secret **references** only. |
| **Inputs** | Settings DTOs validated with Zod. |
| **Outputs** | Resolved config for API and wizard; versioned documents when shape evolves. |
| **Dependencies** | RBAC (high privilege), audit, vault/KMS. |
| **Best practices** | Cache with TTL + invalidation on write; audit every change with actor + tenant. |

---

## 4. Risk & dependency analysis

| Risk / fragile point | Impact | Mitigation |
|---------------------|--------|------------|
| Tenant ID from client body or URL without membership check | Cross-tenant data exposure | Context-only tenant; e2e isolation tests; optional RLS; CI patterns for dangerous access |
| New endpoint without RBAC | Unauthorized mutation | Decorator convention + meta-tests; PR checklist |
| Booking saved, payment not (or inverse) | Customer/trust loss | Transactional outbox; saga with compensation; reconciliation |
| Webhook spoofing/replay | Financial fraud | Signature verify, dedupe by provider event id |
| Wizard DTO vs API drift | Silent data loss | Shared Zod/OpenAPI; fixture contract tests |
| Optimistic UI without rollback | False success perception | Cache revert on error; idempotency keys; clear HTTP semantics |
| Incomplete audit | Disputes/compliance failure | Append-only audit; before/after for sensitive fields |

**Dependency rule:** Prefer **downward** dependencies: `finance` → `booking` interfaces, not `tours` repositories directly; use read facades or events.

---

## 5. Technical best practices

| Practice | Guidance |
|----------|----------|
| **Type-safe enums** | Roles, statuses, permissions as string enums or `as const`; DB constraints aligned. |
| **Domain events** | Facts emitted after invariants; versioned payloads; transactional outbox. |
| **Server-side tenant & RBAC** | AuthN → membership → tenant on context → AuthZ → tenant-scoped load → rules → persist. |
| **Audit trail** | Same transaction when feasible; actor, tenant, impersonation metadata. |
| **Optimistic UI rollback** | Mutation pending/success/error; revert client cache; disable double submit. |
| **Zod at API boundary** | One schema per command/route; `.strict()` in dev; reject unknown keys. |

---

## 6. Phase 1 checklist (execution)

- [ ] Inventory tenant/workspace columns for all scoped tables; document canonical naming.
- [x] Document middleware chain: AuthN → membership → context `tenantId` → abilities — see **§10.1** (design + pseudocode) and live order in `main.ts`.
- [ ] For every **POST/PATCH/PUT/DELETE**, verify tenant scope from context, not client-supplied tenant.
- [x] Phase 1 operational stubs (see **§8**): `TenantGuardMiddleware`, `UserRole` + JWT parse, `registrations.row_version`, `CaslMirrorAbilitiesGuard`, web `withOptimisticUsersRollback`.
- [ ] Add or fix automated tests: user in tenant A cannot read/write tenant B resources (including ID tampering).
- [ ] Maintain RBAC matrix (role × resource × action); file P0 gaps.
- [ ] Adopt CI or script to flag routes missing standard auth/RBAC wiring (if applicable to framework).
- [ ] Standardize API error shape: `code`, `message`, optional `details`; no stack traces in prod.
- [ ] Add/review FKs and per-tenant unique constraints for natural keys.
- [ ] Ensure secrets are not in client bundles; settings use references to vault/KMS.
- [ ] Structured logs: `correlationId`, `tenantId`, `userId` per privacy policy.
- [ ] List feature flags for risky flows with owner and default-off in production until verified.
- [ ] Publish incident, rollback, and flag-toggle runbook.

---

## 7. Master phase checklist (summary)

| Phase | Gate (all should be true before next phase) |
|-------|-----------------------------------------------|
| **1** | §6 complete; no known P0 tenant/RBAC gaps; errors and logging baseline shipped |
| **2** | Modules/outbox/event catalog live; forbidden imports enforced |
| **3** | Booking + finance paths tested including webhooks and idempotency |
| **4** | Load/audit/legacy criteria from Phase 4 roadmap met |

---

## 8. Phase 1 — operational execution (implemented stubs)

| Commit | Scope | Artifact / path |
|--------|--------|------------------|
| **C1** | Tenant guard (enforced) | `TenantGuardMiddleware` after `TenantMiddleware`: shared bypass list; **403 `TENANT_CONTEXT_REQUIRED`** when `tenantId` cannot be resolved for non-bypass routes. |
| **C2** | `UserRole` + `RequestActorRole` | Workspace enum: **Owner, Leader, Admin, Member, Viewer**; `InternalActorRole` for OpenAPI/workers; `RequestContext.role?: RequestActorRole`; JWT validated by `tryParseWorkspaceUserRole` (`AUTH_INVALID_ROLE`). |
| **C3** | Booking row version (DB) | `registrations.row_version` + entity `@VersionColumn`; users use `users.profile_row_version`; runtime schema guard enforces both columns. |
| **C4** | CASL mirror on Users API | `CaslMirrorAbilitiesGuard` on `UsersController` **class** `@UseGuards` (stacked with `AbilitiesGuard` on routes that declare `@CheckAbilities`). |
| **C5** | Optimistic rollback (web) | `withOptimisticUsersRollback`, `updateUserRoleWithOptimisticUsersRollback`, `bulkUpdateUserRoleWithOptimisticUsersRollback`; FE types use `UserRole` from `apps/web/lib/auth/user-role.ts`. |

### 8.1 Suggested git commands (sequential)

Run from repo root after review:

```bash
git add apps/api/src/common/middleware/tenant-guard.middleware.ts apps/api/src/app.module.ts apps/api/src/main.ts apps/api/test/e2e/bootstrap.ts
git commit -m "feat(api): add TenantGuardMiddleware skeleton after tenant resolution"

git add apps/api/src/common/auth/user-role.enum.ts apps/api/src/common/request-context/request-context.ts apps/api/src/common/request-context/request-context.service.ts apps/api/src/common/middleware/auth.middleware.ts apps/api/src/modules/auth/roles.guard.ts apps/api/src/documentation/documentation.module.ts apps/api/test/e2e/registrations.e2e-spec.ts apps/api/test/security/ownership-access.unit-spec.ts apps/api/test/registrations/update-registration-status.unit-spec.ts apps/api/test/registrations/payment.e2e-spec.ts
git commit -m "feat(api): type request context role as UserRole and validate JWT workspace roles"

git add apps/api/src/database/migrations/1777594100000-RegistrationRowVersion.ts apps/api/src/modules/registrations/registration.entity.ts apps/api/src/database/runtime-schema-guard.service.ts
git commit -m "feat(api): add registrations row_version for optimistic locking"

git add apps/api/src/common/casl/casl-mirror-abilities.guard.ts apps/api/src/common/casl/casl.module.ts
git commit -m "feat(api): add CaslMirrorAbilitiesGuard stub for stacked CASL checks"

git add apps/web/lib/services/users.service.ts PROMPT.MD
git commit -m "feat(web): stub optimistic users rollback helper; document Phase 1 in PROMPT.MD"
```

After applying the commands above, confirm with `git log -5 --oneline`.

---

## 9. Phase 2 handoff (next)

| Prerequisite | Status |
|--------------|--------|
| Phase 1 stubs merged | `TenantGuardMiddleware` now hard-fails missing tenant on protected routes; extend with per-route RLS session hints in Phase 2. |
| `UserRole` | Extend RBAC matrix tests to assert rejects for `AUTH_INVALID_ROLE`; align remaining DTO string literals with `UserRole` where helpful. |
| `registrations.row_version` | Apply optimistic checks in `RegistrationsService` update paths; return **409** on version conflict; expose `rowVersion` on registration JSON if needed for clients. |
| Web users rollback | Prefer `*WithOptimisticUsersRollback` wrappers or inline `withOptimisticUsersRollback` at mutation sites; existing `users-page-client` already restores cache on error. |
| CASL on other controllers | Replicate `CaslMirrorAbilitiesGuard` stacking pattern for payments, tours write, settings admin. |
| Modules / outbox | Proceed with **§2 Phase 2** roadmap; detailed **design** in **§12–§16** (finance context, events, repositories, pricing snapshots, execution notes). |

---

## 10. Phase 1 — stabilization design (reference)

### 10.1 Tenant isolation — `TenantGuardMiddleware` design

**Goal:** Every `/api/v2/**` request (except explicit bypasses) must have a **server-resolved** `tenantId` before controllers execute.

**Pipeline order (Nest `main.ts`):** `RequestContextMiddleware` → `TenantResolverMiddleware` → `AuthMiddleware` → `TenantMiddleware` → **`TenantGuardMiddleware`** → rate limit / usage.

**Bypass list (must stay aligned with `TenantMiddleware`):** public tour `register|waitlist`, public `GET /api/v2/registrations/:id`, `/health`, `/internal`, `/api/docs`, `/api/v2/auth/**`.

**Pseudocode:**

```
function tenantGuard(req):
  if shouldBypassTenantGuard(req):
    return next()
  tenantId := resolveEffectiveTenantId(req) // ALS + Host
  if tenantId is empty:
    log warn
    throw 403 TENANT_CONTEXT_REQUIRED
  if tryGetUserId() is set:
    log debug "authenticated tenant context"
  next()
```

**Note:** `TenantMiddleware` already rejects missing tenant (`TENANT_CONTEXT_MISSING`); this guard adds a **second explicit gate** and a distinct code for observability.

### 10.2 Role system — `UserRole` vs `RequestActorRole`

| Type | Values | Use |
|------|--------|-----|
| `UserRole` | `owner`, `leader`, `admin`, `member`, `viewer` | JWT workspace claims, `user_tenants.role`, API DTOs |
| `InternalActorRole` | `SYSTEM`, `none`, `worker`, `api` | OpenAPI build, background jobs, CASL placeholder contexts |
| `RequestActorRole` | `UserRole \| InternalActorRole` | `RequestContext.role` |

RBAC policy constants (`PERSISTED_WORKSPACE_MEMBERSHIP_ROLES`, `GENERAL_PATCH_ASSIGNABLE_ROLES`, `INVITE_ASSIGNABLE_ROLES`) are **derived from `UserRole`** to prevent string drift.

### 10.3 Versioning and concurrency — User, Booking (registration), ETag

| Model | Column | Purpose |
|-------|--------|---------|
| **User** (`users`) | `profile_row_version` (`@VersionColumn`) | Optimistic updates on profile / user row (existing) |
| **Booking** (`registrations`) | `row_version` (`@VersionColumn`) | Optimistic updates on registration lifecycle (Phase 1 migration) |

**ETag strategy (users directory):** `GET /api/v2/users/:id` sets weak ETag:

`ETag: W/"user:{id}:{profileRowVersion}"`

Clients may later send `If-Match` on mutating requests; server should return **412/409** when versions diverge (Phase 2 wiring for `PATCH` body + version).

### 10.4 RBAC sync — CASL + Nest guards (no UI-only for sensitive actions)

| Layer | Responsibility |
|-------|----------------|
| **UI** (`@/lib/casl`) | UX: hide/disable controls; **not** a security boundary. |
| **API coarse roles** | `RolesGuard` + `@Roles` for owner/admin-only surfaces. |
| **API fine-grained** | `AbilitiesGuard` + `@CheckAbilities` using `WorkspaceAbilityFactoryService` / `@repo/shared-rbac`. |
| **Defense in depth** | `CaslMirrorAbilitiesGuard` on `UsersController` re-evaluates the same `@CheckAbilities` metadata so a misconfigured `@Roles` list cannot widen CASL-protected routes unnoticed. |

**Sensitive user-directory actions** (invite, role change, suspend, remove, audit read) already carry `@CheckAbilities`; mirror guard applies to the whole controller.

### 10.5 Optimistic update safety — `users.service` (web)

| Helper | Behavior |
|--------|----------|
| `withOptimisticUsersRollback(run, callbacks?)` | Runs mutation; `onSuccess` after resolve; `onRollback` on any thrown error before rethrow. |
| `updateUserRoleWithOptimisticUsersRollback` | Wraps `updateUserRole`. |
| `bulkUpdateUserRoleWithOptimisticUsersRollback` | Wraps `bulkUpdateUserRole`. |

**TanStack Query pattern (existing in `users-page-client`):** `onMutate` snapshots prior infinite-query data → optimistic row patch → `onError` restores `previous` → `onSettled` invalidates. Prefer wiring `onRollback` to the same restore function when migrating call sites to wrappers.

---

## 11. Phase 1 execution notes

**Internal validation (post-change):**

| Check | Result | Notes |
|-------|--------|-------|
| Tenant isolation complete? | **Partial** | Double middleware gate + documented bypass contract; **not** yet full route-by-route audit (§6 open items). |
| RBAC consistent FE/BE? | **Improved** | Backend `UserRole` + policy constants aligned; web `UserRole` + directory types updated; UI CASL remains UX-only — server guards are source of truth. |
| Role system fully typed? | **Partial** | Core workspace roles typed end-to-end for users directory + request context; history DTOs and some edge strings remain `string` intentionally. |
| `npx tsc --noEmit` (api) | **Pass** | After import / enum fixes. |
| `npx tsc --noEmit` (web) | **Pass** | Users surface + services compile. |

**Follow-ups before closing Phase 1 globally:** complete remaining §6 items (tenant inventory, route audit script, standardized errors, runbook, isolation tests).

---

## 12. Phase 2 — Finance bounded context (architecture only)

**Scope:** Extract a **Finance** bounded context from cross-cutting payment logic. **No implementation in this document** — folder names and responsibilities only.

### 12.1 Context boundary

| In scope (Finance) | Out of scope (callers / collaborators) |
|--------------------|----------------------------------------|
| Money movement, balances, invoices, tax line references | Tour catalog, registration capacity rules (Booking context) |
| Idempotent PSP webhooks, reconciliation views | User directory, session issuance (Identity) |
| Ledger-style append-only facts (internal) | Workspace settings UI (Settings supplies *configuration* via facades) |

**Rule:** Finance **subscribes** to domain facts (`BookingConfirmed`, `PaymentInitiated` completion) and **emits** finance facts (`PaymentCaptured`, `RefundIssued`); it does **not** import Tour or Registration repositories directly — only **read models**, **ports**, or **event payloads**.

### 12.2 Submodule structure

```
finance/
  payments/       # Payment intent, capture, failure, PSP correlation ids
  wallets/        # Tenant or user-held balance views (credits, holds) — optional MVP = ledger projection only
  invoices/       # Invoice / receipt artifacts, numbering, immutable PDF references
  contracts/      # Ports: PSP client, clock; DTOs for inbound commands
  infrastructure/ # Adapters: TypeORM repos, webhook controllers, outbox mappers
```

| Submodule | Responsibilities | Primary inputs | Primary outputs |
|-----------|------------------|----------------|-----------------|
| **Payments** | Initiate/capture/refund; map PSP state machine; idempotency keys; link to `registrationId` / `bookingId` | Commands from application layer; signed webhooks | `Payment` aggregate rows; `PaymentCaptured` events |
| **Wallets** | Holds, available balance, credit notes (product decision); **no** negative balance without explicit credit | Ledger entries, policy from Settings | Balance read models; `WalletAdjusted` (optional) |
| **Invoices** | Immutable invoice record (line items snapshot); legal/tax metadata references | Closed booking + payment facts | Stored artifact URI; `InvoiceIssued` event |

### 12.3 Dependencies (one-way)

`Booking` (application orchestration) → **port** `IFinancePayments` → `payments` adapter.  
`Finance` → **never** `import` `ToursModule` entity classes; use **event payload** or **query service** interface owned by Booking.

---

## 13. Phase 2 — Domain event system

### 13.1 Principles

| Principle | Meaning |
|-----------|---------|
| **Facts, not commands** | Events name what happened (`BookingCreated`), not what should happen next. |
| **Immutability** | Published payload is versioned; consumers tolerate unknown fields (forward compatibility). |
| **Decoupling** | Producers do not call consumer services; **transactional outbox** guarantees at-least-once delivery to the bus. |
| **Idempotency** | Consumers key off `eventId` or business idempotency key. |

### 13.2 Event catalog (starter)

| Event name | Producer (bounded context) | Payload essentials | Typical consumers |
|------------|-----------------------------|--------------------|-------------------|
| `BookingCreated` | Booking / Registrations | `bookingId`, `tenantId`, `tourDepartureId`, **price snapshot id** (see §15) | Finance (optional hold), Notifications, Search |
| `RoleChanged` | Identity / Users | `tenantId`, `userId`, `oldRole`, `newRole`, `actorUserId` | Auth cache invalidation, Audit, Finance (billing role) |
| `PaymentInitiated` | Finance / Payments | `paymentId`, `tenantId`, `bookingId`, `amountMinor`, `currency` | Audit, Booking (awaiting payment state) |
| `PaymentCaptured` | Finance / Payments | `paymentId`, `bookingId`, `capturedAt` | Booking (confirm paid), Invoices |
| `BookingConfirmed` | Booking | `bookingId`, `tenantId` | Finance, CRM |

### 13.3 Event bus — design (no vendor lock-in)

- **Transport:** message queue (Redis/Rabbit/SQS) or in-process dispatcher **only in dev**; production uses **outbox relay** → bus.
- **Envelope:** `{ eventId, eventType, schemaVersion, occurredAt, tenantId, correlationId, payload }`.
- **Ordering:** per-`tenantId` partition key where strict ordering matters (e.g. payment sequence for one booking).

### 13.4 Event flow (text diagram)

```
[HTTP Handler / Job]
        |
        v
 [Application Service]  --(1) mutate aggregate in DB transaction
        |
        +--(2) insert OUTBOX row (same transaction)
        |
        v
   COMMIT
        |
        v
 [Outbox Relay Worker]  --(3) poll outbox; publish to BUS
        |
        +------------------+---------------+------------------+
        v                  v               v                  v
 [Finance Adapter]   [Audit Projector]  [Notification]   [Search Indexer]
   (idempotent)        (append log)      (email/push)     (read model)
```

**Decoupling check:** steps (3)–consumers run **async**; core write path in (1)–(2) does **not** await consumers. Retries and poison queues are **infrastructure**, not domain services.

---

## 14. Phase 2 — Repository pattern (design refactor)

**Goal:** Move **persistence and query construction** out of fat `*Service` classes into **`Repository`** (or **Gateway**) types; services become **orchestration + policy** only.

### 14.1 Users (API) — `users.service` → layering

| Layer | Renamed / new artifact | Responsibility |
|-------|------------------------|----------------|
| **Repository** | `UsersRepository`, `UserTenantsRepository` (or single `UsersDirectoryRepository`) | TypeORM queries: list cursor page, `findMembership`, `findTenantScopedUser`, bulk role update SQL |
| **Domain / policy** | unchanged package `workspace-membership-rbac.policy` | Pure functions: rank, `evaluateGeneralMembershipRoleChange` |
| **Application** | `UsersWriteApplicationService`, `UsersReadApplicationService` (optional split) | Transaction boundaries, audit calls, calls repository + policy |
| **Infrastructure** | existing module wiring | Binds repository implementations |

**Current names in codebase (illustrative):** `UsersReadService` / `UsersWriteService` / `UsersAccessService` → **thin** facades over repositories; **controllers** stay thin and call application services only.

### 14.2 Registrations (API) — `registrations.service` → layering

| Layer | New artifact | Responsibility |
|-------|--------------|----------------|
| **Repository** | `RegistrationsRepository`, `WaitlistRepository` | Find by id/tenant, capacity queries, status transitions persistence |
| **Application** | `RegistrationsApplicationService` (or keep name `RegistrationsService` as orchestrator) | Public register flow, waitlist promotion, outbox emission, calls repository |
| **Domain** | pure validators / state machine helpers | Invariants: status transitions, capacity |

**Dependency direction:** `RegistrationsApplicationService` → `RegistrationsRepository` → DB; **not** repository → service.

### 14.3 Web `users.service` (client)

The web **`users.service.ts`** is an **HTTP client**, not a repository. Phase 2 naming clarity:

| Option | Description |
|--------|-------------|
| **A (preferred)** | Rename to `users-api.client.ts` or keep file but document as **API client** in module index. |
| **B** | Add `UsersRepository` interface in web **only** if a second data source appears (local cache); otherwise avoid fake “repository” on the client. |

---

## 15. Phase 2 — Pricing snapshots (immutable booking model)

### 15.1 Problem

Tour list prices change over time; **bookings must not retroactively change** when the tour price edits.

### 15.2 Model (conceptual)

| Artifact | Stored on | Immutability |
|----------|-----------|--------------|
| **PriceSnapshot** (or embedded columns) | Created **at booking creation** | **Never UPDATE** price fields after insert; corrections only via **adjustment** rows or new snapshot version linked by id |
| **Snapshot id** | `registration` / `booking` row | Foreign key or UUID reference to `booking_price_snapshots` table (design) |
| **Line items** | JSONB or child table | Copy of breakdown (base, fees, tax codes) at book time |

**Fields (illustrative):** `snapshot_id`, `list_price_minor`, `currency`, `tax_profile_version`, `computed_total_minor`, `pricing_rule_version`, `created_at`, `tour_departure_id`, `tour_id`.

### 15.3 Historical integrity

- **Append-only:** no `UPDATE` on snapshot table; disputes use stored snapshot + audit trail.
- **Reference integrity:** booking row stores `snapshot_id`; payments reference same snapshot for reconciliation.
- **Reconciliation:** Finance compares PSP amount to `computed_total_minor` + tolerance policy; mismatches emit `PricingReconciliationDrift` (future event), not silent overwrite.

---

## 16. Phase 2 execution notes

**Validation (design review):**

| Question | Assessment | Evidence in this document |
|----------|------------|-----------------------------|
| **Domain separation clear?** | **Yes (design level)** | §12 boundary table + forbidden imports; finance submodules split. |
| **Events decoupled from services?** | **Yes (target architecture)** | §13.4 outbox + async consumers; producers do not invoke consumer methods. |
| **Booking auditable?** | **Yes (conceptually strengthened)** | §15 immutable snapshot + append-only; §13 events `BookingCreated` / `PaymentInitiated` link booking and money paths; existing DB columns (e.g. `quoted_list_price_minor`) remain part of audit story until snapshot table is introduced. |

**Implementation gate (when coding starts):** add outbox relay metrics; contract tests on event JSON schema; migration plan for snapshot table without rewriting historical registrations.

---

## 17. Phase 3 — Pricing engine (rule-based, server-authoritative)

### 17.1 Objective

Compute **quote** and **final charge basis** on the **server only**, using deterministic rules. The client may display returned numbers but **never** supplies authoritative price, discount percent, or tax basis for persistence.

### 17.2 Rule dimensions (evaluation order — illustrative)

| Priority (high → low) | Rule source | Examples |
|----------------------|-------------|----------|
| 1 | **Tenant** | Base currency, tax profile id, rounding mode, banned discount codes |
| 2 | **Catalog / departure** | List price, capacity tier, seasonal multiplier |
| 3 | **Participant role** (if applicable) | Member vs staff rate tables (policy-bound) |
| 4 | **Discount** | Code validity window, max redemptions, stackability flag |
| 5 | **Audit / override** | Admin-approved manual adjustment (separate workflow, logged) |

### 17.3 Server authority pattern

```
Client → POST /bookings/quote  (inputs: tour_departure_id, optional discount_code, party size)
              ↓
       [PricingEngine.evaluate]
              ↓
       Response: { line_items[], computed_total_minor, currency, pricing_rule_version, quote_token? }
              ↓
Client → POST /bookings        (includes quote_token OR server recomputes and must match within tolerance)
              ↓
       Server persists PriceSnapshot (§15); rejects if client-supplied totals disagree
```

- **Inputs accepted from client:** identifiers (tour, departure), quantity, **opaque** `quote_token` (short-lived JWT or HMAC blob binding inputs + total).
- **Inputs rejected as authority:** `finalPrice`, `discountAmount` as trusted numbers unless re-validated inside engine.

### 17.4 Shadow / experiment mode (optional)

- Engine can emit **parallel** “experimental total” for telemetry **without** charging; production charge uses **committed rule version** until flag promotes experiment.

---

## 18. Phase 3 — Payment integration layer (gateway abstraction, idempotency)

### 18.1 Gateway abstraction (design)

| Port (interface) | Responsibility | Implementations (examples) |
|------------------|----------------|----------------------------|
| `IPaymentGateway` | Create/capture/cancel **intent**; map PSP errors to domain codes | `StripeGatewayAdapter`, `ZibalGatewayAdapter`, `FakeGateway` (tests) |
| `IWebhookVerifier` | Signature + timestamp tolerance | Per-PSP adapter |
| `IPaymentIdempotencyStore` | Persist `(tenantId, idempotency_key) → result` | DB table or Redis with TTL |

**Controller / application service** depends on **`IPaymentGateway`** only; wiring lives in `finance/infrastructure`.

### 18.2 Idempotency key concept

| Aspect | Design |
|--------|--------|
| **Scope** | Composite unique: `(tenant_id, idempotency_key)` or `(tenant_id, operation, idempotency_key)`. |
| **Client header** | `Idempotency-Key: <uuid>` on `POST` create payment / confirm booking-pay. |
| **Server behavior** | First request runs PSP call; duplicate key returns **same** HTTP body + status (typically `200` replay or `409` conflict if payload hash differs). |
| **TTL** | Keys expire after terminal state + retention window; legal hold may extend. |

### 18.3 Webhooks (design)

- Inbound route: verify signature → normalize payload → **upsert** by PSP event id → enqueue domain command; **never** trust amount without matching internal `payment_id` + snapshot.

**No real integration code** in this document — only contracts and boundaries.

---

## 19. Phase 3 — Safety profiles (emergency & medical)

### 19.1 Emergency contact model (design)

| Field group | Examples | Notes |
|-------------|----------|-------|
| **Identity** | `full_name`, `relationship`, `primary_phone`, `secondary_phone` | Stored as **tenant-scoped** PII; RBAC: owner/admin read for duty-of-care; participant may edit self. |
| **Reachability** | `preferred_locale`, `timezone` | Affects notification templates only. |
| **Versioning** | `profile_version` | Optimistic updates; audit who changed what. |

### 19.2 Medical / sensitive data (encryption concept only)

| Concept | Design intent |
|---------|----------------|
| **Classification** | Treat as **special category** where product/regulation requires; default to “minimal collection”. |
| **At rest** | Column-level **envelope encryption** (KMS data key per tenant or per row); ciphertext + key id stored; **no plaintext** in backups without same keys. |
| **In use** | Decrypt only inside short-lived application memory; **no** logging of decrypted values. |
| **Access** | Explicit ability (`MedicalProfile.Read`); break-glass with dual control (optional). |
| **Retention** | TTL after tour end + legal minimum; **right to erasure** workflow marks tombstone without breaking ledger references (use opaque participant id where possible). |

**No crypto implementation** here — only policy and data-model placement.

---

## 20. Phase 3 — Ledger system (append-only, wallet, credits)

### 20.1 Append-only transaction model

| Table (conceptual) | Purpose |
|--------------------|---------|
| `ledger_transactions` | Immutable row per **business fact**: `DEBIT` / `CREDIT`, `amount_minor`, `currency`, `account`, `correlation_id`, `created_at`, `tenant_id` |
| **Invariant** | **No UPDATE/DELETE** on monetary columns; reversals are **new rows** (offsetting credit/debit) referencing `reverses_transaction_id`. |

**Double-entry variant (recommended for finance maturity):** each logical movement = two lines (source account, destination account) sharing `journal_id`.

### 20.2 Wallet + credit system (design)

| Concept | Definition |
|---------|--------------|
| **Wallet** | Per-tenant or per-user **projection** over ledger lines (materialized view or periodic rollup); not the source of truth. |
| **Credit** | Issued as **ledger credit** with reason code (`REFUND`, `GOODWILL`, `PROMO`); spend consumes credit via paired debit against a “spend” account. |
| **Hold** | Pre-authorization creates **pending** ledger state or separate `holds` table reconciled to ledger on capture/expire. |

### 20.3 Reconciliation touchpoint

- PSP settlement files / webhooks produce **ledger lines** via idempotent projector; mismatch → `ReconciliationException` + ticket, not silent patch.

---

## 21. Phase 3 execution notes

**Validation (design review):**

| Question | Assessment | Notes |
|----------|------------|-------|
| **Pricing cannot be manipulated client-side?** | **Yes, if §17 is enforced** | Authoritative totals from `PricingEngine`; client numbers are display-only; booking persistence binds to **PriceSnapshot** / `quote_token` validation. |
| **Ledger is append-only?** | **Yes, by design (§20.1)** | Corrections are new rows; wallets are projections. |
| **Payments are idempotent?** | **Yes, if §18.2 is enforced** | `Idempotency-Key` + store + PSP id dedupe; webhook upsert by provider event id. |

**Safety / compliance follow-ups:** DPIA for medical fields; data residency per tenant; penetration test scope for payment + PII endpoints.

---

## 22. Phase 4 — Audit system (UI + logged events)

### 22.1 Audit trail UI (admin / support)

| UI area | Purpose | Key interactions |
|---------|---------|-------------------|
| **Tenant audit explorer** | Filterable timeline for a workspace | Date range, actor, action type, resource type/id, free-text search on `correlation_id` |
| **Event detail drawer** | Non-repudiation review | Before/after JSON for sensitive fields (redact secrets); link to related booking/payment ids |
| **Export** | Compliance handoff | CSV/JSON export with signed manifest (hash of export); rate-limited; owner/admin-gated |
| **Integrity indicator** | Trust | “Append-only store” badge; show chain hash if product adopts hash-chained rows (optional) |

**RBAC:** default **owner/admin** read; **billing** role read-only on finance rows if split; **member** has no audit UI.

### 22.2 What events are logged (catalog — production baseline)

| Category | Event types (examples) | Minimum payload |
|----------|------------------------|-------------------|
| **Identity / access** | `SESSION_CREATED`, `SESSION_REVOKED`, `ROLE_CHANGED`, `MEMBERSHIP_SUSPENDED` | `tenant_id`, `actor_user_id`, `target_user_id`, `before`, `after`, `ip`, `request_id` |
| **Tenant / settings** | `SETTINGS_UPDATED`, `TOUR_PRESET_PUBLISHED` | Resource id, version, diff summary (no secrets) |
| **Booking** | `BOOKING_CREATED`, `BOOKING_STATUS_CHANGED`, `WAITLIST_PROMOTED` | `registration_id`, `tour_id`, `from_status`, `to_status` |
| **Finance** | `PAYMENT_INITIATED`, `PAYMENT_CAPTURED`, `REFUND_ISSUED`, `WEBHOOK_RECEIVED` | `payment_id`, `amount_minor`, `currency`, PSP event id |
| **Security** | `TENANT_CONTEXT_DENIED`, `RBAC_DENIED`, `RATE_LIMITED` | Route, `error.code`, no PII beyond actor id |

**Rules:** append-only rows; **no DELETE** of audit facts; retention policy per jurisdiction; PII minimization in `metadata` JSON.

---

## 23. Phase 4 — Performance (lists, caching)

### 23.1 User list virtualization (web)

| Strategy | When to use | Notes |
|----------|-------------|-------|
| **Windowed virtual list** (`@tanstack/react-virtual` or equivalent) | Directory > ~200 visible rows or heavy cells | Stable `rowKey=user.id`; preserve selection state across scroll; avoid measuring unbounded row heights — fixed row height or cached measure |
| **Infinite query + virtual window** | Current infinite scroll pattern | Keep **server cursor** pagination; client only renders visible slice of **current page** + prefetch next page threshold |
| **Skeleton / placeholder** | First paint | Match row height to prevent layout shift |

**Server:** retain cursor API; avoid widening `limit` without index proof (see §23.2).

### 23.2 Caching strategy (React Query + server)

| Layer | Policy |
|-------|--------|
| **React Query** | `staleTime` 30–120s for user lists; `gcTime` per memory budget; **tenant-scoped `queryKey`** always includes `tenantId` (or host) so cache never crosses tenants |
| **Invalidation** | On role/membership mutation: `invalidateQueries` for `userKeys.lists()`; optimistic updates already rollback on error (Phase 1) |
| **Server HTTP** | `Cache-Control: private, max-age=0` for authenticated directory; optional **ETag** on `GET /users/:id` (Phase 1) for conditional GET |
| **CDN** | Do **not** cache authenticated HTML/API through shared cache keys |

---

## 24. Phase 4 — Legacy cleanup (string roles & deprecated patterns)

### 24.1 String-based role logic to remove (checklist)

| Location pattern | Replacement | Status |
|------------------|-------------|--------|
| `role.trim().toLowerCase() === "owner"` in services | `UserRole` / `normalizeWorkspaceMembershipRole` (already centralized in policy) | **Target removal** in any remaining ad-hoc files outside policy |
| DTOs / OpenAPI examples using bare `string` for `role` | `enum: UserRole` or shared `WorkspaceRole` type | **Align** gradually; keep backward-compatible API until version bump |
| Web `normalizeRole` duplicated logic | Single import from shared package or thin wrapper calling API normalization for display only | **Deprecate** duplicate ranking if backend is source of truth |
| JWT parsing without `tryParseWorkspaceUserRole` | Always use middleware path (Phase 1) | **Done** for main auth; grep CI for regressions |

### 24.2 Deprecated patterns (mark clearly in codebase)

| Pattern | Deprecation note |
|---------|------------------|
| **Client-supplied `tenantId` in body** | `@deprecated` — use server context only; remove after one major version with telemetry = 0 |
| **Duplicate tour create entry points** | Flag off + `@deprecated` JSDoc on legacy route; delete after N releases at zero traffic (per §2 Phase 4 tasks) |
| **Direct `DataSource` queries in controllers** | `@deprecated` — move behind repository (Phase 2 §14) |

---

## 25. Phase 4 — Security hardening (CI + test strategy)

### 25.1 CI-level checks for tenant isolation

| Check | Mechanism |
|-------|-----------|
| **Forbidden patterns** | `rg` / custom script in CI: `req.body.tenant_id`, `req.body.tenantId`, `setTenantId(.*body` in `apps/api` (allow-list exceptions file) |
| **Route guard coverage** | Meta-test: reflect Nest routes + assert every `PATCH|POST|PUT|DELETE` has `AuthorizationPresenceGuard` or internal key + tenant assertion |
| **E2E tenancy** | Smoke: user A session cannot `GET/PATCH` user B resource in tenant B (ID tampering) |
| **DB RLS drift** | Optional: migration check that RLS enabled on tenant tables (policy names in allow-list) |

### 25.2 RBAC validation test strategy

| Layer | Tests |
|-------|-------|
| **Unit** | Policy matrix: every `Role × Action × resource` used in `@CheckAbilities` handlers |
| **Contract** | OpenAPI vs live decorators for role-required routes (generated snapshot diff) |
| **Integration** | For each high-risk controller (`users`, `payments`, `registrations`): 403 for wrong role, 403 for wrong tenant |
| **Regression** | CASL mirror guard (Phase 1): ensure stacked guard stays on sensitive controllers when routes change |

---

## 26. Phase 4 execution notes

**Final validation (production readiness lens):**

| Question | Assessment | Condition |
|----------|------------|-----------|
| **System production-ready?** | **Conditional yes** | Phases 1–3 gates met in implementation + §22 audit UI shipped + §23 perf budgets met + §25 CI green. |
| **Multi-tenant safe?** | **Conditional yes** | Tenant from context only; CI grep + e2e isolation; no shared cache keys across tenants. |
| **Financial-safe?** | **Conditional yes** | Append-only ledger (§20), idempotent payments (§18), immutable price snapshots (§15–§17), audit trail for money (§22.2). |

**Explicit non-goals for Phase 4:** no new product features; no architectural redesign beyond cleanup and hardening listed above.

---

*End of execution design.*

---

## EXECUTION REPORT

This section **summarizes** the phased work documented in `PROMPT.MD` (§1–§26). It does not replace detailed specifications elsewhere in this file.

### Phase 1 summary (what changed)

| Theme | Documented / targeted outcomes |
|-------|--------------------------------|
| **Tenant isolation** | Middleware pipeline + `TenantGuardMiddleware` design; defense-in-depth tenant resolution; explicit bypass contract aligned with public flows (§10.1, §8 C1). |
| **Role system** | `UserRole` (workspace) vs `InternalActorRole` / `RequestActorRole` on request context; JWT workspace role validation; RBAC policy constants aligned to enum (§10.2, §8 C2, §24). |
| **Concurrency** | `registrations.row_version`; users `profile_row_version`; weak **ETag** on user-by-id GET (§10.3, §8 C3, §23.2). |
| **RBAC / CASL** | Backend `AbilitiesGuard` + stacked `CaslMirrorAbilitiesGuard` on sensitive surfaces (e.g. users directory); UI CASL remains non-authoritative (§10.4, §8 C4). |
| **Web resilience** | `withOptimisticUsersRollback` and role-mutation wrappers; TanStack Query rollback patterns (§10.5, §8 C5, §11). |
| **Checklist status** | Phase 1 execution checklist (§6) mixed complete/partial; execution notes record `tsc` health and open follow-ups (§11). |

### Phase 2 summary

| Theme | Outcomes (design) |
|-------|-------------------|
| **Finance bounded context** | `payments` / `wallets` / `invoices` submodule boundaries; forbidden upward imports from Finance into Tours/Booking entities (§12). |
| **Domain events** | Outbox-first bus; catalog including `BookingCreated`, `RoleChanged`, `PaymentInitiated` (+ related); async consumer decoupling (§13). |
| **Repository pattern** | Thin application services over `UsersRepository` / `RegistrationsRepository`; web client naming clarity (§14). |
| **Pricing snapshots** | Immutable snapshot at booking time; append-only snapshot store concept; reconciliation posture (§15). |

### Phase 3 summary

| Theme | Outcomes (design) |
|-------|-------------------|
| **Pricing engine** | Rule-ordered evaluation (tenant → catalog → role → discount); server-authoritative quotes; optional shadow mode (§17). |
| **Payment layer** | `IPaymentGateway` / verifier / idempotency store ports; header-based idempotency; webhook design without vendor code in doc (§18). |
| **Safety profiles** | Emergency contact model; medical/sensitive as KMS envelope encryption **concept** and access minimization (§19). |
| **Ledger** | Append-only transactions; wallet as projection; credits/holds; reconciliation exceptions over silent fixes (§20). |

### Phase 4 summary

| Theme | Outcomes (design / ops) |
|-------|-------------------------|
| **Audit** | Admin audit explorer UI, detail drawer, export; baseline event taxonomy across identity, settings, booking, finance, security (§22). |
| **Performance** | Virtualized large user lists + infinite query; React Query tenant-scoped keys; server cache headers; CDN exclusions (§23). |
| **Legacy cleanup** | Remove ad-hoc string role comparisons; deprecate client `tenantId` body, duplicate tour entry points, fat controllers (§24). |
| **Security CI** | Grep-based tenant foot-gun detection; route guard meta-tests; tenancy e2e; optional RLS drift check; layered RBAC tests (§25). |
| **Readiness verdict** | **Conditional** production / multi-tenant / financial safety when implementation gates in §26 are met (§26). |

### Key architectural decisions

1. **Tenant and RBAC are server-authoritative** — context from membership/JWT + guards; client and CDN never define scope.  
2. **Cross-module coupling via events + ports** — Finance does not reach into Tour/Registration repositories directly (§12–§13).  
3. **Money correctness = append-only facts** — ledger and price snapshots are immutable; corrections are new rows or new snapshot versions (§15, §20).  
4. **Defense in depth on permissions** — coarse roles + CASL abilities + optional mirror guard + CI/test gates (§10.4, §25).  
5. **Operational observability** — structured audit catalog and correlation-friendly payloads (§22).

### Assumptions made

| Assumption | Rationale |
|------------|-----------|
| **PostgreSQL + Nest + Next** remain the primary stack | As implied by file paths and middleware discussion throughout the document. |
| **Transactional outbox** is the preferred delivery mechanism for domain events | Stated in §2 / §13; alternative “in-process dispatcher” acceptable only for constrained environments. |
| **Registrations table** represents the “booking” aggregate for versioning/snapshot language | Consistent with §8 C3 and registration-centric wording in later phases. |
| **Regulatory stance** for medical/finance is “design first” | Encryption and DPIA called out as concepts without mandating a jurisdiction (§19, §21). |

### Remaining risks

| Risk | Mitigation reference |
|------|----------------------|
| **Design–implementation drift** | Contract tests, OpenAPI snapshots, CI grep (§25); Phase 1 §6 open items. |
| **Partial Phase 1 closure** | Tenant inventory, route-by-route audit, standardized errors, runbook still listed in §6 / §11. |
| **Webhook / PSP operational failure** | Idempotency + signed events (§18); reconciliation jobs (§20.3). |
| **Performance regressions at scale** | Virtualization + query limits + load tests per §2 Phase 4 / §23. |
| **Audit completeness vs privacy** | Redaction rules and retention; export rate limits (§22). |

### Production readiness verdict

| Verdict | Explanation |
|---------|-------------|
| **Design-complete; implementation-conditional** | `PROMPT.MD` provides a **coherent phased blueprint** through Phase 4 (§1–§26). |
| **Not a blanket “production ready” sign-off** | Readiness is **conditional** on shipping remaining §6 / §26 gates: audit UI, perf budgets, CI hardening, immutable finance artifacts, and closure of documented risks (§4, §11, §21, §26). |
| **When conditions are met** | The architecture described supports **multi-tenant** isolation, **financial** traceability (snapshots + ledger + idempotent payments), and **operational** auditability — subject to execution, pen-test, and org-specific compliance review. |

---

*End of execution report.*
