# CASL / TenantAuthz — Operator session & Denali admin enforcement spec

```yaml
spec_version: "2026-06-08-v1"
status: LOCKED
decisions: [DEC-P9-003, DEC-P9-004, DEC-P9-007, DEC-P9-009]
invariants: [INV-P9-007, INV-P8-007, RULE-P9-002, RULE-P9-003]
authority: phase-9-agent-router.md §4 · ADMIN-ROUTE-MATRIX.md
implementation_phase: "9.1 (identity) before 9.2 ((app)/ shell)"
```

## Problem statement

Trunk auth today is **dev-bearer gated** (`ALLOW_DEV_WEB_SESSION`) without production OTP/session. Legacy `(app)/` assumes **HttpOnly session cookie** + **DB-backed membership hydrate** (DELTA-NP-04). Phase 9.1 must add operator session production **without** regressing Phase 8 Urban owner-only rules (INV-P8-007).

---

## Layer stack (API)

```text
resolveTenantContextFromRequest(req)          # tenant-kernel
  → parseSessionCookie(req) | verifyJwtBearer(req)
  → hydrateMembershipFromDb(userId, tenantId) # role from UserTenant — NOT JWT claim alone
  → buildTenantAuthz(auth)
  → requireOperatorSession({ auth, authz, surface })   # 9.1+
  → requireAdminOrOwner({ authz, tenantId, surface })  # denali admin surfaces only
  → assertWorkspaceOwner(...)                          # urban owner surfaces — Phase 8 carryover
  → runWithHttpRequestContext(req, auth, handlerBody)
  → handler
```

**Fail-closed order:** missing session → **401** `IDENTITY_REQUIRED` before CASL. Authenticated but wrong role → **403** `OPERATOR_FORBIDDEN`. Urban owner surfaces still use **403** `URBAN_OWNER_REQUIRED` (Phase 8).

---

## Grant definitions

### `requireOperatorSession`

**File (new):** `apps/api/src/identity/require-session.ts`

| Check                          | Pass     | Fail                          |
| ------------------------------ | -------- | ----------------------------- |
| Valid session cookie or bearer | continue | **401** `IDENTITY_REQUIRED`   |
| Active `UserTenant` row        | continue | **403** `MEMBERSHIP_INACTIVE` |
| Tenant host matches membership | continue | **403** `TENANT_MISMATCH`     |

### `isAdminOrOwner` — Denali operator surfaces (DEC-P9-004)

**File (existing):** `packages/workspace-sdk/src/auth/tenant-auth-grants.ts`

| Function           | `owner` | `admin` | `member` | Use on                                                            |
| ------------------ | ------- | ------- | -------- | ----------------------------------------------------------------- |
| `isAdminOrOwner`   | true    | true    | false    | Denali `(app)/` admin: users, settings, finance, bookings approve |
| `isWorkspaceOwner` | true    | false   | false    | Urban settings/catalog admin only — **unchanged Phase 8**         |

**Forbidden:** `isAdminOrOwner` on `UrbanOwnerSurface` (RULE-P9-002 · INV-P8-007 regression).

---

## `OperatorSurface` vocabulary

**File:** `packages/workspace-sdk/src/auth/tenant-authz.ts` (doc-first extension)

```typescript
export type OperatorSurface =
  | "operator.session.read"
  | "operator.dashboard.read"
  | "operator.tours.read"
  | "operator.tours.mutate"
  | "operator.users.read"
  | "operator.users.mutate"
  | "operator.bookings.read"
  | "operator.bookings.approve"
  | "operator.settings.read"
  | "operator.settings.mutate"
  | "operator.finance.read";

/** Per-module ability suffix — resolved from manifest `ability` field (DEC-P9-009 · R-P9-S09) */
export type OperatorSettingsModuleAbility =
  | `operator.settings.${string}.read`
  | `operator.settings.${string}.mutate`;
```

Manifest entries declare `ability: "operator.settings.equipment.mutate"` (example). API routers call `requireSettingsModuleAccess({ authz, moduleId, verb })` which maps to the manifest row before any DB touch.

### Surface → grant matrix (Denali workspace)

| Surface                               | Grant                                   | Member                                      |
| ------------------------------------- | --------------------------------------- | ------------------------------------------- |
| `operator.tours.read`                 | session + active member                 | **allow** read                              |
| `operator.tours.mutate`               | `isAdminOrOwner`                        | **deny**                                    |
| `operator.users.read`                 | `isWorkspaceOwner` (DEC-P9-018)         | **deny** — future admin panel separate      |
| `operator.users.mutate`               | `isWorkspaceOwner` (DEC-P9-018)         | **deny**                                    |
| `operator.bookings.approve`           | `isAdminOrOwner`                        | **deny**                                    |
| `operator.settings.mutate`            | `isAdminOrOwner`                        | **deny**                                    |
| `operator.settings.{moduleId}.read`   | session + manifest `ability` row        | **deny** unless manifest grants member read |
| `operator.settings.{moduleId}.mutate` | `isAdminOrOwner` + manifest `ability`   | **deny**                                    |
| `operator.finance.read`               | `isAdminOrOwner` + workspaceType=denali | **deny**                                    |

Urban workspace: settings/catalog admin rows remain **`isWorkspaceOwner` only** — see Phase 8 CASL spec.

---

## Web layer

**Contract file:** [`CANLOAD-OPERATOR-SESSION.contract.ts`](CANLOAD-OPERATOR-SESSION.contract.ts)

```text
apps/web/app/(app)/layout.tsx
  → requireOperatorSessionWeb({ session })
  → on missing: redirect /auth/login?returnUrl=...
  → on present: render OperatorNav + children
```

**Forbidden:** RSC pages under `(app)/` that fetch protected API without session guard (INV-P9-007).

---

## API error catalog

| Code                   | HTTP | When                                                 |
| ---------------------- | ---- | ---------------------------------------------------- |
| `IDENTITY_REQUIRED`    | 401  | No session on protected route                        |
| `OPERATOR_FORBIDDEN`   | 403  | Session ok · CASL deny (admin surface, member actor) |
| `MEMBERSHIP_INACTIVE`  | 403  | UserTenant not ACTIVE                                |
| `TENANT_MISMATCH`      | 403  | Host tenant ≠ membership tenant                      |
| `URBAN_OWNER_REQUIRED` | 403  | Phase 8 urban owner regression                       |

**Forbidden:** `302` redirect from API on auth failure (MAP §12 R4).

---

## Verification artifacts

| Layer            | Spec file                                                            |
| ---------------- | -------------------------------------------------------------------- |
| SDK              | `packages/workspace-sdk/test/operator-ability.spec.ts`               |
| API session      | `apps/api/test/identity-session.spec.ts`                             |
| API OTP          | `apps/api/test/identity-otp.spec.ts`                                 |
| Web shell        | `apps/web/test/admin-shell-access.spec.ts`                           |
| Web login        | `apps/web/test/auth-login-access.spec.ts`                            |
| Urban regression | `apps/api/test/urban-settings-patch.spec.ts` (Phase 8 bundle at 9.8) |

---

## SDK test contract (`operator-ability.spec.ts`)

| Case ID    | Context         | Surface                              | Expected                                                                                                                       |
| ---------- | --------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| SDK-9.1-01 | denali · admin  | `operator.settings.mutate`           | **true**                                                                                                                       |
| SDK-9.1-02 | denali · member | `operator.settings.mutate`           | **false**                                                                                                                      |
| SDK-9.1-03 | denali · member | `operator.tours.read`                | **true**                                                                                                                       |
| SDK-9.1-04 | urban · admin   | `urban.settings.update`              | **false** (owner only)                                                                                                         |
| SDK-9.1-05 | urban · owner   | `urban.settings.update`              | **true** via `@app-tour/workspace-urban/auth` `canPerformUrbanOwnerMutation` (delegates to `canPerformWorkspaceOwnerMutation`) |
| SDK-9.6-01 | denali · admin  | `operator.settings.equipment.mutate` | **true**                                                                                                                       |
| SDK-9.6-02 | denali · member | `operator.settings.equipment.mutate` | **false**                                                                                                                      |
| SDK-9.6-03 | denali · member | `operator.settings.audit_trail.read` | **true** when manifest grants read-only                                                                                        |
| SDK-9.6-04 | denali · member | `operator.settings.workspace_branding.read` | **true** — `workspace_branding` in `MEMBER_READABLE_SETTINGS_MODULE_IDS`                                                  |

---

## Implementation (`packages/workspace-sdk` · Phase 9.1 R2)

**Files:**

| File | Role |
| ---- | ---- |
| `src/auth/operator-surface.ts` | `OperatorSurface` union · `evaluateOperatorSurfaceGrant` |
| `src/auth/tenant-authz.ts` | `TenantAuthz.canPerformOperatorSurface(surface, options?)` |

**Grant rules (Denali operator):**

| Pattern | Grant |
| ------- | ----- |
| `operator.tours.read` | `isAuthzGranted` (active member) |
| `operator.*.mutate` / admin-only surfaces | `isAdminOrOwner` |
| `operator.settings.{moduleId}.read` | `readonly_explorer` modules → member **allow**; else `isAdminOrOwner` |
| `operator.settings.{moduleId}.mutate` | `isAdminOrOwner` |
| `urban.*` | **not** operator surfaces — use `canPerformWorkspaceOwnerMutation` (Urban package) |

**Options:** `canPerformOperatorSurface(surface, { settingsModules })` — when `settingsModules` omitted, built-in member-readable module ids: `audit_trail` (SDK-9.6-03), `workspace_branding` (SDK-9.6-04).

Urban regression (SDK-9.1-04) stays on `canPerformWorkspaceOwnerMutation` / `@app-tour/workspace-urban` — not folded into operator surfaces.

---

## Anti-patterns (FAIL)

| Pattern                                     | Detection             |
| ------------------------------------------- | --------------------- |
| JWT `role` claim trusted without DB hydrate | DELTA-NP-04 violation |
| `(app)/` page without layout session guard  | INV-P9-007            |
| `isAdminOrOwner` on PATCH `/urban/settings` | INV-P8-007 regression |
| Nest `AuthGuard` copy-paste                 | DEC-P9-003            |
