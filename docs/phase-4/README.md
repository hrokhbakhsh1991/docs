# Phase 4 — AI execution documentation hub

Modular **AI-execution** spec for Tenant Kernel (Phase 4). Narrative human guide remains at [`../phase-4-tenant-kernel.md`](../phase-4-tenant-kernel.md); Markdoc canonical at [`../phase-4-tenant-kernel.mdoc`](../phase-4-tenant-kernel.mdoc).

## Canonical entrypoint (agents)

- **Central index:** [`../phase-4-tenant-kernel.ai-exec.md`](../phase-4-tenant-kernel.ai-exec.md)
- **Detailed modules:** [`phase-4.ai-exec.index.md`](phase-4.ai-exec.index.md)

## Navigation

| File | Contents | When to load |
|------|----------|--------------|
| [`phase-4.ai-exec.index.md`](phase-4.ai-exec.index.md) | `document_meta`, agent boot, module map | Every session (cold start) |
| [`phase-4-overview.md`](phase-4-overview.md) | STEP 1 phase detection · §1–§5 platform/enterprise/outputs/architecture | Context + design |
| [`phase-4-state-machine.md`](phase-4-state-machine.md) | State model · DAG · §0 alignment | Before any subphase transition |
| [`phase-4-enforcement.md`](phase-4-enforcement.md) | §14 verification (`P4-E-*`) · §15 forbidden · §16 DoD · §17 phase 5 entry | Every PR |
| [`phase-4-guard.md`](phase-4-guard.md) | `phase-4-guard.mjs` checks · CI pipeline | Gate debug / 4.6 |
| [`subphases/4.0-gate-of-gates.md`](subphases/4.0-gate-of-gates.md) | R0–R3 (§7) | Subphase 4.0 |
| [`subphases/4.1-tenant-kernel.md`](subphases/4.1-tenant-kernel.md) | `@app-tour/tenant-kernel` (§8) | Subphase 4.1 |
| [`subphases/4.2-postgres-rls.md`](subphases/4.2-postgres-rls.md) | Postgres + RLS + Prisma (§9) | Subphase 4.2 |
| [`subphases/4.3-provisioning.md`](subphases/4.3-provisioning.md) | Two tenants (§10) | Subphase 4.3 |
| [`subphases/4.4-tenant-theme.md`](subphases/4.4-tenant-theme.md) | TenantTheme production (§11) | Subphase 4.4 |
| [`subphases/4.5-platform-events.md`](subphases/4.5-platform-events.md) | Event bus (§12) | Subphase 4.5 |
| [`subphases/4.6-phase-gate.md`](subphases/4.6-phase-gate.md) | `phase-4:gate` + forensic (§13) | Subphase 4.6 |
| [`appendices/dependency-graph.md`](appendices/dependency-graph.md) | Appendix A | Import-boundary work |
| [`appendices/test-matrix.md`](appendices/test-matrix.md) | Appendix E | Test planning |
| [`appendices/map-bridge.md`](appendices/map-bridge.md) | Appendix G | MAP cross-ref |
| [`appendices/pr-template.md`](appendices/pr-template.md) | Appendix C | PR checklist |
| [`audits/verification-matrix.md`](audits/verification-matrix.md) | P4-E-* ↔ p4_* binding | Every PR |
| [`QUALITY-VALIDATION.md`](QUALITY-VALIDATION.md) | Quality pass report | Validation |

## Recommended read order

1. [`phase-4.ai-exec.index.md`](phase-4.ai-exec.index.md) — `agent_boot` + `document_meta`
2. [`phase-4-state-machine.md`](phase-4-state-machine.md) — transitions + DAG
3. [`phase-4-enforcement.md`](phase-4-enforcement.md) — `P4-E-*` for active PR
4. Active file under [`subphases/`](subphases/) for `current_subphase`
5. [`phase-4-overview.md`](phase-4-overview.md) — only if enterprise §2 or §5 architecture needed

## Validation

- [`QUALITY-VALIDATION.md`](QUALITY-VALIDATION.md) — Phase 4 quality pass
- [`../phases/DOCUMENTATION-CURATION-VALIDATION.md`](../phases/DOCUMENTATION-CURATION-VALIDATION.md) — cross-phase curation

## Related (human + Markdoc)

- Narrative guide: [`../phase-4-tenant-kernel.md`](../phase-4-tenant-kernel.md)
- Doc-Gate canonical: [`../phase-4-tenant-kernel.mdoc`](../phase-4-tenant-kernel.mdoc)
