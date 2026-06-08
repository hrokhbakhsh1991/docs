# Phase 9 — Operator Admin Parity

```yaml
phase_id: "9"
phase_name: "Operator Admin Parity"
epic_driver: "Option B — Operator Admin Panel (MAP §3.5 Admin-Panel + User-Portal ops)"
hardening_driver: "Option F — Identity & session production (DELTA-NP-01/02 closure)"
adr: "ADR-009 (proposed — see appendices/IMPLEMENTATION-DECISIONS.md)"
prerequisite: pnpm run phase-8:gate
closure: pnpm run phase-9:gate
agent_entry: docs/phase-9/phase-9-agent-router.md
boot_manifest: docs/phase-9/appendices/BOOT-MANIFEST.yaml
implementation_truth: docs/phase-9/audits/IMPLEMENTATION-TRUTH.md
legacy_reference: legacy/apps/web/app/(app)/ · legacy/apps/api/src/modules/identity/
map_authority: docs/MIGRATION-MAP.md
covenant: MAP §12 Zero-Debt Covenant
operator_dod: MAP §3.5 Admin-Panel · §3.6 session (single shell until deploy split)
```

## North star

Deliver **full legacy operator/admin surface** (`legacy/apps/web/app/(app)/`) inside trunk `apps/web` + `apps/api` — **without** Marketing app, **without** public Urban catalog expansion, **without** `platform-core` product diff. **DEC-P9-008:** All previously deferred admin gaps (leader review, transport, manual bookings, settings modules, audit trail, reconciliation, users extras) close **within Phase 9** — not Phase 10+. Phase 9 closes **Operator Admin DoD**: full `(app)/` route inventory parity on trunk.

> **Agents:** Do not implement from this charter alone. Use [`phase-9-agent-router.md`](phase-9-agent-router.md) (**SOLE ENTRY**) + **§5 ERIP** + [`appendices/BOOT-MANIFEST.yaml`](appendices/BOOT-MANIFEST.yaml) + subphase specs under `subphases/`.

---

## Objective

Phase 9 migrates the **legacy Tour Ops protected app** into the trunk plugin architecture established by Phases 6–8:

| Layer                | Phase 9 obligation                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Identity**         | Production OTP/session, membership hydration, JWT verify — Prisma-backed (DELTA-NP-01/02)                         |
| **API**              | Operator routes under `apps/api/src/identity/**`, `apps/api/src/tours/**`, bookings, settings — tenant-scoped RLS |
| **Web**              | `(app)/` route tree in `@apps/web` — dashboard, tours, users, bookings, settings, finance                         |
| **Workspace plugin** | **Denali-first** operator MVP; Urban admin extends Phase 8 owner surfaces only — no urban→denali rail             |
| **Platform core**    | **Zero creep** — `packages/platform-core` diff for admin product work must remain empty (INV-P9-001)              |

### Critical distinction (carried from Phase 8)

| Concept                             | Phase 8 (closed)        | Phase 9 trunk                                                                            |
| ----------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------- |
| Urban public catalog / registration | Product Parity funnel   | **Out of scope** — already closed at 8.x or deferred to Marketing phase                  |
| Urban owner-only settings           | INV-P8-007 · DEC-P8-001 | **Unchanged** — Phase 9 does not widen urban admin to `isAdminOrOwner`                   |
| Denali operator RBAC                | Phase 6 wizard only     | **Full** `(app)/` port — `isAdminOrOwner` restored per DEC-P9-004                        |
| Three deployable apps               | MAP target              | **Single `apps/web`** — `(app)/` + `(public)/` route groups; deploy split still deferred |

See [`appendices/LEGACY-ADMIN-REFERENCE.md`](appendices/LEGACY-ADMIN-REFERENCE.md) · [`../apps/api/docs/legacy-vs-denali-gap-analysis.md`](../apps/api/docs/legacy-vs-denali-gap-analysis.md).

---

## In scope vs out of scope

| In scope (Phase 9) — **DEC-P9-008 full `(app)/` parity**                                     | Out of scope (Phase 10+ — non-admin)                  |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Identity + session production (OTP, login, membership verify)                                | `apps/marketing` separate deploy                      |
| Admin web shell — `(app)/` layout, dashboard, navigation                                     | SEO / blog / Marketing CMS                            |
| Tours — list, edit, workspace, waitlist, transport, register, leader review                  | `(public)/catalog/**` Marketing funnel                |
| Users — directory, invites, RBAC, CSV export, remove, rewards                                | Database-per-tenant for all tenants                   |
| Bookings — queue, approve/reject, waitlist promotion, **manual create**                      | WASM sandbox · AI/chat layer                          |
| Settings — hub, templates, presets, equipment, themes, languages, locations, **audit trail** | CDC / data warehouse                                  |
| Finance + **reconciliation triage** (Denali)                                                 | Per-tenant JWT/Vault secrets                          |
| Operator E2E SMK-P9-01..08 + full route contract                                             | Third-app deploy split (Marketing/Portal/Admin repos) |
| `phase-9.contract.spec.ts` — full `(app)/` inventory without `platform-core` diff            | Urban public funnel (Phase 8)                         |

---

## Architectural invariants (MAP §12 — FAIL if violated)

```yaml
invariants:
  - id: INV-P9-001
    rule: "No admin-product PRs in packages/platform-core"
    enforcement: phase-9.contract.spec.ts + reports/phase-9-genericity-baseline.yaml
  - id: INV-P9-002
    rule: "No IDENTITY_* / ADMIN_* product constants in apps/api generic middleware"
    enforcement: guard:import-boundary + phase-9-guard anti-creep checks
  - id: INV-P9-003
    rule: "Operator routes resolve tenant via tenant-kernel — no handler without tenant_id"
    enforcement: tenant-security specs · RLS integration tests
  - id: INV-P9-004
    rule: "legacy/ is read-only reference — no runtime import from legacy in trunk apps"
    enforcement: RULE-P8-007 carryover · rg guard in 9.0 entry
  - id: INV-P9-005
    rule: "Canonical document remains single source of truth — no RHF mirror"
    enforcement: apps/web guards · canonical-sot specs
  - id: INV-P9-006
    rule: "Finance hooks live in packages/workspaces/denali only — not urban or platform-core"
    enforcement: DEC-P7-002 carryover · import-boundary
  - id: INV-P9-007
    rule: "(app)/ routes fail-closed — unauthenticated → 401/403, never silent guest on operator surfaces"
    enforcement: admin-route-matrix · operator-access specs
  - id: INV-P9-008
    rule: "Urban owner-only surfaces from Phase 8 remain owner-only — Phase 9 admin port must not regress INV-P8-007"
    enforcement: urban-owner regression bundle in 9.8 gate
```

---

## Subphase DAG (9.0 → 9.8)

```text
9.0  Entry (phase-8:gate + Product Parity attestation)
  ↓
9.1  Identity & session production (OTP · JWT · membership hydrate)
  ↓
9.2  Admin web shell ((app)/ layout · dashboard · auth pages)
  ↓
9.3  Tours operator surface (list · edit · workspace · wizard)
  ↓
9.4  Users, invites & RBAC
  ↓
9.5  Bookings & registration ops
  ↓
9.6  Settings & workspace templates
  ↓
9.7  Finance (Denali workspace)
  ↓
9.8  Operator Admin DoD gate + E2E (SMK-P9-01..08) + full route contract
```

| Subphase | Spec                                                                                                                                  | Milestone              | Exit signal                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------ |
| **9.0**  | [`subphases/9.0-entry.md`](subphases/9.0-entry.md)                                                                                    | Entry gate             | `phase-8:gate` exit 0 · entry yaml                     |
| **9.1**  | [`subphases/9.1-identity-session.md`](subphases/9.1-identity-session.md)                                                              | Identity production    | OTP + session specs PASS                               |
| **9.2**  | [`subphases/9.2-admin-shell.md`](subphases/9.2-admin-shell.md) · [`ADMIN-SHELL-UX.md`](appendices/ADMIN-SHELL-UX.md)                  | Admin shell            | mobile-first `(app)/` chrome + dashboard               |
| **9.3**  | [`subphases/9.3-tours-operator.md`](subphases/9.3-tours-operator.md) · [`TOURS-LIST-UX.md`](appendices/TOURS-LIST-UX.md)              | Tours ops              | list projection API + card grid · edit/workspace later |
| **9.4**  | [`subphases/9.4-users-rbac.md`](subphases/9.4-users-rbac.md) · [`appendices/USERS-DIRECTORY-UX.md`](appendices/USERS-DIRECTORY-UX.md) | Users · 3-tier RBAC    | DEC-P9-015 · USERS-DIRECTORY-UX                        |
| **9.5**  | [`subphases/9.5-bookings-ops.md`](subphases/9.5-bookings-ops.md)                                                                      | Bookings ops           | approve/reject workflow                                |
| **9.6**  | [`subphases/9.6-settings-templates.md`](subphases/9.6-settings-templates.md)                                                          | Settings modules       | template/preset panels                                 |
| **9.7**  | [`subphases/9.7-finance-denali.md`](subphases/9.7-finance-denali.md) · [`appendices/FINANCE-OPS-UX.md`](appendices/FINANCE-OPS-UX.md) | Finance Command Center | DEC-P9-016 · prepayment · installments                 |
| **9.8**  | [`subphases/9.8-operator-dod-gate.md`](subphases/9.8-operator-dod-gate.md)                                                            | Operator Admin DoD     | `phase-9:gate` · forensic ≥ 8                          |

### Transition guards (summary)

| Guard     | Rule                                                                         |
| --------- | ---------------------------------------------------------------------------- |
| TG-P9-001 | 9.1 blocked until 9.0 `phase_8_gate` PASS in entry yaml                      |
| TG-P9-002 | 9.2 blocked until 9.1 `VERIFIED_BEHAVIORAL`                                  |
| TG-P9-003 | 9.3 blocked until 9.2 `VERIFIED_BEHAVIORAL`                                  |
| TG-P9-004 | 9.4–9.7 sequential — each blocked until prior subphase `VERIFIED_BEHAVIORAL` |
| TG-P9-005 | 9.8 blocked until 9.1–9.7 all `VERIFIED_BEHAVIORAL`                          |

Full machine rules: [`appendices/BOOT-MANIFEST.yaml`](appendices/BOOT-MANIFEST.yaml).

---

## Impacted architectural layers

| Path                          | Phase 9 role                                                   |
| ----------------------------- | -------------------------------------------------------------- |
| `apps/api/src/identity/**`    | **Primary** — auth, users, membership, invites                 |
| `apps/api/src/tours/**`       | Operator tour list/lifecycle (extends Phase 5/6 kernel)        |
| `apps/api/prisma/`            | Identity + bookings schema delta                               |
| `apps/web/app/(app)/`         | **Primary** — operator UI shell                                |
| `apps/web/app/auth/`          | Login, OTP, invite accept                                      |
| `packages/workspaces/denali/` | Finance hooks, operator field composites                       |
| `packages/workspace-sdk/`     | CASL extensions for operator surfaces — **doc-first**          |
| `packages/platform-core/`     | **Forbidden** — zero admin diff (INV-P9-001)                   |
| `packages/workspaces/urban/`  | **Regression only** — no expansion; Phase 8 owner rules frozen |
| `legacy/`                     | Read-only port source                                          |

---

## Technical Quality & Performance Benchmarks

**Authority:** MAP §12 R3 · R4 · R5 · router **§5 ERIP**.

### TQ-P9-\* cleanliness benchmarks (enforced at 9.8)

| ID            | Benchmark                                                                                                                                               | Verification                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **TQ-P9-001** | **Zero unnecessary barrel imports** — `@app-tour/ui-primitives` subpath-only on new admin surfaces                                                      | `guard:import-boundary`            |
| **TQ-P9-002** | **Single dynamic workspace import** — `workspace-plugin-loaders.generated.ts` only (Phase 10); no static `@app-tour/workspace-denali` in `(app)/` pages | `workspace-boundary.spec.ts`       |
| **TQ-P9-003** | **Session-bound routes `force-dynamic`** — `(app)/` layout requires ALS/session                                                                         | build analyze · e2e smoke          |
| **TQ-P9-004** | **Node 24 native efficiencies** — no new polyfill bundles for server-only paths                                                                         | `check:node-engine`                |
| **TQ-P9-005** | **Prisma 6 query discipline** — indexed tenant-scoped list paths for tours/users/bookings                                                               | EXPLAIN in COP · integration specs |
| **TQ-P9-006** | **Transactional outbox reuse** — booking/finance mutations reuse Phase 5 outbox; no duplicate tables                                                    | existing outbox specs              |
| **TQ-P9-007** | **Type-safe HTTP ingress** — Zod at identity/tour/booking route boundaries                                                                              | typecheck + route specs            |
| **TQ-P9-008** | **Fail-closed auth** — CASL + session verify before handler body on `(app)/` API routes                                                                 | identity-access specs              |
| **TQ-P9-009** | **No N+1 on directory pages** — users list, bookings list paginated with select discipline                                                              | code review + spec                 |
| **TQ-P9-010** | **Big-O attestation** — tour list, user directory, booking queue each O(log N) or O(1) with index proof                                                 | COP table                          |

### Performance targets (Operator Admin — not micro-benchmark theater)

| Surface                   | Target                                      | Notes      |
| ------------------------- | ------------------------------------------- | ---------- |
| Login OTP round-trip      | ≤ 3s p95 dev · Redis-backed challenge       | 9.1 COP    |
| Tour list (pooled tenant) | Indexed `tenant_id` + sort · paginated      | TQ-P9-005  |
| Booking approve           | Single transaction: status + outbox         | TQ-P9-006  |
| Settings template save    | One persist round-trip + cache invalidation | DEC-P9-005 |

---

## Forensic Truth vs Marketing (§14.4 carryover)

| Claim                           | Reality                                                                                    | Status                |
| ------------------------------- | ------------------------------------------------------------------------------------------ | --------------------- |
| «Full legacy Tour Ops on trunk» | Phase 9 closes **full operator `(app)/`** per DEC-P9-008 — not Marketing, not deploy split | **Partial until 9.8** |
| «Three apps per tenant»         | Single `apps/web` with route groups until deploy split                                     | **Deferred** — honest |
| «Admin-Panel live»              | `(app)/` protected shell — same repo as User-Portal ops                                    | **Target at 9.8**     |
| «Identity parity»               | OTP + session ported — not Nest/TypeORM lift-and-shift                                     | **Target at 9.1**     |
| «Finance complete»              | Finance Command Center R1 at 9.8 · R2-R3 stretch (DEC-P9-016)                              | **Target at 9.7**     |

---

## Verification

```bash
pnpm run phase-9:guard    # doc + invariant attestation (daily)
pnpm run phase-9:gate     # full closure — explicit Architect YES only (~35–45 min chain)
```

**Doc pack honesty:** `phase-9:guard` PASS does **not** imply Operator Admin DoD — see [`audits/IMPLEMENTATION-TRUTH.md`](audits/IMPLEMENTATION-TRUTH.md).
