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
    /** Canonical object roots intentionally removed — 409 merge must not resurrect. */
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

`meta.deletedRoots` on merge: union of local + server arrays (deduplicated). Step index and `wizardSessionId` rules unchanged.

### Tombstone write path

`trackDeletedCanonicalRoots(previousFormData, nextFormData, existingDeletedRoots)` runs in `onDraftChange` after sanitize:

- For each key in `DENALI_CANONICAL_OBJECT_ROOTS`, if `previous` had a non-empty root object and `next` omits that key → append root to `deletedRoots`.
- Persisted in envelope meta and synced as part of the opaque JSONB blob.

See also [`web-draft-host.md`](web-draft-host.md) — PATCH transport + AbortController.

## Helpers (`packages/workspaces/denali/src/draft/`)

- `denaliPrepareDraftEnvelope(form, meta)` — clone before push
- `denaliHydrateDraftEnvelope(remote, fallbackForm, fallbackMeta?)` — restore after GET / conflict

Full Legacy `sanitizeDenaliWizardDraftSnapshot` port deferred — trunk form is canonical-path `TourWizardDraft`, not `DenaliCreateTourWizardForm`.

## Web wiring

`new-tour-wizard-client.tsx`:

1. `useWorkspaceDraft<NewTourWizardDraftEnvelope>` with `REFETCH_REAPPLY` + level-2 form merge (`mergeDenaliWizardDraftEnvelope`)
2. `WorkspaceWizardHost` — controlled `activeStepIndex` from `meta`
3. `DraftSyncIndicator` + `DraftConflictBanner` in page header
4. `clearDraft()` after successful `createTourAction`
5. `navLocked` while SYNCING

## Submit (canonical payload)

`prepareDenaliTourCreatePayload` (`apps/web/src/wizard/denali/denali-tour-create-payload.ts`):

1. `sanitizeDenaliWizardDraft` — final invariant pass (ghost purge)
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

### Fixpoint guard (G-DENALI-02)

```typescript
export const MAX_SANITY_ATTEMPTS = 2 as const;
```

Inside `createDenaliDraftSchemaGate`: `parse → sanitizeDenaliWizardDraftEnvelope → re-parse` loop. If the envelope does not stabilize within **2** iterations:

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

Server-side **structural** check only — `@apps/api` must not import `@app-tour/workspace-denali`.

Module: `apps/api/src/workspace-drafts/invariants/envelope-tombstone-invariants.ts`

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
| API-P11-TOMB-01 | resurrected root → HTTP 400 |
| API-P11-TOMB-02 | invalid `deletedRoots` shape → HTTP 400 |
| API-P11-TOMB-03 | opaque / valid envelope → persist |
| API-P11-GEN-01 | zero `workspace-denali` imports in invariant module |

## Phases 5–6 closure (DoD bundle)

After 5A/5B/6 land, run:

```bash
pnpm --filter @app-tour/draft-engine exec node --import tsx --test test/engine.spec.ts test/schema-gate.spec.ts
pnpm --filter @app-tour/workspace-denali exec node --import tsx --test test/denali-wizard-draft-schema.spec.ts test/denali-wizard-draft-binding.spec.ts
pnpm --filter @apps/web exec node --import tsx --test \
  test/denali-draft-hermetic-closure.spec.ts \
  test/denali-flat-edit-sync-chrome.spec.ts \
  test/create-workspace-draft-adapter.spec.ts \
  test/denali-draft-systemic-closure.spec.ts
pnpm --filter @apps/api exec node --import tsx --test \
  test/workspace-draft-tombstone-invariants.spec.ts \
  test/workspace-drafts.spec.ts
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
- `apps/web/test/denali-draft-hermetic-closure.spec.ts` — Phase 5A guards
- `apps/web/test/denali-flat-edit-sync-chrome.spec.ts` — Phase 5B symmetry

`mainThemeFormProfile` for contextual rules derives from the first selected `program.themeIds` row when the theme catalog is loaded (`new-tour-wizard-client.tsx`).
