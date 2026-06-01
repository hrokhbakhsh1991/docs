# Hybrid Wizard — Architecture Hole-Punching Audit

**Scope:** `WorkspaceTourWizard.tsx`, `TourWizardTemplateSettingsService.instantiateForWorkspace`, Settings overlay paths  
**Date:** 2026-06-01

---

## 1. State leakage — Manual Mode → template row?

### Verdict: **No direct infection**; one **staleness** hole (patched) and one **server side-effect** to know about.

| Path | Writes `workspace_tour_wizard_templates.canonical_data`? |
|------|--------------------------------------------------------|
| Manual Mode tour wizard (edits, draft, Create Tour) | **No** — client-only RHF + draft engine |
| Preset banner “Apply” | **No** — `orchestrateDenaliWizardFromTemplate` in-memory; `reset(form)` only |
| Clear / reset to template baseline | **No** — same in-memory orchestration |
| Settings Save | **Yes** — explicit PATCH only |
| `POST …/tour-wizard-template/instantiate` | **Can** — `ensureMinimalTemplateSeed()` when canonical `{}` and `updatedAt === createdAt` |

Manual Mode **disables** instantiate on the create page (`useInstantiateWorkspaceTemplate(enabled: !manualWizardMode)`), so an empty template does not hit instantiate from that UI.

**Preset vs manual edits:** Applying a preset **replaces** the form (`reset(result.form)`); it does **not** merge manual field values into the preset or into the DB template row.

**Draft + template transition (hole — patched):** `initialHydrateDoneRef` was only reset on `pinnedTemplate.id` / `workspaceId`. When `canonicalData` went from `{}` → seeded (same row id, e.g. Settings save or query refetch), `manualWizardMode` flipped to `false` but the wizard could **keep manual-hydrated form** and skip factory re-hydration. **Patch:** reset hydration when `manualWizardMode` changes.

**`ensureMinimalTemplateSeed`:** First successful instantiate on a never-configured row auto-writes `{ category, duration, title, program… }`. That is not manual-mode “infection,” but it **does** mutate the template row if something calls instantiate while canonical is still `{}`.

---

## 2. Error shadowing — real backend errors vs “template empty”?

### Verdict: **No broad shadowing**; empty-template UX is **bypassed** in Manual Mode; non-empty errors **improved** to show code/HTTP/correlation.

| Scenario | Behavior |
|----------|----------|
| Empty canonical on create page | **Manual Mode notice** — instantiate not called; `TEMPLATE_CANONICAL_EMPTY` banner not used |
| Instantiate `TEMPLATE_CANONICAL_EMPTY` | Dedicated message when `error.code === "TEMPLATE_CANONICAL_EMPTY"` only |
| DB / 5xx / `TEMPLATE_INSTANTIATE_SILENT_FAILURE` | Falls through to generic branch — **now** prefixed with `code · HTTP status · correlationId` when present |
| Orchestrator `details.errors[]` | Shown as list when present (unchanged) |
| Create Tour submit | `templateCanonicalEmptyOnSubmit` runs **before** mutation; API errors use `formatWizardApiErrorMessage` in `catch` |

`throwInstantiateOrchestratorFailure` maps `hydration_empty` → `TEMPLATE_CANONICAL_EMPTY`; corruption → `DataCorruptionError`; other failures → `TEMPLATE_INSTANTIATE_SILENT_FAILURE` with `details.errors` — distinct codes, not collapsed into empty-template copy.

**Patch applied:** `factoryHydrationErrors` enriches non-`TEMPLATE_CANONICAL_EMPTY` `ApiError` responses so operators do not only see a generic message.

---

## 3. Missing registry paths / overlay allow-list

### Two different allow-lists (common confusion)

| List | Used for |
|------|----------|
| `DENALI_MODERN_SETTINGS_OVERLAY_STORAGE_PATHS` | Settings **left panel** flat seeds + overlay grid |
| `DENALI_FIELD_DEFINITIONS` / `pruneDenaliWizardFormToRegistry` | Tour create wizard **draft** + **submit** |

### Tour create wizard (`/tours/new`)

- Draft PATCH: `sanitizeDenaliWizardDraftSnapshot` → **registry prune** (not overlay).
- Non-registry RHF paths are **silently dropped** on draft sync/submit — by design.
- Registry fields **not** on the overlay list (e.g. `meetingPoint`, `publishStatus`) are **kept** in the tour wizard.

### Settings builder Save

| Source | Dropped on save? |
|--------|------------------|
| Left panel only | Only paths in overlay form seeds → packed via `packCanonicalFormValuesToTemplateData` |
| Preview panel (classified `tourType`) | Full Layer A via `denaliCanonicalFromForm` → `packTemplateCanonicalForPersist` |
| Save pipeline bug (fixed) | Passing nested canonical into `buildTourWizardTemplatePayloadFromForm` **re-packed** flat `values.canonicalData` and could drop preview-only keys — **patch:** `canonicalLayerA` option bypasses re-pack |

Fields **only** editable in preview (not on overlay list) **are** persisted when preview is classified and Save uses `canonicalLayerA`.

---

## Patches applied

1. **`WorkspaceTourWizard.tsx`** — Re-hydrate when `manualWizardMode` flips (template empty ↔ seeded).
2. **`WorkspaceTourWizard.tsx`** — Richer factory error strings for non-empty-template API failures.
3. **`tour-wizard-template-builder-form.ts`** + **builder UI** — `canonicalLayerA` on save so preview merge is not stripped.
4. **`tour-wizard-template-builder-form.persist.spec.ts`** — Regression test for preview itinerary through save payload.

---

## Optional follow-ups (not implemented)

- **Opt-in auto-seed:** Gate `ensureMinimalTemplateSeed` behind explicit Settings “Apply defaults” instead of every instantiate.
- **Settings unsaved preview:** Dirty banner (see data-integrity audit).
- **Semantic template completeness:** Require `category` + `duration` on template PATCH.
ش
---

## References

- `reports/hybrid-wizard-data-integrity-audit.md`
- `apps/web/tests/audit/hybrid-wizard-data-integrity.spec.ts`
- `packages/denali-domain/src/rules/listDenaliSettingsOverlayStoragePaths.ts`
