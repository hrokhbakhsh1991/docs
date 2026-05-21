# Denali wizard form behavior (deterministic state)

## Principle

Business rules that used to be mirrored in React Hook Form via `useEffect` are now **derived at read time** or enforced in **Zod** at validation/submit. RHF state only holds fields the user (or preset/clone/draft) explicitly sets.

## Removed from form state

| Former field | Replacement |
|--------------|-------------|
| `basicInfo.isMultiDay` | `deriveDenaliIsMultiDay(basicInfo.tourType)` / `denaliTourKindToIsMultiDay` in schema |
| `programNature.difficultyType` | `deriveDenaliDifficultyType(basicInfo.tourType)`; outdoor/event rules use `isDenaliOutdoorTourKind` / `isDenaliEventTourKind` in schema |
| `transport.privateCarAllowed`, `transport.primaryTransportMode` (legacy) | `transport.transportMode` + optional `dongAmount` |
| `pricingPayment.includesTransportInPrice` | Removed; price is independent of transport mode |

Legacy drafts and presets are cleaned by `sanitizeDenaliFormPatch` before merge.

## UI behavior

- **Basics**: End date/time field is shown only when `deriveDenaliIsMultiDay(tourType)` is true (watched `tourType`, no `setValue`).
- **Pricing**: Unchecking “paid tour” clears `basePricePerPerson` in the checkbox `onChange` handler (explicit user action, not `useEffect`).
- **Transport**: Mode and dong amount are user-selected; mapper maps to API logistics.
- **Validation**: Multi-day `endDateTime` requirement uses `tourType`, not a stored boolean.

## Read-only helpers

- `deriveDenaliIsMultiDay`, `deriveDenaliDifficultyType`, `deriveDenaliIsOutdoorTour`, `deriveDenaliIsEventTour`
- `selectDenaliWizardDerived(form)` — snapshot for review/summary UI

## Remaining `useEffect` (non-goals for this refactor)

- `DenaliProgramNatureStep` may set `mainTourThemeId` to the first active workspace theme when empty (schema-required UUID, no MVP picker). This is a catalog default, not derived from `tourType`.

## Bugs removed

1. **Stale `isMultiDay`** after changing `tourType` (stored `false` while slug was `*_multi`).
2. **Event tours failing “Next”** because side effects cleared `difficultyLevel` / `hikingHours` asynchronously after step validation.
3. **`includesTransportInPrice` flipping** when transport mode changed without user intent.
4. **`basePricePerPerson` cleared in `useEffect`** racing with typing in the price field.
5. **Draft restore ghosts** — old `isMultiDay` / `difficultyType` in localStorage overriding current `tourType` until the next effect tick.
6. **Double source of truth** between slug suffix (`_multi`), `isMultiDay`, and `endDateTime` visibility.

## Validation

Single source of truth: `denaliTourCreateSchema` only. See [denali-wizard-validation.md](./denali-wizard-validation.md).

## Files

- Derived: `apps/web/src/features/tours/wizard/denali/denaliWizardDerived.ts`
- Sanitize: `apps/web/src/features/tours/wizard/denali/denaliFormSanitize.ts`
- Schema: `apps/web/src/features/tours/wizard/schemas/denaliTourCreateSchema.ts`
- Step orchestration: `apps/web/src/features/tours/wizard/schemas/denaliTourCreateValidation.ts`
- Deleted: `useDenaliWizardSideEffects.tsx` (no mount-time mutations)
