# Platform continuity — Phases 0–7 (canonical)

```yaml
continuity_version: "2026-06-04-v1"
extends: PLATFORM-CONTINUITY-0-6.md
guard: scripts/guards/lib/phase-cross-continuity.mjs
```

> Full 0–5 table: [`PLATFORM-CONTINUITY-0-5.md`](PLATFORM-CONTINUITY-0-5.md). Phase 6: [`PLATFORM-CONTINUITY-0-6.md`](PLATFORM-CONTINUITY-0-6.md). This file adds **Phase 7** only.

## Phase 7 ownership

| Phase | Delivers                                                                                                                             | Must NOT own                                                                     |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| **7** | `packages/workspaces/urban` minimal, genericity proof, observability + rate limits, `TenantConnectionRouter` silo, Platform DoD gate | Denali domain expansion, CDC/warehouse, WASM sandbox, full legacy urban web tree |

## Gate chain (append)

```yaml
phase-7:gate: "build + test + phase-6:gate + phase-7:guard"
```

## Agent entry — Phase 7

| Role            | File                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| **SOLE router** | [`phase-7/phase-7-agent-router.md`](../phase-7/phase-7-agent-router.md)                               |
| Decisions       | [`phase-7/appendices/IMPLEMENTATION-DECISIONS.md`](../phase-7/appendices/IMPLEMENTATION-DECISIONS.md) |
| 6→7 entry       | [`phase-7/appendices/phase-6-bridge.md`](../phase-7/appendices/phase-6-bridge.md)                     |

## Handoff 6→7

| Phase 6 delivers                        | Phase 7 consumes                     |
| --------------------------------------- | ------------------------------------ |
| Denali plugin + bootstrap pattern       | Template for urban second plugin     |
| Generic `resolveWorkspacePluginForType` | urban registration without core diff |
| Finance/outbox in plugin boundary       | Cross-workspace adversarial re-run   |
| Phase 6 gate + forensic                 | 7.0 entry prerequisite               |

## Handoff 4→7 (tenant routing)

| Phase 4 delivers                 | Phase 7 extends                         |
| -------------------------------- | --------------------------------------- |
| RLS + `SET LOCAL` tenant context | Silo tier via `tenant_routes`           |
| `TenantRoute` interface stub     | `TenantConnectionRouter` implementation |

## Handoff 3→7 (observability)

| Phase 3+ delivers             | Phase 7 completes              |
| ----------------------------- | ------------------------------ |
| Structured logging foundation | MAP §10 runbook + alert matrix |
| Request ID propagation        | Optional OTel trace hooks      |
