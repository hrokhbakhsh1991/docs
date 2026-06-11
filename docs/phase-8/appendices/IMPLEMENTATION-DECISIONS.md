# Phase 8 — Implementation decisions (agent SoT)

```yaml
decision_doc_version: "2026-06-08-v2"
extends_pek: docs/phase-7/appendices/IMPLEMENTATION-DECISIONS.md
urban_owner_spec: appendices/CASL-URBAN-OWNER-SPEC.md
route_matrix: appendices/URBAN-ROUTE-MATRIX.md
```

> Resolves ambiguities before urban product code. **If conflict, this file wins** for Phase 8. Status **LOCKED** decisions require Architect waiver to change.

---

## DEC-P8-001 — Single-Owner isolation vs shared admin rights

```yaml
id: DEC-P8-001
status: APPROVED
locked: true
date: 2026-06-07
phase: 8.1
invariants: [INV-P8-007]
rules: [RULE-P8-004]
```

### Context

Legacy tour-ops workspaces commonly grant **admin** users configuration rights alongside **owner**. Phase 8 Product Parity for `@app-tour/workspace-urban` targets **city-tour operators** where a single workspace **owner** account controls catalog publication, registration policy, and public catalog settings. Trunk `buildTenantAuthz` uses `isAdminOrOwner` for `canManageTenant` and `canInstallPlugin`, and grants **all active members** `canUpdateCanonicalDocument`. That model allows **admin** and **member** actors to perform mutations that INV-P8-007 forbids on urban configuration surfaces.

Subphase 8.1 must ship before 8.2 product routes. Without a frozen decision, implementers will default to `isAdminOrOwner` and recreate shared-admin semantics.

### Decision

1. **Urban configuration mutations are owner-only.** Actors with `role=admin` receive **the same 403** as `role=member` on urban owner surfaces defined in [`CASL-URBAN-OWNER-SPEC.md`](CASL-URBAN-OWNER-SPEC.md).
2. **Gate function:** `isWorkspaceOwner(context)` — `role === "owner"` **and** `isActiveMember(context)`. No admin elevation.
3. **Surfaces:** `UrbanOwnerSurface` allowlist — settings read/update, catalog admin CRUD, publish/unpublish, tour publish-field patches. Public catalog browse and anonymous registration remain **outside** this gate.
4. **Non-urban workspaces:** `isAdminOrOwner` behavior **unchanged**. Decision applies when `workspaceType === "urban"` only.
5. **HTTP contract:** failures emit `403` with `code: URBAN_OWNER_REQUIRED` per error catalog in CASL-URBAN-OWNER-SPEC.

### Consequences

| Positive                                                     | Negative                                                                            |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| INV-P8-007 enforceable with machine tests                    | Urban **admin** users lose configuration powers they may expect from Denali/starter |
| Single audit matrix for owner vs member vs anonymous         | Product must document that admin is **support** role only on urban tenants          |
| Aligns with [`URBAN-ROUTE-MATRIX.md`](URBAN-ROUTE-MATRIX.md) | Legacy port must not copy admin-settings panels without owner gate                  |

**Verification:** `packages/workspaces/urban/test/urban-owner-ability.spec.ts` (admin → `canPerformUrbanOwnerMutation` false) · `apps/api/test/urban-owner-ability.spec.ts` (403 payload).

---

## DEC-P8-002 — TenantAuthz procedural role refactoring layer

```yaml
id: DEC-P8-002
status: APPROVED
locked: true
date: 2026-06-07
phase: 8.1
invariants: [INV-P8-007, INV-P8-002]
rules: [RULE-P8-004]
```

### Context

Phase 3 introduced `TenantAuthz` (`buildTenantAuthz`) as the **foundation** auth API; CASL `defineAbilityFor` is deprecated for new API code. Urban Single-Owner cannot be bolted onto `apps/api` with ad-hoc `if (role === "owner")` without violating RULE-P8-004 and duplicating web/API logic.

`packages/platform-core` must remain untouched (INV-P8-001). Urban product logic stays in `packages/workspaces/urban` for registry/validation, but **auth primitives** belong in `workspace-sdk` because `TenantAuthContext` and `TenantAuthz` are shared contracts.

### Decision

1. **Add `isWorkspaceOwner` to** `packages/workspace-sdk/src/auth/tenant-auth-grants.ts` (exported from `@app-tour/workspace-sdk`).
2. **Extend `TenantAuthz`** with `canPerformUrbanOwnerMutation(tenantId, surface, workspaceType): boolean` implemented inside `buildTenantAuthz` — not a parallel auth system.
3. **API procedural gate:** `assertWorkspaceOwner` in `apps/api/src/urban/require-workspace-owner.ts` calls `canPerformUrbanOwnerMutation` after `resolveTenantContextFromRequest` and **before** `runWithHttpRequestContext`.
4. **Web procedural gate:** `canLoadUrbanSettings` in `apps/web/src/urban/urban-settings-access.ts` calls the same `TenantAuthz` method — no RHF mirror, no standalone CASL rules for urban settings.
5. **Workspace type resolution:** reuse `resolveWorkspaceTypeForTenant` (`apps/api/src/tenant/resolve-workspace-type.ts`) — no `URBAN_*` constants in generic middleware (INV-P8-002).
6. **No new CASL subjects** for urban in 8.1. Urban owner enforcement is **TenantAuthz procedural** with typed `UrbanOwnerSurface` enum.

### Consequences

| Positive                                              | Negative                                                                                                          |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Single SoT for API + web owner checks                 | `TenantAuthz` interface change requires workspace-sdk version bump                                                |
| Testable without HTTP (`urban-owner-ability.spec.ts`) | `canPerformUrbanOwnerMutation` must be called with correct `workspaceType` — wrong type → false → accidental deny |
| Preserves `buildTenantAuthz` for non-urban paths      | Publish-field detection on generic `PATCH /tours` requires urban branch in tours handler (8.1/8.2 boundary)       |

**Forbidden:** new `UrbanAbility` CASL class · urban rules in `packages/platform-core` · `isAdminOrOwner` on `UrbanOwnerSurface` routes.

**Verification:** REQ-P8-010..012 · [`CASL-URBAN-OWNER-SPEC.md`](CASL-URBAN-OWNER-SPEC.md) § Verification artifacts.

---

## DEC-P8-003 — GET vs PATCH HTTP response shapes (`/urban/settings`)

```yaml
id: DEC-P8-003
status: APPROVED
locked: true
date: 2026-06-07
phase: 8.1
invariants: [INV-P8-007]
rules: [RULE-P8-004]
authority: appendices/schemas/URBAN-SETTINGS-HTTP-ENVELOPE.yaml
```

### Context

Early 8.1 drafts showed `sendJson(res, 200, { urban: theme.urban })` for **both** `GET` and `PATCH /urban/settings`. That collides with Phase 5 metadata envelope practice (`correlationId`, theme sibling keys) and confuses agents implementing read handlers vs write handlers.

### Decision

| Route                   | HTTP 200 body root                                                                                                                                | Normative contract                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `GET /urban/settings`   | `{ success: true, data: { urban }, metadata: { tenantId, workspaceId, workspaceType, correlationId, primaryColor, featureFlags, rateLimitRps } }` | [`schemas/URBAN-SETTINGS-HTTP-ENVELOPE.yaml`](schemas/URBAN-SETTINGS-HTTP-ENVELOPE.yaml)   |
| `PATCH /urban/settings` | `{ urban: theme.urban }`                                                                                                                          | [`URBAN-THEME-MERGE-ALGORITHM.md`](URBAN-THEME-MERGE-ALGORITHM.md) § HTTP RESPONSE (PATCH) |

1. **GET** exposes Phase 5 theme **sibling keys** only under `metadata` — never under `data.urban`.
2. **PATCH** returns read-your-writes **urban subtree only** at root — no `success`/`metadata` wrapper (mutation response stays minimal).
3. **`data.urban`** on GET MUST deep-equal `tenants.theme.urban` after read; **`metadata.*`** MUST mirror `tenants.theme` siblings with `null` when absent.

### Forbidden

- Bare `{ urban: … }` on **GET** 200
- Full `tenants.theme` object at response root on either verb
- `primaryColor` / `featureFlags` / `rateLimitRps` inside `data.urban`

**Verification:** `pnpm run phase-8:guard` → `p8_envelope_consistency` · ASM-8.1-001 in `apps/api/test/urban-settings-patch.spec.ts` · golden example in `URBAN-SETTINGS-HTTP-ENVELOPE.yaml`.

---

## DEC-P8-004 — TenantAuthz method surface (no free-function drift)

```yaml
id: DEC-P8-004
status: APPROVED
locked: true
date: 2026-06-08
phase: 8.1
decisions: [DEC-P8-002]
```

### Context

SDK specs and web guards diverged on **where** urban owner checks live: standalone `canPerformUrbanOwnerMutation(authz, …)` imports vs `TenantAuthz` instance methods · `isWorkspaceOwner` imported from `tenant-authz.ts` vs `tenant-auth-grants.ts` · router allowlist pointed at `wizard-access*.ts` instead of urban settings access module.

### Decision

1. **`canPerformUrbanOwnerMutation` is a `TenantAuthz` instance method only** — signature `(tenantId, surface, workspaceType)` inside `buildTenantAuthz`. **No** standalone exported function.
2. **`isWorkspaceOwner(context: TenantAuthContext)`** lives in `packages/workspace-sdk/src/auth/tenant-auth-grants.ts` only.
3. **Web module** `apps/web/src/urban/urban-settings-access.ts` is a thin wrapper re-exporting [`CANLOAD-URBAN-SETTINGS.contract.ts`](CANLOAD-URBAN-SETTINGS.contract.ts) — single authority for `canLoadUrbanSettings` until UI lands. The contract types `authz` as structural **`UrbanOwnerAuthz`** (not `import type` from `@app-tour/workspace-sdk`) so `apps/web` `tsc --noEmit` can compile the re-export without resolving workspace package paths from `docs/`.
4. **Middleware name** is `assertWorkspaceOwner` everywhere — not `assertUrbanOwner`.

**Verification (8.1 original):** `pnpm run phase-8:guard` → `p8_api_surface_alignment` · SDK spec uses `authz.canPerformUrbanOwnerMutation` · guard forbids stale router path.

**Superseded by Phase 10.5 (trunk):** `canPerformUrbanOwnerMutation` is a **workspace-package helper** in `packages/workspaces/urban/src/auth/urban-owner-auth.ts` that delegates to generic `TenantAuthz.canPerformWorkspaceOwnerMutation`. `UrbanOwnerSurface` lives in the urban package, not `tenant-authz.ts`. Spec path: `packages/workspaces/urban/test/urban-owner-ability.spec.ts`. DEC-P8-004 item 1 is **historical** — behavioral contract unchanged (owner-only urban surfaces).

---

## Cross-reference index

| ID          | Topic                             | Spec                                                               |
| ----------- | --------------------------------- | ------------------------------------------------------------------ |
| DEC-P8-001  | Owner vs admin on urban           | CASL-URBAN-OWNER-SPEC § `isWorkspaceOwner`                         |
| DEC-P8-002  | TenantAuthz extension             | CASL-URBAN-OWNER-SPEC § `canPerformUrbanOwnerMutation`             |
| DEC-P8-003  | GET envelope vs PATCH urban root  | URBAN-SETTINGS-HTTP-ENVELOPE.yaml · URBAN-THEME-MERGE-ALGORITHM.md |
| DEC-P8-004  | Method-only API · web wrapper law | SPEC-REGISTRY-8.1.yaml · phase-8-agent-router.md §2.2              |
| INV-P8-007  | Single-Owner product rule         | subphases/8.1-single-owner-auth.md                                 |
| RULE-P8-004 | Enforcement                       | phase-8-guard + verification-matrix                                |
