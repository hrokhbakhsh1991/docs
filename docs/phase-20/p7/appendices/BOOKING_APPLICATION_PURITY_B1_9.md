# Booking Application Purity (Phase B1.9)

```yaml
doc_id: BOOKING_APPLICATION_PURITY_B1_9
phase: B1.9
status: LANDED
date: "2026-07-19"
authority:
  - Finance Phase 1.11–1.16 / 2.2.1 finance-core boundary guard
  - Booking Evolution Plan B1.9
  - docs/phase-20/p7/appendices/BOOKING_BOUNDARY_B0_1.md §1 / §6
constraints:
  - NO package extraction (Booking stays under apps/api/src/bookings)
  - NO Prisma / RLS / outbox moves
  - NO approve TX / domainEventId changes
  - Guard fails CI on application boundary breaches
```

## Goal

Bring the Booking **application** layer to Finance-core-style purity **without** extracting
`packages/booking-core`. Composition, HTTP, Prisma, and generated bindings remain host-owned.

## Application surface (scanned)

| Path | Role |
| ---- | ---- |
| `bookings.service.ts` | Use-cases (ports + contracts + domain types only) |
| `bookings.types.ts` | Domain / DTO types |
| `bookings.errors.ts` | Domain errors |
| `booking-payment-status.ts` | Payment status raise helper |
| `booking-active-duplicate.ts` | Duplicate activity rules |
| `booking-list-query.ts` | List filter / keyset helpers |
| `bookings-member-summary-projection.ts` | Member summary caps |
| `ports/*.ts` | Application ports |

`createBookingsService(deps)` on the service module is allowed (Finance `createFinanceService` mirror).

## Explicitly out of application (not scanned)

| Path | Owner |
| ---- | ----- |
| `bookings.routes.ts` | HTTP |
| `prisma-bookings.repository.ts` / `in-memory-*.ts` | Persistence |
| `create-bookings-service.ts` / `create-bookings-repository.ts` | Composition / factories |
| `infrastructure/**` | Host adapters |
| `*.generated.ts` / thin registries / tenant resolve | Host capability wiring |
| `bookings-outbox-projection.ts` | Outbox / persistence projection |
| `enrich-tour-accepted-counts.ts` | **Host-adjacent** (composition façade + tour list shape) |

## Forbidden (application)

| Class | Examples |
| ----- | -------- |
| Prisma | `@prisma/client`, `Prisma.TransactionClient` |
| Host infrastructure imports | `../db/`, `../http/`, `../outbox/`, `./infrastructure/` |
| Workspace packages | `@app-tour/workspace-*`, `@app-tour/workspace-sdk` |
| HTTP | `node:http` |
| Env / logging | `process.env`, `console.*` |
| Factories / locators | `getBookingsRepository`, `createBookingsRepository`, imports of `create-bookings-*.ts` |
| Generated bindings | `*.generated` |

## Allowed

- Relative imports within the application surface (`./ports/*`, `./bookings.types`, …)
- `@app-tour/booking-http-contracts`
- Ports, domain helpers, application logic

## Guard

```bash
pnpm run guard:booking-boundary
```

Script: `scripts/guards/guard-booking-boundary.mjs`

Negative fixture (must **not** be imported by production):

`apps/api/src/bookings/test/fixtures/illegal-prisma-import.ts`

Proof:

```bash
node scripts/guards/guard-booking-boundary.mjs --scan-file apps/api/src/bookings/test/fixtures/illegal-prisma-import.ts
# → FAIL (non-zero) — fixture proves detection
```

## Tests

`apps/api/src/bookings/booking-application-purity.spec.ts`

- Application surface passes `guard:booking-boundary`
- Negative Prisma fixture fails the guard when scanned
- `BookingsService` has zero Prisma / workspace / env / console / HTTP / factory imports

## Runtime

**Unchanged** — guard + classification only; no approve / repository / HTTP behavior edits.
