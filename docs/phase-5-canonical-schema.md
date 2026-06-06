# Phase 5 — Canonical data layer schema (DEL-P5-001)

```yaml
deliverable_id: DEL-P5-001
adr_id: ADR-005
status: AUTHORITATIVE
research_source: docs/research/phase-5-data-architecture-research.md Appendix A
binding: REPO_SCRIPTS_OVER_STALE_MD
sql_apply_order:
  - infra/sql/001_tenant_rls.sql
  - infra/sql/002_phase5_data_layer.sql
prisma: apps/api/prisma/schema.prisma
```

> **Agents:** SoT for DDL before any 5.1+ migration PR. **Router:** [`phase-5/phase-5-agent-router.md`](phase-5/phase-5-agent-router.md)  
> **Alignment:** [`phase-5/appendices/industry-alignment-2026.md`](phase-5/appendices/industry-alignment-2026.md) · [`platform-continuity-0-5.md`](phase-5/appendices/platform-continuity-0-5.md) · [`workspace-data-layer-model.md`](phase-5/appendices/workspace-data-layer-model.md)  
> **Precision pack:** [`phase-5/appendices/PRECISION-DOC-INDEX.md`](phase-5/appendices/PRECISION-DOC-INDEX.md) · **Repo map:** [`phase-5/appendices/IMPLEMENTATION-MAP.md`](phase-5/appendices/IMPLEMENTATION-MAP.md) · **Scaffold vs behavioral:** [`phase-5/appendices/test-inventory.md`](phase-5/appendices/test-inventory.md)

---

## 1. Table DDL — `tours` (extend)

```sql
-- Column rename (when upgrading from Phase 4)
ALTER TABLE tours RENAME COLUMN canonical TO canonical_data;

-- Projections (sync on write — Phase 5.3)
ALTER TABLE tours ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS schema_version INT NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_tours_tenant_title ON tours (tenant_id, title);
CREATE INDEX IF NOT EXISTS idx_tours_tenant_schema_version ON tours (tenant_id, schema_version);
```

| Column           | Type              | Nullable | Notes                                                                              |
| ---------------- | ----------------- | -------- | ---------------------------------------------------------------------------------- |
| `id`             | UUID PK           | no       | unchanged                                                                          |
| `tenant_id`      | UUID FK → tenants | no       | RLS                                                                                |
| `canonical_data` | JSONB             | no       | **SoT** — envelope below; Prisma client field `canonical` `@map("canonical_data")` |
| `title`          | TEXT              | yes      | projection from `data.basics.title` (starter)                                      |
| `schema_version` | INT               | no       | projection from `canonical_data.schemaVersion`                                     |
| `created_at`     | TIMESTAMPTZ       | no       | unchanged                                                                          |

---

## 2. Table DDL — `outbox_events`

```sql
CREATE TABLE IF NOT EXISTS outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  domain_event_id TEXT,
  correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  UNIQUE (tenant_id, domain_event_id)
);

CREATE INDEX idx_outbox_tenant_status_created
  ON outbox_events (tenant_id, status, created_at);
```

**RLS:**

```sql
ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events FORCE ROW LEVEL SECURITY;
CREATE POLICY outbox_tenant_isolation ON outbox_events
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
```

---

## 3. Table DDL — `audit_events`

```sql
CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_tenant_created ON audit_events (tenant_id, created_at);
```

**RLS:** same pattern as `outbox_events` (`audit_tenant_isolation`).

---

## 4. `canonical_data` JSON invariants

```yaml
canonical_data_invariant:
  link: packages/workspace-sdk/src/canonical/canonical-document.ts
  type: CanonicalDocument
  required_fields:
    schemaVersion: integer >= 1
    roots: "non-empty string array"
    data: "object — sole API persist shape (Phase 0 wire rule)"
  forbidden:
    - "parallel DTO tree for wizard state"
    - "persist without validateCanonical from active WorkspacePlugin"
  storage_adapter: apps/api/src/storage/prisma-tour.repository.ts
```

### 4.1 Validate-before-persist pipeline (5.2)

**Order (RULE-003 / RULE-005)** — must complete before any `TourStorageRepository.create` or `prisma.$transaction`:

```yaml
validate_before_persist:
  modules:
    workspace_type: apps/api/src/tenant/resolve-workspace-type.ts
    plugin_registry: apps/api/src/workspace/resolve-workspace-plugin.ts
    validation: apps/api/src/tours/canonical-validation.ts
  steps:
    1_resolve_workspace_type:
      from: tenants.workspace_type via findTenantById
      fallback: starter for dev header ids (tenant-a) — BLOCKER-P5-011 waiver
    2_resolve_plugin:
      via: resolveWorkspacePluginIdForType + registry Map
      not: getStarterWorkspacePlugin hard-coded as sole resolver
    3_build_document:
      via: createCanonicalDocument (assertCanonicalDocument inside)
    4_assert_structure:
      via: assertCanonicalDocument (explicit second pass for ordering tests)
    5_plugin_validate:
      via: PlatformWizardEngine.validateCanonical per call (CRIT-STATE-01)
    6_persist:
      via: CanonicalTourService.writeTour → scopedRepo.create
  http_mapping:
    CANONICAL_VALIDATION_FAILED: 400
    WORKSPACE_PLUGIN_NOT_BOUND: 400
  tests:
    unit_ordering: apps/api/test/validate-before-persist-ordering.spec.ts
    api_behavior: apps/api/test/canonical-validate-before-persist.spec.ts
```

**migrateCanonical:** design hook only — [`apps/api/src/canonical/migrate-canonical-hook.ts`](../../apps/api/src/canonical/migrate-canonical-hook.ts) (no legacy trip_details execution in Phase 5).

---

## 5. Projection derivation map (starter)

```yaml
projection_derivation_map:
  workspace_type: starter
  fields:
    - source_json_path: "data.basics.title"
      column: tours.title
      type: text
    - source_json_path: "schemaVersion"
      column: tours.schema_version
      type: int
  extension_phase_6: workspaces/denali — additional paths in DEL-P5-001 addendum
```

---

## 6. Outbox state machine

```yaml
outbox_status_fsm:
  pending: "inserted in same TX as tour write"
  processing: "relay claimed row FOR UPDATE SKIP LOCKED"
  done: "handlers completed idempotently"
  failed: "retry or DLQ per ops runbook (DLQ schema Phase 5.4+ waiver if deferred)"
transitions:
  - from: pending
    to: processing
  - from: processing
    to: [done, failed]
forbidden:
  - "publishDomainEvent before commit (FORBIDDEN-005)"
```

---

## 7. Transaction boundary API

> **Implementation decisions (write path, relay, env):** [`phase-5/appendices/IMPLEMENTATION-DECISIONS.md`](phase-5/appendices/IMPLEMENTATION-DECISIONS.md) — supersedes vague `prisma.$transaction` references in subphase drafts.

```typescript
// apps/api/src/db/with-canonical-transaction.ts
export async function withCanonicalTransaction<T>(
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T>;
```

**Rules:**

1. First statement in TX: `SELECT set_config('app.current_tenant_id', $tenantId, true)`.
2. All tour/outbox/audit writes inside `fn` — orchestrated from `CanonicalTourService.writeTour` (DEC-001).
3. No `publishDomainEvent` / `publishTourCreatedEvent` until after TX commit; relay dispatches (DEC-004).
4. Phase 4 `withTenantRls` per-op writes are **replaced** for canonical persist at 5.4 — not dual paths in production.

---

## 8. Idempotency

```yaml
idempotency:
  api_header: Idempotency-Key
  unique_scope: "(tenant_id, idempotency_key) on tours create — optional table phase 5.2"
  outbox_dedupe: "UNIQUE (tenant_id, domain_event_id)"
```

---

## 9. Adversarial test matrix (Phase 5.6)

| ID        | Scenario                                                              | REQ        |
| --------- | --------------------------------------------------------------------- | ---------- |
| ADV-P5-01 | Tenant A cannot read tenant B outbox row                              | REQ-P5-015 |
| ADV-P5-02 | Projection drift — rewrite canonical without sync columns fails guard | REQ-P5-012 |
| ADV-P5-03 | Cross-tenant publish throws                                           | REQ-P5-014 |
| ADV-P5-04 | List query uses index not JSONB @> on hot path                        | REQ-P5-032 |

---

## 10. Forensic truth (status constraints)

```yaml
ENFORCED:
  - canonical_data JSONB SoT per tour
  - outbox insert same transaction as tour write
ASPIRATIONAL:
  - relay throughput >10k events/sec without partitioning
DEFERRED:
  - CDC / Kafka (Phase 7+)
  - full DLQ table (document in ops waiver until 5.4 hardening)
```

**Markdoc:** [`phase-5-canonical-schema.mdoc`](phase-5-canonical-schema.mdoc)
