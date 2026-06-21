# P3-B — Generic Platform Widgets · Nano-Task Spec (AI Lite v2)

```yaml
doc_id: P3-B-GENERIC-WIDGETS
version: 1.3-aligned
file_map: TEMP/p3/FILE-MAP.md
agent_entry: TEMP/p3/AGENT-START.md
nano_tasks: 14
parent_tasks: 7
start: P3-B-N-001
stop: P3-B-N-014
epic: P3-B
status: complete
execute_after: P3-A-N-012
execute_before: P3-C-N-001
doc_first: docs/phase-16/platform-generic-widgets.mdoc
doc_status: complete
quality_target: 9.9+/10
```

> **🤖 AI:** Entry [AGENT-START.md](./AGENT-START.md) · Facts [AGENT-CONTEXT.md](./AGENT-CONTEXT.md) · Tasks [AGENT-MANIFEST.yaml](./AGENT-MANIFEST.yaml) · **Doc SoT:** [platform-generic-widgets.mdoc](../../docs/phase-16/platform-generic-widgets.mdoc)

---

## Doc-first covenant

**Markdoc SoT:** `docs/phase-16/platform-generic-widgets.mdoc` — architecture, two-axis model, widget contracts, codegen, tests.

This file is the **execution checklist** (nano order, file paths, assertions). On conflict, mdoc wins for architecture; this file wins for nano deps/order.

---

## برای AI — 12 قانون

1. **فقط `P3-B-N-xxx` به ترتیب**
2. **Doc-first done** — mdoc exists; extend mdoc if architecture changes
3. **Two-axis model:** `field.id` (renderer) ≠ `wizardHost.compositeSurfaceId` (surface factory)
4. **Namespace `platform.*`** for new generics — Denali keeps `denali.*` unchanged
5. **Register React in `apps/web/src/wizard/platform/`**, headless in `platform-core` / `workspace-sdk/metadata` only
6. **Codegen:** append `"platform"` to `wizard-surface-bindings.generated.ts` via `generate-workspace-registry.mjs`
7. **Unknown compositeId → `PlatformCompositeFallback`** — never crash wizard
8. **Publish allowlist:** `PLATFORM_GENERIC_RENDERER_IDS` in SDK — P3-C reuses
9. **No `denali/ui` import** in platform widgets tree
10. **`git diff --quiet packages/workspaces/denali`** every nano
11. **Media:** `resolveWizardMediaBffPath(mediaRouteKey)` — no new storage adapter
12. **Primitives stay kind-based** in `WizardField` — do not register text/enum in composite map
13. **Starter `compositeSurfaceId: "platform"`** required before EPIC exit — or composites never mount

---

## §Facts frozen (code-verified 2026-06-21)

| # | Fact | Evidence |
|---|------|----------|
| F1 | Denali: 22 composites, ids `denali.*` | `composite-ids.ts` |
| F2 | Primitives via `field.kind` in `wizard-field.tsx` | no registry lookup |
| F3 | P3-B scope: photos + location + itinerary + review + theme | not 22-widget parity |
| F4 | Render plan sets `uiHints.compositeId = entry.id` | `render-plan.ts:109` |
| F5 | Generated bindings only `"denali"` today | `wizard-surface-bindings.generated.ts` |
| F6 | Generic draft type: `TourWizardDraft` | `wizard-surface-types.ts` |
| F7 | Test uses `workspace.photos` id | `render-plan.spec.ts:145` — ship as `platform.photos` |
| F8 | Starter hooks lack `compositeSurfaceId` | `create-platform-wizard-host-hooks.ts` — N-009 must fix |
| F9 | Denali unknown composite → null | `composite-field.tsx:27-29` — platform uses fallback |
| F10 | Media neutral BFF | `resolveWizardMediaNeutralBffPath` → `/api/wizard-media/{key}` |

---

## §File manifest

### Create

```text
docs/phase-16/platform-generic-widgets.mdoc                    ✅
packages/workspace-sdk/src/metadata/allowed-platform-renderer-ids.ts
apps/web/src/wizard/platform/platform-renderer-ids.ts
apps/web/src/wizard/platform/platform-composite-fallback.tsx
apps/web/src/wizard/platform/platform-composite-surface.tsx
apps/web/src/wizard/platform/platform-composite-renderers.tsx
apps/web/src/wizard/platform/platform-review-surface.tsx
apps/web/src/wizard/platform/platform-theme-tokens.ts
apps/web/src/wizard/platform/composites/platform-photos-field.tsx
apps/web/src/wizard/platform/composites/platform-location-field.tsx
apps/web/src/wizard/platform/platform-photo-upload-client.ts
apps/web/src/wizard/platform/composites/platform-itinerary-field.tsx
packages/platform-core/src/theme/resolve-workspace-theme-tokens.ts
apps/web/test/platform-composite-registry.spec.ts
apps/web/test/platform-composite-fallback.spec.ts
apps/web/test/platform-photos-field.spec.ts
apps/web/test/platform-location-field.spec.ts
apps/web/test/platform-itinerary-field.spec.ts
apps/web/test/platform-review-surface.spec.ts
apps/web/test/platform-epic-b-boundary.spec.ts
apps/api/test/workspace-metadata-renderer-allowlist.spec.ts
```

### Edit

```text
scripts/generate-workspace-registry.mjs
apps/web/src/bootstrap/wizard-surface-bindings.generated.ts   # regen only
packages/workspace-sdk/src/metadata/index.ts                  # export allowlist
packages/workspace-sdk/src/metadata/workspace-definition-payload.ts  # optional theme block
apps/api/src/workspace-metadata/metadata-plugin-adapter.ts  # theme merge (N-013)
packages/workspaces/starter/src/starter.plugin.ts             # compositeSurfaceId: "platform" (N-009)
packages/platform-core/src/host/create-platform-wizard-host-hooks.ts  # optional compositeSurfaceId option
```

### Forbidden

```text
packages/workspaces/denali/**
apps/web/src/platform/**
```

---

## Parent task map

| Parent | عنوان | Nano |
|--------|--------|------|
| P3-B-T-000 | Doc + allowlist | N-001 · N-002 |
| P3-B-T-001 | platform.photos | N-003 · N-004 |
| P3-B-T-002 | platform.location | N-005 · N-006 |
| P3-B-T-003 | platform.itinerary | N-007 · N-008 |
| P3-B-T-004 | Surface factory + codegen | N-009 · N-010 |
| P3-B-T-005 | Generic review surface | N-011 · N-012 |
| P3-B-T-006 | Theme tokens | N-013 · N-014 |

---

## NANO TASKS — DETAIL

### P3-B-N-001 [IMPLEMENT] `P3-B-T-000` — allowlist module

- **Deps:** P3-A-N-012 ✅
- **Doc:** mdoc § Renderer allowlist (already written — verify sync)

**DO THIS:**

1. Create `packages/workspace-sdk/src/metadata/allowed-platform-renderer-ids.ts`:
   - `PLATFORM_GENERIC_RENDERER_IDS` = `platform.photos`, `platform.location`, `platform.itinerary`
   - `isAllowedPlatformRendererId(id: string): boolean`
   - `assertAllowedPlatformRendererId(id: string): void` throws `WorkspaceMetadataValidationError` or reuse existing metadata error type
2. Export from `packages/workspace-sdk/src/metadata/index.ts` (or metadata subpath barrel)
3. Create `apps/web/src/wizard/platform/platform-renderer-ids.ts` re-export for web tests (thin forwarder)

**DO NOT:** Create React components · edit denali · touch `apps/web/src/platform`

**VERIFY:**
```bash
pnpm --filter @app-tour/workspace-sdk run lint
pnpm run guard:import-boundary
git diff --quiet packages/workspaces/denali
```

**NEXT:** P3-B-N-002

---

### P3-B-N-002 [TEST] `P3-B-T-000` — allowlist spec

- **Deps:** P3-B-N-001

**DO THIS:**

1. Create `apps/api/test/workspace-metadata-renderer-allowlist.spec.ts` (or `packages/workspace-sdk/test/allowed-platform-renderer-ids.spec.ts`)

**Required assertions:**

| ID | Assert |
|----|--------|
| AL-01 | `isAllowedPlatformRendererId("platform.photos")` === true |
| AL-02 | `isAllowedPlatformRendererId("denali.photos")` === false |
| AL-03 | `assertAllowedPlatformRendererId("platform.unknown")` throws |
| AL-04 | `PLATFORM_GENERIC_RENDERER_IDS` length === 3 |

**DO NOT:** `assert.ok(true)` · skip tests

**VERIFY:** run spec + guard + denali diff

**NEXT:** P3-B-N-003

---

### P3-B-N-003 [IMPLEMENT] `P3-B-T-001` — platform.photos field

- **Deps:** P3-B-N-002

**DO THIS:**

1. Create `apps/web/src/wizard/platform/composites/platform-photos-field.tsx`
2. Props: `WizardCompositeFieldRenderProps` — use `TourWizardDraft`, not Denali types
3. Read/write canonical `photos` array (see mdoc § platform.photos)
4. Upload via existing BFF: `upload*` helper pattern from Denali **reimplemented** using `resolveWizardMediaBffPath` — copy logic from `photo-upload-client` pattern without importing denali
5. Gate upload on `wizardSessionId` presence
6. Markers: `data-platform-photos-field`, `data-photos-upload-disabled` when no session

**DO NOT:** import `@app-tour/workspace-denali/ui/*` · add Minio client in web

**VERIFY:** lint + guard + denali diff

**NEXT:** P3-B-N-004

---

### P3-B-N-004 [TEST] `P3-B-T-001` — photos spec

- **Deps:** P3-B-N-003

**DO THIS:** `apps/web/test/platform-photos-field.spec.ts
apps/web/test/platform-location-field.spec.ts
apps/web/test/platform-itinerary-field.spec.ts
apps/web/test/platform-review-surface.spec.ts
apps/web/test/platform-epic-b-boundary.spec.ts`

| ID | Assert |
|----|--------|
| PH-01 | `resolvePlatformCompositeRenderer("platform.photos")` is function (export test helper from renderers) |
| PH-02 | Renderer source matches `/data-platform-photos-field/` or registry key exists |
| PH-03 | Without session: component sets upload disabled marker (static analysis or shallow render) |

**VERIFY:** `pnpm --filter @apps/web exec node --import tsx --test test/platform-photos-field.spec.ts`

**NEXT:** P3-B-N-005

---

### P3-B-N-005 [IMPLEMENT] `P3-B-T-002` — platform.location field

- **Deps:** P3-B-N-004

**DO THIS:**

1. `platform-location-field.tsx` — zones + address minimal editor
2. Canonical JSON per mdoc
3. `data-platform-location-field` marker
4. Map: optional dynamic import — skip map in v1 if blocked; text-only zones acceptable with TODO in mdoc only if Architect approves deferral

**DO NOT:** denali imports

**NEXT:** P3-B-N-006

---

### P3-B-N-006 [TEST] `P3-B-T-002` — location spec

| ID | Assert |
|----|--------|
| LO-01 | Registry resolves `platform.location` |
| LO-02 | Field module exports component with `data-platform-location-field` |

**NEXT:** P3-B-N-007

---

### P3-B-N-007 [IMPLEMENT] `P3-B-T-003` — platform.itinerary field

- **Deps:** P3-B-N-006

**DO THIS:**

1. `platform-itinerary-field.tsx` — day list + segment rows
2. `setCanonicalValue` / get helpers on generic draft
3. `data-platform-itinerary-field`

**NEXT:** P3-B-N-008

---

### P3-B-N-008 [TEST] `P3-B-T-003` — itinerary spec

| ID | Assert |
|----|--------|
| IT-01 | Registry resolves `platform.itinerary` |
| IT-02 | Adding day mutates draft canonical path (unit test with mock draft object) |

**NEXT:** P3-B-N-009

---

### P3-B-N-009 [IMPLEMENT] `P3-B-T-004` — surface factory + codegen + fallback

- **Deps:** P3-B-N-008

**DO THIS:**

1. `platform-composite-fallback.tsx` — `data-composite-fallback`, shows compositeId text
2. `platform-composite-renderers.tsx` — map + `resolvePlatformCompositeRenderer` + fallback for unknown
3. `platform-composite-surface.tsx` — `createPlatformCompositeSurface()` mirrors Denali factory
4. Patch `scripts/generate-workspace-registry.mjs`:
   - Append import `createPlatformCompositeSurface` from `@/wizard/platform/platform-composite-surface`
   - Add `"platform": composite_platform()` to `COMPOSITE_SURFACES`
5. Run `pnpm run generate:workspace-registry`
6. Verify `wizard-surface-bindings.generated.ts` contains `"platform"`
7. **Starter overlay (N-009b):** set `compositeSurfaceId: "platform"` and `reviewSurfaceId: "platform"` on starter `wizardHost` (see mdoc § Starter overlay requirement)
8. Create `apps/web/test/platform-epic-b-boundary.spec.ts` — BD-01 no denali imports under wizard/platform

**DO NOT:** Hand-edit generated file without generator change

**NEXT:** P3-B-N-010

---

### P3-B-N-010 [TEST] `P3-B-T-004` — registry + fallback spec

- **Deps:** P3-B-N-009

**DO THIS:** `apps/web/test/platform-composite-registry.spec.ts`

| ID | Assert |
|----|--------|
| RG-01 | `resolveWizardCompositeSurface("platform")` not null |
| RG-02 | `resolveWizardCompositeSurface("denali")` still not null (no regression) |
| RG-03 | Unknown id `platform.nope` → fallback marker in render output |
| RG-04 | Generated bindings file contains `"platform"` key |
| RG-05 | `starter.plugin.ts` source contains `compositeSurfaceId: "platform"` |

**Also:** `apps/web/test/platform-composite-fallback.spec.ts`

| ID | Assert |
|----|--------|
| FB-01 | Unknown id renders `data-composite-fallback` |
| FB-02 | resolve helper does not throw for unknown id |

**NEXT:** P3-B-N-011

---

### P3-B-N-011 [IMPLEMENT] `P3-B-T-005` — platform review surface

- **Deps:** P3-B-N-010

**DO THIS:**

1. `platform-review-surface.tsx` — `createPlatformReviewSurface()`
2. Implement `renderValidationSummary` — list issues with step id
3. Wire into codegen `REVIEW_SURFACES["platform"]` if review EPIC included in generator patch
4. Headless labels from render plan field paths (no Denali i18n namespace)

**NEXT:** P3-B-N-012

---

### P3-B-N-012 [TEST] `P3-B-T-005` — review spec

| ID | Assert |
|----|--------|
| RV-01 | `resolveGeneratedReviewSurface("platform")` non-null after codegen |
| RV-02 | Review surface exports `renderValidationSummary` function |

Add to `platform-composite-registry.spec.ts` or separate `platform-review-surface.spec.ts`.

**NEXT:** P3-B-N-013

---

### P3-B-N-013 [IMPLEMENT] `P3-B-T-006` — theme tokens

- **Deps:** P3-B-N-012

**DO THIS:**

1. `packages/platform-core/src/theme/resolve-workspace-theme-tokens.ts` — validate semantic keys only
2. `platform-theme-tokens.ts` — apply CSS vars to wizard host wrapper
3. Extend `WorkspaceDefinitionPayload` optional `theme?: { tokens?: Record<string,string> }`
4. Merge in `metadata-plugin-adapter.ts` when payload includes theme

**DO NOT:** Raw hex without semantic key in validator

**DO NOT:** Raw hex without semantic key

| ID (in N-014 bundle) | Assert |
|----|--------|
| TH-01 | `--ws-primary` accepted |
| TH-02 | `#ff0000` at top level rejected |

**NEXT:** P3-B-N-014

---

### P3-B-N-014 [TEST] `P3-B-T-006` — EPIC gate

- **Deps:** P3-B-N-013

**DO THIS:** Run full P3-B verify bundle:

```bash
pnpm run generate:workspace-registry
pnpm run guard:import-boundary
git diff --quiet packages/workspaces/denali
pnpm --filter @apps/web exec node --import tsx --test \
  test/platform-composite-registry.spec.ts \
  test/platform-composite-fallback.spec.ts \
  test/platform-photos-field.spec.ts
pnpm --filter @apps/api exec node --test \
  test/workspace-metadata-renderer-allowlist.spec.ts
```

| ID | Assert |
|----|--------|
| EX-01 | All P3-B specs exit 0 |
| EX-02 | `git diff --quiet packages/workspaces/denali` |
| EX-03 | Generated bindings contains denali + platform keys |

**EPIC exit checklist:**

- [ ] All 14 nanos done
- [ ] mdoc synced with any implementation drift
- [ ] `FILE-MAP` doc-first row P3-B → ✅
- [ ] `AGENT-START` current_task → P3-C-N-001
- [ ] Denali diff empty

**NEXT:** P3-C-N-001

---

## §STOP table

| Symptom | Action |
|---------|--------|
| Import denali/ui in platform tree | **STOP** |
| Unknown composite crashes wizard | **STOP** — use fallback |
| Edit denali package | **STOP** |
| Start P3-B before P3-A-N-012 | **STOP** |
| Register text/enum in composite map | **STOP** |

---

## §AI navigation

| Need | File |
|------|------|
| Architecture SoT | `docs/phase-16/platform-generic-widgets.mdoc` |
| Entry | `AGENT-START.md` |
| Facts | `AGENT-CONTEXT.md` |
| Tasks | `AGENT-MANIFEST.yaml` |
