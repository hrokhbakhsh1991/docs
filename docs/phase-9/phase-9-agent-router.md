# AI-EXECUTION ROUTER — Phase 9 (SOLE ENTRY)

```yaml
document_meta:
  phase_id: "9"
  phase_name: "Operator Admin Parity"
  sole_execution_entry: true
  fail_token: FAIL
  prerequisite_gate: pnpm run phase-8:gate
  closure_gate: pnpm run phase-9:gate
  human_narrative: phase-9-charter.md
  boot_manifest: appendices/BOOT-MANIFEST.yaml
  implementation_truth: audits/IMPLEMENTATION-TRUTH.md
  platform_continuity: ../../appendices/PLATFORM-CONTINUITY-0-7.md
  phase8_truth: ../../phase-8/audits/IMPLEMENTATION-TRUTH.md
  legacy_admin_reference: appendices/LEGACY-ADMIN-REFERENCE.md
  gap_analysis: ../../apps/api/docs/legacy-vs-denali-gap-analysis.md
  map_covenant: ../../MIGRATION-MAP.md#۱۲-the-zero-debt-covenant-mandatory-enforcement
  map_admin_panel: ../../MIGRATION-MAP.md#۳۵-application-structure
  epic_driver: "Option B — Operator Admin Panel"
  hardening_driver: "Option F — Identity production"
  erip_protocol: "§5 ENTERPRISE RESEARCH & INNOVATION PROTOCOL"
  erip_mandatory_subphases: ["9.1", "9.2", "9.3", "9.4", "9.5"]
  erip_recommended_subphases: ["9.6", "9.7", "9.8"]
```

---

## 0. Fast path — «قدم بعدی؟»

After [`IMPLEMENTATION-TRUTH`](audits/IMPLEMENTATION-TRUTH.md), open **[`AGENT-NAVIGATOR.md`](AGENT-NAVIGATOR.md)** for the decision tree · per-subphase file bundles · scaffold promote guidance.

---

## 1. Executive Routing Law

**Any AI agent, Cursor session, or automated implementer operating under Phase 9 MUST read this file FIRST.**

| Law                      | Requirement                                                                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SOLE ENTRY**           | Phase 9 execution authorized only from **this router** + [`appendices/BOOT-MANIFEST.yaml`](appendices/BOOT-MANIFEST.yaml) + `subphases/{current}.md`. |
| **CHARTER IS NARRATIVE** | [`phase-9-charter.md`](phase-9-charter.md) explains intent; it does **not** authorize implementation without router + subphase `completion_proof`.    |
| **TRUTH BEFORE CLAIMS**  | [`audits/IMPLEMENTATION-TRUTH.md`](audits/IMPLEMENTATION-TRUTH.md) is the honesty ledger.                                                             |
| **DOC-FIRST COVENANT**   | Protected packages require matching `docs/` update **before** code. Identity contracts → doc-first in `workspace-sdk` / `apps/api/src/identity/**`.   |
| **FAIL TOKEN**           | On invariant violation, emit `FAIL`, cite rule ID (INV-P9-_ / TG-P9-_), halt.                                                                         |
| **NO MARKETING SCOPE**   | Public Marketing app, SEO pages, anonymous Urban funnel expansion — **forbidden** in Phase 9.                                                         |
| **PHASE 8 REGRESSION**   | Urban INV-P8-007 owner-only rules must not regress — run urban-owner regression bundle before 9.8 merge.                                              |
| **ERIP BEFORE CODE**     | §5 — **9.1–9.5** require human-approved COP before code.                                                                                              |

```text
┌─────────────────────────────────────────────────────────────┐
│  MANDATORY READ ORDER (every session)                        │
│  1. phase-9-agent-router.md          ← THIS FILE (FIRST)    │
│  2. audits/IMPLEMENTATION-TRUTH.md                            │
│  3. AGENT-NAVIGATOR.md               ← «what next?» (optional)  │
│  4. appendices/BOOT-MANIFEST.yaml → detect_current_subphase v2  │
│  5. appendices/AGENT-CURRENT-PHASE.yaml  ← machine snapshot     │
│  6. subphases/{doc_ready}.md                                    │
│  7. §5 ERIP — research BEFORE code (9.1+ mandatory)           │
│  8. phase-9-charter.md               (TQ-P9-* benchmarks)     │
└─────────────────────────────────────────────────────────────┘
```

**detect_current_subphase v2** (BOOT-MANIFEST): read truth ledger → highest `VERIFIED_BEHAVIORAL` or `PARTIAL_R1` anchor → next DAG node = `doc_ready` unless `transition_guards` block → sync `AGENT-CURRENT-PHASE.yaml`.

---

## 2. Context Boundaries

### 2.1 Read-only paths

| Path                                    | Role                                   | Phase 9 rule                                           |
| --------------------------------------- | -------------------------------------- | ------------------------------------------------------ |
| `legacy/apps/web/app/(app)/`            | Operator UI port source                | **Read-only.** No runtime import.                      |
| `legacy/apps/api/src/modules/identity/` | Auth port source                       | **Read-only.**                                         |
| `legacy/apps/api/src/modules/finance/`  | Finance reference                      | **Read-only.** Implement via denali plugin + adapters. |
| `packages/platform-core/`               | Wizard engine                          | **Read-only.** Zero admin diff (INV-P9-001).           |
| `docs/phase-8/`                         | Urban Product Parity — closed upstream | **Read-only** except regression notes.                 |
| `docs/MIGRATION-MAP.md`                 | §3.5 Admin-Panel · §12 covenant        | **Read-only** authority.                               |

### 2.2 Allowable write paths (by subphase)

| Path                                                     | Subphase          | What may change                                                              |
| -------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------- |
| `apps/api/src/identity/**`                               | **9.1, 9.4**      | OTP, session, users, invites                                                 |
| `apps/api/prisma/schema.prisma` + `infra/sql/*identity*` | **9.1, 9.4, 9.5** | Identity + bookings DDL — doc-first migration note                           |
| `apps/web/app/auth/**`                                   | **9.1, 9.2**      | Login, OTP UI                                                                |
| `apps/web/app/(app)/**`                                  | **9.2–9.7**       | Operator shell + feature pages (target paths)                                |
| `apps/web/app/finance/**`                                | **9.7**           | Finance Command Center **R1 interim** until 9.2 shell lands (**DEC-P9-017**) |
| `apps/web/src/admin/**`                                  | **9.2+**          | Shared admin components, nav                                                 |
| `apps/api/src/denali-finance/**`                         | **9.7**           | Denali finance HTTP adapters (INV-P9-006)                                    |
| `apps/api/src/tours/**`                                  | **9.3**           | List, lifecycle, workspace API                                               |
| `apps/api/src/bookings/**`                               | **9.5**           | Resource + summary + bulk approve routers (DEC-P9-011)                       |
| `packages/workspaces/denali/src/bookings/**`             | **9.5**           | RegistrationOpsManifest                                                      |
| `apps/web/src/features/bookings/**`                      | **9.5**           | Command Center shell                                                         |
| `apps/api/src/settings/**`                               | **9.6**           | Resource + config routers (DEC-P9-009)                                       |
| `packages/workspaces/denali/src/settings/**`             | **9.6**           | Manifest · schemas · validation hooks                                        |
| `apps/web/src/features/settings/**`                      | **9.6**           | Registry shell · generic CRUD                                                |
| `packages/workspaces/denali/src/finance/**`              | **9.7**           | Finance consumer UI hooks                                                    |
| `packages/workspace-sdk/src/auth/**`                     | **9.1, 9.4**      | Operator CASL — **doc-first**                                                |
| `docs/phase-9/**`                                        | **All**           | Specs, decisions, truth                                                      |
| `reports/phase-9-*`                                      | **9.0, 9.8**      | Entry yaml · gate JSON                                                       |

> **Finance route dual-path (DEC-P9-017):** Trunk R1 may write `apps/web/app/finance/**` (no `(app)/` group). Target after **9.2** admin shell: migrate components to `apps/web/app/(app)/finance/**` — same UX, new route group. Agents must not create finance UI only under `(app)/` while interim path is active on trunk unless 9.2 migration (CP-9.2-11) is complete.

### 2.3 Explicitly forbidden write paths

| Path                                             | Forbidden reason                                |
| ------------------------------------------------ | ----------------------------------------------- |
| `packages/platform-core/**`                      | INV-P9-001                                      |
| `apps/marketing/**`                              | Marketing deploy deferred                       |
| `legacy/**`                                      | No writes — reference only                      |
| `apps/web/app/(public)/catalog/**` expansion     | Marketing / Phase 8 public funnel — not Phase 9 |
| `packages/workspaces/urban/**` product expansion | Urban closed at 8.x — regression tests only     |
| NestJS / TypeORM ports verbatim                  | Trunk is Fastify/Prisma — adapt semantics only  |

---

## 3. Subphase routing table

| Subphase | Primary deliverable                                                                                        | Blocks |
| -------- | ---------------------------------------------------------------------------------------------------------- | ------ |
| **9.0**  | Entry yaml + phase-8 gate                                                                                  | 9.1    |
| **9.1**  | Identity + session production                                                                              | 9.2    |
| **9.2**  | Mobile-first `(app)/` shell + dashboard — [`ADMIN-SHELL-UX.md`](appendices/ADMIN-SHELL-UX.md) · DEC-P9-013 | 9.3    |
| **9.3**  | Tours operator (list/edit/workspace) — [`TOURS-LIST-UX.md`](appendices/TOURS-LIST-UX.md) · DEC-P9-014      | 9.4    |
| **9.4**  | Users + invites + RBAC — [`USERS-DIRECTORY-UX.md`](appendices/USERS-DIRECTORY-UX.md) · DEC-P9-015          | 9.5    |
| **9.5**  | Bookings ops — Registration Command Center (DEC-P9-011)                                                    | 9.6    |
| **9.6**  | Settings + templates                                                                                       | 9.7    |
| **9.7**  | Finance Command Center — [`FINANCE-OPS-UX.md`](appendices/FINANCE-OPS-UX.md) · DEC-P9-016                  | 9.8    |
| **9.8**  | `phase-9:gate` + E2E SMK-P9                                                                                | —      |

---

## 4. RBAC model (operator vs urban)

| Workspace   | Admin config surfaces           | Rule                                                     |
| ----------- | ------------------------------- | -------------------------------------------------------- |
| **urban**   | settings, catalog admin         | **Owner only** — INV-P8-007 · DEC-P8-001 (no regression) |
| **denali**  | settings, tours, users, finance | **`isAdminOrOwner`** — DEC-P9-004 (legacy parity)        |
| **starter** | reference only                  | Phase 3 CASL unchanged                                   |

---

## 5. ENTERPRISE RESEARCH & INNOVATION PROTOCOL (ERIP)

| Subphase    | COP required                                                      | Location                                                                               |
| ----------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **9.1**     | Identity port — OTP storage, session rotation, membership hydrate | [`appendices/erip/9.1-cop-identity-port.md`](appendices/erip/9.1-cop-identity-port.md) |
| **9.2–9.5** | Per-subphase COP before merge                                     | `appendices/erip/9.{n}-cop-*.md`                                                       |
| **9.6–9.8** | Lighter COP — settings/finance/gate focus                         | `appendices/erip/`                                                                     |

**No boilerplate:** Empty handlers, uncited legacy copy-paste → anti-hollow **FAIL** (MAP §12 R5).

---

## 6. Smoke matrix (9.8)

| ID            | Scenario                                                                   | Proof                 |
| ------------- | -------------------------------------------------------------------------- | --------------------- |
| **SMK-P9-01** | Operator login (OTP) → dashboard                                           | Playwright + HTTP     |
| **SMK-P9-02** | Create tour via wizard → appears in list                                   | Playwright            |
| **SMK-P9-03** | Invite user → accept → directory shows member                              | HTTP + UI             |
| **SMK-P9-04** | Booking submitted → operator approves in Command Center                    | HTTP + UI             |
| **SMK-P9-05** | Settings template save → wizard reflects seed                              | UI + API              |
| **SMK-P9-06** | Admin session opens `/leader/review` (legacy URL alias) → same inbox shell | UI alias · DEC-P9-011 |
| **SMK-P9-07** | Operator manual booking create                                             | `(app)/bookings/new`  |
| **SMK-P9-08** | Settings equipment round-trip                                              | UI + API              |

Full steps: [`appendices/SMOKE-SCENARIO-MAP.md`](appendices/SMOKE-SCENARIO-MAP.md).

---

## 7. Fast commands

```bash
pnpm run phase-9:guard              # 32 charter gates — daily default
pnpm run phase-9:gate                 # full closure — Architect YES only
pnpm run guard:p9-boundary-diff       # 9.1 PR train boundary
pnpm --filter @apps/web run test:e2e:operator  # SMK-P9 (when behavioral)
```

## 8. Doc pack maturity (2026-06-08)

| Metric            | Value                                               |
| ----------------- | --------------------------------------------------- |
| PEK files         | 69                                                  |
| Charter gates     | 32                                                  |
| Guard attestation | 32/32 PASS (T-9.1 promoted · P8 gates)              |
| Integration depth | ~96% vs Phase 8 PEK                                 |
| ERIP COPs         | 8 (DRAFT · APPROVED_PARITY content)                 |
| Spec scaffolds    | 17 on trunk                                         |
| Forensic          | rubric + mdoc scaffold · verdict PENDING until gate |

Precision index: [`appendices/PRECISION-DOC-INDEX.md`](appendices/PRECISION-DOC-INDEX.md)

---

## 9. FAIL examples

```text
FAIL TG-P9-001: 9.1 code merge while phase_8_gate.status != PASS
FAIL INV-P9-007: (app)/tours reachable without session — fail-open
FAIL INV-P8-007-REGRESSION: urban settings PATCH allowed for role=admin after 9.x merge
FAIL INV-P9-001: packages/platform-core diff on admin PR
```
