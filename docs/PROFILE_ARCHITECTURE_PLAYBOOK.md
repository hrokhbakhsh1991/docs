# Tour profile / kind — maintenance & evolution playbook

**Audience:** engineers adding profiles, fields, or profile-dependent behavior across Wizard, Edit, and API.

**Related docs:**

- [Unified tour domain model (RFC)](./20-architecture/unified-tour-domain-model.md) — problem, layers, decision tree, flags, observability.
- [Profile guardrails (lint + conventions)](./20-architecture/tour-profile-guardrails.md) — what not to do in Wizard scope.

---

## Overview

The tour module uses **`TourFormProfile`** as the canonical classification for tour behavior across Web and API. This is the single source of truth for visibility, required-ness, strip policy, and invariant enforcement.

**`TourDomainProfile`** is a domain-intent alias of `TourFormProfile` (same value set). Prefer it in server/business contexts when the wording “domain profile” is clearer.

**`EventKind`** is a legacy compatibility layer. Keep it only for:

- adapter mapping (projection/bridge),
- legacy payload compatibility surfaces,
- display/telemetry where historic kind values are still needed.

New business behavior must not branch directly on `EventKind`.

**Layers (single direction of truth):**

| Layer | Role | Key paths |
|-------|------|-----------|
| Domain types | Closed set of profiles, defaults, shared tables (e.g. urban logistics whitelist) | `packages/types/src/tour-form-profile.ts`, `packages/types/src/tour-domain-profile.ts` |
| Bridge | `TourDomainProfile` → `EventKind` (one-way projection only) | `packages/types/src/tour-domain-profile-bridge.ts` |
| Wizard rules | Visibility, required-ness, step gating, 3-level validation | `apps/web/src/features/tours/wizard/profileRules/` |
| Edit adapters | Resolve domain profile + dual classification for drift | `apps/web/src/features/tours/domain/tourDomainProfileAdapters.ts` |
| Server strip + invariants | Persisted profile resolution, strip ghost data, assert invariants | `apps/api/src/modules/tours/utils/create-tour-form-profile-strip.ts`, `assert-create-tour-invariants.ts` |

**Wizard guardrails:** ESLint in `apps/web/.eslintrc.json` forbids `EventKind` / legacy resolvers / Edit’s `tripDetailsFieldConfig` inside Wizard paths — see [tour-profile-guardrails.md](./20-architecture/tour-profile-guardrails.md).

---

## Classification Ownership

- **Canonical axis:** `TourFormProfile` / `TourDomainProfile`.
- **Presentation layers:** Wizard and Edit are UI/form presentation layers; they consume profile rules and adapters, they do not define domain truth.
- **Legacy axis:** `EventKind` exists only behind bridge/adapter APIs (`eventKindForDomainProfile`, best-effort reverse mapping) and must not own business rules.

## Validation Ownership

- **Wizard:** profile-driven validation (`profileRules`) owns field visibility and required-ness by level (autosave, step navigation, submit).
- **Edit:** uses profile-resolved schema/config paths; any remaining legacy kind use must be adapter-derived from profile.
- **Server (authoritative):** enforces final domain invariants and strip policy after profile resolution; server acceptance/rejection is the source of truth for persisted correctness.

## Resolver Logic

- **Server create/update precedence** (profile-first; see `create-tour-form-profile-strip.ts`): **(1)** explicit `formProfile` on the DTO when the client sent the field → **(2)** workspace theme row `form_profile` for `tripDetails.overview.tourThemeIds[0]` → **(3)** `defaultTourFormProfileForTourType(tourType)` as compatibility fallback.
- **Create path:** resolve profile → pre-strip guards → strip inactive profile branches → assert invariants.
- **Update path:** merge patch → re-resolve profile from merged state → pre-strip patch guards → strip → assert invariants.
- **Snapshotting:** `formProfileSnapshot` records the resolved canonical profile on persisted tour rows.
- **Adoption telemetry (Phase P9):** successful `POST /tours` emits `tour.form_profile_resolution` with `resolution_source` ∈ `explicit_client` | `workspace_theme` | `tour_type_default` — aggregate in your log pipeline to track explicit `formProfile` adoption.

## External write contract — client adoption (Phase P9)

First-party and partner **write** clients (`POST /api/v2/tours`, `PATCH /api/v2/tours/:id`) SHOULD send **`formProfile`** whenever the UI or BFF has already resolved the canonical `TourFormProfile` (wizard, Edit with loaded theme catalog, or preset-driven flows). The server remains authoritative and will still resolve correctly if `formProfile` is omitted, but **tourType-only writes are discouraged** — they increase reliance on the `tourType` fallback and make drift between commercial category and theme-driven behavior harder to spot in telemetry.

- **Preferred:** set `formProfile` to the same slug the wizard / Edit resolver used for strip + validation.
- **Acceptable:** omit `formProfile` only when the client truly cannot know the profile (e.g. headless import with legacy payloads); document the exception in the integration runbook.
- **Observability:** operators can measure adoption via `resolution_source` on `tour.form_profile_resolution` logs after each successful create.

---

## Adding a new profile — checklist

Use this when you add a literal to `TOUR_FORM_PROFILE_VALUES` **or** introduce a **feature flag / variant** that changes profile behavior (treat the flag like a second axis: document it, test both branches, avoid duplicating rules).

### Step A — Domain

- [ ] **Extend the closed set** in `packages/types/src/tour-form-profile.ts`:
  - Add the string to `TOUR_FORM_PROFILE_VALUES`.
  - If semantics of drafts/snapshots change, bump `TOUR_FORM_PROFILE_VERSION` and document why (see file comment).
- [ ] **Defaults from `TourType`:** extend `defaultTourFormProfileForTourType` if the new profile should be the fallback for a commercial type.
- [ ] **Domain alias:** `TourDomainProfile` / `TOUR_DOMAIN_PROFILE_VALUES` in `packages/types/src/tour-domain-profile.ts` follow `TourFormProfile` automatically — only add new **shared constants** (strip tables, whitelists) next to existing ones (e.g. `URBAN_LOGISTICS_WHITELIST_KEYS` pattern).
- [ ] **Add the descriptor row (Phase P10):** in `packages/types/src/tour-form-profile-descriptors.ts:TOUR_FORM_PROFILE_DESCRIPTORS`. The row encodes everything that previously meant editing 15–30 files:
  - `displayKeyFa: "tours.profiles.<slug>"` — i18n key (the parity spec pins the shape).
  - `defaultTourType` — inverse of `defaultTourFormProfileForTourType`; set when the new profile is the canonical inverse for one of the commercial types, otherwise `null`.
  - `inactiveFieldGroups` — wizard groups that disappear for this profile (read by `getInactiveFieldGroupsForProfile`, which is consumed by both the rules layer and the strip/sanitize functions).
  - `strip.{clearsTripDetailsRoots, itineraryKeysToDelete, logisticsWhitelist, clearsRootTransportModes}` — drives `stripTripDetailsForFormProfile` + `stripCreateTourDtoForFormProfile`. Adding a row that mirrors `urban_event` here is enough to wire the new profile through the server strip path without touching the function bodies.
  - `invariants.{allowsMountainOnlyOverviewKeys, requiresEmptyRootTransportModes}` — read by `applyMountainOverviewFieldGatesForFormProfile` (mountain gate) and `assert-create-tour-invariants.ts`.

  The descriptor parity spec (`packages/types/src/tour-form-profile-descriptors.spec.ts`) and the cross-package parity tests in `apps/web/src/features/tours/wizard/profileRules/parity-with-server.spec.ts` will fail if the new row is missing or drifts from the consumers; fix the descriptor row (not the consumer) when they do.
- [ ] **EventKind bridge:** update `packages/types/src/tour-domain-profile-bridge.ts`:
  - `eventKindForDomainProfile` — map the new profile to the legacy `EventKind` used by Edit/matrix. (The reverse projection `domainProfileFromEventKindBestEffort` was retired in Phase P5; do not reintroduce — resolve the canonical profile directly via the wizard/Edit resolvers.)
- [ ] **Exports:** ensure `packages/types/src/index.ts` re-exports anything new.
- [ ] **Unit tests:** extend `packages/types/src/tour-domain-profile-bridge.spec.ts` (and any profile list exhaustiveness tests).

### Step B — Rules (Wizard)

- [ ] **Inactive field groups / skipped steps:** `apps/web/src/features/tours/wizard/fieldGroups.ts` — `getInactiveFieldGroupsForProfile`, `getSkippedWizardStepsForProfile`, etc., so the new profile’s step visibility matches product intent.
- [ ] **Field rules table:** `apps/web/src/features/tours/wizard/profileRules/rules.ts` — add or adjust rows in `BASE_FIELD_RULES` (recipe at top of file).
- [ ] **Required messages (FA):** `apps/web/src/features/tours/wizard/profileRules/validation.ts` — `REQUIRED_MESSAGES` for any new required field paths.
- [ ] **Validation thresholds:** the three APIs in `validation.ts` consume `FieldRule` / `StepRule`:
  - `validateForAutosave` — minimal; profile-aware but not strict on required-ness.
  - `validateForStepNavigation` — step-scoped required fields.
  - `validateForSubmit` — full profile required set.
- [ ] **Public reads:** use `getProfileRules`, `getFieldRule`, `getStepRule` from `apps/web/src/features/tours/wizard/profileRules/getProfileRules.ts` (do not duplicate tables in components).

### Step C — Wizard (UI + Zod + flow)

- [ ] **Step components:** `apps/web/src/components/tours/wizard/steps/*.tsx` — use `useFieldRule` / `useStepRule` from `apps/web/src/features/tours/wizard/profileRulesReact/` for visibility and required UI; avoid `if (profile === "...")`.
- [ ] **Schema shape:** `apps/web/src/components/tours/wizard/schemas/tourCreateSchema.ts` — structural Zod only; policy required-ness should flow from rules + `tourCreateValidationPolicy.ts`.
- [ ] **Validation flags:** `apps/web/src/components/tours/wizard/schemas/tourCreateValidationPolicy.ts` — extend `TourCreateWizardValidationFlags` if needed; derive from `getStepRule` / `getFieldRule` via `tourFormProfileToWizardValidationFlags` (no new `profile ===` literals here).
- [ ] **Wizard shell:** `apps/web/src/components/tours/wizard/TourCreateWizard.tsx` — autosave / next / submit already call the 3-level API; ensure new steps/fields are covered by rules so navigation and submit stay consistent.
- [ ] **Profile resolution:** if the new profile comes from themes/presets, update `apps/web/src/features/tours/wizard/tourWizardProfileResolve.ts` and any preset/theme DTOs or API contracts.

### Step D — Edit

- [ ] **Classification:** route reads through `apps/web/src/features/tours/domain/tourDomainProfileAdapters.ts` (`domainProfileFromEditFormValues`, `dualClassificationForEditForm`).
- [ ] **Zod resolver:** `apps/web/src/components/tours/TourForm.tsx` — unified profile path is **default ON** (Phase P7); emergency rollback via `LEGACY_EDIT_RESOLVER_ENABLED` env (see `apps/web/lib/config/feature-flags.ts`).
- [ ] **Trip details matrix:** `apps/web/src/features/tours/config/tripDetailsFieldConfig.ts` — since Phase P6 the matrix is keyed by `TourFormProfile` (no `EventKind` round-trip). Add a row to `MOUNTAIN_OUTDOOR_OVERRIDES` (mountain-specific) or extend `NON_MOUNTAIN_HIDDEN_OVERRIDES` as needed; avoid new ad-hoc checks in random components. The wizard `BASE_FIELD_RULES` is still the preferred home for any path that the wizard renders.
- [ ] **Strip on save (client):** if new ghost keys exist for this profile, mirror server strip in `apps/web/src/features/tours/domain/stripTourFormTripDetailsForProfile.ts` and prefer shared keys from `@repo/types` (`URBAN_LOGISTICS_WHITELIST_KEYS` pattern).

### Step E — Server

- [ ] **Resolve persisted profile:** `apps/api/src/modules/tours/utils/create-tour-form-profile-strip.ts` — `resolveTourFormProfileFromTripDetails` / `resolveTourFormProfileForCreateDto` / `resolveTourFormProfileForCreateDtoWithSource` (returns `resolution_source` for adoption logs) if resolution rules change.
- [ ] **Strip:** extend `stripTripDetailsForFormProfile` / `stripCreateTourDtoForFormProfile` for the new profile; **import shared key sets from `@repo/types`**, do not fork tables.
- [ ] **Invariants:** `apps/api/src/modules/tours/utils/assert-create-tour-invariants.ts` — add or adjust `assertTripDetailsForFormProfile` (and related asserts) so rejects match Wizard expectations.
- [ ] **Tour type gates:** `apps/api/src/modules/tours/utils/tour-type-gates.ts` — only when behavior is truly `TourType`-scoped (not profile); prefer profile-based rules when the product axis is “form profile.”
- [ ] **Service wiring:** `apps/api/src/modules/tours/tours.service.ts` — keep strip/assert paths centralized; use `apps/api/src/modules/tours/tours-feature-flags.ts` (`shouldRefreshFormProfileSnapshotOnPatch`) when changing snapshot write behavior.
- [ ] **Observability:** `apps/api/src/modules/tours/tours-profile-observability.ts` — invariant rejections should remain structured and actionable.

### Step F — Tests

| Area | Files to extend |
|------|-------------------|
| Domain / bridge | `packages/types/src/tour-domain-profile-bridge.spec.ts` |
| Wizard rules + invariants | `apps/web/src/features/tours/wizard/profileRules/profileRules.spec.ts`, `validation.spec.ts`, `migratedSteps.spec.ts` |
| Web ↔ API strip parity | `apps/web/src/features/tours/wizard/profileRules/parity-with-server.spec.ts`, `apps/api/src/modules/tours/utils/create-tour-form-profile-strip.spec.ts` |
| Server invariants | `apps/api/src/modules/tours/utils/assert-create-tour-invariants.spec.ts` |
| Edit adapters | `apps/web/src/features/tours/domain/tourDomainProfileAdapters.spec.ts` |
| E2E / smoke (optional) | `apps/web/tests/smoke/*tour-wizard*` |

**Minimum bar for a new profile:** at least one test that asserts inactive groups / visible steps / required fields for that profile, plus parity or strip tests if any new whitelist or strip branch exists.

---

## Adding a new field (same profile) — short path

1. Add `fieldRule("path.to.field", { ... })` in `profileRules/rules.ts` (see recipe comment at top of file).
2. Render with `useFieldRule("path.to.field")` in the step component.
3. Add Zod shape if needed in `tourCreateSchema.ts`; keep “required for submit” in the rules table + `validation.ts` messages.
4. If the field is logistics-like for `urban_event`, check `URBAN_LOGISTICS_WHITELIST_KEYS` in `@repo/types` and update **both** web strip and API strip if it must survive urban strip.
5. Extend `parity-with-server.spec.ts` or API strip spec when server behavior changes.

---

## Do’s and Don’ts

### Do

- Treat **`TourFormProfile` / `TourDomainProfile`** as the canonical axis for new behavior.
- Centralize Wizard policy in **`BASE_FIELD_RULES`** + **`fieldGroups.ts`** + **`validation.ts`**.
- Put **cross-layer constants** (whitelists, shared literals) in **`packages/types/src/tour-domain-profile.ts`** (or adjacent `@repo/types` modules) and import from web + api.
- Use **`eventKindForDomainProfile`** when legacy `EventKind` consumers must align with the domain profile.
- Add tests that **sweep all profiles** where enums are extended (`TOUR_FORM_PROFILE_VALUES` exhaustiveness patterns exist in specs — follow them).
- When behavior is **environmentally risky**, use **`apps/web/lib/config/feature-flags.ts`** and **`apps/api/src/modules/tours/tours-feature-flags.ts`** and document in the RFC §10.

### Don’t

- Don’t add **`if (EventKind.X)`** in Wizard code — ESLint blocks restricted imports; use profile + rules instead.
- Don’t add **`if (profile === "...")`** in step components for visibility/required-ness — encode in **`rules.ts`**.
- Don’t duplicate **strip tables** on web and server — share via **`@repo/types`**.
- Don’t bypass **`tourDomainProfileAdapters`** for new Edit classification logic.
- Don’t add **server-only** profile checks without mirroring **Wizard rules** and **client strip** where users can still send patched JSON.
- Don’t ship a new profile without touching **`defaultTourFormProfileForTourType`** / theme binding / API validation — half-wired profiles cause the worst production bugs.

---

## Pitfalls & anti-patterns

| Anti-pattern | Why it hurts | Correct alternative |
|--------------|--------------|---------------------|
| New `EventKind` checks in Wizard components | Diverges from `TourFormProfile`; breaks ESLint guardrails | `getFieldRule` / `useFieldRule`; `apps/web/src/features/tours/wizard/profileRules/getProfileRules.ts` |
| Copy-pasting `URBAN_LOGISTICS_WHITELIST_KEYS` (or similar) in api + web | Drift: server accepts what Wizard stripped (or vice versa) | `URBAN_LOGISTICS_WHITELIST_KEYS` from `@repo/types`; `create-tour-form-profile-strip.ts` + `stripTourFormTripDetailsForProfile.ts` |
| Required-ness only in Zod, not in `BASE_FIELD_RULES` | Step nav / autosave / submit disagree; duplicated policy | Single source: `rules.ts` + `validation.ts`; Zod for shape/types |
| Edit feature implemented with raw `tripStyles` / `tourType` only | Ignores workspace theme `formProfile` | `domainProfileFromEditFormValues` in `tourDomainProfileAdapters.ts` |
| New invariant only in `TourForm.tsx` | Server still accepts bad payloads | `assert-create-tour-invariants.ts` + strip in `create-tour-form-profile-strip.ts` |
| Forgetting **`TOUR_FORM_PROFILE_VERSION`** when snapshot semantics change | Old drafts misinterpreted | Bump in `tour-form-profile.ts` + migration notes in PR |
| Silent new profile (no tests) | Regressions in step order, required fields, strip | `profileRules.spec.ts`, `parity-with-server.spec.ts`, API strip/invariant specs |

---

## Quick reference — modules

| Concern | Path |
|---------|------|
| Profile enum + version + `TourType` default | `packages/types/src/tour-form-profile.ts` |
| Domain alias + shared tables | `packages/types/src/tour-domain-profile.ts` |
| `EventKind` ↔ domain bridge | `packages/types/src/tour-domain-profile-bridge.ts` |
| Field/step rules table | `apps/web/src/features/tours/wizard/profileRules/rules.ts` |
| `getProfileRules` / `getFieldRule` / `getStepRule` | `apps/web/src/features/tours/wizard/profileRules/getProfileRules.ts` |
| Autosave / step / submit validation | `apps/web/src/features/tours/wizard/profileRules/validation.ts` |
| Field groups & inactive steps | `apps/web/src/features/tours/wizard/fieldGroups.ts` |
| Zod + validation flags | `apps/web/.../schemas/tourCreateSchema.ts`, `tourCreateValidationPolicy.ts` |
| Wizard UI entry | `apps/web/src/components/tours/wizard/TourCreateWizard.tsx` |
| Edit classification | `apps/web/src/features/tours/domain/tourDomainProfileAdapters.ts` |
| Edit matrix (profile-keyed since Phase P6) | `apps/web/src/features/tours/config/tripDetailsFieldConfig.ts` |
| Client strip | `apps/web/src/features/tours/domain/stripTourFormTripDetailsForProfile.ts` |
| Server resolve + strip | `apps/api/src/modules/tours/utils/create-tour-form-profile-strip.ts` |
| Server invariants | `apps/api/src/modules/tours/utils/assert-create-tour-invariants.ts` |
| Web flags | `apps/web/lib/config/feature-flags.ts` |
| API flags | `apps/api/src/modules/tours/tours-feature-flags.ts` |
| Web observability | `apps/web/src/features/tours/observability/tourProfileObservability.ts` |
| API observability | `apps/api/src/modules/tours/tours-profile-observability.ts` |
| Lint guardrails | `apps/web/.eslintrc.json` (overrides) |

---

## Rollout reminder

If the change **alters observable behavior** (resolver, snapshot refresh, new required fields), use existing flags and logs, extend observability payloads if needed, and update [unified-tour-domain-model.md §10–11](./20-architecture/unified-tour-domain-model.md).

---

*Last updated: 2026-05 — align with Phases A–G of the unified profile architecture.*
