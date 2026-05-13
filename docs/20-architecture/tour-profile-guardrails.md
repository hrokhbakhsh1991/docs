# Tour profile guardrails — Architecture Guidelines

Paste-ready summary for the internal Architecture Guidelines page. Companion to
`docs/20-architecture/unified-tour-domain-model.md` (the full RFC).

**Operational checklists:** [Profile architecture playbook](../PROFILE_ARCHITECTURE_PLAYBOOK.md).

## Conventions

1. **The only canonical classification axis is `TourFormProfile` / `TourDomainProfile`.**
   Every new piece of profile-dependent behavior reads from the rules layer or domain
   types in `@repo/types`. `EventKind` is **legacy** and remains only inside narrow Edit
   adapters / telemetry (`tourDomainProfileAdapters.ts`, observability) and the legacy
   trip-details widget stack — never in the wizard or API tours module.

2. **Wizard components** (`apps/web/src/components/tours/wizard/**`,
   `apps/web/src/features/tours/wizard/**`):
   - MUST consume rules via `useFieldRule` / `useStepRule` (React) or
     `getFieldRule` / `getStepRule` / `getProfileRules` (pure) from
     `apps/web/src/features/tours/wizard/profileRules/getProfileRules.ts`.
   - MUST NOT import `EventKind` or any legacy `EventKind` helper from `@repo/types`.
   - MUST NOT import `@/features/tours/config/tripDetailsFieldConfig`.
   - MUST NOT branch inline on profile string literals
     (`if (profile === "urban_event") ...`). Move the rule into
     `apps/web/src/features/tours/wizard/profileRules/rules.ts:BASE_FIELD_RULES`.

3. **Edit form** (`apps/web/src/components/tours/TourForm.tsx`,
   `apps/web/src/features/tours/components/tour-create-trip-details-fields.tsx`):
   - MAY derive `EventKind` for the legacy widget — but only through
     `legacyEventKindFromEditFormValues` / `eventKindForDomainProfile` in
     `apps/web/src/features/tours/domain/tourDomainProfileAdapters.ts`.
   - MUST NOT introduce **new** raw `EventKind` checks for business rules; new
     behavior goes through the rules layer (see decision tree in the RFC §8).

4. **Server (`apps/api/src/modules/tours/**`)**:
   - Profile resolution: `resolveTourFormProfileFromTripDetails` /
     `resolveTourFormProfileForCreateDto` in
     `apps/api/src/modules/tours/utils/create-tour-form-profile-strip.ts`.
   - Strip: `stripTripDetailsForFormProfile` in the same file (Phase P10 — driven by
     `packages/types/src/tour-form-profile-descriptors.ts:TOUR_FORM_PROFILE_DESCRIPTORS`).
   - Invariants: `apps/api/src/modules/tours/utils/assert-create-tour-invariants.ts`
     (slim-profile phantom checks also read the descriptor `strip` flags).
   - Shared constants (e.g. `URBAN_LOGISTICS_WHITELIST_KEYS`) live in
     `packages/types/src/tour-domain-profile.ts` and are **referenced** from the
     descriptor row for `urban_event` — server modules MUST import from `@repo/types`
     rather than re-declare these tables.
   - Server endpoints MUST NOT introduce `EventKind` — the canonical server axis is
     `TourFormProfile` / `TourDomainProfile` on the persisted `form_profile_snapshot`
     column. (Verified: `apps/api/src/modules/tours/**` has zero `EventKind` imports today.)

## Lint / static enforcement

| Rule | Where | What it catches |
|---|---|---|
| `no-restricted-imports` for `EventKind`, `EventKindResolverInput`, `resolveEventKindFromTourContext`, `eventKindForDomainProfile` from `@repo/types` | wizard scope (`src/components/tours/wizard/**`, `src/features/tours/wizard/**`, `app/(app)/tours/new/**`, `app/(app)/tours/create/**`) | Any future commit that tries to re-introduce `EventKind` in the wizard fails `pnpm --filter @apps/web eslint`. |
| `no-restricted-imports` for the same symbols (Phase P8) | repo-wide `apps/web` (`src/**`, `app/**`, `lib/**`) with explicit allow-list: `tourDomainProfileAdapters.ts`, `tourDomainProfileAdapters.spec.ts`, `tourProfileObservability.ts`, `tour-create-trip-details-fields.tsx` | New code must read these symbols via the `Legacy` namespace (`import { Legacy } from "@repo/types"`). The `@repo/types` package root **does not** re-export `EventKind` at the top level — `Legacy.*` is the only supported path. |
| `no-restricted-imports` for `@/features/tours/config/tripDetailsFieldConfig` | same | Blocks the Edit-side `EventKind` matrix from wizard. |

Configured in `apps/web/.eslintrc.json` (`overrides[]` block). Default ESLint severity
`error`; the existing `apps/web/package.json` `eslint` script runs `--max-warnings 0`.

The api app has no ESLint config (its `lint` script is `tsc --noEmit`); the server-side
convention is enforced by:

- **`EventKind` is not exported into any api `tours` module** today, and the steering
  JSDoc on `tours.service.ts` + the parity spec `URBAN_LOGISTICS_WHITELIST_KEYS` test
  guard against re-introduction.
- The RFC §8 decision tree, which routes "add a new server rule" to `@repo/types`.

## Recipe (in code)

Top-of-file comment in
`apps/web/src/features/tours/wizard/profileRules/rules.ts` — walks through adding
a new wizard field rule, plus reminders of the ESLint guardrails and which parity
specs will catch drift.

## Quick checklist for reviewers

- New wizard step branches on `profile === "..."`? **Reject** — move to `BASE_FIELD_RULES`.
- New `EventKind` import in wizard scope? **ESLint blocks the PR.**
- New strip table for a profile? **Must live in `@repo/types`** as a descriptor row in
  `tour-form-profile-descriptors.ts` (plus shared constants like
  `URBAN_LOGISTICS_WHITELIST_KEYS`), not as a local copy in the API module.
- New PATCH-time invariant? **Wire through `assertTripDetailsForFormProfile`**, not a
  fresh ad-hoc check at the endpoint.
- New flag for behavior parity? **Read `unified-tour-domain-model.md` §10** before
  adding one — most of the architecture is already byte-identical refactor.
