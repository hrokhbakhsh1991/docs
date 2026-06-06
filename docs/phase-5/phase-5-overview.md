# Phase 5 — Overview

```yaml
agent_load_tier: T2_CONTEXT
execution_router: phase-5-agent-router.md
fail_if: "T0 implementation loads this file"
```

> **Agents (T0):** [`phase-5-agent-router.md`](phase-5-agent-router.md) · **Truth:** [`audits/IMPLEMENTATION-TRUTH.md`](audits/IMPLEMENTATION-TRUTH.md)  
> **SOURCE OF TRUTH (objectives/deliverables):** this file  
> **Research narrative:** [`../research/phase-5-data-architecture-research.md`](../research/phase-5-data-architecture-research.md)  
> **Subphases:** [`subphases/`](subphases/) · **State/DAG:** [`phase-5-state-machine.md`](phase-5-state-machine.md)

## Out of scope — Phases 6 and 7

| Deferred to Phase 6                 | Deferred to Phase 7                     |
| ----------------------------------- | --------------------------------------- |
| `packages/workspaces/denali`        | `TenantConnectionRouter` silo           |
| MinIO / photo upload e2e            | Read replica / statement_timeout policy |
| Finance hooks / ledger via bus      | Full OTel + runbooks                    |
| `migrateCanonical` legacy execution | CDC / warehouse (optional)              |

Detail: [`appendices/phase-boundaries.md`](appendices/phase-boundaries.md) · [`FUTURE-PROOFING-REPORT.md`](FUTURE-PROOFING-REPORT.md). Phase 5 PRs that add these → **FAIL** (FORBIDDEN-008–014).

## STEP 1 — PHASE DETECTION (COMPLETE)

```yaml
phase_id: "5"
phase_name: "Canonical Data Architecture — Data Layer Standard"
north_star: "Document-centric canonical JSONB SoT + sync projections + transactional outbox + minimal audit — pool multi-tenant Postgres RLS"
adr_id: ADR-005
prerequisite_phase_id: "4"
prerequisite_gate_command: pnpm run phase-4:gate
closure_gate_command: pnpm run phase-5:gate
closure_gate_chain: "pnpm build && pnpm test && pnpm run phase-4:gate && pnpm run phase-5:guard"
closure_gate_status: defined_in_package_json — subphases 5.2–5.5 may remain SPEC_ONLY per IMPLEMENTATION-TRUTH
phase_detection_blocker: null
subphases:
  - id: "5.0"
    name: "Phase 5 Entry Gate"
    dag_node: P5-0
    blocked_until: [phase_4_gate_green, phase_5_entry_requires]
  - id: "5.1"
    name: "Schema canonical_data JSONB + Migrations"
    dag_node: P5-1
    blocked_until: ["5.0"]
    map_item: "5.1"
  - id: "5.2"
    name: "Validate Via Plugin Before Persist"
    dag_node: P5-2
    blocked_until: ["5.1"]
    map_item: "5.2"
  - id: "5.3"
    name: "Sync Projection Columns"
    dag_node: P5-3
    blocked_until: ["5.1"]
    map_item: "5.3"
  - id: "5.4"
    name: "Transactional Outbox + Relay"
    dag_node: P5-4
    blocked_until: ["5.1", "5.2"]
    map_item: "5.4"
  - id: "5.5"
    name: "Minimal audit_events"
    dag_node: P5-5
    blocked_until: ["5.1"]
    map_item: "5.5"
  - id: "5.6"
    name: "Phase 5 Gate + Forensic + Contract"
    dag_node: P5-6
    blocked_until: ["5.2", "5.3", "5.4", "5.5"]
execution_domains:
  schema: ["5.1"]
  validation: ["5.2"]
  projection: ["5.3"]
  outbox: ["5.4"]
  audit: ["5.5"]
  gate: ["5.6"]
validation_domains:
  requirements: audits/verification-matrix.md
  rules: phase-5-enforcement.md
governance_domains:
  adr: appendices/adr-005.md
  boundaries: appendices/phase-boundaries.md
  blockers: appendices/blockers.md
```

---

## Objectives

> Full IDs: monolith `objectives` — duplicated **once** here as SoT for modular tree.

| ID         | Statement                                                                                        | Source ref                 |
| ---------- | ------------------------------------------------------------------------------------------------ | -------------------------- |
| OBJ-P5-001 | Harden canonical data layer implied by Phases 0–4 without redefining product as event-sourced    | research §4                |
| OBJ-P5-002 | Formalize data layer contract — storage, outbox, projections, plugin validation, migration hooks | research Executive summary |
| OBJ-P5-003 | Close durable cross-module integration — transactional outbox; MAP §6 exit                       | research §1.5              |
| OBJ-P5-004 | Preserve Phase 1–3 engine and SDK — no platform-core rewrite                                     | ADR-005                    |
| OBJ-P5-005 | Satisfy MAP Phase 5.1–5.5 and §12 without Phase 6 creep                                          | research §4.2              |
| OBJ-P5-006 | Adopt Now: JSONB, Outbox, Projections, Idempotency, tenant evolution                             | research §3                |
| OBJ-P5-007 | Reject: platform ES, separate CQRS stores, CDC primary, Kafka SoT, JSONB-less, in-process only   | research §3 · §7           |
| OBJ-P5-008 | Defer: Denali, MinIO, silo router, OTel full, mandatory Kafka                                    | research §4.3 · §5         |

---

## Deliverables

| ID         | Name                                 | Exit evidence           | Blocker            |
| ---------- | ------------------------------------ | ----------------------- | ------------------ |
| DEL-P5-001 | phase-5-canonical-schema.md          | Appendix A 8 items      | BLOCKER-P5-001     |
| DEL-P5-002 | canonical_data JSONB + migrations    | migration on Postgres   | —                  |
| DEL-P5-003 | plugin-aware validate-before-persist | API test                | **VERIFIED** (5.2) |
| DEL-P5-004 | sync projections + indexed lists     | query test              | —                  |
| DEL-P5-005 | outbox + relay                       | TourCreated outbox test | —                  |
| DEL-P5-006 | audit_events minimal                 | table + write test      | —                  |
| DEL-P5-007 | idempotency API + outbox dedupe      | unique domain_event_id  | —                  |
| DEL-P5-008 | migrateCanonical hook only           | doc                     | —                  |
| DEL-P5-009 | projection rebuild script            | script test             | —                  |
| DEL-P5-010 | operational replay hook              | doc only                | —                  |
| DEL-P5-011 | phase-5.contract.spec.ts             | tests pass              | BLOCKER-P5-003     |
| DEL-P5-012 | phase-5 forensic report              | Purity >= 8             | —                  |
| DEL-P5-013 | Big-O documentation                  | per adapter             | —                  |

---

## Entry criteria

> **SOURCE OF TRUTH:** [`../phase-4/phase-4-enforcement.md`](../phase-4/phase-4-enforcement.md) `phase_5_entry_requires` — verified in subphase 5.0.

```yaml
entry_criteria:
  - docs/phase-4-tenant-kernel.md sections 8-16 complete
  - pnpm run phase-4:gate exit 0
  - Forensic Phase 4 archived docs/audits/phase-4-zero-debt-forensic-audit.mdoc
  - Postgres SoT tours NOT in-memory default production
  - RLS migration applied all tenant tables
  - Event bus hook points exist outbox table NOT required at Phase 4 exit
```

---

## Exit criteria

```yaml
exit_criteria:
  map_phase_5:
    "5.1": migration on real Postgres
    "5.2": API test validate via plugin before persist
    "5.3": query test projected columns
    "5.4": transactional outbox + TourCreated — MAP §6
    "5.5": audit_events minimal — MAP §10
  map_section_6: TourCreated API to handler via outbox test
  map_section_12:
    - phase-5.contract.spec.ts outbox + repository boundaries
    - adversarial P0/P1 storage tests
    - Big-O documented; O(N) list paths block closure
  phase_dod: phase-5-enforcement.md phase_dod hard ALL PASS
```

---

## Execution summary

```text
5.0 Entry (phase-4 gate + phase_5_entry_requires)
  → 5.1 Schema canonical_data (+ DEL-P5-001)
  → 5.2 Plugin validation ──┐
  → 5.3 Projections (parallel after 5.1) ──┼→ 5.6 Gate
  → 5.4 Outbox (needs 5.2) ──────────────┤
  → 5.5 Audit (parallel after 5.1) ──────┘
```

ADR-005 chosen stack: validate → Postgres TX (canonical_data + projections + outbox + audit) → commit → relay (SKIP LOCKED) → handlers.

**Depends on:** [`phase-5-state-machine.md`](phase-5-state-machine.md) · [`appendices/dependency-graph.md`](appendices/dependency-graph.md)

---

## Implementation status (repo — 2026-06-04)

> **Ledger:** [`audits/IMPLEMENTATION-TRUTH.md`](audits/IMPLEMENTATION-TRUTH.md) · **Paths:** [`appendices/IMPLEMENTATION-MAP.md`](appendices/IMPLEMENTATION-MAP.md)

| Subphase | Status              | Note                                            |
| -------- | ------------------- | ----------------------------------------------- |
| 5.0      | VERIFIED_SCAFFOLD   | entry yaml + phase-4 gate report                |
| 5.1      | VERIFIED (scaffold) | guard + DEL-P5-001 artifacts                    |
| 5.2      | **VERIFIED**        | validate-before-persist — schema §4.1           |
| 5.3      | SPEC_ONLY           | projection columns exist; sync on write pending |
| 5.4      | SPEC_ONLY           | outbox model; relay + same-TX pending           |
| 5.5      | SPEC_ONLY           | audit model; append API pending                 |
| 5.6      | PARTIAL             | scaffold guard ok                               |

```yaml
honest_scores:
  doc_navigation: 100
  scaffold: 43
  behavioral: 29
  weighted_closure: "~37"
forbidden_claim: "overview complete implies phase closed"
```
