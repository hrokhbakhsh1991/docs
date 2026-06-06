# Phase 5 — Industry alignment (2026)

```yaml
agent_load_tier: T0_execution
doc_quality_support: true
not_implementation_spec: false
binding: "Maps external patterns → REQ-P5-* and DEL-P5-001 only"
sources_synthesized:
  - "Shared-schema multi-tenant + RLS FORCE (QuantLab, ClickHouse, Wellally, Cadence 2026)"
  - "PostgreSQL JSONB + relational projections (AgileSoftLabs SaaS stack 2026)"
  - "Transactional outbox + FOR UPDATE SKIP LOCKED relay"
  - "tenant_id from verified auth — not spoofed body"
```

> **Project fit:** app-tour is an **interoperable workspace** platform (Phase 0–3) with **tenant security boundary** (Phase 4). Phase 5 adds **durable data-layer contracts** without replacing workspace plugins or CASL.

---

## Pattern → Phase 5 binding

| 2026 industry pattern                    | Phase 5 artifact                                   | REQ / rule                               |
| ---------------------------------------- | -------------------------------------------------- | ---------------------------------------- |
| JSONB document SoT + indexed projections | `tours.canonical_data` + `title`, `schema_version` | REQ-P5-012, DEL-P5-001 §5                |
| RLS FORCE on every tenant table          | `outbox_events`, `audit_events` policies           | REQ-P5-015, schema §2–3                  |
| `set_config(..., true)` first in TX      | `withCanonicalTransaction`                         | REQ-P5-016, RULE-010                     |
| CASL/app filter primary; RLS backstop    | Phase 3 `accessibleBy` + Phase 4 session           | [`phase-4-bridge.md`](phase-4-bridge.md) |
| Transactional outbox (same TX as write)  | `outbox_events` insert in tour TX                  | REQ-P5-018, FORBIDDEN-005                |
| Relay `SKIP LOCKED` batch worker         | 5.4 subphase — ops runbook                         | REQ-P5-019 (ASPIRATIONAL throughput)     |
| `UNIQUE (tenant_id, domain_event_id)`    | Idempotent publish                                 | schema §8                                |
| Plugin validate-before-persist           | `WorkspacePlugin` + `validateCanonical`            | RULE-005, 5.2                            |
| No in-process-only production events     | Replace 4.5 publish path                           | FORBIDDEN-006                            |

---

## Explicit non-adoption (documented)

| Pattern                                  | Why not Phase 5                           | Where                 |
| ---------------------------------------- | ----------------------------------------- | --------------------- |
| Full event sourcing / CQRS platform-wide | MAP + ADR-005: document-centric canonical | research §2           |
| Schema-per-tenant / DB-per-tenant        | Pool tier default; silo Phase 7           | MAP §7                |
| Kafka/CDC primary integration            | Deferred Phase 7+                         | schema §10 DEFERRED   |
| Multi-workspace plugin matrix tests      | Only `starter` until Phase 6              | BLOCKER-P5-011 waiver |
| Dedicated DLQ table                      | Ops waiver until 5.4 hardening            | schema §6, §10        |

---

## Continuity with prior phases

| Phase | Carries into Phase 5                                             |
| ----- | ---------------------------------------------------------------- |
| **0** | `CanonicalDocument` wire shape — `data` sole persist shape       |
| **1** | `validateCanonical` via engine — no duplicate rule trees in API  |
| **3** | `WorkspacePlugin` registry — 5.2 gate before write               |
| **4** | `app.current_tenant_id`, `001_tenant_rls.sql`, host-bound tenant |
| **5** | `002_phase5_data_layer.sql`, outbox, audit, projections          |

**Detail:** [`platform-continuity-0-5.md`](platform-continuity-0-5.md) · **Tenant vs workspace axes:** [`workspace-data-layer-model.md`](workspace-data-layer-model.md) · **Phase 4 handoff:** [`phase-4-bridge.md`](phase-4-bridge.md)

---

## Agent check (T0)

```yaml
before_5_4_outbox:
  - "Confirm FORBIDDEN-006 — no publishDomainEvent without outbox row"
before_5_2_validation:
  - "Confirm active plugin is starter until Phase 6 — BLOCKER-P5-011"
industry_misread_fail:
  - "Using RLS as sole authz without CASL"
  - "Storing parallel DTO tree beside canonical_data"
```
