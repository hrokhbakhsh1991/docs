# Phase 8 — Implementation truth (honesty ledger)

```yaml
truth_version: "2026-06-08-v2"
repo_snapshot: "2026-06-08"
doc_pack: VERIFIED_SCAFFOLD
behavioral: PARTIAL_8_0
subphase_8_0: VERIFIED_ENTRY
subphase_8_1: READY_FOR_IMPLEMENTATION
implementation_mode:
  doc_ready_subphase: "8.1"
  behavioral_active_subphase: "8.1"
  spec_compile_status: SCAFFOLD_ON_DISK
  blockers: []
  entry_ledger: reports/phase-8-entry-verified.yaml
  entry_ledger_status: PASS
phase_8_charter: docs/phase-8/phase-8-charter.md
boot_manifest: docs/phase-8/appendices/BOOT-MANIFEST.yaml
sole_router: docs/phase-8/phase-8-agent-router.md
epic_driver: "Option A — Product Parity"
hardening_driver: "Option E — Silo tier integration (8.3)"
prerequisite_phase_7: VERIFIED
closure_git_sha: d487666
phase_8_1_guard_report: reports/phase-8-gate-2026-06-08.json
```

> **Agents:** Read this before any Phase 8 implementation claim. **8.1** is **READY_FOR_IMPLEMENTATION** (doc + guard attestation only — **not** `VERIFIED_BEHAVIORAL`). Subphases **8.0**, **8.2–8.5** remain **SPEC_ONLY** or **ABSENT** until behavioral proof lands. Do not claim Product Parity DoD from this doc pack alone.

---

## Subphase ledger (8.0 → 8.5)

| Subphase | Spec                                                                          | Goal                                             | Primary artifact                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Behavioral status            | Notes                                                                                                                        |
| -------- | ----------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **8.0**  | [`subphases/8.0-entry.md`](../subphases/8.0-entry.md)                         | Entry gate — Phase 7 + MAP §22                   | `reports/phase-8-entry-verified.yaml`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | **VERIFIED_ENTRY**           | `phase_7_gate.status: PASS` · `verified_at` set · BL-P8-01 closed                                                            |
| **8.1**  | [`subphases/8.1-single-owner-auth.md`](../subphases/8.1-single-owner-auth.md) | Single-Owner CASL — owner-only settings/admin    | [`CASL-URBAN-OWNER-SPEC.md`](../appendices/CASL-URBAN-OWNER-SPEC.md) · [`URBAN-ROUTE-MATRIX.md`](../appendices/URBAN-ROUTE-MATRIX.md) · [`TRACEABILITY-MATRIX-8.1.md`](../appendices/TRACEABILITY-MATRIX-8.1.md) · [`erip/8.1-cop-auth-isolation.md`](../appendices/erip/8.1-cop-auth-isolation.md) · [`schemas/URBAN-THEME-JSONB.schema.json`](../appendices/schemas/URBAN-THEME-JSONB.schema.json) · [`schemas/URBAN-SETTINGS-PATCH.zod.ts`](../appendices/schemas/URBAN-SETTINGS-PATCH.zod.ts) · [`URBAN-THEME-MERGE-ALGORITHM.md`](../appendices/URBAN-THEME-MERGE-ALGORITHM.md) · [`AGENT-STATE-MAP-8.1.yaml`](../appendices/AGENT-STATE-MAP-8.1.yaml) · [`TOURS-PUBLISH-FIELD-GATE.md`](../appendices/TOURS-PUBLISH-FIELD-GATE.md) · [`CANLOAD-URBAN-SETTINGS.contract.ts`](../appendices/CANLOAD-URBAN-SETTINGS.contract.ts) | **READY_FOR_IMPLEMENTATION** | Attestation: `pnpm run phase-8:guard` **24/24 PASS** · doc_ready **8.1** · behavioral active **8.0** · trunk auth **ABSENT** |
| **8.2**  | [`subphases/8.2-urban-features.md`](../subphases/8.2-urban-features.md)       | Urban product port — catalog, register, settings | `packages/workspaces/urban/` · app routes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | **ABSENT**                   | Extends Phase 7.1 PACKAGE_SHELL                                                                                              |
| **8.3**  | [`subphases/8.3-silo-tier.md`](../subphases/8.3-silo-tier.md)                 | Silo tier — `TenantConnectionRouter`             | `packages/tenant-kernel/` · `infra/sql/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | **SPEC_ONLY**                | Parallel after 8.2 · Option E                                                                                                |
| **8.4**  | [`subphases/8.4-e2e-integrity.md`](../subphases/8.4-e2e-integrity.md)         | E2E — catalog → register → owner settings        | `apps/web/tests/e2e/urban-*`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | **ABSENT**                   | SMK-P8-01..04 · parallel after 8.2                                                                                           |
| **8.5**  | [`subphases/8.5-platform-dod.md`](../subphases/8.5-platform-dod.md)           | Product Parity DoD gate                          | `phase-8.contract.spec.ts` · gate JSON                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | **ABSENT**                   | `phase-8:gate` not wired                                                                                                     |

---

## Package status

| Path                          | Status                  | Subphase | Notes                                            |
| ----------------------------- | ----------------------- | -------- | ------------------------------------------------ |
| `packages/workspaces/urban`   | **VERIFIED_BEHAVIORAL** | 7.1–7.8  | Phase 7 closed — product port extends in **8.2** |
| `packages/workspaces/denali`  | **VERIFIED_BEHAVIORAL** | —        | Phase 6 Tier D — not expanded in Phase 8         |
| `packages/workspaces/starter` | **VERIFIED_BEHAVIORAL** | —        | Reference pattern                                |
| `packages/platform-core`      | **VERIFIED_BEHAVIORAL** | 8.x      | **Zero-diff invariant** — INV-P8-001             |
| `packages/tenant-kernel`      | **SPEC_ONLY**           | 8.3      | `TenantRoute` stub / router per Phase 7.7 truth  |
| `TenantConnectionRouter`      | **VERIFIED_BEHAVIORAL** | 7.7      | Tier resolution — silo URL wiring in **8.3**     |

---

## Apps status

| Concern                                  | Status                                                 | Subphase                            |
| ---------------------------------------- | ------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Urban owner-only CASL (INV-P8-007)       | **READY_FOR_IMPLEMENTATION** (doc) · **ABSENT** (code) | 8.1                                 |
| Urban catalog (public)                   | **ABSENT**                                             | 8.2 / 8.4                           |
| Urban registration intake                | **ABSENT**                                             | 8.2 / 8.4                           |
| Urban tenant settings panels             | **ABSENT**                                             | 8.2 (UI) · 8.1 (auth)               |
| `resolveWorkspacePluginForType("urban")` | **VERIFIED_BEHAVIORAL**                                | 7.3 — prerequisite satisfied at 8.0 |
| `lazy-urban-plugin.ts` (web)             | **VERIFIED_BEHAVIORAL**                                | 7.3                                 | Sole dynamic `@app-tour/workspace-urban` import — `apps/web/src/bootstrap/lazy-urban-plugin.ts` (Phase 7.3; mirror `lazy-denali-plugin.ts`) |
| `phase-8.contract.spec.ts`               | **ABSENT**                                             | 8.5                                 |
| `scripts/guards/phase-8-guard.mjs`       | **VERIFIED_SCAFFOLD**                                  | 8.5                                 | Tier 1 guard wired — `pnpm run phase-8:guard`                                                                                               |
| `pnpm run phase-8:gate`                  | **VERIFIED_SCAFFOLD**                                  | 8.5                                 | Script in `package.json` — nested `phase-7:gate`                                                                                            |

---

## Phase 7 prerequisite

| Gate                             | Status (ledger date 2026-06-08)      | Phase 8 impact                        |
| -------------------------------- | ------------------------------------ | ------------------------------------- |
| `phase-7:gate`                   | **PASS** — GHA platform-dod + guards | 8.0 **VERIFIED_ENTRY**                |
| `phase-7.contract.spec.ts`       | **VERIFIED_BEHAVIORAL**              | Genericity baseline for 8.2           |
| Urban E2E create → publish (7.4) | **VERIFIED_BEHAVIORAL**              | Baseline for 8.1 auth rail            |
| `TenantConnectionRouter` (7.7)   | **VERIFIED_BEHAVIORAL**              | 8.3 silo URL wiring deferred          |
| MAP §22 platform checklist       | **REVIEWED**                         | `map_22_reviewed: true` in entry yaml |

---

## Phase 8 forbidden states (do not claim)

```yaml
forbidden_claims:
  - "Phase 8 done because charter exists"
  - "Product parity from documentation guard alone"
  - "Urban catalog live without E2E proof (8.4)"
  - "platform-core touched for urban widgets"
  - "urban_event → denali rail restored"
  - "Runtime import from legacy/ in trunk apps"
```

---

## Out of scope honesty (deferred Phase 9+)

| Item                           | Status              | Owner                                                              |
| ------------------------------ | ------------------- | ------------------------------------------------------------------ |
| Operator Admin Panel `(app)/`  | **DEFINED Phase 9** | [`docs/phase-9/phase-9-charter.md`](../phase-9/phase-9-charter.md) |
| CDC / data warehouse           | **DEFERRED**        | Phase 10+                                                          |
| WASM third-party sandbox       | **DEFERRED**        | Phase 10+                                                          |
| Database-per-tenant for all    | **DEFERRED**        | Phase 10+                                                          |
| AI / chat extensibility        | **DEFERRED**        | Phase 10+                                                          |
| Per-tenant JWT / Vault secrets | **DEFERRED**        | Evolution roadmap                                                  |
| Marketing app deploy split     | **DEFERRED**        | Phase 10+                                                          |
| AI / chat extensibility        | **DEFERRED**        | MAP §24                                                            |
| Per-tenant JWT / Vault secrets | **DEFERRED**        | Evolution roadmap                                                  |

---

## Doc vs repo

| Metric                          | Doc pack              | Repo behavioral       |
| ------------------------------- | --------------------- | --------------------- |
| Charter + BOOT-MANIFEST + TRUTH | **VERIFIED_SCAFFOLD** | PEK doc pack only     |
| Score target (when guard wired) | ≥ 96                  | **0%** product parity |
| Subphases VERIFIED_BEHAVIORAL   | 0 / 6                 | —                     |

**Do not claim Product Parity DoD from documentation guard alone.** MAP §12 R2 applies.

---

## Blockers

| ID       | Blocker                                   | Blocks | Mitigation                                                                                                                                                                 |
| -------- | ----------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BL-P8-01 | ~~Phase 7 gate not closed~~               | —      | **CLOSED** — `phase_7_gate.status: PASS` · `d487666`                                                                                                                       |
| BL-P8-02 | `phase-8:gate` behavioral chain not green | 8.5    | Run full `phase-8:gate` at closure only                                                                                                                                    |
| BL-P8-04 | Phase 7.7 router absent                   | 8.3    | Close 7.7 before silo integration                                                                                                                                          |
| BL-P8-05 | Legacy urban web not inventoried          | 8.1    | Mitigated for 8.1 auth — [`SMOKE-SCENARIO-MAP.md`](../appendices/SMOKE-SCENARIO-MAP.md) · [`urban-api-dispatch-addendum.md`](../appendices/urban-api-dispatch-addendum.md) |

---

## Subphase 8.1 attestation (Blocks A–E)

```yaml
subphase_8_1:
  status: READY_FOR_IMPLEMENTATION
  verified_at: "2026-06-07"
  verification_as_code:
    command: pnpm run phase-8:guard
    exit_code: 0
    report: reports/phase-8-gate-2026-06-07.json
    charter_gates: 24
  pek_files: 33
  spec_registry: docs/phase-8/appendices/SPEC-REGISTRY-8.1.yaml
  doc_artifacts:
    - docs/phase-8/appendices/CASL-URBAN-OWNER-SPEC.md
    - docs/phase-8/appendices/TRACEABILITY-MATRIX-8.1.md
    - docs/phase-8/appendices/erip/8.1-cop-auth-isolation.md
    - docs/phase-8/appendices/urban-api-dispatch-addendum.md
    - docs/phase-8/appendices/schemas/URBAN-THEME-JSONB.schema.json
    - docs/phase-8/appendices/schemas/URBAN-SETTINGS-PATCH.zod.ts
    - docs/phase-8/appendices/schemas/URBAN-SETTINGS-HTTP-ENVELOPE.yaml
    - docs/phase-8/appendices/URBAN-THEME-MERGE-ALGORITHM.md
    - docs/phase-8/appendices/AGENT-STATE-MAP-8.1.yaml
    - docs/phase-8/appendices/TOURS-PUBLISH-FIELD-GATE.md
    - docs/phase-8/appendices/CANLOAD-URBAN-SETTINGS.contract.ts
    - docs/phase-8/appendices/PHASE-BOUNDARY-MATRIX.yaml
    - docs/phase-8/appendices/IMPLEMENTATION-DECISIONS.md
  blocks_resolved:
    A: [CASL-URBAN-OWNER-SPEC.md, IMPLEMENTATION-DECISIONS.md, 8.1-single-owner-auth.md]
    B: [SMOKE-SCENARIO-MAP.md, PRECISION-DOC-INDEX.md, env-runtime-matrix.md, action-registry.md]
    C:
      [
        phase-8-guard.mjs,
        phase-8-doc-hardening.mjs,
        anti-hollow-phase8.mjs,
        phase-8-hardening-artifacts.mjs,
        phase-8-guards.md,
      ]
    D: [8.1-cop-auth-isolation.md, urban-api-dispatch-addendum.md]
    E: [TRACEABILITY-MATRIX-8.1.md]
    F:
      [
        URBAN-THEME-JSONB.schema.json,
        URBAN-SETTINGS-PATCH.zod.ts,
        URBAN-SETTINGS-HTTP-ENVELOPE.yaml,
        URBAN-THEME-MERGE-ALGORITHM.md,
        AGENT-STATE-MAP-8.1.yaml,
        TOURS-PUBLISH-FIELD-GATE.md,
        CANLOAD-URBAN-SETTINGS.contract.ts,
        PHASE-BOUNDARY-MATRIX.yaml,
      ]
  prove_with_implementation:
    - packages/workspace-sdk/test/urban-owner-ability.spec.ts
    - apps/api/test/urban-owner-ability.spec.ts
    - apps/api/test/urban-settings-patch.spec.ts
    - apps/api/test/urban-redis-fallback.spec.ts
    - apps/api/test/urban-tours-bypass-gate.spec.ts
    - apps/web/test/urban-owner-access.spec.ts
  blocks_resolved_sprint_fgh:
    F: [IMPLEMENTATION-TRUTH attestation sync, phase-8-guards.md example JSON]
    G: [SPEC-REGISTRY-8.1.yaml, BOOT-MANIFEST prove_with, verification-matrix 8.1 bundle]
    H: [DEC-P8-004, SDK spec method form, router urban-settings-access]
  blocks_resolved_sprint_jkl:
    J:
      [
        urban-settings-patch ASM-001 metadata,
        env-runtime inject vars,
        8.1 tour gate scope,
        8.2 lazy-urban extend,
      ]
    K: [BOOT READY_FOR_IMPLEMENTATION enum, implementation_mode block, ERIP doc_ready]
    L: [reports/phase-8-entry-verified.yaml scaffold, BL-P8-01 honesty]
  blocks_resolved_sprint_m:
    M:
      [
        p8_owner_auth_specs,
        p8_urban_routes_bound,
        p8_smoke_map_present,
        p8_verification_matrix_hydrated,
        p8_boundary_ci_hook,
        guard:p8-boundary-diff,
      ]
```

### Human approval (Phase 8.1 implementation gate)

| Token                        | Status | Evidence                                                                                                                                                                             |
| ---------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `APPROVED 8.1 ERIP proposal` | [x]    | [`erip/8.1-cop-auth-isolation.md`](../appendices/erip/8.1-cop-auth-isolation.md) · COP front-matter · `p8_erip_cop_present` ready at subphase 8.1                                    |
| `APPROVED 8.1 scope`         | [x]    | [`CASL-URBAN-OWNER-SPEC.md`](../appendices/CASL-URBAN-OWNER-SPEC.md) LOCKED · [`TRACEABILITY-MATRIX-8.1.md`](../appendices/TRACEABILITY-MATRIX-8.1.md) REQ-P8-010..012 closed in doc |
| `VERIFICATION_AS_CODE_PASS`  | [x]    | `reports/phase-8-gate-2026-06-07.json` · `"ok": true` · `charter_gates: 24` · `pek_files: 33` · checks `p8_boot_manifest` … `p8_technical_quality` all PASS                          |

**Ledger law:** `READY_FOR_IMPLEMENTATION` authorizes **8.1 trunk auth code** only. Does **not** authorize 8.2 product routes or `VERIFIED_BEHAVIORAL` until `prove_with_implementation` specs exit 0.

Update this ledger when blockers clear or subphase status changes.
