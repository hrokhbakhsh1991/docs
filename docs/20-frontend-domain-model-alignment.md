# Frontend domain model alignment (backend-aware mocks)

The web app still uses **in-memory mocks only** (no real HTTP). Types and mock payloads follow **`apps/api/openapi.json`** so swapping in an API client later is straightforward.

## Where shared types live

**Package:** `packages/types` (`@repo/types` on npm)  
**Entry:** `packages/types/src/index.ts`

| Frontend type | Backend source (OpenAPI schema) |
|---------------|----------------------------------|
| `TourResponseDto`, aliases `TourDto`, `Tour` | `components.schemas.TourResponseDto` |
| `TourLifecycleStatus` | `UpdateTourDto.lifecycle_status` enum |
| `RegistrationResponseDto`, aliases `BookingDto`, `Booking` | `components.schemas.RegistrationResponseDto` |
| `RegistrationStatus`, `RegistrationPaymentStatus`, transport/entry enums | Same registration schema |
| `WebCredentialDto`, `WebSessionDto`, `WebSessionResponseDto` | Auth/session schemas |
| `UserDto`, `User` | No standalone User entity in OpenAPI today — **`Pick` of `WebSessionResponseDto`** (`user_id`, `tenant_id`, `entry_mode`) |

## Mock-only extensions (intentional drift)

These stay **outside** `@repo/types` and live next to web mocks:

| Layer | Extra fields | Reason |
|-------|----------------|--------|
| `MockTour` (`apps/web/.../tours/mock-types.ts`) | `lifecycleStatus` | GET tour response in spec does not expose lifecycle; UI needs it for badges/forms. |
| `MockBooking` (`apps/web/.../bookings/mock-booking-types.ts`) | `tourTitleMock`, `tourStartDateMock`, `tourPriceAmountMock` | Denormalized tour snapshot for list/detail without fetching tours. |
| `MockBooking` | `participantEmailMock` | Not on `RegistrationResponseDto`; used only for mock UX. |

Core arrays/objects **otherwise match** DTO field names and enums (`camelCase` as serialized in OpenAPI examples).

## Related doc

Older narrative (mixed EN/fa): `docs/20-frontend/domain_model_alignment.md`.
