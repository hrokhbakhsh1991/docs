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

---

### Phase 3 — Feature enhancement (registration, booking, finance)

| Dimension | Detail |
|-----------|--------|
| **Goals** | First-class **booking** aggregate with lifecycle and capacity rules; **payments/refunds** and reconciliation; rich **audit** on financial and role changes; optional **shadow mode** for pricing experiments. |
| **Tasks** | Booking state machine; idempotency keys on create/confirm; payment capture/refund use cases; signed PSP webhooks + deduplication; reconciliation job; admin/support audit export or UI; integrate wizard/tour offerings with booking read model. |
| **Deliverables** | OpenAPI (or equivalent) for booking and finance routes; integration tests for webhooks and idempotency; shadow pricing metrics if used. |

---

### Phase 4 — Optimization, audit hardening & legacy cleanup

| Dimension | Detail |
|-----------|--------|
| **Goals** | Scale and cost control under multi-tenant load; **audit completeness** review; remove legacy code paths after measured zero use behind flags. |
| **Tasks** | Load test hot paths; index/query tuning; N+1 elimination; per-tenant job quotas; pen-test remediation; delete deprecated tour-create/wizard duplicates after N releases at zero traffic. |
| **Deliverables** | Load-test summary; audit gap closure or risk acceptance with expiry; legacy removal changelog. |

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
- [ ] Document middleware chain: AuthN → membership → context `tenantId` → abilities.
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
| **C1** | Tenant guard skeleton | `apps/api/src/common/middleware/tenant-guard.middleware.ts` — runs after `TenantMiddleware`; same public-route bypass list; debug log when `tenantId` + `userId` present. Wired in `app.module.ts`, `main.ts`, `test/e2e/bootstrap.ts`. |
| **C2** | `UserRole` enum + JWT parse | `apps/api/src/common/auth/user-role.enum.ts` — workspace JWT roles + internal actors (`Worker`, `Api`, `System`, `None`). `tryParseWorkspaceUserRole()` validates JWT workspace roles. `RequestContext.role` typed as `UserRole`; `AuthMiddleware` rejects unknown workspace roles with `AUTH_INVALID_ROLE`. |
| **C3** | Booking row version (DB) | `apps/api/src/database/migrations/1777594100000-RegistrationRowVersion.ts` adds `registrations.row_version`. `RegistrationEntity.rowVersion` (`@VersionColumn`). **Users** already use `users.profile_row_version` (prior migration). `runtime-schema-guard.service.ts` extended for `profile_row_version` + `row_version`. |
| **C4** | CASL mirror `CanActivate` stub | `apps/api/src/common/casl/casl-mirror-abilities.guard.ts` — mirrors `AbilitiesGuard` checks; exported from `CaslModule` for optional `@UseGuards(CaslMirrorAbilitiesGuard)` stacking in Phase 2. |
| **C5** | Optimistic rollback hook (web) | `apps/web/lib/services/users.service.ts` — `withOptimisticUsersRollback()` + `OptimisticUsersMutationCallbacks` for TanStack Query integration later. |

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
| Phase 1 stubs merged | Ready to extend `TenantGuardMiddleware` with per-route policies; wire `CaslMirrorAbilitiesGuard` on selected controllers if defense-in-depth is desired. |
| `UserRole` | Extend RBAC matrix tests to assert rejects for `AUTH_INVALID_ROLE`. |
| `registrations.row_version` | Apply optimistic checks in `RegistrationsService` update paths; handle `409` on version conflict. |
| Web users rollback | Replace ad-hoc cache updates in users directory with `withOptimisticUsersRollback` + TanStack Query `onMutate` / `onError`. |
| Modules / outbox | Proceed with **§2 Phase 2** roadmap: bounded modules, event catalog, transactional outbox publisher. |

---

*End of execution design.*
