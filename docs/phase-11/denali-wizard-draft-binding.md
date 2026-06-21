# Denali wizard draft binding (Phase 11.5)

> **DEC:** [DEC-P11-006](appendices/IMPLEMENTATION-DECISIONS.md#dec-p11-006--denali-wizard-draft-binding-115)  
> **Draft API:** [`workspace-draft-persistence.md`](workspace-draft-persistence.md)  
> **Web hook:** [`web-draft-host.md`](web-draft-host.md)

## Namespace / key

| Field | Value |
| ----- | ----- |
| `draftNamespace` | `operator.wizard` |
| `draftKey` | `denali-create` |

Constants: `@app-tour/workspace-denali` → `DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE`, `DENALI_CREATE_TOUR_DRAFT_KEY`.

## Envelope

```typescript
type DenaliWizardDraftEnvelope<TForm> = {
  form: TForm;
  meta: {
    currentStepIndex: number;
    wizardSessionId?: string;
    /** True after explicit clear — conflict merge prefers local template. */
    freshStart?: boolean;
    /** Server-persisted tombstones only — stripped on client hydrate (Track B). Legacy 409 merge reads server copy (Track C). */
    deletedRoots?: readonly string[];
  };
};
```

Web uses `TForm = TourWizardDraft` (`apps/web/src/tours/tour-wizard-draft.ts`).

### 409 merge v2 (`mergeDenaliWizardDraftEnvelope`)

Replaces naive shallow spread on `form.data` with controlled merge rules:

| Situation | Result |
| --------- | ------ |
| `local.meta.freshStart === true` | Local form + meta only (unchanged) |
| Root in `meta.deletedRoots` | **Omitted** — server cannot zombie-resurrect |
| Root only on server | Take server (resume gap-fill) |
| Root only on local | Take local |
| Root on both, member of `DENALI_CANONICAL_OBJECT_ROOTS` | Level-2 merge: `{ ...serverRoot, ...localRoot }` (local wins key collisions) |
| Root on both, scalar / flat leaf | Local replaces wholesale |

`DENALI_CANONICAL_OBJECT_ROOTS` is exported from `@app-tour/workspace-denali/draft` (`program`, `transport`, `pricing`, `participants`, `policies`, `tripDetails`, `photos`, `gatheringPoints`).

`meta.deletedRoots` on merge: reads **server array only** to filter merged `form.data`; **output meta omits `deletedRoots`** (INV-2 — same as prepare/hydrate). Step index and `wizardSessionId` rules unchanged.

### Tombstone write path (Track B — server-primary)

**Client no longer tracks `deletedRoots`.** On edit, `onDraftChange` sanitizes once and writes envelope meta without `deletedRoots` (step index, `wizardSessionId`, `freshStart` only).

Server PATCH recomputes `meta.deletedRoots` from stored vs incoming form via `WorkspacePlugin.draftTombstone` — see [`workspace-draft-persistence.md`](workspace-draft-persistence.md) § Envelope tombstone invariants (Track A).

| Layer | `deletedRoots` |
| ----- | -------------- |
| Client envelope (UI / engine `data`) | **Absent** — `normalizeRemote` (`denaliHydrateDraftEnvelope`) on remote hydrate; `denaliPrepareDraftEnvelope` on edit |
| Server DB row | Authoritative after PATCH recompute |
| 409 merge (`off` / `shadow`) | `mergeDenaliWizardDraftEnvelope` + `schemaGate` merge phase — server tombstones apply to form only; client meta stripped |
| 409 reload (`on`) | `SERVER_WINS` — `normalizeRemote` strips meta after server hydrate |

See also [`web-draft-host.md`](web-draft-host.md) — AckRecord cache, PATCH transport, and `DRAFT_UNIFICATION_V3` rollout.

## Track C rollout — `DRAFT_UNIFICATION_V3`

Flag resolver: `apps/web/src/draft/draft-unification-v3.ts`

| Env (precedence) | Values | Effect |
| ---------------- | ------ | ------ |
| `NEXT_PUBLIC_DRAFT_UNIFICATION_V3` | `off` \| `shadow` \| `on` | Client bundle (wins when set) |
| `DRAFT_UNIFICATION_V3` | same | Server fallback when public unset |
| default | — | `off` |

Wiring helpers: `apps/web/src/draft/draft-unification-v3-options.ts` — consumed by `new-tour-wizard-client.tsx` and `denali-flat-edit-page-client.tsx`.

| Mode | `conflictStrategy` | `merge` | Post-PATCH hook |
| ---- | ------------------ | ------- | --------------- |
| `off` | `REFETCH_REAPPLY` | `mergeDenaliWizardDraftEnvelope` | none |
| `shadow` | `REFETCH_REAPPLY` | `mergeDenaliWizardDraftEnvelope` | `logDenaliTombstoneShadowMismatch` after PATCH 200 |
| `on` | `SERVER_WINS` | omitted | same shadow hook (no-op unless `shadow`) |

### 409 SERVER_WINS UX (`on`)

When PATCH returns `409` and strategy is `SERVER_WINS`, `DraftEngine.handleConflict`:

1. `hydrateFromRemote(serverPayload)` — local edits discarded
2. `conflictReloadNotice = true` → `DraftConflictBanner` shows `common.draftSync.serverReloaded`
3. Cleared on next user `setDraftData` (operator may continue editing)

No `DRAFT_AVAILABLE` pending-draft chooser in `on` mode — server snapshot is applied immediately.

### Manual smoke checklist (Track C)

| # | Scenario | Expected | Result |
|---|----------|----------|--------|
| 1 | **`off`:** PATCH after canonical root delete | 200; no `TOMBSTONE_RESURRECTION` | **pass** (prior run) |
| 2 | **`off`:** Client PATCH after hydrate | `meta.deletedRoots` absent in PATCH body | **pass** (B-8 `normalizeRemote`) |
| 3 | **`off`:** Two-tab stale edit | Quiet merge; no reload banner | **automated** — `denali-draft-unification-smoke.mjs` `runTwoTabConflict` |
| 4 | **`on`:** Two-tab stale edit | Reload banner FA/EN; server title wins | **automated when** `SMOKE_EXPECT_UNIFICATION_ON=true` + web built with `NEXT_PUBLIC_DRAFT_UNIFICATION_V3=on` |
| 5 | **Flat-edit parity** | `DraftSyncChrome` on `/tours/[id]/edit` | **automated** — smoke script `runFlatEditSmoke` |

Run:

```bash
# default off-mode smoke (web + api dev required)
node apps/web/scripts/denali-draft-unification-smoke.mjs

# SERVER_WINS sign-off
NEXT_PUBLIC_DRAFT_UNIFICATION_V3=on pnpm --filter @apps/web dev
SMOKE_EXPECT_UNIFICATION_ON=true node apps/web/scripts/denali-draft-unification-smoke.mjs
```

Legacy numbered list (same scenarios):

1. **`off` (default):** Two tabs edit same draft → stale PATCH → quiet merge via `REFETCH_REAPPLY`; no reload banner.
2. **`shadow`:** Same as `off`; after successful PATCH, dev console may log `[draft-unification-v3] tombstone shadow mismatch` when client form diff implies roots server did not tombstone.
3. **`on`:** Stale PATCH → UI shows server reload banner once; form matches server; banner clears after any edit.
4. **Tombstone:** Delete canonical root in tab A, save; tab B stale push → merged/reloaded envelope must not resurrect deleted root (`photos`, `program`, etc.).
5. **Flat-edit parity:** Repeat steps 1–3 on `/tours/[id]/edit` — same `DraftSyncChrome` + flag helpers.

### C-5 deferral

`trackDeletedCanonicalRoots` remains in `denali-wizard-draft-merge.ts` until flag is `on` at 100% rollout for ≥90 days — do not delete in Track C.

See also [`web-draft-host.md`](web-draft-host.md) — AckRecord cache + PATCH transport.

## Helpers (`packages/workspaces/denali/src/draft/`)

- `denaliPrepareDraftEnvelope(form, meta)` — clone before push
- `denaliHydrateDraftEnvelope(remote, fallbackForm, fallbackMeta?)` — strip server tombstones from meta

Web adapter: `apps/web/src/draft/denali-draft-normalize-remote.ts` → `normalizeDenaliRemoteEnvelope` wired as `DraftEngineConfig.normalizeRemote`.

Full Legacy `sanitizeDenaliWizardDraftSnapshot` port deferred — trunk form is canonical-path `TourWizardDraft`, not `DenaliCreateTourWizardForm`.

## Web wiring

`new-tour-wizard-client.tsx`:

1. `useWorkspaceDraft<NewTourWizardDraftEnvelope>` with `resolveDenaliDraftConflictStrategy()` + `resolveDenaliDraftMerge()` (Track C flag)
2. `WorkspaceWizardHost` — controlled `activeStepIndex` from `meta`
3. `DraftSyncIndicator` + `DraftConflictBanner` in page header
4. `clearDraft()` after successful `createTourAction`
5. `navLocked` while SYNCING

### Default tour kind (create wizard)

New and cleared create drafts seed canonical `data.category = mountain_day` via `applyDenaliDefaultTourKind` (`apps/web/src/wizard/denali/denali-default-tour-kind.ts`) inside `buildPrefilledForm`. The tour-kind composite and matrix dimensions therefore match persisted draft from first render — operators can type title and other basics without an extra classification click.

### Step resume + freshStart

`WorkspaceWizardHost.resolveInitialStepIndex` infers the furthest step with **meaningful user-entered** field data when `meta.currentStepIndex === 0`. Sanitize/template scalars (`false`, `"false"`, `"none"`, default `difficultyLevel` `5`, `publishStatus` `draft`, etc.) are ignored via `isPhantomCanonicalScalar` in `resolve-initial-step-index.ts` so Branch B phantom-default inference cannot jump to pricing.

New create-tour prefill sets `meta.freshStart: true`. When the hydrated envelope is essentially empty (`isDraftEssentiallyEmpty`), the client resets `currentStepIndex: 0` + `freshStart: true`, and `mergeDenaliWizardDraftEnvelope` keeps step `0` over a stale server index. `suppressDraftStepInference` (freshStart) forces step `0` in `WorkspaceWizardHost` even when server meta still carries a higher index.

After explicit clear, `meta.freshStart === true` sets `suppressDraftStepInference` so inference is skipped (stale server form fragments must not jump back to step 5). `onActiveStepIndexChange` ignores no-op index updates to avoid redundant PATCH loops.

### Test contract (regression guard)

Behavioral specs for create-wizard draft live in `apps/web/test/denali-wizard-draft-contract.spec.ts` (`DWC-*`). This file replaces scattered `denali-default-tour-kind`, `denali-wizard-resume-step`, and `denali-wizard-clear-draft-integration` specs. Tier map: [`web-draft-host.md` — Draft wizard test contract](web-draft-host.md#draft-wizard-test-contract-dwc).

## Submit (canonical payload)

`prepareDenaliTourCreatePayload` (`apps/web/src/wizard/denali/denali-tour-create-payload.ts`):

1. `sanitizeDenaliWizardDraft` — final invariant pass (ghost purge). **Pre-classification:** when canonical `category` is empty, sanitize is a no-op (same gate as `applyDenaliConditionalFieldRules` / `hasDenaliWizardClassification`); contextual rules treat fields as visible until tour kind is resolved. Create wizard prefill sets `mountain_day` so this gate passes on open.

**Tour kind UI:** Canonical slug at `data.category` drives display (`denali-tour-kind-field-logic.ts`). Create/clear prefill sets `mountain_day` so the **current selection banner** shows «کوهنوردی · تک‌روزه» and category/duration buttons render **active** on first paint.

**Always-visible picker:** Category and duration segmented controls stay on screen (never inside a closed `<details>`). A read-only banner above the matrix confirms the persisted slug; operators change selection by clicking another chip — no hidden collapse step.

**Template invariant (INV-DENALI-WIZ-001):** Tenant wizard-template overlays may trim optional fields but **`category` is always injected** on `denali_basic` when missing (`@app-tour/workspace-denali/wizard/template-invariants`). Without this, the tour-kind composite never mounts and matrix-driven fields break silently.

**Matrix-required template fields (INV-DENALI-WIZ-005):** Fields marked `required: true` in the Denali rule matrix (e.g. `program.shortDescription` on `denali_photos`) are injected when a published tenant template omitted them — same mechanism as INV-DENALI-WIZ-001 (`ensureDenaliMatrixRequiredTemplateSteps` / `ensureDenaliMatrixRequiredAllowedPaths` in `wizard-template-gate-logic.ts`). Prevents submit validation failures for fields the operator cannot see.

**Composite-dependent paths (INV-DENALI-WIZ-006):** Registry rows in `DENALI_COMPOSITE_DEPENDENT_PATHS` (including `program.shortDescription` / `program.longDescription`) are excluded from the platform render plan as standalone fields; they render inside the anchor composite `denali.program-content` (`program.themeIds`). Template injection alone cannot surface them via `applyWizardTemplateToRenderPlan` — the composite must render matrix-required dependents. `DenaliProgramContentField` always exposes `program.shortDescription` (required textarea with `data-field-path`) so trimmed tenant templates and full templates behave the same on the photos step.

**Contextual visibility (INV-DENALI-WIZ-002):** After classification is set (`mountain_day`, etc.), `applyDenaliConditionalFieldRules` must keep **`category` visible** on the create wizard. `category`, `duration`, and `eventVariant` share one RHF path (`basicInfo.tourType`); `evaluateFormFieldRule` therefore passes the **canonical path** into `isDenaliFieldVisibleOnStep`, not the ambiguous form path. Passing `basicInfo.tourType` alone would resolve to `eventVariant` and incorrectly hide the tour-kind composite.

Active choice buttons use `denali-tour-kind__choice--active`. Persisted value always comes from canonical `data.category`, never matrix fallbacks.

**Tour kind draft sync (INV-DENALI-WIZ-003):** Only `category` persists the tour-kind slug. Sanitize must not mirror `duration` / `eventVariant` aliases into `form.data` (they share `basicInfo.tourType` — see `shouldPersistCanonicalPathFromForm`). The tour-kind picker keeps an optimistic slug ref so rapid category+duration clicks compose one slug; `onDraftChange` rebases category onto the latest engine snapshot and skips `setData` when sanitize is a no-op (prevents save-loop / «در حال ذخیره…» flicker).

**Text field draft sync (INV-DENALI-WIZ-004):** All wizard field edits (primitive + composite) must call `commitWizardDraftEdit(useLatestWizardDraft(draft), onDraftChange, …)` — never `setCanonical*Value(draft, …)` from a stale render closure. Host: `WorkspaceWizardHost` + `DenaliFlatEditForm`. Shared persist: `persistDenaliWizardDraftChange` (create wizard + `useDenaliFlatEditRuleSync`). Engine: structural `setDraftData` dedup; `localChangedDuringPush` uses JSON equality; `normalizeForGate` identity when `freshStart` without `deletedRoots`. Preset effect runs once per `presetId` (no `draftSync.data` dep). Adapter aborts in-flight PATCH only when payload JSON changes (`WEB-P11-3-15`).

Specs: `apps/web/test/denali-tour-kind-field-logic.spec.ts` (DWC-TK-*), `apps/web/test/denali-tour-kind-field.spec.tsx` (DWC-TK-UI-*).

2. Catalog ref filters when settings APIs are available — gear (`activeEquipmentIds`), themes (`activeThemeIds`), leaders (`selectableLeaderIds`)
3. `tourWizardDraftToDenaliForm` → `prepareDenaliSubmitArtifact` / `projectDenaliWizardFormToCanonicalIngressData` (nested roots **with arrays** — see [`canonical-array-ingress.md`](canonical-array-ingress.md))
4. `createCanonicalDocument` — `schemaVersion` + `plugin.wizard.roots` + `data`

`createTourAction` passes Denali canonical bodies through unchanged (`isDenaliCanonicalCreatePayload`); the starter `basics.title` shim applies only when roots/category are absent.

## Validation message i18n (Phase 2 — display layer)

Platform and Denali validators emit `ValidationViolation.code` + English `message`. UI must not render raw platform strings as the primary copy when a translation exists.

`DenaliReviewValidationSummary` resolves display text via:

```text
t(`review.validation.${code}`, { field: fieldLabel })  → fallback to violation.message
```

Codes live in `packages/workspaces/denali/messages/{en,fa}/wizard.json` under `review.validation.*` (e.g. `REQUIRED_FIELD_EMPTY`, `CANONICAL_TYPE_MISMATCH`, `VALIDATION_RULE_REQUIRED_FIELD`, `DENALI_TOUR_TYPE_REQUIRED`).

`mapValidationResultToIssues` forwards optional `code` on each `ValidationIssue` so the web layer stays decoupled from `@app-tour/platform-core` message literals.

`DenaliFlatEditValidationList` (flat edit footer) uses the same `resolveWizardValidationIssueMessage` + `denali.review.validation.*` keys as the create-tour review panel.

## Systemic fixes closure (Phase 4 — DoD)

Blueprint: `temp/denali-draft-systemic-fixes.md`. Phases 1–3 implement transport/merge, error UX + validation i18n, and visibility flush. Phase 4 closes merge-readiness gaps.

| Blueprint section | Phase | Key implementation | Proof specs |
| ----------------- | ----- | ------------------ | ----------- |
| 1 Transport blindness | 1 | [`workspace-draft-client.ts`](../../apps/web/src/draft/workspace-draft-client.ts), [`create-workspace-draft-adapter.ts`](../../apps/web/src/draft/create-workspace-draft-adapter.ts) | `WEB-P11-3-04`, `WEB-P11-3-06`, `WEB-P11-3-07` |
| 2 Root-key merge / tombstones | 1 | [`denali-wizard-draft-merge.ts`](../../apps/web/src/draft/denali-wizard-draft-merge.ts), `meta.deletedRoots` | `WEB-P11-5-04`, `WEB-P11-5-05`, `WEB-P11-5-06` |
| 3 Error state / soft-lock | 2 | [`DraftSyncSoftLockBanner`](../../apps/web/src/draft/draft-sync-soft-lock-banner.tsx), [`DraftManualSyncButton`](../../apps/web/src/draft/draft-manual-sync-button.tsx) | `WEB-P11-3-08`, `WEB-P11-5-07` |
| 4 Validation i18n | 2 | [`denali-review-validation-summary.tsx`](../../apps/web/src/wizard/denali/denali-review-validation-summary.tsx), [`denali-flat-edit-validation-list.tsx`](../../apps/web/src/wizard/denali/denali-flat-edit-validation-list.tsx) | `WEB-P11-5-07`, flat-edit validation list spec |
| 5 Visibility flush | 3 | [`use-draft-visibility-flush.ts`](../../apps/web/src/draft/use-draft-visibility-flush.ts), `flushKeepalive` | `WEB-P11-3-09`, `WEB-P11-3-10`, `WEB-P11-3-11` |
| 5A Hermetic schema gate | 5A | [`create-denali-draft-schema-gate.ts`](../../packages/workspaces/denali/src/draft/create-denali-draft-schema-gate.ts), `QUARANTINED` | `WEB-P11-HERMETIC-01` … `04` |
| 5B UI sync chrome symmetry | 5B | [`draft-sync-chrome.tsx`](../../apps/web/src/draft/draft-sync-chrome.tsx), flat-edit parity | `WEB-P11-SYMM-01` … `04` |
| 6 API structural tombstone | 6 | [`envelope-tombstone-invariants.ts`](../../apps/api/src/workspace-drafts/invariants/envelope-tombstone-invariants.ts) | `API-P11-TOMB-01` … `03`, `API-P11-GEN-01` |
| Closure guards | 4+ | [`denali-draft-systemic-closure.spec.ts`](../../apps/web/test/denali-draft-systemic-closure.spec.ts), [`test-changed.sh`](../../scripts/test-changed.sh) draft pkg mapping | `WEB-P11-CLOSE-01` … `09` |

### Fast-track verification (Phase 4)

```bash
pnpm --filter @app-tour/draft-engine exec node --import tsx --test test/engine.spec.ts
pnpm --filter @app-tour/wizard-navigation exec node --import tsx --test test/map-validation-result.spec.ts
pnpm --filter @app-tour/workspace-denali exec node --import tsx --test test/denali-wizard-draft-binding.spec.ts
pnpm --filter @apps/web exec node --import tsx --test \
  test/workspace-draft-client.spec.ts \
  test/create-workspace-draft-adapter.spec.ts \
  test/draft-visibility-flush-logic.spec.ts \
  test/denali-wizard-draft-resume.spec.ts \
  test/denali-draft-systemic-closure.spec.ts \
  test/denali-draft-hermetic-closure.spec.ts \
  test/denali-flat-edit-sync-chrome.spec.ts \
  test/resolve-wizard-validation-issue-message.spec.ts
bash scripts/guard-docs.sh
```

See also [`web-draft-host.md`](web-draft-host.md) — transport, error UX, visibility flush sections.

## Hermetic schema gate (Phase 5A)

Client-only validation choke point before draft PATCH. Implemented in `@app-tour/workspace-denali/draft` — **not** imported by `@apps/api`.

### Files

- `packages/workspaces/denali/src/draft/denali-wizard-draft-schema.ts` — `DenaliWizardDraftEnvelopeSchema` (Zod)
- `packages/workspaces/denali/src/draft/create-denali-draft-schema-gate.ts` — `createDenaliDraftSchemaGate`

### prePush validate-only (Track B — INV-3)

`phase: "prePush"`: `normalizeForGate` → Zod parse → return envelope **unchanged** (no sanitize fixpoint). Sanitize runs **once** on the edit path (`onDraftChange` / flat-edit rule sync).

### Fixpoint guard (G-DENALI-02) — merge phase only

```typescript
export const MAX_SANITY_ATTEMPTS = 2 as const;
```

Inside `createDenaliDraftSchemaGate` when `phase: "merge"`: `parse → sanitizeDenaliWizardDraftEnvelope → re-parse` loop. If the envelope does not stabilize within **2** iterations:

1. Break loop (no infinite retry)
2. `console.warn` with `SANITIZE_FIXPOINT_EXCEEDED`
3. Return `{ ok: false }` → engine `QUARANTINED` (network only; UI editable)

### freshStart normalization (G-DENALI-03)

When `meta.freshStart === true`, gate normalization clears `deletedRoots` before the fixpoint loop.

### Web wiring (Phase 5A)

`new-tour-wizard-client.tsx` passes `schemaGate: createDenaliDraftSchemaGate(denaliRules, wizardRuleEvalContext)` to `useWorkspaceDraft` when rules are loaded.

Flat-edit symmetry + shared `DraftSyncChrome` → Phase 5B.

### Phase 5A DoD specs

| ID | Assert |
| -- | ------ |
| WEB-P11-HERMETIC-01 | prePush gate failure → no `onPush` |
| WEB-P11-HERMETIC-02 | `flushKeepalive` blocked on gate fail |
| WEB-P11-HERMETIC-04 | fixpoint abort at `MAX_SANITY_ATTEMPTS=2` |

## UI sync chrome symmetry (Phase 5B)

Shared shell: `apps/web/src/draft/draft-sync-chrome.tsx` composes:

- `DraftSyncIndicator` + `DraftManualSyncButton` (header row)
- `DraftConflictBanner` + `DraftQuarantineBanner` (+ optional inline `DraftSyncSoftLockBanner`)

Both **create-tour** (`new-tour-wizard-client.tsx`) and **flat-edit** (`denali-flat-edit-page-client.tsx`) consume `DraftSyncChrome`.

Flat-edit additionally:

- `showInlineSoftLockBanner` for `SYNCING` / `CONFLICT_RESOLVING` / `ERROR`
- `navLocked` → `DenaliFlatEditForm` `<fieldset disabled>` (not applied on `QUARANTINED`)
- `schemaGate` wired via `createDenaliDraftSchemaGate`

### Phase 5B DoD specs

| ID | Assert |
| -- | ------ |
| WEB-P11-SYMM-01 | flat-edit uses `DraftSyncChrome` + manual sync |
| WEB-P11-SYMM-02 | create-tour + flat-edit both import chrome (no direct indicator import) |
| WEB-P11-SYMM-03 | flat-edit `navLocked` disables fieldset only during sync/conflict |
| WEB-P11-SYMM-04 | flat-edit `schemaGate` parity |

## API envelope tombstone (Phase 6 — G-API-04)

Server-side pipeline: **recompute** then **structural check**. On PATCH, `@apps/api` loads the stored snapshot, resolves the workspace plugin, and calls `plugin.draftTombstone.resolveTombstoneRoots(baselineForm, incomingForm)` (Denali implements via `DENALI_CANONICAL_OBJECT_ROOTS`). Persisted `meta.deletedRoots` is **server-authoritative**; client hints are overwritten. Structural invariant module remains workspace-agnostic — `@apps/api` must not import `@app-tour/workspace-denali`.

Module: `apps/api/src/workspace-drafts/invariants/envelope-tombstone-invariants.ts`  
Recompute: `apps/api/src/workspace-drafts/reapply-server-envelope-tombstones.ts`  
Denali binding: `packages/workspaces/denali/src/draft/denali-draft-tombstone-binding.ts`

Full contract: [`workspace-draft-persistence.md`](workspace-draft-persistence.md#envelope-tombstone-invariants-phase-6--g-api-04).

| Violation | Condition |
| --------- | --------- |
| Pass-through | `data` not `{ form: { data: object }, meta: object }` |
| `DELETED_ROOTS_NOT_ARRAY` | `meta.deletedRoots` present but not `string[]` |
| `TOMBSTONE_RESURRECTION` | `root ∈ deletedRoots` is own key of `form.data` |

Enforced on PATCH when `draftNamespace === operator.wizard`. Rejected writes emit audit event `tombstone_violation`.

Full contract: [`workspace-draft-persistence.md`](workspace-draft-persistence.md#envelope-tombstone-invariants-phase-6--g-api-04).

### Phase 6 DoD specs

| ID | Assert |
| -- | ------ |
| API-P11-TOMB-01 | client resurrection on v0 → HTTP 200 after server recompute; incoherent envelope after recompute → HTTP 400 |
| API-P11-TOMB-02 | invalid `deletedRoots` shape → HTTP 400 |
| API-P11-TOMB-03 | opaque / valid envelope → persist |
| API-P11-GEN-01 | zero `workspace-denali` imports in invariant module |

## Phases 5–6 + unification closure (DoD bundle)

After 5A/5B/6 and Tracks A–C land, run:

```bash
pnpm --filter @app-tour/draft-engine run build
pnpm --filter @app-tour/workspace-denali run build
pnpm --filter @app-tour/draft-engine exec node --import tsx --test test/engine.spec.ts test/schema-gate.spec.ts
pnpm --filter @app-tour/workspace-sdk exec node --import tsx --test test/workspace-draft-tombstone-binding.spec.ts
pnpm --filter @app-tour/workspace-denali exec node --import tsx --test \
  test/denali-wizard-draft-schema.spec.ts \
  test/denali-wizard-draft-binding.spec.ts \
  test/denali-draft-tombstone-binding.spec.ts
pnpm --filter @apps/web exec node --import tsx --test \
  test/denali-draft-hermetic-closure.spec.ts \
  test/denali-flat-edit-sync-chrome.spec.ts \
  test/denali-draft-unification-closure.spec.ts \
  test/denali-draft-systemic-closure.spec.ts \
  test/create-workspace-draft-adapter.spec.ts \
  test/draft-unification-client.spec.ts \
  test/draft-unification-v3.spec.ts \
  test/draft-conflict-banner-logic.spec.ts \
  test/denali-wizard-draft-resume.spec.ts
pnpm --filter @apps/api exec node --import tsx --test \
  test/workspace-draft-tombstone-invariants.spec.ts \
  test/workspace-draft-server-tombstone.spec.ts \
  test/workspace-drafts.spec.ts
pnpm run guard:import-boundary
bash scripts/guard-docs.sh
```

## Verification

- `packages/workspaces/denali/test/denali-wizard-draft-binding.spec.ts`
- `apps/web/test/denali-wizard-draft-resume.spec.ts`
- `apps/web/test/denali-tour-create-payload.spec.ts`
- `apps/web/test/denali-catalog-sanitize.spec.ts`
- `apps/web/test/resolve-wizard-validation-issue-message.spec.ts` — code → i18n mapping
- `apps/web/test/denali-flat-edit-validation-list.spec.ts` — flat edit i18n parity
- `apps/web/test/denali-draft-systemic-closure.spec.ts` — Phase 1–4 regression guards
- `apps/web/test/denali-draft-unification-closure.spec.ts` — Tracks A–C regression guards (`WEB-P11-UNIFY-*`)
- `apps/web/test/denali-draft-hermetic-closure.spec.ts` — Phase 5A guards
- `apps/web/test/denali-flat-edit-sync-chrome.spec.ts` — Phase 5B symmetry
- `apps/web/test/draft-unification-client.spec.ts` — Track B client tombstone + ack
- `apps/web/test/denali-wizard-draft-persist.spec.ts` — `WEB-WIZ-PERSIST-*` rebase + dedup
- `apps/web/test/denali-wizard-save-loop.spec.ts` — `WEB-WIZ-LOOP-*` post-flush dedup + category toggle
- `apps/web/test/create-workspace-draft-adapter.spec.ts` — includes `WEB-P11-3-15` same-payload no-abort
- `apps/web/test/draft-unification-v3.spec.ts` — Track C flag + merge guards
- `apps/api/test/workspace-draft-server-tombstone.spec.ts` — Track A server recompute (`API-P11-TOMB-*`)

`mainThemeFormProfile` for contextual rules derives from the first selected `program.themeIds` row when the theme catalog is loaded (`new-tour-wizard-client.tsx`).

### Dev E2E scripts (manual, against running `denali.localhost:3000`)

| Script | Purpose |
| ------ | ------- |
| `apps/web/scripts/denali-draft-e2e-probe.mjs` | Resume / update / clear / draft index |
| `apps/web/scripts/denali-draft-manual-verify.mjs` | Default category, step-0, PATCH storm, clear |
