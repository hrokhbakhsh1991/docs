# Phase 9 — Implementation truth (honesty ledger)

```yaml
truth_version: "2026-06-09-v35"
repo_snapshot: "2026-06-09"
doc_pack: VERIFIED_SCAFFOLD
behavioral: PARTIAL_MULTI_SUBPHASE
subphase_9_0: VERIFIED_ENTRY
subphase_9_1: PARTIAL_R1
subphase_9_2: PARTIAL_R3
implementation_mode:
  doc_ready_subphase: "9.5"
  behavioral_active_subphase: "9.5"
  partial_subphases:
    - id: "9.2"
      status: PARTIAL_R3
      note: "OperatorShell R1–R3 + live dashboard widgets (overview/tours/bookings/registrations)"
    - id: "9.7"
      status: PARTIAL_R4
      note: "R1+R2+R3 Postgres specs green · R4 ledger CSV + reconciliation ledger-gap KPI · adjust API deferred"
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

> **Agents:** Read this before any Phase 9 implementation claim. Subphases **9.0–9.8** have **partial behavioral slices on trunk** (identity, shell, tours, users, bookings, settings, finance) — **9.8 DoD not closed** until `phase-9:gate` + SMK-P9 full bundle. Do not claim Operator Admin DoD from this doc pack alone.

---

## Subphase ledger (9.0 → 9.8)

| Subphase | Spec                                                                                                                                        | Goal                                               | Primary artifact                                                                                                                                  | Behavioral status                                                                                                       | Notes                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **9.0**  | [`subphases/9.0-entry.md`](../subphases/9.0-entry.md)                                                                                       | Entry gate — Phase 8 + MAP §3.5 review             | `reports/phase-9-entry-verified.yaml`                                                                                                             | **VERIFIED_ENTRY**                                                                                                      | GHA #27130859957 · `map_35_reviewed: true` · unblocks 9.1                           |
| **9.1**  | [`subphases/9.1-identity-session.md`](../subphases/9.1-identity-session.md)                                                                 | Identity + session production                      | [`IDENTITY-PORT-SCOPE.md`](../appendices/IDENTITY-PORT-SCOPE.md) · [`erip/9.1-cop-identity-port.md`](../appendices/erip/9.1-cop-identity-port.md) | **PARTIAL_R1**                                                                                                          | identity 4/4 · web auth 9/9 · BFF session · Prisma 005 deferred |
| **9.2**  | [`subphases/9.2-admin-shell.md`](../subphases/9.2-admin-shell.md)                                                                           | Admin web shell                                    | [`ADMIN-SHELL-UX.md`](../appendices/ADMIN-SHELL-UX.md) · `apps/web/app/(app)/`                                                                    | **IN_PROGRESS** · **PARTIAL_R3**                                                                                        | OperatorShell R1–R3 · live dashboard widgets · `(app)/finance` migrate · 9.2 closure pending |
| **9.3**  | [`subphases/9.3-tours-operator.md`](../subphases/9.3-tours-operator.md)                                                                     | Tours + leader + transport + register              | [`TOURS-LIST-UX.md`](../appendices/TOURS-LIST-UX.md) · [`TOURS-EDIT-UX.md`](../appendices/TOURS-EDIT-UX.md) · [`TOURS-WORKSPACE-UX.md`](../appendices/TOURS-WORKSPACE-UX.md) · [`TOURS-REGISTER-UX.md`](../appendices/TOURS-REGISTER-UX.md) | **IN_PROGRESS** · **PARTIAL_R5**                                                                                      | list + edit + workspace + register R4 on trunk · transport data + 9.3 closure pending |
| **9.4**  | [`subphases/9.4-users-rbac.md`](../subphases/9.4-users-rbac.md) · [`appendices/USERS-DIRECTORY-UX.md`](../appendices/USERS-DIRECTORY-UX.md) | Users · 4-tier team RBAC (DEC-P9-015/019) · owner panel (DEC-P9-018) | identity users API + UI                                                                                                                           | **PARTIAL_R8**                                                                                                          | R0–R8 + membership audit event_kind · enterprise isolation · SMK-P9-USERS E2E green · roadmap promoted · Architect sign-off pending |
| **9.5**  | [`subphases/9.5-bookings-ops.md`](../subphases/9.5-bookings-ops.md)                                                                         | Registration Command Center                        | [`BOOKINGS-OPS-UX.md`](../appendices/BOOKINGS-OPS-UX.md)                                                                                          | **IN_PROGRESS** · **PARTIAL_R5**                                                                                        | R1–R5 on trunk (manual create UI · leader alias) · tour board R4 optional pre-9.8 |
| **9.6**  | [`subphases/9.6-settings-templates.md`](../subphases/9.6-settings-templates.md)                                                             | Settings registry + hybrid storage                 | [`SETTINGS-MODULE-REGISTRY.md`](../appendices/SETTINGS-MODULE-REGISTRY.md)                                                                        | **IN_PROGRESS** · **PARTIAL_R8**                                                                                        | R1–R7 + W-track (W1–W7) + SMK-P9-05 · operator smoke **13/13** · Prisma 007 pending |
| **9.7**  | [`subphases/9.7-finance-denali.md`](../subphases/9.7-finance-denali.md) · [`appendices/FINANCE-OPS-UX.md`](../appendices/FINANCE-OPS-UX.md) | Finance Command Center · prepayment · installments | **PARTIAL_R4** · doc LOCKED                                                                                                                       | R1 ops + receipts · R2 prepayments · R3 schedules (Postgres specs) · R4 ledger CSV + triage ledger-gap KPI · adjust API deferred |
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
| OTP + login production              | **PARTIAL_R1**               | 9.1      | API in-memory + BFF login/ability-context chain |
| Session + membership hydrate        | **PARTIAL_R1**               | 9.1      | middleware · `GET /api/auth/session` · post-login hydrate |
| `(app)/` admin shell                | **PARTIAL_R3**               | 9.2      | OperatorShell · account menu · branding · live dashboard widgets · `(app)/finance` |
| Tour list / edit / workspace        | **PARTIAL_R5** (register R4)   | 9.3      | list + edit + workspace shell + `(app)/tours/[id]/register` · transport tables pending |
| Users directory + invites           | **PARTIAL_R8**               | 9.4      | R0–R8 directory · bulk · audit drawer · SMK-P9-03 + SMK-P9-USERS-01..04 E2E green · Prisma 005 deferred |
| Bookings approve (smoke)            | **PARTIAL_R6**               | 9.5      | Command Center · SMK-P9-04/06/07 E2E green (memory seed) |
| Operator smoke E2E (SMK-P9-01..08)  | **VERIFIED_E2E_LOCAL**       | 9.8      | `operator-smoke.spec.ts` **13/13** · `pnpm --filter @apps/web run test:e2e:operator` (~3.3m) |
| Bookings approve/reject             | **PARTIAL_R5**               | 9.5      | Command Center R1–R3 · bulk approve · `(app)/bookings/new` manual create |
| Settings templates/presets          | **PARTIAL_R8**               | 9.6      | reference_data pilot · **W-track** W1–W9 (render overlay order/required/default) · tour_presets · presets_advanced |
| Finance UI (Denali)                 | **PARTIAL_R4**               | 9.7      | command center tabs · ledger CSV export · reconciliation triage + ledger-gap KPI |
| Finance API (Denali)                | **PARTIAL_R3**               | 9.7      | R1 manual pay/receipts/ledger outbox · R2 prepayments · R3 schedules (Postgres) |
| Dashboard live widgets              | **PARTIAL_R3**               | 9.2      | overview · tours · bookings · registrations · `dashboard-widgets-logic.spec.ts` 5/5 |
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

| Metric                          | Doc pack              | Repo behavioral                                      |
| ------------------------------- | --------------------- | ---------------------------------------------------- |
| Charter + BOOT-MANIFEST + TRUTH | **VERIFIED_SCAFFOLD** | PEK doc pack only                                    |
| Subphases VERIFIED_BEHAVIORAL   | 0 / 9                 | Partial slices 9.1–9.7 on trunk                      |
| Operator smoke E2E              | SMK-P9-01..08 mapped  | **13/13 local** (2026-06-09)                         |
| Operator admin demo             | **~70% navigable**    | Full DoD blocked on 9.8 gate + remaining 9.3 tables |

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

**Hook suspension (2026-06-08):** [`PHASE-9-HOOKS-SUSPENSION.yaml`](../appendices/PHASE-9-HOOKS-SUSPENSION.yaml) `active: true` — Husky pre-commit **no-op** until **9.8**. Gates/tests manual-only during velocity sprint.

```yaml
guard_attestation:
  command: pnpm run phase-9:guard
  passed: 32
  total: 32
  charter_gates: 32
  promote_train_completed: T-9.1..T-9.8
hooks_suspension:
  marker: docs/phase-9/appendices/PHASE-9-HOOKS-SUSPENSION.yaml
  active: true
  until_subphase: "9.8"
  detector: scripts/phase-hooks-suspended.sh
  re_enable_verify:
    - pnpm run pre-commit:fast
    - pnpm run phase-9:guard
    - pnpm run test:full
    - pnpm run phase-9:gate
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
| **9.4**  | identity-users · users-directory · users-bulk · users-role-history · users-resend-invite | **ON_TRUNK** |
| **9.5**  | bookings-ops/create · command-center · approve · SDK+denali manifest                    | **ON_TRUNK** |
| **9.6**  | settings API (7) · settings web (6) · SDK+denali manifest · tour_presets R6          | **ON_TRUNK** |
| **9.7**  | finance-ops · finance-page · finance-admin                                              | **ON_TRUNK** |
| **9.8**  | operator-smoke · phase-9.contract · operator-owner-session fixture                      | **ON_TRUNK** |

**Guard impact:** All normative prove_with paths exist on trunk — `p9_spec_path_registry` passes. Behavioral closure still **SPEC_ONLY** until scaffolds implement handlers (no `assert.fail`).

**WIP remainder:** `TEMP/phase9-wip-specs/web/urban-owner-access.spec.ts` only (Phase 8 reference).
