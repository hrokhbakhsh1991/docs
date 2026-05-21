# Denali wizard MVP UI (canonical alignment)

## 5-step rail

| Step | Component | Canonical section |
|------|-----------|-------------------|
| 1 | `DenaliBasicInfoStep` | `basics` |
| 2 | `DenaliProgramNatureStep` | `program` |
| 3 | `DenaliTransportStep` | `transport` |
| 4 | `DenaliPricingPaymentStep` | `pricing` |
| 5 | `DenaliReviewStep` | summary, mountain `DenaliReviewParticipantSection` (`submit_only` rules), optional `policies.cancellationPolicy` |

**Removed rail ids (historical only):** `denali_participants`, `denali_policies` — see `DENALI_MVP_REMOVED_STEPS` in `denaliStepConfig.ts`.

## User-visible fields per step

### Basics
- `title`, `category`, `duration`, `eventVariant` (events only), `destinationId`, `startsAt`, `endsAt` (multi-day only), `capacity.max`, `capacity.min`, `meetingPoint`
- Legacy adapter: writes `basicInfo.tourType` slug via `denaliTourKindFromCanonical` (not shown)

### Program
- `mainThemeId`, `shortDescription`, `longDescription`
- Outdoor only: `outdoorDetails.difficultyLevel`, `outdoorDetails.hikingHoursApprox`

### Transport
- `mobility` (`transportMode`), `carshareAmountPerSeat` (`dongAmount` when shared cars), `notes`

### Pricing
- `isPaid`, `pricePerPerson` (when paid)
- `paymentMode` — default only, no UI

### Review
- Read-only summary; mountain participants (`minimumAge`, `fitnessLevel`, `sportsInsuranceRequired`) when rule model `submit_only` paths are visible
- Optional `policies.cancellationPolicy`

## Removed from UI

| Removed | Reason |
|---------|--------|
| 8-slug `tourType` dropdown | Replaced by category + duration + event variant |
| `isMultiDay` | Derived from duration |
| `difficultyType` | Derived from category |
| `secondaryTourThemeIds` | Post-MVP |
| `altitudeGainApprox`, `itineraryOutline` | Post-MVP |
| Transport matrix (primary mode, private car flags, dong modes) | MVP `transportMode` enum |
| `includesTransportInPrice` | Removed MVP |
| Hidden `paymentMode` input | Default in form seed only |
| `experienceLevel`, gear checklists | Post-MVP |
| Five policy textareas | Single notes on review |
| `useEffect` theme auto-set | Explicit theme select |
| `useEffect` / `setValue` transport coercion | Schema normalize + explicit pricing checkbox |

## Adapter

`denaliCanonicalBasicsControl.ts` — read/write between canonical basics controls and `basicInfo.tourType`.
