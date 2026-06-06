# Phase 7 — Platform Definition of Done

```yaml
phase_id: "7"
phase_name: "Second workspace + platform hardening"
adr: "ADR-007 (proposed — see phase-7/appendices/adr-007.md)"
prerequisite: pnpm run phase-6:gate
closure: pnpm run phase-7:gate
agent_entry: docs/phase-7/phase-7-agent-router.md
legacy_urban_reference: legacy/packages/types/src/tour-form-profile-descriptors.ts
```

## North star

Close **Platform DoD** — prove the plugin model is generic with a second minimal workspace, complete ops maturity, and enterprise tenant routing.

| In scope (Phase 7)                                         | Out of scope (Phase 8+)     |
| ---------------------------------------------------------- | --------------------------- |
| `packages/workspaces/urban` minimal — E2E create → publish | Full legacy urban web port  |
| Zero `platform-core` diff for urban                        | WASM third-party sandbox    |
| Observability complete + runbook (MAP §10)                 | CDC / warehouse             |
| Rate limits (Redis per tenant)                             | Database-per-tenant for all |
| `TenantConnectionRouter` silo tier                         | Phase 8+ product features   |

## MAP alignment (§11)

| #   | Deliverable                         | Subphase doc                                                                       |
| --- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| 7.1 | `packages/workspaces/urban` minimal | [`phase-7/subphases/7.1-urban-package.md`](phase-7/subphases/7.1-urban-package.md) |
| 7.2 | No `platform-core` change for urban | [`7.2-genericity-proof.md`](phase-7/subphases/7.2-genericity-proof.md)             |
| 7.3 | Bootstrap second plugin (api/web)   | [`7.3-bootstrap.md`](phase-7/subphases/7.3-bootstrap.md)                           |
| 7.4 | Urban E2E create → publish          | [`7.4-urban-e2e.md`](phase-7/subphases/7.4-urban-e2e.md)                           |
| 7.5 | Observability + runbook             | [`7.5-observability.md`](phase-7/subphases/7.5-observability.md)                   |
| 7.6 | Rate limits Redis                   | [`7.6-rate-limits.md`](phase-7/subphases/7.6-rate-limits.md)                       |
| 7.7 | `TenantConnectionRouter` silo       | [`7.7-tenant-router.md`](phase-7/subphases/7.7-tenant-router.md)                   |
| 7.8 | Adversarial + `ci:integrity`        | [`7.8-adversarial.md`](phase-7/subphases/7.8-adversarial.md)                       |
| 7.9 | Platform DoD gate                   | [`7.9-platform-gate.md`](phase-7/subphases/7.9-platform-gate.md)                   |

## Critical distinction: legacy urban_event ≠ workspace urban

| Concept       | Legacy                                   | Phase 7 trunk               |
| ------------- | ---------------------------------------- | --------------------------- |
| `urban_event` | Form profile — strip itinerary/transport | Inspires slim registry only |
| Wizard rail   | urban → Denali rail (forbidden)          | Independent urban plugin    |
| Demo tenant   | `urban-demo-tenant.fixture.ts`           | Smoke reference only        |

See [`phase-7/appendices/LEGACY-URBAN-REFERENCE.md`](phase-7/appendices/LEGACY-URBAN-REFERENCE.md).

## Repo truth (trunk 2026-06-04)

| Path                                  | Status                                |
| ------------------------------------- | ------------------------------------- |
| `packages/workspaces/urban`           | **Absent** — doc-only scaffold        |
| `packages/workspaces/denali`          | Probe / in-progress (Phase 6)         |
| `packages/tenant-kernel/src/route.ts` | `TenantRoute` interface — router stub |
| Observability §10                     | Partial — runbook incomplete          |

## Documentation score (doc-only)

| Metric               | Target                   |
| -------------------- | ------------------------ |
| Doc execution system | **≥96**                  |
| Guard                | `pnpm run phase-7:guard` |

See [`phase-7/audits/DOC-EXECUTION-SCORECARD.md`](phase-7/audits/DOC-EXECUTION-SCORECARD.md).

## Research (pre–subphase depth)

- [`research/phase-7-workspace-hardening-research.md`](research/phase-7-workspace-hardening-research.md)
- T0 stub: [`research/phase-7-workspace-hardening-research.ai-exec.md`](research/phase-7-workspace-hardening-research.ai-exec.md)

## Agent execution

**Do not** implement from this file alone. Use [`phase-7/phase-7-agent-router.md`](phase-7/phase-7-agent-router.md) + [`phase-7/appendices/BOOT-MANIFEST.yaml`](phase-7/appendices/BOOT-MANIFEST.yaml).

## §12 covenant

- `phase-7.contract.spec.ts` — second workspace without `platform-core` diff
- `pnpm run ci:integrity` green at 7.9
- Forensic audit ≥ 8 at 7.9
- See [`MIGRATION-MAP.md`](MIGRATION-MAP.md) Phase 7 checklist
