# Phase 5 — Workspace + data layer model

```yaml
agent_load_tier: T0_execution
extends: docs/phase-4/appendices/workspace-interoperability-model.md
date: "2026-06-04"
rule: "Phase 5 persists canonical state — it does not redefine workspace product rules"
```

> **Three layers:** **Tenant** (who) · **Canonical document** (what is stored) · **Workspace plugin** (how it is validated).

---

## Three layers (do not merge)

| Layer         | Question                   | Phase | Phase 5 touchpoint                                       |
| ------------- | -------------------------- | ----- | -------------------------------------------------------- |
| **Tenant**    | Who is isolated?           | 4     | `tenant_id` on all rows; RLS; `withCanonicalTransaction` |
| **Canonical** | What is the SoT blob?      | 0–1   | `canonical_data` JSONB = `CanonicalDocument`             |
| **Workspace** | Which product rules apply? | 3     | `WorkspacePlugin.validateCanonical` before persist (5.2) |

```text
tenantId (from Phase 4 context)
  → load workspace_type from tenants row (starter today)
  → resolve WorkspacePlugin from registry
  → validateCanonical(document) — FAIL closed
  → write canonical_data + projections + outbox (same TX)
```

---

## Interoperable workspace (starter → Denali)

| `workspace_type` | Plugin package                | Projection map owner                                 |
| ---------------- | ----------------------------- | ---------------------------------------------------- |
| `starter`        | `packages/workspaces/starter` | DEL-P5-001 §5 (`data.basics.title`, `schemaVersion`) |
| `denali`         | Phase 6 — not in Phase 5 gate | Addendum to schema doc at Denali cutover             |

**BLOCKER-P5-011:** Phase 5 tests **starter only**; document waiver in forensic until Denali exists.

---

## Outbox & audit (tenant-scoped events)

| Table           | Tenant column  | RLS          | Payload                 |
| --------------- | -------------- | ------------ | ----------------------- |
| `outbox_events` | `tenant_id` FK | FORCE policy | JSONB event payload     |
| `audit_events`  | `tenant_id` FK | FORCE policy | actor + entity metadata |

Relay and handlers **must** propagate `tenant_id` from row — never infer tenant from unauthenticated queue message.

---

## Forbidden conflations (FAIL)

```yaml
forbidden:
  - "Put WorkspacePlugin implementation inside apps/api tour module"
  - "Skip validateCanonical because JSON 'looks valid'"
  - "Publish in-process domain event after 5.4 without outbox row"
  - "Use canonical_data @> query on hot list path (use projections)"
```

---

## Cross-links

| Doc                                                                                                                      | Role                               |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| [`phase-4/appendices/workspace-interoperability-model.md`](../../phase-4/appendices/workspace-interoperability-model.md) | Tenant ≠ Workspace (Phase 4)       |
| [`phase-5-canonical-schema.md`](../phase-5-canonical-schema.md)                                                          | DDL + invariants                   |
| [`industry-alignment-2026.md`](industry-alignment-2026.md)                                                               | External pattern map               |
| [`platform-continuity-0-5.md`](platform-continuity-0-5.md)                                                               | Phase ownership 0–5                |
| [`REPO-PROJECT-ALIGNMENT.md`](REPO-PROJECT-ALIGNMENT.md)                                                                 | Doc ↔ `apps/api` enterprise tenant |

**Human T3:** [`research/phase-5-data-architecture-research.md`](../../research/phase-5-data-architecture-research.md) §1 — narrative only.
