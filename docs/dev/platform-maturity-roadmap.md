# Platform Maturity Roadmap

**Program:** REMEDIATION #1 + LOOP #4 final enterprise audit  
**Date:** 2026-08-24 (LOOP #4 refresh)  
**Scope:** Items classified **BEFORE_5_CUSTOMERS**, **BEFORE_ENTERPRISE_CONTRACT**, or **LONG_TERM_SCALE**. Not executed unless marked LOOP #4 remediation.

**LOOP #4 verdict:** `GO_WITH_EXTERNAL_BLOCKERS — ENTERPRISE FOUNDATION CERTIFIED`. Gaps below are **safely deferred**; none block next-customer or Denali onboarding.

---

## BEFORE_5_CUSTOMERS

| ID | Finding | Source | Rationale |
|----|---------|--------|-----------|
| MAT-001 | Capability/profile semver negotiation | RT-04, AUDIT #6 | No live upgrade path; manifests are implicit latest |
| MAT-002 | Hollow capability runtime validators → real enforcement | AUDIT #3 BEH-03, AUDIT #4 ISO-CAP-01 | Composition matrix blocks absent caps; validators are no-op stubs |
| MAT-003 | `workspaceIdBranches` ratchet to 0 (16 legacy provisioning literals remain) | AUDIT #1 CW9-08, AUDIT #2 ARCH-02 | `baseline:cw-compare` PASS; literals are non-regression ratchet |
| MAT-004 | Denali-primary outdoor codegen decoupling | AUDIT #2 ARCH-04 | `starter-outdoor` profile still Denali-shaped in codegen defaults |
| MAT-005 | Registry eager-load blast radius reduction | AUDIT #2 ARCH-05, RT-03 | `listApiWorkspacePluginsFromManifest()` loads all plugins |
| MAT-006 | Per-workspace booking runtime isolation (not shared by `workspaceType`) | AUDIT #4 ISO-RT-01 | RLS + plugin dispatch sufficient today; shared runtime is coupling debt |
| MAT-007 | Urban workspace-definition checksum parity gate | AUDIT #3 BEH-02 | Denali parity certified; Urban divergence intentional but un-gated |
| MAT-008 | Guest-smoke HTTP stubs → full behavioral coverage | AUDIT #3 BEH-01 | Cert fixtures use smoke-tier paths |
| MAT-009 | `genericHostEditsForOnboarding` manual list → 0 via env-only dev-host map | CW metrics | Frozen at 5; no new edits since CW0 |
| MAT-023 | LOOP #4: Registry output count / LOC ratchet per manifest | LOOP #4 Phase A | 91 keys at 17 workspaces; guard budget before 30+ |
| MAT-024 | LOOP #4: Lazy policy validator imports (mirror plugin pattern) | LOOP #4 Phase A/F | Build-time containment today; runtime deploy risk at scale |
| MAT-025 | LOOP #4: Member wallet DL-15 closure before `workspaceWallet` v2 | LOOP #4 Phase B/D | Operator/member finance boundary unresolved |

---

## BEFORE_ENTERPRISE_CONTRACT

| ID | Finding | Source | Rationale |
|----|---------|--------|-----------|
| MAT-010 | Deployment stamps / pinned workspace bundles per tenant | RT-02, AUDIT #6 | Manifest fingerprint reload (REM-007) is process-level only |
| MAT-011 | Noisy-neighbor controls (per-tenant rate limits, queue fairness) | RT-05 | Platform rate-limit exists; not tenant-metered |
| MAT-012 | Tenant-level observability (dashboards, SLO burn) | RT-06 | Correlation IDs exist; no per-tenant SLO automation |
| MAT-013 | Advanced data residency / regionalization | RT-07 | Single-region Postgres assumption |
| MAT-014 | Governance / deprecation policy for capabilities and profiles | RT-08 | No formal deprecation window |
| MAT-015 | Enterprise SLA automation (error budget, paging) | RT-09 | Manual ops playbook only |
| MAT-016 | Cost attribution per workspace/tenant | RT-10 | No metering layer |

---

## LONG_TERM_SCALE

| ID | Finding | Source | Rationale |
|----|---------|--------|-----------|
| MAT-017 | Multi-region active-active | RT-11 | Out of current product scope |
| MAT-018 | Registry partitioning / lazy domain loading at scale | RT-03 | 17 manifests today; premature optimization |
| MAT-019 | Capability version negotiation across API + SDK + UI surfaces | RT-04 | Requires MAT-001 + contract semver |
| MAT-020 | Profile live-upgrade without redeploy | RT-01 extension | REM-007 mitigates drift; tenant-level freeze is enterprise |
| MAT-021 | Automated tenant lifecycle (suspend, export, purge) | RT-12 | Manual admin paths |
| MAT-022 | Cross-workspace analytics federation | RT-13 | Single-tenant analytics sufficient |

---

## Dependency graph (high level)

```text
MAT-001 (semver) → MAT-019 (negotiation) → MAT-020 (live upgrade)
MAT-010 (stamps) → enterprise contract readiness
REM-007 (manifest fingerprint) → MAT-010 (per-tenant freeze)
MAT-002 (capability validators) → safe capability v2 wire changes
MAT-025 (DL-15) → member Wallet v2
MAT-014 (deprecation) → transport/equipment alias removal
```

## LOOP #4 — evolution readiness summary

| Target | Ready? | Blocker |
|--------|--------|---------|
| Additive profile/capability (starter-outdoor v2) | **READY_NOW** | Changelog discipline |
| Transport/booking validators | **EXTENDABLE_LATER** | MAT-002 |
| Breaking profile defaults | **EXTENDABLE_LATER** | MAT-001 + profileVersionPin |
| Member Wallet | **EXTENDABLE_LATER** | MAT-025 (DL-15) |
| Ticketing / Weather / Driver settlement | Greenfield CW7 capability | Not host rewrite |
| Refund | **READY_NOW** | Landed under finance |

*Architect, documentation status: Updated. Link to docs: `docs/dev/platform-maturity-roadmap.md`.*
