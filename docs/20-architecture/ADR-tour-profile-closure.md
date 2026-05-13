# ADR — Tour profile model closure (Phases P1 – P11)

**Status:** Accepted.  
**Date:** 2026-05-13.  
**Scope:** the tour-creation / tour-edit domain across `@repo/types`, `apps/api/src/modules/tours/**`, and the wizard + Edit surfaces in `apps/web`.  
**Supersedes:** the running migration plan tracked in `prompt.md` (Phases 2–6 + D1–D4) and `promptq.md` (P1–P11).  
**Related ADRs / docs:**

- [`tour-profile-current-state.md`](./tour-profile-current-state.md) — one-page diagram and triage notes.
- [`unified-tour-domain-model.md`](./unified-tour-domain-model.md) — full RFC, invariants, decision tree.
- [`tour-profile-guardrails.md`](./tour-profile-guardrails.md) — ESLint + fitness rules that enforce this ADR.
- [`../PROFILE_ARCHITECTURE_PLAYBOOK.md`](../PROFILE_ARCHITECTURE_PLAYBOOK.md) — operational checklist for evolving profiles after this ADR.

---

## 1. Context

The tour creation pipeline previously carried **two parallel classification axes**:

- `EventKind` — a legacy enum derived from `tourType` and free-text `tripStyles`, used by the Edit-form matrix (`tripDetailsFieldConfig`), legacy widgets, and a handful of telemetry call sites.
- `TourFormProfile` (alias: `TourDomainProfile`) — a closed enum bound to workspace themes, owning wizard rules, server strip / invariants, and the persisted `form_profile_snapshot` column.

Both axes had drifted: the Edit matrix was keyed off `EventKind`, while the wizard, the create / update DTO contract, and the server invariants were keyed off `TourFormProfile`. The result was a dual-policy surface with ~15–30 files of churn whenever a profile changed, a reverse-projection helper (`domainProfileFromEventKindBestEffort`) that was lossy by construction, and `tourType`-keyed server gates (`applyTourTypeFieldGates`) duplicating logic that the profile resolver already produced.

The audit captured in `prompt.md` (Final Enterprise Architecture Status, ≈ 83 / 100 — _Mostly Ready_) identified the closure work as items D1 – D4 (Phase 5 sunset) plus the broader follow-ups eventually structured as P1 – P11 in `promptq.md`.

---

## 2. Decision

We adopt **`TourFormProfile` as the single canonical classification axis** for the tour domain, materialised as a single declarative descriptor table in `@repo/types`, with `EventKind` confined to a narrow, ESLint-enforced legacy island used only for telemetry and one legacy widget. Specifically:

1. **One source of truth.** Every profile-axis decision (inactive wizard groups, FA display key, default `TourType`, server strip deltas, invariant flags) is encoded in `TOUR_FORM_PROFILE_DESCRIPTORS` in `packages/types/src/tour-form-profile-descriptors.ts`. Wizard rules, Edit matrix, server strip, server invariants, and the mountain-overview gate all read from this table (Phase P10).
2. **Server is authoritative.** The create / PATCH pipeline resolves `TourFormProfile` first (profile-first precedence: explicit DTO field → workspace theme → `tourType` fallback), strips inactive groups using the descriptor, applies the mountain gate using the descriptor, asserts invariants using the descriptor, then writes `form_profile_snapshot`. The resolved branch is emitted as `tour.form_profile_resolution` for adoption telemetry (Phase P9).
3. **No reverse projection.** `EventKind → TourDomainProfile` no longer exists at runtime. The only sanctioned bridge is the one-way `eventKindForDomainProfile` projection, available exclusively under the `Legacy` namespace from `@repo/types` (Phases P5, P8).
4. **`EventKind` is an isolated compatibility layer.** All `EventKind` symbols are accessed exclusively via `import { Legacy } from "@repo/types"` (`Legacy.EventKind`, `Legacy.resolveEventKindFromTourContext`, `Legacy.eventKindForDomainProfile`). The package root **does not** re-export these symbols — external BFFs must migrate to `Legacy.*`. ESLint forbids direct `Legacy.EventKind` imports anywhere in `apps/web` outside an explicit four-file allow-list (`tourDomainProfileAdapters.ts`, its spec, `tourProfileObservability.ts`, `tour-create-trip-details-fields.tsx`) and the wizard scope is allow-listed to **zero** files. The API tours module never imports `EventKind` (CI-enforced).
5. **First-party writers send `formProfile` explicitly.** The wizard, the Edit PATCH path, and the in-repo seed script all emit `formProfile` whenever the resolved profile is known. Partner / headless callers may omit it; the resolver still produces the correct answer.
6. **Adding a new profile is a table edit, not a code change.** The descriptor row carries every structural concern; the documented checklist in `PROFILE_ARCHITECTURE_PLAYBOOK.md` lists the ≤ 5 files involved. The parity specs (`packages/types/src/tour-form-profile-descriptors.spec.ts`, `apps/web/.../parity-with-server.spec.ts`, `apps/api/.../create-tour-form-profile-strip.spec.ts` P10 probes) fail loudly if any consumer drifts from the descriptor.

---

## 3. Consequences

### 3.1 Positive

- **One classification axis.** Reviewers no longer need to ask "which kind axis owns this?" — the answer is always `TourFormProfile`.
- **Predictable blast radius for new profiles.** ≤ 5 files touched + 1 i18n key + 1 smoke row, validated by the descriptor parity specs.
- **Server is the only authority for correctness.** Strip, mountain gate, and invariants all share the descriptor table; clients cannot drift from the server's view of the profile.
- **Observability for write adoption.** Every successful create emits `resolution_source` so operators can track first-party / partner adoption without reading code.
- **Strong guardrails.** Two layers of CI fitness (the `scripts/check-tour-domain-guardrails.mjs` script + `apps/api/src/modules/tours/fitness.spec.ts`) plus repo-wide ESLint overrides make architectural regressions blocked-by-CI, not caught-in-review.

### 3.2 Negative / accepted compatibility costs

- **One-cycle `EventKind` deprecation shim** at the top level of `@repo/types` — **closed**
  (housekeeping): top-level `EventKind` / resolver / bridge re-exports were removed; the
  only supported path is `Legacy.*`.
- **Edit `tripDetailsFieldConfig` matrix is still distinct from the wizard `BASE_FIELD_RULES` table** (post Phase P6 first-pass). They share the `TourFormProfile` axis and parity tests pin every `(profile, fieldId)` row. The **`recommended` requiredness tier** has been folded into the wizard rules layer (Phase P12 follow-up, see [`promptq.md`](../../promptq.md) P10 "Optional follow-up"): `FieldRule.required` now includes `"recommended"` (non-blocking at every validation level), and the descriptor's `edit.tripDetailsPresetOverrides` rows tagged `"recommended"` propagate into `PROFILE_FIELD_REQUIRED_OVERRIDES` in `apps/web/src/features/tours/wizard/profileRules/rules.ts`. The Edit adapter (`tripDetailsFieldConfigAdapter.ts`) reads the tier from the wizard rule. **Phase P15 (2026-05-13)** split the former monolith: `editFieldRbac.ts` (RBAC resolver), `editCoreFieldConfig.ts` (`core.*` capacity), and a slimmed `tripDetailsFieldConfig.ts` (trip-details matrix + re-exports). New spec `editTripDetailsWizardPathDivergence.spec.ts` + exported `TRIP_DETAILS_FIELD_IDS` catalogue every matrix row as exact wizard path / documented alias / Edit-only inventory — **physical deletion** of `tripDetailsFieldConfig.ts` remains blocked on a **path-namespace convergence** slice (Edit `tripDetails.*` RHF ids vs `TourCreateFormValues` wizard paths), estimated **L (≈ 5–8 dev-days)**, not a mechanical `BASE_FIELD_RULES` row append. **Outstanding sub-item:** `"required"` preset rows are deliberately **not** mirrored yet — UX sign-off; tracked separately.
- **`mountain_outdoor` Edit preset rows** (required / `"recommended"`) live in `TOUR_FORM_PROFILE_DESCRIPTORS.edit.tripDetailsPresetOverrides`. They are materialised by `tripDetailsFieldConfig.ts` (Edit-only paths) and `rules.ts` (`recommended` rows for paths already in `BASE_FIELD_RULES`); the descriptor is the single authorable surface.
- ~~**`trip-details-inventory-policy.ts` retains `MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS`** as the canonical key list~~ — **closed in P14 (2026-05-13)**. The canonical authoring location is now `tour-form-profile-descriptors.ts`; `trip-details-inventory-policy.ts` is a one-line back-compat re-export shim. The descriptor is the unambiguous single source for every mountain-policy decision (key list + per-profile strip + Edit hidden-field ids).

### 3.3 Neutral

- **`TourDomainProfile` and `TourFormProfile` remain distinct names** for the same value set. The wording disambiguates "form-shape axis" vs "domain-behavior axis"; runtime identity (`I-2`) is pinned by a spec.

---

## 4. Status of migration items

| Item | Source | Disposition |
|---|---|---|
| D1 — `tripDetailsFieldConfig` rebased onto profile axis | `prompt.md` Phase 5 | **Closed** (P6 first-pass + P12 tier fold-in + P13 wizard-UI surfacing + P15 module split + **P16 adapter alias pilot**). `EVENT_KIND_CONFIGS` removed; matrix is `TourFormProfile`-keyed; `"recommended"` tier in wizard rules + Edit adapter + wizard `FormField` badge. `tripDetailsFieldConfig.ts` slimmed (trip-details only); RBAC → `editFieldRbac.ts`; `core.*` → `editCoreFieldConfig.ts`; path-divergence catalog → `editTripDetailsWizardPathDivergence.spec.ts`. Adapter owns `EDIT_TO_WIZARD_PATH_ALIASES` (pilot: `overview.shortIntro` → `overview.shortDescription`), so the wizard rule is the canonical source for the row's policy. Follow-up: graduate the remaining ~10 documented aliases one row at a time, then convergence is complete and the matrix file can be deleted. |
| D2 — Retire `legacyEventKindFromEditFormValues` + flip flag | `prompt.md` Phase 5 | **Closed** (P7). `useUnifiedTourDomainProfileForEditResolver` default ON; emergency kill switch retained for one cycle; symbol reclassified to drift telemetry only. |
| D3 — Delete `domainProfileFromEventKindBestEffort` | `prompt.md` Phase 5 | **Closed** (P5). Symbol deleted from `@repo/types`, package exports, ESLint, fitness CI, and docs. |
| D4 — Narrow `EventKind` surface in `@repo/types` | `prompt.md` Phase 5 | **Closed** (P8). `Legacy` namespace is the **only** supported import path; top-level `EventKind` / resolver / bridge re-exports removed from the package root (post in-repo migration). ESLint enforces `Legacy.*` repo-wide outside the four-file allow-list. |
| Profile-first write adoption | `prompt.md` recommendation #4 | **Closed for first-party callers** (P9). Adoption metric via `tour.form_profile_resolution`. |
| Declarative profile descriptor | `prompt.md` recommendations #1, #4 | **Closed** (P10 first-pass). `TOUR_FORM_PROFILE_DESCRIPTORS` table + parity specs land; optional UI-literal fold-in deferred. |
| Current-state diagram + ADR | `prompt.md` recommendation #5 | **Closed** (P11 — this ADR + `tour-profile-current-state.md`). |

No further items from the running migration plan are open. Outstanding work is itemised in §3.2 as accepted compatibility costs / optional follow-ups, not as missing closure work.

---

## 5. Enforcement

The decisions in §2 are enforced **mechanically**, not by convention:

| Enforcement | Where | What it catches |
|---|---|---|
| `no-restricted-imports` for `EventKind` family in the wizard scope | `apps/web/.eslintrc.json` overrides | New wizard code re-introducing `EventKind`. |
| `no-restricted-imports` for `EventKind` family repo-wide (4-file allow-list) | same | New code in `apps/web` reading legacy symbols outside the allow-list (must use `Legacy.*`). |
| `no-restricted-imports` for `@/features/tours/config/tripDetailsFieldConfig` from wizard | same | Wizard reaching into the Edit matrix. |
| `scripts/check-tour-domain-guardrails.mjs` (CI workflow) | repo root | New `EventKind` imports under `apps/api/src/modules/tours/**` or the wizard scope. |
| `apps/api/src/modules/tours/fitness.spec.ts` (`pnpm --filter @apps/api lint:fitness`) | API tours module | Same as above, plus `domainProfileFromEventKindBestEffort`. |
| Descriptor parity tests | `packages/types`, `apps/web`, `apps/api` (per §2 item 6) | Any drift between `TOUR_FORM_PROFILE_DESCRIPTORS` and its consumers. |
| `tour.form_profile_resolution` structured log | `apps/api/.../tours-profile-observability.ts` | Tracks profile-first write adoption in the log pipeline (operational signal, not a build-time check). |

---

## 6. Revisiting this ADR

This ADR should be revisited when **any** of the following happen:

1. A new classification axis is proposed (e.g. "tour shape", "marketplace tier") that does not naturally compose with `TourFormProfile` — likely a new descriptor field or a sibling descriptor module rather than a new axis.
2. ~~The deprecation cycle for the top-level `EventKind` re-exports completes.~~ **Done** — revisit only if a future semver policy wants to move `Legacy` to a separate package.
3. ~~The `recommended` requiredness tier is folded into the rules layer **and surfaced in the wizard UI**.~~ **Done (P12 + P13, 2026-05-13)** — `FieldRule.required === "recommended"` is supported and parity-tested against the descriptor (P12); `@tour/ui` `FormField.recommendedLabel` renders a non-blocking "پیشنهادی" badge, and `useIsFieldRecommended` is wired into the four mountain-only paths in `LogisticsStep` / `ParticipationStep` (P13). Revisit only when the remaining Edit-only paths are registered into `BASE_FIELD_RULES`, allowing `tripDetailsFieldConfig.ts` to be deleted.
4. A net-new `TourFormProfile` literal is added: validate that the actual blast radius matches the ≤ 5-file target the descriptor promises; if it does not, the descriptor is missing a field.

---

## 7. Acceptance signals

- `prompt.md` **Final Enterprise Architecture Status** scores promoted to reflect the closure: architecture maturity ≥ 92, maintainability ≥ 90, enterprise readiness ≥ 91 (target ≥ 95 / ≥ 92 / ≥ 94 from `promptq.md` §"Acceptance criteria" — the remaining gap is mostly the partner `formProfile` adoption curve and the still-pending registration of Edit-only paths into `BASE_FIELD_RULES`, **not** missing architecture; the `"recommended"` tier closure landed in P12).
- Zero `EventKind` imports in `apps/api/src/modules/tours/**` (CI-enforced).
- Profile-first write adoption is observable (telemetry shipped) and ≥ 90 % targeted across the next release cycle once partner callers migrate off `tourType`-only writes.
- New-profile change surface is ≤ 5 files + 1 i18n key, validated by the descriptor table + the playbook checklist.

---

*This ADR captures the architectural endpoint reached after Phases P1–P11. Subsequent changes to the tour profile model should reference this document as the baseline and append amendments rather than restart the audit.*
