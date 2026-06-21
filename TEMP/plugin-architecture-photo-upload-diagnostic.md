# Plugin Architecture Diagnostic — Photo Upload & Wizard Infrastructure

> **Type:** Strict diagnostic review (no code changes)  
> **Date:** 2026-06-18  
> **Context:** Denali is one workspace/plugin among many; wizard engine, draft system, composite renderers, and photo upload must be plugin-agnostic.

---

## 1. Overall Plugin Readiness Score: **68/100**

**Verdict:** Photo upload is **correctly implemented as Denali product logic**, but **platform routes, BFF paths, and several web/draft layers still assume Denali is the only workspace with wizard media** — acceptable for Phase 11–12 (Denali-first), not yet a plugin-neutral asyncAsset platform.

---

## 2. Current Structure & Hardcoding Level

### Intended layering (as designed in Phase 12)

```text
platform-core (render plan, engine)
    ↓ compositeId in uiHints
workspace-sdk (WorkspacePlugin, wizardHost hooks, compositeSurfaceId)
    ↓ pluginId / workspaceType
packages/workspaces/denali (field registry, schemas, MinIO keys, composites)
    ↓ compositeSurfaceId: "denali"
apps/web (WorkspaceWizardHost, registries, page clients)
apps/api (HTTP routes, tenant auth, workspaceType gate)
```

Photo upload **correctly lives** in `packages/workspaces/denali` + `apps/web/src/wizard/denali/*`. Leakage is where **generic shells call Denali-only backends** without a plugin capability contract.

### Hardcoded `"denali"` inventory (photo + wizard infra)

| Layer | File / symbol | Hardcoding summary | Severity |
|-------|----------------|-------------------|----------|
| **API route handler** | `apps/api/src/tours/tour-wizard-photos.routes.ts` | Imports `@app-tour/workspace-denali`; `workspaceType !== "denali"` gate | **High** — global route, Denali-only impl |
| **API route handler** | `apps/api/src/tours/clone-photo-remint.routes.ts` | Same pattern for clone remint | **High** |
| **API router** | `apps/api/src/app.ts` | `/tours/wizard-photos` registered globally (not plugin manifest) | **Med** |
| **BFF** | `apps/web/app/api/tours/wizard-photos/route.ts` | Fixed path; proxies to API (no `pluginId`) | **Med** |
| **Web upload client** | `apps/web/src/wizard/denali/denali-photo-upload-client.ts` | `fetch("/api/tours/wizard-photos")` — path in Denali folder OK; not plugin-configurable | **Low** (OK in plugin UI) |
| **Web i18n** | `apps/web/src/i18n/resolve-denali-photo-upload-error.ts` | Denali namespace keys (`denali.composites.photos.uploadErrors.*`) | **Low** — name says Denali |
| **Web registry** | `apps/web/src/wizard/wizard-composite-surface-registry.tsx` | Only `denali` + implicit Denali composite field | **Med** — by design until more plugins |
| **Web registry** | `apps/web/src/wizard/wizard-review-surface-registry.tsx` | `denali: denaliWizardReviewSurface` | **Med** — Phase 12 registry pattern |
| **Web page** | `apps/web/app/tours/new/new-tour-wizard-client.tsx` | `isDenali` branches; `createDenaliWizardDraftSessionId()` | **High** for multi-plugin tours |
| **Web draft** | `apps/web/src/draft/denali-wizard-draft-merge.ts`, `denali-draft-normalize-remote.ts`, etc. | Denali-named draft adapters wired from create page | **Med** |
| **platform-core** | `packages/platform-core/src/engine/render-plan.ts:97` | `entry.id.startsWith("denali.")` → composite hint | **High** — core knows Denali prefix |
| **Denali plugin** | `denali-wizard-host-hooks.ts` | `compositeSurfaceId: "denali"`, `wizardMessageNamespace: "denali"` | **OK** — belongs in plugin |
| **Denali composites** | `platform-renderer-ids.ts` | `"denali.photos"` composite id | **OK** — plugin namespace |
| **Denali field registry** | `denaliFieldRegistryData.ts` | `stepId: "denali_photos"`, `fieldKind: "asyncAsset"` | **OK** in plugin |
| **Denali types** | `denali-photo-types.ts`, `denaliFileAssetSchema.ts` | `DenaliTourPhoto`, `denaliImageFileAssetSchema` | **OK** in plugin |
| **Denali storage** | `tour-photo-object-key.ts` | `{tenantId}/wizard-drafts/{sessionId}/photos/{photoId}` | **Med** — path is generic; functions are `buildDenali*` |
| **Denali storage** | `minio-photo-storage.ts` | `putDenaliWizardDraftPhoto`, `rethrowMinioPhotoError` | **OK** in plugin package |
| **Error codes** | API + web | `PHOTO_STORAGE_FULL`, `WIZARD_PHOTO_*` — **not** Denali-prefixed | **Good** — portable codes |
| **Error codes** | Plugin | `DENALI_PHOTO_*` validation messages | **OK** in plugin |

### Not hardcoded (good)

- `WorkspaceWizardHost` accepts `pluginId` + optional `wizardSessionId` (generic props).
- `wizardSessionId` in envelope meta is workspace-agnostic field name (Denali schema owns it).
- `commitWizardDraftEdit` / `useLatestWizardDraft` are plugin-agnostic.

---

## 3. Plugin Architecture Compliance

### What follows the plugin system

| Mechanism | Compliance |
|-----------|------------|
| **Field registry → render plan** | Denali registers `photos` composite; engine emits `uiHints.compositeId` |
| **Composite rendering** | `WizardField` → `resolveWizardCompositeSurface(compositeSurfaceId)` → plugin registry |
| **Host hooks** | `denaliWizardHostHooks.compositeSurfaceId = "denali"` per `WorkspaceWizardHostHooks` (Phase 12.0) |
| **Tenant isolation** | API uses `auth.tenantId` in object keys + prefix check on signed URL |
| **Draft sync** | Generic `useWorkspaceDraft`; Denali-specific merge/normalize injected via page options |

This matches `docs/phase-12/subphases/12.1b-composite-field-registry.md`: *composite render = `compositeSurfaceId` + registry*.

### Where Denali assumptions leak into core/generic layers

1. **`platform-core` composite detection** — `denali.` prefix is baked into `buildFieldUiHints`, not derived from `kind === "composite"` or plugin-supplied namespace.

2. **Global API media routes** — `/tours/wizard-photos` sounds workspace-neutral but implementation is Denali + MinIO from `workspace-denali` only. No `WorkspacePlugin` dispatch or HTTP manifest entry.

3. **`asyncAsset` is Denali-local** — `DenaliFieldKind` includes `asyncAsset`; **workspace-sdk has no `asyncAsset` / media capability** on `WorkspacePlugin`. Starter/Urban have no photo upload path.

4. **Page client is Denali-shaped** — `new-tour-wizard-client.tsx` is the real orchestrator (draft envelope, schema gate, session id, merge). `WorkspaceWizardHost` is generic; the **tour create page is not**.

5. **Registries are Denali-only today** — `wizard-composite-surface-registry` has one entry (`denali`). Documented as Denali-first; Urban/Starter use platform composites only.

6. **BFF routes are not plugin-scoped** — No `/api/workspaces/[workspaceId]/wizard-assets/...` or `pluginId` query; contrast with draft routes under `/api/workspaces/{id}/drafts/...`.

---

## 4. Specific Findings — Photo Upload Chain

### Routes: `/api/tours/wizard-photos`

| Hop | Behavior | Plugin-neutral? |
|-----|----------|-----------------|
| Browser | `denali-photo-upload-client.ts` → Next BFF | Denali UI only |
| BFF | `apps/web/app/api/tours/wizard-photos/*` | Neutral path; no plugin routing |
| API | `tour-wizard-photos.routes.ts` | **Denali gate** + `putDenaliWizardDraftPhoto` |

Urban branding uses `/api/settings/branding/logo` (settings domain). Photos use **tours domain** but are **not** tour-id-scoped until submit — naming is hybrid.

### Object keys: `wizard-drafts/{sessionId}`

- Pattern `{tenantId}/wizard-drafts/{sessionId}/photos/{photoId}` is **workspace-agnostic** on disk.
- Builders are `buildDenaliWizardDraftPhotoObjectKey` in Denali package — fine if only Denali uses MinIO wizard drafts today.
- **Risk:** Second plugin reusing same prefix without a plugin segment could collide logically (same tenant, different products).

### Types: `DenaliTourPhoto`, `denaliImageFileAssetSchema`

- Live in Denali plugin + web mirror `denali-photo-types.ts` (thin parse helper).
- Canonical draft uses `photos` root array — **not** Denali-prefixed in canonical data (good).
- Zod wire path `photosData.photos` is legacy form shape in generated schema (plugin internal).

### Field registry: `denali_photos`

- Step id `denali_photos` is **plugin-scoped naming** (consistent with `denali_basic`, etc.).
- Not visible to platform-core except via Denali registry export to wizard engine.

### Error codes: `PHOTO_STORAGE_FULL`, etc.

- **Portable** product codes — appropriate for shared BFF/client error mapping.
- `resolve-denali-photo-upload-error.ts` maps to **Denali message namespace** — correct for Denali UI; another plugin would need its own resolver or a generic `resolveWorkspaceMediaUploadError(t, pluginId, code)`.

### Session: `wizardSessionId` in `new-tour-wizard-client.tsx`

- Host prop is generic (`WorkspaceWizardHostProps.wizardSessionId`).
- **Creation** uses `createDenaliWizardDraftSessionId()` from Denali package on page mount — not from `plugin.wizardHost` hook.
- Envelope meta `wizardSessionId` is Denali draft schema; merge logic in `denali-wizard-draft-merge.ts`.
- **Gap:** No plugin contract like `createWizardAssetSessionId()` on `WorkspaceWizardHostHooks`.

---

## 5. Risks & Recommendations

### How severe is coupling?

| Area | Severity | Rationale |
|------|----------|-----------|
| Denali-only API routes | **Medium** | Blocks second workspace with different storage (S3 vs MinIO vs URL-only) without copy-paste routes |
| `platform-core` `denali.` prefix | **Medium–High** | Violates stated "no denali in core" rule; Urban composite ids would need `urban.*` hack |
| Page client `isDenali` fork | **Medium** | Expected during Phase 11; blocks generic `/tours/new` for Starter |
| Photo UI in `apps/web/.../denali/` | **Low** | Correct placement |
| MinIO in `workspace-denali` | **Low** | Correct; could become one storage adapter behind SDK interface |
| Registry with single plugin | **Low** | Extensible pattern, needs second registrant |

**Not a crisis for current roadmap** (Denali is the only wizard with asyncAsset). **Is a real boundary debt** if Urban/Starter gain media steps without a deliberate design pass.

### Recommended minimal refactoring strategy (priority order)

| Priority | Action | Touch (conceptual) |
|----------|--------|-------------------|
| **P0** | Remove `denali.` prefix check from **platform-core** `render-plan.ts`; use `entry.kind === "composite"` only (registry already sets kind) | `packages/platform-core` |
| **P1** | Add **`WorkspaceMediaUploadHooks`** (or extend `wizardHost`) on `WorkspacePlugin`: `createWizardSessionId`, `buildWizardDraftObjectKey`, optional `uploadRouteSegment` | `workspace-sdk` + Denali plugin |
| **P1** | API: **`dispatchWizardMediaUpload(workspaceType)`** via plugin registry / lazy handler import — replace `workspaceType !== "denali"` in route | `apps/api` + each plugin with media |
| **P2** | BFF: **`/api/workspaces/[workspaceId]/wizard-assets`** or resolve path from session `pluginId` | `apps/web/app/api` |
| **P2** | Extract **generic `WizardAsyncAssetField`** shell in `apps/web/src/wizard/` that accepts injected `uploadClient` + `preview` from composite surface | `apps/web` (thin); Denali keeps `denali-photos-field` as thin wrapper or moves into `packages/workspaces/denali` UI export |
| **P3** | Split **`new-tour-wizard-client`** Denali draft wiring into `DenaliCreateTourWizardClient` vs generic `WorkspaceCreateTourPage` | `apps/web/app/tours/new` |
| **P3** | Generalize i18n: `resolveWorkspaceWizardUploadError(t, pluginId, code)` delegating to plugin namespace | `apps/web/src/i18n` |
| **P4** | Object key segment: `{tenantId}/{pluginId}/wizard-drafts/...` for clarity (migration for existing MinIO objects) | Denali photos + remint |

### Is current state acceptable for production-grade Denali?

**Yes, for Denali-only production**, with these caveats:

- Plugin boundary debt is **documented and localized** (Phase 12.9 remediation track).
- Photo upload **does not break** multi-tenant isolation within Denali.
- **Do not** claim the **platform** is plugin-neutral for async assets yet — only that **Denali is the reference plugin implementation**.

Another iteration is needed **before a second workspace** implements photos, not necessarily before shipping Denali operator wizard.

---

## 6. Questions for Clarification

1. **Will Urban or Starter ever use wizard file upload**, or is asyncAsset Denali-exclusive for the foreseeable roadmap?
2. **Should MinIO remain a shared platform service** with plugin-specific key builders, or should each plugin declare its own storage backend in manifest?
3. **Is the target API shape** plugin HTTP manifest routes (like `CATALOG_HTTP_ROUTE_MANIFEST`) vs generic `/tours/wizard-photos` with internal dispatch?
4. **Should `wizardSessionId` be standardized** in `workspace-sdk` draft meta for all plugins, or stay Denali envelope-only?
5. **Is renaming `denali_photos` → neutral `photos` step id** in templates a goal, or is step-id namespacing (`denali_*`) the long-term convention?

---

## 7. Strengths & Weaknesses Summary

### Strengths (what was done well)

- Composite pipeline (`denali.photos` → host → registry → `DenaliPhotosField`) matches Phase 12 registry design.
- Storage + validation live in **workspace-denali**, not `apps/api` business logic duplicated.
- Error codes (`PHOTO_STORAGE_FULL`) are **product-neutral**; Denali copy stays in `wizard.json`.
- Recent **draftRef / photoId** fixes align with generic draft engine semantics.

### Weaknesses (remaining)

- **No SDK contract for asyncAsset/media** — field kind is Denali-only folklore.
- **API routes are tour-scoped URLs with Denali-only handlers** — biggest cross-plugin leak.
- **`platform-core` still encodes `denali.`** — contradicts multi-plugin charter.
- **Create-tour page** remains a Denali orchestration shell despite generic `WorkspaceWizardHost`.

---

## 8. Key Paths Quick Reference

```
apps/web/src/wizard/denali/denali-photos-field.tsx           # UI + draft mutations (race-safe)
apps/web/src/wizard/denali/denali-photo-preview.tsx
apps/web/src/wizard/denali/denali-photo-upload-client.ts
apps/web/src/i18n/resolve-denali-photo-upload-error.ts
apps/web/src/wizard/workspace-wizard-host.tsx                # Generic host
apps/web/src/wizard/wizard-composite-surface-registry.tsx    # Denali-only registry leak
apps/web/app/api/tours/wizard-photos/route.ts                # BFF
apps/api/src/tours/tour-wizard-photos.routes.ts              # API + mapWizardPhotoError
packages/workspaces/denali/src/photos/minio-photo-storage.ts
packages/workspaces/denali/src/wizard/denali-wizard-host-hooks.ts
apps/web/app/tours/new/new-tour-wizard-client.tsx            # isDenali branching
docs/phase-6/subphases/6.7-minio-photos.md
docs/phase-12/subphases/12.1b-composite-field-registry.md
docs/phase-12/subphases/12.9-wizard-host-remediation.md
```

---

## 9. Sub-scores (for reference)

| Area | Score (approx.) |
|------|-----------------|
| Wizard host infrastructure | ~75/100 (Phase 12 hooks exist) |
| Photo upload pipeline | ~55/100 (API + BFF + web client Denali-coupled) |
| **Overall plugin readiness** | **68/100** |

---

*Architect, documentation status: Not Needed. (Diagnostic review artifact in TEMP/ only.)*
