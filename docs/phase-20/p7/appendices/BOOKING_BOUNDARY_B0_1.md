# Booking Boundary Definition (Phase B0.1)

```yaml
doc_id: BOOKING_BOUNDARY_B0_1
phase: B0.1
status: BOUNDARY_DEFINITION_ONLY
date: "2026-07-19"
head_ref: "1639d421b234f287d1758c796132bf4e02266f6d"
authority: >
  Booking hostile architecture audit + Booking Evolution Plan (B0–B1.11).
  Finance Phase 0 ownership pattern is the reference (ports / composition /
  no behavior change in this phase).
implementation: none
constraints:
  - no runtime behavior change
  - no code moves in this document
  - classify only
  - no extraction
```

> **Purpose:** Define the Booking **application** boundary. Everything else is
> Host, Workspace, Infrastructure, HTTP, Outbox, or Persistence. Migration
> phases cite the Booking Evolution Plan (`B0` … `B1.11`).

---

## 1. Desired Booking application boundary

### 1.1 In scope (application logic only)

| Concern | Meaning |
| ------- | ------- |
| Booking lifecycle | Create pending booking; public create entry that only persists pending |
| Approve | pending \| waitlisted → approved (+ lifecycle event intent) |
| Reject | pending \| waitlisted → rejected |
| Booking state transitions | Status pipeline rules; paymentStatus raise-only projection |
| Booking projections | List/summary/tourChips; acceptedCount enrichment; member summary row shaping; list filters/keyset helpers |
| Booking domain helpers | Duplicate activity rules; intake nationalId read; paymentStatus rank |

### 1.2 Out of scope (must not live in application)

| Class | Examples |
| ----- | -------- |
| **Host** | Boot composition, tenant→workspace resolve, identity session, tour list call sites, Finance↔Booking adapters at composition |
| **Workspace** | Denali registration orchestration, capacityMax read, intake validation, ops UI manifest, `workspaceType === "denali"` gates |
| **Infrastructure** | Storage driver selection, Prisma admin, RLS session, MinIO receipt proof, Service Locator singletons |
| **HTTP** | `node:http` handlers, body parse, status codes, rate-limit context |
| **Outbox** | `enqueueOutboxEvent`, outbox Prisma selects, relay |
| **Persistence** | `OperatorRegistration` Prisma model/access, `withTenantRls`, SQL selects |

### 1.3 Boundary diagram (desired)

```text
                    ┌─────────────────────────────────────┐
   HTTP / Host      │  composition root (lazy / factory)  │
   Workspace        │  adapters (payment, display, public)│
                    └─────────────────┬───────────────────┘
                                      │ ports only
                    ┌─────────────────▼───────────────────┐
                    │  Booking APPLICATION                 │
                    │  types · service · domain helpers    │
                    │  projections · port interfaces       │
                    │  domain errors                       │
                    └─────────────────┬───────────────────┘
                                      │ BookingsRepositoryPort
          ┌───────────────────────────┼──────────────────────┐
          ▼                           ▼                      ▼
   Persistence                 Outbox (via repo)      Infrastructure
   Prisma / memory             enqueue in TX          storage driver
```

---

## 2. Files inspected

### 2.1 Primary tree — `apps/api/src/bookings/` (12 files)

| File | Lines of responsibility (as found) |
| ---- | ---------------------------------- |
| `bookings.types.ts` | Domain / DTO types |
| `bookings.service.ts` | Application use-cases + authz + Service Locator |
| `booking-payment-status.ts` | Domain helper (raise-only paymentStatus) |
| `booking-list-query.ts` | Domain / projection helpers (filters, keyset, day) |
| `bookings-member-summary-projection.ts` | Projection caps / cancelled status constants |
| `bookings-outbox-projection.ts` | Outbox read bound + Prisma-shaped select |
| `enrich-tour-accepted-counts.ts` | Application projection onto tour list DTO |
| `in-memory-bookings.repository.ts` | Port type + errors + memory persistence + outbox fake + seed |
| `prisma-bookings.repository.ts` | Persistence + RLS TX + outbox enqueue + Prisma selects |
| `create-bookings-repository.ts` | Infrastructure composition / Service Locator |
| `bookings.routes.ts` | HTTP adapters + Finance receipt bridge |

### 2.2 Adjacent host / workspace / finance (coupling surface)

| File | Why inspected |
| ---- | ------------- |
| `apps/api/src/app.ts` | Dispatches `/bookings*` → route handlers |
| `apps/api/src/http/configure-workspace-denali-product-http-host.ts` | Wires Denali public booking port → `bookings.service` |
| `apps/api/src/workspace-finance/infrastructure/booking-payment.adapter.ts` | Finance Option C → Booking paymentStatus |
| `apps/api/src/workspace-finance/infrastructure/booking-registration-display.adapter.ts` | Finance display via `getBookingsRepository` |
| `apps/api/src/identity/compile-user-booking-summary.ts` | Member booking projection compile |
| `apps/api/src/identity/users.service.ts` | Loads bookings via repository factory |
| `apps/api/src/identity/users.types.ts` | Imports Booking status/payment types |
| `apps/api/src/tours/list-tours-operator.ts` | Calls enrich acceptedCount |
| `apps/api/src/tours/get-tour-operator.ts` | Calls enrich acceptedCount |
| `apps/api/prisma/schema.prisma` (`OperatorRegistration`) | Persistence SoT |
| `packages/workspaces/denali/src/http/ports/public-booking.port.ts` | Workspace-named public port |
| `packages/workspaces/denali/src/http/registration.service.ts` | Workspace create/validate/capacity |
| `packages/workspaces/denali/src/bookings/ops-manifest.ts` | Workspace ops UI capability |
| `packages/workspace-sdk/src/operator/bookings/registration-ops-manifest.ts` | Shared ops manifest types |

### 2.3 Explicitly not treated as Booking application

- `apps/api/src/registrations/registration-capacity.service.ts` (urban capacity — Host/product other surface)
- Finance engine (`workspace-finance/**`) except Booking adapters listed above
- Web UI (`apps/web/**/bookings/**`) — HTTP client / presentation (out of B0.1 API boundary table; noted for later B1.6)

---

## 3. Boundary table

Columns: **Current file** · **Current owner** · **Correct owner** · **Migration phase**

### 3.1 Inside `apps/api/src/bookings/`

| Current file | Current owner | Correct owner | Migration phase |
| ------------ | ------------- | ------------- | --------------- |
| `bookings.types.ts` | Mixed folder (de facto App) | **Application** (domain/DTO types). Split later: strip `BookingOutboxRecord` persistence shape if kept only for infra | **B0** (keep); optional type split **B1.9** |
| `bookings.service.ts` | Application + Host authz + Infrastructure Service Locator | **Application** use-cases only. Authz via Host port; repository via injected port; outbox event name via capability/registry later | **B0** DI + actor port; **B1.1** event/policy injection; **B1.9** purity |
| `booking-payment-status.ts` | Application (pure) | **Application** domain helper | **B0** keep |
| `booking-list-query.ts` | Application (pure) | **Application** projection helpers | **B0** keep |
| `bookings-member-summary-projection.ts` | Application constants | **Application** projection constants | **B0** keep |
| `enrich-tour-accepted-counts.ts` | Application projection; imports `@app-tour/workspace-sdk` `TourListProjection` | **Application** projection; tour DTO type should be Host/SDK adapter input — not hard SDK dep long-term | **B0** keep behavior; **B1.9** decouple SDK type |
| `bookings-outbox-projection.ts` | Mixed (cap constant + Prisma select) | **Outbox** / **Persistence** (`OUTBOX_EVENT_LIST_SELECT`); cap may stay Application constant | **B0** classify; move select **B0**/`B1.9` with Prisma repo |
| `in-memory-bookings.repository.ts` — `BookingsRepository` type | Co-located with memory impl | **Application** port (`BookingsRepositoryPort`) | **B0** extract port file |
| `in-memory-bookings.repository.ts` — domain errors | Co-located with memory impl | **Application** domain errors | **B0** move next to service/types |
| `in-memory-bookings.repository.ts` — `InMemoryBookingsRepository` + store + seed | Persistence test double + Host seed | **Persistence** (memory adapter); seed **Host**/test | **B0** folder `infrastructure/` |
| `in-memory-bookings.repository.ts` — approve/reject transition checks | Persistence adapter embeds transition rules | **Application** owns transition rules; adapter executes | **B0** document; logic relocate **B1.9** if duplicated |
| `prisma-bookings.repository.ts` | Persistence + Outbox + Infrastructure (RLS, admin Prisma) | **Persistence** + **Outbox** (enqueue in TX) + **Infrastructure** (`withTenantRls`, `getPrismaAdmin`) | **B0** `infrastructure/prisma-bookings.repository.ts` |
| `prisma-bookings.repository.ts` — `BOOKING_LIST_SELECT` | Persistence projection | **Persistence** | **B0** keep with Prisma repo |
| `create-bookings-repository.ts` | Infrastructure composition + `process.env` | **Host** composition / **Infrastructure** factory | **B0** composition root (`lazy-bookings` / factory); service stops calling it |
| `bookings.routes.ts` — list/create/approve/reject/summary/bulk | HTTP | **HTTP** (`booking-http` later) | **B1.2** |
| `bookings.routes.ts` — receipt upload/status | HTTP + Host Finance bridge | **HTTP** façade over **Host** Finance resolve — not Booking application | **B0** classify; **B1.2** keep on host finance wire |

### 3.2 Persistence schema

| Current file | Current owner | Correct owner | Migration phase |
| ------------ | ------------- | ------------- | --------------- |
| `apps/api/prisma/schema.prisma` → `OperatorRegistration` | Persistence (shared schema) | **Persistence** (Booking aggregate SoT; name remains registration table) | No move; naming honesty **B0** docs only |

### 3.3 Host / Identity / Tours / Finance adapters

| Current file | Current owner | Correct owner | Migration phase |
| ------------ | ------------- | ------------- | --------------- |
| `apps/api/src/app.ts` (`/bookings*` dispatch) | Host HTTP | **Host** + **HTTP** registration | **B1.2** (handler package swap) |
| `http/configure-workspace-denali-product-http-host.ts` | Host + Workspace wire | **Host** composition of Workspace HTTP + Booking public port | **B1.4** / **B1.5** |
| `workspace-finance/.../booking-payment.adapter.ts` | Host Finance infrastructure | **Host** / **Infrastructure** adapter (Finance port → Booking persistence). Domain helper `raiseBookingPaymentStatus` stays Application | **B0** keep location; stop default `getBookingsRepository()` **B0**/Finance DI purity already mostly done |
| `workspace-finance/.../booking-registration-display.adapter.ts` | Host Finance infrastructure | **Host** / **Infrastructure** | Keep; inject repo **B0** |
| `identity/compile-user-booking-summary.ts` | Identity Host using Booking types | **Application** projection helper *or* Identity Host consuming Booking DTOs — prefer **Application** pure compile | **B0** classify as Application-adjacent; optional move under bookings **B0** |
| `identity/users.service.ts` (repo factory) | Host Identity | **Host** — must use Booking port via composition, not Service Locator long-term | **B0**/`B1.5` |
| `identity/users.types.ts` | Host Identity DTOs | **Host** (may depend on Application status types) | OK |
| `tours/list-tours-operator.ts` | Host Tours | **Host** — calls Booking projection | OK; inject later **B1.9** |
| `tours/get-tour-operator.ts` | Host Tours | **Host** | OK |

### 3.4 Workspace

| Current file | Current owner | Correct owner | Migration phase |
| ------------ | ------------- | ------------- | --------------- |
| `packages/workspaces/denali/.../public-booking.port.ts` | Workspace-named port | **Host**-owned neutral port type later; Workspace keeps product create input mapping | **B1.4** |
| `packages/workspaces/denali/.../registration.service.ts` | Workspace | **Workspace** (validate, capacityMax, duplicates orchestration, intake) | Stay; call Booking public port |
| `packages/workspaces/denali/.../bookings/ops-manifest.ts` | Workspace | **Workspace** ops capability | **B1.0** / **B1.6** manifest codegen |
| `packages/workspace-sdk/.../registration-ops-manifest.ts` | SDK shared types | **Application**/contracts shared type (ops) — not runtime Booking engine | **B1.6** |
| `packages/workspaces/denali/.../denali.plugin.ts` `registrationOps` | Workspace plugin surface | **Workspace** | **B1.0** wire to `workspaceBooking.opsManifest` |

### 3.5 Urban / other product (not Booking engine)

| Current file | Current owner | Correct owner | Migration phase |
| ------------ | ------------- | ------------- | --------------- |
| `apps/api/src/registrations/registration-capacity.service.ts` | Host / Urban registrations | **Host** or future Workspace adapter — **not** Booking application today | Explicit product YES before merge (**post B1.1**) |

---

## 4. Cross-boundary imports (desired Application must not depend on)

Desired Application = pure types + helpers + service use-cases + port interfaces + domain errors.

### 4.1 Imports **from** proposed Application files that cross the boundary today

| From (file) | Import | Target class | Severity |
| ----------- | ------ | ------------ | -------- |
| `bookings.service.ts` | `getBookingsRepository` ← `create-bookings-repository` | **Infrastructure** / **Host** composition | **P0** |
| `bookings.service.ts` | errors ← `in-memory-bookings.repository` | **Persistence** file (should be Application) | **P0** (location) |
| `bookings.service.ts` | `TenantAuthContext` ← `@app-tour/workspace-sdk` | **Host** / SDK (Finance uses actor port) | **P1** |
| `enrich-tour-accepted-counts.ts` | `TourListProjection` ← `@app-tour/workspace-sdk` | **Host** / SDK DTO | **P1** |
| `prisma-bookings.repository.ts` | `@prisma/client`, `withTenantRls`, `getPrismaAdmin`, `enqueueOutboxEvent` | **Persistence** / **Infrastructure** / **Outbox** — OK *if* file is not Application | OK when classified infra |
| `create-bookings-repository.ts` | `process.env.DATABASE_URL`, storage driver assert | **Infrastructure** / **Host** | OK when composition-only |
| `bookings.routes.ts` | `node:http`, http helpers, identity session, `resolveFinanceServiceForTenant`, receipt storage | **HTTP** / **Host** / Finance | OK when not Application |
| `in-memory-bookings.repository.ts` | embeds port + errors + persistence | Mixed layers in one file | **P0** |

### 4.2 Imports **into** Booking tree from outside (consumers)

| Consumer | Imports | Boundary note |
| -------- | ------- | ------------- |
| `booking-payment.adapter.ts` | `raiseBookingPaymentStatus`, types, `getBookingsRepository`, `BookingsRepository` | Domain helper OK; factory = composition leak |
| `booking-registration-display.adapter.ts` | `getBookingsRepository`, `BookingsRepository` | Composition leak |
| `configure-workspace-denali-product-http-host.ts` | `bookings.service` public/duplicate APIs | Host→Application OK; should be port later |
| `app.ts` | `bookings.routes` | Host→HTTP OK |
| `users.service.ts` | `getBookingsRepository`, projection caps | Host→Infrastructure leak |
| `compile-user-booking-summary.ts` | types + caps | Host/Application-adjacent OK |
| `list-tours-operator.ts` / `get-tour-operator.ts` | `enrich-tour-accepted-counts` | Host→Application projection OK |

### 4.3 Workspace ↔ Host imports (not Application, but Booking surface)

| From | To | Class |
| ---- | -- | ----- |
| Denali `registration.service` | `DenaliPublicBookingPort` | Workspace → port (implemented by Host) |
| Host `configure-workspace-denali-product-http-host` | Denali HTTP configure + `bookings.service` | Host composition |
| Denali `ops-manifest` | workspace-sdk manifest types | Workspace |

---

## 5. Misplaced responsibilities (summary)

| Misplacement | Evidence | Correct home |
| ------------ | -------- | ------------ |
| Service Locator inside application | `bookings.service` → `getBookingsRepository()` | Host composition injects port |
| Port + errors live in memory adapter file | `BookingsRepository`, `BookingNotFoundError`, … in `in-memory-bookings.repository.ts` | Application `ports/` + `errors` |
| State transition + outbox emit inside persistence | `approveWithOutbox` in Prisma/memory repos | Application decides transition; Persistence + Outbox execute in TX (Finance Option C pattern) — **document now; optional relocate B1.9** |
| HTTP + Finance receipts in Booking routes file | `handlePostBookingReceipt` / `resolveFinanceServiceForTenant` | HTTP/Host Finance — not Booking lifecycle |
| Prisma outbox select in bookings folder “projection” | `OUTBOX_EVENT_LIST_SELECT` | Outbox/Persistence |
| Workspace public port named Denali inside product package | `DenaliPublicBookingPort` | Host-neutral Booking public port (B1.4); Denali keeps orchestration |
| Capacity/validation in Denali registration, not Booking | `registration.service` `readTourCapacity` + `validateDenaliRegistrationPayload` | Workspace (correct today); Application must not absorb without ports (B1.1) |
| Ops manifest unused by Booking service | Denali `registrationOps` vs hardcoded `APPROVE_OUTBOX_EVENT` | Workspace ops vs Application lifecycle event — wire via capability later |
| Identity/Finance call concrete factory | `getBookingsRepository()` | Host injects same port instance |

---

## 6. What **is** Booking application today (keep list)

Confirmed application-eligible symbols/files:

1. `bookings.types.ts` — status, paymentStatus, records, list/create/approve/reject DTOs  
2. `booking-payment-status.ts` — `raiseBookingPaymentStatus`  
3. `booking-list-query.ts` — search/filter/keyset/day helpers  
4. `bookings-member-summary-projection.ts` — caps + cancelled statuses  
5. `bookings.service.ts` — lifecycle use-cases (list/summary/create/public create/duplicates/approve/reject/bulk/sumApproved) — **minus** Locator/SDK auth type  
6. `enrich-tour-accepted-counts.ts` — acceptedCount projection  
7. Domain errors currently in memory file — Application  
8. `BookingRepositoryPort` (**B0.4**) — Application port (`BookingsRepository` alias)  
9. `identity/compile-user-booking-summary.ts` — pure projection (Application-adjacent)

Note: `booking-active-duplicate.ts` and port methods `findActiveDuplicateBy*` / `listOutboxByAggregate` / summary aggregation helpers were removed (no production callers; service uses `listByTenant` / counts).

---

## 7. Migration order (B0.1 → later; no code in this phase)

Ordered for **zero behavior change** first:

1. **B0.1 (this doc)** — freeze boundary classification  
2. **B0** — `BookingRepositoryPort` (**B0.4**); `BookingsService` DI (**B0.5**); application purity (**B0.6 Done** — errors in `bookings.errors.ts`; service imports ports+DTOs only); infrastructure folder move for Prisma/memory still open  
3. **B1.0** — `workspaceBooking.supported` enablement codegen  
4. **B1.1** — Workspace capacity/validation/registration policy ports + Denali adapters  
5. **B1.2** — HTTP contracts + `booking-http`; receipts stay Host→Finance  
6. **B1.3** — registry-only second workspace fixture  
7. **B1.4** — Neutral public booking port; Denali registration stays Workspace  
8. **B1.5** — Tenant-aware service resolve  
9. **B1.6** — Ops capability codegen (web)  
10. **B1.7** — Event/outbox name from capability registry  
11. **B1.8** — Declarative manifest fields  
12. **B1.9** — Application purity (no SDK/Prisma/env); optional transition-rule centralization  
13. **B1.10–B1.11** — Onboarding proofs + Host Integration Kit — **no extraction**

---

## 8. Runtime risk of this phase

| Item | Risk |
| ---- | ---- |
| Publishing this document only | **None** — no runtime change |
| Future B0 DI refactor | **Medium** if approve/outbox order or Finance Option C adapter wiring drifts — mitigate with existing bookings + finance-ops APPROVE-TX specs |
| Relocating transition rules out of repository later | **High** if approve eligibility (`pending`\|`waitlisted`) diverges between memory and Prisma |

**B0.1 itself:** runtime risk = **none**.

---

## 9. Acceptance checklist (B0.1)

| Criterion | Status |
| --------- | ------ |
| Booking application keep-list defined | Yes §1.1 / §6 |
| Non-application classes assigned (Host / Workspace / Infrastructure / HTTP / Outbox / Persistence) | Yes §1.2 / §3 |
| Boundary table with Current file / Current owner / Correct owner / Migration phase | Yes §3 |
| Every crossing import classified | Yes §4 |
| No implementation / no behavior change | Yes |

---

## 10. Confidence

| Area | Confidence | Note |
| ---- | ---------- | ---- |
| `apps/api/src/bookings/**` file inventory | **High** | 12/12 files read/classified |
| Cross-repo Booking consumers in `apps/api` | **High** | Grep of bookings imports |
| Workspace Denali booking surface | **High** | Port + registration.service + ops-manifest |
| Web bookings UI boundary | **Medium** | Deferred to B1.6; not fully tabled |
| Urban `registrations/` merge intent | **Medium** | Explicitly out until product YES |

**Overall confidence: 88%** for API/host Booking boundary definition.

---

## Document control

| Field | Value |
| ----- | ----- |
| Kind | Boundary definition (classify only) |
| Code impact | None |
| Next | Architect YES on B0 nano-spec (port extract + composition DI) |
