# Tour create wizard (domain)

## Entry points

- UI: `@/components/tours/wizard/TourCreateWizard`
- Mapper: `@/features/tours/wizard/domain/mapWizardFormToCreateTourPayload` (`mapFormValuesToBackendPayload`)
- Submit: `@/features/tours/wizard/hooks/useTourWizardCreate` → `createTour` + `mapCreateTourDto` (+ optional theme catalog)

## Legacy re-export

`@/lib/mappers/mapTourCreateFormToDto` re-exports the mapper for older imports.

## Steps config

See `stepConfig.ts` for wizard step IDs, Persian titles, and `trigger()` field lists used before «بعدی».
