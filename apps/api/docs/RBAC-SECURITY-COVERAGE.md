# RBAC security coverage (API)

**Authority model:** coarse roles via `RolesGuard` + fine-grained checks via `@repo/shared` / `WorkspaceAbilityFactoryService` and `@CheckAbilities`, evaluated twice per sensitive surface (`AbilitiesGuard` + `CaslMirrorAbilitiesGuard`). The web UI CASL mirror is **not** a security boundary.

## CI enforcement

`scripts/check-security-mutation-guardrails.mjs` (workflow `architecture-guardrails` → job `security-ci-guardrails`) requires **mutations** under `apps/api/src/modules/**` to declare:

- `AuthorizationPresenceGuard`
- `RolesGuard`
- `AbilitiesGuard`
- `CaslMirrorAbilitiesGuard`
- at least one `@CheckAbilities(...)` on the handler (merged with class metadata by `assertCheckAbilitiesForExecutionContext`)

Exemptions live in `scripts/security-mutation-guardrails.allowlist.json` (public registration throttler-only, invite accept bootstrap, whole-file skip for `auth.controller.ts` public login routes).

## Module coverage (high level)

| Area | Roles + CASL stack | CASL subjects (typical) |
|------|--------------------|-------------------------|
| Users / invites (admin) | Yes | `UserMembership`, … |
| Tours CRUD | Yes | `Tour` |
| Settings (regions, destinations, equipment, languages, themes, presets) | Yes | `Settings` |
| Registrations / bookings / waitlist (JWT) | Yes | `Registration` |
| Payments (JWT) | Yes | `Payment` |
| Payments webhook | `PaymentWebhookSignatureGuard` + `ThrottlerGuard` (allowlisted) | N/A |
| Workspace ownership transfer | Yes | `WorkspaceOwnership` |
| Dashboard aggregate | Yes (GET) | `Tour` |
| Tenant audit export | Yes (GET) | `Audit` |
| Me (profile / mobile / email) | Yes | `Workspace` (minimal self-service gate) |
| Auth `link-telegram` | Yes | `Workspace` |
| Ops | `InternalApiKeyGuard` | N/A |

## Alignment fixes (this pass)

- **`UserRole.Leader`** included in `isLeaderRole()` (`ownership-scope.ts`) so registration/waitlist queries match workspace leader semantics and shared RBAC.
- **`defineAbilityFor`**: `create` on `Payment` for **member** and **leader** (intent creation); **member** gains **`read` on `Settings`** for read-only settings lists used by tour UI.
- **Tours**: create/update allowed for **Leader**; list/detail aligned with CASL `Tour` read; tour-scoped registration lists use `Registration` read.
- **Tours (Phase 3):** `POST/PATCH /tours` also run body-aware checks via `assert-tour-mutation-abilities.ts` (`TourCore`, `TourTripDetails`, `publish` capabilities) after coarse `@CheckAbilities`.
- **Tours (Phase 5):** frozen write pipelines — `assert-tour-create-write-pipeline.ts` / `assert-tour-patch-write-pipeline.ts` (capability + `tour-patch-field-policy` rank gates). Membership `labels` hydrate CASL via `AuthMiddleware` → `resolveEffectiveCapabilities` (`capability-registry.ts`).
- **Auth:** `GET /api/v2/auth/membership-ability-context` exposes ALS labels/capabilities for web CASL parity (not a security boundary).
- **JWT snapshot (Phase 8.2):** Session tokens include optional `caps` claim (comma-separated effective capabilities at issuance). `AuthMiddleware` hydrates from DB and logs drift if `caps` ≠ current effective set; enforcement uses ALS only.
- **Capabilities (Phase 8):** `@RequireCapability(...)` on routes (e.g. reconciliation list requires `module.finance`); evaluated in `AbilitiesGuard` via `resolveEffectiveCapabilities`. Marketing labels map through `MARKETING_LABEL_CAPABILITY_ALIASES` (`club_member` → `marketing.segment.read`).
- **Phase 6 — membership capabilities:** `PATCH /api/v2/workspaces/:tenantId/users/:userId/capabilities` with `assertCapabilityAssignable`; grants stored in `user_tenants.membership_metadata` (`capabilities`, `allowedRegionIds`). `GET /api/v2/users/:id` returns `assignedCapabilities`, `allowedRegionIds`, `effectiveCapabilities`.
- **Phase 6 — regional PATCH:** `updateTour` rejects tours/destinations outside `allowedRegionIds` when actor has `tour.regional.manage`.
- **Phase 6 — tenant modules:** `PATCH /api/v2/workspaces/:tenantId/settings/modules` (owner); `@RequireCapability` also requires matching `tenants.enabled_modules` entry (`AUTH_FORBIDDEN_TENANT_MODULE`).
- **Phase 8 — sensitive tripDetails:** `assertSensitiveTripDetailsPatch` + CASL subject `TourTripDetailsSensitive` (urban/cinema pricing, logistics caps).
- **Registrations**: leader/admin included on staff mutations; all JWT mutations carry the CASL guard stack.

## Residual notes

- **Public** `POST /api/v2/tours/:tourId/register|waitlist` remain throttler + tenant bootstrap (no JWT); documented in allowlist.
- **`auth.controller.ts`** (OTP, session bootstrap) is excluded from the static mutation scan; those routes rely on transport + service-layer checks.
