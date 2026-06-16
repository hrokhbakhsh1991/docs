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
| Closure guards | 4 | [`denali-draft-systemic-closure.spec.ts`](../../apps/web/test/denali-draft-systemic-closure.spec.ts), [`test-changed.sh`](../../scripts/test-changed.sh) draft pkg mapping | `WEB-P11-CLOSE-01` … `05` |

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
  test/resolve-wizard-validation-issue-message.spec.ts
bash scripts/guard-docs.sh
```

See also [`web-draft-host.md`](web-draft-host.md) — transport, error UX, visibility flush sections.

## Verification

- `packages/workspaces/denali/test/denali-wizard-draft-binding.spec.ts`
- `apps/web/test/denali-wizard-draft-resume.spec.ts`
- `apps/web/test/denali-tour-create-payload.spec.ts`
- `apps/web/test/denali-catalog-sanitize.spec.ts`
- `apps/web/test/resolve-wizard-validation-issue-message.spec.ts` — code → i18n mapping
- `apps/web/test/denali-flat-edit-validation-list.spec.ts` — flat edit i18n parity
- `apps/web/test/denali-draft-systemic-closure.spec.ts` — Phase 1–4 regression guards

`mainThemeFormProfile` for contextual rules derives from the first selected `program.themeIds` row when the theme catalog is loaded (`new-tour-wizard-client.tsx`).
