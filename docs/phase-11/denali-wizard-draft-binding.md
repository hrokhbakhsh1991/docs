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
  };
};
```

Web uses `TForm = TourWizardDraft` (`apps/web/src/tours/tour-wizard-draft.ts`).

## Helpers (`packages/workspaces/denali/src/draft/`)

- `denaliPrepareDraftEnvelope(form, meta)` — clone before push
- `denaliHydrateDraftEnvelope(remote, fallbackForm, fallbackMeta?)` — restore after GET / conflict

Full Legacy `sanitizeDenaliWizardDraftSnapshot` port deferred — trunk form is canonical-path `TourWizardDraft`, not `DenaliCreateTourWizardForm`.

## Web wiring

`new-tour-wizard-client.tsx`:

1. `useWorkspaceDraft<NewTourWizardDraftEnvelope>` with `REFETCH_REAPPLY` + shallow form merge
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

## Verification

- `packages/workspaces/denali/test/denali-wizard-draft-binding.spec.ts`
- `apps/web/test/denali-wizard-draft-resume.spec.ts`
- `apps/web/test/denali-tour-create-payload.spec.ts`
- `apps/web/test/denali-catalog-sanitize.spec.ts`

`mainThemeFormProfile` for contextual rules derives from the first selected `program.themeIds` row when the theme catalog is loaded (`new-tour-wizard-client.tsx`).
