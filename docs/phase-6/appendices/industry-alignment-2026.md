# Phase 6 — Industry alignment (2026)

```yaml
agent_load_tier: T0_execution
doc_quality_support: true
binding: "Maps external patterns → REQ-P6-* and MAP §11 only"
research_synthesis: docs/research/phase-6-denali-workspace-research.md
sources_synthesized:
  - "Plugin-first / microkernel host (widget framework 2026, Paperclip PLUGIN_SPEC)"
  - "Strangler Fig incremental legacy port (AWS, HLD Handbook, Go/Symfony playbooks)"
  - "Transactional outbox consumers in bounded context (NILUS, Conduktor, NP Blog 2025)"
  - "Registry-driven forms + build-time codegen (legacy denali-domain; zod-to-form as admin reference only)"
  - "Multi-tenant object storage prefix isolation (MAP §5 MinIO defer → 6.7)"
```

> **Project fit:** app-tour adds the **first product workspace** (`denali`) as a bounded `WorkspacePlugin` package. Core keeps governance (CASL, RLS, canonical write path, outbox table). Denali owns registry, rules, composites, theme, finance **handlers**, and migration ACL.

---

## Pattern → Phase 6 binding

| 2026 industry pattern                     | Phase 6 artifact                                                      | REQ / rule             |
| ----------------------------------------- | --------------------------------------------------------------------- | ---------------------- |
| Microkernel + manifest                    | `denali.plugin.ts` + optional `denali.plugin.manifest.json`           | REQ-P6-004, REQ-P6-005 |
| Tenant config → plugin id                 | `Tenant.workspaceType` → `resolveWorkspacePluginForType`              | REQ-P6-013, REQ-P6-014 |
| Strangler facade routing                  | API/web resolver switch; no `WorkspaceStrategyRegistry` denali branch | REQ-P6-013, P6-F-001   |
| Anti-corruption layer                     | `packages/workspaces/denali/src/acl/` only                            | REQ-P6-008             |
| Shadow parity before cutover              | Golden fixtures + snapshot tests (6.6)                                | REQ-P6-015, REQ-P6-023 |
| Feature-flag ramp (internal → %)          | Documented in 6.5/6.6; non-prod shadow validate                       | REQ-P6-024             |
| Domain events via outbox (not dual-write) | Plugin finance handlers consume Phase 5 outbox                        | REQ-P6-011, DEC-P6-005 |
| Idempotent consumer + tenant guard        | Port `emit-finance-ledger-journal-outbox` tests                       | REQ-P6-012             |
| Canonical SoT only (no RHF mirror)        | Phase 0 covenant — reject `DenaliWizardSyncContext` pattern           | P6-F-004 (closure)     |
| First-party same-origin plugin            | ES module / workspace package — not WASM (Phase 7+ third-party)       | DEC-P6-001             |
| MinIO `{tenantId}/...` prefix             | 6.7 presigned flow                                                    | REQ-P6-016             |
| Contract tests before HTTP closure        | `phase-6.contract.spec.ts` + plugin `test/*.contract.spec.ts`         | REQ-P6-018, DEC-P6-009 |

---

## Explicit non-adoption (documented)

| Pattern                                   | Why not Phase 6                      | Where                  |
| ----------------------------------------- | ------------------------------------ | ---------------------- |
| WASM sandbox for Denali                   | First-party trusted plugin           | research §3.1          |
| Copy full `legacy/.../modules/finance/**` | Violates plugin boundary             | DEC-P6-005, F6         |
| Runtime `import from 'legacy/'`           | Frozen reference only                | DEC-P6-008, REQ-P6-020 |
| `zod-to-form` as wizard SoT               | Product wizard uses registry+codegen | research §3.4          |
| Second registry in `apps/web`             | Duplicate SoT (legacy failure F4)    | 6.2 before 6.3         |
| Kafka/CDC for 6.4 finance                 | Phase 5 outbox + relay sufficient    | Phase 7+               |
| Urban workspace / silo routing            | Phase 7                              | phase-boundaries       |
| platform-core Denali branches             | Phase 1–5 invariant                  | DEC-P6-001, REQ-P6-021 |

---

## Continuity with prior phases

| Phase | Carries into Phase 6                                                                 |
| ----- | ------------------------------------------------------------------------------------ |
| **0** | Canonical-only; no legacy runtime import                                             |
| **1** | `WorkspacePlugin` + `validateCanonical` — rules in plugin                            |
| **2** | `theme/tokens.css` ingress; renderer from platform-core                              |
| **3** | `CanonicalTourService` single write path                                             |
| **4** | RLS + tenant context on persist                                                      |
| **5** | `validateCanonical` before persist (5.2); outbox/projection/audit for 6.4/6.6 parity |

**Detail:** [`PLATFORM-CONTINUITY-0-6.md`](../../appendices/PLATFORM-CONTINUITY-0-6.md) · **5→6:** [`phase-5-bridge.md`](phase-5-bridge.md) · **Research (T3):** [`../../research/phase-6-denali-workspace-research.md`](../../research/phase-6-denali-workspace-research.md)

---

## Phase 5 dependency waiver (6.0 entry)

| 5.x item                  | Phase 6 stance                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 5.2 VERIFIED              | **Required** for 6.2 validation                                                                             |
| 5.3–5.5 SPEC at entry     | Document in `phase-6-entry-verified.yaml` · 6.4 may use **outbox stub** + contract tests until 5.4 VERIFIED |
| Outbox behavioral PENDING | Blocks **full** 6.4 production parity — not 6.1–6.3 shell                                                   |

---

## Agent check (T0)

```yaml
before_6_1_package:
  - "Confirm denali README still says probe until getDenaliWorkspacePlugin lands"
before_6_4_finance:
  - "Confirm no new finance tables in apps/api"
  - "Confirm handler uses domainEventId idempotency"
before_6_5_bootstrap:
  - "Confirm 6.2 VERIFIED_BEHAVIORAL — plugin definition exists"
industry_misread_fail:
  - "Treating build green as Phase 6 closure"
  - "Copying legacy web wizard registry as second SoT"
  - "Adding if (denali) in platform-core"
```
