# Phase 6 — Enforcement

> **Boundaries:** [`appendices/phase-boundaries.md`](appendices/phase-boundaries.md) · **Decisions:** [`appendices/IMPLEMENTATION-DECISIONS.md`](appendices/IMPLEMENTATION-DECISIONS.md) · **DAG:** [`phase-6-state-machine.md`](phase-6-state-machine.md)

---

## Hard rules (RULE-P6)

```yaml
RULE-P6-001:
  statement: Denali product code lives only in packages/workspaces/denali — not platform-core
  test: depcruise + denali-coupling.contract.spec.ts
  enforceable: guard + PR review

RULE-P6-002:
  statement: No runtime import from legacy/ in trunk apps/api or apps/web
  test: grep + guard:import-boundary
  enforceable: CI

RULE-P6-003:
  statement: Single wizard SoT is CanonicalDocument — no RHF mirror
  test: no DenaliWizardSyncContext pattern in trunk web
  enforceable: code review

RULE-P6-004:
  statement: Legacy domain port is manual copy into plugin — ACL folder for shape mapping only
  test: rg '@repo/denali-domain' apps/ → zero
  enforceable: static analysis

RULE-P6-005:
  statement: resolveWorkspacePluginForType('denali') must return getDenaliWorkspacePlugin — not NOT_BOUND
  test: apps/api/test/denali-workspace-plugin.spec.ts
  enforceable: integration test

RULE-P6-006:
  statement: Web must lazy-load denali plugin — no starter fallback when tenant is denali
  test: bundle + integration per subphase 6.5
  enforceable: test

RULE-P6-007:
  statement: Finance handlers only under plugin src/finance — no apps/api/modules/finance expansion
  test: tree audit + finance-outbox-consumer.spec.ts
  enforceable: test + review

RULE-P6-008:
  statement: Finance consumer must reject cross-tenant domainEventId (FINANCE_LEDGER_TENANT_MISMATCH)
  test: port legacy emit-finance-ledger-journal-outbox.spec.ts pattern
  enforceable: unit test

RULE-P6-009:
  statement: MinIO object keys MUST be prefixed with tenantId
  test: minio-photo.spec.ts adversarial cross-tenant read
  enforceable: e2e

RULE-P6-010:
  statement: migrateCanonical must not dual-write trip_details + canonical_data
  test: migrate-canonical-denali.spec.ts post-migrate single SoT
  enforceable: integration

RULE-P6-011:
  statement: Subphase 6.5 requires 6.2 AND 6.3 AND 6.4 VERIFIED_BEHAVIORAL minimum
  test: BOOT-MANIFEST detect + TG-P6-005
  enforceable: agent router

RULE-P6-012:
  statement: Phase 6 closure requires HTTP/e2e smoke — not compile-only
  test: REQ-P6-015 + REQ-P6-018 behavioral
  enforceable: phase-6:gate + forensic

RULE-P6-013:
  statement: SHADOW_VALIDATE_DENALI forbidden when NODE_ENV=production
  test: env guard in denali-workspace-plugin.spec.ts
  enforceable: unit test

RULE-P6-014:
  statement: Widget renderers come from platform-core — plugin registers kinds only
  test: composites.contract.spec.ts + phase-2 theme ingress
  enforceable: contract test

RULE-P6-015:
  statement: Registry parity fixtures must match legacy denali-domain evaluate output
  test: registry-parity.spec.ts ≥3 golden JSON
  enforceable: unit test
```

---

## FORBIDDEN

```yaml
forbidden:
  - id: P6-F-001
    action: Add DENALI_* to apps/api generic DTO layer
  - id: P6-F-002
    action: import legacy runtime paths in trunk apps
  - id: P6-F-003
    action: platform-core change required for Denali widgets only
  - id: P6-F-004
    action: Phase 6 closure from compile-only without HTTP/e2e
  - id: P6-F-005
    action: Start 6.5 before both 6.3 and 6.4 complete
```

---

## Transition guards (TG-P6)

| ID            | Rule                                                          |
| ------------- | ------------------------------------------------------------- |
| TG-P6-001     | 6.1 blocked until 6.0 yaml `phase_5_gate` PASS                |
| TG-P6-002     | 6.2 blocked until 6.1 VERIFIED_SCAFFOLD                       |
| TG-P6-003     | 6.8 blocked until 6.5 VERIFIED_BEHAVIORAL                     |
| TG-P6-004     | 6.9 blocked until 6.2–6.8 behavioral per merge_6_9_requires   |
| **TG-P6-005** | **6.5 blocked until 6.2 + 6.3 + 6.4 all VERIFIED_BEHAVIORAL** |
| TG-P6-006     | 6.3 ∥ 6.4 only after 6.2 VERIFIED_BEHAVIORAL                  |

---

## subphase_dod

```yaml
"6.0":
  prove: [pnpm run phase-5:gate, reports/phase-6-entry-verified.yaml phase_5_gate PASS]
"6.1":
  prove: [pnpm --filter @app-tour/workspace-denali build, phase-6.contract.spec.ts scaffold]
"6.2":
  prove: [registry-parity.spec.ts, denali:codegen clean]
"6.3":
  prove: [composites.contract.spec.ts, theme/tokens.css ingress]
"6.4":
  prove: [finance-outbox-consumer.spec.ts]
"6.5":
  prove: [denali-workspace-plugin.spec.ts, denali-workspace-binding.contract.spec.ts]
"6.6":
  prove: [smoke suite per appendices/SMOKE-SCENARIO-MAP.md]
"6.7":
  prove: [minio-photo.spec.ts]
"6.8":
  prove: [migrate-canonical-denali.spec.ts]
"6.9":
  prove: [pnpm run phase-6:gate, forensic ≥ 8]
```

---

## phase_6_entry_requires_modular

```yaml
phase_6_entry_requires_modular:
  - phase_5_gate_exit_0
  - denali_probe_replaced_by_plugin
  - workspace_sdk_denali_binding
  - no_legacy_runtime_imports
```
