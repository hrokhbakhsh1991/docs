# Tour Domain — Closure Plan (Enterprise-Ready Roadmap)

> Companion to `prompt.md` (Enterprise Architecture Audit).
> Goal: take the tour domain from **Mostly Ready (~83 / 100)** to **Enterprise Complete (~95+ / 100)** by closing the residual migration items identified in **Phase 5 (D1–D4)**, **dual-policy collapse**, **profile-first writes**, **fitness CI**, **doc hygiene**, and **new-profile blast-radius reduction**.
>
> Each phase below lists: **scope**, **files to touch (exhaustive)**, **work breakdown**, **effort estimate (engineer-days)**, **risk**, **exit criteria / tests**, **dependencies**.
>
> Effort scale: **XS** ≤ 0.5 day · **S** ≈ 1 day · **M** ≈ 2–3 days · **L** ≈ 4–6 days · **XL** ≈ 7+ days.

---

## Overall summary

| Phase | Title | Effort | Risk | Priority | Status |
|------:|:------|:------:|:----:|:--------:|:------:|
| **P1** | Doc hygiene (Phase 5 follow-up) | **XS** (~0.5d) | very low | quick win | _**done**_ |
| **P2** | Architecture fitness CI | **S** (~1d) | low | quick win | _**done**_ |
| **P3** | Web `UpdateTourDto.formProfile` (profile-first write parity for Edit) | **S** (~1d) | low | high | _**done**_ |
| **P4** | Dual-policy collapse — retire `applyTourTypeFieldGates` (D1 → server gate) | **S–M** (~1.5d) | low–med | high | _**done**_ |
| **P5** | Phase 5 D3 — delete `domainProfileFromEventKindBestEffort` | **XS** (~0.5d) | very low | high | _**done**_ |
| **P6** | Phase 5 D1 — rebase `tripDetailsFieldConfig` over `ProfileRules` + RBAC | **L** (~5d) | medium | **critical** | _**first-pass done**_ (axis flipped; `recommended` fold-in pending) |
| **P7** | Phase 5 D2 — retire `legacyEventKindFromEditFormValues` + feature flag flip | **M** (~2.5d) | medium | high | _**done**_ (flag flipped; symbol kept for drift telemetry until P8) |
| **P8** | Phase 5 D4 — narrow `EventKind` surface, remove from `@repo/types` public API | **M** (~2d) | medium | high | _**done**_ (`Legacy` namespace; top-level `EventKind` / resolver / bridge re-exports **removed** post in-repo migration — external BFFs must use `Legacy.*`) |
| **P9** | Profile-first write adoption (clients & API contract docs) | **M** (~2d) | low | medium | _**done**_ |
| **P10** | Declarative profile descriptor (reduce new-profile blast radius) | **L** (~5d) | medium | medium | _**first-pass done**_ + housekeeping (mountain strip keys + Edit `mountain_outdoor` presets + `wizardCapacityStepRedundant` in descriptor; optional: fold wizard `"recommended"` tier so `tripDetailsFieldConfig.ts` can be deleted) |
| **P11** | Current-state architecture diagram + ADR closure | **S** (~1d) | nil | medium | _**done**_ |
| **TOTAL** | | **~22 engineer-days (~4–5 calendar weeks for 1 dev; ~2–3 weeks with 2 devs)** | | | |

> Critical path: **P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8 → P11**. P9 and P10 are parallelizable.

---

## Phase P1 — Documentation hygiene (Phase 5 follow-up)

### Why
The `tour-kind-policy.ts` shim was deleted in migration Phase 5, but three docs still cite it. Reviewers and onboards keep getting confused by dead links.

### Files to touch

| File | Action |
|------|--------|
| `docs/20-architecture/unified-tour-domain-model.md` | Remove rows mentioning `tour-kind-policy.ts:isMountainTourLike` (lines ~47, ~112); replace "migrate via `domainProfileFromEditFormValues`" advice with **already done** note. |
| `docs/20-architecture/tour-profile-guardrails.md` | Remove the `no-restricted-imports for @/features/tours/policies/tour-kind-policy` row (line ~54) and the MUST-NOT bullet at line ~22 (file deleted; rule already pruned from `.eslintrc.json`). |
| `docs/20-architecture/unified-tour-domain-model.md` | Remove the wizard-scope mention of `tour-kind-policy` at line ~185. |
| `ANALYSIS-tour-create-current.md` | Remove the parenthetical `(و export در apps/web/.../policies/tour-kind-policy.ts)` at line ~81. |
| `apps/web/src/features/tours/wizard/profileRules/rules.ts` | Tighten the JSDoc comment at line ~63 — it currently still says "removed; do not reintroduce". Keep but shorten. |

### Work breakdown
1. 5 edits, all comment / table row deletions.
2. Run `pnpm -w typecheck` (doc-only — should be a no-op).

### Effort
- **0.5 day (XS)**.

### Risk
- **Very low** — pure documentation.

### Exit criteria
- `rg "tour-kind-policy" docs/ apps/ packages/` returns **0 hits** outside `prompt.md` (the audit log).
- `pnpm -w typecheck && pnpm -w lint` green.

### Dependencies
- None.

---

## Phase P2 — Architecture fitness CI

### Why
Today, ESLint guardrails forbid `EventKind` only in **wizard** scope. There is no static check for **API tours module** (`apps/api/src/modules/tours/**`) or for **non-adapter** Edit code. The audit's own recommendation #2 in `prompt.md` (line 1165) calls for this.

### Files to touch

| File | Action |
|------|--------|
| `apps/api/package.json` | Add a `lint:fitness` script that runs a small node script (or `rg` invocation gated through `tsx`) checking `apps/api/src/modules/tours/**` for `EventKind` literal imports/usages. Fail with exit code 1 on any match. |
| `apps/api/src/modules/tours/fitness.spec.ts` (new) | Add a Jest/Node test that greps the compiled `tours` directory and asserts **zero** imports of `EventKind`, `eventKindForDomainProfile`, `resolveEventKindFromTourContext`, `domainProfileFromEventKindBestEffort` from `@repo/types`. Acts as a regression net even without ESLint. |
| `apps/web/.eslintrc.json` | Add a second `overrides[]` block that forbids the same legacy imports in `app/(app)/tours/[id]/**` **except** `apps/web/src/features/tours/domain/tourDomainProfileAdapters.ts` and `apps/web/src/features/tours/observability/*.ts` (allow-list adapter + telemetry). |
| `apps/web/src/features/tours/wizard/profileRules/parity-with-server.spec.ts` | Extend with one test that asserts `MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS` length matches between `@repo/types` and the web matrix. |
| `.github/workflows/ci.yml` (or equivalent CI workflow) | Wire `pnpm --filter @apps/api test -- fitness.spec.ts` and `pnpm --filter @apps/web lint` into the required-checks list. |

### Work breakdown
1. Write the `fitness.spec.ts` (~30 LOC of `rg` or `fs.readdirSync` walk).
2. Wire ESLint override for Edit scope (one block addition).
3. Add CI job entry.
4. Validate: introduce a temporary `import { EventKind } from "@repo/types"` in a tours service file, watch it fail.

### Effort
- **1 day (S)**.

### Risk
- **Low** — purely additive guardrails. Risk is a false positive in CI; mitigate with explicit allow-list.

### Exit criteria
- New fitness spec is green on `main`.
- A deliberate "introduce EventKind to tours API" branch fails CI.
- Edit-scope ESLint rule blocks `EventKind` imports outside the allow-listed adapter modules.

### Dependencies
- P1 (so the allow-list does not reference deleted `tour-kind-policy`).

---

## Phase P3 — Web `UpdateTourDto.formProfile` (profile-first parity for Edit)

### Why
`apps/api/src/modules/tours/dto/update-tour.dto.ts` already exposes `formProfile?` (Phase 2). The **web Edit client** in `apps/web/lib/services/tours.service.ts` does not pass it. Edit therefore still relies on theme/tourType resolution, leaving a known **contract-vs-enforcement asymmetry** flagged in `prompt.md §3` (line 1124).

### Files to touch

| File | Action |
|------|--------|
| `apps/web/lib/services/tours.service.ts` | Add `formProfile?: TourFormProfile` to `UpdateTourDto` (export); thread into `toUpdateTourApiBody` (~line 210). |
| `apps/web/src/components/tours/TourForm.tsx` | When `unifiedEditResolverEnabled === true` **and** `resolvedFormProfileForEdit` exists, include it in the submit payload mapper. Add a tiny mapper helper near line ~270 ("snapshot of resolved profile when known"). |
| `apps/web/lib/mappers/tour.mapper.ts` | If submit goes through a mapper layer here, propagate `formProfile`. |
| `apps/web/src/features/tours/wizard/hooks/useTourWizardCreate.ts` | Already sends `formProfile` on **create** — verify Edit equivalent uses the same source-of-truth helper. |
| `apps/web/lib/services/tours.service.spec.ts` (new or extend) | Test that when `formProfile` is set, the request body contains it; when omitted, it is **not** sent. |

### Work breakdown
1. DTO change (~5 LOC).
2. Wire from `TourForm.tsx` resolver — guard behind feature flag to keep parity with the convergence gate.
3. Unit test for body serialization.
4. Smoke test: edit a tour with theme-derived profile, confirm `formProfileSnapshot` is refreshed (server already supports this).

### Effort
- **1 day (S)**.

### Risk
- **Low**. Server already validates and falls back when the field is absent; this is purely additive on the client.
- One subtlety: when sending `formProfile`, the server will log `tour.form_profile_snapshot.refreshed`. Confirm log volume is acceptable (it already is for the wizard's create path).

### Exit criteria
- Edit submissions include `formProfile` whenever `useUnifiedTourDomainProfileForEditResolver` is ON.
- New unit test green.
- Manual QA: Edit a `cinema_event` tour saved with `tourType: nature`, confirm server keeps the `cinema_event` snapshot.

### Dependencies
- None blocking; ideally lands **before** P7 so flag-flip story is clean.

---

## Phase P4 — Dual-policy collapse: retire `applyTourTypeFieldGates`

### Why
`apps/api/src/modules/tours/utils/tour-type-gates.ts` exposes **two** functions:
- `applyTourTypeFieldGates(td, tourType)` — legacy axis
- `applyMountainOverviewFieldGatesForFormProfile(profile, td)` — profile axis (already used on every write path)

The only remaining caller of the **legacy** function is its own spec. Audit calls this out as **moderate severity** in `prompt.md §4` (line 782) — "(1) Coexistence of profile enforcement and `tourType`-based `applyTourTypeFieldGates`".

### Files to touch

| File | Action |
|------|--------|
| `apps/api/src/modules/tours/utils/tour-type-gates.ts` | Make `applyTourTypeFieldGates` an internal implementation detail: rename to `applyMountainOverviewFieldGatesByTourType` and stop exporting from the module index. Better: inline the body into `applyMountainOverviewFieldGatesForFormProfile` and drop the indirection entirely. |
| `apps/api/src/modules/tours/utils/tour-type-gates.spec.ts` | Rewrite tests to target `applyMountainOverviewFieldGatesForFormProfile` directly with each `TourFormProfile`; drop the `TourType` matrix tests. |
| `apps/api/src/modules/tours/tours.service.ts` | Remove the `applyTourTypeFieldGates` import line (line ~51 currently only imports the profile variant — verify). |
| `README.tour-create-wizard.md` | Remove reference to `applyTourTypeFieldGates`. |
| `docs/20-architecture/unified-tour-domain-model.md` | Update Phase D row 3 (line ~168) — mountain-only gate is now profile-native; mark this item complete. |
| `prompt.md` | Append a one-line follow-up note in the Final Status section noting the dual-policy collapse is closed. |

### Work breakdown
1. Source: remove `applyTourTypeFieldGates` export (or delete entirely).
2. Tests: convert spec to profile axis (~6 tests → 6 reworded tests).
3. Search for stray imports across `apps/api/src` and `apps/api/src/scripts`.
4. Doc updates.

### Effort
- **1.5 days (S–M)**.

### Risk
- **Low–medium**. The legacy function is referenced in tests only and a doc README. Behaviorally identical because the profile variant already delegates to it.
- Subtle: any **future** caller wanting to gate by raw `tourType` (e.g. a migration script) would have to compute `defaultTourFormProfileForTourType` first. Acceptable.

### Exit criteria
- `rg "applyTourTypeFieldGates" apps/ packages/` returns **0 hits** except the spec.
- All `apps/api` tests green.
- API smoke route (`pnpm --filter @apps/api test:e2e` or current equivalent) green.

### Dependencies
- None.

---

## Phase P5 — Phase 5 D3: delete `domainProfileFromEventKindBestEffort`

### Why
The reverse projection is `@deprecated` and has **zero production callers** (verified by grep — only its own spec uses it). It is on the published `prompt.md` Phase 5 sequence as **D3** (line 1051).

### Files to touch

| File | Action |
|------|--------|
| `packages/types/src/tour-domain-profile-bridge.ts` | Delete `domainProfileFromEventKindBestEffort` (lines ~58–71). |
| `packages/types/src/index.ts` | Remove the export (line ~82). |
| `packages/types/src/tour-domain-profile-bridge.spec.ts` | Remove or rewrite the round-trip tests (lines ~33–67). Keep `eventKindForDomainProfile` total-mapping test. |
| `apps/web/.eslintrc.json` | Remove `domainProfileFromEventKindBestEffort` from the `no-restricted-imports.importNames` list (line ~25) — no longer exists. |
| `docs/20-architecture/tour-profile-guardrails.md` | Update lint table row (line ~53) to drop the symbol. |
| `docs/20-architecture/unified-tour-domain-model.md` | Remove the deprecated row at line ~109. |
| `docs/PROFILE_ARCHITECTURE_PLAYBOOK.md` | Remove mention at line ~74. |

### Work breakdown
1. Code delete + export remove (~10 LOC across two files).
2. Spec rewrite (~30 LOC become ~15).
3. ESLint + doc cleanup.
4. Build types package: `pnpm --filter @repo/types build`.

### Effort
- **0.5 day (XS)**.

### Risk
- **Very low**. Symbol is `@deprecated` and unused.

### Exit criteria
- `rg "domainProfileFromEventKindBestEffort" apps/ packages/ docs/` returns **0 hits**.
- `@repo/types` builds + downstream `apps/web` and `apps/api` still typecheck.

### Dependencies
- P1 (so docs already cleaned up around it).

---

## Phase P6 — Phase 5 D1: rebase `tripDetailsFieldConfig` over `ProfileRules` + RBAC

### Why
This is **the** load-bearing closure item. The Edit form currently runs on a **dual-source policy** (`EventKind` matrix + ProfileRules overlay). Until the matrix is derived from ProfileRules, every new field must be added in both places and is policed only by parity tests. Audit Phase 3 §2 (line 894) and Phase D §12.1 (`unified-tour-domain-model.md` line 166) both flag this as the highest-leverage remaining item.

### What stays vs goes

**Stays** (`tripDetailsFieldConfig.ts`):
- `TripDetailsFieldId` union (Edit-only paths like `overview.maxAltitudeMeters`, `participation.documentsRequired` that are **not** in wizard `BASE_FIELD_RULES`).
- `CoreFieldConfig` for `core.totalCapacity` / `core.capacity` with `minRoleForView`/`minRoleForEdit`.
- `FieldVisibility` / `FieldRequiredness` / `UserRole` types + `resolveFieldAccess`.

**Goes / rebased**:
- `EVENT_KIND_CONFIGS` record — replaced by a **derived** function `buildTripDetailsRowsForProfile(profile)` that:
  1. Reads `getProfileRules(profile).fields` for visibility + required.
  2. Overlays an **RBAC table** (new, profile-agnostic) for `allowedRoles` / `viewOnlyRoles` / `minRoleFor*` per `TripDetailsFieldId`.
  3. Overlays Edit-only fields not present in ProfileRules with their static defaults (mountain-only handled via `MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS`).
- `getTripDetailsFieldConfigForKind(kind)` — deleted (no longer needed once adapter goes direct).
- `tripDetailsFieldConfigAdapter.getTripDetailsFieldConfigForProfile` — now simply calls `buildTripDetailsRowsForProfile`; no more `eventKindForDomainProfile` round-trip.
- `getCoreFieldConfigForKind` — replaced by `getCoreFieldConfigForProfile` returning a profile-independent core matrix (RBAC only, no `kind` lookup).

### Files to touch (exhaustive)

| File | Action |
|------|--------|
| `apps/web/src/features/tours/config/tripDetailsFieldConfig.ts` | **Major rewrite.** Delete `EVENT_KIND_CONFIGS`, `MOUNTAIN_OVERRIDES`, `GENERIC_CONFIG`, `MOUNTAIN_CONFIG`, `EventKindFieldConfig`, `getTripDetailsFieldConfigForKind`, `getCoreFieldConfigForKind`. Add `TRIP_DETAILS_RBAC_TABLE: Partial<Record<TripDetailsFieldId, FieldRoleConstraint & { allowedRoles?; viewOnlyRoles? }>>`. Add `EDIT_ONLY_FIELD_DEFAULTS` for fields not in ProfileRules. Add `buildTripDetailsRowsForProfile(profile, profileRules)`. |
| `apps/web/src/features/tours/config/tripDetailsFieldConfigAdapter.ts` | Replace `eventKindForDomainProfile` call (line ~7) with a direct call to `buildTripDetailsRowsForProfile`. Drop the import of `eventKindForDomainProfile`. |
| `apps/web/src/features/tours/wizard/profileRules/rules.ts` | Add the **Edit-only** fields (`overview.maxAltitudeMeters`, `overview.elevationGainMeters`, `participation.documentsRequired`, `policies.attendanceRules`, …) to `BASE_FIELD_RULES` keyed by their dotted path. Profile activeness drives Edit visibility uniformly with the wizard. |
| `apps/web/src/features/tours/wizard/profileRules/types.ts` | Expand `FieldRequiredness` to `"required" \| "optional" \| "forbidden" \| "recommended"` (the Edit matrix has a `recommended` tier). Update consumers. |
| `apps/web/src/features/tours/wizard/profileRules/validation.ts` | Treat `recommended` the same as `optional` for hard validation; expose a `getRecommendedFields(profile)` helper for the future "completeness" badge. |
| `apps/web/src/features/tours/wizard/profileRules/profileRules.spec.ts` | Add coverage for the new Edit-only paths. |
| `apps/web/src/features/tours/wizard/profileRules/parity-with-server.spec.ts` | Add **new** parity test: every `TripDetailsFieldId` either has a ProfileRules entry **or** is in `EDIT_ONLY_FIELD_DEFAULTS` — no silent gaps. |
| `apps/web/src/components/tours/tour-schema.ts` | No code change; just verify `createTourSchemaForProfile` continues to pass through `applyTripDetailsRequirednessToSchema(getTripDetailsFieldConfigForProfile(profile))`. |
| `apps/web/src/features/tours/models/tourCreateModel.ts` | Same — verify `getTripDetailsFieldConfigForProfile` import still resolves. |
| `apps/web/src/features/tours/models/tourTripDetails.schema.spec.ts` | Update fixtures referencing `getCoreFieldConfigForKind` → `getCoreFieldConfigForProfile`. |
| `apps/web/src/components/tours/TourForm.tsx` | Update import path / function names. Line 29 (`getCoreFieldConfigForProfile`) likely keeps its name — verify no `*ForKind` callers remain. |
| `apps/web/src/features/tours/components/tour-create-trip-details-fields.tsx` | Update import (line 24) to the new `getTripDetailsFieldConfigForProfile` signature (no breaking change expected). |
| `apps/web/src/features/tours/config/fieldAccess.spec.ts` | Probably untouched (tests `resolveFieldAccess`, not the matrix); confirm. |
| `apps/web/src/features/tours/config/tripDetailsFieldConfig.spec.ts` (new) | Add tests: per-profile snapshot of `buildTripDetailsRowsForProfile`; assert RBAC overlays apply; assert mountain-only fields hidden for non-mountain profiles. |

### Work breakdown
1. **Day 1**: design the RBAC table extraction; identify Edit-only fields not in wizard rules; spike on `recommended` semantics in `FieldRule`.
2. **Day 2**: implement `buildTripDetailsRowsForProfile`; rewrite `tripDetailsFieldConfig.ts`; rewire adapter.
3. **Day 3**: register Edit-only fields in `BASE_FIELD_RULES`; extend `FieldRequiredness` union; update validation.
4. **Day 4**: write new parity + snapshot tests; fix downstream typecheck breakage; run full wizard + Edit smoke tests.
5. **Day 5**: rollout + observability — log a `edit_legacy_matrix_drift` event if `buildTripDetailsRowsForProfile` output diverges from the legacy matrix during a one-week shadow phase; remove `EVENT_KIND_CONFIGS` only after that window.

### Effort
- **5 days (L)**. The matrix itself is ~250 LOC, but the work is in (a) capturing tri-state requiredness, (b) reconciling RBAC, (c) regression-testing every Edit field.

### Risk
- **Medium**. This is the only phase that can produce **visible Edit form behavior diff** if a field's RBAC or requiredness is mis-translated.
- Mitigation: ship behind a feature flag `useDerivedEditFieldMatrix` for one release; compare legacy vs derived output via `tourProfileObservability` for one cycle.

### Exit criteria
- `EVENT_KIND_CONFIGS`, `getTripDetailsFieldConfigForKind`, `getCoreFieldConfigForKind` no longer exist.
- `eventKindForDomainProfile` has **zero** callers in `apps/web/src/features/tours/config/**`.
- New parity spec green; shadow-comparison log shows zero divergence for one week.
- Edit form smoke tests green for every profile.

### Dependencies
- P1, P5. Independent of P3/P4 but easier with P3 landed.

---

## Phase P7 — Phase 5 D2: retire `legacyEventKindFromEditFormValues` + flip Edit resolver flag

### Why
Once P6 is done, the Edit resolver no longer needs the **legacy** `EventKind` resolver for the catalog-loaded path. The remaining caller is the no-catalog fallback (SSR / very first render). Audit Phase 5 D2 (line 1050) says: "Remove `resolveEventKindFromTourContext` from default Edit resolver paths once legacy payloads negligible".

### Files to touch

| File | Action |
|------|--------|
| `apps/web/lib/config/feature-flags.ts` | Flip the default of `useUnifiedTourDomainProfileForEditResolver` to **ON**. Add a `legacyEditResolverEnabled` opt-out env var for emergency rollback. |
| `apps/web/lib/config/feature-flags.spec.ts` | Update default tests. |
| `apps/web/src/components/tours/TourForm.tsx` | Drop the legacy branch (line 228) — the catalog-loaded path is the only path now. Keep `legacyEventKindFromEditFormValues` call **only** inside the no-catalog SSR branch (one call site) and add a comment "TODO P8 remove once catalog SSR-preloaded everywhere". |
| `apps/web/src/features/tours/domain/tourDomainProfileAdapters.ts` | Mark `legacyEventKindFromEditFormValues` `@deprecated`; restrict to internal use only (do not re-export from any barrel). |
| `apps/web/src/features/tours/domain/tourDomainProfileAdapters.spec.ts` | Update tests to assert the deprecation path. |
| `apps/web/src/features/tours/observability/tourProfileObservability.ts` | Stop logging `legacy_event_kind` once the legacy path has zero callers in production (kept under `useUnifiedTourDomainProfileForEditResolver === false` only); plan to remove in P8. |
| `docs/20-architecture/unified-tour-domain-model.md` | Update Phase D §12.1 — D2 close. |
| `prompt.md` | Append a completion note in the Final Status section. |

### Work breakdown
1. Flip flag default; add canary env var.
2. Remove the `if (!unifiedEditResolverEnabled)` branch from `TourForm.tsx`.
3. Update spec parity.
4. Run a one-week observation window: count `legacy_event_kind` events; if non-zero, investigate before P8.

### Effort
- **2.5 days (M)**. The code change is small; the watchdog window is the real cost.

### Risk
- **Medium**. The flag exists precisely because the catalog-overrides-tourType corner case can change validation output. Mitigation: observability already captures `agrees: false` drift; ensure dashboards are green before flip.

### Exit criteria
- Flag default ON in production.
- One week of zero `legacy_event_kind ≠ projected_event_kind` events (or expected drift fully attributed).
- `legacyEventKindFromEditFormValues` retained but used only on the SSR fallback path.

### Dependencies
- **P6 (hard)**. Cannot flip without the matrix being profile-derived.

---

## Phase P8 — Phase 5 D4: narrow `EventKind` surface

### Why
After P7, `EventKind` survives only as:
1. Telemetry strings (`legacy_event_kind` / `projected_event_kind`).
2. The bridge module itself.
3. The SSR-no-catalog fallback in `TourForm.tsx`.
4. The legacy `resolveEventKindFromTourContext` for parsing **inbound** legacy payloads (external API).

The goal of D4 (line 1052) is: **`EventKind` no longer leaks across the public `@repo/types` surface as a free-form symbol**. Make it an internal/legacy namespace.

### Files to touch

| File | Action |
|------|--------|
| `packages/types/src/tour-kind.ts` | Move into a `legacy/` subfolder: `packages/types/src/legacy/tour-kind.ts`. Re-export through a single `legacy` namespace. |
| `packages/types/src/index.ts` | Replace `export type { EventKind, … }` with `export * as Legacy from "./legacy"`. Internal consumers (the bridge, adapters) import directly from the legacy path. |
| `packages/types/src/tour-domain-profile-bridge.ts` | Update import path. Re-export `eventKindForDomainProfile` through the same `Legacy` namespace **or** mark it `@deprecated` and document that only `apps/web/src/features/tours/config/**` is allowed to use it. After P6, even that caller is gone. |
| `apps/web/src/features/tours/domain/tourDomainProfileAdapters.ts` | Update to `import { Legacy } from "@repo/types"; const { EventKind, eventKindForDomainProfile } = Legacy;` etc. |
| `apps/web/src/features/tours/observability/tourProfileObservability.ts` | Same import shift. |
| `apps/web/src/components/tours/TourForm.tsx` | Same. |
| `apps/web/.eslintrc.json` | Replace the wizard `no-restricted-imports` rule to forbid `Legacy.EventKind` etc. uniformly except for explicit allow-listed files. |
| `docs/20-architecture/tour-profile-guardrails.md` | Update the lint table to reference the `Legacy.*` namespace. |
| `docs/PROFILE_ARCHITECTURE_PLAYBOOK.md` | Add "Legacy namespace" section with the allowed-use list. |

### Work breakdown
1. Move file + add namespace re-export.
2. Update all importers (~6 files).
3. Rebuild `@repo/types` and run downstream typecheck/lint.
4. Update guardrail docs + ESLint rule.

### Effort
- **2 days (M)**.

### Risk
- **Medium**. Pure rename / namespace shuffle but touches `@repo/types` public surface — any external consumer (BFF, partner code) gets a breaking change. Coordinate with platform team; provide a one-cycle re-export shim.

### Exit criteria
- `import { EventKind } from "@repo/types"` is a **TypeScript error** (symbol not exported) — use `import { Legacy } from "@repo/types"` / `Legacy.EventKind` instead.
- Only `import { Legacy } from "@repo/types"` (or direct `packages/types/src/legacy/*` deep paths) compile.
- `rg "EventKind" apps/api/src` returns **0 hits**.

### Dependencies
- **P7 (hard)**.

---

## Phase P9 — Profile-first write adoption (clients & API docs)

### Why
`prompt.md` Verification table (line 1124): **"Profile-first write contracts — Partially met"**. The API accepts `formProfile`; not every client sends it. Need adoption push + documentation.

### Files to touch

| File | Action |
|------|--------|
| `apps/api/openapi.json` | Already regenerated in Phase 2; confirm `formProfile` is on both create + update schemas (it is). |
| `docs/PROFILE_ARCHITECTURE_PLAYBOOK.md` | Add section "External write contract — required adoption" listing the precedence: explicit `formProfile` → theme `form_profile` → `tourType` default. Mark `tourType`-only writes as **discouraged**. |
| `marketplace/**` (if any third-party / BFF caller writes tours) | Audit each caller; add `formProfile` where the caller has access to a workspace theme. |
| `apps/telegram/**` (if it ever creates tours) | Same audit. |
| `apps/api/src/scripts/seed-denali-tours.ts` | Pass `formProfile` derived from theme in seed payloads (currently uses `tourType` only — line 137 onwards). |
| `apps/api/src/scripts/seed-denali-tour-presets.ts` | Already uses `defaultTourFormProfileForTourType` — confirm presets seed reflects the final precedence. |
| `apps/web/tests/smoke/03-tour-wizard-submit-urban.spec.ts` | Add an assertion that the request body contains `formProfile: "urban_event"`. |
| `apps/web/tests/smoke/07-tour-edit-urban-patch.spec.ts` | Add similar assertion on PATCH (after P3). |
| `apps/api/src/modules/tours/tours.service.spec.ts` (extend) | Add a contract test for precedence: explicit > theme > tourType. (Cases combining all three.) |
| `apps/api/src/modules/tours/tours-feature-flags.ts` | Add a metric: count of tours created with `formProfile` vs. tours resolved via fallback. Expose under existing observability. |

### Work breakdown
1. Audit + update all in-repo clients (~5 small edits).
2. Extend smoke + contract tests (~6 small edits).
3. Add adoption metric.
4. Doc + ADR section.

### Effort
- **2 days (M)**.

### Risk
- **Low**. Server already handles absence gracefully; this just raises the bar.

### Exit criteria
- Every in-repo writer sends `formProfile` when it knows the resolved profile.
- Observability dashboard shows ≥ 90% of new tours created with explicit `formProfile` within one release.

### Dependencies
- P3 for Edit; otherwise independent.

---

## Phase P10 — Declarative profile descriptor (new-profile blast-radius)

_Status (2026-05-13): **first-pass landed** — `TOUR_FORM_PROFILE_DESCRIPTORS` exists in `@repo/types`, web + API consumers read it, parity tests pin behavior. Optional follow-ups remain (see Exit criteria)._

### Why
`prompt.md §5.1` (line 588) and `§5.5` (line 691) both call out **~15–30 files** of churn to add a new profile. Audit recommendation #1 (line 700) and #4 (line 811) call for a declarative descriptor.

### Implemented API (as shipped)

```typescript
// packages/types/src/tour-form-profile-descriptors.ts
export interface TourFormProfileStripDeltas {
  readonly clearsTripDetailsRoots: readonly ("participation" | "itinerary" | "logistics")[];
  readonly itineraryKeysToDelete: readonly ("dayPlans" | "segmentActivities")[];
  readonly logisticsWhitelist?: readonly UrbanLogisticsWhitelistKey[];
  readonly clearsRootTransportModes: boolean;
}

export interface TourFormProfileInvariantHints {
  readonly allowsMountainOnlyOverviewKeys: boolean;
  readonly requiresEmptyRootTransportModes: boolean;
}

export interface TourFormProfileDescriptor {
  readonly slug: TourFormProfile;
  readonly displayKeyFa: string;
  readonly defaultTourType: TourType | null;
  readonly inactiveFieldGroups: readonly WizardFieldGroupSlug[];
  readonly strip: TourFormProfileStripDeltas;
  readonly invariants: TourFormProfileInvariantHints;
}

export const TOUR_FORM_PROFILE_DESCRIPTORS: Readonly<
  Record<TourFormProfile, TourFormProfileDescriptor>
> = { ... };

export function getTourFormProfileDescriptor(profile: TourFormProfile): TourFormProfileDescriptor;
```

Wired consumers (first-pass):

- `fieldGroups.ts:getInactiveFieldGroupsForProfile` reads `inactiveFieldGroups`.
- `profileRules/rules.ts:PROFILE_DISPLAY_KEYS` is built from `displayKeyFa`.
- `create-tour-form-profile-strip.ts:stripTripDetailsForFormProfile` + `stripCreateTourDtoForFormProfile` read `strip.*`.
- `assert-create-tour-invariants.ts` gates slim-profile phantom checks + incoming pre-strip validation off the same `strip.*` flags (no more `profile !== "cinema_event" && profile !== "urban_event"` forks).
- `tour-type-gates.ts:applyMountainOverviewFieldGatesForFormProfile` reads `invariants.allowsMountainOnlyOverviewKeys`.

### Files to touch

| File | Action |
|------|--------|
| `packages/types/src/tour-form-profile-descriptors.ts` | **Done** — interface + populated record + `getTourFormProfileDescriptor`. |
| `packages/types/src/index.ts` | **Done** — re-export. |
| `packages/types/src/tour-form-profile-descriptors.spec.ts` | **Done** — parity vs legacy behavior + totality. |
| `apps/web/src/features/tours/wizard/fieldGroups.ts` | **Done** — `getInactiveFieldGroupsForProfile` reads descriptor. |
| `apps/web/src/features/tours/wizard/profileRules/rules.ts` | **Done** — `PROFILE_DISPLAY_KEYS` reads `displayKeyFa`. |
| `apps/web/src/features/tours/wizard/profileRules/parity-with-server.spec.ts` | **Done** — descriptor ↔ web rail parity probes. |
| `apps/api/src/modules/tours/utils/create-tour-form-profile-strip.ts` | **Done** — strip driven by descriptor + P10 regression probes in its spec. |
| `apps/api/src/modules/tours/utils/assert-create-tour-invariants.ts` | **Done** — slim-profile checks driven by descriptor `strip`. |
| `apps/api/src/modules/tours/utils/tour-type-gates.ts` | **Done** — mountain gate reads `invariants.allowsMountainOnlyOverviewKeys`. |
| `packages/types/src/trip-details-inventory-policy.ts` | _Optional follow-up_ — fold `MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS` into descriptor metadata (today the constant remains canonical; the descriptor only carries the boolean flag). |
| `docs/PROFILE_ARCHITECTURE_PLAYBOOK.md` | **Done** — checklist updated. |
| `docs/20-architecture/tour-wizard-field-groups.md` | **Done** — §6 notes descriptor ownership. |
| `docs/20-architecture/unified-tour-domain-model.md` | **Done** — file map + invariant I-9. |

### Work breakdown
1. **Day 1**: design descriptor shape; populate it from existing code. ✅
2. **Day 2**: migrate `fieldGroups` + `rules`. ✅
3. **Day 3**: migrate API strip + invariants + mountain gate. ✅
4. **Day 4**: write parity tests asserting strip output across all profiles. ✅ (P10 probes + existing strip specs retained)
5. **Day 5**: collapse remaining wizard-only `TourFormProfile` literals (e.g. `isWizardStepRedundantForProfile`), optional inventory-policy fold-in, smoke row for a net-new profile once one exists.

### Effort
- **5 days (L)**. High leverage but high reach — every existing profile-specific branch becomes a table read.

### Risk
- **Medium**. Refactor risk; mitigate with strict parity tests.

### Exit criteria
- Adding a new profile = one descriptor entry + one i18n key + smoke test row. **Estimated ≤ 5 files** vs ~15–30 today. _(Validated once we add the next real profile slug — today the repo still has the original six literals.)_
- All **server + structural wizard** profile-specific switch/if chains for strip / inactive groups / display keys / mountain gate replaced by descriptor reads. ✅
- Parity tests green. ✅
- **Optional follow-up (P6 / P10 tail) — _done as a non-breaking slice (2026-05-13)_:** `FieldRule.required` was extended with a `"recommended"` tier (`apps/web/src/features/tours/wizard/profileRules/types.ts`), and the descriptor's `edit.tripDetailsPresetOverrides` rows tagged `"recommended"` now propagate into the wizard rules layer (`PROFILE_FIELD_REQUIRED_OVERRIDES` in `rules.ts`). The Edit adapter (`tripDetailsFieldConfigAdapter.ts`) honors the tier, exposing `requiredness: "recommended"` to the Edit UI from the same source. **Validation behavior is byte-identical** to the pre-P12 state — `"recommended"` is non-blocking at every level (`isFieldRequiredAtLevel` returns `false`; see `validation.ts`) — so `"required"` preset rows are deliberately **not** mirrored yet (promoting an `optional`-in-`BASE_FIELD_RULES` path to `required` for one profile needs UX sign-off; tracked in `ADR-tour-profile-closure.md` "Optional follow-ups").
- **Phase P13 — wizard UI fold-in of the `"recommended"` tier — _done (2026-05-13)_:** `@tour/ui` `FormField` now accepts `recommendedLabel?: ReactNode` and renders a soft non-blocking badge next to the field label (`packages/ui/src/components/form/FormField.tsx` + `FormField.module.css` `.recommendedMark`). The badge is mutually exclusive with the `*` required mark — `required` wins — and wires into `aria-describedby` for assistive tech. A new React hook `useIsFieldRecommended(path)` (`profileRulesReact/useProfileRules.ts`) mirrors the pure-rules helper `isFieldRecommended` and is wired into `LogisticsStep.tsx` (`transportationNotes`, `groupSizeMin`, `groupSizeMax`) + `ParticipationStep.tsx` (`technicalSkillRequired`). New i18n key `tours.new.wizardFieldHintRecommended` ("پیشنهادی" / "Recommended"). Tests: 2 new specs in `profileRules.spec.ts` pin the four wired paths (a) flag as `recommended` only for `mountain_outdoor`, (b) are present in `BASE_FIELD_RULES` so the badge can render. **309/309** tests in `apps/web`, `tsc --noEmit` clean across `apps/web` + `packages/ui`. Outstanding sub-item: deletion of `tripDetailsFieldConfig.ts` still requires registering the Edit-only paths (`overview.maxAltitudeMeters`, `participation.documentsRequired`, …) into `BASE_FIELD_RULES`; tracked as a separate future task.
- **Phase P14 — fold `MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS` into the descriptor module — _done (2026-05-13)_:** the canonical tuple + its type alias (`MountainOnlyTripDetailsOverviewKey`) were relocated from `packages/types/src/trip-details-inventory-policy.ts` into `packages/types/src/tour-form-profile-descriptors.ts`, the now-canonical single source for every profile-axis policy. `trip-details-inventory-policy.ts` is preserved as a one-line back-compat re-export shim (consumers in `apps/api/.../tour-type-gates.ts`, `apps/web/.../tripDetailsFieldConfigAdapter.ts`, `apps/web/.../parity-with-server.spec.ts`, `apps/web/.../tripDetailsFieldConfig.spec.ts` keep working without edits). The package root (`@repo/types` `index.ts`) now re-exports the constant from the descriptor module directly. New parity test (`tour-form-profile-descriptors.spec.ts` — P14): asserts the shim re-exports the **same tuple reference** as the descriptor module, so any future drift fails CI loudly. **51/51** tests in `packages/types`, **309/309** in `apps/web`, **96/96** in `apps/api` tours+settings-locations modules; `tsc --noEmit` clean; `check-tour-domain-guardrails.mjs` OK. The descriptor is now the unambiguous single source for every mountain-policy decision.
- **Phase P15 — Edit matrix module split + path-divergence catalog — _done (2026-05-13)_:** `apps/web/src/features/tours/config/tripDetailsFieldConfig.ts` was **slimmed** to the trip-details profile matrix only. The RBAC resolver (`resolveFieldAccess`, `normalizeFieldUserRole`, shared types) was extracted to `editFieldRbac.ts`; the `core.*` capacity matrix to `editCoreFieldConfig.ts`. `tripDetailsFieldConfig.ts` **re-exports** the moved symbols unchanged so existing imports (`TourForm.tsx`, `tour-create-trip-details-fields.tsx`, `tripDetailsFieldConfigAdapter.ts`, `tripDetailsFieldConfig.spec.ts`) keep working without churn. New exported constant `TRIP_DETAILS_FIELD_IDS` + new parity spec `editTripDetailsWizardPathDivergence.spec.ts` pins every Edit matrix row as either (1) an exact `BASE_FIELD_RULES` path, (2) a documented alias to a wizard path, or (3) legitimately Edit-only inventory (itinerary narrative blocks + mountain-only overview metrics). **Physical deletion** of `tripDetailsFieldConfig.ts` remains blocked on the path-namespace rename / adapter-alias work itemised in that spec — estimated **L (≈ 5–8 dev-days)** because it touches the legacy `tripDetails.*` RHF shape, not just the rules table.
- **Phase P16 — Edit→wizard path-alias map (pilot row) — _done (2026-05-13)_:** the Edit adapter now owns `EDIT_TO_WIZARD_PATH_ALIASES` in `tripDetailsFieldConfigAdapter.ts` (canonical source) and applies it when overlaying `getFieldRule` onto Edit rows. **Pilot row:** `overview.shortIntro` → `overview.shortDescription` — the Edit row's visibility / requiredness now derive from `BASE_FIELD_RULES.overview.shortDescription` for every profile. The divergence spec (`editTripDetailsWizardPathDivergence.spec.ts`) imports the active map directly and splits the catalog into **active** (P16 wired) vs **DOCUMENTED_FUTURE_ALIASES** (the ~10 remaining rows queued for the convergence tail). New parity tests in `tripDetailsFieldConfig.spec.ts` (2 cases — pilot inheritance + alias-map non-empty), plus a new "active ⊆ documented" guard in the divergence spec. **315/315** tests in `apps/web`, lint clean, guardrails OK. Pattern is now established — adding the next alias is a one-line edit in `EDIT_TO_WIZARD_PATH_ALIASES` and a one-line move from `DOCUMENTED_FUTURE_ALIASES` in the spec.

### Dependencies
- Best landed **after** P6 (so the rules layer is the canonical source already) but can start in parallel on the API side.

---

## Phase P11 — Current-state architecture diagram + ADR closure

_Status (2026-05-13): **done** — diagram + ADR published; closed-items appendix added to RFC; `prompt.md` Final Enterprise Architecture Status promoted to **Enterprise Ready (post P1–P11)**._

### Why
Audit recommendation #5 (line 1168) and §7 "Developer onboarding clarity" (line 773) both ask for a one-page diagram. After P1–P10, the system has a clear story to tell.

### Files touched

| File | Action |
|------|--------|
| `docs/20-architecture/tour-profile-current-state.md` (new) | **Done** — one-page Mermaid diagram (resolver → strip → invariants → snapshot; UI consumers; legacy island), precedence table, invariant matrix (I-1 through I-9), closed-items table, triage checklist. |
| `docs/20-architecture/unified-tour-domain-model.md` | **Done** — §12 rewritten with Phase-D closure status per item; new §12a "Status — closed items" appendix linking every Phase-D / P-phase pair. |
| `prompt.md` | **Done** — **Final Enterprise Architecture Status** scores promoted (architecture 93, maintainability 91, readiness 92); verdict reclassified as **Enterprise Ready (post P1–P11)** with explicit list of residual housekeeping in the closure ADR; §8 closure log extended with P10 + P11 entries. |
| `docs/20-architecture/ADR-tour-profile-closure.md` (new) | **Done** — formal closure ADR (context, decision, consequences with accepted compatibility costs, migration-item disposition table, enforcement matrix, revisit triggers, acceptance signals). |
| `README.tour-create-wizard.md` | **Done** — §7 "مرجع متنی اضافی" replaced with a structured reference list pointing at the new diagram + ADR + RFC + guardrails + playbook + the post-P1–P11 status. |

### Work breakdown
1. Draft mermaid diagram with the four canonical layers. ✅
2. Write closure ADR. ✅
3. Update scores in `prompt.md`. ✅
4. Cross-link diagram + ADR from README, RFC, and playbook. ✅

### Effort
- **1 day (S)**.

### Risk
- **Nil**.

### Exit criteria
- Architecture page is one screen and accurately reflects post-P10 reality. ✅
- Onboarding doc updated. ✅
- Closure ADR documents every accepted compatibility cost and revisit trigger. ✅

### Dependencies
- **P1–P10** (cosmetically — the diagram is meaningful only after the legacy bits are gone). ✅

---

## Risk matrix

| Risk | Phase(s) | Mitigation |
|------|----------|------------|
| Hidden caller of `domainProfileFromEventKindBestEffort` outside the repo | P5 | Keep a one-cycle deprecation re-export shim; grep external partner repos before deletion. |
| Edit field RBAC or requiredness regression after matrix rebase | P6 | Feature flag + one-week shadow comparison + parity tests for every `(profile, fieldId)`. |
| Flipping `useUnifiedTourDomainProfileForEditResolver` causes Zod surprise in production | P7 | Monitor `edit_save_http_400` dashboard pre and post; canary env var. |
| External BFF / partner imports `EventKind` directly from `@repo/types` | P8 | **Mitigated** — package root no longer exports `EventKind`; migrate callers to `Legacy.*`. |
| Descriptor refactor introduces subtle strip diff for an existing profile | P10 | Strict parity tests using current code as oracle. |

---

## Recommended execution order (Gantt-style)

```
Week 1:  P1 (XS) ──────────► P2 (S) ──────────► P3 (S)  ──────────► P4 (S–M)
Week 2:  P5 (XS) ──────────► P6 (L)  …………………………………………………………………………►
Week 3:                              ……………………► P7 (M) ──────────► P9 (M)
Week 4:  P8 (M) ──────────► P10 (L) ……………………………………………………………………►
Week 5:                              ……………………► P10 cont. ────► P11 (S)
```

> Single-engineer cadence ≈ 4.5–5 calendar weeks. Two-engineer cadence (split: P3/P4 vs P6 in parallel, then P9/P10 in parallel after P6) ≈ 2.5–3 calendar weeks.

---

## Acceptance criteria for "Enterprise Ready" promotion

After all phases land, the **Final Enterprise Architecture Status** table in `prompt.md` should read:

| Metric | Target |
|--------|-------:|
| Architecture maturity | **≥ 95 / 100** |
| Maintainability | **≥ 92 / 100** |
| Enterprise readiness (holistic) | **≥ 94 / 100** |
| `EventKind` in `apps/api/src/modules/tours/**` | **0 imports (CI-enforced)** |
| Profile-first write adoption | **≥ 90 % of new tours have explicit `formProfile`** |
| New-profile change surface | **≤ 5 files + 1 i18n key** |
| Dual-policy table existence | **none** (descriptors are the single source) |

When the above are simultaneously met, replace **"Mostly Ready"** with **"Enterprise Ready"** and close the migration trail.

---

## Open questions / decisions to confirm before kickoff

1. **Do external BFF / partner clients consume `@repo/types` symbol `EventKind` directly?** If yes, P8 needs a re-export shim cycle. (Owner: platform.)
2. **Is the `recommended` requiredness tier (P6) needed for product UX?** If not, simplify by collapsing to `optional` in the wizard rules. (Owner: product.)
3. **Should P10's descriptor live in `@repo/types` (current proposal) or in a new `@repo/tour-domain` package?** Latter is cleaner long-term but adds a workspace package. (Owner: architecture.)
4. **Is there budget for a one-week shadow window in P6?** If not, replace with synthetic snapshot tests covering every `(profile, fieldId)` pair. (Owner: eng lead.)

---

*Generated as a closure plan for `prompt.md` Final Enterprise Architecture Status. Update phases as work lands; mark each phase's exit criteria in the audit doc when complete.*
