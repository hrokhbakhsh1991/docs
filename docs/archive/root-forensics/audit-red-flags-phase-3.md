# Worst-Case Forensic Audit — Phase 3 Red Flags

**Date:** 2026-06-03  
**Stance:** Skeptical Product Owner / adversarial reviewer  
**Scope:** `apps/api`, `apps/web`, Phase 3 gates, `CanonicalTourService` path  
**Verdict:** Phase 3 is a **scaffold with compliance theater**, not a production canonical platform. `pnpm run phase-3:gate` exit 0 does **not** disprove the liabilities below.

---

## 1. Facade hunt — “Canonical” / “Scoped” labels that leak legacy or dev logic

### RF-F01 — `CanonicalTourService` name vs. real persistence

| Field | Value |
|-------|--------|
| **Claim** | Single canonical write path; legacy redirected |
| **Reality** | All writes go to a process-global in-memory array; “legacy” sync is a no-op against an always-empty mirror |
| **File:lines** | `apps/api/src/main.ts:12-14` — one `InMemoryTourRepository` for all traffic |
| | `apps/api/src/canonical/canonical-tour.service.ts:28-45` — `writeTour` then `listCanonicalRecords` + `legacyAdapter.listMirroredTours()` |
| | `apps/api/src/canonical/legacy-canonical-adapter.ts:8-12` — `mirror` never populated |
| **Liability** | Marketing “canonical SoT” while data evaporates on restart and never touches Postgres |

### RF-F02 — `LegacyCanonicalAdapter` (legacy in name, zero legacy behavior)

| Field | Value |
|-------|--------|
| **Claim** | Legacy access redirected; dual-write forbidden |
| **Reality** | Class is a stub; `validateCanonicalLegacySync` only passes because `legacyRecords` is always `[]` |
| **File:lines** | `apps/api/src/canonical/legacy-canonical-adapter.ts:7-20` |
| | `apps/api/src/canonical/canonical-sync-validator.ts:9-35` — loop over legacy never runs in prod |
| **Liability** | P3-E-CANONICAL-34 green while legacy integration is unimplemented |

### RF-F03 — API “canonical validation” hard-wired to starter plugin only

| Field | Value |
|-------|--------|
| **Claim** | Workspace-agnostic canonical ingress |
| **Reality** | Every `POST /tours` validates with `starterWorkspacePlugin` regardless of `pluginId` / workspace headers |
| **File:lines** | `apps/api/src/tours/canonical-validation.ts:6-10` — module-level `PlatformWizardEngine.fromPlugin(starterWorkspacePlugin)` |
| | `apps/api/src/tours/tours.service.ts:20` — `buildValidatedCanonicalDocument(body, auth.tenantId)` |
| **Liability** | Denali/other workspaces cannot be validated on API path; facade over “generic platform” |

### RF-F04 — Zod ingress accepts arbitrary document shape before engine

| Field | Value |
|-------|--------|
| **Claim** | Strict API boundary |
| **Reality** | `data: z.record(z.string(), z.unknown())` allows any JSON blob; defaults back-filled in validation |
| **File:lines** | `apps/api/src/tours/create-tour.schema.ts:10-18` |
| | `apps/api/src/tours/canonical-validation.ts:16-22` — default `basics` / `details` if omitted |
| **Liability** | Pre-engine surface is not canonical-safe; abuse payloads reach `PlatformWizardEngine` |

### RF-F05 — Web `TenantKernel` / “scoped” session is module-static dev admin

| Field | Value |
|-------|--------|
| **Claim** | `resolveTenantContextFromRequest` / TenantKernel placeholder |
| **Reality** | Web never calls API tenant kernel; session resolved once at module load from `NEXT_PUBLIC_DEV_*` defaults (`admin` / `ACTIVE`) |
| **File:lines** | `apps/web/src/tenant/tenant-kernel.ts:37-44` — env defaults |
| | `apps/web/src/tenant/tenant-kernel.ts:57-60` — `resolveBootstrapAppSession` |
| | `apps/web/src/providers/app-providers.tsx:11` — `const bootstrap = resolveBootstrapAppSession()` (not per-request) |
| | `apps/web/src/providers/app-session-context.tsx:8-9` — `defaultSession = resolveBootstrapAppSession().session` |
| **Liability** | “Scoped” UI is a single baked-in dev tenant; multi-tenant product demo is illusory |

### RF-F06 — `dev-app-session.ts` still defines parallel dev identity surface

| Field | Value |
|-------|--------|
| **Claim** | TenantKernel replaced ad-hoc session |
| **Reality** | `devScopedAbility`, `DEV_TENANT_ID`, `devAppSession` remain; types still `AppAbility \| ScopedTenantAbility` union |
| **File:lines** | `apps/web/src/session/dev-app-session.ts:10-46` |
| | `apps/web/src/wizard/workspace-wizard-host.tsx:18` — ability union |
| **Liability** | Two identity stories; easy to wire wrong provider in Phase 4 |

### RF-F07 — “Dynamic workspace plugins” are static starter import

| Field | Value |
|-------|--------|
| **Claim** | No static `workspaces/denali`; dynamic loader |
| **Reality** | Registry is `[starterWorkspacePlugin]`; `workspace-plugins.ts` static import from `@app-tour/workspace-starter` |
| **File:lines** | `apps/web/src/bootstrap/workspace-plugins.ts:5-8` |
| | `apps/web/src/bootstrap/workspace-plugin-registry.ts:5-17` |
| | `apps/web/src/wizard/load-workspace-plugin.ts:6-8` — `import()` only defers loading same registry |
| **Liability** | Dynamic import is bundler theater; no host-based plugin resolution |

### RF-F08 — Web wizard is canonical UI without canonical persistence

| Field | Value |
|-------|--------|
| **Claim** | Phase 3 consumer of platform-core + canonical model |
| **Reality** | `/tours/new` renders `PlatformWizardEngine` client-side; **no** `fetch` to `POST /tours` anywhere under `apps/web` |
| **File:lines** | `apps/web/app/tours/new/new-tour-wizard-client.tsx:6-15` |
| | `apps/web/src/wizard/workspace-wizard-host.tsx:56-60` — `buildRenderPlan` only |
| | Grep: zero `3001` / `NEXT_PUBLIC_API` / `/tours` HTTP client in `apps/web` |
| **Liability** | Split brain: API proves storage; web proves widgets — not an integrated product |

### RF-F09 — API `TenantKernel` accepts unsigned `dev.<base64>` bearer

| Field | Value |
|-------|--------|
| **Claim** | Fail-closed auth (Wave B) |
| **Reality** | Anyone can mint `Authorization: Bearer dev.<json>` with arbitrary `tenantId` / `role` |
| **File:lines** | `apps/api/src/tenant-kernel/parse-dev-bearer.ts:30-55` — no HMAC/JWT verify |
| | `apps/api/src/tenant-kernel/tenant-kernel.ts:14-17` — bearer wins before header checks |
| **Liability** | Production deployment with this path = trivial tenant impersonation |

### RF-F10 — `ScopedTourRepository` label vs. coarse CASL scope

| Field | Value |
|-------|--------|
| **Claim** | Repository facade injects accessibleBy-style scope |
| **Reality** | Tour ability is tenant-wide (`can("read", "Tour", { tenantId })`); any tour UUID in tenant is readable if ID known |
| **File:lines** | `apps/api/src/casl/api-ability.ts:29-33` |
| | `apps/api/src/db/scoped-tour.repository.ts:24-26` — `findMany` only filters `tenantId` |
| **Liability** | No workspace- or resource-level ACL on tour rows; “scoped” = tenant string match |

### RF-F11 — Stored tours are not immutability-sealed at rest (API)

| Field | Value |
|-------|--------|
| **Claim** | Canonical ingress integrity |
| **Reality** | `InMemoryTourRepository.create` stores `canonical` object by reference; no freeze in API layer |
| **File:lines** | `apps/api/src/db/in-memory-tour.repository.ts:27-38` |
| **Liability** | In-process mutation after write bypasses validation (SDK freeze may not apply once denormalized to `TourRecord`) |

---

## 2. Gate lie — checks that are “synthetic green”

### RF-G01 — `canonical-integrity.spec.ts` / `integrity-audit-3.2.spec.ts` (static grep, no HTTP SoT)

| Field | Value |
|-------|--------|
| **Passes when** | Source text lacks `prisma`, `legacy/apps/api`, etc. |
| **Does not prove** | Runtime write path, Postgres isolation, or legacy DB disconnected |
| **File:lines** | `apps/api/test/canonical-integrity.spec.ts:29-45` |
| | `apps/api/test/integrity-audit-3.2.spec.ts:29-56` |
| **Liability** | Phase 3.2 “integrity” can be green with wrong runtime architecture |

### RF-G02 — `apps/web/test/canonical-sot.spec.ts` (grep-only legacy ban)

| Field | Value |
|-------|--------|
| **Passes when** | No forbidden substrings in `apps/web/src` |
| **Does not prove** | Web app talks to canonical API or avoids legacy HTTP |
| **File:lines** | `apps/web/test/canonical-sot.spec.ts:25-35` |
| **Liability** | SoT test never exercises SoT |

### RF-G03 — `validate:canonical-sync` CI hook runs two unit specs only

| Field | Value |
|-------|--------|
| **Passes when** | `canonical-sync-validator.spec.ts` + `legacy-canonical-adapter.spec.ts` pass |
| **Does not prove** | Live DB sync, mirror drift, or post-`writeTour` invariants under load |
| **File:lines** | `apps/api/scripts/validate-canonical-sync.mjs:11-14` |
| | `apps/api/src/canonical/canonical-sync-validator.spec.ts:7-19` — empty `legacyRecords` tautology |
| **Liability** | Gate name implies production sync; implementation is unit-test delegation |

### RF-G04 — `guard-no-raw-queries.mjs` (regex on source, bypassable)

| Field | Value |
|-------|--------|
| **Passes when** | No `.findById(` text outside `src/db` |
| **Does not prove** | Handlers cannot reach storage via other identifiers (`inner`, brackets, code generation) |
| **File:lines** | `apps/api/scripts/guard-no-raw-queries.mjs:12-46` — skips `src/canonical/` entirely |
| | `apps/api/src/canonical/canonical-tour.service.ts:54-56` — `listCanonicalRecords` → `findMany` in canonical layer (allowed) |
| **Liability** | P3-E-DB-01 is textual, not behavioral |

### RF-G05 — `phase-3-guard` optional Select/Checkbox always “ok”

| Field | Value |
|-------|--------|
| **Passes when** | `required: false` — missing exports do not fail gate |
| **File:lines** | `scripts/guards/phase-3-guard.mjs:117-131` — `p3_ui_select_checkbox_optional` |
| **Liability** | Documented Phase 3 UI gaps permanently non-blocking |

### RF-G06 — `workspace-starter` SDK parity = reference equality, not behavioral contract

| Field | Value |
|-------|--------|
| **Passes when** | `starterWorkspacePlugin === sdkReferencePlugin` (same re-export) |
| **File:lines** | `packages/workspaces/starter/test/sdk-reference-parity.spec.ts:13-15` |
| | `packages/workspaces/starter/src/starter.plugin.ts:5-8` — re-export only |
| **Liability** | Parity test cannot fail after Wave D wiring; gives false confidence |

### RF-G07 — Cross-tenant / integration tests use in-memory store, not production stack

| Field | Value |
|-------|--------|
| **Passes when** | Fresh `InMemoryTourRepository` per test file via `createTestToursService()` |
| **Does not prove** | Postgres RLS, connection pooling, replication lag, or multi-instance consistency |
| **File:lines** | `apps/api/test/test-helpers.ts:6-9` |
| | `apps/api/test/cross-tenant-forensic.spec.ts:92-95` |
| | `apps/api/test/integration.routes.spec.ts:81-84` |
| **Liability** | Forensic label; environment is toy |

### RF-G08 — `phase-3:gate` nested `phase-2:gate` masks Phase 3 with Phase 2 green

| Field | Value |
|-------|--------|
| **Passes when** | Entire design-system chain + 16 phase-3 guard checks |
| **File:lines** | `package.json:37` — `phase-3:gate` includes `phase-2:gate` |
| **Liability** | Single green badge hides web/API integration gaps (RF-F08) |

### RF-G09 — Test count floors (Wave E) do not assert behavioral coverage

| Field | Value |
|-------|--------|
| **Passes when** | `ℹ tests N` ≥ threshold in guard output |
| **Does not prove** | No grep-only tests; no tautological specs |
| **File:lines** | `scripts/guards/phase-3-guard.mjs:101-114` |
| **Liability** | Quantity enforcement replaces quality enforcement |

---

## 3. Dependency trap — “enterprise” layering vs. spaghetti reality

### RF-D01 — `apps/web` runs `platform-core` in the browser; `apps/api` runs it on server with different plugin binding

| Layer | Path |
|-------|------|
| Web | `apps/web/src/wizard/workspace-wizard-host.tsx:4-5,57-58` |
| API | `apps/api/src/tours/canonical-validation.ts:1-10` |
| **Spaghetti** | Two validation/render pipelines; only API persists; plugin source differs (registry vs hardcoded starter) |

### RF-D02 — `workspace-starter` package depends on `platform-core` but production export is SDK re-export

| Field | Value |
|-------|--------|
| **File:lines** | `packages/workspaces/starter/package.json:24-27` |
| | `packages/workspaces/starter/src/starter.plugin.ts:5-8` |
| **Liability** | Workspace package pretends to be data-only; depends on engine package for tests and depcruise allowance |

### RF-D03 — `apps/web` statically imports `@app-tour/workspace-starter` while depcruise comment says “dynamic”

| Field | Value |
|-------|--------|
| **File:lines** | `apps/web/src/bootstrap/workspace-plugins.ts:6` |
| | `dependency-cruiser.config.js:96-100` — allows `workspaces/starter` only |
| **Liability** | Architecture rules encode starter exception, not generic workspace host |

### RF-D04 — `ui-primitives` devDependency graph bleeds into visual tests (Phase 2 inside Phase 3 gate)

| Field | Value |
|-------|--------|
| **File:lines** | `packages/ui-primitives/package.json` — `@app-tour/theme-react`, `@app-tour/workspace-sdk` devDeps |
| | `phase-3:gate` → `phase-2:gate` → visual regression |
| **Liability** | Phase 3 gate failure modes dominated by design-system package coupling |

### RF-D05 — Depcruise green does not model runtime auth or storage

| Field | Value |
|-------|--------|
| **Evidence** | `pnpm run guard:architecture` — 0 violations (318 modules) |
| **Reality** | No rule forbids in-memory global store, unsigned dev bearer, or module-level web session |
| **Liability** | Graph acyclicity ≠ operational security |

### RF-D06 — `canonical-validation` in API imports `@app-tour/workspace-starter` (workspace → API coupling)

| Field | Value |
|-------|--------|
| **File:lines** | `apps/api/src/tours/canonical-validation.ts:6` |
| | `apps/api/package.json:25` — `"@app-tour/workspace-starter": "workspace:*"` |
| **Liability** | API tier bound to starter workspace package; swapping workspace = API code change |

---

## 4. Scale illusion — `CanonicalTourService` at ~10k requests

**Assumption:** Single Node process as in `apps/api/src/main.ts`, shared `InMemoryTourRepository`, mixed tenants, sustained `POST /tours` (write-heavy). No horizontal scaling, no Postgres.

### 4.1 Exact hot path (per write)

1. `handleCreateTour` → `ToursService.createTour` — `apps/api/src/tours/tours.routes.ts:27-30`
2. `CanonicalTourService.writeTour` — `apps/api/src/canonical/canonical-tour.service.ts:28-35`
   - `scopedRepo.create` → `InMemoryTourRepository.create` — **O(1) append** `apps/api/src/db/in-memory-tour.repository.ts:37`
3. **Post-write full scan:** `listCanonicalRecords` — `canonical-tour.service.ts:37-38`
   - `scopedRepo.findMany` → `records.filter(matchesWhere)` — **O(N)** over **all tours in process** — `in-memory-tour.repository.ts:15-16`
4. `validateCanonicalLegacySync` — `canonical-sync-validator.ts:19-31`
   - Per legacy row: `JSON.stringify(canonical)` × 2 — CPU **O(payload × legacyRows)** (legacy empty today, code path still runs loop structure)

### 4.2 Bottleneck matrix @ 10k concurrent in-flight writes

| Resource | Mechanism | File:lines | @ 10k impact |
|----------|-----------|------------|--------------|
| **Heap / memory** | `private readonly records: TourRecord[]` unbounded growth | `in-memory-tour.repository.ts:13,37` | OOM; full GC scans; no TTL/eviction |
| **Event-loop latency** | Synchronous `Array.prototype.filter` on every write after append | `in-memory-tour.repository.ts:15-16`, `canonical-tour.service.ts:37-38` | p99 latency grows **linearly with total row count**; 10k writes ⇒ later writes scan 10k+ rows each |
| **Amplification factor** | Every `writeTour` calls `findMany` for entire tenant slice (implemented as full-array filter) | `canonical-tour.service.ts:54-56` | Write amplification **W × O(N)** not O(1) |
| **Allocations** | New `ScopedTourRepository` per operation | `canonical-tour.service.ts:31,50,55` | GC pressure under burst (minor vs filter) |
| **JSON.stringify sync** | Validator compares full canonical payloads | `canonical-sync-validator.ts:28-29` | CPU spikes when legacy mirror populated later |
| **Lock contention** | No mutex, but **single-threaded** Node | N/A | “No locks” is **not** scalability — one CPU core serializes 10k `filter` passes |
| **Multi-instance** | In-memory store not shared | `main.ts:12-14` | 10k RPS behind load balancer ⇒ **10 different datasets**; sticky sessions mandatory; data loss on deploy |

### 4.3 Read path under load

`readTourById` → `findFirst` may call `findById` + CASL check — `scoped-tour.repository.ts:28-39` — up to **two linear scans** per GET.

### 4.4 What breaks first at 10k (ordered)

1. **Process memory** — unbounded `records[]` (RF-F01, `in-memory-tour.repository.ts:13`)
2. **Event-loop stall** — post-write `findMany` on growing array (`canonical-tour.service.ts:37-38`)
3. **OOM during sync validation** if legacy mirror ever populated — `JSON.stringify` on large trees (`canonical-sync-validator.ts:28-29`)
4. **Operational collapse on restart** — all canonical data lost (`main.ts:12-14`)

**There is no row-level lock contention** because there are no locks — the bottleneck is **single-process, unbounded, O(N) synchronous scans on every write**.

---

## 5. Master red-flag index (file:line)

| ID | Severity | File:line | One-line liability |
|----|----------|-----------|-------------------|
| RF-F01 | **P0** | `apps/api/src/main.ts:12-14` | Global in-memory SoT |
| RF-F02 | **P0** | `apps/api/src/canonical/legacy-canonical-adapter.ts:8-12` | Legacy sync tautology |
| RF-F03 | **P1** | `apps/api/src/tours/canonical-validation.ts:6-10` | API locked to starter plugin |
| RF-F04 | **P1** | `apps/api/src/tours/create-tour.schema.ts:10-18` | `z.unknown` document ingress |
| RF-F05 | **P0** | `apps/web/src/providers/app-providers.tsx:11` | Module-static dev session |
| RF-F05 | **P0** | `apps/web/src/tenant/tenant-kernel.ts:39-43` | Default admin/ACTIVE from env |
| RF-F06 | **P2** | `apps/web/src/session/dev-app-session.ts:19-46` | Parallel dev identity |
| RF-F07 | **P1** | `apps/web/src/bootstrap/workspace-plugins.ts:6-8` | “Dynamic” = static starter |
| RF-F08 | **P0** | `apps/web/src/wizard/workspace-wizard-host.tsx:56-60` | No API persistence |
| RF-F09 | **P0** | `apps/api/src/tenant-kernel/parse-dev-bearer.ts:30-55` | Unsigned dev bearer |
| RF-F10 | **P1** | `apps/api/src/casl/api-ability.ts:29-33` | Tenant-wide tour ACL |
| RF-F11 | **P2** | `apps/api/src/db/in-memory-tour.repository.ts:31-34` | Unfrozen stored canonical |
| RF-G01 | **P1** | `apps/api/test/integrity-audit-3.2.spec.ts:29-40` | Grep-only integrity |
| RF-G02 | **P1** | `apps/web/test/canonical-sot.spec.ts:25-35` | Grep-only web SoT |
| RF-G03 | **P1** | `apps/api/scripts/validate-canonical-sync.mjs:11-14` | Misnamed CI hook |
| RF-G04 | **P2** | `apps/api/scripts/guard-no-raw-queries.mjs:37-38` | Regex guard skips canonical/ |
| RF-G05 | **P2** | `scripts/guards/phase-3-guard.mjs:124-130` | Optional UI forever |
| RF-G06 | **P2** | `packages/workspaces/starter/test/sdk-reference-parity.spec.ts:14` | Tautological parity |
| RF-G07 | **P1** | `apps/api/test/test-helpers.ts:6-9` | Tests ≠ production store |
| RF-G08 | **P2** | `package.json:37` | phase-3 gate bundles phase-2 |
| RF-SCALE-1 | **P0** | `apps/api/src/canonical/canonical-tour.service.ts:37-38` | O(N) scan every write |
| RF-SCALE-2 | **P0** | `apps/api/src/db/in-memory-tour.repository.ts:15-16` | Full-array filter |
| RF-SCALE-3 | **P0** | `apps/api/src/db/in-memory-tour.repository.ts:13,37` | Unbounded heap |
| RF-SCALE-4 | **P2** | `apps/api/src/canonical/canonical-sync-validator.ts:28-29` | JSON.stringify compare |
| RF-D01 | **P1** | `apps/web/.../workspace-wizard-host.tsx:57` vs `apps/api/.../canonical-validation.ts:10` | Split brain engines |
| RF-D06 | **P1** | `apps/api/src/tours/canonical-validation.ts:6` | API → workspace-starter dep |

---

## 6. Product Owner bottom line

- **Do not ship** this Phase 3 stack to customers expecting canonical tours, multi-tenant security, or 10k RPS on `CanonicalTourService`.
- **Do ship** as an internal scaffold if gates are relabeled “scaffold compliance” and RF-F01, RF-F05, RF-F08, RF-F09, RF-SCALE-* are accepted debt with dates.
- **`pnpm run phase-3:gate` PASS** is necessary but **insufficient**; several blocking checks are grep-based or tautological (RF-G01–G06).

---

*End of audit — red flags only; no remediation applied in this artifact.*
