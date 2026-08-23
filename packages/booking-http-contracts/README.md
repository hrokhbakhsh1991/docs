# `@app-tour/booking-http-contracts`

Portable **wire** contracts for operator Booking HTTP.

**Status:** `0.1.0`, `private: true` — not published.

## Owns

- Booking status / payment status transport enums
- List query + pagination (`limit`/`cursor`) contracts
- Create / approve / reject / bulk / summary response DTOs
- Hand parsers moved from `apps/api` `bookings.routes.ts` (behavior-identical)
- **`BookingPublicPort`** (+ create input/result) — host public create / duplicate / occupancy (Phase B1.4)
- **Duplicate-protection contract** (`booking-duplicate-protection.contract.ts`) — probe kinds + partial-unique index SoT (CW4-07)

## Does not own

- HTTP handlers / `node:http`
- Auth session / error interceptor
- Prisma / repositories / `BookingsService` domain records
- Denali public registration HTTP orchestration
- `@app-tour/booking-http` handler package (deferred — see B1.2 doc)

## Dependency

Runtime: **none** (no zod / workspace packages).
