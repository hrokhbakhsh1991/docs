# Phase 13 — Wizard Plugin-Neutral Closure (AI Agent Playbook v3)

> **Audience:** Cursor / Codex agents executing Phase 13  
> **Human language:** Persian summaries · **Agent language:** English identifiers, exact paths, YAML blocks  
> **Version:** v3 · 2026-06-18  
> **Prerequisite:** Phase 12 DONE · `fieldUsesCompositeRenderer` in platform-core DONE

---

## 0. AGENT CONTRACT — READ BEFORE ANY EDIT

```yaml
agent_contract:
  mission: Make wizard media + create-flow plugin-neutral WITHOUT changing Denali operator UX
  doc_first: true  # docs/phase-13/subphases/*.md BEFORE packages/platform-core|workspace-sdk|apps/api
  max_scope_per_task: One TASK id per PR/commit slice unless user says otherwise
  never_run_without_user_yes:
    - pnpm run phase-5:gate
    - pnpm run test:full
    - pnpm run ci:integrity
  default_verify_after_every_task:
    - pnpm run pre-commit:fast
    - pnpm run test:changed
```

### 0.1 NEVER DO (will break Denali delivery)


| Rule                                                                                   | Reason                                       |
| -------------------------------------------------------------------------------------- | -------------------------------------------- |
| Do **not** edit `apps/web/src/wizard/workspace-wizard-host.tsx` except explicit TASK   | Phase 12.9 frozen host                       |
| Do **not** add `pluginId === "denali"` to generic files                                | Use hooks / manifest dispatch                |
| Do **not** move `apps/web/src/wizard/denali/`* into core                               | Phase 12 non-goal                            |
| Do **not** change `mapWizardPhotoError` codes or HTTP status mapping                   | `docs/phase-6/subphases/6.7-minio-photos.md` |
| Do **not** change draft merge semantics in `denali-wizard-draft-merge.ts` during split | Mechanical move only in 13.4                 |
| Do **not** remove BFF `/api/tours/wizard-photos` until 13.2-T04 alias works            | Backward compat                              |
| Do **not** proxy file bytes through API differently                                    | Presigned / binary body flow stays           |
| Do **not** skip tests listed under a TASK                                              | Each TASK is incomplete without them         |


### 0.2 FROZEN FILES (touch only when TASK allowlists them)

```
packages/platform-core/src/engine/render-plan.ts          # DONE — fieldUsesCompositeRenderer
apps/web/src/wizard/workspace-wizard-host.tsx             # Phase 12 generic host
apps/web/src/wizard/wizard-field.tsx                      # compositeId from uiHints only
packages/workspaces/denali/src/wizard/denali-wizard-host-hooks.ts  # extend only per TASK
```

### 0.3 PRESERVED END-TO-END FLOWS (must stay working after every subphase)

#### Flow A — Denali create wizard + draft sync

```text
/tours/new
  → apps/web/app/tours/new/new-tour-wizard-client.tsx (split in 13.4, behavior identical)
  → useWorkspaceDraft(namespace=operator.wizard, key=denali-create)   # DENALI_* constants in package
  → WorkspaceWizardHost(pluginId, wizardHost hooks from plugin)
  → platform-core buildRenderPlan → uiHints.compositeId
  → wizard-composite-surface-registry["denali"] → DenaliCompositeField
```

**Regression tests:** `apps/web/test/denali-wizard-draft-contract.spec.ts`

#### Flow B — Photo upload + thumbnail

```text
denali-photos-field.tsx
  → uploadDenaliWizardPhoto() in denali-photo-upload-client.ts
  → POST /api/tours/wizard-photos (BFF — keep until 13.2 alias proven)
  → apps/api tour-wizard-photos.routes.ts → putDenaliWizardDraftPhoto (dispatch in 13.1)
  → MinIO key: {tenantId}/wizard-drafts/{sessionId}/photos/{photoId}
  → draft canonical photos[] gets storageKey
  → preview via signed URL GET
```

**Regression tests:** `apps/web/test/denali-photo-upload.spec.ts`

#### Flow C — API tour create validation

```text
POST /tours
  → canonical-validation-sync.ts → PlatformWizardEngine
  → resolveValidationDimensions (fix in 13.3 to use wizardHost hook)
```

**Regression tests:** `apps/api/src/tours/canonical-validation.spec.ts`

#### Flow D — Clone tour wizard

```text
/tours/new?clone={id}
  → tour-clone-hydrate-logic.ts → executeTourClonePhotoRemintPlan
  → clone-photo-remint.routes.ts (dispatch in 13.1)
```

---

## 1. EXECUTION ORDER (strict — do not parallelize conflicting tasks)

```text
WAVE 1 (SDK only, no API behavior change):
  P13-0-T01 → T02 → T03 → T04 → T05 → T06 → T07 → T08
  P13-0b-T01 → T02 → T03 → T04 → T05 → T06

WAVE 2 (API + validation, parallel OK after WAVE 1):
  P13-3-T01 → T02 → T03 → T04 → T05 → T06
  P13-1-T01 → T02 → … → T11

WAVE 3 (BFF — after P13-1-T07):
  P13-2-T01 → … → T06

WAVE 4 (Web split — after P13-0b + P13-0 media hooks):
  P13-4-T01 → … → T08
  P13-5-T01 → … → T06

WAVE 5 (guards + proof):
  P13-6-T01 → … → T05
  P13-7-T01 → … → T05
```

---

## 2. GLOBAL VERIFICATION COMMANDS

Run after **every** completed TASK unless TASK says otherwise:

```bash
cd /home/hamed/Music/docs
pnpm run pre-commit:fast
pnpm run test:changed
```

Run after **every subphase** (13.0, 13.0b, …):

```bash
pnpm --filter @app-tour/workspace-sdk run build
pnpm --filter @app-tour/workspace-denali run build
pnpm --filter @app-tour/platform-core run build
pnpm run generate:workspace-registry --check   # only after manifest/generator tasks
```

Denali wizard regression pack (run after 13.4+):

```bash
cd apps/web && node --import tsx --test \
  test/denali-wizard-draft-contract.spec.ts \
  test/denali-photo-upload.spec.ts \
  test/wizard-host-boundary.spec.ts
```

---

## 3. SUBPHASE 13.0 — SDK Media Contract

**Doc to create first:** `docs/phase-13/subphases/13.0-wizard-media-contract.md`

---

### TASK P13-0-T01 — Write doc

```yaml
id: P13-0-T01
blocked_by: []
files_allowlist:
  - docs/phase-13/subphases/13.0-wizard-media-contract.md
  - docs/phase-13/README.md  # stub index only
action: CREATE
```

**Doc must include:**

- `WorkspaceWizardMediaHooks` field table
- `mediaRouteKey: "wizard-photos"` is opaque BFF segment (not API path)
- Error codes unchanged: `PHOTO_STORAGE_FULL`, `PHOTO_STORAGE_UNAVAILABLE`, `WIZARD_PHOTO_`*
- Session id: UUID v4 — same as `createDenaliWizardDraftSessionId`

**Verify:** file exists; links from `docs/phase-13/README.md`

---

### TASK P13-0-T02 — Create media hooks type

```yaml
id: P13-0-T02
blocked_by: [P13-0-T01]
files_allowlist:
  - packages/workspace-sdk/src/plugin/workspace-wizard-media-hooks.ts
action: CREATE
```

**Create file with exactly:**

```typescript
/** Phase 13.0 — provisional wizard asset upload (DEC-P13-001). */
export type WorkspaceWizardMediaHooks = {
  /** Mint wizard-scoped upload session id (UUID). */
  readonly createAssetSessionId: () => string;
  /** Validate client/session id before upload. */
  readonly isAssetSessionId: (value: string) => boolean;
  /**
   * Opaque BFF route key for upload client resolution.
   * Denali: "wizard-photos" → /api/tours/wizard-photos (until 13.2).
   */
  readonly mediaRouteKey: string;
};
```

**Do not** add storage/MinIO types to SDK.

---

### TASK P13-0-T03 — Wire into WorkspaceWizardHostHooks

```yaml
id: P13-0-T03
blocked_by: [P13-0-T02]
files_allowlist:
  - packages/workspace-sdk/src/plugin/workspace-wizard-host-hooks.ts
  - packages/workspace-sdk/src/plugin/workspace-plugin.contract.ts  # re-export if needed
  - packages/workspace-sdk/src/public-api.ts
  - packages/workspace-sdk/src/plugin/index.ts  # if barrel exists
action: EDIT
```

**Edit `workspace-wizard-host-hooks.ts`:**

1. `import type { WorkspaceWizardMediaHooks } from "./workspace-wizard-media-hooks";`
2. Add to interface: `readonly media?: WorkspaceWizardMediaHooks;`

**Export** `WorkspaceWizardMediaHooks` from `public-api.ts` next to `WorkspaceWizardHostHooks`.

**Verify:**

```bash
pnpm --filter @app-tour/workspace-sdk run build
```

---

### TASK P13-0-T04 — Denali implement media hooks

```yaml
id: P13-0-T04
blocked_by: [P13-0-T03]
files_allowlist:
  - packages/workspaces/denali/src/wizard/denali-wizard-host-hooks.ts
action: EDIT
```

**Add import:**

```typescript
import {
  createDenaliWizardDraftSessionId,
  isDenaliWizardDraftSessionId,
} from "../photos/wizard-draft-session-id";
```

**Add to `denaliWizardHostHooks` object:**

```typescript
media: Object.freeze({
  createAssetSessionId: createDenaliWizardDraftSessionId,
  isAssetSessionId: isDenaliWizardDraftSessionId,
  mediaRouteKey: "wizard-photos",
}),
```

**Do not** rename `createDenaliWizardDraftSessionId` in package.

---

### TASK P13-0-T05 — Create Denali host hooks test file

```yaml
id: P13-0-T05
blocked_by: [P13-0-T04]
files_allowlist:
  - packages/workspaces/denali/test/denali-wizard-host-hooks.spec.ts
action: CREATE
```

**Create test file:**

```typescript
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getDenaliWorkspacePlugin } from "../src/denali.plugin";

describe("denali-wizard-host-hooks.spec.ts (P13-0-T05)", () => {
  it("P13-0-01 exposes wizardHost.media with session helpers", () => {
    const plugin = getDenaliWorkspacePlugin();
    const media = plugin.wizardHost?.media;
    assert.ok(media);
    assert.equal(media.mediaRouteKey, "wizard-photos");
    const id = media.createAssetSessionId();
    assert.equal(media.isAssetSessionId(id), true);
    assert.equal(media.isAssetSessionId("not-uuid"), false);
  });

  it("P13-0-02 resolveMatrixDimensionsFromDraft still works (no regression)", () => {
    const plugin = getDenaliWorkspacePlugin();
    const dims = plugin.wizardHost?.resolveMatrixDimensionsFromDraft?.(
      { data: { category: "mountain_day" } },
      null
    );
    assert.ok(dims);
    assert.equal(dims.category, "mountain");
    assert.equal(dims.duration, "single_day");
  });
});
```

**Verify:**

```bash
cd packages/workspaces/denali && node --import tsx --test test/denali-wizard-host-hooks.spec.ts
pnpm --filter @app-tour/workspace-denali run build
```

---

### TASK P13-0-T06 — SDK product-neutral guard

```yaml
id: P13-0-T06
blocked_by: [P13-0-T03]
files_allowlist: []  # read-only verify
action: VERIFY
```

```bash
pnpm --filter @app-tour/workspace-sdk run test
# product-neutral-core.contract.spec.ts must pass — no new denali/urban in sdk src
```

**Subphase 13.0 DONE when:** T01–T06 all green.

---

## 4. SUBPHASE 13.0b — Draft Envelope Hooks (types only)

**Doc:** `docs/phase-13/subphases/13.0b-draft-envelope-hooks.md`

---

### TASK P13-0b-T02 — Add envelope hook signatures to SDK

```yaml
id: P13-0b-T02
blocked_by: [P13-0b-T01]
files_allowlist:
  - packages/workspace-sdk/src/plugin/workspace-wizard-host-hooks.ts
action: EDIT
```

**Add to `WorkspaceWizardHostHooks` (all optional):**

```typescript
readonly prepareDraftEnvelope?: <TForm>(
  form: TForm,
  meta: Readonly<Record<string, unknown>>
) => Readonly<{ form: TForm; meta: Readonly<Record<string, unknown>> }>;

readonly hydrateDraftEnvelope?: <TForm>(input: {
  readonly remote: Readonly<{ form: TForm; meta: Readonly<Record<string, unknown>> }> | null | undefined;
  readonly fallbackForm: TForm;
  readonly fallbackMeta?: Readonly<Record<string, unknown>>;
}) => Readonly<{ form: TForm; meta: Readonly<Record<string, unknown>> }>;
```

**Defer to 13.5:** `mergeDraftEnvelope`, `normalizeRemoteEnvelope` (web still uses shims).

---

### TASK P13-0b-T04 — Denali delegate envelope hooks

```yaml
id: P13-0b-T04
blocked_by: [P13-0b-T02]
files_allowlist:
  - packages/workspaces/denali/src/wizard/denali-wizard-host-hooks.ts
action: EDIT
```

**Import from package draft:**

```typescript
import {
  denaliPrepareDraftEnvelope,
  denaliHydrateDraftEnvelope,
  type DenaliWizardDraftMeta,
} from "../draft/denali-wizard-draft-binding";
```

**Add hooks:**

```typescript
prepareDraftEnvelope: (form, meta) =>
  denaliPrepareDraftEnvelope(form, meta as DenaliWizardDraftMeta),
hydrateDraftEnvelope: ({ remote, fallbackForm, fallbackMeta }) =>
  denaliHydrateDraftEnvelope(remote, fallbackForm, fallbackMeta as Partial<DenaliWizardDraftMeta>),
```

**Extend P13-0-T05 test:**

```typescript
it("P13-0b-01 prepareDraftEnvelope strips deletedRoots from meta", () => {
  const plugin = getDenaliWorkspacePlugin();
  const env = plugin.wizardHost?.prepareDraftEnvelope?.({}, {
    currentStepIndex: 0,
    deletedRoots: ["photos"],
  });
  assert.ok(env);
  assert.equal("deletedRoots" in (env.meta as object), false);
});
```

---

## 5. SUBPHASE 13.1 — API Media Manifest Dispatch

**Mirror pattern:** `tourWrite` in `workspace.manifest.json` → `generateTourWriteBindings()` → `workspace-tour-write-dispatch.ts`

---

### TASK P13-1-T02 — Extend Denali manifest

```yaml
id: P13-1-T02
blocked_by: [P13-1-T01]
files_allowlist:
  - packages/workspaces/denali/workspace.manifest.json
action: EDIT
```

**Add block (exact shape for generator):**

```json
"wizardMedia": {
  "module": "./photos",
  "workspaceTypeExport": "DENALI_WORKSPACE_TYPE",
  "putWizardDraftPhotoExport": "putDenaliWizardDraftPhoto",
  "getSignedReadUrlExport": "getDenaliTourPhotoSignedReadUrl",
  "readConfigExport": "readMinioPhotoConfigFromEnv",
  "maxBytesExport": "DENALI_MAX_PHOTO_UPLOAD_BYTES",
  "ensureBucketExport": "ensureMinioPhotoBucket"
}
```

**Note:** `DENALI_WORKSPACE_TYPE` already exported from denali package (used by tourWrite).

---

### TASK P13-1-T04 — Generator function

```yaml
id: P13-1-T04
blocked_by: [P13-1-T02]
files_allowlist:
  - scripts/generate-workspace-registry.mjs
action: EDIT
```

**Implement `generateWizardMediaBindings(manifests)` modeled on `generateTourWriteBindings`:**

- Output: `apps/api/src/tours/workspace-wizard-media-bindings.generated.ts`
- Export: `WORKSPACE_WIZARD_MEDIA_BINDINGS` array with `{ workspaceType, putWizardDraftPhoto, getSignedReadUrl, readConfig, maxBytes, ensureBucket }`
- Add to `OUTPUT_PATHS.wizardMedia` and `generateAllOutputs()`
- Add to `--check` loop

**Run:**

```bash
pnpm run generate:workspace-registry
pnpm run generate:workspace-registry --check
```

---

### TASK P13-1-T06 — Dispatch module

```yaml
id: P13-1-T06
blocked_by: [P13-1-T05]
files_allowlist:
  - apps/api/src/tours/workspace-wizard-media-dispatch.ts
action: CREATE
```

**Implement (mirror `workspace-tour-write-dispatch.ts`):**

```typescript
import { WORKSPACE_WIZARD_MEDIA_BINDINGS } from "./workspace-wizard-media-bindings.generated";

export type WizardMediaBinding = (typeof WORKSPACE_WIZARD_MEDIA_BINDINGS)[number];

export function resolveWizardMediaBinding(workspaceType: string): WizardMediaBinding | undefined {
  return WORKSPACE_WIZARD_MEDIA_BINDINGS.find((b) => b.workspaceType === workspaceType);
}
```

---

### TASK P13-1-T07 — Refactor upload handler

```yaml
id: P13-1-T07
blocked_by: [P13-1-T06]
files_allowlist:
  - apps/api/src/tours/tour-wizard-photos.routes.ts
action: EDIT
```

**Replace Denali gate with dispatch:**

```typescript
// REMOVE:
import { ... } from "@app-tour/workspace-denali";
if (workspaceType !== "denali") { ...403... }

// ADD:
import { resolveWizardMediaBinding } from "./workspace-wizard-media-dispatch";

const binding = resolveWizardMediaBinding(workspaceType);
if (binding === undefined) {
  sendHttpError(res, 403, { error: "forbidden", code: "WIZARD_PHOTO_UPLOAD_FORBIDDEN" });
  return;
}
const minioConfig = binding.readMinioPhotoConfigFromEnv();
// use binding.putDenaliWizardDraftPhoto → rename call to binding.putWizardDraftPhoto (generated export name)
```

**Keep unchanged:**

- `parseWizardPhotoUploadHeaders`
- `mapWizardPhotoError`
- `runWithHttpRequestContext`
- Response shape `{ storageKey, photoId, contentType }` status 201

**Machine gate:**

```bash
rg 'workspaceType !== "denali"' apps/api/src/tours/tour-wizard-photos.routes.ts
# must return 0 matches
rg '@app-tour/workspace-denali' apps/api/src/tours/tour-wizard-photos.routes.ts
# must return 0 matches
```

---

### TASK P13-1-T10 — API tests (NEW file)

```yaml
id: P13-1-T10
blocked_by: [P13-1-T07, P13-1-T08]
files_allowlist:
  - apps/api/test/tour-wizard-photos.spec.ts
action: CREATE
```

**Minimum tests:**


| Test id     | Assert                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| API-13.1-01 | `resolveWizardMediaBinding("denali")` defined                                                                       |
| API-13.1-02 | `resolveWizardMediaBinding("starter")` undefined                                                                    |
| API-13.1-03 | `mapWizardPhotoError` maps `PHOTO_STORAGE_FULL` → 507 (unit test exported helper or invoke via supertest if exists) |


**Follow pattern:** `apps/api/src/tours/canonical-validation.spec.ts` for engine tests.

**Verify:**

```bash
cd apps/api && node --import tsx --test test/tour-wizard-photos.spec.ts
pnpm run test:changed
```

---

## 6. SUBPHASE 13.2 — BFF (preserve old path)

### TASK P13-2-T04 — Alias old BFF routes

```yaml
id: P13-2-T04
blocked_by: [P13-2-T02, P13-2-T03]
files_allowlist:
  - apps/web/app/api/tours/wizard-photos/route.ts
  - apps/web/app/api/tours/wizard-photos/url/route.ts
action: EDIT
```

**Strategy:** Keep `POST /api/tours/wizard-photos` working. New workspace route is **additive**.

**After edit, run:**

```bash
cd apps/web && node --import tsx --test test/denali-photo-upload.spec.ts
```

**Do not change** headers contract: `X-Wizard-Session-Id`, `X-Photo-Id`, `Content-Type`.

---

### TASK P13-2-T05 — Upload client path helper (optional until 13.2 complete)

```yaml
id: P13-2-T05
blocked_by: [P13-0-T04]
files_allowlist:
  - apps/web/src/wizard/denali/denali-photo-upload-client.ts
  - apps/web/src/wizard/resolve-wizard-media-bff-path.ts  # NEW small helper
action: EDIT
```

**Only change fetch URL via helper:**

```typescript
// resolve-wizard-media-bff-path.ts
const MEDIA_ROUTE_KEY_TO_BFF: Record<string, string> = {
  "wizard-photos": "/api/tours/wizard-photos",
};

export function resolveWizardMediaBffPath(mediaRouteKey: string): string {
  return MEDIA_ROUTE_KEY_TO_BFF[mediaRouteKey] ?? `/api/tours/wizard-photos`;
}
```

**In upload client:** accept optional `mediaRouteKey` param default `"wizard-photos"` — behavior unchanged.

---

## 7. SUBPHASE 13.3 — API Validation (1 day, parallel wave 2)

### TASK P13-3-T03 — Fix resolveValidationDimensions

```yaml
id: P13-3-T03
blocked_by: [P13-3-T01]
files_allowlist:
  - apps/api/src/tours/canonical-validation-sync.ts
action: EDIT
```

**Replace lines 45-51:**

```typescript
// BEFORE:
if (plugin.id === "denali") {
  return resolveDenaliWizardDimensionsFromTourKind(...);
}

// AFTER:
const resolveFromDraft = plugin.wizardHost?.resolveMatrixDimensionsFromDraft;
if (resolveFromDraft != null && matrix.includes("category") && matrix.includes("duration")) {
  return { ...resolveFromDraft(data ?? {}, null) };
}
```

**Remove import:** `resolveDenaliWizardDimensionsFromTourKind` from `@app-tour/workspace-denali`

**Keep:** `readDenaliTourKindFromCanonicalData` only if still used — else remove.

**Verify:**

```bash
rg 'plugin\.id === "denali"' apps/api/src/tours/canonical-validation-sync.ts  # 0
cd apps/api && node --import tsx --test src/tours/canonical-validation.spec.ts
```

**Urban/Starter:** `createPlatformWizardHostHooks` — dimensions unchanged.

---

## 8. SUBPHASE 13.4 — Create Page Split (highest risk)

### Mechanical extraction rules

```yaml
split_rules:
  method: COPY then TRIM — no logic rewrites
  new_files:
    - apps/web/app/tours/new/denali-create-tour-wizard-client.tsx  # blocks B–F
    - apps/web/src/wizard/workspace-create-tour-shell.tsx          # blocks A + G shell
  router_file: apps/web/app/tours/new/new-tour-wizard-client.tsx    # < 120 lines
  preserve_exports: default export name unchanged for Next.js page
  preserve_test_ids: ALL existing data-testid constants
```

### TASK P13-4-T03 — Extract Denali client

**Move these imports unchanged to `denali-create-tour-wizard-client.tsx`:**

```
@app-tour/workspace-denali/draft
@/draft/denali-*
@/wizard/denali/*
@/bootstrap/denali-wizard-rules
getDenaliWorkspacePlugin
createDenaliWizardDraftSessionId  # until wired via plugin.wizardHost.media in 13.5
```

**Move state/effects:** lines ~126–734 (all `isDenali` branches become unconditional inside Denali file)

**Export:**

```typescript
export function DenaliCreateTourWizardClient(): React.ReactElement { ... }
```

### TASK P13-4-T04 — Thin router

`**new-tour-wizard-client.tsx` after split:**

```typescript
"use client";
import { useAppSession } from "@/providers/app-session-context";
import { DenaliCreateTourWizardClient } from "./denali-create-tour-wizard-client";
import { WorkspaceCreateTourWizardShell } from "@/wizard/workspace-create-tour-shell";

export default function NewTourWizardClient() {
  const session = useAppSession();
  if (session.pluginId === "denali") {
    return <DenaliCreateTourWizardClient />;
  }
  return <WorkspaceCreateTourWizardShell pluginId={session.pluginId} />;
}
```

**Note:** Single `pluginId === "denali"` in router is **acceptable** (product routing). Guard in 13.6 applies to `getDenaliWorkspacePlugin` in router — not here.

### TASK P13-4-T08 — Regression gate

```bash
cd apps/web && node --import tsx --test \
  test/denali-wizard-draft-contract.spec.ts \
  test/denali-photo-upload.spec.ts \
  test/wizard-host-boundary.spec.ts
```

**Also:**

```bash
rg 'getDenaliWorkspacePlugin' apps/web/app/tours/new/new-tour-wizard-client.tsx
# → 0 matches after split
```

---

## 9. SUBPHASE 13.5 — Wire hooks in Denali client

### TASK P13-5-T02 — Session id from plugin

```yaml
files_allowlist:
  - apps/web/app/tours/new/denali-create-tour-wizard-client.tsx
```

**Replace:**

```typescript
const wizardSessionId = useMemo(() => createDenaliWizardDraftSessionId(), []);
```

**With:**

```typescript
const denaliPlugin = useMemo(() => getDenaliWorkspacePlugin(), []);
const wizardSessionId = useMemo(
  () => denaliPlugin.wizardHost?.media?.createAssetSessionId() ?? createDenaliWizardDraftSessionId(),
  [denaliPlugin]
);
```

**Fallback** keeps tests green if hook missing.

### TASK P13-5-T04 — freshStart / resume

**Do not change** `isDenaliFreshStartEnvelope` logic — only call via hook when `prepareDraftEnvelope` added.

**Must pass:** `DWC-RESUME-`* tests in draft contract spec.

---

## 10. SUBPHASE 13.6 — Guards

### TASK P13-6-T02 — Extend boundary spec

**Add to `wizard-host-boundary.spec.ts`:**

```typescript
it("WEB-13.6-01 wizard-field has no denali prefix fallback", () => {
  const source = readFileSync(join(import.meta.dirname, "../src/wizard/wizard-field.tsx"), "utf8");
  assert.doesNotMatch(source, /startsWith\(["']denali\./);
});
```

### TASK P13-6-T03 — Create page boundary spec

**New file `apps/web/test/wizard-create-boundary.spec.ts`:**

```typescript
it("WEB-13.6-02 new-tour-wizard-client is thin router", () => {
  const source = readFileSync(ROUTER_PATH, "utf8");
  assert.ok(source.split("\n").length < 120);
  assert.doesNotMatch(source, /useWorkspaceDraft/);
  assert.doesNotMatch(source, /getDenaliWorkspacePlugin/);
});
```

---

## 11. SUBPHASE 13.7 — Closure

### TASK P13-7-T02 — Neutral remint type

```yaml
files_allowlist:
  - packages/workspace-sdk/src/tour/tour-clone-hydrator.contract.ts
```

```typescript
export type WizardPhotoRemintPlanEntry = {
  readonly sourceStorageKey: string;
  readonly destStorageKey: string;
  readonly oldPhotoId: string;
  readonly newPhotoId: string;
  readonly contentType?: string;
};

/** @deprecated Use WizardPhotoRemintPlanEntry */
export type DenaliPhotoRemintPlanEntry = WizardPhotoRemintPlanEntry;
```

Update `TourCloneHydrationResult.photoRemintPlan` to use `WizardPhotoRemintPlanEntry`.

---

## 12. PHASE 13 DEFINITION OF DONE (machine-checkable)

```bash
#!/bin/bash
# run from repo root — all must exit 0
rg -q 'startsWith\("denali\."' packages/platform-core/src && exit 1 || true
test $(rg -c 'workspaceType !== "denali"' apps/api/src/tours/tour-wizard-photos.routes.ts 2>/dev/null || echo 0) -eq 0
test $(rg -c 'plugin\.id === "denali"' apps/api/src/tours/canonical-validation-sync.ts 2>/dev/null || echo 0) -eq 0
test $(wc -l < apps/web/app/tours/new/new-tour-wizard-client.tsx) -lt 120
pnpm run generate:workspace-registry --check
pnpm run pre-commit:fast
cd apps/web && node --import tsx --test test/denali-wizard-draft-contract.spec.ts test/denali-photo-upload.spec.ts test/wizard-host-boundary.spec.ts
echo "PHASE_13_DOD_OK"
```

---

## 13. TASK INDEX (quick lookup)


| ID         | One line                         | Wave |
| ---------- | -------------------------------- | ---- |
| P13-0-T01  | Doc media contract               | 1    |
| P13-0-T02  | Create WorkspaceWizardMediaHooks | 1    |
| P13-0-T03  | Add media? to host hooks         | 1    |
| P13-0-T04  | Denali media impl                | 1    |
| P13-0-T05  | denali-wizard-host-hooks.spec.ts | 1    |
| P13-0-T06  | SDK neutral guard verify         | 1    |
| P13-0b-T02 | Envelope hook types              | 1    |
| P13-0b-T04 | Denali envelope delegates        | 1    |
| P13-3-T03  | API validation dimensions fix    | 2    |
| P13-1-T02  | manifest wizardMedia             | 2    |
| P13-1-T04  | generator wizardMedia            | 2    |
| P13-1-T07  | refactor photo upload route      | 2    |
| P13-1-T10  | API photo tests                  | 2    |
| P13-2-T04  | BFF alias                        | 3    |
| P13-4-T03  | Extract Denali create client     | 4    |
| P13-4-T04  | Thin router                      | 4    |
| P13-5-T02  | Session from plugin.media        | 4    |
| P13-6-T02  | wizard-field boundary test       | 5    |
| P13-7-T02  | WizardPhotoRemintPlanEntry       | 5    |


---

## 14. تاریخچه


| Ver | Date       | Change                                                                |
| --- | ---------- | --------------------------------------------------------------------- |
| v1  | 2026-06-18 | Initial assessment                                                    |
| v2  | 2026-06-18 | Phase 13 subphases                                                    |
| v3  | 2026-06-18 | AI agent playbook — YAML tasks, flows, tests, grep gates, split rules |


---

*Promote to `docs/phase-13/` when P13-0-T01 lands.*