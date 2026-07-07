# AP14 — Platform Route Error-Message Leak Remediation

**Scope:** `apps/api/src/routes/platform/**/*.ts`  
**Date:** 2026-07-07  
**Guard:** `pnpm run guard:catch-error-leak`  
**Standard:** [`docs/dev/error-handling-standard.mdoc`](../docs/dev/error-handling-standard.mdoc)

## Summary

All platform ops route catch blocks that previously returned opaque `{ error: "internal_error" }` literals, bare `catch {` (no bound error), or dynamic verification text now delegate to `handlePlatformRouteError(res, err)`, which maps Prisma `P2002`→409 and `P2003`→422 via `handleHttpError` / `mapPrismaErrorToAppError` before logging. Unmapped failures return opaque 500 envelopes; stack traces stay in pino logs only.

---

## 1. Shared helper — `platform-route-errors.ts` (new)

**Why:** Centralizes platform auth/validation mapping and ensures every unhandled failure flows through `handleHttpError` (Prisma-aware, no client stack/SQL).

```typescript
export function handlePlatformRouteError(res: ServerResponse, err: unknown): void {
  if (respondPlatformAuthError(res, err)) return;
  if (respondPlatformValidationError(res, err)) return;
  handleHttpError(res, err); // P2002→409, P2003→422, else opaque 500
}
```

**Secure because:** Clients never receive `(err as Error).message`, Prisma invocation text, or raw stacks; only stable `error`/`code` tokens from the interceptor.

---

## 2. `workspaces.ts` — leaked `err.message` on auth failure

### Before (insecure)

```typescript
} catch (err: any) {
  if (err instanceof PlatformUnauthorized || err?.code === "PLATFORM_UNAUTHORIZED") {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "unauthorized", code: "PLATFORM_UNAUTHORIZED" }));
    return;
  }
  res.writeHead(500, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: err.message })); // LEAK: engine/SQL text to client
}
```

### After (secure)

```typescript
} catch (err: unknown) {
  if (respondPlatformAuthError(res, err)) return;
  handlePlatformRouteError(res, err);
  return;
}
```

**Why secure:** Unknown auth failures no longer echo arbitrary exception text; Prisma conflicts map to 409/422; everything else is opaque 500.

---

## 3. `team.ts` — manual opaque 500 without Prisma mapping

### Before

```typescript
} catch (err: unknown) {
  if (writePlatformAuthError(res, err)) return;
  res.writeHead(500, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "internal_error" }));
  return;
}
// POST body catch:
  res.writeHead(500, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "internal_error" }));
```

### After

```typescript
} catch (err: unknown) {
  if (writePlatformAuthError(res, err)) return;
  handlePlatformRouteError(res, err);
  return;
}
// POST body catch:
} catch (err: unknown) {
  if (respondPlatformValidationError(res, err)) return;
  handlePlatformRouteError(res, err);
}
// GET listAll wrapped:
} catch (err: unknown) {
  handlePlatformRouteError(res, err);
}
```

**Why secure:** Repository upsert unique violations (`P2002`) now return 409 instead of generic 500; logs use pino, not stdout stack dumps.

---

## 4. `tenants-domains.ts` — verification message + internal_error catches

### Before (domain verify — dynamic message in body)

```typescript
if (!verification.ok) {
  res.writeHead(422, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: false, message: verification.message }));
  return;
}
```

### After

```typescript
if (!verification.ok) {
  res.writeHead(422, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "cname_mismatch", code: "DOMAIN_CNAME_MISMATCH" }));
  return;
}
```

### Before (POST create catch)

```typescript
} catch (err: unknown) {
  // validation branch ...
  res.writeHead(500, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "internal_error" }));
}
```

### After

```typescript
} catch (err: unknown) {
  // validation branch ...
  handlePlatformRouteError(res, err);
}
```

**Why secure:** DNS/CNAME diagnostic strings stay server-side; clients get a stable domain code only.

---

## 5. `plans-list.ts` — broken bare catch (ReferenceError risk)

### Before

```typescript
} catch {
  handlePlatformRouteError(res, err); // err undefined at runtime
}
```

### After

```typescript
} catch (err: unknown) {
  handlePlatformRouteError(res, err);
}
```

**Why secure:** Error is bound and routed through the interceptor; no silent failure or accidental leak path.

---

## 6. Bulk replacement — 25+ platform route files

**Pattern replaced across:** `audit-export-get.ts`, `billing-run-past-due-post.ts`, `domains-*`, `tenants-*-post.ts`, `workspace-definitions-*`, etc.

### Before

```typescript
} catch (err: unknown) {
  // domain-specific branches ...
  res.writeHead(500, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "internal_error" }));
}
```

### After

```typescript
} catch (err: unknown) {
  // domain-specific branches ...
  handlePlatformRouteError(res, err);
}
```

**Why secure:** Consistent Prisma mapping and opaque fallback; `guard:catch-error-leak` enforces no `err.message` in response bodies.

---

## 7. `tenants-create.ts` — auth catch aligned

### Before

```typescript
} catch (err: unknown) {
  // 401/403 branches ...
  res.writeHead(500, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "internal_error" }));
  return;
}
```

### After

```typescript
} catch (err: unknown) {
  // 401/403 branches ...
  handlePlatformRouteError(res, err);
  return;
}
```

Main saga catch already used `handleHttpError(res, err)` — unchanged.

---

## Verification

| Check | Result |
|-------|--------|
| `pnpm run guard:catch-error-leak` | PASS |
| `test/platform-provision.spec.ts` AP14 leak test | PASS |
| `src/middleware/error-interceptor-prisma.spec.ts` P2002/P2003/P2025 | PASS (6/6) |

**Architect, documentation status:** Updated. Link to docs: [`docs/dev/error-handling-standard.mdoc`](../docs/dev/error-handling-standard.mdoc)

---

# Phase 5f — Service-Layer N+1 Remediation (Exposure Control Plane)

**Scope:** `apps/api/src/exposure/exposure-control-plane.service.ts`  
**Date:** 2026-07-07  
**Guard:** `pnpm run guard:service-n-plus-one`  
**Standard:** [`docs/dev/ci-defensive-guards.mdoc`](../docs/dev/ci-defensive-guards.mdoc) (Phase 5f batch reads)

## Summary

Two allowlisted methods performed repository reads inside `for` / `Promise.all(…map(async))` loops:

| Method | Loop pattern | Queries (before) |
|--------|--------------|------------------|
| `getWorkspaceExposureControlPlane` | `Promise.all(enabledConnections.map(async …))` | 1× `listForConnectionScope` per connection |
| `buildConnectionContexts` | `for (eventType of eventTypes)` | 1× `findForContext` (legacy fallback) + 1× `ensureSeededProfile` per cache miss per event |

Refactored to **≤3 batch queries** per request: `listForConnectionScopes` → `findForContexts` → `ensureSeededProfiles`, then synchronous context assembly.

---

## 1. New repository interfaces

### `ExposureIntentRepository.listForConnectionScopes`

```typescript
listForConnectionScopes(input: {
  readonly tenantId: string;
  readonly connectionIds: readonly string[];
}): Promise<ReadonlyMap<string, readonly ExposureIntent[]>>;
```

**Why:** Single `findMany` with `OR` on `scope.connectionId` replaces N parallel `listForConnectionScope` calls.

### `ExposureProfileRepository.ensureSeededProfiles`

```typescript
ensureSeededProfiles(input: {
  readonly tenantId: string;
  readonly seeds: readonly ExposureProfile[];
}): Promise<ReadonlyMap<string, ExposureProfile>>;
```

**Why:** One `findMany` by `profileId IN (…)` + creates for missing seeds replaces per-event `ensureSeededProfile` / `findByProfileId` in the event loop.

(`findForContexts` already existed on `ExposureIntentRepository` — now used for all legacy intent fallbacks in one shot.)

---

## 2. `getWorkspaceExposureControlPlane` — per-connection parallel queries

### Before (N+1)

```typescript
const connections = await Promise.all(
  integrations.items
    .filter((connection) => connection.enabled)
    .map(async (connection) => ({
      connectionId: connection.id,
      provider: connection.provider,
      enabled: connection.enabled,
      backingSource: connection.backingSource,
      contexts: await buildConnectionContexts({
        tenantId: auth.tenantId,
        workspaceType,
        connection,
        defaultEventTypes,
      }),
    })),
);
```

Each `buildConnectionContexts` call hit `listForConnectionScope` once, then looped event types with more queries.

### After (batch prefetch)

```typescript
const enabledConnections = integrations.items.filter((connection) => connection.enabled);
const intentsByConnection = await intentRepository.listForConnectionScopes({
  tenantId: auth.tenantId,
  connectionIds: enabledConnections.map((connection) => connection.id),
});

const legacyIntentKeys = /* collect sync from all connections */;
const legacyIntentLookup = await intentRepository.findForContexts(legacyIntentKeys);

const profileSeedsById = /* collect sync after legacy resolution */;
const profileById = await profileRepository.ensureSeededProfiles({
  tenantId: auth.tenantId,
  seeds: [...profileSeedsById.values()],
});

const connections = enabledConnections.map((connection) => ({
  connectionId: connection.id,
  provider: connection.provider,
  enabled: connection.enabled,
  backingSource: connection.backingSource,
  contexts: buildConnectionContextsFromPrefetch({
    tenantId: auth.tenantId,
    workspaceType,
    connection,
    defaultEventTypes,
    connectionIntents: intentsByConnection.get(connection.id) ?? [],
    legacyIntentLookup,
    profileById,
  }),
}));
```

**Why secure against N+1:** Query count is O(1) in connection count and event count; loops only assemble DTOs from in-memory maps.

---

## 3. `buildConnectionContexts` — per-event-type repository loop

### Before (N+1)

```typescript
async function buildConnectionContexts(input: { ... }): Promise<...> {
  const connectionIntents = await intentRepository.listForConnectionScope({ ... });

  for (const eventType of eventTypes) {
    const intentResolution = await resolveConnectionExposureIntentForRoute(intentRepository, {
      connectionIntents,
      // legacy path → await findForContext per event
    });

    if (seededProfile !== null && !persistedProfileCache.has(cacheKey)) {
      persistedProfile = await resolvePersistedExposureProfileForContext(
        { tenantId, context: profileContext },
        { repository: profileRepository },
      ); // ensureSeededProfile → findByProfileId per miss
    }
    contexts.push({ ... });
  }
  return contexts;
}
```

### After (sync assembly from prefetch)

```typescript
function buildConnectionContextsFromPrefetch(input: {
  readonly connectionIntents: readonly ExposureIntent[];
  readonly legacyIntentLookup: ReadonlyMap<string, ExposureIntent>;
  readonly profileById: ReadonlyMap<string, ExposureProfile>;
  // ...
}): readonly ExposureControlPlaneEventContext[] {
  for (const eventType of eventTypes) {
    const intentResolution = resolveConnectionIntentForEventSync({
      connectionIntents: input.connectionIntents,
      legacyIntentLookup: input.legacyIntentLookup,
      // no await — legacy intent from map
    });
    const persistedProfile =
      seededProfile === null ? null : (input.profileById.get(seededProfile.id) ?? null);
    contexts.push({ ... });
  }
  return contexts;
}
```

**Why secure against N+1:** No `await` inside the event loop; all DB work completed in the orchestrating function.

---

## Verification

| Check | Result |
|-------|--------|
| `pnpm run guard:service-n-plus-one` | PASS (allowlist empty) |
| `test/exposure-batch-reads.spec.ts` EXP-BATCH-02/04 | PASS |
| `exposure-control-plane.service.spec.ts` | PASS |

**Architect, documentation status:** Updated. Link to docs: [`docs/dev/ci-defensive-guards.mdoc`](../docs/dev/ci-defensive-guards.mdoc)

---

# Phase 6 — Workspace Plugin Contract Export Surface

**Scope:** `packages/workspaces/*` (`denali`, `starter`, `urban`, `guest-club`)  
**Date:** 2026-07-07  
**Authority:** [`docs/dev/denali-plugin-encapsulation.mdoc`](../docs/dev/denali-plugin-encapsulation.mdoc), `WorkspacePlugin` in `@app-tour/workspace-sdk`  
**Deferred guard:** `guard:workspace-export-surface` (Phase 6)

## What is the Plugin Contract?

The **Plugin Contract** is the minimum surface a host needs to **register** a workspace plugin — not to wire HTTP routes, wizard UI, tour write, or other manifest-bound capabilities.

| Tier | Subpath | Purpose | Required for registration? |
|------|---------|---------|----------------------------|
| **Contract** | `./plugin` (or thin `.`) | `get*WorkspacePlugin()` frozen `WorkspacePlugin` | **Yes** |
| **Contract** | `./theme/*.css` | Brand stylesheets referenced by plugin theme constants | **Yes** (host CSS injection) |
| **Not contract** | `./http`, `./tours`, `./ui/*`, `./wizard/*`, … | Manifest-bound host bindings (codegen wires these) | No |
| **Not contract** | `./messages/*`, `./catalog-registration-flow/*` | i18n assets + registration flow UI | No |
| **Not contract** | `.` (fat barrel) | Re-exports `internal.ts`, smoke fixtures, leaf modules | No — must be thinned |

Optional `WorkspacePlugin` capabilities (`exposureSurface`, `integrationSurface`, `tourList`, …) are **attached to the plugin object** at runtime; hosts must not import registry/rules/composites directly from the package root.

---

## Denali — subpaths **not** Plugin Contract

**Current export count:** ~99 keys in `package.json`  
**Plugin Contract only:** 2 (+ theme wildcard)

### Keep (contract)

| Subpath | Symbols |
|---------|---------|
| `./plugin` | `getDenaliWorkspacePlugin`, `createDenaliWorkspacePlugin`, `DENALI_*` id/type/theme constants (6-symbol allowlist) |
| `./theme/tokens.css` | Design tokens |
| `./theme/denali-admin.css` | Admin skin |
| `./theme/denali-portal.css` | Portal skin |
| `./theme/denali-marketing.css` | Marketing skin |
| `./theme/admin-skin.css` | Admin skin alias |
| `.` (thin) | Same 6 symbols as `./plugin` only — **not** the current 100+ symbol barrel |

### Remove from public exports (not contract)

| Category | Subpaths (representative) | Why not contract |
|----------|---------------------------|------------------|
| **Manifest HTTP** | `./http`, `./http/routes` | Host loads via `workspace.manifest.json` → `httpRoutes.handlerPackage` |
| **Tour / canonical** | `./tours`, `./tours/tour-list-category-surface`, `./acl`, `./clone`, `./clone/hydration` | `tourWrite`, `canonicalTour`, `wizardCloneRemint` manifest blocks |
| **Wizard engine** | `./wizard/*` (except bound surfaces), `./plugin-for-wizard-engine` | Engine adapter; not registration |
| **Wizard UI chrome** | `./ui/chrome/*-surface`, `./ui/composite-surface`, `./ui/review-surface`, … | `wizardSurfaces` / `wizardDraftShell` manifest bindings |
| **Field leaf modules** | `./ui/fields/*`, `./ui/components/*`, `./ui/logic/*`, `./ui/adapters/*`, `./ui/hooks/*` | Operator UI internals |
| **Settings** | `./settings/*` | `settingsEnrichers`, `wizardTemplateEditor` manifest bindings |
| **Finance / events** | `./finance/api-tour-created-adapter` | `events[].hostSideEffect` manifest binding |
| **Marketing** | `./marketing`, `./marketing/marketing-catalog-surface` | `marketingCatalog` manifest binding |
| **Exposure module** | `./exposure` | Loaded by API exposure guard; also on `plugin.exposureSurface` |
| **Registration flow** | `./catalog-registration-flow`, `./catalog-registration-flow/react` | `workspace-plugin-host` registration flow bootstrap |
| **i18n** | `./messages/en/wizard.json`, `./messages/fa/wizard.json` | `wizardI18n` manifest binding |
| **Fat root** | `.` (as today) | Re-exports `internal.ts`, composites, smoke tenants, draft/clone helpers |
| **Wildcards** | `./ui/adapters/*`, `./ui/logic/*`, `./ui/hooks/*`, `./ui/test-ids/*` | Unbounded internal surface |

---

## Proposed `package.json` exports (Plugin Contract only)

### `@app-tour/workspace-denali`

```json
{
  "name": "@app-tour/workspace-denali",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./plugin": {
      "types": "./dist/denali.plugin.d.ts",
      "default": "./dist/denali.plugin.js"
    },
    "./theme/tokens.css": "./theme/tokens.css",
    "./theme/admin-skin.css": "./theme/admin-skin.css",
    "./theme/denali-admin.css": "./theme/denali-admin.css",
    "./theme/denali-portal.css": "./theme/denali-portal.css",
    "./theme/denali-marketing.css": "./theme/denali-marketing.css"
  }
}
```

**Prerequisite:** Slim `src/index.ts` to re-export only the 6 `./plugin` allowlist symbols (today it re-exports 100+ symbols from `internal.ts`, composites, smoke fixtures, etc.).

### `@app-tour/workspace-starter`

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./theme/tokens.css": "./theme/tokens.css",
    "./theme/starter-portal.css": "./theme/starter-portal.css",
    "./theme/starter-marketing.css": "./theme/starter-marketing.css"
  }
}
```

Remove `./exposure` from exports (not registration; API loads via plugin object / manifest). Root `.` is already thin (`getStarterWorkspacePlugin` + theme constant).

### `@app-tour/workspace-urban`

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./plugin": {
      "types": "./dist/urban.plugin.d.ts",
      "default": "./dist/urban.plugin.js"
    },
    "./theme/tokens.css": "./theme/tokens.css",
    "./theme/urban-portal.css": "./theme/urban-portal.css",
    "./theme/urban-marketing.css": "./theme/urban-marketing.css"
  }
}
```

Remove `./http`, `./tours`, `./catalog-registration-flow/*`, `./exposure`, `./messages/*`, `./auth`, `./catalog`. Thin `.` to plugin getter + theme constant only (today re-exports full registry from `urban.plugin.ts`).

### `@app-tour/workspace-guest-club`

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./plugin": {
      "types": "./dist/guest-club.plugin.d.ts",
      "default": "./dist/guest-club.plugin.js"
    },
    "./theme/tokens.css": "./theme/tokens.css",
    "./theme/guest-club-portal.css": "./theme/guest-club-portal.css",
    "./theme/marketing/marketing.css": "./theme/marketing/marketing.css"
  }
}
```

Rename `./guest-club.plugin` → `./plugin` (manifest + codegen migration). Remove `./http`, `./catalog-registration-flow/*`, `./catalog`.

---

## Migration note — manifest-bound imports

Manifest-bound subpaths (`./http`, `./wizard/wizard-rules-surface`, etc.) are **not** Plugin Contract but are still required by codegen until a **`./host/*` export map** (auto-generated from `workspace.manifest.json`) is introduced. Recommended two-phase rollout:

1. **Phase A:** Enforce Plugin Contract (`./plugin`, `./theme/*`, thin `.`); add `./host/*` re-exports for every manifest binding.
2. **Phase B:** Point `generate-workspace-registry.mjs` at `./host/…` instead of leaf subpaths; delete legacy top-level exports.

---

## `apps/` imports that **break** under Plugin Contract-only exports

### Safe (unchanged)

| Import | Files |
|--------|-------|
| `@app-tour/workspace-denali/plugin` | `apps/web/src/bootstrap/workspace-plugin-loaders.generated.ts`, `apps/api/src/workspace/workspace-plugin-registry.generated.ts` |
| `@app-tour/workspace-urban/plugin` | same loaders |
| `@app-tour/workspace-starter` (thin root) | starter plugin loader |
| `@app-tour/workspace-*/theme/*.css` | `apps/web`, `apps/portal`, `apps/marketing` theme stylesheet bootstraps |

### Break — use `./plugin` instead of fat root

| Current import | Example file | Correct surface |
|----------------|--------------|-----------------|
| `@app-tour/workspace-denali` → `getDenaliWorkspacePlugin` | `apps/web/test/wizard-template-field-labels.spec.ts` | `@app-tour/workspace-denali/plugin` |
| `@app-tour/workspace-denali` → `DENALI_WORKSPACE_TYPE` | `apps/api/src/tours/workspace-tour-write-bindings.generated.ts` | `@app-tour/workspace-denali/plugin` (`DENALI_WORKSPACE_TYPE`) |
| `@app-tour/workspace-denali` → smoke / template builders | `apps/api/src/settings/workspace-dev-bootstrap-bindings.generated.ts` | Move smoke fixtures to `@app-tour/workspace-denali/host/dev-smoke` (Phase B) or keep in API test-only package |
| `@app-tour/workspace-urban` → registry / smoke | `apps/api/src/settings/workspace-dev-bootstrap-bindings.generated.ts` | `@app-tour/workspace-urban/plugin` |
| `@app-tour/workspace-guest-club/guest-club.plugin` | plugin loaders | `@app-tour/workspace-guest-club/plugin` (after rename) |

### Break — manifest-bound (need `./host/*` or codegen retarget)

| Current import | Example file | Correct surface |
|----------------|--------------|-----------------|
| `@app-tour/workspace-denali/http` | `apps/api/src/http/workspace-http-routes.generated.ts` | `@app-tour/workspace-denali/host/http` (manifest `httpRoutes.handlerPackage`) |
| `@app-tour/workspace-denali/tours` | `apps/api/src/tours/workspace-tour-write-bindings.generated.ts` | `@app-tour/workspace-denali/host/tours` (manifest `tourWrite.module`) |
| `@app-tour/workspace-denali/acl` | `apps/api/src/canonical/workspace-canonical-tour-bindings.generated.ts` | `@app-tour/workspace-denali/host/acl` |
| `@app-tour/workspace-denali/photos` | `apps/api/src/tours/workspace-wizard-media-bindings.generated.ts` | `@app-tour/workspace-denali/host/photos` |
| `@app-tour/workspace-denali/clone` | `apps/api/src/tours/workspace-wizard-clone-remint-bindings.generated.ts` | `@app-tour/workspace-denali/host/clone` |
| `@app-tour/workspace-denali/finance/api-tour-created-adapter` | `apps/api/src/workspace/workspace-outbox-side-effects.generated.ts` | `@app-tour/workspace-denali/host/finance/api-tour-created-adapter` |
| `@app-tour/workspace-denali/wizard/wizard-rules-surface` | `apps/web/src/bootstrap/workspace-wizard-rules-bindings.generated.ts` | `@app-tour/workspace-denali/host/wizard/wizard-rules-surface` |
| `@app-tour/workspace-denali/ui/chrome/wizard-*-surface` | `apps/web/src/bootstrap/workspace-wizard-*-bindings.generated.ts` (12 files) | `@app-tour/workspace-denali/host/ui/chrome/…` |
| `@app-tour/workspace-denali/settings/*` | settings enrichers + wizard template bindings | `@app-tour/workspace-denali/host/settings/…` |
| `@app-tour/workspace-denali/marketing/marketing-catalog-surface` | `apps/marketing/src/bootstrap/workspace-marketing-catalog-bindings.generated.ts` | `@app-tour/workspace-denali/host/marketing/marketing-catalog-surface` |
| `@app-tour/workspace-denali/messages/*/wizard.json` | `apps/web/src/bootstrap/workspace-wizard-message-loads.generated.ts` | `@app-tour/workspace-denali/host/messages/…` |
| `@app-tour/workspace-denali/catalog-registration-flow` | `packages/workspace-plugin-host/src/register-denali.generated.ts` | `@app-tour/workspace-denali/host/catalog-registration-flow` |
| `@app-tour/workspace-urban/http`, `./tours` | API generated bindings | `@app-tour/workspace-urban/host/http`, `/host/tours` |
| `@app-tour/workspace-guest-club/http` | API generated bindings | `@app-tour/workspace-guest-club/host/http` |

### Break — hand-written `apps/api` (not generated)

| Current import | File | Correct surface |
|----------------|------|-----------------|
| `@app-tour/workspace-denali/http` | `apps/api/src/middleware/workspace-http-error-map.generated.ts`, finance HTTP hosts | `./host/http` |
| `@app-tour/workspace-denali/wizard/wizard-rules-surface` | `apps/api/src/tours/denali-wizard-rules-module-sync.ts` | `./host/wizard/wizard-rules-surface` |
| `@app-tour/workspace-denali` (multiple) | `apps/api/src/settings/*`, `apps/api/src/tours/*`, `apps/api/src/canonical/*`, finance, exposure | `./plugin` for plugin metadata; `./host/…` for domain modules |
| `@app-tour/workspace-denali/exposure` | exposure resolver specs | `./host/exposure` or `getDenaliWorkspacePlugin().exposureSurface` |

### Break — `apps/web/test` (co-locate or host test package)

~60 spec files import Denali leaf paths (`./ui/logic/*`, `./ui/chrome/*`, `./draft`, `./wizard/*`). These are **workspace-internal tests** that should live under `packages/workspaces/denali/test/` or import via a **`@app-tour/workspace-denali/host/*`** dev export — not the Plugin Contract surface.

Representative examples:

| Current import | Example test | Correct surface |
|----------------|--------------|-----------------|
| `@app-tour/workspace-denali/ui/logic/denali-tour-kind-field-logic` | `denali-tour-kind-field-logic.spec.ts` | Move test into `packages/workspaces/denali/test/` |
| `@app-tour/workspace-denali/ui/chrome/draft-persist` | `denali-wizard-save-loop.spec.ts` | `./host/ui/chrome/draft-persist` or in-package relative import |
| `@app-tour/workspace-denali/adapters/canonical-basics` | `denali-wizard-save-loop.spec.ts` | `./host/adapters/canonical-basics` |
| `@app-tour/workspace-denali/ui/test-ids/*` | E2E specs | `./host/ui/test-ids/*` (test-only export) |

### Break — `packages/workspace-plugin-host` (not under `apps/` but same constraint)

| Import | File |
|--------|------|
| `@app-tour/workspace-denali/catalog-registration-flow` | `register-denali.generated.ts` |
| `@app-tour/workspace-urban/catalog-registration-flow` | `register-urban.generated.ts` |
| `@app-tour/workspace-guest-club/catalog-registration-flow` | `register-guest-club.generated.ts` |

→ Retarget to `@app-tour/workspace-*/host/catalog-registration-flow`.

---

## Impact summary

| Package | Current export keys | Proposed contract keys | Unique import paths in `apps/` | Est. breaking files |
|---------|--------------------|------------------------|--------------------------------|---------------------|
| `workspace-denali` | ~99 | 7 | 95 | ~150 (incl. tests) |
| `workspace-starter` | 5 | 4 | 4 | 0 (plugin loader only) |
| `workspace-urban` | 16 | 5 | 11 | ~8 generated + tests |
| `workspace-guest-club` | 10 | 5 | 6 | ~5 generated |

---

## Recommended enforcement

1. Slim each workspace `src/index.ts` to plugin allowlist symbols.
2. Add codegen step: emit `host/package.json` export entries from `workspace.manifest.json` binding paths.
3. Wire `guard:workspace-export-surface` to fail when `package.json` exports keys ∉ `{ ".", "./plugin", "./theme/*" }` ∪ manifest `./host/*` set.
4. Migrate `apps/**` generated bindings to `./host/…` in one registry codegen PR.

**Architect, documentation status:** Not Needed (analysis-only append to remediation log). Link to docs: [`docs/dev/denali-plugin-encapsulation.mdoc`](../docs/dev/denali-plugin-encapsulation.mdoc)

---

# Phase 6 — Workspace Plugin Contract Export Surface

**Scope:** `packages/workspaces/*` (`denali`, `starter`, `urban`, `guest-club`)  
**Date:** 2026-07-07  
**Authority:** [`docs/dev/denali-plugin-encapsulation.mdoc`](../docs/dev/denali-plugin-encapsulation.mdoc), `WorkspacePlugin` in `@app-tour/workspace-sdk`  
**Deferred guard:** `guard:workspace-export-surface` (Phase 6)

## What is the Plugin Contract?

The **Plugin Contract** is the minimum surface a host needs to **register** a workspace plugin — not to wire HTTP routes, wizard UI, tour write, or other manifest-bound capabilities.

| Tier | Subpath | Purpose | Required for registration? |
|------|---------|---------|----------------------------|
| **Contract** | `./plugin` (or thin `.`) | `get*WorkspacePlugin()` frozen `WorkspacePlugin` | **Yes** |
| **Contract** | `./theme/*.css` | Brand stylesheets referenced by plugin theme constants | **Yes** (host CSS injection) |
| **Not contract** | `./http`, `./tours`, `./ui/*`, `./wizard/*`, … | Manifest-bound host bindings (codegen wires these) | No |
| **Not contract** | `./messages/*`, `./catalog-registration-flow/*` | i18n assets + registration flow UI | No |
| **Not contract** | `.` (fat barrel) | Re-exports `internal.ts`, smoke fixtures, leaf modules | No — must be thinned |

Optional `WorkspacePlugin` capabilities (`exposureSurface`, `integrationSurface`, `tourList`, …) are **attached to the plugin object** at runtime; hosts must not import registry/rules/composites directly from the package root.

---

## Denali — subpaths **not** Plugin Contract

**Current export count:** ~99 keys in `package.json`  
**Plugin Contract only:** 2 (+ theme wildcard)

### Keep (contract)

| Subpath | Symbols |
|---------|---------|
| `./plugin` | `getDenaliWorkspacePlugin`, `createDenaliWorkspacePlugin`, `DENALI_*` id/type/theme constants (6-symbol allowlist) |
| `./theme/tokens.css` | Design tokens |
| `./theme/denali-admin.css` | Admin skin |
| `./theme/denali-portal.css` | Portal skin |
| `./theme/denali-marketing.css` | Marketing skin |
| `./theme/admin-skin.css` | Admin skin alias |
| `.` (thin) | Same 6 symbols as `./plugin` only — **not** the current 100+ symbol barrel |

### Remove from public exports (not contract)

| Category | Subpaths (representative) | Why not contract |
|----------|---------------------------|------------------|
| **Manifest HTTP** | `./http`, `./http/routes` | Host loads via `workspace.manifest.json` → `httpRoutes.handlerPackage` |
| **Tour / canonical** | `./tours`, `./tours/tour-list-category-surface`, `./acl`, `./clone`, `./clone/hydration` | `tourWrite`, `canonicalTour`, `wizardCloneRemint` manifest blocks |
| **Wizard engine** | `./wizard/*` (except bound surfaces), `./plugin-for-wizard-engine` | Engine adapter; not registration |
| **Wizard UI chrome** | `./ui/chrome/*-surface`, `./ui/composite-surface`, `./ui/review-surface`, … | `wizardSurfaces` / `wizardDraftShell` manifest bindings |
| **Field leaf modules** | `./ui/fields/*`, `./ui/components/*`, `./ui/logic/*`, `./ui/adapters/*`, `./ui/hooks/*` | Operator UI internals |
| **Settings** | `./settings/*` | `settingsEnrichers`, `wizardTemplateEditor` manifest bindings |
| **Finance / events** | `./finance/api-tour-created-adapter` | `events[].hostSideEffect` manifest binding |
| **Marketing** | `./marketing`, `./marketing/marketing-catalog-surface` | `marketingCatalog` manifest binding |
| **Exposure module** | `./exposure` | Loaded by API exposure guard; also on `plugin.exposureSurface` |
| **Registration flow** | `./catalog-registration-flow`, `./catalog-registration-flow/react` | `workspace-plugin-host` registration flow bootstrap |
| **i18n** | `./messages/en/wizard.json`, `./messages/fa/wizard.json` | `wizardI18n` manifest binding |
| **Fat root** | `.` (as today) | Re-exports `internal.ts`, composites, smoke tenants, draft/clone helpers |
| **Wildcards** | `./ui/adapters/*`, `./ui/logic/*`, `./ui/hooks/*`, `./ui/test-ids/*` | Unbounded internal surface |

---

## Proposed `package.json` exports (Plugin Contract only)

### `@app-tour/workspace-denali`

```json
{
  "name": "@app-tour/workspace-denali",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./plugin": {
      "types": "./dist/denali.plugin.d.ts",
      "default": "./dist/denali.plugin.js"
    },
    "./theme/tokens.css": "./theme/tokens.css",
    "./theme/admin-skin.css": "./theme/admin-skin.css",
    "./theme/denali-admin.css": "./theme/denali-admin.css",
    "./theme/denali-portal.css": "./theme/denali-portal.css",
    "./theme/denali-marketing.css": "./theme/denali-marketing.css"
  }
}
```

**Prerequisite:** Slim `src/index.ts` to re-export only the 6 `./plugin` allowlist symbols (today it re-exports 100+ symbols from `internal.ts`, composites, smoke fixtures, etc.).

### `@app-tour/workspace-starter`

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./theme/tokens.css": "./theme/tokens.css",
    "./theme/starter-portal.css": "./theme/starter-portal.css",
    "./theme/starter-marketing.css": "./theme/starter-marketing.css"
  }
}
```

Remove `./exposure` from exports (not registration; API loads via plugin object / manifest). Root `.` is already thin (`getStarterWorkspacePlugin` + theme constant).

### `@app-tour/workspace-urban`

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./plugin": {
      "types": "./dist/urban.plugin.d.ts",
      "default": "./dist/urban.plugin.js"
    },
    "./theme/tokens.css": "./theme/tokens.css",
    "./theme/urban-portal.css": "./theme/urban-portal.css",
    "./theme/urban-marketing.css": "./theme/urban-marketing.css"
  }
}
```

Remove `./http`, `./tours`, `./catalog-registration-flow/*`, `./exposure`, `./messages/*`, `./auth`, `./catalog`. Thin `.` to plugin getter + theme constant only (today re-exports full registry from `urban.plugin.ts`).

### `@app-tour/workspace-guest-club`

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./plugin": {
      "types": "./dist/guest-club.plugin.d.ts",
      "default": "./dist/guest-club.plugin.js"
    },
    "./theme/tokens.css": "./theme/tokens.css",
    "./theme/guest-club-portal.css": "./theme/guest-club-portal.css",
    "./theme/marketing/marketing.css": "./theme/marketing/marketing.css"
  }
}
```

Rename `./guest-club.plugin` → `./plugin` (manifest + codegen migration). Remove `./http`, `./catalog-registration-flow/*`, `./catalog`.

---

## Migration note — manifest-bound imports

Manifest-bound subpaths (`./http`, `./wizard/wizard-rules-surface`, etc.) are **not** Plugin Contract but are still required by codegen until a **`./host/*` export map** (auto-generated from `workspace.manifest.json`) is introduced. Recommended two-phase rollout:

1. **Phase A:** Enforce Plugin Contract (`./plugin`, `./theme/*`, thin `.`); add `./host/*` re-exports for every manifest binding.
2. **Phase B:** Point `generate-workspace-registry.mjs` at `./host/…` instead of leaf subpaths; delete legacy top-level exports.

---

## `apps/` imports that **break** under Plugin Contract-only exports

### Safe (unchanged)

| Import | Files |
|--------|-------|
| `@app-tour/workspace-denali/plugin` | `apps/web/src/bootstrap/workspace-plugin-loaders.generated.ts`, `apps/api/src/workspace/workspace-plugin-registry.generated.ts` |
| `@app-tour/workspace-urban/plugin` | same loaders |
| `@app-tour/workspace-starter` (thin root) | starter plugin loader |
| `@app-tour/workspace-*/theme/*.css` | `apps/web`, `apps/portal`, `apps/marketing` theme stylesheet bootstraps |

### Break — use `./plugin` instead of fat root

| Current import | Example file | Correct surface |
|----------------|--------------|-----------------|
| `@app-tour/workspace-denali` → `getDenaliWorkspacePlugin` | `apps/web/test/wizard-template-field-labels.spec.ts` | `@app-tour/workspace-denali/plugin` |
| `@app-tour/workspace-denali` → `DENALI_WORKSPACE_TYPE` | `apps/api/src/tours/workspace-tour-write-bindings.generated.ts` | `@app-tour/workspace-denali/plugin` (`DENALI_WORKSPACE_TYPE`) |
| `@app-tour/workspace-denali` → smoke / template builders | `apps/api/src/settings/workspace-dev-bootstrap-bindings.generated.ts` | Move smoke fixtures to `@app-tour/workspace-denali/host/dev-smoke` (Phase B) or keep in API test-only package |
| `@app-tour/workspace-urban` → registry / smoke | `apps/api/src/settings/workspace-dev-bootstrap-bindings.generated.ts` | `@app-tour/workspace-urban/plugin` |
| `@app-tour/workspace-guest-club/guest-club.plugin` | plugin loaders | `@app-tour/workspace-guest-club/plugin` (after rename) |

### Break — manifest-bound (need `./host/*` or codegen retarget)

| Current import | Example file | Correct surface |
|----------------|--------------|-----------------|
| `@app-tour/workspace-denali/http` | `apps/api/src/http/workspace-http-routes.generated.ts` | `@app-tour/workspace-denali/host/http` (manifest `httpRoutes.handlerPackage`) |
| `@app-tour/workspace-denali/tours` | `apps/api/src/tours/workspace-tour-write-bindings.generated.ts` | `@app-tour/workspace-denali/host/tours` (manifest `tourWrite.module`) |
| `@app-tour/workspace-denali/acl` | `apps/api/src/canonical/workspace-canonical-tour-bindings.generated.ts` | `@app-tour/workspace-denali/host/acl` |
| `@app-tour/workspace-denali/photos` | `apps/api/src/tours/workspace-wizard-media-bindings.generated.ts` | `@app-tour/workspace-denali/host/photos` |
| `@app-tour/workspace-denali/clone` | `apps/api/src/tours/workspace-wizard-clone-remint-bindings.generated.ts` | `@app-tour/workspace-denali/host/clone` |
| `@app-tour/workspace-denali/finance/api-tour-created-adapter` | `apps/api/src/workspace/workspace-outbox-side-effects.generated.ts` | `@app-tour/workspace-denali/host/finance/api-tour-created-adapter` |
| `@app-tour/workspace-denali/wizard/wizard-rules-surface` | `apps/web/src/bootstrap/workspace-wizard-rules-bindings.generated.ts` | `@app-tour/workspace-denali/host/wizard/wizard-rules-surface` |
| `@app-tour/workspace-denali/ui/chrome/wizard-*-surface` | `apps/web/src/bootstrap/workspace-wizard-*-bindings.generated.ts` (12 files) | `@app-tour/workspace-denali/host/ui/chrome/…` |
| `@app-tour/workspace-denali/settings/*` | settings enrichers + wizard template bindings | `@app-tour/workspace-denali/host/settings/…` |
| `@app-tour/workspace-denali/marketing/marketing-catalog-surface` | `apps/marketing/src/bootstrap/workspace-marketing-catalog-bindings.generated.ts` | `@app-tour/workspace-denali/host/marketing/marketing-catalog-surface` |
| `@app-tour/workspace-denali/messages/*/wizard.json` | `apps/web/src/bootstrap/workspace-wizard-message-loads.generated.ts` | `@app-tour/workspace-denali/host/messages/…` |
| `@app-tour/workspace-denali/catalog-registration-flow` | `packages/workspace-plugin-host/src/register-denali.generated.ts` | `@app-tour/workspace-denali/host/catalog-registration-flow` |
| `@app-tour/workspace-urban/http`, `./tours` | API generated bindings | `@app-tour/workspace-urban/host/http`, `/host/tours` |
| `@app-tour/workspace-guest-club/http` | API generated bindings | `@app-tour/workspace-guest-club/host/http` |

### Break — hand-written `apps/api` (not generated)

| Current import | File | Correct surface |
|----------------|------|-----------------|
| `@app-tour/workspace-denali/http` | `apps/api/src/middleware/workspace-http-error-map.generated.ts`, finance HTTP hosts | `./host/http` |
| `@app-tour/workspace-denali/wizard/wizard-rules-surface` | `apps/api/src/tours/denali-wizard-rules-module-sync.ts` | `./host/wizard/wizard-rules-surface` |
| `@app-tour/workspace-denali` (multiple) | `apps/api/src/settings/*`, `apps/api/src/tours/*`, `apps/api/src/canonical/*`, finance, exposure | `./plugin` for plugin metadata; `./host/…` for domain modules |
| `@app-tour/workspace-denali/exposure` | exposure resolver specs | `./host/exposure` or `getDenaliWorkspacePlugin().exposureSurface` |

### Break — `apps/web/test` (co-locate or host test package)

~60 spec files import Denali leaf paths (`./ui/logic/*`, `./ui/chrome/*`, `./draft`, `./wizard/*`). These are **workspace-internal tests** that should live under `packages/workspaces/denali/test/` or import via a **`@app-tour/workspace-denali/host/*`** dev export — not the Plugin Contract surface.

Representative examples:

| Current import | Example test | Correct surface |
|----------------|--------------|-----------------|
| `@app-tour/workspace-denali/ui/logic/denali-tour-kind-field-logic` | `denali-tour-kind-field-logic.spec.ts` | Move test into `packages/workspaces/denali/test/` |
| `@app-tour/workspace-denali/ui/chrome/draft-persist` | `denali-wizard-save-loop.spec.ts` | `./host/ui/chrome/draft-persist` or in-package relative import |
| `@app-tour/workspace-denali/adapters/canonical-basics` | `denali-wizard-save-loop.spec.ts` | `./host/adapters/canonical-basics` |
| `@app-tour/workspace-denali/ui/test-ids/*` | E2E specs | `./host/ui/test-ids/*` (test-only export) |

### Break — `packages/workspace-plugin-host` (not under `apps/` but same constraint)

| Import | File |
|--------|------|
| `@app-tour/workspace-denali/catalog-registration-flow` | `register-denali.generated.ts` |
| `@app-tour/workspace-urban/catalog-registration-flow` | `register-urban.generated.ts` |
| `@app-tour/workspace-guest-club/catalog-registration-flow` | `register-guest-club.generated.ts` |

→ Retarget to `@app-tour/workspace-*/host/catalog-registration-flow`.

---

## Impact summary

| Package | Current export keys | Proposed contract keys | Unique import paths in `apps/` | Est. breaking files |
|---------|--------------------|------------------------|--------------------------------|---------------------|
| `workspace-denali` | ~99 | 7 | 95 | ~150 (incl. tests) |
| `workspace-starter` | 5 | 4 | 4 | 0 (plugin loader only) |
| `workspace-urban` | 16 | 5 | 11 | ~8 generated + tests |
| `workspace-guest-club` | 10 | 5 | 6 | ~5 generated |

---

## Recommended enforcement

1. Slim each workspace `src/index.ts` to plugin allowlist symbols.
2. Add codegen step: emit `host/package.json` export entries from `workspace.manifest.json` binding paths.
3. Wire `guard:workspace-export-surface` to fail when `package.json` exports keys ∉ `{ ".", "./plugin", "./theme/*" }` ∪ manifest `./host/*` set.
4. Migrate `apps/**` generated bindings to `./host/…` in one registry codegen PR.

**Architect, documentation status:** Not Needed (analysis-only append to remediation log). Link to docs: [`docs/dev/denali-plugin-encapsulation.mdoc`](../docs/dev/denali-plugin-encapsulation.mdoc)


---

# AP15 — Identity Repository Unbounded `findMany` Remediation

**Scope:** `apps/api/src/identity/prisma-identity.repository.ts`  
**Debt:** Unbounded `findMany` on `userTenant` and `operatorPendingInvite` (MASTER_AUDIT_LOG supplement)  
**Date:** 2026-07-07  
**Guard alignment:** [`docs/dev/list-projection-guards.mdoc`](../docs/dev/list-projection-guards.mdoc) · RLS preserved via `withTenantRls`

## Problem

Tenant-scoped list methods loaded full row sets with no `take` or `select`:

| Method | Before | Risk |
|--------|--------|------|
| `listMembershipsByTenant` | `findMany({ where: { tenantId } })` | O(members) incl. `membershipMetadata` Json |
| `listMembershipsWithUsersByTenant` | unbounded `findMany` + `include` | Operator directory hot path |
| `listPendingInvitesByTenant` | unbounded invite `findMany` | Grows with pending invites |

`resolve-pending-invite-auth.ts` listed all invites then filtered in memory.

**RLS unchanged** — all reads remain under `withTenantRls(tenantId, …)`.

**Error opacity unchanged** — repository layer only; no HTTP `err.message` leakage.

## Solution — `identity-list-projection.ts`

- `MAX_IDENTITY_MEMBERSHIPS_PER_TENANT = 500`
- `MAX_PENDING_INVITES_PER_TENANT = 200`
- `MEMBERSHIP_LIST_SELECT` / `PENDING_INVITE_LIST_SELECT`

## Refactored queries

```typescript
// listMembershipsByTenant — after
tx.userTenant.findMany({
  where: { tenantId },
  select: MEMBERSHIP_LIST_SELECT,
  orderBy: { userId: "asc" },
  take: MAX_IDENTITY_MEMBERSHIPS_PER_TENANT,
})

// listPendingInvitesByTenant — after
tx.operatorPendingInvite.findMany({
  where: { tenantId, status: "INVITED" },
  select: PENDING_INVITE_LIST_SELECT,
  orderBy: { inviteId: "asc" },
  take: MAX_PENDING_INVITES_PER_TENANT,
})

// findPendingInviteByPhone — new (findFirst, not list scan)
tx.operatorPendingInvite.findFirst({
  where: { tenantId, status: "INVITED", phone: normalizeMobile(phone) },
  select: PENDING_INVITE_LIST_SELECT,
})
```

## Caller fixes

- `resolve-pending-invite-auth.ts` → `findPendingInviteByPhone`
- `resolve-denali-catalog-ref-allowlists.ts` → `listMembershipsWithUsersByTenant` (drops N× `findUserById`)

## Verification

| Check | Result |
|-------|--------|
| `test/identity-list-projection.spec.ts` ID-LIST-01..03 | PASS |
| `test/identity-pending-invite-rls.spec.ts` ID-RLS-07/08 | PASS |

**Architect, documentation status:** Updated. Link to docs: [`docs/dev/list-projection-guards.mdoc`](../docs/dev/list-projection-guards.mdoc)

---

# P0 — Bookings `getById` Tenant Scope (AP5 hardening)

**Scope:** `apps/api/src/bookings/` · `workspace-finance/finance.service.ts`  
**Debt:** IDOR risk — admin probe resolved tenant from PK alone; callers could fetch cross-tenant rows if authz skipped  
**Date:** 2026-07-07

## Problem

`PrismaBookingsRepository.getById(id)` admin-probed `tenantId` from registration PK, then fetched under RLS. Security depended on every caller passing auth checks after the read. Tour reads already require `getById(id, tenantId)`.

## Solution

| Layer | Change |
|-------|--------|
| **Repository** | `getById(id, tenantId)` — `withTenantRls` + `findFirst({ id, tenantId })` only |
| **In-memory** | Return `null` when `row.tenantId !== tenantId` |
| **Caller** | `finance.service.ts` passes `auth.tenantId` |
| **Guard** | `guard:bookings-getbyid-tenant-scope` — no `getPrismaAdmin()` in `getById`; admin probes elsewhere must `select: { tenantId: true }` |

`listOutboxByAggregate` retains minimal admin probe (tenant unknown at boundary).

## Verification

| Check | Result |
|-------|--------|
| `guard:bookings-getbyid-tenant-scope` | PASS |
| `test/bookings-safety.spec.ts` BK-SAFE-03, BK-SAFE-06 | PASS |
| `test/bookings-create.spec.ts` | PASS |

**Architect, documentation status:** Updated. Link to docs: [`docs/dev/list-projection-guards.mdoc`](../docs/dev/list-projection-guards.mdoc) · [`docs/dev/ci-defensive-guards.mdoc`](../docs/dev/ci-defensive-guards.mdoc)

---

# P1 — Unbounded `findMany` Remediation (AP15 completion)

**Scope:** settings audit · integrations · draft events · bookings outbox · `guard-unbounded-list`  
**Date:** 2026-07-07

## Changes

| Area | Before | After |
|------|--------|-------|
| Settings audit | unbounded `findMany` | `listByTenantPage` keyset `(occurredAt desc, id desc)` + cap 500 |
| Integration lists | full row incl. `credentials` | `INTEGRATION_CONNECTION_LIST_SELECT` + take 50 |
| Integration policies | unbounded policy `findMany` | `INTEGRATION_EVENT_POLICY_LIST_SELECT` + take 100 |
| Draft events | fetch-all + in-memory slice | SQL `take` + `orderBy` |
| Bookings outbox | unbounded per aggregate | `MAX_OUTBOX_EVENTS_PER_AGGREGATE` (100) |
| Guard | `operatorRegistration` + `tour` only | all tenant delegates; P3 file allowlist |

## New modules

- `settings-audit-list-projection.ts`
- `integration-list-projection.ts`
- `workspace-draft-events-list-projection.ts`
- `bookings-outbox-projection.ts`

## Verification

| Check | Result |
|-------|--------|
| `guard-unbounded-list` | PASS |
| `test/settings-audit-list-projection.spec.ts` SET-AUD-01..03 | PASS |
| `test/integration-list-projection.spec.ts` INT-LIST-01..03 | PASS |
| `test/workspace-draft-events-list.spec.ts` DRF-EVT-01..02 | PASS |
| `test/bookings-safety.spec.ts` BK-SAFE-07 | PASS |
| `test/settings-audit-trail.spec.ts` | PASS |

**Architect, documentation status:** Updated. Link to docs: [`docs/dev/list-projection-guards.mdoc`](../docs/dev/list-projection-guards.mdoc)

---

# P2 — Workspace Export Encapsulation (Phase 6)

**Scope:** all four workspaces · registry codegen · apps import retarget · guards  
**Date:** 2026-07-07

## Problem

Workspace `package.json` exported 100+ subpaths at package root. Apps and codegen imported implementation modules directly, bypassing the Plugin Contract.

## Solution

| Layer | Change |
|-------|--------|
| **Exports** | Contract: `.`, `./plugin`, `./theme/*`; other keys → `./host/*` |
| **Codegen** | `importSpecifier()` prefixes manifest paths with `/host/` |
| **Urban** | Slim plugin + `internal.ts` + `guard:urban-plugin-surface` |
| **Guest-club** | `./plugin` export (was `./guest-club.plugin`) |
| **Starter** | `./host/exposure` |
| **Guards** | `guard:workspace-export-surface` wired to `phase-6:fast-track` |

## Verification

| Check | Result |
|-------|--------|
| `guard:workspace-export-surface` | PASS |
| `guard:urban-plugin-surface` | PASS |
| `guard:denali-plugin-surface` | PASS |
| `generate:workspace-registry` (57 outputs) | PASS |
| `workspace-registry-drop-in.spec.mjs` | PASS |

**Architect, documentation status:** Updated. Link to docs: [`docs/dev/denali-plugin-encapsulation.mdoc`](../docs/dev/denali-plugin-encapsulation.mdoc)

---

# P3 — Perf / Hardening (list caps, batch scans, auth leak)

**Scope:** settings catalogs · exposure intents · platform billing · identity directory · auth routes  
**Date:** 2026-07-07

## Changes

| Area | Before | After |
|------|--------|-------|
| Settings catalogs (7 lists) | unbounded `findMany` | `select` + `take: MAX_SETTINGS_CATALOG` (500) |
| Exposure intents | unbounded connection scope lists | `EXPOSURE_INTENT_LIST_SELECT` + per-connection/batch caps |
| Platform past-due | single cross-tenant scan | `listExpiredPastDueBatch` (50) + cursor loop |
| Users directory | load 500 + in-memory filter/slice | `countMembershipsDirectory` + `listMembershipsWithUsersDirectoryPage` (SQL skip/take / raw name sort) |
| Auth routes | `error.message` in JSON | `sendIdentityDomainError` — stable `code` only |
| Guard allowlist | settings + exposure intent deferred | removed from `guard-unbounded-list` allowlist |

## New modules

- `settings-catalog-list-projection.ts`
- `exposure-intent-list-projection.ts`
- `platform-subscription-list-projection.ts`
- `users-directory-list-projection.ts` · `users-directory-query.ts`
- `identity-domain-error-response.ts`

## Verification

| Check | Result |
|-------|--------|
| `guard-unbounded-list` | PASS |
| `test/settings-catalog-list-projection.spec.ts` SET-CAT-01..02 | PASS |
| `test/exposure-intent-list-projection.spec.ts` EXP-INT-01..02 | PASS |
| `test/identity-directory-pagination.spec.ts` ID-DIR-01..04 | PASS |
| `test/users-directory-sort.spec.ts` | PASS |
| `test/platform-billing-past-due.spec.ts` | PASS |

**Architect, documentation status:** Updated. Link to docs: [`docs/dev/list-projection-guards.mdoc`](../docs/dev/list-projection-guards.mdoc) · [`docs/dev/error-handling-standard.mdoc`](../docs/dev/error-handling-standard.mdoc)

---

# Closure — Guard alignment (post P2/P3)

**Date:** 2026-07-07

After `./host/*` export retarget, stale guard expectations were updated:

| Guard | Fix |
|-------|-----|
| `guard-wizard-post-submit-contract` | Accept `@app-tour/workspace-denali/host/ui/...` photo codec path |
| `guard-guest-frozen-shell` | Per-plugin `register-<id>.generated.ts` wiring (replaces legacy global transport/flow bootstrap in `register.ts`) |
| `guard-guest-consumer-deps` | Skip self-package `@app-tour/workspace-plugin-host` in consumer dep scan |
| Urban manual imports | 10 فایل `apps/api` — `@app-tour/workspace-urban/{http,exposure,tours}` → `/host/…` |

## Verification (phase-6 guard chain)

| Check | Result |
|-------|--------|
| `guard:import-boundary` | PASS |
| `guard:denali-plugin-surface` | PASS |
| `guard:urban-plugin-surface` | PASS |
| `guard:workspace-export-surface` | PASS |
| `guard:unbounded-list` | PASS |
| `guard:bookings-getbyid-tenant-scope` | PASS |
| `guard:guest-plugin-conformance` | PASS |
| `phase-6:guard` | PASS (4/4) |

**Architect, documentation status:** Not Needed (guard-only alignment).

---

# AP14 follow-up — ZOD validation 400 (post P3)

**Scope:** ingress validation errors with spaces in message  
**Date:** 2026-07-07

## Problem

`ASM-8.1-015` (`PATCH /urban/settings` invalid slug) returned **500** `internal_error` instead of **400**. `mapErrorMessageToStatus` mapped `ZOD_VALIDATION_FAILED` to 400, but `isClientSafeErrorToken()` rejected messages containing spaces/colons → opaque 500.

## Fix

`error-interceptor.ts` — branch before opaque-token gate: when status is 400 and message starts with `ZOD_VALIDATION_FAILED` or `CANONICAL_VALIDATION_FAILED`, respond with full prefixed message in `error` and stable `code`.

## Verification

| Check | Result |
|-------|--------|
| `test/urban-settings-patch.spec.ts` ASM-8.1-015 | PASS |
| `error-interceptor-prisma.spec.ts` AP14-PRISMA-07..08 | PASS |

**Architect, documentation status:** Updated. Link to docs: [`docs/dev/error-handling-standard.mdoc`](../docs/dev/error-handling-standard.mdoc)

---

# Phase 6 P2 follow-up — root barrel import elimination

**Date:** 2026-07-07

## Problem

66 files imported host symbols from `@app-tour/workspace-denali` / `@app-tour/workspace-urban` root after contract-only `index.ts`.

## Fix

- Added `./host/finance`, `./host/smoke/*`, `./host/settings/*`, `./host/denali-plugin-build` exports
- Urban: `validateUrbanRegistrationPayload` via `host/http`; smoke + settings template exports
- Codemod `scripts/codemods/retarget-denali-urban-root-imports.mjs` — 66 files

## Verification

| Check | Result |
|-------|--------|
| Root denali/urban imports | 0 |
| `guard:workspace-export-surface` | PASS |
| `denali-workspace-plugin.spec.ts` | PASS |

**Architect, documentation status:** Updated. Link to docs: [`docs/dev/workspace-export-encapsulation.mdoc`](../docs/dev/workspace-export-encapsulation.mdoc)

---

# Phase 7 — DTCG / semantic colors (apps/web)

**Date:** 2026-07-07

## Changes

- Removed 18 hex fallbacks from 5 CSS modules
- Replaced ~22 Tailwind palette usages with `--color-success` / `--color-warning` semantic vars
- Added `semantic-callout.module.css` + `docs/dev/semantic-color-contract.mdoc`

## Verification

| Check | Result |
|-------|--------|
| Hex in apps/web admin/tours CSS | 0 |
| emerald/amber/green in apps/web TSX | 0 |
| `guard-dtcg-hex-ban` | PASS |

**Architect, documentation status:** Updated. Link to docs: [`docs/dev/semantic-color-contract.mdoc`](../docs/dev/semantic-color-contract.mdoc)

---

# Performance Remediation — Phases 1–6 (2026-07-07)

**Docs:** [`docs/dev/list-projection-guards.mdoc`](../docs/dev/list-projection-guards.mdoc) · [`docs/dev/ci-defensive-guards.mdoc`](../docs/dev/ci-defensive-guards.mdoc)

## Phase 1 — Bookings (P0)

- Member booking summary: SQL `count*` + `listRecentBySubmittedUser(take: 10)` — `bookings-member-summary-projection.ts`
- `listByTenant` delegates to `listByTenantPage` cap 500
- `listBySubmittedUser` bounded at 500

## Phase 2 — Finance (P1)

- `loadRegistrationInvoiceFacts` — aggregate SQL for prepayment/paid sums; bounded payment list
- Removed finance repos from guard allowlist

## Phase 3 — Repository N+1 (P1)

- `bulkApproveWithOutbox` — single `withTenantRls` tx + `updateMany`
- `ensureSeededProfiles` — `createMany` + batched `findMany`
- `listByScope` drafts — `take: 50`

## Phase 4 — Hardening (P2)

- Settings slug conflict — `findFirst` not full slug scan
- Canonical migration — keyset batches of 500
- `findUsersByIds` — explicit `take: uniqueIds.length`

## Phase 5 — Guards (P3)

- `guard-unbounded-list` — select-only without take **FAIL**
- `guard-repository-n-plus-one` (new)
- `audit:findmany-scan` wired to `phase-6:fast-track`

## Phase 6 — Operator tour list (P0)

- `listOperatorToursPage` — one DB page per HTTP request (`operator-tour-list-db-query.ts`)
- `listToursOperator` no longer calls `loadAllTourRecordsViaListPage`

## Verification

| Check | Result |
|-------|--------|
| `guard:unbounded-list` | PASS |
| `guard:repository-n-plus-one` | PASS |
| `audit:findmany-scan` | PASS |
| `test/users-role-history.spec.ts` | PASS |
| `test/tour-safety.spec.ts` | PASS |

**Architect, documentation status:** Updated. Link to docs: [`docs/dev/list-projection-guards.mdoc`](../docs/dev/list-projection-guards.mdoc)
