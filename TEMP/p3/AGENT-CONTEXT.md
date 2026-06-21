# P3 — Agent Context (Facts Frozen — DO NOT RE-EXPLORE)

```yaml
doc_id: P3-AGENT-CONTEXT
purpose: single source of truth for AI — read once per session
forbidden: grep/read packages/workspaces/denali for discovery
updated: 2026-06-21
version: 1.2-aligned
current_task: P3-A-N-011
```

---

## 1. North star

Workspace verticals described by **DB metadata** (`fieldRegistry`, `ruleSet`, `wizard`) with **package overlay** for hooks. Optional no-code builder in Super Admin (P3-C).

---

## 2. Architecture (frozen)

```text
Tenant
  workspaceType              → always (finance HTTP, events, overlay source)
  workspaceDefinitionId?     → optional metadata binding
  workspaceDefinitionVersion?→ pin; null = latest published

WORKSPACE_METADATA_ENABLED=false (default) → always package path

When flag=true AND binding set:
  resolveWorkspacePluginForTenantById(tenantId)
    → load workspace_definition_versions row
    → adaptMetadataPayloadToWorkspacePlugin(payload, packageOverlay)
    → WorkspacePlugin (data from DB, hooks from package)
```

---

## 3. Payload shape (SDK — never guess)

**Type:** `WorkspaceDefinitionPayload` = Pick of `WorkspacePlugin` data fields  
**Import:** `@app-tour/workspace-sdk/metadata`

```typescript
interface WorkspaceWizardSurface {
  wizardMode: "classic" | "schema";
  railId: string;
  roots: readonly string[];
  inactiveFieldGroups: readonly string[];
  wizardCapacityStepRedundant: boolean;
}
// NO steps. NO surfaces. in DB JSON.
```

**Forbidden in JSON:** validation, lifecycle, wizardHost, wizardMedia, theme hooks as functions

---

## 4. Composite UI pipeline (frozen)

```text
fieldRegistry.fields[].id
  → platform-core buildRenderPlan → uiHints.compositeId
  → apps/web WizardField
  → resolveWizardCompositeSurface(wizardHost.compositeSurfaceId)
  → apps/web/src/bootstrap/wizard-surface-bindings.generated.ts
  → workspace surface.renderCompositeField({ compositeId })
  → renderer map (DENALI_COMPOSITE_RENDERERS today)
```

| Namespace | Owner | Example |
|-----------|-------|---------|
| primitives | ui-primitives | text, enum, number, date, boolean |
| `denali.*` | denali package | denali.photos, denali.itinerary |
| `platform.*` | P3-B `apps/web/src/wizard/platform/` | platform.photos (doc ✅, impl N-001) |
| surface id | manifest codegen | "denali" (factory key ≠ field id) |

---

## 5. Code that EXISTS (P3-A landed)

| Path | Role |
|------|------|
| `apps/api/prisma/migrations/20260621160000_workspace_definitions/` | definitions tables |
| `apps/api/prisma/migrations/20260621170000_tenant_workspace_definition/` | tenant columns |
| `packages/workspace-sdk/src/metadata/workspace-definition-payload.ts` | validate · strip · checksum |
| `apps/api/src/workspace-metadata/load-workspace-plugin-for-tenant.ts` | loader |
| `apps/api/src/workspace-metadata/metadata-plugin-adapter.ts` | overlay merge |
| `apps/api/src/workspace-metadata/read-tenant-workspace-metadata-binding.ts` | by tenant id |
| `apps/api/scripts/seed/definitions/denali-v1.json` | seed snapshot |
| `GET /platform/v1/workspace-definitions` | list |
| `PATCH /platform/v1/tenants/:id/workspace-definition` | assign |

---

## 6. Code that DOES NOT exist yet

| Item | EPIC |
|------|------|
| Production ingress uses metadata loader | P3-A-N-011 |
| `POST .../workspace-definitions/:id/versions` publish (code) | P3-C |
| `platform.*` composite React widgets | P3-B |
| Super Admin builder UI (code) | P3-C |
| `platform.*` composite React widgets (code) | P3-B |
| Metadata-only tenant (no overlay) | P3-D optional |

---

## 7. Production ingress — MUST wire in N-011

These files call `resolveWorkspacePluginForType` and **must** switch to tenant-aware resolve when `tenantId` available:

```text
apps/api/src/tours/canonical-validation-sync.ts     # getOrCreateValidationEngine · validateCanonicalBeforePersistSync
apps/api/src/tours/list-tours-operator.ts
apps/api/src/tours/get-tour-operator.ts
apps/api/src/tours/build-clone-tour-body.ts
apps/api/src/workspace-drafts/workspace-drafts.service.ts
apps/api/src/settings/settings-registry.ts
apps/api/src/settings/wizard-template-catalog.ts    # partial — denali baseline row
apps/api/src/marketing/should-invalidate-marketing-catalog.ts  # if tenantId available
```

**New helper (N-011 creates):**

```text
apps/api/src/workspace/resolve-workspace-plugin-for-tenant-context.ts
  export async function resolveWorkspacePluginForTenantContext(
    tenantId: string,
    workspaceType: string,
  ): Promise<WorkspacePlugin>
```

Delegates to `resolveWorkspacePluginForTenantById(tenantId)` — ignore redundant workspaceType when binding set.

---

## 8. Import boundaries (frozen)

| Rule | Detail |
|------|--------|
| SDK/platform-core | NO import from `packages/workspaces/*` |
| API platform | NO direct `@app-tour/workspace-denali` — registry only |
| Web platform UI | NO `denali/ui` in `apps/web/src/platform` |
| Metadata types | `@app-tour/workspace-sdk/metadata` subpath |
| Codegen | after manifest change: `pnpm run generate:workspace-registry` |

---

## 9. Super Admin builder (P3-C — doc complete, impl after P3-B-N-014)

**Doc SoT:** `docs/phase-16/platform-workspace-builder.mdoc` · **Nano spec:** `TEMP/p3/p3-c-workspace-builder.md` v1.3

| Fact | Evidence |
|------|----------|
| Immutable publish = INSERT version row only | mdoc § Immutable versioning |
| Owner-only POST publish | `assertPlatformOpsOwnerRole` (billing mark-paid pattern) |
| Preview = headless `PlatformWizardEngine.buildRenderPlan` | `workspace-wizard-host.tsx:281` |
| Assign reuses P3-A PATCH | `update-platform-tenant-workspace-definition.ts` |
| Audit ASSIGN/CLEAR exist; PUBLISHED pending | `platform-audit-logger.ts` |
| Builder route group | `apps/web/app/(platform)/workspace-definitions/` |
| No `denali/ui` in `apps/web/src/platform` | boundary spec RT-02 |

| Pattern | Path |
|---------|------|
| BFF | `apps/web/src/platform/platform-api-client.ts` |
| Tab PATCH | `club-detail/tab-billing.tsx` |
| Multi-step UX | `create-club/create-club-wizard-client.tsx` |
| Preview engine | `apps/web/src/wizard/workspace-wizard-host.tsx` |
| Repository publish | `workspace-definition.repository.ts` → `createPublishedVersion` |

---

## 10. Verification commands (fast-track only)

```bash
pnpm run guard:import-boundary
pnpm --filter @apps/api exec node --test test/workspace-metadata-*.spec.ts test/workspace-definition-*.spec.ts
git diff --quiet packages/workspaces/denali
```

---

## 11. Common AI mistakes (avoid)

| Mistake | Correct |
|---------|---------|
| Put `steps` in wizard JSON | Use `WorkspaceWizardSurface` fields only |
| Noop hooks in adapter | Merge package overlay always |
| Edit denali for metadata parity | Fix export/adapter |
| Start P3-B before N-012 | Finish P3-A integration first |
| Put composites in platform-core React | P3-B React lives in `apps/web/src/wizard/platform/` |
| Run full CI without YES | fast-track only per .cursorrules |

---


## 13. Cutover & parity (P3-D — doc complete, impl after P3-C-N-014)

**Doc SoT:** `docs/phase-16/platform-workspace-cutover.mdoc` · **Nano spec:** `TEMP/p3/p3-d-migration-parity.md` v1.3

| Fact | Evidence |
|------|----------|
| Strangler Fig — per-tenant binding | `tenants.workspaceDefinitionId` + `WORKSPACE_METADATA_ENABLED` |
| Parity compares data surfaces only | fieldRegistry, ruleSet, wizard — hooks from overlay |
| Export checksum gate | `export:workspace-definition` vs `denali-v1.json` |
| Golden tour fixture | `denali/test/fixtures/golden/tour-publish-ready.json` |
| Rollback = clear binding | PATCH null → `TENANT_DEFINITION_CLEARED` |
| Ingress not tenant-aware yet | `canonical-validation-sync.ts` still package-only |
| Dev seed upsert ≠ prod publish | `seed-workspace-definitions.ts` vs P3-C INSERT |
| Optional allowlist env | `WORKSPACE_METADATA_TENANT_ALLOWLIST` — N-007 |


## 14. P3-A workspace definitions (doc 9.9 — complete)

**Doc SoT:** `docs/phase-16/platform-workspace-definitions.mdoc` v1.3 · **Nano:** `TEMP/p3/p3-a-workspace-definitions.md` v1.3

| Fact | Evidence |
|------|----------|
| Two-plane model | data=DB, hooks=package overlay |
| Immutable versions | INSERT only (prod); dev seed upsert separate |
| Resolution | flag + binding → adapter; else package |
| API landed | GET list + PATCH assign |
| Ingress P0 (N-011) | canonical-validation-sync, build-clone-tour-body, wizard-template-catalog |
| Ingress NO v1 | settings-registry, workspace-drafts, marketing catalog |
| Engine cache | extend key with definitionId:version on flag on |
| Blocks P3-B | N-011/N-012 must complete first |


## 15. P3-B generic widgets (doc 9.9 — complete)

**Doc SoT:** `docs/phase-16/platform-generic-widgets.mdoc` v1.3 · **Nano:** `TEMP/p3/p3-b-generic-widgets.md` v1.3

| Fact | Evidence |
|------|----------|
| Two-axis: field.id vs compositeSurfaceId | mdoc § Two-axis model |
| 3 widgets v1 | platform.photos, .location, .itinerary |
| Allowlist SDK | `PLATFORM_GENERIC_RENDERER_IDS` — N-001 |
| React tree | `apps/web/src/wizard/platform/` NOT `src/platform/` |
| Codegen | static append `"platform"` in generate-workspace-registry.mjs |
| Starter gap | no compositeSurfaceId — N-009b required |
| Denali null vs platform fallback | composite-field.tsx vs PlatformCompositeFallback |
| Media | resolveWizardMediaNeutralBffPath `/api/wizard-media/{key}` |
| Blocks P3-C | allowlist + surface factory before builder publish gate |


## 16. P3-C workspace builder (doc 9.9 — complete)

**Doc SoT:** `docs/phase-16/platform-workspace-builder.mdoc` v1.3 · **Nano:** `TEMP/p3/p3-c-workspace-builder.md` v1.3

| Fact | Evidence |
|------|----------|
| Three layers | publish API · builder UI · club assign tab |
| Immutable versions | INSERT only; `createPublishedVersion` exists |
| Missing routes | POST create + POST publish + GET version payload |
| Audit gap | `WORKSPACE_DEFINITION_PUBLISHED` — add N-001 |
| RBAC | owner publish; admin/owner assign; support read-only |
| API DTO landed | `tenants-get` exposes `workspaceDefinition` |
| Web type gap | `PlatformClubDetail` lacks binding — N-013 |
| Preview | `build-preview-plugin-from-draft.ts` + `PlatformWizardEngine` |
| BFF pattern | `proxyPlatformApi` from mark-paid route template |
| Nav gap | `platform-nav.ts` no Workspaces item — N-012 |
| Industry refs | Form.io revisions, FormEngine RBAC, Atlas audit |
| Blocks P3-D | N-014 exit before optional cutover |
| Assertion IDs | PB-01…07, BU-01…06, RM-01…04, PV-01…03, RT-01…04, TA-01…03, EX-01…03 |


## 17. P3-D cutover & parity (doc 9.9 — complete)

**Doc SoT:** `docs/phase-16/platform-workspace-cutover.mdoc` v1.3 · **Nano:** `TEMP/p3/p3-d-migration-parity.md` v1.3

| Fact | Evidence |
|------|----------|
| Optional EPIC | after P3-C-N-014; live cutover needs P3-A-N-011 |
| Shadow before pilot | CI parity specs (Stage 1) before prod binding |
| Two levers | `WORKSPACE_METADATA_ENABLED` + tenant binding columns |
| Allowlist | `WORKSPACE_METADATA_TENANT_ALLOWLIST` — N-007 |
| Parity scope | fieldRegistry, ruleSet, wizard only — hooks package-owned |
| Export gate | live export checksum === `denali-v1.json` (DP-01) |
| Golden | SMK-P6-06 + DP-05 metadata path |
| Rollback | PATCH null binding — no tour migration |
| Vertical proof | starter-shell + platform.* (MV-01…04) |
| Denali edits | README only N-009 — Architect YES |
| Cutover gates | G1–G8 in mdoc before Stage 2→3 |
| Assertion IDs | DP-01…07, RP-01…04, MV-01…04, CO-01…05, DM-01…02, EX-01…03 |


## 12. P3 file index (aligned 1.2-aligned)

| File | Purpose |
|------|---------|
| AGENT-START.md | AI entry · current_task=P3-A-N-011 |
| AGENT-CONTEXT.md | This file — frozen facts |
| AGENT-MANIFEST.yaml | 52 nano tasks |
| AGENT-LOOP.md | Session checklist |
| FILE-MAP.md | Master index + sync checklist |
| p3-a … p3-d specs | Epic nano detail |
| p3-denali-safety.md | Covenant |
| README.md | Human + AI index |
| ../p3-metadata-platform.md | Summary alias |
| ../p3-exit-checklist.md | Phase exit |
| ../ROADMAP-INDEX.md | All phases |

**current_task:** `P3-A-N-011` · **nano_done:** 10/52
