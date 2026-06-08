# Phase 9 — Implementation truth (honesty ledger)

```yaml
truth_version: "2026-06-08-v9"
repo_snapshot: "2026-06-08"
doc_pack: VERIFIED_SCAFFOLD
behavioral: SPEC_ONLY
subphase_9_0: VERIFIED_ENTRY
subphase_9_1: SPEC_ONLY
implementation_mode:
  doc_ready_subphase: "9.1"
  behavioral_active_subphase: "9.1"
  partial_subphases:
    - id: "9.7"
      status: PARTIAL_R1
      note: "Finance R1 on trunk — not 9.7 behavioral closure"
  spec_compile_status: SCAFFOLD_ON_TRUNK_9_8
  blockers: []
  entry_ledger: reports/phase-9-entry-verified.yaml
  entry_ledger_status: VERIFIED_ENTRY
  agent_snapshot: docs/phase-9/appendices/AGENT-CURRENT-PHASE.yaml
  agent_navigator: docs/phase-9/AGENT-NAVIGATOR.md
  scaffold_sot: docs/phase-9/appendices/SPEC-REGISTRY-OPERATOR.yaml
phase_9_charter: docs/phase-9/phase-9-charter.md
boot_manifest: docs/phase-9/appendices/BOOT-MANIFEST.yaml
sole_router: docs/phase-9/phase-9-agent-router.md
epic_driver: "Option B — Operator Admin Panel"
hardening_driver: "Option F — Identity production"
prerequisite_phase_8: VERIFIED_PASS
closure_git_sha: 0a9f2fb
phase_9_guard_report: reports/phase-9-gate-2026-06-08.json
```

> **Agents:** Read this before any Phase 9 implementation claim. Subphases **9.0–9.8** are **SPEC_ONLY** for behavioral closure except **9.7 R1 PARTIAL** (finance API + interim UI). Do not claim Operator Admin DoD from this doc pack alone.

---

## Subphase ledger (9.0 → 9.8)

| Subphase | Spec                                                                                                                                        | Goal                                               | Primary artifact                                                                                                                                  | Behavioral status                                                                                                       | Notes                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **9.0**  | [`subphases/9.0-entry.md`](../subphases/9.0-entry.md)                                                                                       | Entry gate — Phase 8 + MAP §3.5 review             | `reports/phase-9-entry-verified.yaml`                                                                                                             | **VERIFIED_ENTRY**                                                                                                      | GHA #27130859957 · `map_35_reviewed: true` · unblocks 9.1                           |
| **9.1**  | [`subphases/9.1-identity-session.md`](../subphases/9.1-identity-session.md)                                                                 | Identity + session production                      | [`IDENTITY-PORT-SCOPE.md`](../appendices/IDENTITY-PORT-SCOPE.md) · [`erip/9.1-cop-identity-port.md`](../appendices/erip/9.1-cop-identity-port.md) | **SPEC_ONLY**                                                                                                           | DELTA-NP-01/02 target                                                               |
| **9.2**  | [`subphases/9.2-admin-shell.md`](../subphases/9.2-admin-shell.md)                                                                           | Admin web shell                                    | [`ADMIN-SHELL-UX.md`](../appendices/ADMIN-SHELL-UX.md) · `apps/web/app/(app)/`                                                                    | **ABSENT** · **DOC_READY**                                                                                              | UX spec + DEC-P9-013 locked · code pending S9.2-R1                                  |
| **9.3**  | [`subphases/9.3-tours-operator.md`](../subphases/9.3-tours-operator.md)                                                                     | Tours + leader + transport + register              | [`TOURS-LIST-UX.md`](../appendices/TOURS-LIST-UX.md) · list API v2                                                                                | **PARTIAL_R0**                                                                                                          | `extractTourListProjection` on trunk · `GET /tours?view=operator` pending S9.3-L-R1 |
| **9.4**  | [`subphases/9.4-users-rbac.md`](../subphases/9.4-users-rbac.md) · [`appendices/USERS-DIRECTORY-UX.md`](../appendices/USERS-DIRECTORY-UX.md) | Users · 3-tier RBAC (DEC-P9-015)                   | identity users API + UI                                                                                                                           | **ABSENT**                                                                                                              | Legacy only · **doc LOCKED**                                                        |
| **9.5**  | [`subphases/9.5-bookings-ops.md`](../subphases/9.5-bookings-ops.md)                                                                         | Registration Command Center                        | [`BOOKINGS-OPS-UX.md`](../appendices/BOOKINGS-OPS-UX.md)                                                                                          | **PARTIAL_R0**                                                                                                          | `RegistrationOpsManifest` on trunk · API/UI pending S9.5-R1                         |
| **9.6**  | [`subphases/9.6-settings-templates.md`](../subphases/9.6-settings-templates.md)                                                             | Settings registry + hybrid storage                 | [`SETTINGS-MODULE-REGISTRY.md`](../appendices/SETTINGS-MODULE-REGISTRY.md)                                                                        | **PARTIAL_R0**                                                                                                          | Settings module inventory on trunk · routers pending S9.6-R1                        |
| **9.7**  | [`subphases/9.7-finance-denali.md`](../subphases/9.7-finance-denali.md) · [`appendices/FINANCE-OPS-UX.md`](../appendices/FINANCE-OPS-UX.md) | Finance Command Center · prepayment · installments | **R1 PARTIAL** · doc LOCKED                                                                                                                       | `apps/api/src/denali-finance/*` · `app/finance` · `finance-ops.spec.ts` green · R2 prepayment / R3 installments pending |
| **9.8**  | [`subphases/9.8-operator-dod-gate.md`](../subphases/9.8-operator-dod-gate.md)                                                               | Operator Admin DoD                                 | `phase-9.contract.spec.ts`                                                                                                                        | **ABSENT**                                                                                                              | `phase-9:gate` scaffold only                                                        |

---

## Package status

| Path                          | Status                                       | Subphase | Notes                                      |
| ----------------------------- | -------------------------------------------- | -------- | ------------------------------------------ |
| `packages/workspaces/denali`  | **VERIFIED_BEHAVIORAL**                      | —        | Phase 6 — extended in **9.3, 9.7**         |
| `packages/workspaces/urban`   | **VERIFIED_BEHAVIORAL** or **PACKAGE_SHELL** | —        | Phase 8 closure — **no Phase 9 expansion** |
| `packages/workspaces/starter` | **VERIFIED_BEHAVIORAL**                      | —        | Reference                                  |
| `packages/platform-core`      | **VERIFIED_BEHAVIORAL**                      | 9.x      | **Zero-diff invariant** — INV-P9-001       |
| `packages/workspace-sdk`      | **PARTIAL**                                  | 9.1, 9.4 | Operator CASL extensions pending           |

---

## Apps status

| Concern                             | Status                       | Subphase |
| ----------------------------------- | ---------------------------- | -------- | --------------------------------------------------------------------- |
| OTP + login production              | **ABSENT**                   | 9.1      |
| Session + membership hydrate        | **ABSENT**                   | 9.1      |
| `(app)/` admin shell                | **ABSENT**                   | 9.2      |
| Tour list / edit / workspace        | **ABSENT**                   | 9.3      |
| Users directory + invites           | **ABSENT**                   | 9.4      |
| Bookings approve/reject             | **ABSENT**                   | 9.5      |
| Settings templates/presets          | **ABSENT**                   | 9.6      |
| Finance UI (Denali)                 | **PARTIAL (R1)**             | 9.7      | `app/finance` command center · nav Denali-only · reports API wired    |
| Finance API (Denali)                | **VERIFIED_BEHAVIORAL (R1)** | 9.7      | `denali-finance/*` · manual pay · receipts · ledger outbox on approve |
| `phase-9.contract.spec.ts`          | **SCAFFOLD_ON_TRUNK**        | 9.8      |
| `scripts/guards/phase-9-guard.mjs`  | **VERIFIED_SCAFFOLD**        | 9.8      | `pnpm run phase-9:guard`                                              |
| Urban owner regression (INV-P8-007) | **N/A until 9.8**            | 9.8      | Must stay green                                                       |

---

## Phase 8 prerequisite

| Gate                       | Status (ledger date)           | Phase 9 impact                          |
| -------------------------- | ------------------------------ | --------------------------------------- |
| `phase-8:gate`             | **NOT CLOSED** — doc pack only | **Blocks 9.0 behavioral**               |
| Urban Product Parity       | **SPEC_ONLY** at ledger date   | 9.0 entry assumes 8.x closed before 9.1 |
| `phase-8.contract.spec.ts` | **ABSENT** at ledger date      | Blocks honest 9.0 attestation           |

---

## Phase 9 forbidden states (do not claim)

```yaml
forbidden_claims:
  - "Phase 9 done because charter exists"
  - "Operator admin live from documentation guard alone"
  - "Full legacy Tour Ops parity without SMK-P9 proof"
  - "Marketing app shipped in Phase 9"
  - "Urban admin widened to isAdminOrOwner"
  - "Runtime import from legacy/ in trunk apps"
  - "Three separate deployable apps exist"
```

---

## Scope expansion (DEC-P9-008 — 2026-06-08)

Admin gaps previously deferred to Phase 10+ are **in scope for Phase 9**:

| Former deferral                          | Now assigned     |
| ---------------------------------------- | ---------------- |
| leader/review URL alias                  | 9.5 (DEC-P9-011) |
| transport · waitlist · operator register | 9.3 · 9.5        |
| users CSV · remove · rewards             | 9.4              |
| bookings/new                             | 9.5              |
| settings modules · audit trail           | 9.6              |
| reconciliation triage                    | 9.7              |

**9.8 closure:** SMK-P9-01..08 + `phase-9.contract.spec.ts` full route inventory.

---

## Out of scope honesty (Phase 10+ — non-admin only)

| Item                              | Status       | Owner                 |
| --------------------------------- | ------------ | --------------------- |
| `apps/marketing` separate deploy  | **DEFERRED** | Phase 10+             |
| Public SEO / blog CMS             | **DEFERRED** | Phase 10+             |
| Marketing/Portal/Admin repo split | **DEFERRED** | MAP §3.5 deploy phase |
| CDC / data warehouse              | **DEFERRED** | Phase 10+             |
| WASM sandbox · AI/chat            | **DEFERRED** | Phase 10+             |

---

## Doc vs repo

| Metric                          | Doc pack              | Repo behavioral   |
| ------------------------------- | --------------------- | ----------------- |
| Charter + BOOT-MANIFEST + TRUTH | **VERIFIED_SCAFFOLD** | PEK doc pack only |
| Subphases VERIFIED_BEHAVIORAL   | 0 / 9                 | —                 |
| Operator admin demo             | **0%**                | —                 |

**Do not claim Operator Admin DoD from documentation guard alone.** MAP §12 R2 applies.

---

## Sprint attestation (doc pack authoring)

| Sprint | Scope                                                                                             | Status                |
| ------ | ------------------------------------------------------------------------------------------------- | --------------------- |
| **S1** | Core PEK — charter, router, truth, BOOT-MANIFEST, subphases 9.0–9.8                               | **VERIFIED_SCAFFOLD** |
| **S2** | Appendices — route matrix, identity scope, smoke map, decisions                                   | **VERIFIED_SCAFFOLD** |
| **S3** | Guard wiring — `phase-9:guard` · entry yaml                                                       | **VERIFIED_SCAFFOLD** |
| **S4** | Hardening pack — CASL spec · traceability · spec scaffolds · 22-gate guard                        | **VERIFIED_SCAFFOLD** |
| **S5** | Integration depth — TRACEABILITY-MAP · boundary matrix · 9.2–9.8 scaffolds · 28-gate guard        | **VERIFIED_SCAFFOLD** |
| **S6** | ERIP COP depth · FORENSIC-RUBRIC-P9 · smoke fixture SoT · 26-gate guard                           | **VERIFIED_SCAFFOLD** |
| **S7** | E2E wiring · ADVERSARIAL-MATRIX · dispatch 9.6/9.7 · ASM 9.4/9.5 · 28-gate guard                  | **VERIFIED_SCAFFOLD** |
| **S8** | DEC-P9-008 full `(app)/` parity · ADMIN-SHELL-UX · TOURS-LIST-UX · DEC-P9-013/014 · SMK-P9-06..08 | **VERIFIED_SCAFFOLD** |
| **S9** | DEC-P9-009/010 · SETTINGS-MODULE-REGISTRY · SETTINGS-RISK-REGISTER · ASM-9.6 · dispatch v2        | **VERIFIED_SCAFFOLD** |

**Guard attestation (2026-06-08 sync):** `pnpm run phase-9:guard` → **32/32 PASS**. T-9.1..T-9.8 scaffolds on trunk · P8 charter gates active.

```yaml
guard_attestation:
  command: pnpm run phase-9:guard
  passed: 32
  total: 32
  charter_gates: 32
  promote_train_completed: T-9.1..T-9.8
```

---

## Subphase 9.1 attestation (Blocks A–E)

```yaml
subphase_9_1:
  status: DOC_READY
  verified_at: "2026-06-08"
  verification_as_code:
    command: pnpm run phase-9:guard
    exit_code: 0
    charter_gates: 32
    passed: 32
  spec_scaffold_status: ON_TRUNK
  pek_files: 58
  spec_registry:
    - docs/phase-9/appendices/SPEC-REGISTRY-9.1.yaml
    - docs/phase-9/appendices/SPEC-REGISTRY-OPERATOR.yaml
  doc_artifacts:
    - docs/phase-9/appendices/ADVERSARIAL-MATRIX-P9.md
    - docs/phase-9/appendices/settings-api-dispatch-addendum.md
    - docs/phase-9/appendices/finance-api-dispatch-addendum.md
    - docs/phase-9/appendices/CASL-OPERATOR-SPEC.md
    - docs/phase-9/appendices/TRACEABILITY-MATRIX-9.1.md
    - docs/phase-9/appendices/TRACEABILITY-MAP.md
    - docs/phase-9/appendices/PHASE-BOUNDARY-MATRIX.yaml
    - docs/phase-9/appendices/identity-api-dispatch-addendum.md
    - docs/phase-9/appendices/erip/9.1-cop-identity-port.md
  prove_with_bundle:
    - apps/api/test/identity-otp.spec.ts
    - apps/api/test/identity-session.spec.ts
    - packages/workspace-sdk/test/operator-ability.spec.ts
    - apps/web/test/auth-login-access.spec.ts
  behavioral_note: "T-9.1 scaffolds ON_TRUNK — handlers still ABSENT until 9.1 implementation PR."
```

### Block A — Doc artifacts present

All paths in `spec_registry` and `doc_artifacts` exist on disk · consumed by `p9_doc_hardening`.

### Block B — Guard sync

`phase-9:guard` charter gate count **32** matches `BOOT-MANIFEST.yaml` · `phase-9-guards.md` · this ledger. **Current:** 32/32 after T-9.1 promote + P8 gates.

### Block C — Traceability closed loop

`TRACEABILITY-MAP.md` links REQ-P9-010..083 ↔ spec paths ↔ SMK-P9-\* ↔ action registry.

### Block D — Boundary enforcement

`PHASE-BOUNDARY-MATRIX.yaml` defines machine paths for 9.1–9.7 · `guard:p9-boundary-diff` documented.

### Block E — Honesty

Subphase ledger remains **SPEC_ONLY** for behavioral until prove_with specs exit 0 without `SCAFFOLD` failures.

---

## Scaffold promote table (trunk vs WIP)

> **SoT:** [`SPEC-REGISTRY-OPERATOR.yaml`](../appendices/SPEC-REGISTRY-OPERATOR.yaml) `on_trunk` · promote train **COMPLETE** 2026-06-08

| Subphase | Trunk bundle                                                                            | Status       |
| -------- | --------------------------------------------------------------------------------------- | ------------ |
| **9.1**  | identity-otp · identity-session · operator-ability · auth-login-\* · admin-shell-access | **ON_TRUNK** |
| **9.2**  | dashboard-smoke                                                                         | **ON_TRUNK** |
| **9.3**  | tours-operator (API/web) · tour-list-projection                                         | **ON_TRUNK** |
| **9.4**  | identity-users · users-directory                                                        | **ON_TRUNK** |
| **9.5**  | bookings-ops/create · command-center · approve · SDK+denali manifest                    | **ON_TRUNK** |
| **9.6**  | settings API (4) · settings web (2) · SDK+denali manifest                               | **ON_TRUNK** |
| **9.7**  | finance-ops · finance-page · finance-admin                                              | **ON_TRUNK** |
| **9.8**  | operator-smoke · phase-9.contract · operator-owner-session fixture                      | **ON_TRUNK** |

**Guard impact:** All normative prove_with paths exist on trunk — `p9_spec_path_registry` passes. Behavioral closure still **SPEC_ONLY** until scaffolds implement handlers (no `assert.fail`).

**WIP remainder:** `TEMP/phase9-wip-specs/web/urban-owner-access.spec.ts` only (Phase 8 reference).
