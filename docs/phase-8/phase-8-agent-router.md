# AI-EXECUTION ROUTER — Phase 8 (SOLE ENTRY)

```yaml
document_meta:
  phase_id: "8"
  phase_name: "Product Parity & Dynamic Core Hardening"
  sole_execution_entry: true
  fail_token: FAIL
  prerequisite_gate: pnpm run phase-7:gate
  closure_gate: pnpm run phase-8:gate
  human_narrative: phase-8-charter.md
  boot_manifest: appendices/BOOT-MANIFEST.yaml
  implementation_truth: audits/IMPLEMENTATION-TRUTH.md
  platform_continuity: ../../appendices/PLATFORM-CONTINUITY-0-7.md
  phase7_truth: ../../phase-7/audits/IMPLEMENTATION-TRUTH.md
  legacy_urban_reference: ../../phase-7/appendices/LEGACY-URBAN-REFERENCE.md
  urban_minimal_scope: ../../phase-7/appendices/URBAN-MINIMAL-SCOPE.md
  map_covenant: ../../MIGRATION-MAP.md#۱۲-the-zero-debt-covenant-mandatory-enforcement
  platform_dod: ../../MIGRATION-MAP.md#۲۲-definition-of-done--کل-پلتفرم
  epic_driver: "Option A — Product Parity"
  hardening_driver: "Option E — Silo tier (8.3)"
  erip_protocol: "§5 ENTERPRISE RESEARCH & INNOVATION PROTOCOL"
  erip_mandatory_subphases: ["8.1", "8.2", "8.3"]
  erip_recommended_subphases: ["8.4", "8.5"]
```

---

## 1. Executive Routing Law

**Any AI agent, Cursor session, or automated implementer operating under Phase 8 MUST read this file FIRST before reading subphase specs, proposing code, or modifying repository state.**

| Law                      | Requirement                                                                                                                                                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SOLE ENTRY**           | Phase 8 execution is authorized only from **this router** + [`appendices/BOOT-MANIFEST.yaml`](appendices/BOOT-MANIFEST.yaml) + [`AGENT-NAVIGATOR.md`](AGENT-NAVIGATOR.md) + `subphases/{current}.md`.                              |
| **CHARTER IS NARRATIVE** | [`phase-8-charter.md`](phase-8-charter.md) explains intent; it does **not** authorize implementation without router + subphase `completion_proof`.                                                                                 |
| **TRUTH BEFORE CLAIMS**  | [`audits/IMPLEMENTATION-TRUTH.md`](audits/IMPLEMENTATION-TRUTH.md) is the honesty ledger. If truth says `SPEC_ONLY` or `ABSENT`, agents MUST NOT claim `VERIFIED_BEHAVIORAL`.                                                      |
| **DOC-FIRST COVENANT**   | MAP §12 · `.cursorrules`: protected packages (`platform-core`, `workspace-sdk`, `apps/api` generic layer) require matching `docs/` update **before** code. Phase 8 product logic belongs in **`packages/workspaces/urban`** first. |
| **FAIL TOKEN**           | On invariant violation, emit `FAIL`, cite rule ID (INV-P8-_ / TG-P8-_), halt, and request human Architect approval.                                                                                                                |
| **NO PHASE 9 SCOPE**     | CDC, WASM sandbox, AI/chat layer, and vault-per-tenant secrets are **forbidden** in Phase 8 — see BOOT-MANIFEST `out_of_scope`.                                                                                                    |
| **ERIP BEFORE CODE**     | §5 — every implementation subphase **8.1–8.5** requires active research; **8.1–8.3** require a human-approved **Creativity & Optimization Proposal** before any code. Innovation is bound by INV-P8-\* — no platform-core creep.   |

```text
┌─────────────────────────────────────────────────────────────┐
│  MANDATORY READ ORDER (every session)                        │
│  1. phase-8-agent-router.md          ← THIS FILE (FIRST)    │
│  2. audits/IMPLEMENTATION-TRUTH.md                            │
│  3. AGENT-NAVIGATOR.md              ← next step decision tree │
│  4. appendices/AGENT-CURRENT-PHASE.yaml                       │
│  5. appendices/BOOT-MANIFEST.yaml → detect_current_subphase   │
│  6. subphases/{current}.md                                    │
│  7. §5 ERIP — research BEFORE code (8.1+ mandatory)           │
│  8. phase-8-charter.md               (TQ-P8-* benchmarks)     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Context Boundaries

### 2.1 Read-only paths (reference — no product writes)

Agents MAY read these paths for porting semantics. **Writes require explicit Architect waiver** and, for protected packages, a prior `docs/` proposal per doc-first covenant.

| Path                           | Role                                                      | Phase 8 rule                                                                                                                     |
| ------------------------------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `legacy/`                      | Port source for Urban catalog, registrations, settings    | **Read-only.** No runtime `import` from `legacy/` in trunk `apps/*` (INV-P8-004 · RULE-P7-007).                                  |
| `packages/platform-core/`      | Generic wizard engine                                     | **Read-only.** Zero urban product diff (INV-P8-001). Any perceived engine gap → plugin or SDK contract proposal, not core patch. |
| `packages/workspace-sdk/`      | Plugin contract, CASL, bindings                           | **Read-only** unless Architect approves contract extension doc. No urban product fields in SDK.                                  |
| `packages/workspaces/denali/`  | Phase 6 product reference                                 | **Read-only.** Pattern reference only — no urban→denali rail (INV-P8-003).                                                       |
| `packages/workspaces/starter/` | Minimal plugin reference                                  | **Read-only.**                                                                                                                   |
| `docs/phase-7/`                | Platform DoD specs, urban minimal scope, genericity proof | **Read-only** for Phase 8 agents (upstream closed at 7.9).                                                                       |
| `docs/MIGRATION-MAP.md`        | §12 covenant · §22 Platform DoD                           | **Read-only** authority.                                                                                                         |
| `reports/phase-7-*`            | Upstream gate evidence                                    | **Read-only.**                                                                                                                   |

### 2.2 Allowable write paths (Phase 8 product work)

Writes MUST stay within the **current subphase** scope detected by BOOT-MANIFEST. Default allowlist:

| Path                                                          | Subphase                           | What may change                                                                                                                       |
| ------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/workspace-sdk/src/auth/**`                          | **8.1**                            | CASL subjects / ability rules for urban owner paths — **doc-first**                                                                   |
| `packages/workspace-sdk/test/urban-owner-ability.spec.ts`     | **8.1**                            | Owner/member contract specs                                                                                                           |
| `apps/web/src/urban/urban-settings-access.ts`                 | **8.1**                            | Owner guard — thin wrapper over [`CANLOAD-URBAN-SETTINGS.contract.ts`](../appendices/CANLOAD-URBAN-SETTINGS.contract.ts) (DEC-P8-004) |
| `apps/api/src/**/urban-settings*.ts`                          | **8.1**                            | Owner middleware only — no catalog body yet                                                                                           |
| `docs/phase-8/appendices/URBAN-ROUTE-MATRIX.md`               | **8.1**                            | Public vs owner route matrix                                                                                                          |
| `packages/workspaces/urban/`                                  | **8.2** (primary)                  | Registry, composites, validation, theme, golden fixtures                                                                              |
| `apps/web/src/bootstrap/lazy-urban-plugin.ts`                 | **7.3 READ-ONLY** · **8.2 extend** | Phase 7.3 `VERIFIED_BEHAVIORAL` — **FORBIDDEN_IN_8_1** writes; extend only in **8.2** (mirror `lazy-denali-plugin.ts`)                |
| `apps/web/src/bootstrap/workspace-plugin-registry.ts`         | **8.2**                            | Urban plugin registration                                                                                                             |
| `apps/api/src/workspace/workspace-plugins.ts`                 | **8.2**                            | `getUrbanWorkspacePlugin()` in API registry                                                                                           |
| `packages/workspace-sdk/src/plugin/workspace-type-binding.ts` | **8.2**                            | `urban` binding — **doc-first** before merge                                                                                          |
| `apps/web/app/` · `apps/web/src/` (urban routes)              | **8.2, 8.4**                       | Catalog, registration, settings UI                                                                                                    |
| `apps/api/src/**/urban-catalog*.ts` · `urban-register*.ts`    | **8.2, 8.4**                       | Public catalog / registration HTTP                                                                                                    |
| `packages/tenant-kernel/`                                     | **8.3 only**                       | `TenantConnectionRouter` silo integration — not in 8.1                                                                                |
| `infra/sql/*tenant_routes*`                                   | **8.3 only**                       | Silo DDL per TENANT-ROUTER-SPEC                                                                                                       |
| `docs/phase-8/`                                               | **All**                            | Subphase specs, decisions, truth updates                                                                                              |
| `reports/phase-8-*`                                           | **8.0, 8.5**                       | Entry verified yaml · gate JSON                                                                                                       |

### 2.3 Explicitly forbidden write paths

| Path                                                         | Forbidden reason                                    |
| ------------------------------------------------------------ | --------------------------------------------------- |
| `packages/platform-core/**`                                  | INV-P8-001 — Product Parity without engine creep    |
| `legacy/**`                                                  | Frozen monorepo — no new features in legacy         |
| `packages/workspaces/denali/**`                              | Denali closed at Phase 6 Tier D — no urban coupling |
| `apps/api/src/**` generic middleware with `URBAN_*` branches | INV-P8-002 — ops stay generic (Phase 7 pattern)     |
| Any `urban` → `denali` workspace type binding                | INV-P8-003 · FORB-P8-001                            |

> **Note:** User-facing package path is `packages/workspaces/urban/` (`@app-tour/workspace-urban`), not `workspace-urban`.

---

## 3. Single-Owner Execution Flow

Phase 8 enforces **Single-Owner architecture** at two levels: **execution ownership** (one subphase owner per session) and **identity ownership** (Workspace **Owner** login for tenant configuration mutations).

### 3.1 Execution ownership (subphase seriality)

| Rule           | Description                                                                                                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SO-EXEC-01** | Exactly **one** subphase is **current** per agent session — from `detect_current_subphase` in BOOT-MANIFEST.                                                                        |
| **SO-EXEC-02** | Subphases **8.0 → 8.1 → 8.2** are strictly sequential.                                                                                                                              |
| **SO-EXEC-03** | **8.3** and **8.4** may run in parallel **only after** 8.2 is `VERIFIED_BEHAVIORAL`, but a **single agent session** must not implement both — assign one owner per parallel branch. |
| **SO-EXEC-04** | **8.5** closure requires **one** human Architect sign-off after all of 8.1–8.4 are `VERIFIED_BEHAVIORAL`.                                                                           |
| **SO-EXEC-05** | Do not skip ahead: implementing 8.4 E2E before 8.1 port is a **TG-P8-\*** violation → `FAIL`.                                                                                       |

```text
Session owner picks ONE branch:
  8.0 → 8.1 → 8.2 → ┬─ 8.3 (hardening owner)
                      └─ 8.4 (E2E owner)
                            ↓
                          8.5 (Architect + gate)
```

### 3.2 Identity ownership (Workspace Owner login only)

Urban **product configuration** (tenant settings, catalog admin, registration policy, workspace template edits) MUST enforce **Workspace Owner** authority — not open member sessions.

| Surface                              | Required actor                                     | CASL / session rule                                                           |
| ------------------------------------ | -------------------------------------------------- | ----------------------------------------------------------------------------- |
| Public catalog browse                | Anonymous or authenticated visitor                 | Throttled public routes (R4) — no owner required                              |
| Public registration / waitlist       | Anonymous                                          | Rate-limited; tenant bootstrap only                                           |
| **Urban tenant settings**            | **`owner` only** (`isWorkspaceOwner` — DEC-P8-001) | `canPerformUrbanOwnerMutation` · fail-closed **403** for `admin` and `member` |
| **Workspace theme / template admin** | **`owner`**                                        | `ability.can` before `ThemeProviderChain` workspace ingress                   |
| **Catalog publish / unpublish**      | **`owner`**                                        | Mutation routes reject non-owner ALS context                                  |
| Silo fixture provisioning (8.3)      | **Platform ops** + documented enterprise fixture   | Not member-facing                                                             |

Design decisions for Phase 8 MUST document which routes are **public**, **authenticated member**, and **owner-only** in the subphase spec before implementation. Default for settings/catalog admin: **Owner login only** (Single-Owner product rule).

Reference: `packages/workspace-sdk/src/auth/tenant-auth-grants.ts` — `isAdminOrOwner`, `isAuthzGranted`.

### 3.3 AGENT_START_SEQUENCE

```yaml
AGENT_START_SEQUENCE:
  manifest: appendices/BOOT-MANIFEST.yaml
  0_router: ASSERT reading phase-8-agent-router.md
  1_truth: READ audits/IMPLEMENTATION-TRUTH.md
  2_charter: READ phase-8-charter.md
  3_phase7_truth: READ ../../phase-7/audits/IMPLEMENTATION-TRUTH.md
  4_legacy_ref: READ ../../phase-7/appendices/LEGACY-URBAN-REFERENCE.md
  5_prerequisite:
    when_subphase_gte: "8.0"
    run: pnpm run phase-7:gate
    expect_exit: 0
  6_detect: detect_current_subphase per BOOT-MANIFEST
  6b_erip:
    when_subphase_gte: "8.1"
    require: ERIP Creativity & Optimization Proposal approved before code
  7_execute: load subphases/{current}.md
  8_enforce: apply Single-Owner rules SO-EXEC-* and identity table §3.2
  9_closure:
    when: "8.5"
    run: pnpm run phase-8:gate
```

### 3.4 Architectural invariants (FAIL if violated)

```yaml
invariants:
  - id: INV-P8-001
    rule: "No urban-only PRs in packages/platform-core"
  - id: INV-P8-002
    rule: "No URBAN_* product constants in apps/api generic layer"
  - id: INV-P8-003
    rule: "Urban resolves via WorkspacePlugin registry — not Denali rail"
  - id: INV-P8-004
    rule: "legacy/ read-only — no runtime import in trunk apps"
  - id: INV-P8-005
    rule: "Canonical document SoT — no RHF mirror"
  - id: INV-P8-006
    rule: "Silo via TenantConnectionRouter in tenant-kernel — not ad-hoc DB URLs"
  - id: INV-P8-007
    rule: "Urban settings/catalog admin mutations — Workspace Owner login only (Single-Owner)"
```

### 3.5 Subphase index

| ID  | Doc                                                                        | Owner focus                        | Prerequisite                    |
| --- | -------------------------------------------------------------------------- | ---------------------------------- | ------------------------------- |
| 8.0 | [`subphases/8.0-entry.md`](subphases/8.0-entry.md)                         | Architect · gate evidence          | `phase-7:gate`                  |
| 8.1 | [`subphases/8.1-single-owner-auth.md`](subphases/8.1-single-owner-auth.md) | CASL · Owner-only mutations        | 8.0 VERIFIED_ENTRY              |
| 8.2 | [`subphases/8.2-urban-features.md`](subphases/8.2-urban-features.md)       | Plugin + catalog/register/settings | 8.1 VERIFIED_BEHAVIORAL         |
| 8.3 | [`subphases/8.3-silo-tier.md`](subphases/8.3-silo-tier.md)                 | `tenant-kernel` silo               | 8.2 VERIFIED_BEHAVIORAL         |
| 8.4 | [`subphases/8.4-e2e-integrity.md`](subphases/8.4-e2e-integrity.md)         | Playwright + HTTP E2E              | 8.2 VERIFIED_BEHAVIORAL         |
| 8.5 | [`subphases/8.5-platform-dod.md`](subphases/8.5-platform-dod.md)           | Architect · Product Parity gate    | 8.1–8.4 all VERIFIED_BEHAVIORAL |

---

## 4. Step-by-Step Prompting Loop (subphase sign-off)

Human and agent MUST complete this micro-protocol **per subphase** before advancing `detect_current_subphase`. All sign-offs mutate [`audits/IMPLEMENTATION-TRUTH.md`](audits/IMPLEMENTATION-TRUTH.md) in the **same PR** as behavioral work (or docs-only PR for 8.0).

### 4.1 Loop diagram

```text
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ A. DETECT    │ →  │ B. PROPOSE   │ →  │ C. PROVE     │ →  │ D. SIGN-OFF  │
│ current 8.x  │    │ doc + scope  │    │ tests/gate   │    │ update TRUTH │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
       ↑                                                            │
       └────────────────── next subphase only if D complete ───────┘
```

### 4.2 Step A — Detect (agent)

1. Read IMPLEMENTATION-TRUTH.md — note lowest open subphase.
2. Run `detect_current_subphase` rules from BOOT-MANIFEST.
3. State to user: `Current subphase: 8.x` · status from truth ledger · blockers from BL-P8-\*.

**User prompt template:**

```text
Phase 8 session start. Router acknowledged. Proceed with subphase {8.x} only.
```

### 4.3 Step B — Propose (agent → user)

Before any code:

1. Complete **§5 ERIP** (subphases ≥ 8.1) — attach Creativity & Optimization Proposal.
2. List files to touch (must ⊆ §2.2 allowlist for current subphase).
3. Confirm **platform-core** remains untouched.
4. For 8.1+: list Owner-only vs public routes per `URBAN-ROUTE-MATRIX.md`.
5. Cite doc updates required (`docs/phase-8/subphases/8.x-*.md`).
6. Map proposal to charter **Technical Quality Benchmarks** (TQ-P8-\*).

**User sign-off required:** explicit `APPROVED 8.x scope` **and** `APPROVED 8.x ERIP proposal` in chat or PR description.

### 4.4 Step C — Prove (agent)

Run subphase `completion_proof` commands (from charter / future subphase yaml). Minimum:

| Subphase | Proof commands                                                                                 |
| -------- | ---------------------------------------------------------------------------------------------- |
| 8.0      | `pnpm run phase-7:gate` · `reports/phase-8-entry-verified.yaml`                                |
| 8.1      | `urban-owner-ability` · `urban-owner-access` · `urban-settings-patch` specs                    |
| 8.2      | `pnpm --filter @app-tour/workspace-urban build && test` · `urban-catalog-registration.spec.ts` |
| 8.3      | `tenant-connection-router.spec.ts` · `urban-silo-fixture.spec.ts`                              |
| 8.4      | `pnpm --filter @apps/web run test:e2e:urban` · `urban-e2e-http.spec.ts`                        |
| 8.5      | `pnpm run phase-8:gate` · `phase-8.contract.spec.ts` · forensic ≥ 8                            |

If proof fails: **do not** update truth to VERIFIED_BEHAVIORAL. Fix or mark `BLOCKED` with blocker ID.

### 4.5 Step D — Sign-off (user + agent → IMPLEMENTATION-TRUTH)

Update [`audits/IMPLEMENTATION-TRUTH.md`](audits/IMPLEMENTATION-TRUTH.md):

```yaml
# Per-subphase row update template
subphase_8_x:
  status: VERIFIED_BEHAVIORAL # or VERIFIED_SCAFFOLD / BLOCKED
  verified_at: "ISO-8601"
  verified_by: "human handle + agent session"
  prove_with:
    - "<command exit 0>"
  single_owner_checks:
    owner_only_routes_documented: true
    platform_core_diff_empty: true
```

| Sign-off party           | Responsibility                                                              |
| ------------------------ | --------------------------------------------------------------------------- |
| **Agent**                | Edit truth table rows · append `prove_with` evidence · never inflate status |
| **Human**                | Confirm `APPROVED 8.x` · review Owner-only matrix · merge PR                |
| **Architect** (8.0, 8.5) | Confirm MAP §22 (8.0) and Product Parity DoD (8.5)                          |

**User prompt template (closure of subphase):**

```text
Subphase 8.x sign-off: truth ledger updated to VERIFIED_BEHAVIORAL.
Evidence: <commands>. Proceed to detect next subphase.
```

### 4.6 Anti-patterns (immediate FAIL)

| Anti-pattern                                                      | Response                                    |
| ----------------------------------------------------------------- | ------------------------------------------- |
| Claim 8.1 done with doc pack only                                 | P7-F-005 analog — anti-hollow               |
| Touch `platform-core` for urban widget                            | INV-P8-001 → halt                           |
| Member role can edit urban settings                               | INV-P8-007 → halt · fix CASL                |
| Implement 8.3 and 8.4 in one session without parallel owner split | SO-EXEC-03 → split sessions                 |
| Skip IMPLEMENTATION-TRUTH update on merge                         | MAP §12 R2 violation                        |
| Implement without ERIP research (≥ 8.1)                           | ERIP-001 → halt · boilerplate forbidden     |
| Adopt pattern that violates INV-P8-\*                             | ERIP-002 → reject proposal even if "modern" |

---

## 5. ENTERPRISE RESEARCH & INNOVATION PROTOCOL (ERIP)

**Authority:** MAP §12 R2 (Verification-as-Code) · charter **Technical Quality Benchmarks** · `.cursorrules` fast-track policy.  
**Binding rule:** **Every** implementation subphase **8.1–8.5** requires active research before code. Subphases **8.1, 8.2, and 8.3** require a full, human-approved COP (non-negotiable). **8.4–8.5** require a lighter COP focused on test/gate optimization. Innovation **never** overrides INV-P8-\* or platform-core zero-creep.

### 5.1 ERIP law (non-negotiable)

| ID           | Law                                                                                                                                                                                                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ERIP-001** | For **every** subphase **8.1–8.5**, the agent MUST perform **active external research** (web search, official docs, vendor changelogs dated **2025–2026**) **before** writing implementation code or approving a PR scope. **8.1–8.3** are highest priority (auth, feature port, silo). |
| **ERIP-002** | Research findings MUST be synthesized into a **Creativity & Optimization Proposal** (COP) compared against trunk constraints — not pasted vendor marketing.                                                                                                                             |
| **ERIP-003** | The COP MUST be human-approved (`APPROVED 8.x ERIP proposal`) before Step C (Prove) code lands.                                                                                                                                                                                         |
| **ERIP-004** | Prefer **native trunk patterns** (plugin registry, CASL, outbox, RLS) over novel frameworks. External patterns are **adaptations**, not replacements.                                                                                                                                   |
| **ERIP-005** | Any COP that touches `platform-core`, `workspace-sdk` contract, or generic API middleware requires **prior doc proposal** — ERIP does not waive doc-first covenant.                                                                                                                     |
| **ERIP-006** | Boilerplate stubs (`TODO`, empty handlers, `pass` tests, copy-paste legacy imports) without COP citation → **FAIL** (anti-hollow · R5).                                                                                                                                                 |

### 5.2 Mandatory research triggers by subphase

| Subphase                   | Research focus (minimum 3 queries)                                     | Example 2026 enterprise topics                                                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **8.1** Single-Owner auth  | Declarative ABAC/CASL · session hardening · fail-closed BFF            | Capability-based authz at edge; RS256 session rotation (DEC-107); owner-only mutation guards; rate-limited public registration; ALS tenant context hygiene                 |
| **8.2** Urban feature port | Next.js 15 App Router · plugin lazy loading · canonical SoT API design | `next/dynamic` + server Components boundaries; `force-dynamic` tenant shell; subpath-only `@app-tour/ui-primitives`; Prisma 6 indexed catalog queries; zero barrel imports |
| **8.3** Silo routing       | Multi-tenant DB routing · Prisma connection strategy · pool vs silo    | `TenantConnectionRouter` patterns; PgBouncer transaction mode; per-tenant URL override; RLS backstop on pool tier; migrate deploy-only (DEC-124)                           |
| **8.4** E2E                | Playwright 2026 smoke · contract testing                               | Trace-on-failure; owner vs member fixtures; minimal mock surface                                                                                                           |
| **8.5** Closure            | Gate design · forensic rubric                                          | Nested `phase-8:gate`; contract spec without grep theater                                                                                                                  |

Agents MUST use **web search or equivalent knowledge retrieval** with dated sources. Cite URLs or doc paths in the COP.

### 5.3 Creativity & Optimization Proposal (COP) — required template

Submit in PR description or `docs/phase-8/appendices/erip/8.x-cop-YYYY-MM-DD.md` before implementation:

```markdown
## COP — Subphase 8.x

### Research summary (dated sources)

- [Source 1 — title, date, URL]
- [Source 2 — ...]

### Enterprise standard (what industry does in 2026)

<2–4 sentences — the pattern, not hype>

### Trunk constraints (what we cannot change)

- INV-P8-\* / MAP §12 rules affected
- packages/platform-core: zero diff
- Single-Owner: owner-only mutations
- Plugin boundary: urban logic in workspace-urban

### Proposed adaptation (our microkernel)

<Concrete design: modules, data flow, types — no code yet>

### Optimization claims (measurable)

| Claim                      | Metric           | Verification          |
| -------------------------- | ---------------- | --------------------- |
| e.g. Catalog list hot path | O(log N) indexed | EXPLAIN + spec        |
| e.g. Web plugin load       | 1 dynamic import | import-boundary guard |
| e.g. Auth check            | fail-closed 403  | integration spec      |

### Rejected alternatives (and why)

- <pattern> — violates INV-P8-00x / unnecessary dependency / legacy rail

### Human approval

- [ ] APPROVED 8.x ERIP proposal — <handle> — <date>
```

### 5.4 COP quality bar (MAP §12 alignment)

| Dimension            | Requirement                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------- |
| **Type safety**      | Strict TypeScript; no `any` in new urban surfaces; Zod at HTTP ingress where applicable   |
| **Performance**      | Hot paths meet charter TQ-P8-\* ; Big-O documented (R3)                                   |
| **Cleanliness**      | No barrel imports; subpath-only ui-primitives; no duplicate outbox                        |
| **Security**         | Fail-closed (R4); Owner-only admin (INV-P8-007); throttled public routes                  |
| **Innovation bound** | COP must state explicitly how proposal **stays inside** plugin + single-owner microkernel |

### 5.5 ERIP in the prompting loop

```text
A. DETECT → B. RESEARCH (ERIP) → B2. COP + APPROVED → C. PROVE → D. SIGN-OFF
```

Subphase **8.0** is exempt from ERIP (gate/docs only). Subphases **8.1–8.5** record COP path in `IMPLEMENTATION-TRUTH.md` `prove_with` when behavioral.

### 5.6 ERIP anti-patterns (immediate FAIL)

| ID         | Anti-pattern                                                                             |
| ---------- | ---------------------------------------------------------------------------------------- |
| ERIP-AH-01 | "Industry standard" with no dated source                                                 |
| ERIP-AH-02 | COP recommends NestJS/Express rewrite of trunk HTTP                                      |
| ERIP-AH-03 | COP adds Redux/RHF mirror contradicting INV-P8-005                                       |
| ERIP-AH-04 | COP patches `platform-core` for urban widget convenience                                 |
| ERIP-AH-05 | Research skipped because "legacy already has it" — port ≠ research exemption for 8.1–8.3 |

---

## 6. Quick reference

| Need                        | File                                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| Epic narrative              | [`phase-8-charter.md`](phase-8-charter.md)                                                           |
| DAG + deferrals             | [`appendices/BOOT-MANIFEST.yaml`](appendices/BOOT-MANIFEST.yaml)                                     |
| Honesty ledger              | [`audits/IMPLEMENTATION-TRUTH.md`](audits/IMPLEMENTATION-TRUTH.md)                                   |
| Urban anti-rail             | [`../phase-7/appendices/LEGACY-URBAN-REFERENCE.md`](../phase-7/appendices/LEGACY-URBAN-REFERENCE.md) |
| Zero-Debt Covenant          | [`../MIGRATION-MAP.md`](../MIGRATION-MAP.md) §12                                                     |
| Platform DoD (prerequisite) | [`../MIGRATION-MAP.md`](../MIGRATION-MAP.md) §22                                                     |

**SOLE EXECUTION ENTRY** — Phase 8 only from this file + `subphases/*.md` + [`BOOT-MANIFEST.yaml`](appendices/BOOT-MANIFEST.yaml) + **§5 ERIP** for implementation subphases.
