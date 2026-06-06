# Phase 4 — Future risk signals (agent-readable)

```yaml
document_meta:
  version: "2026-06-04"
  agent_load_tier: T0_execution
  purpose: "Pre-PR and pre-4.6 scan — escalate before scaling debt"
  fail_token: FAIL
  binding: advisory_not_gating
  full_board_report: ../FUTURE-PROOFING-REPORT.md
```

> **RULE:** Agents run this scan before subphase **4.6** closure or any PR touching tenant boundary, RLS, or events. Signals do **not** replace P4-E-* tests.

---

## Scan procedure

```yaml
pre_pr_risk_scan:
  when:
    - "current_subphase >= 4.2"
    - "PR touches apps/api tenant-kernel packages/tenant-kernel packages/platform-events infra/sql"
  steps:
    - action: MATCH signals below against diff + subphase header p4_e_ids
    - action: IF any signal severity critical AND unmitigated → annotate PR with risk_id
    - action: NEVER use signal pass as closure proof — P4-E-* only
```

---

## Risk signals

| risk_id | Category | Signal | Subphase | Mitigation (doc/code) | Escalate if |
|---------|----------|--------|----------|----------------------|-------------|
| FR-01 | CI / platform eng | `phase-4:gate` runs full `pnpm test` + nested `phase-3:gate` | 4.6 | Run package-scoped tests during dev; full gate at 4.6 only | Gate >15m without plan |
| FR-02 | Multi-tenant | RLS bypass via raw SQL or Prisma outside `withTenantTransaction` | 4.2 | Code review + `rls-isolation.integration.spec.ts` | New query path without wrapper |
| FR-03 | Multi-tenant | `set_config` leak across pooled connections | 4.2 | P4-E-RLS-02 unit/session test | Pool reuse test missing |
| FR-04 | Scaling | In-process bus only; no outbox relay | 4.5 | Phase 5 outbox — forbidden in 4 | Multi-instance deploy before Phase 5 |
| FR-05 | Scaling | P4-E-SCALE-01 satisfied by doc Big-O only | 4.2 | Add repository integration assert | Tenant table scan in write path |
| FR-06 | Observability | No mandatory correlation ID test | 4.1–4.6 | observability.md hooks; Phase 7 OTel | Prod incident without `tenantId` in logs |
| FR-07 | AI execution | Agent loads `phase-4-overview.md` during T0 | all | agent-load-tiers.md → FAIL | Overview in agent context |
| FR-08 | AI execution | TH-1 / 4.4 skipped (no P4-E-*) | 4.4 | test-matrix TH-1 → DOD-7 | Merge 4.6 without 4.4 exit |
| FR-09 | Maintainability | Human monolith `phase-4-tenant-kernel.md` drifts from modular tree | T3 | knowledge-index SoT; modular wins | §14.2 or stale gate in monolith |
| FR-10 | SaaS | Parallel 4.4 ∥ 4.5 merge conflicts on shared API files | 4.4, 4.5 | Serialize touches to `apps/api` or coordinate | Same file dual PR |
| FR-11 | SaaS | Husky `ci:integrity` omits `phase-4:gate` | 4.6 | Explicit `phase-4:gate` at closure | Assumes pre-commit = phase complete |
| FR-12 | Platform eng | Guard test minimums (`TENANT_KERNEL_TEST_MIN_phase4: 6`) | 4.1, 4.5 | Raise thresholds when coverage grows | Tests added only to hit minimum |

---

## Severity model

```yaml
severity:
  critical: "tenant data leak, cross-tenant read, or auth bypass class"
  high: "scaling wall before Phase 5/7 or gate timeout blocks delivery"
  medium: "maintainability / agent drift / observability gap"
  low: "cosmetic doc or non-blocking tech debt"
```

---

## Cross-references

| Topic | Owner |
|-------|-------|
| P4-E-* closure | `audits/verification-matrix.md` |
| Forbidden scope creep | `phase-4-enforcement.md` `forbidden_phase_4` |
| Observability hooks | `observability.md` |
| Phase 5 handoff | `phase-4-enforcement.md` `phase_5_entry_requires` |
