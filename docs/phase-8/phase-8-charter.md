# Phase 8 — Product Parity & Dynamic Core Hardening

```yaml
phase_id: "8"
phase_name: "Product Parity & Dynamic Core Hardening"
epic_driver: "Option A — Product Parity"
hardening_driver: "Option E — Enterprise silo integration (subset)"
adr: "ADR-008 — see appendices/adr-008.md"
prerequisite: pnpm run phase-7:gate
closure: pnpm run phase-8:gate
agent_entry: docs/phase-8/phase-8-agent-router.md
boot_manifest: docs/phase-8/appendices/BOOT-MANIFEST.yaml
implementation_truth: docs/phase-8/audits/IMPLEMENTATION-TRUTH.md
legacy_reference: legacy/apps/web/ · legacy/packages/types/src/tour-form-profile-descriptors.ts
map_authority: docs/MIGRATION-MAP.md
covenant: MAP §12 Zero-Debt Covenant
platform_dod: MAP §22 Definition of Done — کل پلتفرم
```

## North star

Deliver **full legacy Urban product surface** (registrations, public catalog, settings, extended wizard flows) **inside** `@app-tour/workspace-urban` and trunk `apps/*` — **without** any urban-only change to `packages/platform-core`. Phase 8 closes **Product Parity DoD**, not Platform DoD (closed at Phase 7).

> **Agents:** Do not implement from this charter alone. Use [`phase-8-agent-router.md`](phase-8-agent-router.md) (**SOLE ENTRY**) + **§5 ERIP** + [`appendices/BOOT-MANIFEST.yaml`](appendices/BOOT-MANIFEST.yaml) + subphase specs under `subphases/`.

---

## Objective

Phase 8 migrates the **legacy Urban web product** into the trunk plugin architecture established by Phases 6–7:

| Layer                | Phase 8 obligation                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Workspace plugin** | Extend `@app-tour/workspace-urban` — field registry, composites, validation hooks, theme — to cover registrations, catalog, and settings semantics ported from `legacy/` |
| **API**              | Urban-scoped routes and handlers wired through `resolveWorkspacePluginForType("urban")` — no `URBAN_*` constants in generic API layer                                    |
| **Web**              | Urban tenant flows in `@apps/web` — catalog, registration intake, settings panels — via dynamic plugin load (mirror `lazy-denali-plugin` pattern)                        |
| **Tenant kernel**    | **Option E hardening:** production use of `TenantConnectionRouter` silo tier for enterprise urban tenants (extends Phase 7.7)                                            |
| **Platform core**    | **Zero creep** — `packages/platform-core` diff for urban product work must remain empty (R1/R2; genericity baseline from Phase 7.2)                                      |

### Critical distinction (carried from Phase 7)

| Concept       | Legacy                                   | Phase 8 trunk                                                      |
| ------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| `urban_event` | Form profile — strip itinerary/transport | Extended registry policy in **plugin** — not Denali rail           |
| Wizard rail   | urban → Denali rail (**forbidden**)      | Independent `@app-tour/workspace-urban` via generic resolver       |
| Product UI    | `legacy/apps/web/.../urban/` tree        | Ported into plugin + trunk shell — **no runtime `legacy/` import** |

See [`../phase-7/appendices/LEGACY-URBAN-REFERENCE.md`](../phase-7/appendices/LEGACY-URBAN-REFERENCE.md) · [`../phase-7/appendices/URBAN-MINIMAL-SCOPE.md`](../phase-7/appendices/URBAN-MINIMAL-SCOPE.md).

---

## In scope vs out of scope

| In scope (Phase 8)                                                       | Out of scope (Phase 9+)                                              |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Full legacy Urban web product port (registrations, catalog, settings)    | CDC / data warehouse                                                 |
| Extended urban field registry + golden fixtures                          | WASM third-party sandbox (MAP §9.2)                                  |
| Urban E2E integrity (catalog → register → settings)                      | Database-per-tenant for **all** tenants                              |
| Silo tier **integration** for enterprise urban fixtures                  | AI / chat extensibility layer (MAP §24)                              |
| `phase-8.contract.spec.ts` — product parity without `platform-core` diff | Per-tenant JWT/DB credential vault (deferred from evolution roadmap) |
| Forensic audit ≥ 8 at 8.5                                                | Denali domain expansion beyond Phase 6 closure                       |

---

## Architectural invariants (MAP §12 — FAIL if violated)

```yaml
invariants:
  - id: INV-P8-001
    rule: "No urban-only PRs in packages/platform-core"
    enforcement: phase-8.contract.spec.ts + reports/phase-8-genericity-baseline.yaml
  - id: INV-P8-002
    rule: "No URBAN_* product constants in apps/api generic layer"
    enforcement: guard:import-boundary + phase-8-guard anti-creep checks
  - id: INV-P8-003
    rule: "Urban resolves via WorkspacePlugin registry — not Denali rail"
    enforcement: resolveWorkspacePluginForType('urban') + forbidden urban→denali binding
  - id: INV-P8-004
    rule: "legacy/ is read-only reference — no runtime import from legacy in trunk apps"
    enforcement: RULE-P7-007 carryover · rg guard in 8.0 entry
  - id: INV-P8-005
    rule: "Canonical document remains single source of truth — no RHF mirror"
    enforcement: apps/web guards · canonical-sot specs
  - id: INV-P8-006
    rule: "Silo routing via TenantConnectionRouter in tenant-kernel — not ad-hoc DATABASE_URL in handlers"
    enforcement: 8.3 contract tests · TENANT-ROUTER-SPEC
  - id: INV-P8-007
    rule: "Urban settings/catalog admin mutations — Workspace Owner login only (Single-Owner)"
    enforcement: urban-owner-ability · urban-owner-access specs · URBAN-ROUTE-MATRIX
```

---

## Subphase DAG (8.0 → 8.5)

```text
8.0  Entry (phase-7:gate + Platform DoD §22)
  ↓
8.1  Single-Owner auth (CASL · Owner-only settings/catalog admin)
  ↓
8.2  Urban product feature port (plugin + catalog · register · settings)
  ↓
  ├── 8.3  Silo tier integration (TenantConnectionRouter production)  ─┐
  └── 8.4  E2E integrity (catalog → register → owner settings)           ─┤ parallel after 8.2
       ↓                                                                  │
8.5  Phase 8 Product Parity gate + forensic                              ←┘
```

| Subphase | Spec                                                                       | Milestone          | Exit signal                         |
| -------- | -------------------------------------------------------------------------- | ------------------ | ----------------------------------- |
| **8.0**  | [`subphases/8.0-entry.md`](subphases/8.0-entry.md)                         | Entry gate         | `phase-7:gate` exit 0 · entry yaml  |
| **8.1**  | [`subphases/8.1-single-owner-auth.md`](subphases/8.1-single-owner-auth.md) | Single-Owner CASL  | Owner/member spec matrix PASS       |
| **8.2**  | [`subphases/8.2-urban-features.md`](subphases/8.2-urban-features.md)       | Product port       | Urban build + catalog/register HTTP |
| **8.3**  | [`subphases/8.3-silo-tier.md`](subphases/8.3-silo-tier.md)                 | Silo hardening     | Router + silo fixture tests         |
| **8.4**  | [`subphases/8.4-e2e-integrity.md`](subphases/8.4-e2e-integrity.md)         | E2E smoke          | SMK-P8-01..04 PASS                  |
| **8.5**  | [`subphases/8.5-platform-dod.md`](subphases/8.5-platform-dod.md)           | Product Parity DoD | `phase-8:gate` · forensic ≥ 8       |

### Transition guards (summary)

| Guard     | Rule                                                              |
| --------- | ----------------------------------------------------------------- |
| TG-P8-001 | 8.1 blocked until 8.0 `phase_7_gate` PASS in entry yaml           |
| TG-P8-002 | 8.2 blocked until 8.1 `VERIFIED_BEHAVIORAL`                       |
| TG-P8-003 | 8.3 and 8.4 start only after 8.2 `VERIFIED_BEHAVIORAL` (parallel) |
| TG-P8-004 | 8.5 blocked until 8.1–8.4 all `VERIFIED_BEHAVIORAL`               |

Full machine rules: [`appendices/BOOT-MANIFEST.yaml`](appendices/BOOT-MANIFEST.yaml).

---

## Impacted architectural layers

| Path                          | Phase 8 role                                                       |
| ----------------------------- | ------------------------------------------------------------------ |
| `packages/workspaces/urban/`  | **Primary** — registry, composites, validation, theme extensions   |
| `apps/web/`                   | Urban catalog, registration, settings UI; lazy urban plugin loader |
| `apps/api/`                   | Urban-scoped HTTP surface; plugin validation on persist            |
| `packages/tenant-kernel/`     | Silo tier production wiring (8.3)                                  |
| `packages/workspace-sdk/`     | Contract only — no urban product logic                             |
| `packages/platform-core/`     | **Forbidden** — zero urban diff (INV-P8-001)                       |
| `packages/workspaces/denali/` | Reference pattern only — no urban rail                             |
| `legacy/`                     | Read-only port source                                              |

---

## Technical Quality & Performance Benchmarks

**Authority:** MAP §12 R3 (Complexity Bound) · R4 (Fail-Closed Identity) · R5 (Lessons Learned) · router **§5 ERIP**.  
**Binding rule:** Phase 8 code MUST meet these benchmarks **in addition to** behavioral proof. Innovation is encouraged **only** when ERIP COP demonstrates compliance with INV-P8-\* — no exception for "modern stack" refactors that creep platform-core or duplicate trunk primitives.

### Research gate (ERIP — mandatory before implementation)

| Rule                   | Requirement                                                                                                                                                                                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ERIP**               | **Every** subphase **8.1–8.5** requires active research before code. **8.1–8.3** require a full, human-approved **Creativity & Optimization Proposal** per [`phase-8-agent-router.md` §5](phase-8-agent-router.md#5-enterprise-research--innovation-protocol-erip) before merge; **8.4–8.5** require a lighter COP (test/gate focus). |
| **No boilerplate**     | Empty handlers, uncited `TODO` ports, or legacy copy-paste without COP → anti-hollow **FAIL** (R5).                                                                                                                                                                                                                                   |
| **Bounded innovation** | External patterns (Next.js 15, Prisma 6, hardened sessions) are **adapted** into plugin + trunk boundaries — never replace microkernel contracts.                                                                                                                                                                                     |

### TQ-P8-* cleanliness benchmarks

_Enforced at 8.5 closure._

| ID            | Benchmark                                                                                                                                                                                                                                    | Verification                                                |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **TQ-P8-001** | **Zero unnecessary barrel imports** — `@app-tour/ui-primitives` subpath-only; no `index.ts` re-export chains in new urban surfaces                                                                                                           | `pnpm run guard:artifact-surface` · `guard:import-boundary` |
| **TQ-P8-002** | **Single static urban import** — `lazy-urban-plugin.ts` is the only compile-time `@app-tour/workspace-urban` entry from `apps/web`                                                                                                           | import-boundary spec · mirror denali lazy loader            |
| **TQ-P8-003** | **Strict memory boundaries** — no unbounded in-process caches on catalog/registration hot paths; Redis rate limits for public routes (MAP §10 carryover)                                                                                     | code review + load-test note in COP                         |
| **TQ-P8-004** | **Node 24 native efficiencies** — `engines.node` ≥ 24; prefer native `fetch`, `AbortSignal`, `structuredClone`, and built-in test runner where trunk already does; no polyfill bundles for Node-only API paths                               | `check:node-engine` · no new `node-fetch`                   |
| **TQ-P8-005** | **Prisma 6 query discipline** — indexed filters on tenant-scoped list paths; `select`/`include` minimal; no N+1 in catalog/register handlers; connection pool tier uses shared client factory — silo tier uses `TenantConnectionRouter` only | EXPLAIN in COP · integration specs                          |
| **TQ-P8-006** | **Optimized transactional outbox** — urban mutations that emit domain events MUST reuse Phase 5 `outbox` + idempotency patterns; **no** duplicate outbox tables or ad-hoc `setImmediate` publish in urban routes                             | existing outbox specs · no new `outbox_*` DDL in 8.x        |
| **TQ-P8-007** | **Type-safe HTTP ingress** — Zod (or equivalent) at urban route boundaries; strict TS `noImplicitAny`; plugin validation before persist                                                                                                      | typecheck + route contract specs                            |
| **TQ-P8-008** | **Next.js 15 App Router hygiene** — tenant shell `force-dynamic` where ALS/session required; RSC boundaries documented in COP; dynamic plugin import does not pull server-only modules into client bundles                                   | build analyze note · e2e smoke                              |
| **TQ-P8-009** | **Fail-closed auth latency** — CASL `ability.can` before handler body on owner routes; **403** not redirect loops; public routes throttled                                                                                                   | urban-owner-access specs                                    |
| **TQ-P8-010** | **Big-O attestation (R3)** — catalog list, registration lookup, silo route resolution each document **O(1)** or **O(log N)** with index proof                                                                                                | COP table + named spec                                      |

### Performance targets (Product Parity — not micro-benchmark theater)

| Surface                      | Target                                                                | Notes                  |
| ---------------------------- | --------------------------------------------------------------------- | ---------------------- |
| Urban plugin cold load (web) | ≤ 1 dynamic `import()` boundary                                       | ERIP 8.2 COP           |
| Catalog list (pooled tenant) | Indexed `tenant_id` + sort key; paginated                             | TQ-P8-005 · TQ-P8-010  |
| Registration write           | Single transaction: validate → persist → outbox enqueue               | TQ-P8-006              |
| Silo connection resolve      | Router cache with documented TTL; no per-request `new PrismaClient()` | TQ-P8-003 · INV-P8-006 |
| Owner settings mutation      | One CASL check + one persist round-trip                               | TQ-P8-009              |

---

## Definition of Done — `phase-8:gate`

Phase 8 closure is **Product Parity DoD**. The gate must satisfy MAP §12 (R1–R5) and extend the nested chain from Phase 7.

### Proposed `package.json` script (wiring deferred to implementation PR)

```bash
pnpm run phase-8:gate
# expands to:
#   pnpm build
#   && pnpm test
#   && pnpm run phase-7:gate
#   && pnpm run phase-8:guard
```

### `phase-8:guard` required checks (specification — script scaffold follow-up)

| Check ID                      | Required | Verification                                                                           |
| ----------------------------- | -------- | -------------------------------------------------------------------------------------- |
| `p8_boot_manifest`            | yes      | `docs/phase-8/appendices/BOOT-MANIFEST.yaml` exists                                    |
| `p8_doc_hardening`            | yes      | Phase 8 doc pack score ≥ 96 (PEK target)                                               |
| `p8_truth_honesty`            | yes      | `IMPLEMENTATION-TRUTH.md` documents all subphases 8.0–8.5                              |
| `p8_anti_hollow`              | yes      | No doc-only closure for 8.1 product surface                                            |
| `p8_platform_core_zero_diff`  | yes      | `phase-8.contract.spec.ts` — urban product work without `platform-core` diff           |
| `p8_no_legacy_runtime_import` | yes      | `rg "from ['\"]legacy/" apps/api apps/web` → no matches                                |
| `p8_urban_not_denali_rail`    | yes      | No `urban` → `denali` workspace type binding                                           |
| `p8_erip_cop_present`         | yes      | COP artifacts or PR approval for 8.1–8.3 in `docs/phase-8/appendices/erip/` or PR body |
| `p8_technical_quality`        | yes      | TQ-P8-001..010 attested in 8.5 closure checklist                                       |

### Behavioral proof (8.5 — mandatory, not guard-only)

| Proof                   | Command / artifact                                        | Pass criteria               |
| ----------------------- | --------------------------------------------------------- | --------------------------- |
| Nested platform closure | `pnpm run phase-7:gate`                                   | exit 0 (included in 8:gate) |
| Product contract        | `phase-8.contract.spec.ts`                                | exit 0                      |
| Urban package           | `pnpm --filter @app-tour/workspace-urban test`            | exit 0                      |
| E2E integrity           | `pnpm --filter @apps/web run test:e2e:urban` (when wired) | exit 0                      |
| Silo integration        | `pnpm --filter @app-tour/tenant-kernel test` silo specs   | exit 0                      |
| Forensic                | `FORENSIC-RUBRIC` weighted sum                            | ≥ 8.0                       |
| CI integrity            | `pnpm run ci:integrity`                                   | exit 0 (re-run at 8.5)      |
| Entry ledger            | `reports/phase-8-entry-verified.yaml`                     | `phase_7_gate: PASS`        |
| Closure report          | `reports/phase-8-gate-YYYY-MM-DD.json`                    | `ok: true`                  |

### Gate Compliance Checklist (MAP §12 — mandatory before Phase 8 closure)

- [ ] **Contractual Gate (R1):** `phase-8.contract.spec.ts` proves product parity paths without grep-only checks.
- [ ] **Verification-as-Code (R2):** Every claim in subphase docs maps to named spec or guard.
- [ ] **Data Integrity:** Adversarial re-run on Postgres/RLS for urban registration and catalog paths.
- [ ] **Complexity Bound (R3):** Big-O attestation for new list/query paths (catalog, registrations) — **TQ-P8-010**.
- [ ] **Fail-Closed Identity (R4):** Public registration throttled; tenant-scoped mutations require CASL + RLS — **TQ-P8-009**.
- [ ] **Lessons Learned (R5):** No scaffold theater — HTTP/runtime proof for 8.1+ product surface; ERIP COP approved for 8.1–8.3.
- [ ] **ERIP (router §5):** Creativity & Optimization Proposals on file; no boilerplate without dated research citations.
- [ ] **Cleanliness (TQ-P8-001..002):** Zero barrel imports; single lazy urban plugin import path.
- [ ] **Memory & runtime (TQ-P8-003..004):** Bounded caches; Node 24 engine compliance.
- [ ] **Data layer (TQ-P8-005..006):** Prisma indexed hot paths; outbox reuse — no duplicate event pipeline.
- [ ] **Web perf (TQ-P8-008):** Next.js 15 boundaries documented; no server-only leakage to client bundles.

---

## Handoff from Phase 7

| Phase 7 delivers                                 | Phase 8 consumes                                           |
| ------------------------------------------------ | ---------------------------------------------------------- |
| `@app-tour/workspace-urban` minimal shell        | Extended registry + product composites                     |
| `resolveWorkspacePluginForType("urban")` bound   | Catalog/registration API routes                            |
| Genericity baseline (`phase-7.contract.spec.ts`) | `phase-8-genericity-baseline.yaml` continuation            |
| `TenantConnectionRouter` implemented (7.7)       | Enterprise silo fixtures (8.3)                             |
| MAP §10 observability + Redis rate limits        | E2E under production-like limits (8.4)                     |
| Platform DoD (§22)                               | **Prerequisite only** — Phase 8 does not re-close platform |

See [`appendices/phase-7-bridge.md`](appendices/phase-7-bridge.md).

---

## Research & legacy references

| Document                                                                                                     | Role                                                           |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| [`phase-8-agent-router.md` §5 ERIP](phase-8-agent-router.md#5-enterprise-research--innovation-protocol-erip) | **Mandatory** research + COP before 8.1–8.3 implementation     |
| [`appendices/erip/`](appendices/erip/)                                                                       | Archived Creativity & Optimization Proposals — 8.1 COP on disk |
| [`../phase-7/appendices/LEGACY-URBAN-REFERENCE.md`](../phase-7/appendices/LEGACY-URBAN-REFERENCE.md)         | Profile vs plugin; anti-rail                                   |
| [`../phase-7/appendices/URBAN-MINIMAL-SCOPE.md`](../phase-7/appendices/URBAN-MINIMAL-SCOPE.md)               | Phase 7 minimal baseline — 8.2 extends                         |
| [`../MIGRATION-MAP.md`](../MIGRATION-MAP.md) §12 · §22                                                       | Zero-Debt Covenant · Platform DoD                              |
| [`../appendices/PLATFORM-CONTINUITY-0-7.md`](../appendices/PLATFORM-CONTINUITY-0-7.md)                       | Upstream continuity                                            |

---

## Documentation score (doc pack target)

| Metric                | Target  | Guard (when wired)                         |
| --------------------- | ------- | ------------------------------------------ |
| Doc execution system  | **≥96** | `pnpm run phase-8:guard`                   |
| Critical spec quality | **≥96** | subphase `completion_proof` + Primary spec |

**Do not claim Product Parity DoD from documentation guard alone** — 8.5 requires behavioral proof per MAP §12.
