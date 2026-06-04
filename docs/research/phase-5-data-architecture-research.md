# Phase 5 — Canonical Data Architecture Research

**Role:** Principal Software Architect research (no implementation)  
**Status:** Research complete — input for `phase-5-canonical-schema.md` and `phase-5-canonical-schema.ai-exec.md`  
**Date:** 2026-06-04  
**Scope:** Phases 0–4 implied architecture + modern industry patterns + Phase 5 decision record

---

## Executive summary

app-tour has already committed to a **document-centric canonical model** (`CanonicalDocument` in `workspace-sdk`) with **pool multi-tenancy** (`tenant_id` + PostgreSQL RLS) and a **single write path** (`CanonicalTourService`). Phase 4 adds tenant boundary and persistence scaffolding; **durable cross-module integration** (transactional outbox, projections, audit) is explicitly deferred to Phase 5 per [`MIGRATION-MAP.md`](../MIGRATION-MAP.md) §6 and §11.

Industry research supports **strengthening the current model** (JSONB canonical blob + relational projections + transactional outbox) rather than adopting full event sourcing or CQRS platform-wide. Phase 5 should formalize the **data layer contract**: storage shape, outbox, minimal projections, plugin-gated validation, and migration/versioning hooks—while leaving Denali port, MinIO, and enterprise routing to Phases 6–7.

---

## Section 1 — Current state analysis (Phases 0–4)

### 1.1 Architecture layers (as built)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ apps/web (RSC shell)          apps/api (Node HTTP, no Nest in trunk)     │
│  ThemeProvider chain            ToursService → CanonicalTourService      │
│  starter plugin only (→ Ph 6)  createApiAbility + ScopedTourRepository │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│ workspace-sdk: CanonicalDocument, WorkspacePlugin, CASL tenant authz    │
│ platform-core: PlatformWizardEngine, RuleEngine, validateCanonical       │
│ design-tokens / ui-primitives / theme-react (Phase 2 — visual only)      │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│ tenant-kernel: host parse, RLS session SQL constants                     │
│ platform-events: in-process publishDomainEvent / subscribe               │
│ Postgres (Phase 4 design): tenants + tours, RLS on tours                 │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Current source of truth

| Layer | Source of truth | Notes |
|-------|-----------------|-------|
| **Wizard / API business state** | `CanonicalDocument` (`schemaVersion`, `roots`, `data`) in `@app-tour/workspace-sdk` | Structural validation via `assertCanonicalDocument`; deep-frozen `data` on create |
| **Engine semantics** | `PlatformWizardEngine.validateCanonical` in `@app-tour/platform-core` | Registry + rules from active `WorkspacePlugin` |
| **Persisted tour state** | `TourRecord.canonical` (typed as `CanonicalDocument` in app code) | Phase 3.4 introduced **single write path**; no dual-write to legacy tables in production path |
| **Legacy mirror** | `LegacyCanonicalAdapter` | Read-only list for sync **integrity checks** after write—not a second SoT |
| **UI (when wired)** | Canonical only—no RHF mirror | Phase 0 covenant; Phase 3 scaffold |

**Wire shape (target, Phase 5):** MAP and Phase 0 state `data` is the **sole API persist shape**; envelope fields (`schemaVersion`, `roots`) are part of the canonical contract, not parallel DTO trees.

### 1.3 Current persistence model

| Aspect | Current / planned (Phase 4 docs) | Gap vs Phase 5 target |
|--------|----------------------------------|------------------------|
| **Production default** | `InMemoryTourRepository` wired in `apps/api/src/main.ts` | Phase 4 exit requires Postgres when `DATABASE_URL` set |
| **Schema reference** | `apps/api/prisma/schema.prisma`: `Tour.canonical` JSON, `Tenant.workspaceType`, `Tenant.theme` JSON | MAP names column `canonical_data`; rename/migration is a Phase 5 schema task |
| **SQL reference** | `infra/sql/001_tenant_rls.sql`: `tours.canonical JSONB NOT NULL` | Aligned with JSONB document store |
| **Indexing** | `(tenant_id, id)` on tours | No **projected** columns for list/filter yet |
| **Capacity** | In-memory repo enforces per-tenant/global caps | Must carry over to Postgres adapter |
| **Prisma client** | Schema exists; **runtime may still be raw SQL or in-memory** until 4.2 closure | Phase 5 assumes Prisma interactive transactions for outbox |

### 1.4 Current tenant model

| Mechanism | Implementation |
|-----------|----------------|
| **Isolation model** | Shared schema + `tenant_id` on tenant-scoped rows (pool tier) |
| **Resolution** | `tenant-kernel` host/subdomain parsing; API binds `TenantAuthContext` |
| **DB session** | `SET LOCAL app.current_tenant_id` via `tenant-kernel` `SET_LOCAL_RLS_TENANT_SQL` |
| **RLS** | `FORCE ROW LEVEL SECURITY` policy on `tours` matching session UUID |
| **App filter** | `ScopedTourRepository` + CASL `accessibleByTourWhere` — defense in depth |
| **Enterprise silo** | `TenantRoute` interface only — **Phase 7** per MAP §7.2 |

### 1.5 Current event model

| Mechanism | Phase | Behavior |
|-----------|-------|----------|
| **In-process bus** | 4.5 (`@app-tour/platform-events`) | `publishDomainEvent` after successful persist; `TourCreated` with `tenantId`, `tourId` |
| **Transactional outbox** | Deferred Phase 5 | MAP §6: `outbox_events` table |
| **Cross-tenant** | Forbidden | `DOMAIN_EVENT_TENANT_REQUIRED` on publish |
| **Idempotency** | Redis scaffold Phase 4 | Not tied to outbox yet |
| **Legacy reference** | `legacy/.../OutboxService` | TypeORM + same-transaction `enqueueOutboxEvent`; financial audit coupling |

**Critical gap:** Events are **ephemeral** (in-process). Process crash after DB commit but before handler completion loses side effects; no relay to finance/registrations modules in trunk.

### 1.6 Current API flow

```text
HTTP POST /tours
  → parseCreateTourBody (Zod)
  → createApiAbility(TenantAuthContext)
  → buildValidatedCanonicalDocument
       → PlatformWizardEngine.create(starterPlugin)
       → validateCanonical(document, { tenantId, dimensions })
  → CanonicalTourService.writeTour
       → ScopedTourRepository.create (CASL-scoped tenantId)
       → validateCanonicalLegacySync (integrity vs adapter mirror)
       → publishDomainEvent(TourCreated)
  → TourRecord response
```

**Properties:** One write funnel; plugin validation **before** persist for starter; plugin resolution still **hard-coded** to starter (`canonical-validation.ts`) until workspace registry generalization (Phase 5/6).

### 1.7 Current CASL model

| Layer | Detail |
|-------|--------|
| **Authority package** | `@casl/ability` in `workspace-sdk` (`buildTenantAuthz`, subjects) |
| **API surface** | `createApiAbility` → MongoAbility on `Tour` with `{ tenantId }` conditions |
| **Enforcement** | `accessibleByTourWhere` throws `FORBIDDEN_TOUR_*`; `ScopedTourRepository` blocks cross-tenant create/read |
| **Prisma integration** | Documented target `@casl/prisma` — Phase 4 applies same rules on Postgres path |
| **Web** | CASL before theme ingress (Phase 3); deny-by-default wizard host |

**RLS is not a substitute for CASL** — MAP §7.1: RLS is safety net when app filter fails.

### 1.8 Current RLS model

```sql
-- Pattern (infra/sql/001_tenant_rls.sql)
USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
WITH CHECK (same)
```

- Transaction-local `set_config(..., true)` mirrors legacy `TenantSessionBindingService`.
- Integration test `rls-isolation.integration.spec.ts` exists but **skips** without `DATABASE_URL`; full Testcontainers proof tied to Prisma/pg repository default (Phase 4.2).

### 1.9 Limitations (drivers for Phase 5)

1. **Durability:** In-memory default in `main.ts` contradicts Phase 4 production honesty until switched.
2. **Event reliability:** In-process bus cannot satisfy MAP Phase 5 exit (“TourCreated” via **outbox** test).
3. **Query ergonomics:** No projected columns—list/filter would scan JSONB or load full documents (violates MAP §12 R3 scale guard intent).
4. **Schema evolution:** `schemaVersion` exists on document; **no** `migrateCanonical` pipeline or `workspace_type`-aware persistence contract in DB.
5. **Plugin binding:** Validation uses starter only; tenant `workspace_type` not yet driving plugin selection at persist.
6. **Audit:** MAP §10 assigns minimal `audit_events` to Phase 5—not present in trunk schema.
7. **Naming drift:** `canonical` vs `canonical_data` between Prisma, SQL, and MAP.
8. **Operational:** No relay worker, no outbox dedupe/`domainEventId` parity with legacy finance flows (needed before Phase 6 finance hooks).

---

## Section 2 — Industry research

Modern production practice (2024–2026) favors **boring Postgres** plus **targeted patterns** over platform-wide event sourcing. Sources include transactional outbox literature (microservices.io), PostgreSQL JSONB operational guides, and 2025–2026 ES/CQRS practitioner consensus (BirJob, Palakorn, Serialized.io/Kafka clarifications).

For each pattern below: **definition**, **advantages**, **disadvantages**, **operational complexity**, **scalability impact**, **PostgreSQL**, **Prisma**, **multi-tenant SaaS** compatibility.

---

### 2.1 Canonical JSONB storage

**Definition:** Store the authoritative business document as a JSONB column (or JSONB-dominated row), with optional metadata columns (`tenant_id`, `schema_version`, timestamps). Application validates shape before write; database enforces tenancy and referential integrity.

**Advantages**

- Matches workspace-plugin variability without EAV or dynamic DDL per tenant.
- Same transaction as relational FKs (`tenant_id`, aggregate id).
- Aligns with existing `CanonicalDocument` and Phase 1 engine validation.
- PostgreSQL JSONB is mature (TOAST, GIN when needed).

**Disadvantages**

- Filtering/sorting inside `data` without projections → sequential scans or heavy GIN maintenance.
- Schema drift across `schemaVersion` requires migration discipline.
- Harder DB-level constraints on nested fields.

**Operational complexity:** Low–medium (migrations for envelope + projections, not per-field DDL).

**Scalability:** Good for read-by-id; poor for ad hoc analytics inside blob without projections or warehouse CDC.

**PostgreSQL:** Excellent native fit.

**Prisma:** `Json` type + `prisma.$transaction` — good fit.

**Multi-tenant SaaS:** Excellent with `tenant_id` + RLS; avoid cross-tenant JSONB queries without session context.

---

### 2.2 Transactional Outbox Pattern

**Definition:** Persist domain events in an `outbox_events` table in the **same database transaction** as the aggregate mutation; asynchronous relay publishes to handlers/message bus.

**Advantages**

- Eliminates dual-write (DB committed, message lost).
- Works with existing Postgres ops team skills.
- Legacy app-tour already proved pattern (TypeORM + `enqueueOutboxEvent`).
- `FOR UPDATE SKIP LOCKED` enables horizontal relay workers.

**Disadvantages**

- At-least-once delivery → consumers must be idempotent.
- Relay lag adds eventual consistency for side effects.
- Outbox table growth requires retention/archival policy.

**Operational complexity:** Medium (relay process, monitoring stuck rows, DLQ policy).

**Scalability:** Polling viable to ~thousands of events/sec per DB; beyond that consider partitioned outbox or CDC relay.

**PostgreSQL:** Industry default; ACID + row locking.

**Prisma:** Supported via interactive transactions (`tx.outbox.create`); libraries (`@outbox-event-bus/postgres-prisma-outbox`, `@nestarc/outbox`) exist—evaluate vs thin custom table to minimize deps ([§17 Simplicity Hedge](../MIGRATION-MAP.md#۱۷-the-simplicity-hedge)).

**Multi-tenant SaaS:** Require `tenant_id` on every outbox row; relay sets RLS session or passes tenant in payload; forbid cross-tenant fan-out (MAP §6.2).

---

### 2.3 Event Sourcing

**Definition:** Append-only stream of domain events is the **primary** truth; current state is derived by replay (optionally snapshotted).

**Advantages**

- Perfect audit trail and temporal queries.
- Natural fit for money, inventory, collaborative undo.
- Replay after rule changes (regulated domains).

**Disadvantages**

- High conceptual and operational cost (versioning, upcasting, projection rebuilds).
- Read paths require projections or snapshots—never “query the log” in hot paths.
- Poor fit for catalog/profile CRUD SaaS (2026 consensus).

**Operational complexity:** High (event store ops, schema governance forever).

**Scalability:** Partitioned `events` table on Postgres viable to large volume; dedicated stores (KurrentDB) add vendor ops.

**PostgreSQL:** Viable with `pg_partman` + append-only table; not required for app-tour Phase 5.

**Prisma:** Awkward as primary event store (optimistic concurrency on stream version is manual).

**Multi-tenant SaaS:** Stream-per-aggregate with `tenant_id` in metadata; risk of noisy-neighbor on shared event table without partitioning.

---

### 2.4 CQRS

**Definition:** Separate models for **commands** (writes) and **queries** (reads), optionally separate stores.

**Advantages**

- Optimized read models (lists, dashboards, search).
- Independent scaling of read replicas.

**Disadvantages**

- Sync/async projection lag and failure modes.
- Duplication of schema knowledge.
- Overkill when read/write shapes are similar (tour document CRUD).

**Operational complexity:** Medium–high if async; low if “CQRS-lite” (same DB, extra columns/tables).

**Scalability:** Read replicas help read-heavy SaaS; async projectors add pipeline ops.

**PostgreSQL:** Read models as tables/materialized views; logical replication for read replicas.

**Prisma:** Fine for command side; read models may use raw SQL for performance.

**Multi-tenant SaaS:** Projections must include `tenant_id` and respect RLS or be tenant-scoped materialized paths.

---

### 2.5 CDC (Debezium-style)

**Definition:** Capture database WAL changes and stream to Kafka/Pulsar/etc. for downstream consumers.

**Advantages**

- Decouples producers from consumers; high throughput.
- Useful for analytics, search indexes, data warehouse.

**Disadvantages**

- Replication slot/WAL bloat risk; ops heavy.
- Event shape is physical row change, not always domain event.
- Ordering/per-table filtering complexity in multi-tenant.

**Operational complexity:** High (Kafka Connect, schema registry, monitoring).

**Scalability:** Excellent at very high change volume.

**PostgreSQL:** Logical decoding + Debezium is standard.

**Prisma:** Irrelevant to capture path (ORM bypassed).

**Multi-tenant SaaS:** Filter by `tenant_id` in connectors; still emits all tenants to bus—governance overhead.

---

### 2.6 Projection Tables

**Definition:** Denormalized relational columns or side tables derived from canonical JSONB on write (sync) or from outbox/events (async).

**Advantages**

- Indexed list/filter (title, status, dates) without JSONB operators in hot queries.
- Satisfies MAP Phase 5.3 and §12 R3 (indexed paths, not full scans).
- Keeps canonical blob as SoT while queries stay boring SQL.

**Disadvantages**

- Derivation logic must stay consistent with canonical (drift risk).
- Extra migration work when plugin adds fields.
- Async projections add lag unless updated in same transaction.

**Operational complexity:** Low (sync projections in transaction) to medium (async rebuild).

**Scalability:** Strong for tenant-scoped lists with `(tenant_id, projected_field)` indexes.

**PostgreSQL:** Native B-tree indexes on generated/stored columns or explicit columns.

**Prisma:** Explicit fields in schema; update in ` $transaction` with tour row.

**Multi-tenant SaaS:** Projections colocated with tenant row—natural fit.

---

### 2.7 Snapshot Strategies

**Definition:** Periodic or threshold-based materialized state (especially in event sourcing) to avoid full replay.

**Advantages**

- Faster rebuild and cold-start for long streams.
- Useful for large canonical histories if event-sourced later.

**Disadvantages**

- Snapshot + events consistency management.
- Unnecessary if SoT is already the current JSONB document.

**Operational complexity:** Low for “document IS snapshot”; high for ES.

**Scalability:** Reduces replay CPU for ES only.

**PostgreSQL:** Store snapshot JSONB row versioned by `schemaVersion`.

**Prisma:** Standard row update.

**Multi-tenant SaaS:** Per-aggregate snapshot keyed by `(tenant_id, aggregate_id)`.

---

### 2.8 Event Replay

**Definition:** Reprocess historical events to rebuild projections or re-apply rules.

**Advantages**

- Recovery after projector bugs.
- Regulatory re-computation.

**Disadvantages**

- Requires immutable event log and idempotent handlers.
- Dangerous without tenant-scoped replay guards.

**Operational complexity:** Medium–high (orchestration, checkpoints).

**Scalability:** Batch replay can load DB; needs rate limits per tenant.

**PostgreSQL:** Replay from `outbox_events` archive or dedicated `domain_events` if introduced.

**Prisma:** Batch jobs outside request path.

**Multi-tenant SaaS:** Mandatory `tenant_id` filter; per-tenant replay quotas.

---

### 2.9 Idempotency

**Definition:** Duplicate requests or at-least-once deliveries produce one effective side effect (`idempotency_key`, `domainEventId`, consumer dedupe table).

**Advantages**

- Safe retries from clients and relay workers.
- Legacy finance already uses `domainEventId` on outbox.

**Disadvantages**

- Storage for keys (Redis TTL or Postgres unique constraint).
- Key scope design (per-tenant, per-endpoint).

**Operational complexity:** Low–medium.

**Scalability:** Redis good for hot keys; Postgres unique `(tenant_id, idempotency_key)` for durability.

**PostgreSQL / Prisma:** Unique constraints + `ON CONFLICT DO NOTHING`.

**Multi-tenant SaaS:** Keys must be namespaced by `tenant_id`.

---

### 2.10 Multi-tenant data evolution

**Definition:** How schema and canonical shape evolve across tenants/workspace types (`schemaVersion`, `migrateCanonical`, pool vs silo).

**Advantages**

- `schemaVersion` + plugin `migrateCanonical` (MAP §8.3) supports gradual rollout.
- Pool model: one migration fleet for all tenants.
- Dual-read/write new version only reduces breakage.

**Disadvantages**

- N× workspace types × versions test matrix.
- Long-lived dual-read paths accumulate debt.
- Silo tier (Phase 7) multiplies migration surfaces.

**Operational complexity:** Medium (version matrix, feature flags per workspace type).

**Scalability:** Pool scales operationally; silo for compliance isolation.

**PostgreSQL:** JSONB + version column; optional per-tenant maintenance windows.

**Prisma:** Migrations global; data migration scripts per version.

**Multi-tenant SaaS:** Never migrate tenant A's data under tenant B's session; RLS + explicit `tenant_id` in jobs.

---

## Section 3 — Compatibility matrix

| Approach | Decision | Reason |
| -------- | -------- | ------ |
| Canonical JSONB storage | **Adopt Now** | Already the product model (`CanonicalDocument`); MAP Phase 5.1; matches workspace variability without EAV. |
| Transactional Outbox Pattern | **Adopt Now** | MAP §6 exit criterion; closes gap between durable writes and side effects; legacy-proven; fits Postgres+Prisma transactions. |
| Event Sourcing (platform-wide) | **Reject** | Domain is document CRUD + rules engine, not event-native ledger; cost exceeds audit needs; current SoT is state not log. |
| CQRS (separate stores / async bus) | **Reject** (platform-wide) | **Adopt Later** as CQRS-lite only: same Postgres, projection columns + optional read replica Phase 7. Full split not justified pre-Denali. |
| CDC (Debezium-style) | **Adopt Later** | Useful for warehouse/search at scale; ops burden unjustified before outbox + projections prove insufficient. |
| Projection Tables | **Adopt Now** | MAP 5.3; required for indexed tenant lists and §12 R3; sync derivation in write transaction is simplest. |
| Snapshot Strategies | **Adopt Later** | Revisit if selective ES for finance aggregate or long audit streams; not needed while JSONB row is SoT. |
| Event Replay | **Adopt Later** | After outbox exists; scope to admin tooling + tenant-scoped reprocessing; not Phase 5 day-one. |
| Idempotency | **Adopt Now** | Phase 4 Redis scaffold + outbox `domainEventId`/unique keys; required for at-least-once outbox relay. |
| Multi-tenant data evolution | **Adopt Now** | Formalize `schemaVersion`, `workspace_type`, `migrateCanonical` contract in Phase 5 schema doc; silo routing stays Phase 7. |

---

## Section 4 — Phase 5 recommendation

Phase 5 should **not** redefine the product as an event-sourced system. It should **harden the canonical data layer** already implied by Phases 0–4 and MAP §11, using the smallest production-proven additions.

### 4.1 What Phase 5 SHOULD contain

#### Canonical storage strategy

- **Primary SoT:** One JSONB column per tour aggregate (standardize name to `canonical_data` in schema docs and migrations; alias period acceptable).
- **Envelope:** Persist full `CanonicalDocument` semantics (`schemaVersion`, `roots`, `data`) inside JSONB; validate with `assertCanonicalDocument` + `PlatformWizardEngine.validateCanonical` **before** transaction commit.
- **Tenant binding:** `tenant_id` FK + `workspace_type` on `tenants` (already in Prisma reference); tours never stored without tenant context.
- **Plugin resolution:** Resolve `WorkspacePlugin` from `tenant.workspace_type` / registry at validation time (generalize beyond hard-coded starter)—design in Phase 5, Denali plugin binary in Phase 6.
- **Forbidden:** Dual-write to legacy-shaped tables; parallel “trip_details” SoT in generic API (Phase 6 port inside plugin only).

#### Event strategy

- **Domain events:** Typed envelope aligned with `platform-events` (`eventId`, `tenantId`, `type`, `payload`, `occurredAt`).
- **Delivery semantics:** At-least-once from outbox relay; in-process bus becomes **test/dev shortcut** or synchronous “inline handler” only after outbox insert in same code path—not a second publisher.
- **Scope:** Start with `TourCreated` (MAP exit); define extension points for finance/registrations without implementing those modules in Phase 5.

#### Outbox strategy

- **Table:** `outbox_events` with minimum: `id`, `tenant_id`, `aggregate_type`, `aggregate_id`, `event_type`, `payload` JSONB, `status`, `created_at`, `processed_at`, optional `domain_event_id` (unique per tenant), `correlation_id`.
- **Write path:** `prisma.$transaction`: upsert tour + insert outbox row; **no** `publishDomainEvent` before commit.
- **Relay:** Single-process polling worker acceptable for Phase 5 (SKIP LOCKED); external Kafka **not** required.
- **Consumer contract:** Idempotent handlers; tenant guard on dispatch (reuse platform-events rules).
- **Legacy alignment:** Mirror semantics of `legacy/.../OutboxService.addEvent` (financial audit coupling deferred until Phase 6 finance slice).

#### Replay strategy

- **Phase 5:** No user-facing replay UI. Provide **operational replay** design hook: archived outbox + ability to re-enqueue by id range with tenant filter.
- **Do not** build event-sourced rebuild of tours in Phase 5.

#### Projection strategy

- **Sync projections** updated in the same transaction as canonical write (CQRS-lite).
- **Initial projected fields (illustrative—finalize in schema doc):** `title` (from `data.basics.title` or starter path), `schema_version`, `updated_at`, optional `status` placeholder for list screens.
- **Indexes:** `(tenant_id, title)` or `(tenant_id, updated_at DESC)` per query tests.
- **Rule:** Projections are **derived**, not second SoT—rebuild script from canonical JSONB is a Phase 5 deliverable for drift recovery.

#### Migration strategy

- **DB migration:** Rename/normalize `canonical` → `canonical_data` if desired; add `outbox_events`, `audit_events` (minimal), projection columns.
- **Data migration:** Empty or starter tenants only in Phase 5; no Denali legacy cutover (Phase 6 `migrateCanonical`).
- **Versioning:** Document `canonical_data.schemaVersion` + per-workspace `migrateCanonical(v, data)` contract; API dual-read optional flag—default write newest only after Phase 5 gate.
- **Rollout:** Feature flag `OUTBOX_ENABLED` acceptable for staged relay enablement; fail-closed in production if outbox write fails.

### 4.2 Why this bundle

1. **Continuity:** Preserves Phase 1–3 engine and SDK contracts—no rewrite.
2. **MAP alignment:** Satisfies Phase 5.1–5.5 and §6 exit without Phase 6 scope creep.
3. **Simplicity hedge:** Outbox + projections + JSONB is **10% complexity** of full ES+CQRS+CDC for **90%** of integration reliability needs.
4. **Legacy lessons:** Finance outbox checks in legacy scripts prove team already pays operational cost—restore pattern in modern Prisma stack.
5. **Scale path:** Projections + indexes address §12 R3; CDC remains optional when outbox throughput or analytics demands it.

### 4.3 Explicit non-goals for Phase 5

- Kafka/NATS/Rabbit as required infrastructure.
- Full event store per aggregate.
- Denali workspace plugin port (Phase 6).
- MinIO/object storage (Phase 6).
- `TenantConnectionRouter` silo tier (Phase 7).
- OpenTelemetry full stack (Phase 7).

---

## Section 5 — Phase boundaries

### Hard boundary table

| Capability | Phase 5 (MUST) | Phase 6 (MUST NOT before) | Phase 7 (MUST NOT before) |
|------------|----------------|---------------------------|---------------------------|
| `canonical_data` JSONB contract + migrations | ✅ | — | — |
| Plugin-aware validate-before-persist (registry) | ✅ | Denali-specific fields/rules | — |
| Sync projection columns + indexed list queries | ✅ | Denali-only projection fields | — |
| `outbox_events` + transactional emit + relay | ✅ | Finance consumer implementation | — |
| Minimal `audit_events` (who/tenant/action/entity) | ✅ | Finance mutation audit parity | Full observability stack |
| `TourCreated` outbox integration test (MAP exit) | ✅ | — | — |
| Idempotency keys (API + outbox dedupe) | ✅ | Payment-grade idempotency stores | — |
| `migrateCanonical` implementation for legacy shapes | Design + hook only | ✅ Full Denali cutover | — |
| `packages/workspaces/denali` | — | ✅ | — |
| Finance hooks / ledger events | — | ✅ | — |
| MinIO photo upload | — | ✅ | — |
| Dynamic Denali bootstrap in api/web | — | ✅ | — |
| Second workspace (urban) E2E | — | — | ✅ |
| `TenantConnectionRouter` pool/silo | — | — | ✅ |
| Read replica / `statement_timeout` policy | — | Defer design note | ✅ |
| CDC to warehouse | — | — | ✅ (optional) |
| Rate limits + runbooks + OTel | — | Partial in 6 | ✅ |
| Marketing / Portal / Admin deploy split | — | — | ✅ (deploy topology) |

### What belongs in Phase 5 (summary)

Data layer **contracts and infrastructure**: canonical persistence shape, outbox, projections, audit minimal, versioning rules, migration/up scripts, adversarial tests for storage boundaries (per MAP §12 Phase 5 checklist).

### What MUST NOT ship until Phase 6

- Denali plugin, workspace-specific finance, widgets/theme port, MinIO, legacy `trip_details` migration execution, smoke parity with legacy tours.

### What MUST NOT ship until Phase 7

- Enterprise DB silo routing, second workspace proof, full observability/rate-limit platform DoD, optional CDC analytics pipeline.

---

## Section 6 — Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Projection drift** from canonical | Wrong list data, tenant-visible bugs | Medium | Same-transaction update; contract test round-trip; rebuild job from JSONB |
| **Outbox relay failure** | Stuck side effects (email, finance prep) | Medium | Monitoring `status` + age; DLQ table; alert on backlog; idempotent retry |
| **JSONB hot-query anti-pattern** | DB CPU, slow lists at scale | Medium | Code review ban on `@>` in list paths; enforce projections in guard/docs |
| **schemaVersion fragmentation** | Incompatible reads across plugins | Medium | Central version matrix; dual-read window documented; plugin tests per version |
| **Prisma transaction scope bugs** | Outbox not atomic with tour | Low–Medium | Integration tests on real Postgres; single `$transaction` wrapper |
| **RLS bypass via raw SQL** | Cross-tenant data leak | High impact | Ban raw queries without `withTenantTransaction`; CI RLS specs (P4-E-RLS-*) extended in Phase 5 |
| **At-least-once duplicate handlers** | Double emails/charges | Medium | `domainEventId` unique; consumer dedupe table |
| **Over-engineering ES/CQRS** | Delivery slip, ops burden | Medium | This research **rejects** platform ES; Architect sign-off for any ES pilot (finance only, Phase 6+) |
| **Phase 4 incomplete Postgres cutover** | Phase 5 built on in-memory lie | Medium | Gate Phase 5 entry on `phase-4:gate` checklist (Postgres default, RLS green) |
| **Tenant migration job cross-wire** | Catastrophic data corruption | Low–High impact | Jobs require explicit `tenant_id`; RLS session per job; no global migrate without tenant scope |

---

## Section 7 — Final decision record (ADR)

### ADR-005: Phase 5 canonical data architecture

**Status:** Proposed (research accepted for schema doc generation)

**Context**

app-tour is a multi-tenant workspace-plugin SaaS with a headless rule engine (Phase 1), visual layer (Phase 2), apps + CASL (Phase 3), and tenant kernel + Postgres RLS (Phase 4). Cross-module communication must become reliable before Denali (Phase 6). MAP already sketches Phase 5 as JSONB + projections + outbox.

**Decision**

Adopt **document-centric canonical JSONB** as the long-term write model, augmented by:

1. **Synchronous relational projections** for tenant-scoped queries.
2. **Transactional outbox** in PostgreSQL with Prisma interactive transactions and a polling relay.
3. **Minimal audit table** for security/compliance baseline.
4. **Idempotency** on API writes and outbox consumption.

Do **not** adopt platform-wide event sourcing, separate CQRS data stores, or CDC in Phase 5.

**Chosen architecture (diagram)**

```text
                    ┌──────────────────────┐
  Command API ─────►│ validateCanonical    │
  (CASL + RLS)      │ (plugin + engine)  │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  Postgres TX         │
                    │  • tours.canonical_data (JSONB SoT)
                    │  • projected columns │
                    │  • outbox_events     │
                    │  • audit_events (min)│
                    └──────────┬───────────┘
                               │ commit
                    ┌──────────▼───────────┐
                    │ Outbox relay (poll)  │
                    │ SKIP LOCKED workers  │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        In-process         Future           Phase 6+
        handlers           modules          finance consumer
        (sync optional)    (registrations)   (same contract)
```

**Rejected alternatives**

| Alternative | Why rejected |
|-------------|--------------|
| Platform-wide Event Sourcing | SoT already materialized state; replay/version tax not justified for tour wizard CRUD. |
| Full CQRS + async projectors only | Adds lag and ops without separate read store need yet; sync projections sufficient. |
| CDC (Debezium) as primary integration | Ops-heavy; domain events better expressed in outbox than row replication. |
| Kafka as event store | Kafka is transport, not SoT; no cluster mandate in MAP Phase 5. |
| Relational-only (no JSONB) | Breaks workspace plugin field variability and Phase 0–3 contracts. |
| Keep in-process bus only | Fails MAP Phase 5 exit and loses events on crash. |

**Future migration path**

| Stage | Trigger | Direction |
|-------|---------|-----------|
| Phase 5 | Now | Outbox + projections + audit minimal |
| Phase 6 | Denali port | Finance consumers on outbox; `migrateCanonical`; richer projections |
| Phase 7 | Scale / enterprise | Read replicas; optional CDC to warehouse; silo `TenantConnectionRouter` |
| Selective ES | Finance ledger aggregate only | If audit replay mandates—**separate** from tour canonical SoT |

**Consequences**

- Positive: Reliable integration, MAP-compliant exit, preserves SDK/engine investment, legacy outbox pattern modernized.
- Negative: Relay operations and projection maintenance are permanent engineering responsibilities.
- Neutral: In-process `platform-events` remains for tests and optional synchronous hooks after outbox insert.

**References**

- [`docs/MIGRATION-MAP.md`](../MIGRATION-MAP.md) §5–§8, §10–§11 (Phase 5)
- [`docs/phase-4-tenant-kernel.md`](../phase-4-tenant-kernel.md) §17 (Phase 5 entry)
- [`packages/workspace-sdk/src/canonical/canonical-document.ts`](../../packages/workspace-sdk/src/canonical/canonical-document.ts)
- [`apps/api/src/canonical/canonical-tour.service.ts`](../../apps/api/src/canonical/canonical-tour.service.ts)
- [`legacy/apps/api/src/modules/outbox/outbox.service.ts`](../../legacy/apps/api/src/modules/outbox/outbox.service.ts)
- Industry: [Transactional Outbox](https://microservices.io/patterns/data/transactional-outbox.html), [outbox-event-bus Prisma adapter](https://github.com/dunika/outbox-event-bus), JSONB SaaS guidance (Voxire 2025), ES/CQRS 2026 practitioner consensus (BirJob, Palakorn)

---

## Appendix A — Inputs for downstream schema doc

The following MUST be specified in `phase-5-canonical-schema.md` (derived from this research, not re-researched):

1. Exact table DDL: `tours`, `outbox_events`, `audit_events` (column types, indexes, RLS policies).
2. `canonical_data` JSON schema invariants (link to `CanonicalDocument` + storage adapter).
3. Projection derivation map (starter paths; extension points for Denali).
4. Outbox state machine (`pending` → `processing` → `done` / `failed`).
5. Transaction boundary API (`withCanonicalTransaction(tenantId, fn)`).
6. Idempotency key headers and unique constraints.
7. Adversarial test matrix (cross-tenant outbox, projection drift, empty legacy mirror, O(N) list guard).
8. Forensic Truth table rows for any aspirational relay scaling claims.

---

## Appendix B — Repository evidence snapshot (2026-06-04)

| Artifact | Observation |
|----------|-------------|
| `apps/api/src/main.ts` | Still wires `InMemoryTourRepository` |
| `apps/api/prisma/schema.prisma` | `Tour.canonical` Json; tenant `workspaceType` |
| `infra/sql/001_tenant_rls.sql` | RLS on `tours` |
| `packages/platform-events` | In-process only |
| `apps/api/src/tours/canonical-validation.ts` | `PlatformWizardEngine` + starter plugin |
| `phase-4-enforcement.md` | Outbox deferred; Phase 5 entry checklist |

---

*End of research document.*
