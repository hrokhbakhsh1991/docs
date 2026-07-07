# Denali destination catalog — Settings metadata and wizard prefill

## Intent

Operator **Settings → Locations → Destinations** stores optional metadata per destination row. When an operator picks a destination in the tour wizard, Denali may **prefill** related canonical fields — only when those fields are still empty.

Semantics live in the **Denali workspace**; the platform API stores neutral optional columns on `workspace_destinations`.

## Location types (Denali-owned)

| `locationType` | Label (FA) | Optional Settings field | Wizard canonical prefill |
| -------------- | ---------- | ----------------------- | ------------------------ |
| `peak` | قله / کوهنوردی | `altitudeM` (meters) | `tripDetails.overview.peakHeight` |
| `nature_trail` | طبیعت‌گردی / مسیر | `typicalTrailDistanceKm` (km) | `tripDetails.overview.trailDistanceKm` |
| `generic` | عمومی | — | — |

Constants: `packages/workspaces/denali/src/settings/destination-location-types.ts`

## Platform storage

`workspace_destinations` columns (tenant RLS):

- `location_type` — free text; Denali UI restricts to known values
- `altitude_m` — optional positive integer
- `typical_trail_distance_km` — optional positive number (km; migration `20260624120000`)

API: `GET/POST/PATCH /settings/resources/locations` — see `SETTINGS-MODULE-REGISTRY.md` §3.9.

## Prefill contract

Implementation: `applyDestinationCatalogPrefill` in Denali workspace.

1. **Catalog-authoritative on pick** — when the selected destination row already has metadata in Settings, the wizard field is set from catalog and rendered **read-only** (`disabled`).
2. **Editable gap-fill** — when catalog metadata is empty, the wizard field stays empty and editable; on valid entry the workspace **PATCH**es the destination row (`altitudeM` or `typicalTrailDistanceKm`) via the existing locations BFF.
3. **Type-aware** — `peak` → `peakHeight` ↔ `altitudeM`; `nature_trail` → `trailDistanceKm` ↔ `typicalTrailDistanceKm`.
4. **Tour-category gate (rule-engine SSOT)** — catalog prefill and review rows call `isDenaliWizardFieldVisibleOnDraft`, which delegates to `evaluateFormFieldRule` (matrix + contextual rules). Destination `locationType` selects *which* Settings column binds; tour category selects *whether* the field is visible — no duplicated `tourCategory` on catalog bindings.
5. **Destination change** — re-apply catalog metrics for the new pick (set + lock when catalog has value; clear when catalog lacks value for that type), subject to rule-engine visibility on `denali_basic`.
6. **Itinerary segment picks** — only set segment `locationLabel`; no tour-level prefill.

Helper: `packages/workspaces/denali/src/wizard/denali-wizard-field-visibility.ts` (`isDenaliWizardFieldVisibleOnDraft`).

UI composite: `denali.destination-catalog-metric` (Denali workspace only; no platform-core / API schema changes).

## Out of scope

- Making type or metadata required in Settings or API
- Changing `denaliRuleSet` visibility based on catalog `locationType` alone (category matrix still drives step-1 visibility)
