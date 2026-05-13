# Unified Tour Domain Model — internal RFC

**Maintenance playbook:** [Profile architecture playbook](../PROFILE_ARCHITECTURE_PLAYBOOK.md) (checklists for new profiles/fields and do’s/don’ts).

**Status:** stable (Phases A → C landed; Phase D enumerated in §Open work below)
**Owners:** Tour Wizard / Tour Edit area
**Last updated:** 2026-05

---

## 1. Problem statement

The tour module previously carried **two parallel classification axes** for the same row, drifting in three layers:

- **`TourType`** — a small commercial enum (`mountain`, `city`, `nature`, `cultural`, `camp`, `desert`, `other`) persisted on `tours.tour_type`. It drives one server-side gate (`apps/api/src/modules/tours/utils/tour-type-gates.ts`).
- **`EventKind`** — a derived legacy classification (`generic` | `mountain` | `cultural` | `city_tour` | `workshop`) computed by `resolveEventKindFromTourContext`. Used only by the legacy `tour-create-trip-details-fields.tsx` widget and the SSR-no-catalog fallback path in `TourForm.tsx`. The Edit-side trip-details matrix (`apps/web/src/features/tours/config/tripDetailsFieldConfig.ts`) is **profile-keyed** (`TourFormProfile`) since Phase P6.
- **`TourFormProfile`** — the wizard's classification (`general` | `mountain_outdoor` | `nature_trip` | `urban_event` | `cinema_event` | `cultural_tour`), persisted on `tours.form_profile_snapshot`. Drives every wizard rule and the server's `tripDetails` strip.

Symptoms before the unification:

- Wizard and Edit disagreed on field visibility / required-ness for the same row when the workspace theme's `form_profile` did not match the legacy `EventKind` resolution.
- Three parallel "inactive groups per profile" tables (web wizard, web edit-strip, server-strip).
- `tours.form_profile_snapshot` was only written at create-time, so the persisted "what strip rules apply to this row" lied after any meaningful edit.
- Adding a new profile required touching 4+ files with no compiler help — easy to forget the server side, easy to forget the wizard's "inactive group" mirror.

## 2. Solution / architecture overview

`TourFormProfile` is **the** canonical classification axis. We added a **canonical alias** with intent-revealing helpers in `@repo/types` and shifted Wizard, Edit, and server to read from it via three thin layers:

1. **Domain layer** — `packages/types/src/tour-domain-profile.ts` and `tour-domain-profile-bridge.ts`. Defines `TourDomainProfile` (= `TourFormProfile` as a typed alias), provides the only sanctioned projection to legacy `EventKind` (`eventKindForDomainProfile`), and owns shared profile-specific data tables (e.g. `URBAN_LOGISTICS_WHITELIST_KEYS`).
2. **Wizard rules layer** — `apps/web/src/features/tours/wizard/profileRules/`. A declarative `BASE_FIELD_RULES` table is the single source of truth for **field visibility, required-ness, and step-rail visibility** per profile. `getProfileRules` / `getStepRule` / `getFieldRule` are the public reads. Validation lives in `validation.ts` and exposes three explicit levels (autosave / step-nav / submit).
3. **Edit adapter layer** — `apps/web/src/features/tours/domain/tourDomainProfileAdapters.ts`. Centralizes Edit's classification reads through one set of symbols (`domainProfileFromEditFormValues`, `dualClassificationForEditForm`, deprecated-but-retained `legacyEventKindFromEditFormValues`). The Edit Zod resolver and trip-details panel route through this adapter so all `EventKind` consumers can be migrated together in Phase D.

The server resolves the same `TourDomainProfile` from persisted `tripDetails` via `resolveTourFormProfileFromTripDetails` and applies the same strip rules.

## 3. Canonical sources of truth — file map

| Concept | Canonical module | Notes |
|---|---|---|
| Closed set of classifications | `packages/types/src/tour-form-profile.ts` (legacy name) + `tour-domain-profile.ts` (canonical alias) | `TOUR_DOMAIN_PROFILE_VALUES` is the iterator |
| `TourType` → default classification fallback | `packages/types/src/tour-domain-profile.ts:domainProfileFromTourTypeFallback` (alias of `defaultTourFormProfileForTourType`) | Used when no theme is picked |
| `TourDomainProfile` → legacy `EventKind` (the one sanctioned projection) | `packages/types/src/tour-domain-profile-bridge.ts:eventKindForDomainProfile` | Total, many-to-one, lossy by design |
| Declarative profile descriptor (structural axis) | `packages/types/src/tour-form-profile-descriptors.ts:TOUR_FORM_PROFILE_DESCRIPTORS` | Phase P10 — encodes inactive wizard groups, FA display keys, default `TourType`, server strip deltas, and invariant hints; parity tests keep consumers aligned |
| Wizard field rules (visibility / required) | `apps/web/src/features/tours/wizard/profileRules/rules.ts:BASE_FIELD_RULES` | Read via `getProfileRules` / `getStepRule` / `getFieldRule` from `getProfileRules.ts` |
| Wizard inactive groups per profile | `getInactiveFieldGroupsForProfile` in `apps/web/src/features/tours/wizard/fieldGroups.ts` (reads `TOUR_FORM_PROFILE_DESCRIPTORS[profile].inactiveFieldGroups`) | The rules layer reads this; parity tests pin the descriptor ↔ web rail contract |
| 3-level wizard validation | `apps/web/src/features/tours/wizard/profileRules/validation.ts` | `validateForAutosave` / `validateForStepNavigation` / `validateForSubmit` |
| Edit-side classification reads | `apps/web/src/features/tours/domain/tourDomainProfileAdapters.ts` | One symbol per derivation: do not branch on `EventKind` outside this adapter |
| Mountain-only Edit gate | _(retired in Phase 5 — the legacy `policies/tour-kind-policy.ts` shim was deleted; use `domainProfileFromEditFormValues(...) === "mountain_outdoor"` for any future call site)_ | n/a |
| Server: resolve persisted profile | `apps/api/src/modules/tours/utils/create-tour-form-profile-strip.ts:resolveTourFormProfileFromTripDetails` | Used for both create and PATCH |
| Server: strip persisted `tripDetails` per profile | same file, `stripTripDetailsForFormProfile` (reads `TOUR_FORM_PROFILE_DESCRIPTORS[profile].strip`) | For PATCH, called from `ToursService.applyTourFormProfileStripToPersistedTripDetails` which also refreshes `formProfileSnapshot` (invariant I-8) |
| Server: `urban_event` logistics whitelist | `packages/types/src/tour-domain-profile.ts:URBAN_LOGISTICS_WHITELIST_KEYS` (also referenced from the descriptor row's `strip.logisticsWhitelist`) | Shared by `apps/web/.../stripTourFormTripDetailsForProfile.ts` and `apps/api/.../create-tour-form-profile-strip.ts` |
| Server: mountain-only field gate (profile-native) | `apps/api/src/modules/tours/utils/tour-type-gates.ts:applyMountainOverviewFieldGatesForFormProfile` (reads `TOUR_FORM_PROFILE_DESCRIPTORS[profile].invariants.mountainOverviewKeysToStripFromOverview`) | _Phase P4 closed — legacy `applyTourTypeFieldGates(td, tourType)` retired; all write paths resolve `TourFormProfile` first and call this function._ |

## 4. Invariants — what the test suite pins

| ID | Statement | Pinned by |
|---|---|---|
| I-1 | `eventKindForDomainProfile` is total over `TOUR_DOMAIN_PROFILE_VALUES` | `packages/types/src/tour-domain-profile-bridge.spec.ts` |
| I-2 | `domainProfileFromTourTypeFallback` is the runtime alias of `defaultTourFormProfileForTourType` (reference-identical) | same spec |
| I-3 | Every field in an inactive group for a profile has `visibility: "hidden"` and is never reported as required at submit (full cross-product sweep) | `apps/web/.../profileRules/profileRules.spec.ts` |
| I-4 | Autosave never reports a required-field error on any profile (cross-product sweep) | same spec |
| I-5 | `validateForStepNavigation` only reports paths that belong to the step | `apps/web/.../profileRules/validation.spec.ts` |
| I-6 | `dualClassificationForEditForm.agrees === true ⇒ projectedEventKind === legacyEventKind` | `apps/web/.../domain/tourDomainProfileAdapters.spec.ts` |
| I-7 | Server `URBAN_LOGISTICS_WHITELIST` is exactly `@repo/types.URBAN_LOGISTICS_WHITELIST_KEYS` (no drift) | `apps/api/.../create-tour-form-profile-strip.spec.ts` |
| I-9 | `TOUR_FORM_PROFILE_DESCRIPTORS` is total over `TOUR_FORM_PROFILE_VALUES` and matches wizard inactive groups + urban strip whitelist + mountain gate flags | `packages/types/src/tour-form-profile-descriptors.spec.ts` + `apps/web/.../profileRules/parity-with-server.spec.ts` + `apps/api/.../create-tour-form-profile-strip.spec.ts` (P10 probes) |
| I-8 | After PATCH that touches `tripDetails`, `tour.formProfileSnapshot` equals `resolveTourFormProfileFromTripDetails(tripDetails, tourType)` | _Documented_ — the helper `ToursService.applyTourFormProfileStripToPersistedTripDetails` writes it; private method, DI-heavy. Phase D will extract a pure helper and pin this in a spec |
| (parity) | Wizard's `urban_event` hides logistics; server's strip retains exactly the whitelist; `cinema_event` retains logistics. | `apps/web/.../profileRules/parity-with-server.spec.ts` |

## 5. How Wizard uses the model

- Step shell (`apps/web/src/components/tours/wizard/TourCreateWizard.tsx`) resolves `TourDomainProfile` via `TourWizardProfileContext`, then:
  - Builds the step rail from `getVisibleStepIds(profile)`.
  - Step components consume `useFieldRule(path)` and never branch on the profile literal.
  - Step navigation: `validateForStepNavigation(profile, stepId, formValues, visibleSteps)`.
  - Autosave: `validateForAutosave(profile, stepId, formValues)` — permissive, shape-only.
  - Submit: `validateForSubmit(profile, formValues)` — strict.

- The only legacy bridge still in the wizard is the mutable Zod-flag singleton in `apps/web/src/components/tours/wizard/schemas/tourCreateValidationPolicy.ts`. Its **inputs** now derive from the rules layer (Phase B), but the singleton itself is marked deprecated; Phase D will replace it with direct `getStepRule` calls.

## 6. How Edit uses the model

- `apps/web/src/components/tours/TourForm.tsx` runs all classification reads through `tourDomainProfileAdapters.ts`:
  - The Zod resolver always routes through `domainProfileFromEditFormValues(...)` (since Phase P7 — the `useUnifiedTourDomainProfileForEditResolver` flag is ON by default; the legacy path is reachable only via the `LEGACY_EDIT_RESOLVER_ENABLED` kill switch, retained for one cycle).
  - `legacyEventKindFromEditFormValues` is now only called by `dualClassificationForEditForm` for drift telemetry (`agrees` boolean) — scheduled for removal alongside the kill switch in Phase P8.
  - The flat form pushes wizard-style validation flags via `setTourFlatFormProfileValidationFlags(tourFormProfileToWizardValidationFlags(profile))` — same mutable singleton, same canonical inputs.

- The `tripDetailsFieldConfig.ts` matrix was rebased onto `TourFormProfile` in **Phase P6** (promptq.md). The adapter (`tripDetailsFieldConfigAdapter.ts`) no longer round-trips through `eventKindForDomainProfile`; the wizard rules layer (`getFieldRule`) overlays profile-aware visibility/requiredness on the profile-keyed base. **Phase P12** then folded the `"recommended"` tri-state into the wizard rules: `FieldRule.required` now supports `"required" | "recommended" | "optional" | "forbidden"`, and the descriptor's `edit.tripDetailsPresetOverrides` rows tagged `"recommended"` are propagated into `PROFILE_FIELD_REQUIRED_OVERRIDES` in `rules.ts`. The tier is **non-blocking at every validation level** (`isFieldRequiredAtLevel` returns `false` for `"recommended"`); the Edit adapter forwards it through to `TripDetailsFieldConfig.requiredness`. **Phase P15** split the former monolith: `editFieldRbac.ts` (RBAC), `editCoreFieldConfig.ts` (`core.*` capacity), and a slimmed `tripDetailsFieldConfig.ts` (trip-details matrix + backward-compat re-exports). New spec `editTripDetailsWizardPathDivergence.spec.ts` catalogues every Edit matrix id as either an exact `BASE_FIELD_RULES` path, a documented alias to a wizard path, or legitimately Edit-only inventory — **physical deletion** of `tripDetailsFieldConfig.ts` remains blocked on a **path-namespace convergence** slice between the legacy `tripDetails.*` RHF shape and `TourCreateFormValues`, not on a naive append to `BASE_FIELD_RULES` alone.

## 7. How the server uses the model

- Create path: `resolveTourFormProfileForCreateDto` → `stripCreateTourDtoForFormProfile` → `assertTripDetailsForFormProfile` → persist + write `tours.form_profile_snapshot`.
- PATCH path: `ToursService.applyTourFormProfileStripToPersistedTripDetails` calls the same resolve+strip pair on merged `tripDetails`, **and refreshes `tours.form_profile_snapshot`** (Phase B / invariant I-8). PATCHes that don't touch `tripDetails` leave the snapshot alone (correct — the underlying classification can't have changed).
- Strip data: server reads `URBAN_LOGISTICS_WHITELIST_KEYS` from `@repo/types`. Adding a new profile-specific strip table means **adding it next to that constant in `tour-domain-profile.ts`**, then importing from both web and api.

## 8. Where to add new rules — decision tree

| You want to … | Add it to … |
|---|---|
| Express that a field is required / hidden for a given profile | `BASE_FIELD_RULES` in `apps/web/src/features/tours/wizard/profileRules/rules.ts` |
| Express that an entire wizard step is hidden for a profile | `getInactiveFieldGroupsForProfile` in `apps/web/src/features/tours/wizard/fieldGroups.ts` |
| Express a profile-specific server strip rule | `@repo/types/src/tour-domain-profile.ts` (data) + `apps/api/.../create-tour-form-profile-strip.ts` (apply) + web-side mirror in `apps/web/.../stripTourFormTripDetailsForProfile.ts` |
| Express a profile-specific Zod refinement for the wizard | extend `TourCreateWizardValidationFlags` in `tourCreateValidationPolicy.ts` and derive the new flag from `getStepRule`/`getFieldRule` (do **not** re-introduce `profile === "..."` literals) |
| Read the classification in Edit | `domainProfileFromEditFormValues` / `dualClassificationForEditForm` in `tourDomainProfileAdapters.ts` |
| Project to the legacy `EventKind` (only the `tour-create-trip-details-fields` widget and the SSR-no-catalog fallback need this since Phase P6) | `eventKindForDomainProfile` in `@repo/types`. **No new direct calls to `resolveEventKindFromTourContext`** |

## 9. Deprecated helpers (do not introduce new callers)

| Helper | Replacement |
|---|---|
| `resolveEventKindFromTourContext` outside `tourDomainProfileAdapters` and the no-catalog fallback in `TourForm.tsx` | `eventKindForDomainProfile(domainProfileFromEditFormValues(...))` |
| `legacyEventKindFromEditFormValues` (new call sites — none allowed since Phase P7; existing use is drift telemetry only) | `eventKindForDomainProfile(domainProfileFromEditFormValues(...))` |
| `setTourFlatFormProfileValidationFlags` / `resetTourFlatFormProfileValidationFlags` (new call sites only) | Direct `getStepRule` / `getFieldRule` reads in Edit (Phase D will retire the bridge entirely) |
| `apps/web/src/features/tours/config/tripDetailsFieldConfig.ts` — adding new behavior | Prefer `BASE_FIELD_RULES` when the wizard path is identical. When the Edit widget uses a **different dotted id** than the wizard (see `editTripDetailsWizardPathDivergence.spec.ts`), either add an explicit alias in the adapter in a future convergence slice, or classify the new id as Edit-only inventory in that spec. Always add a regression assertion in `tripDetailsFieldConfig.spec.ts`. |

## 10. Rollout flags

The unified-domain plan introduced exactly two behavior shifts that are worth gating
during rollout. Every other change is either additive (new types/adapters), pure
refactor (rules-layer derivation that produces byte-identical output), or dedup
(shared constants) — none of these require flags because there is no parallel
behavior to fall back to.

| ID | Flag | Module | Env var(s) | Default | Effect when **ON** |
|---|---|---|---|---|---|
| **F-1** | `useUnifiedTourDomainProfileForEditResolver` | `apps/web/lib/config/feature-flags.ts` | `NEXT_PUBLIC_UNIFIED_TOUR_DOMAIN_PROFILE_FOR_EDIT_RESOLVER` (preferred) / `UNIFIED_TOUR_DOMAIN_PROFILE_FOR_EDIT_RESOLVER` | **OFF** | Edit Zod resolver in `TourForm.tsx` routes through `domainProfileFromEditFormValues → eventKindForDomainProfile` whenever a theme catalog is loaded. The catalog-not-loaded path is identical to the OFF state. Observable difference is bounded to the `agrees: false` subset (workspace theme override). |
| **F-2** | `shouldRefreshFormProfileSnapshotOnPatch` | `apps/api/src/modules/tours/tours-feature-flags.ts` | `TOURS_REFRESH_FORM_PROFILE_SNAPSHOT_ON_PATCH` | **OFF** | `ToursService.applyTourFormProfileStripToPersistedTripDetails` writes the freshly-resolved `TourDomainProfile` back to `tours.form_profile_snapshot` after each strip pass and logs `tour.form_profile_snapshot.refreshed`. With the flag OFF, the snapshot is left untouched on PATCH (pre-rollout behavior). The strip itself is **not gated** — it runs in both modes. |

Reading model: both flags are read at the call site every time. There is no caching
layer, so a config change takes effect immediately after pod/process restart. No
migration is needed for either flag.

What is **deliberately not flagged** (and why):

- The rules-layer derivation in `tourCreateValidationPolicy.tourFormProfileToWizardValidationFlags`
  is byte-identical to the prior hardcoded mapping for every known profile (pinned by
  `tourCreateValidationPolicy.spec.ts`). Gating it would mean re-introducing the old
  literal as dead code — strictly worse than the rules-layer derivation it would
  silently fall back to.
- The shared `URBAN_LOGISTICS_WHITELIST_KEYS` constant — same values as the prior
  local copies; flag would be a no-op.
- The new `TourDomainProfile` alias and `tourDomainProfileAdapters` — pure additive
  type/adapter surfaces, no runtime branch to gate.

## 11. Observability (structured logs)

### Web (`apps/web`)

| Event | When | Grep / field | Gate |
|---|---|---|---|
| `wizard_rules_validation_failed` | Rules-layer `validateForStepNavigation` or `validateForSubmit` (or future autosave) returns issues | `[tour_profile_obs]` prefix, JSON body | **Dev default ON** for wizard failures; prod requires `NEXT_PUBLIC_TOUR_PROFILE_OBSERVABILITY=1` |
| `edit_domain_classification_drift` | Edit dual classification `agrees === false` | same prefix | **Prod requires** `NEXT_PUBLIC_TOUR_PROFILE_OBSERVABILITY=1` only (avoids noise) |
| `edit_save_http_400` | Edit save throws `ApiError` with status 400 | same prefix | Same as drift |

Guardrails: only **failure / drift** paths; **2s dedupe** on identical `(level, profile, step, issue_paths)` signatures for wizard step spam.

### API (`apps/api`)

| Event | When | Logger message key |
|---|---|---|
| `tour_profile_invariant_rejected` | `BadRequestException` from create invariants, persisted trip-details assert, or incoming PATCH fragment assert | `tour.profile_invariant_rejected` |

Guardrails: only on **400 rejection** paths (low volume by definition). Payload includes `op`, `tenant_id`, `tour_id` (when known), `resolved_form_profile`, `error_code`, `error_message`.

## 12. Open work (Phase D and beyond) — **closed in P1–P11**

> The "Phase D" items in this RFC were re-tracked as **P1–P11** in `promptq.md` and have all landed (P10 first-pass + P11). The list below is preserved for archaeology; current status is recorded inline. See [`ADR-tour-profile-closure.md`](./ADR-tour-profile-closure.md) for the formal closure decision.

1. ~~**Rebase `tripDetailsFieldConfig.ts` over `ProfileRules`**~~ — **Closed** (P6 first-pass + P12 `"recommended"` fold-in + **P15 module split + path-divergence catalog**). The Edit matrix is now keyed by `TourFormProfile` directly; the adapter layers `getFieldRule` on top; the `"recommended"` tier lives in `FieldRule.required` and the descriptor's preset rows propagate into it. The remaining sub-step before the trip-details matrix **file** can be deleted is an **L-sized path-namespace convergence** between `tripDetails.*` Edit ids and `TourCreateFormValues` wizard paths (checklist: `editTripDetailsWizardPathDivergence.spec.ts`), not a mechanical `BASE_FIELD_RULES` append. Closes M-3 base axis + M-9 tri-state tier.
2. ~~**Retire the mutable validation-flag singleton** in `tourCreateValidationPolicy.ts`~~ — Edit calls `getStepRule` / `getFieldRule` directly; the wizard schema reads flags off the rules layer (no hidden global remains in the resolver path).
3. ~~**Mountain-only server gate** flip from `TourType === "mountain"` to `TourDomainProfile === "mountain_outdoor"`~~ — **Closed** (P4). `applyTourTypeFieldGates` was deleted; the surviving function is `applyMountainOverviewFieldGatesForFormProfile` and (since P10+) it reads `TOUR_FORM_PROFILE_DESCRIPTORS[profile].invariants.mountainOverviewKeysToStripFromOverview` (empty for `mountain_outdoor`, canonical list for all other profiles).
4. ~~**Single strip implementation**~~ — **Closed** (P10 + P14). Both web `sanitizeInactiveRootsForProfile` / `stripInactiveTourCreateGroupsForProfile` and server `stripTripDetailsForFormProfile` now read the same `TOUR_FORM_PROFILE_DESCRIPTORS[profile].strip` deltas. The two physical strip functions remain (one over RHF values, one over persisted JSON) because their input shapes differ, but the **data** they read from is unified. After P14, even the canonical `MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS` tuple lives inside the descriptor module — `trip-details-inventory-policy.ts` is now a re-export shim — so the descriptor is the unambiguous single source for every mountain policy decision.
5. ~~**Extract `applyTourFormProfileStripToPersistedTripDetails` into a pure helper**~~ — Open as a tactical cleanup; not a correctness issue (`I-8` is documented but not in a spec yet). Tracked separately from the profile-axis closure.
6. ~~**Edit update mapper writes `transportModes`**~~ — **Closed** (P3). `updateTourDtoFromTourFormValues` now emits the canonical write contract including `formProfile`; the root `transportModes` follows the profile descriptor's `clearsRootTransportModes` flag on the server side.

## 12a. Status — closed items (Phase D / P1–P11 retrospective)

| Item | Phase | Status |
|---|---|---|
| **D1** — Edit matrix off `EventKind` | P6 + P12 + P15 + P16 | **Closed** (P6 first-pass + P12 tier fold-in + P15 split + P16 adapter alias pilot). Residual: graduate the remaining ~10 documented aliases (one row per slice), then delete `tripDetailsFieldConfig.ts` entirely. |
| **D2** — Retire `legacyEventKindFromEditFormValues`; flip Edit resolver flag | P7 | **Closed** (flag default ON; emergency kill switch retained for one cycle; symbol reclassified to drift telemetry only). |
| **D3** — Delete `domainProfileFromEventKindBestEffort` | P5 | **Closed** (symbol + exports + lint + fitness CI all aligned). |
| **D4** — Narrow `EventKind` surface in `@repo/types` | P8 | **Closed** (`Legacy` namespace; top-level shims `@deprecated` for one cycle; ESLint enforces namespace use). |
| Doc hygiene (`tour-kind-policy` stale references) | P1 | **Closed**. |
| Architecture fitness CI | P2 | **Closed** (`scripts/check-tour-domain-guardrails.mjs` + `fitness.spec.ts`). |
| Web Edit `UpdateTourDto.formProfile` | P3 | **Closed**. |
| Server mountain-only field gate becomes profile-native | P4 | **Closed** (function inlined; legacy helper removed). |
| Profile-first write adoption + observability | P9 | **Closed for first-party callers** (adoption metric via `tour.form_profile_resolution`; partner callers still allowed to omit). |
| Declarative profile descriptor | P10 | **First-pass closed** (`TOUR_FORM_PROFILE_DESCRIPTORS` + parity specs; optional UI-literal fold-in deferred). |
| Current-state diagram + ADR | P11 | **Closed** (this section + [`tour-profile-current-state.md`](./tour-profile-current-state.md) + [`ADR-tour-profile-closure.md`](./ADR-tour-profile-closure.md)). |

## 13. Architecture guardrails

The conventions and the lint rules that prevent regressions live in a paste-ready
companion page: **[`tour-profile-guardrails.md`](./tour-profile-guardrails.md)**. That
file is the recommended internal Architecture Guidelines entry; this RFC is the
"why / what / how" reference behind it.

In short:

- ESLint overrides in `apps/web/.eslintrc.json` forbid wizard scope (`src/components/tours/wizard/**`,
  `src/features/tours/wizard/**`, `app/(app)/tours/new/**`, `app/(app)/tours/create/**`)
  from importing `EventKind` / legacy resolvers / the Edit-side `tripDetailsFieldConfig`.
  The current tree has zero such imports — the rule fails closed on the next regression.
  (The Phase 5 `tour-kind-policy` shim has been deleted from the codebase, so no lint rule
  is needed for it.)
- A recipe block at the top of `apps/web/src/features/tours/wizard/profileRules/rules.ts`
  walks new contributors through adding a profile-aware field without re-introducing
  inline `profile === "..."` branching.
- Server code has no ESLint, but the canonical-strip data lives in `@repo/types` and the
  parity spec `apps/web/src/features/tours/wizard/profileRules/parity-with-server.spec.ts`
  catches any new web/server drift on the strip whitelist.
