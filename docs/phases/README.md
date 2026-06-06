# Phase documentation index

Each platform phase has a guide in `docs/` and a row in [`MIGRATION-MAP.md` §11](../MIGRATION-MAP.md#۱۱-فازبندی-migration).

| Phase | Markdoc (canonical) | Legacy `.md` | Status |
|-------|---------------------|--------------|--------|
| 0 | [`phase-0-foundation.mdoc`](../phase-0-foundation.mdoc) | [`.md`](../phase-0-foundation.md) | Closed (baseline) · §19 synced · AI-exec: [`phase-0/`](../phase-0/README.md) |
| 1 | [`phase-1-platform-core.mdoc`](../phase-1-platform-core.mdoc) | [`.md`](../phase-1-platform-core.md) | Closed (baseline) · §19 synced · AI-exec: [`phase-1/`](../phase-1/README.md) |
| 2 | [`phase-2-design-system.mdoc`](../phase-2-design-system.mdoc) | [`.md`](../phase-2-design-system.md) | Closed: Zero-Debt Verified · §19 synced · AI-exec: [`phase-2/`](../phase-2/README.md) |
| 3 | [`phase-3-design-system.mdoc`](../phase-3-design-system.mdoc) | [`.md`](../phase-3-design-system.md) | Closed: Zero-Debt Verified · AI-exec: [`phase-3/`](../phase-3/README.md) |
| 4 | [`phase-4-tenant-kernel.mdoc`](../phase-4-tenant-kernel.mdoc) | [`.md`](../phase-4-tenant-kernel.md) | Open · AI-exec: [`phase-4/`](../phase-4/README.md) |
| 5 | [`phase-5-canonical-schema.mdoc`](../phase-5-canonical-schema.mdoc) | [`.md`](../phase-5-canonical-schema.md) · research [`.md`](../research/phase-5-data-architecture-research.md) | Open · AI-exec: [`phase-5/`](../phase-5/README.md) |

Registry source of truth: [`phase-registry.json`](../phase-registry.json).

## AI execution (agents)

| Step | Resource |
|------|----------|
| 1 | This index — pick phase hub `phase-N/README.md` |
| 2 | `phase-N/phase-N.ai-exec.index.md` — AGENT_START_SEQUENCE |
| 3 | `pnpm run phase-N:gate` per `package.json` (not stale narrative JSON) |

**Curation report:** [`DOCUMENTATION-CURATION-VALIDATION.md`](DOCUMENTATION-CURATION-VALIDATION.md)
