# Phase handoff — 0 → 5 (app-tour)

```yaml
agent_load_tier: T0_execution
project: interoperable workspace · pool multi-tenant
canonical_cross_phase: ../../appendices/PLATFORM-CONTINUITY-0-5.md
phase_5_entry_map: ../../phase-5/appendices/CROSS-PHASE-ENTRY-MAP.md
```

> **Canonical cross-phase SoT:** [`PLATFORM-CONTINUITY-0-5.md`](../../appendices/PLATFORM-CONTINUITY-0-5.md) — this file is the **4.x ↔ 5.0** handoff slice only.

## Phases 0–2 (foundation before apps)

| Phase | Gate           | Feeds Phase 5 via                   |
| ----- | -------------- | ----------------------------------- |
| 0     | `phase-0:gate` | `CanonicalDocument`, workspace-sdk  |
| 1     | `phase-1:gate` | `validateCanonical` / wizard engine |
| 2     | `phase-2:gate` | tokens only (no DB)                 |

Detail: [`../../phase-5/appendices/phase-0-3-bridge.md`](../../phase-5/appendices/phase-0-3-bridge.md)

## What each phase owns

| Phase | Owns                                                                            | Must not own                          |
| ----- | ------------------------------------------------------------------------------- | ------------------------------------- |
| **3** | `WorkspacePlugin`, CASL, apps scaffold, in-memory tours dev                     | RLS production, outbox                |
| **4** | `tenant-kernel`, host, RLS on tours, in-process events, tenant theme production | `canonical_data` rename, outbox table |
| **5** | `canonical_data`, projections, outbox, audit_events                             | Denali UI port, silo DB               |

## Artifacts crossing boundaries

| Handoff | From               | To  | Artifact                                                                                                                                                                                                |
| ------- | ------------------ | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3→4     | Phase 3 gate green | 4.0 | `phase-3:gate` + red-flag report                                                                                                                                                                        |
| 4→4.1   | 4.0                | 4.1 | R0–R3 closed                                                                                                                                                                                            |
| 4→4.2   | 4.1                | 4.2 | `packages/tenant-kernel`                                                                                                                                                                                |
| 4→5     | 4.6                | 5.0 | `phase-4:gate` + [`phase-4-bridge.md`](../../phase-5/appendices/phase-4-bridge.md) + [`CROSS-PHASE-ENTRY-MAP.md`](../../phase-5/appendices/CROSS-PHASE-ENTRY-MAP.md) (`phase_5_entry_requires_modular`) |

## Tenant vs workspace (constant)

```text
Host → tenantId (Phase 4)
     → WorkspacePlugin rules (Phase 3)
     → persist canonical (Phase 3 write path → Phase 5 shape)
```

Detail: [`workspace-interoperability-model.md`](workspace-interoperability-model.md) · Phase 5: [`workspace-data-layer-model.md`](../../phase-5/appendices/workspace-data-layer-model.md).

## SQL order

```text
001_tenant_rls.sql     # Phase 4
002_phase5_data_layer.sql  # Phase 5 — after 4.6 only
```

## Event bus evolution

| Phase | Mechanism                                                                          |
| ----- | ---------------------------------------------------------------------------------- |
| 4.5   | `publishDomainEvent` in-process                                                    |
| 5.4   | transactional `outbox_events` — **FORBIDDEN-006** to publish without row after 5.4 |
