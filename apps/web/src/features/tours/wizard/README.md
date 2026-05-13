# Tour create wizard (domain)

## Entry points

- UI: `@/components/tours/wizard/TourCreateWizard`
- Wrapper (clone / draft restore): `app/(app)/tours/new/tour-create-wizard-wrapper.tsx` — smoke: `tests/smoke/tour-wizard-clone-query.spec.ts`
- Mapper: `@/features/tours/wizard/domain/mapWizardFormToCreateTourPayload` (`mapFormValuesToBackendPayload`)
- Submit: `@/features/tours/wizard/hooks/useTourWizardCreate` → `stripInactiveTourCreateGroupsForProfile` → `createTour` + `mapCreateTourDto` (+ optional theme catalog). Profile→Zod flags: `tourFormProfileToWizardValidationFlags` in `TourCreateWizard` via `tourCreateValidationPolicy.ts`.

## Legacy re-export

`@/lib/mappers/mapTourCreateFormToDto` re-exports the mapper for older imports.

## Steps config

See `stepConfig.ts` for wizard step IDs, Persian titles, and `trigger()` field lists used before «بعدی».

## Field groups (Phase 2)

See `fieldGroups.ts` for `TourFormProfile` → inactive groups, skipped steps, and top-level form roots for future strip-on-save. Execution checklists: `docs/20-architecture/tour-wizard-phases-1-3-checklists.md`.
