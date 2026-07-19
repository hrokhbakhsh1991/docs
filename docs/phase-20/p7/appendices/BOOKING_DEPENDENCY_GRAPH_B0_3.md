# Booking Dependency Graph (Phase B0.3)

```yaml
doc_id: BOOKING_DEPENDENCY_GRAPH_B0_3
phase: B0.3
status: GRAPH_ONLY
date: "2026-07-19"
authority:
  - docs/phase-20/p7/appendices/BOOKING_BOUNDARY_B0_1.md
  - docs/phase-20/p7/appendices/BOOKING_PORT_DISCOVERY_B0_2.md
constraints:
  - no code
  - no invented ports beyond B0.2 inventory
  - highlight illegal / host / workspace / future ports / future adapters
```

---

## Legend

| Mark | Meaning |
| ---- | ------- |
| **ILLEGAL** | Crosses approved B0.1 application boundary (must be removed by B0 / B1.9) |
| **HOST** | Allowed Host dependency (composition, adapters, HTTP, infra) |
| **WORKSPACE** | Workspace package dependency (product rules / ops) |
| **FUTURE PORT** | B0.2 accepted port not yet extracted as an interface |
| **FUTURE ADAPTER** | Implementation that will sit behind a future port |
| **OK** | Allowed under target architecture |

Edge direction: **A → B** means A depends on / imports / calls B.

---

## 1. Current dependency graph

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ WORKSPACE                                                                 │
│  denali/registration.service                                              │
│  denali/catalog.service                                                   │
│  denali/ops-manifest (unused by Booking engine)                           │
│       │                                                                   │
│       │ uses DenaliPublicBookingPort                                      │
└───────┼───────────────────────────────────────────────────────────────────┘
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ HOST                                                                      │
│  configure-workspace-denali-product-http-host  ──adapts──▶ bookings.service│
│  app.ts  ──▶  bookings.routes                                             │
│  bookings.routes  ──▶  bookings.service                                   │
│  bookings.routes  ──▶  resolveFinanceServiceForTenant   [HOST Finance]    │
│  BookingPaymentAdapter / DisplayAdapter  ──▶  getBookingsRepository()     │
│  identity/users.service  ──▶  getBookingsRepository()                     │
│  tours/*  ──▶  enrich-tour-accepted-counts                                │
└───────┬───────────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ bookings.service  (APPLICATION — polluted)                                │
│                                                                           │
│  ──ILLEGAL──▶  create-bookings-repository / getBookingsRepository()       │
│  ──ILLEGAL──▶  @app-tour/workspace-sdk TenantAuthContext                  │
│  ──ILLEGAL──▶  domain errors co-located in in-memory-bookings.repository  │
│  ──(inline)──▶  assertAdminOrOwner          [FUTURE PORT: Authz]          │
│  ──(inline)──▶  new Date()                  [FUTURE PORT: Clock]          │
│  ──OK/via Loc──▶ BookingsRepository methods [FUTURE PORT: Repository]     │
└───────┬───────────────────────────────────────────────────────────────────┘
        │ Service Locator
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ create-bookings-repository  [HOST / INFRA composition]                    │
│  ──▶ process.env.DATABASE_URL                                             │
│  ──▶ resolveStorageDriver                                                 │
│  ──▶ InMemoryBookingsRepository  |  PrismaBookingsRepository              │
└───────┬───────────────────────────────┬───────────────────────────────────┘
        ▼                               ▼
┌───────────────────────┐    ┌─────────────────────────────────────────────┐
│ InMemoryBookingsRepo  │    │ PrismaBookingsRepository                    │
│  [FUTURE ADAPTER]     │    │  [FUTURE ADAPTER]                           │
│  holds port type ★    │    │  ──▶ withTenantRls        [HOST / INFRA]    │
│  holds domain errors★ │    │  ──▶ getPrismaAdmin       [HOST / INFRA]    │
│  fake outbox store    │    │  ──▶ enqueueOutboxEvent   [OUTBOX]          │
│                       │    │  ──▶ @prisma/client       [PERSISTENCE]     │
└───────────────────────┘    └─────────────────────────────────────────────┘

★ ILLEGAL layering: Application port type + domain errors live inside Persistence file.

enrich-tour-accepted-counts ──ILLEGAL──▶ @app-tour/workspace-sdk TourListProjection
                         ──OK──▶ bookings.service.sumApprovedPartySizeByTourIds
```

### 1.1 Current edge table

| From | To | Class |
| ---- | -- | ----- |
| `bookings.service` | `getBookingsRepository` | **ILLEGAL** (App → composition) |
| `bookings.service` | `TenantAuthContext` (workspace-sdk) | **ILLEGAL** (App → SDK) |
| `bookings.service` | errors in `in-memory-*.ts` | **ILLEGAL** (App → Persistence file) |
| `bookings.service` | inline role check | **FUTURE PORT** Authz (not extracted) |
| `bookings.service` | `new Date()` | **FUTURE PORT** Clock (not extracted) |
| `bookings.service` | `BookingsRepository` methods | **FUTURE PORT** Repository (type misplaced) |
| `enrich-tour-accepted-counts` | `TourListProjection` (sdk) | **ILLEGAL** |
| `bookings.routes` | `bookings.service` | **HOST** / HTTP → App (OK as adapter) |
| `bookings.routes` | Finance service | **HOST** (not Booking App) |
| Denali registration | `DenaliPublicBookingPort` | **WORKSPACE** → port |
| Denali host configure | `bookings.service` | **HOST** adapter (**FUTURE ADAPTER** for Public port) |
| Prisma repo | RLS / Prisma / outbox | **HOST** Persistence + Outbox |
| Finance adapters | `getBookingsRepository` | **HOST** (composition leak; should inject) |
| Denali ops-manifest | (nothing in Booking engine) | **WORKSPACE** (disconnected) |

---

## 2. Target dependency graph

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ WORKSPACE                                                                 │
│  denali/registration.service · catalog                                    │
│  denali/ops-manifest  (later: codegen → web only)                         │
│       │                                                                   │
│       │ WORKSPACE → BookingPublicPort                                     │
└───────┼───────────────────────────────────────────────────────────────────┘
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ HOST composition                                                          │
│  lazy-bookings / factory                                                  │
│    constructs:                                                            │
│      HostBookingAuthorizationAdapter  [FUTURE ADAPTER]                    │
│      HostBookingClockAdapter          [FUTURE ADAPTER]                    │
│      Prisma | Memory BookingsRepository [FUTURE ADAPTER]                  │
│      BookingPublicPort adapter        [FUTURE ADAPTER]                    │
│    injects into BookingsService                                           │
│  booking-http handlers ──▶ BookingsService   [HTTP]                       │
│  Finance BookingPaymentAdapter ──▶ BookingsRepositoryPort (injected)      │
└───────┬───────────────────────────────────────────────────────────────────┘
        │ ports only
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ BOOKING APPLICATION                                                       │
│  types · domain helpers · projections · domain errors                     │
│  BookingsService                                                          │
│                                                                           │
│  ──OK──▶ BookingsRepositoryPort      [PORT]                               │
│  ──OK──▶ BookingAuthorizationPort    [PORT]                               │
│  ──OK──▶ BookingClockPort            [PORT]                               │
│                                                                           │
│  zero: workspace-sdk · Prisma · process.env · getBookingsRepository       │
│  zero: workspace packages · node:http · enqueueOutboxEvent                │
└───────┬───────────────────────────────────────────────────────────────────┘
        │ implemented by
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Host Persistence / Outbox / Infrastructure                                │
│  PrismaBookingsRepository ──▶ withTenantRls · Prisma · enqueueOutboxEvent │
│  InMemoryBookingsRepository                                               │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Target edge table

| From | To | Class |
| ---- | -- | ----- |
| BookingsService | `BookingsRepositoryPort` | **OK** / **FUTURE PORT** (extracted) |
| BookingsService | `BookingAuthorizationPort` | **OK** / **FUTURE PORT** |
| BookingsService | `BookingClockPort` | **OK** / **FUTURE PORT** |
| Host Authz adapter | identity roles | **HOST** / **FUTURE ADAPTER** |
| Host Clock adapter | wall clock | **HOST** / **FUTURE ADAPTER** |
| Prisma/Memory repo | RLS / Prisma / outbox | **HOST** Persistence + Outbox / **FUTURE ADAPTER** |
| Workspace | `BookingPublicPort` | **WORKSPACE** → **OK** port |
| Host Public adapter | BookingsService use-cases | **HOST** / **FUTURE ADAPTER** |
| HTTP handlers | BookingsService | **HOST** / HTTP |
| Finance adapters | `BookingsRepositoryPort` | **HOST** (injected) |
| BookingsService | workspace-sdk / Prisma / factory | **gone** (was **ILLEGAL**) |

---

## 3. Highlight matrices

### 3.1 Illegal dependencies (current → must clear)

| Edge | Clear by |
| ---- | -------- |
| App → `getBookingsRepository` / `create-bookings-repository` | **B0** |
| App → `@app-tour/workspace-sdk` (`TenantAuthContext`) | **B0** (actor type) / **B1.9** |
| App → Persistence file for errors / port type | **B0** |
| `enrich-*` → `TourListProjection` from SDK | **B1.9** |
| Port type / errors inside memory adapter file | **B0** |

### 3.2 Host dependencies (allowed)

| Edge | Role |
| ---- | ---- |
| Composition → adapters + service | Wiring |
| HTTP → service | Driving adapter |
| Prisma repo → RLS / Prisma / outbox | Persistence |
| Finance adapters → repository port | Cross-capability |
| Host Authz / Clock adapters → OS / identity | Driven adapters |

### 3.3 Workspace dependencies (allowed)

| Edge | Role |
| ---- | ---- |
| Denali registration/catalog → `BookingPublicPort` | Product create / occupancy |
| Denali ops-manifest → web (not engine) | Ops UI capability |

Workspace must **not** depend on Prisma, `bookings.service` module path, or repository factory.

### 3.4 Future ports (B0.2 — not yet interfaces)

1. `BookingsRepositoryPort` (today: `BookingsRepository` type, wrong file)
2. `BookingAuthorizationPort` (today: inline functions)
3. `BookingClockPort` (today: `new Date()`)
4. `BookingPublicPort` (today: `DenaliPublicBookingPort`)

### 3.5 Future adapters

| Adapter | Implements | Phase |
| ------- | ---------- | ----- |
| `PrismaBookingsRepository` (moved under infrastructure/) | Repository | **B0** |
| `InMemoryBookingsRepository` (moved) | Repository | **B0** |
| `HostBookingAuthorizationAdapter` | Authorization | **B0** |
| `HostBookingClockAdapter` | Clock | **B0** |
| Host `BookingPublicPort` adapter (neutral rename) | Public | **B0** wire / **B1.4** rename |
| `booking-http` handlers | HTTP driving | **B1.2** |

---

## 4. Current → Target delta (ASCII)

```text
CURRENT (illegal edges marked *)

  Workspace ──▶ DenaliPublicBookingPort ──▶ Host inline ──▶ service*
                                                      │
  HTTP ──▶ routes ──▶ service* ──*──▶ getBookingsRepository()
                      service* ──*──▶ workspace-sdk
                      service* ──*──▶ memory file (errors)
                      service* ──··─▶ new Date() / role check (unported)

TARGET

  Workspace ──▶ BookingPublicPort ──▶ Host adapter ──▶ BookingsService
  HTTP ──▶ booking-http ─────────────────────────────▶ BookingsService
                                                         │
                    ┌────────────────────────────────────┤
                    ▼              ▼                      ▼
              RepositoryPort   AuthzPort            ClockPort
                    │              │                      │
                    ▼              ▼                      ▼
              Prisma/Memory   HostAuthzAdapter    HostClockAdapter
```

---

## 5. Migration order

Ordered to remove **ILLEGAL** edges first without behavior change:

| Step | Phase | Graph action |
| ---- | ----- | ------------ |
| 1 | **B0.1–B0.3** | Freeze boundary + ports + this graph (docs only) |
| 2 | **B0** | Extract Repository port + errors from memory file; move Prisma/memory → infrastructure; composition injects Repository into service — **cut App→factory** |
| 3 | **B0** | Introduce Authz + Clock ports + Host adapters; replace inline role/`new Date()` — **cut App→sdk roles / raw clock** (actor type local) |
| 4 | **B0** | Wire Public port adapter explicitly at composition (behavior same) |
| 5 | **B1.0** | Enablement codegen (Host gate) — no new App→Workspace edges |
| 6 | **B1.2** | Move HTTP handlers → booking-http — routes leave App folder |
| 7 | **B1.4** | Rename `DenaliPublicBookingPort` → `BookingPublicPort`; Workspace imports Host/contracts only |
| 8 | **B1.5** | Tenant-aware composition cache (Host) |
| 9 | **B1.6** | Ops manifest → web codegen (Workspace→Web; still not App) |
| 10 | **B1.9** | Remove remaining SDK DTO imports from enrich; App purity complete |

**Not on graph as Booking App edges:** Capacity, Validation (stay Workspace).

---

## 6. Acceptance

| Criterion | Status |
| --------- | ------ |
| Current graph drawn | Yes §1 |
| Target graph drawn | Yes §2 |
| Illegal / Host / Workspace / future ports / future adapters highlighted | Yes §3 |
| Migration order | Yes §5 |
| No code | Yes |

---

## Document control

| Field | Value |
| ----- | ----- |
| Kind | Dependency graph |
| Code impact | None |
| Depends on | B0.1, B0.2 |
| Next | Architect YES → B0 implementation nano-spec |
