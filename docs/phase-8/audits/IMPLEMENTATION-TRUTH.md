# Phase 8 — Implementation truth (honesty ledger)

```yaml
truth_version: "2026-06-08-v10"
repo_snapshot: "2026-06-08"
doc_pack: VERIFIED_BEHAVIORAL
behavioral: VERIFIED_BEHAVIORAL
phase_8_closed: true
subphase_8_0: VERIFIED_ENTRY
subphase_8_1: VERIFIED_BEHAVIORAL
subphase_8_2: VERIFIED_BEHAVIORAL
subphase_8_3: VERIFIED_BEHAVIORAL
subphase_8_4: VERIFIED_BEHAVIORAL
subphase_8_5: VERIFIED_BEHAVIORAL
implementation_mode:
  doc_ready_subphase: "8.5"
  behavioral_active_subphase: "8.5"
  next_subphase_after_8_4: null
  spec_compile_status: ON_TRUNK
  blockers: []
  entry_ledger: reports/phase-8-entry-verified.yaml
  entry_ledger_status: PASS
phase_8_charter: docs/phase-8/phase-8-charter.md
boot_manifest: docs/phase-8/appendices/BOOT-MANIFEST.yaml
sole_router: docs/phase-8/phase-8-agent-router.md
epic_driver: "Option A — Product Parity"
hardening_driver: "Option E — Silo tier integration (8.3)"
prerequisite_phase_7: VERIFIED
closure_git_sha: 80715b4
phase_8_gate:
  command: pnpm run phase-8:gate
  status: PASS
  exit_code: 0
  gha_workflow: .github/workflows/phase-8-gate.yml
  gha_run_id: 27130859957
  gha_job: phase-8-gate-full
phase_8_1_guard_report: reports/phase-8-gate-2026-06-08.json
```

> **Agents:** Phase 8 **Product Parity DoD CLOSED** (2026-06-08). **8.0–8.5** are **VERIFIED_BEHAVIORAL**. `phase-8:gate` green on GHA `main` (run `27130859957` · job `phase-8-gate-full` · sha `80715b4`). Husky suspension lifted. Phase 9 entry unblocked (TG-P9-001).

---

## Subphase ledger (8.0 → 8.5)

| Subphase | Spec                                                                          | Goal                                             | Primary artifact                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Behavioral status       | Notes                                                                                                                                                               |
| -------- | ----------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **8.0**  | [`subphases/8.0-entry.md`](../subphases/8.0-entry.md)                         | Entry gate — Phase 7 + MAP §22                   | `reports/phase-8-entry-verified.yaml`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | **VERIFIED_ENTRY**      | `phase_7_gate.status: PASS` · `verified_at` set · BL-P8-01 closed                                                                                                   |
| **8.1**  | [`subphases/8.1-single-owner-auth.md`](../subphases/8.1-single-owner-auth.md) | Single-Owner CASL — owner-only settings/admin    | [`CASL-URBAN-OWNER-SPEC.md`](../appendices/CASL-URBAN-OWNER-SPEC.md) · [`URBAN-ROUTE-MATRIX.md`](../appendices/URBAN-ROUTE-MATRIX.md) · [`TRACEABILITY-MATRIX-8.1.md`](../appendices/TRACEABILITY-MATRIX-8.1.md) · [`erip/8.1-cop-auth-isolation.md`](../appendices/erip/8.1-cop-auth-isolation.md) · [`schemas/URBAN-THEME-JSONB.schema.json`](../appendices/schemas/URBAN-THEME-JSONB.schema.json) · [`schemas/URBAN-SETTINGS-PATCH.zod.ts`](../appendices/schemas/URBAN-SETTINGS-PATCH.zod.ts) · [`URBAN-THEME-MERGE-ALGORITHM.md`](../appendices/URBAN-THEME-MERGE-ALGORITHM.md) · [`AGENT-STATE-MAP-8.1.yaml`](../appendices/AGENT-STATE-MAP-8.1.yaml) · [`TOURS-PUBLISH-FIELD-GATE.md`](../appendices/TOURS-PUBLISH-FIELD-GATE.md) · [`CANLOAD-URBAN-SETTINGS.contract.ts`](../appendices/CANLOAD-URBAN-SETTINGS.contract.ts) | **VERIFIED_BEHAVIORAL** | `apps/api/src/urban/**` · GET/PATCH `/urban/settings` · TPG publish-field gate · 6 specs ON_TRUNK green                                                             |
| **8.2**  | [`subphases/8.2-urban-features.md`](../subphases/8.2-urban-features.md)       | Urban product port — catalog, register, settings | `packages/workspaces/urban/` · `apps/api/src/urban/urban.routes.ts` · `apps/web/app/(public)/catalog/**` · `apps/web/app/(app)/settings/urban/page.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | **VERIFIED_BEHAVIORAL** | API+web catalog/register/settings shell · `urban-catalog-registration.spec.ts` + `urban-catalog-access.spec.ts` green · Prisma `20260608100000_urban_product_delta` |
| **8.3**  | [`subphases/8.3-silo-tier.md`](../subphases/8.3-silo-tier.md)                 | Silo tier — `TenantConnectionRouter`             | `packages/tenant-kernel/` · `apps/api/src/tenant/resolve-tenant-database-url.ts` · `apps/api/test/urban-silo-fixture.spec.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | **VERIFIED_BEHAVIORAL** | Router inject + silo enterprise fixture · `urban-silo-fixture.spec.ts` 6/6 green · ERIP 8.3 COP                                                                     |
| **8.4**  | [`subphases/8.4-e2e-integrity.md`](../subphases/8.4-e2e-integrity.md)         | E2E — catalog → register → owner settings        | `apps/web/tests/e2e/urban-e2e-integrity.spec.ts` · `apps/api/test/urban-e2e-http.spec.ts` · `playwright.urban.config.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | **VERIFIED_BEHAVIORAL** | SMK-P8-01..04 green · `test:e2e:urban` + HTTP chain · owner/member host profiles                                                                                    |
| **8.5**  | [`subphases/8.5-platform-dod.md`](../subphases/8.5-platform-dod.md)           | Product Parity DoD gate                          | `phase-8.contract.spec.ts` · gate JSON · forensic mdoc                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | **VERIFIED_BEHAVIORAL** | GHA `phase-8-gate-full` green on `main` · forensic PASS · hooks re-enabled                                                                                          |

---

## Package status

| Path                          | Status                  | Subphase | Notes                                                                    |
| ----------------------------- | ----------------------- | -------- | ------------------------------------------------------------------------ |
| `packages/workspaces/urban`   | **VERIFIED_BEHAVIORAL** | 8.2      | Catalog/register registry delta + golden fixtures                        |
| `packages/workspaces/denali`  | **VERIFIED_BEHAVIORAL** | —        | Phase 6 Tier D — not expanded in Phase 8                                 |
| `packages/workspaces/starter` | **VERIFIED_BEHAVIORAL** | —        | Reference pattern                                                        |
| `packages/platform-core`      | **VERIFIED_BEHAVIORAL** | 8.x      | **Zero-diff invariant** — INV-P8-001                                     |
| `packages/tenant-kernel`      | **VERIFIED_BEHAVIORAL** | 8.3      | `TenantConnectionRouter` — API `resolveTenantDatabaseUrl` + silo fixture |
| `TenantConnectionRouter`      | **VERIFIED_BEHAVIORAL** | 8.3      | Tier resolution wired in `bind-request-context` + urban silo spec        |

---

## Apps status

| Concern                                             | Status                  | Subphase                            |
| --------------------------------------------------- | ----------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Urban owner-only CASL (INV-P8-007)                  | **VERIFIED_BEHAVIORAL** | 8.1                                 |
| Urban catalog (public)                              | **VERIFIED_BEHAVIORAL** | 8.2                                 |
| Urban registration intake                           | **VERIFIED_BEHAVIORAL** | 8.2                                 |
| Urban tenant settings panels                        | **VERIFIED_BEHAVIORAL** | 8.2 (UI) · 8.1 (auth)               |
| `resolveWorkspacePluginForType("urban")`            | **VERIFIED_BEHAVIORAL** | 7.3 — prerequisite satisfied at 8.0 |
| `lazy-urban-plugin.ts` (web)                        | **VERIFIED_BEHAVIORAL** | 7.3                                 | Sole dynamic `@app-tour/workspace-urban` import — `apps/web/src/bootstrap/lazy-urban-plugin.ts` (Phase 7.3; mirror `lazy-denali-plugin.ts`) |
| `phase-8.contract.spec.ts`                          | **VERIFIED_BEHAVIORAL** | 8.5                                 | 4/4 contract cases green locally                                                                                                            |
| `docs/audits/phase-8-zero-debt-forensic-audit.mdoc` | **VERIFIED_BEHAVIORAL** | 8.5                                 | verdict PASS · score ≥ 8                                                                                                                    |
| `scripts/guards/phase-8-guard.mjs`                  | **VERIFIED_BEHAVIORAL** | 8.5                                 | 25/25 charter gates — GHA + local attested                                                                                                  |
| `pnpm run phase-8:gate`                             | **VERIFIED_BEHAVIORAL** | 8.5                                 | GHA run `27130859957` · `phase-8-gate-full` exit 0 on `main` (`80715b4`)                                                                    |
| `.github/workflows/phase-8-gate.yml`                | **VERIFIED_BEHAVIORAL** | 8.5                                 | All jobs green: guard · urban-regression · urban-e2e · ci-integrity · phase-8-gate-full                                                     |

---

## Phase 7 prerequisite

| Gate                             | Status (ledger date 2026-06-08)      | Phase 8 impact                        |
| -------------------------------- | ------------------------------------ | ------------------------------------- |
| `phase-7:gate`                   | **PASS** — GHA platform-dod + guards | 8.0 **VERIFIED_ENTRY**                |
| `phase-7.contract.spec.ts`       | **VERIFIED_BEHAVIORAL**              | Genericity baseline for 8.2           |
| Urban E2E create → publish (7.4) | **VERIFIED_BEHAVIORAL**              | Baseline for 8.1 auth rail            |
| `TenantConnectionRouter` (7.7)   | **VERIFIED_BEHAVIORAL**              | 8.3 silo URL wiring via router module |
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

| Metric                          | Doc pack                | Repo behavioral       |
| ------------------------------- | ----------------------- | --------------------- |
| Charter + BOOT-MANIFEST + TRUTH | **VERIFIED_BEHAVIORAL** | PEK + GHA gate-full   |
| Score target (when guard wired) | ≥ 96                    | Product Parity closed |
| Subphases VERIFIED_BEHAVIORAL   | 6 / 6                   | 8.0–8.5 on trunk      |

**Phase 8 Product Parity DoD closed** — `phase-8:gate` + forensic + contract on trunk (MAP §12 R2 satisfied).

---

## Blockers

| ID       | Blocker                                              | Blocks | Mitigation                                                                                                                                                                 |
| -------- | ---------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BL-P8-01 | ~~Phase 7 gate not closed~~                          | —      | **CLOSED** — `phase_7_gate.status: PASS` · `d487666`                                                                                                                       |
| BL-P8-02 | ~~`phase-8:gate` behavioral chain not green on GHA~~ | —      | **CLOSED** — GHA run `27130859957` · `phase-8-gate-full` success on `main` (`80715b4`)                                                                                     |
| BL-P8-04 | ~~Phase 7.7 router absent~~                          | —      | **CLOSED** — `TenantConnectionRouter` **VERIFIED_BEHAVIORAL** (7.7) · silo URL deferred to **8.3**                                                                         |
| BL-P8-05 | Legacy urban web not inventoried                     | 8.1    | Mitigated for 8.1 auth — [`SMOKE-SCENARIO-MAP.md`](../appendices/SMOKE-SCENARIO-MAP.md) · [`urban-api-dispatch-addendum.md`](../appendices/urban-api-dispatch-addendum.md) |

---

## Subphase 8.1 attestation (Blocks A–E)

```yaml
subphase_8_1:
  status: VERIFIED_BEHAVIORAL
  verified_at: "2026-06-08"
  verification_as_code:
    command: pnpm run phase-8:guard
    exit_code: 0
    report: reports/phase-8-gate-2026-06-08.json
    charter_gates: 25
    attestation: "25/25 PASS"
  pek_files: 39
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
    - packages/workspaces/urban/test/urban-owner-ability.spec.ts
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

| Token                        | Status | Evidence                                                                                                                                                                                   |
| ---------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `APPROVED 8.1 ERIP proposal` | [x]    | [`erip/8.1-cop-auth-isolation.md`](../appendices/erip/8.1-cop-auth-isolation.md) · COP front-matter · `p8_erip_cop_present` ready at subphase 8.1                                          |
| `APPROVED 8.1 scope`         | [x]    | [`CASL-URBAN-OWNER-SPEC.md`](../appendices/CASL-URBAN-OWNER-SPEC.md) LOCKED · [`TRACEABILITY-MATRIX-8.1.md`](../appendices/TRACEABILITY-MATRIX-8.1.md) REQ-P8-010..012 closed in doc       |
| `VERIFICATION_AS_CODE_PASS`  | [x]    | `reports/phase-8-gate-2026-06-08.json` · `"ok": true` · `charter_gates: 25` · `pek_files: 39` · checks `p8_boot_manifest` … `p8_agent_navigator_present` … `p8_technical_quality` all PASS |

**Ledger law:** **8.1** `VERIFIED_BEHAVIORAL` unlocks **8.2** doc_ready (catalog/register UI). Does **not** authorize **8.5** Product Parity DoD until **8.2–8.4** behavioral proof lands.

---

## Scaffold promote table (trunk vs WIP)

> **SoT:** `TEMP/phase8-wip-specs/README.md` (historical local scratch `README.md`; not fresh-clone authority — see docs/audits/snapshots/2026-07-31/psr-2b-temp-authority-inventory.yaml) · [`SPEC-REGISTRY-8.1.yaml`](../appendices/SPEC-REGISTRY-8.1.yaml)

| Trunk path                                                | Status       | WIP source                                                        | Promote train |
| --------------------------------------------------------- | ------------ | ----------------------------------------------------------------- | ------------- |
| `packages/workspaces/urban/test/urban-owner-ability.spec.ts` | **ON_TRUNK** | `TEMP/phase8-wip-specs/workspace-sdk/urban-owner-ability.spec.ts` | T-8.1 ✓       |
| `apps/api/test/urban-owner-ability.spec.ts`               | **ON_TRUNK** | `TEMP/phase8-wip-specs/urban-owner-ability.spec.ts`               | T-8.1 ✓       |
| `apps/api/test/urban-settings-patch.spec.ts`              | **ON_TRUNK** | `TEMP/phase8-wip-specs/urban-settings-patch.spec.ts`              | T-8.1 ✓       |
| `apps/api/test/urban-redis-fallback.spec.ts`              | **ON_TRUNK** | `TEMP/phase8-wip-specs/urban-redis-fallback.spec.ts`              | T-8.1 ✓       |
| `apps/api/test/urban-tours-bypass-gate.spec.ts`           | **ON_TRUNK** | `TEMP/phase8-wip-specs/urban-tours-bypass-gate.spec.ts`           | T-8.1 ✓       |
| `apps/web/test/urban-owner-access.spec.ts`                | **ON_TRUNK** | `TEMP/phase9-wip-specs/web/urban-owner-access.spec.ts`            | T-8.1 ✓       |

**Guard impact:** T-8.1 promote complete — `p8_spec_path_registry` + `p8_hardening_artifacts` green with `apps/api/src/urban/**` implementation.

Update this ledger when blockers clear or subphase status changes.
