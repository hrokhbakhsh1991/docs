# AI-EXECUTION — Phase 7 Research (T0 stub)

```yaml
agent_load_tier: T0
non_authoritative_for_execution: true
sole_execution_entry: docs/phase-7/phase-7-agent-router.md
research_body: docs/research/phase-7-workspace-hardening-research.md
decisions: docs/phase-7/appendices/IMPLEMENTATION-DECISIONS.md
```

> **Do not implement from this file.** Execution: [`phase-7-agent-router.md`](../phase-7/phase-7-agent-router.md).

---

## One-line goal

Close **Platform DoD**: second workspace (`urban`) + observability/rate limits + `TenantConnectionRouter` — **zero** urban-specific `platform-core` PRs.

---

## DAG

`7.0 → 7.1 → 7.2 → 7.3 → 7.4 → {7.5 ∥ 7.6} → 7.7 → 7.8 → 7.9`

---

## Forbidden

| ID  | Rule                                                       |
| --- | ---------------------------------------------------------- |
| F1  | `if (workspaceType === 'urban')` in platform-core          |
| F2  | urban_event → Denali rail coupling                         |
| F3  | Urban scope = Denali-II (finance, MinIO, full domain port) |
| F4  | Silo for all tenants by default                            |
| F5  | Closure from doc guard only — need E2E + ci:integrity      |
| F6  | Import legacy runtime in trunk apps                        |

---

## Industry defaults (2026)

| Topic         | Choose                                                      |
| ------------- | ----------------------------------------------------------- |
| Tenant tiers  | pool+RLS default; silo opt-in enterprise                    |
| Urban plugin  | starter-plus minimal registry                               |
| Router        | `tenant_routes` + `TenantConnectionRouter` in tenant-kernel |
| Observability | generic API layer — MAP §10                                 |
| Rate limits   | Redis keys per tenant + tier                                |

---

## Phase 6 dependency

| 6.x                      | Blocks 7.x        |
| ------------------------ | ----------------- |
| 6.9 gate                 | 7.0 entry         |
| Denali bootstrap pattern | 7.3 second plugin |
| Generic resolver         | 7.3–7.4           |

---

## Links

| Layer         | Path                                                                                 |
| ------------- | ------------------------------------------------------------------------------------ |
| Research (T3) | [`phase-7-workspace-hardening-research.md`](phase-7-workspace-hardening-research.md) |
| Hub           | [`phase-7-platform-dod.md`](../phase-7-platform-dod.md)                              |
| MAP Phase 7   | [`MIGRATION-MAP.md`](../MIGRATION-MAP.md)                                            |
| Continuity    | [`PLATFORM-CONTINUITY-0-7.md`](../appendices/PLATFORM-CONTINUITY-0-7.md)             |
