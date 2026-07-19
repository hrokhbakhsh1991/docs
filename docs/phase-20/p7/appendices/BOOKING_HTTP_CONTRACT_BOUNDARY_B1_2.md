# Booking HTTP Contract Boundary (Phase B1.2)

```yaml
doc_id: BOOKING_HTTP_CONTRACT_BOUNDARY_B1_2
phase: B1.2
status: LANDED
date: "2026-07-19"
authority:
  - Finance Phase 1.4 C1 — @app-tour/finance-http-contracts
  - Booking Evolution Plan B1.2 (contracts ownership; handlers deferred)
constraints:
  - HTTP contract ownership only
  - NO route / authz / repository / Prisma / BookingsService logic changes
  - NO Denali / public registration HTTP moves
  - NO dependency registry wiring
  - apps/api keeps auth, server, route registration, error mapping, composition
```

## Goal

Extract operator Booking **wire contracts** (request/response DTOs, status enums,
list/pagination shapes, body/query parsers) into a portable package — Finance
`finance-http-contracts` pattern — without changing HTTP behavior.

## Package

`@app-tour/booking-http-contracts` → `packages/booking-http-contracts`

| Owns | Does not own |
| ---- | ------------ |
| Transport status / payment enums | Prisma / repositories |
| List query + pagination contracts | `node:http` handlers |
| Create / approve / reject / bulk / summary response DTOs | Session / auth |
| `parseBookingsListQuery`, `parseCreateBookingBody`, bulk/reject/receipt JSON parsers | Finance receipt binary upload / MinIO |
| | Denali public registration HTTP |

Runtime deps: **none** (parsers are hand-ported from `bookings.routes.ts` for bit-identical behavior).

## apps/api after B1.2

| Layer | Ownership |
| ----- | --------- |
| `bookings.routes.ts` | Handlers + host error mapping; imports parsers/DTOs from contracts |
| `bookings.service.ts` | Domain use-cases; imports HTTP DTOs from contracts (not route modules) |
| `bookings.types.ts` | Domain/persistence shapes (`BookingRecord`, repo page types, duplicates); re-exports wire types from contracts for local convenience |
| `app.ts` | Route registration unchanged |

## Intentionally deferred (`@app-tour/booking-http`)

Finance Phase 1.4 **C2** moved handlers into `finance-http` + host ports.
B1.2 does **not** move Booking handlers: apps/api remains the HTTP orchestration host
so route/auth/error paths stay byte-stable. Handler extraction + host-port injection
is a follow-up (aligns with B1.5 tenant composition / Evolution Plan C2).

## Structural proof

`apps/api/src/bookings/booking-http-contracts-boundary.spec.ts`

- contracts package source has no `apps/api` / Prisma imports
- `BookingsService` imports contracts (or domain types), never `node:http` / `bookings.routes`
- repository sources unchanged w.r.t. contracts package (no HTTP DTO ownership)

## Architecture report (B1.2)

### Files changed

| Area | Files |
| ---- | ----- |
| Doc | `docs/phase-20/p7/appendices/BOOKING_HTTP_CONTRACT_BOUNDARY_B1_2.md` |
| Package | `packages/booking-http-contracts/**` |
| Host | `apps/api/package.json`, `bookings.types.ts`, `bookings.service.ts`, `bookings.routes.ts`, `bookings-service-di.spec.ts` |
| Tests | `apps/api/src/bookings/booking-http-contracts-boundary.spec.ts` |

### Runtime changes

**NONE** — parsers copied bit-identically; handlers/auth/error mapping stay in `apps/api`.

### Gap to B1.3

B1.3 = booking-ws2 registry-only fixture (capability deps), not HTTP. Optional follow-up: `@app-tour/booking-http` handler extraction (Finance C2).

### Risks

- Dual SoT if someone re-adds local parsers in routes
- `bookings.types` re-exports can blur domain vs wire ownership
- Deferred `booking-http` means route registration stays hardcoded in `app.ts`
