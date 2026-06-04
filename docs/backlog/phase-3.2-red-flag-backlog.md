# Phase 3.2 — Primary Backlog (Red Flags)

**Status:** P0/P1 tracks closed (R0–R3) — gate refresh + Playwright waiver before MAP «Locked»  
**Source of truth:** [`audit-red-flags-phase-3.md`](../../audit-red-flags-phase-3.md)  
**Stance:** Scaffold Theater → **honest scaffold** with blocking security and one real vertical slice (web → API)

**Do not claim:** MAP **“Locked / Zero-Debt Verified”** until `pnpm run phase-3:gate` on post-gap SHA + [`final-phase-3-audit-report.md`](../final-phase-3-audit-report.md) PASS + Playwright EC-33-3/4 waived or implemented.

---

## Workflow change

| Stopped | Replaced by |
|---------|-------------|
| Wave A–E (REM-001…) | **Track R0–R5** (below), one PR per track where possible |
| `reports/wave-*-status-report` as planning driver | `reports/r*-status-report-YYYY-MM-DD.md` per track |
| Gate green as definition of done | **Red-flag exit criteria** + existing `phase-3:gate` (must stay green, not sufficient) |

---

## Priority tiers (PO mandate)

| Tier | Red flags | Theme |
|------|-----------|--------|
| **P0** | RF-F09, RF-F05 (+ RF-F06 as cleanup) | Auth hole + dev identity leak |
| **P1** | RF-SCALE-1, RF-SCALE-2, RF-SCALE-3 | Write-path O(N), unbounded heap, full-array filter |
| **P1 product** | RF-F08 | Web–API bridge (vertical slice) |
| **P2** | RF-F01, RF-F02, RF-F03, RF-G01–G04 | Honest naming / real guards |
| **P3** | RF-F04, RF-F07, RF-F10, RF-F11, RF-G05–G09 | Hardening + gate quality |

---

## Remediation order (execute in sequence)

### Track R0 — P0 security (API auth)

**Red flags:** RF-F09

| Step | Work | Exit |
|------|------|------|
| R0.1 | Gate `dev.<base64>` bearer: **only** when `NODE_ENV=development` **and** explicit env `AUTH_ALLOW_DEV_BEARER=true` (mirror API `.env` policy) | Production/test without flag → bearer ignored or 401 |
| R0.2 | Remove bearer precedence over headers in prod; document Phase 4 JWT slot | `tenant-kernel.spec.ts` + new test: prod mode rejects crafted bearer |
| R0.3 | Forensic test: cannot escalate to `admin` via bearer without allow flag | CI blocking |

**Files (primary):** `apps/api/src/tenant-kernel/parse-dev-bearer.ts`, `tenant-kernel.ts`, `.env.example`, `apps/api/test/tenant-security.spec.ts`

**Blocks:** R2 (web must use a single auth contract)

---

### Track R1 — P0 web identity (no module-static “scoped” session)

**Red flags:** RF-F05, RF-F06

| Step | Work | Exit |
|------|------|------|
| R1.1 | Remove module-level `resolveBootstrapAppSession()` from `app-providers.tsx` / `app-session-context.tsx` | No session at import time |
| R1.2 | Resolve session **per request** on server: Next.js `layout` / server component or Route Handler reads cookies/env **once per request** | `tenantId` not hardcoded `dev-tenant-local` in prod build |
| R1.3 | Client providers receive session via props from server wrapper (no `NEXT_PUBLIC_DEV_*` as sole source in production) | Build without dev env → fails closed or explicit “dev shell” banner |
| R1.4 | Collapse RF-F06: delete or narrow `dev-app-session.ts` to test-only; single `AppSession` shape | One identity path in `src/` |

**Files (primary):** `apps/web/src/providers/*`, `apps/web/src/tenant/tenant-kernel.ts`, `apps/web/app/layout.tsx`

**Depends on:** R0 auth contract for forwarded calls (R2)

---

### Track R2 — P1 scale (CanonicalTourService write path)

**Red flags:** RF-SCALE-1, RF-SCALE-2, RF-SCALE-3

| Step | Work | Exit |
|------|------|------|
| R2.1 | **Remove post-write full-table scan:** drop `listCanonicalRecords` from `writeTour` sync path; sync validator runs on `{ written, legacy }` only | `canonical-tour.service.ts:37-38` gone |
| R2.2 | **Index by tenant:** `InMemoryTourRepository` → `Map<tenantId, TourRecord[]>` or id index; `findMany`/`findFirst` O(tenant size) not O(global) | `in-memory-tour.repository.ts:15-16` fixed |
| R2.3 | **Bound scaffold store:** max tours per tenant + max global (env-config); reject with 507/429 when exceeded | RF-SCALE-3 mitigated for single-process demo |
| R2.4 | Micro-bench or unit test: 1k writes does not call O(global) filter | Regression test named `writeTour-no-full-scan` |

**Out of scope for 3.2:** Postgres (Phase 4) — document RF-F01 remains until then.

**Files (primary):** `canonical-tour.service.ts`, `in-memory-tour.repository.ts`, `canonical-sync-validator.ts` (caller contract)

---

### Track R3 — P1 product bridge (Web → API) — RF-F08

See **Bridge Plan** section below. **Depends on:** R0 + R1 (auth + session forwarding).

---

### Track R4 — P2 truth in labeling (stop theater)

**Red flags:** RF-F01, RF-F02, RF-F03, RF-G01, RF-G02, RF-G03, RF-G04

| Step | Work | Exit |
|------|------|------|
| R4.1 | Docs: retract “Zero-Debt Verified”; MAP → “Scaffold — red flag backlog active” | `MIGRATION-MAP.md`, `phase-3-design-system.md` |
| R4.2 | Rename or annotate `LegacyCanonicalAdapter` / sync gate as **stub until Phase 4** | No “legacy redirect” language in code comments |
| R4.3 | API validation: resolve plugin from `pluginId` header/registry (not only starter) | `canonical-validation.ts` |
| R4.4 | Replace grep-only integrity tests with **HTTP** tests hitting `POST/GET /tours` | `integrity-audit-3.2` demoted or supplemented |

---

### Track R5 — P3 hardening (backlog)

RF-F04, RF-F07, RF-F10, RF-F11, RF-G05–G09 — schedule after R3 exit.

---

## Bridge Plan — RF-F08 (Web UI → real API)

**Goal:** `/tours/new` produces a persisted tour via `POST /tours` on `@apps/api`, using the same tenant auth model as R0/R1 — not client-only `PlatformWizardEngine.buildRenderPlan`.

### Architecture (minimal vertical slice)

```
Browser (wizard fields, controlled state)
    ↓ submit
Next.js Server Action OR Route Handler  (/app/tours/new/actions.ts)
    ↓ server-side fetch with forwarded auth
@apps/api POST /tours  (existing ToursService → CanonicalTourService)
    ↓ 201 + { id, tenantId, canonical }
Redirect /tours/[id] or success surface with tour id
```

### Principles

1. **Server-side API calls only** — no browser direct to `:3001` (avoids CORS/token exposure); use `API_INTERNAL_URL` + server-only headers.
2. **Auth parity** — Server Action builds the same header set API expects (`x-authenticated-tenant-id`, `x-tenant-id`, `x-user-id`, …) from R1 server session, **not** `NEXT_PUBLIC_DEV_*` in client bundle.
3. **Canonical payload** — Wizard state → `createCanonicalDocument` / mirror API body shape (`schemaVersion`, `roots`, `data`) → single validation path ideally shared types from `@app-tour/workspace-sdk` (duplicate Zod on web optional for 3.2.1).
4. **Keep platform-core for UX** — `buildRenderPlan` remains for rendering; **persistence** is API-only after submit.
5. **Fail closed** — Submit disabled until session valid; API errors surfaced (403/401/400), not silent.

### Phased delivery (within Track R3)

| Slice | Deliverable | Tests |
|-------|-------------|-------|
| **R3.1** | `createTourServerAction` + env `API_BASE_URL`, `INTERNAL_API_KEY` if needed | Web unit: mock fetch; API integration unchanged |
| **R3.2** | Wire `WorkspaceWizardHost` submit (or dedicated Save on last step) → action | One integration test: web action → real API listener (testcontainers optional; use test HTTP like API suite) |
| **R3.3** | Success UI + link; optional `GET /tours/:id` hydrate | E2E optional (soft); `phase-3:web-gate` extended with “bridge spec” |

### Non-goals (3.2 bridge)

- Full edit wizard / PATCH tours
- Postgres
- OTP login (Phase 4) — use server-injected dev headers only in development with R0 guards

### Doc / gate updates

- Add `P3-E-BRIDGE` enforcement id to `phase-3-guard.mjs`: web package must contain `POST` to tours path in server layer (AST or integration test).
- Update §10 / §13 `phase-3-design-system.mdoc` exit criteria: “web persists via API”.

---

## Suggested PR sequence

1. `Phase: 3.2` **R0** — API dev bearer lockdown  
2. `Phase: 3.2` **R1** — Web per-request session  
3. `Phase: 3.2` **R2** — Write-path scale fixes  
4. `Phase: 3.2` **R3** — Web–API bridge (R3.1 → R3.3)  
5. `Phase: 3.2` **R4** — Docs + guard honesty  

---

## Exit criteria for “Phase 3.2 honest” (replaces false Zero-Debt)

- [x] RF-F09 closed (prod cannot mint tenant via dev bearer) — R0 + R0b JWT verify
- [x] RF-F05 closed (no module-static admin session in production path) — R1 per-request layout
- [x] RF-SCALE-1/2/3 closed (no full scan on write; tenant-scoped index; bounds) — R2
- [x] RF-F08 closed (wizard submit persists via server → API) — R3 TourClient bridge
- [ ] `pnpm run phase-3:gate` still green
- [ ] `audit-red-flags-phase-3.md` P0/P1 rows marked remediated in `reports/phase-3.2-red-flag-status-*.md`

---

*Architect: documentation status Updated. Link: [docs/backlog/phase-3.2-red-flag-backlog.md](phase-3.2-red-flag-backlog.md)*
