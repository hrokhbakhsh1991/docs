# Booking Port Discovery (Phase B0.2)

```yaml
doc_id: BOOKING_PORT_DISCOVERY_B0_2
phase: B0.2
status: PORT_INVENTORY_ONLY
date: "2026-07-19"
authority: docs/phase-20/p7/appendices/BOOKING_BOUNDARY_B0_1.md
constraints:
  - approved boundary only
  - do not invent ports
  - every port ↔ existing responsibility
  - no implementation
```

> **Rule:** A port is listed only if Booking application (or an existing Booking-facing
> contract already in-tree) already performs that responsibility today.
> Candidates from the evolution brainstorm that are **Workspace-only** or **unused
> by Booking application** are explicitly **rejected**.

---

## 1. Inventory summary

| # | Port (canonical name) | Direction | Exists today as |
| - | --------------------- | --------- | --------------- |
| 1 | `BookingRepositoryPort` | Application → Persistence | **B0.4 landed** — was `BookingsRepository` type |
| 2 | `BookingAuthorizationPort` | Application → Host | `assertAdminOrOwner` + `TenantAuthContext.role` |
| 3 | `BookingClockPort` | Application → Host | `new Date()` in `bookings.service` |
| 4 | `BookingPublicPort` | Workspace/Host → Application | `DenaliPublicBookingPort` (+ host adapter to service) |

**Rejected (not Booking application ports today):** Capacity, Validation, Registration-policy, Projection-port, Metrics, Logger, Outbox-port, Capability-gate, Persistence-mode.

---

## 2. Port inventory (accepted)

### 2.1 `BookingsRepositoryPort`

| Field | Value |
| ----- | ----- |
| **Purpose** | Persist and load booking aggregates; execute approve/reject/create; raise `paymentStatus`; duplicate lookups; list/summary aggregates; enqueue approve outbox **inside** persistence TX (current design) |
| **Current implementation** | `BookingsRepository` in `in-memory-bookings.repository.ts`; `InMemoryBookingsRepository`; `PrismaBookingsRepository`; selected by `create-bookings-repository.ts` / `getBookingsRepository()` |
| **Future adapter** | Same two adapters under `infrastructure/`; composition root injects into application (no Service Locator). Outbox remains **inside** Prisma/memory approve methods until a later phase proves a split (B0.1: Outbox via repo) |
| **Owner** | **Port type:** Booking application. **Adapters:** Host Persistence / Infrastructure. **TX/RLS/outbox enqueue:** Infrastructure + Outbox |
| **Why it exists** | Every Booking use-case already calls `getBookingsRepository()` |
| **Why it belongs to Booking** | B0.1 Application owns lifecycle; Persistence is the driven adapter behind this port |
| **Acceptance** | Interface matches today’s `BookingsRepository` method surface; Prisma + memory both implement; service receives port, never imports Prisma/`create-bookings-repository` |

---

### 2.2 `BookingAuthorizationPort`

| Field | Value |
| ----- | ----- |
| **Purpose** | Enforce operator ops access (admin \| owner) for list ops view, summary, create, approve, reject, bulk approve |
| **Current implementation** | Inline in `bookings.service.ts`: `isAdminOrOwner` / `assertAdminOrOwner` on `TenantAuthContext` from `@app-tour/workspace-sdk`; throws `BookingsOpsForbiddenError` |
| **Future adapter** | Host adapter wrapping the same role check (mirror Finance `FinanceAuthorizationPort` / `HostFinanceAccessAdapter`). Actor fields (`tenantId`, `userId`) remain on a Booking actor context type passed into use-cases — **not** a separate port |
| **Owner** | **Port:** Booking application. **Adapter:** Host (identity/session roles) |
| **Why it exists** | Ops vs public paths already diverge on role checks inside application |
| **Why it belongs to Booking** | B0.1 Application owns use-case gating; Host owns how roles are obtained |
| **Acceptance** | Same forbidden code `BOOKINGS_OPS_FORBIDDEN`; `createPublicGuestBooking` remains unchecked (today); no SDK import in application after B0/B1.9 |

---

### 2.3 `BookingClockPort`

| Field | Value |
| ----- | ----- |
| **Purpose** | Supply “now” for summary projections (`approvedToday`, `departures7d`) and approve response `approvedAt` fallback when record clock is null |
| **Current implementation** | Direct `new Date()` / `new Date().toISOString()` in `bookings.service.ts` (`getBookingsSummary`, `approveBooking`) |
| **Future adapter** | Host clock adapter (mirror Finance `FinanceClockPort.nowIso()` / wall-clock). Persistence adapters may keep their own `new Date()` for row timestamps — that stays Infrastructure until proven otherwise |
| **Owner** | **Port:** Booking application. **Adapter:** Host |
| **Why it exists** | Application already computes time-relative projections and ISO fallbacks |
| **Why it belongs to Booking** | B0.1 Application owns projections; wall clock is Host infrastructure |
| **Acceptance** | Summary “today” / “7d” semantics unchanged when clock injected; unit tests can fake clock |

---

### 2.4 `BookingPublicPort` (today: `DenaliPublicBookingPort`)

| Field | Value |
| ----- | ----- |
| **Purpose** | Allow Workspace public registration / catalog occupancy to create pending bookings, find active duplicates, and sum approved party size — without importing Booking persistence |
| **Current implementation** | Interface: `packages/workspaces/denali/src/http/ports/public-booking.port.ts`. Adapter: inline object in `apps/api/src/http/configure-workspace-denali-product-http-host.ts` calling `createPublicGuestBooking`, `findGuestBookingDuplicate*`, `sumApprovedPartySizeByTourIds` |
| **Future adapter** | Host-owned `BookingPublicPort` (neutral name); same methods; Denali `registration.service` / catalog continue to depend on the port, not on `bookings.service` or Prisma |
| **Owner** | **Port contract:** Host (Booking-facing) after rename; today Workspace-named. **Implementation:** Host composition → Booking application use-cases. **Callers:** Workspace |
| **Why it exists** | Denali registration + catalog already require this seam; comment in port file: “Prisma/memory lives in apps/api” |
| **Why it belongs to Booking** | Methods map 1:1 to Booking application responsibilities (create pending, duplicates, approved seat sum) — not to tour capacity/validation |
| **Acceptance** | Method set unchanged from `DenaliPublicBookingPort`; create still yields `pending`; duplicates unchanged |

---

## 3. Rejected candidates (with evidence)

| Candidate | Why rejected |
| --------- | ------------ |
| **Capacity port** | Booking application never decides capacity. `readTourCapacity` + validation live in Denali `registration.service` (Workspace). Urban `registration-capacity.service` is a different Host surface (B0.1 §2.3). Inventing a Booking capacity port would pull Workspace responsibility inward. |
| **Validation port** | `validateDenaliRegistrationPayload` is Workspace plugin. Booking `createBooking` / `createPublicGuestBooking` trust `CreateBookingRequest` from caller. |
| **Registration policy port** | No Booking application module selects status pipeline / intake schema by workspace today. Ops manifest is Workspace UI (`registrationOps`), unused by `bookings.service`. |
| **Projection port** | List/summary/acceptedCount/member compile are **pure Application helpers + repository reads**, not an external dependency. Finance’s `RegistrationDisplayPort` is owned by **Finance** (Finance→Booking), not a Booking dependency. |
| **Metrics port** | Zero metrics imports / counters under `apps/api/src/bookings/`. |
| **Logger port** | Zero `console` / logger usage in Booking application files. |
| **Outbox port** | Approve outbox enqueue is embedded in `approveWithOutbox` / `bulkApproveWithOutbox` on the repository (B0.1: Outbox via repo). No separate Booking outbox interface exists. Splitting now would invent. |
| **Capability / workspace gate port** | No `workspaceBooking.supported` / gate in Booking application today (enablement is B1.0). |
| **Persistence / storage-driver port** | Storage driver selection is only in `create-bookings-repository` (composition). Application does not branch on durable vs memory. |
| **`IBookingPaymentPort`** | Owned by **Finance**. Booking supplies persistence/helpers; Finance depends on Booking — inverse of “ports Booking needs.” |

---

## 4. What remains Host (not Booking ports)

| Responsibility | Where it stays |
| -------------- | -------------- |
| Composition / `getBookingsRepository` singleton / `STORAGE_DRIVER` | Host Infrastructure factory |
| `requireOperatorSession`, HTTP parse, status codes, rate-limit | HTTP / Host |
| Finance receipt handlers on `/bookings/:id/receipts*` | Host → Finance service |
| `BookingPaymentAdapter` / `BookingRegistrationDisplayAdapter` | Host Finance infrastructure (Finance ports) |
| `withTenantRls`, Prisma, `enqueueOutboxEvent` | Infrastructure / Outbox behind repository adapter |
| Tenant → workspaceType resolve | Host (B1.5) |
| Tour list call sites invoking enrich | Host Tours |
| Identity `users.service` loading bookings | Host Identity |

---

## 5. What remains Workspace (not Booking ports)

| Responsibility | Where it stays |
| -------------- | -------------- |
| Public registration orchestration | Denali `registration.service` |
| `capacityMax` read + party validation | Denali plugin / registration.service |
| `workspaceType !== "denali"` gate | Denali Workspace |
| Ops UI manifest (`registrationOps` / columns/actions) | Denali `ops-manifest` (+ future codegen) |
| Catalog occupancy UX using public port | Denali catalog.service / filter |

Workspace **consumes** `BookingPublicPort`; it does **not** implement Booking repository/authz/clock.

---

## 6. Direction map

```text
Workspace (Denali registration / catalog)
    ──uses──▶  BookingPublicPort  ──Host adapts──▶  Booking application use-cases
                                                      │
                         ┌────────────────────────────┼────────────────────────────┐
                         ▼                            ▼                            ▼
              BookingsRepositoryPort      BookingAuthorizationPort       BookingClockPort
                         │                            │                            │
                         ▼                            ▼                            ▼
              Prisma / Memory                 Host role check                 Host clock
              (+ outbox in approve TX)

Finance ──uses──▶ IBookingPaymentPort / RegistrationDisplayPort  (Finance-owned; not listed above)
```

---

## 7. Acceptance (B0.2)

| Criterion | Status |
| --------- | ------ |
| Only ports with existing Booking responsibilities | Yes (§2 + §3) |
| Each accepted port has Purpose / Current / Future / Owner | Yes |
| Capacity/Validation/Metrics/Logger not invented | Yes (§3) |
| Host vs Workspace remainder stated | Yes (§4–§5) |
| No implementation | Yes |

---

## 8. Confidence

| Area | Confidence |
| ---- | ---------- |
| Inbound ports (Repository, Authz, Clock) | **High** — direct service evidence |
| Public port as Booking-facing contract | **High** — existing interface + host adapter |
| Rejection of Capacity/Validation as Booking ports | **High** — B0.1 + Denali ownership |
| Future rename `DenaliPublicBookingPort` → `BookingPublicPort` | **High** — B1.4 plan; inventory only here |

**Overall: 90%**

---

## Document control

| Field | Value |
| ----- | ----- |
| Kind | Port inventory |
| Code impact | None |
| Depends on | BOOKING_BOUNDARY_B0_1 |
| Next | B0 nano-spec may implement Repository + Authz + Clock injection only |
