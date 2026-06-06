# Phase 7 — Industry alignment (2026)

```yaml
alignment_version: "2026-06-04-v1"
research_source: docs/research/phase-7-workspace-hardening-research.md
```

## Hybrid tenant tiers

| Industry pattern              | app-tour decision            |
| ----------------------------- | ---------------------------- |
| Shared schema + RLS default   | Pool tier — Phases 4–6       |
| DB/schema silo for enterprise | Silo opt-in — 7.7 DEC-P7-004 |

Sources: [Brocoders 2026](https://brocoders.com/blog/multi-tenant-architecture-designing-saas-apps/), [DEV hybrid routing](https://dev.to/young_gao/multi-tenant-architecture-database-per-tenant-vs-shared-schema-1n2e)

## Second workspace / plugin registry

| Pattern                         | Phase 7                               |
| ------------------------------- | ------------------------------------- |
| Manifest + one-way registration | urban plugin registers; core consumes |
| No core branches per workspace  | DEC-P7-001 genericity proof           |

## Connection routing

| Pattern                       | Phase 7                  |
| ----------------------------- | ------------------------ |
| `SET LOCAL search_path`       | Schema-per-tenant option |
| PgBouncer transaction pooling | Pool tier scale          |
| Per-tier connection caps      | Rate limits 7.6          |

## Observability

| Pattern                | Phase 7                   |
| ---------------------- | ------------------------- |
| Structured JSON logs   | MAP §10 complete          |
| Optional OpenTelemetry | DEC-P7-012 — not blocking |

## Explicit non-adoption

- WASM sandbox (MAP §9.2 deferred)
- Full CDC/warehouse (Phase 8+)
- Database-per-tenant for all tenants

## REQ linkage

REQ-P7-015..023 align with industry rows above — see verification-matrix.
