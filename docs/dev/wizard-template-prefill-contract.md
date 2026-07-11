# Wizard template prefill contract

Tenant `wizard_template` overlays the workspace field catalog. Create-wizard draft seeding follows a fixed precedence so template defaults and workspace bootstrap never fight silently.

## Precedence (low → high)

| Layer | Source | Wins over |
| ----- | ------ | --------- |
| L0 | `emptyTourWizardDraft()` / `emptyDenaliTourWizardDraft()` | — |
| L1 | Template `field.defaultValue` + `seedLabel` (`applyWizardTemplatePrefillToDraft`) | L0 |
| L2 | Workspace bootstrap fallback (`applyDenaliWizardBootstrapFallback`) | L0 only where L1 left path empty |
| L3 | URL preset (`?preset=`) | empty paths only; title uses workspace seed path (`resolveWizardTemplateSeedCanonicalPath`); theme only when `program.themeIds` is in registry |
| L4 | Clone hydrate (`?clone=`) | replaces L0–L3 |
| L5 | Remote draft resume | merge policy |

`?clone=` intentionally skips template prefill (tour data is authoritative).

## Typed defaults

- Settings wire `defaultValue` as `string`; runtime coerces via `coerceWizardTemplateDefaultValue` using `WorkspacePlugin.fieldRegistry` `kind`.
- Arrays (`program.themeIds`, `leaderUserIds`, …): JSON array or comma-separated UUIDs.
- Booleans: `"true"` / `"false"` stored as canonical strings.
- Numbers: digit string at canonical path.

## Bootstrap fallback (Denali)

Only when canonical path is **empty after L1**:

- `category` → `mountain_day`
- `participants.fitnessLevel` → `medium`

Template `defaultValue` for these paths must apply before bootstrap (INV-WIZ-010).

## Visibility coherence

After L1 **and on remote hydrate / 409 merge**, paths with `fieldRulesOverlay.visibility === "hidden"` are cleared from draft so operators do not carry invisible values (`pruneFieldRulesHiddenDraftValues`).

## Ghost paths

`duration`, `eventVariant`, `summitPoint`, `campPoint`, `endPoint` are not template-configurable; UI derives them from anchors (`category`, `startPoint`).

API `PUT /settings/config/wizard_template` rejects published steps that reference ghost paths with `SETTINGS_WIZARD_GHOST_PATH` (Denali workspace only).

## PUT validation (INV-WIZ-012)

Published `wizard_template` payloads are validated at save time:

| Code | Rule |
| ---- | ---- |
| `SETTINGS_WIZARD_INVALID_DEFAULT` | `field.defaultValue` must coerce via registry `kind` (`coerceWizardTemplateDefaultValue`); enum values must be in `enumOptions` |
| `SETTINGS_WIZARD_UNKNOWN_OVERLAY_PATH` | `fieldRulesOverlay` keys must exist in workspace catalog, field registry, or Denali overlay storage paths (`listDenaliSettingsOverlayStoragePaths`) |

Runtime prefill uses the same coercion module (`@app-tour/workspace-sdk/wizard`) so PUT and create-wizard stay aligned.

## Composite child defaults (INV-WIZ-013)

Denali composite anchors (`participants.minimumAge`, `transport.mode`, `program.themeIds`, `pricing.requiresPayment`, `tripDetails.logistics.includedServices`) may carry **hidden** child rows in `steps[]` with `defaultValue` for dependents (`participants.fitnessLevel`, `transport.transportCost`, …). Children:

- Are omitted from the Settings palette but allowed on PUT when the anchor is on the same step
- Prefill via `buildWizardTemplateFieldOverlays` (hidden rows included for L1)
- Stay out of the render plan (`hidden: true`); composites read canonical draft paths

Settings UI exposes per-child default inputs under each composite anchor.

## Engine plan parity (INV-WIZ-014)

Published template **visible** fields must exist in the workspace engine render plan at **baseline matrix dimensions** (Denali: `mountain` × `single_day` via `resolveWizardTemplateParityBaselineDimensions`). Template is an overlay on the engine — not a second field catalog.

| Surface | Behavior |
| ------- | -------- |
| PUT API | `SETTINGS_WIZARD_ENGINE_PLAN_GAP` when a visible template field is absent from baseline `buildRenderPlan` |
| Create wizard host | Blocking banner when `listWizardTemplateEnginePlanSyncErrors` is non-empty (current draft dimensions) |
| Denali flat edit | Same blocking banner in `denali-flat-edit-form.tsx` before field sections render |
| Settings full preset | `filterWizardTemplateStepsToEnginePlan` prunes fields absent from baseline engine plan before apply |
| Settings save UX | Maps `SETTINGS_WIZARD_ENGINE_PLAN_GAP` to operator-facing message (`path`, `stepId`) |
| Shared logic | `@app-tour/workspace-sdk/wizard` (`findWizardTemplateRenderPlanGaps`, `listWizardTemplateEnginePlanSyncErrors`) |

**Exceptions (not parity errors):** `hidden: true` composite child rows (INV-WIZ-013); host-injected `review` / `publishStatus` (INV-WIZ-002).

## Invariants

| ID | Rule |
| -- | ---- |
| INV-WIZ-008 | `defaultValue` prefills when path empty; `seedLabel` wins on title |
| INV-WIZ-010 | Template prefill (L1) runs before workspace bootstrap (L2) |
| INV-WIZ-011 | Ghost paths rejected on PUT; gate coherence on resume; preset title uses workspace seed path |
| INV-WIZ-012 | PUT validates `defaultValue` coercion; overlay keys must be known paths |
| INV-WIZ-013 | Denali composite hidden child `defaultValue` on PUT + L1 prefill; anchor deselect prunes children |
| INV-WIZ-014 | Published template visible fields ⊆ baseline engine plan; PUT `SETTINGS_WIZARD_ENGINE_PLAN_GAP`; create host + Denali flat edit blocking sync banner; Settings full preset prunes non-engine fields |
