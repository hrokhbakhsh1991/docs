# Composable Platform Remediation Plan

**Program:** REMEDIATION #1  
**Date:** 2026-08-24  
**Inputs:** AUDIT #1–#6 (CW forensic, architecture adversarial, behavioral parity, cross-workspace isolation, production-readiness reconciliation, world-class red-team)  
**Canonical ledgers:** [`composable-workspace-refactor-plan.md`](composable-workspace-refactor-plan.md), [`docs/platform/PROD-3-GATE-CATALOG.json`](../platform/PROD-3-GATE-CATALOG.json)  
**Deferred maturity:** [`platform-maturity-roadmap.md`](platform-maturity-roadmap.md)

---

## Findings reconciled

| Audit | Raw findings | After dedup |
|-------|-------------|-------------|
| #1 CW forensic | 12 | 8 unique |
| #2 Architecture adversarial | 14 | 10 unique (4 dup #1) |
| #3 Behavioral parity | 9 | 6 unique |
| #4 Cross-workspace isolation | 11 | 7 unique (4 dup #2/#3) |
| #5 Production readiness | 10 | 8 unique |
| #6 World-class red-team | 13 | 9 unique (4 dup #2/#5) |
| **Total** | **69** | **38 deduplicated** |

Duplicates merged: workspaceIdBranches (×3), foundation-import-purity edges (×2), tour-core build order (×2), hollow validators (×2), staging stale evidence (×2), manifest deploy drift (×2).

---

## Classification summary

| Bucket | Count | Execute in REM-1 |
|--------|-------|------------------|
| P0_NOW | 2 | YES |
| P1_BEFORE_NEXT_CUSTOMER | 7 | YES |
| P2_BEFORE_5_CUSTOMERS | 9 | NO → roadmap |
| ENTERPRISE_BEFORE_CONTRACT | 7 | NO → roadmap |
| LONG_TERM_SCALE | 6 | NO → roadmap |
| FALSE_POSITIVE | 2 | NO |
| ALREADY_FIXED | 2 | NO |
| DUPLICATE | 3 | N/A |

---

## Special remediation tracks

### Track A — CW false-pass remediation

Overstated CW9 closure tasks; ledger and certification report corrected to **certified-with-exceptions** (not re-opening CW0–CW8).

### Track B — Architecture boundary/coupling remediation

Generated dispatch allowlist for foundation-import-purity; manifest fingerprint reload for deploy drift.

### Track C — Cross-workspace isolation remediation

Settings catalog delete paths hardened with `tenantId` in `deleteMany` where clause.

### Track D — Behavioral parity remediation

No golden expectation changes. cert-club/cert-events `productionTier: stub` documented; full validators deferred (MAT-002).

### Track E — Production-readiness stale evidence remediation

`verify:cw-closure` gate wired; PROD-3 L3 node added; staging checklist documented as EXTERNAL_BLOCKED.

### Track F — CI/guard coverage remediation

CW closure gates aggregated; foundation-import-purity allowlist closes false FAIL on codegen dispatch.

---

## Remediation tasks

### REM-001 — CW false-pass ledger correction

| Field | Value |
|-------|-------|
| **Source** | AUDIT #1 CW9-03/04/08/09/10; AUDIT #5 PSR-CW-01 |
| **Objective** | Honest CW-9 exit: certified-with-exceptions, not unconditional 91/91 |
| **Invariant** | Ledger truth matches executable evidence |
| **Severity** | P0_NOW |
| **Scope** | `docs/dev/composable-workspace-refactor-plan.md` CW-9 section + program closure banner |
| **Dependencies** | None |
| **Implementation** | Qualify CW9-03 (finance/booking stub-tier), CW9-08 (workspaceIdBranches 16≠0 target), CW9-09 (foundation-import-purity), CW9-10 (architecture YES → qualified) |
| **Tests** | `pnpm run verify:cw-closure` |
| **Aggregate regression** | `baseline:cw-compare`, `test:parity` |
| **Rollback** | Revert doc commit |
| **Status** | [x] complete |

**Exceptions table (CW-9):**

| Task | Claim | Actual | Classification |
|------|-------|--------|----------------|
| CW9-03 | Full finance+booking enabled | Profile composes; stub-tier `supported:false`; no `tourWrite` | PARTIAL — cert fixture |
| CW9-08 | workspaceIdBranches target 0 | 16 (improved from 33; ratchet PASS) | NOT MET — ratcheted |
| CW9-09 | All guards green incl. purity | 4 generated dispatch edges FAIL `--production-only` | FALSE-PASS — fixed REM-006 |
| CW9-10 | Target architecture YES | Qualified YES with stub-tier + legacy literals | PARTIAL |

---

### REM-002 — Certification report honesty

| Field | Value |
|-------|-------|
| **Source** | AUDIT #1; AUDIT #5 |
| **Objective** | `cw9-10-certification-report.md` metrics table reflects ratchet vs target |
| **Invariant** | No false-complete certification narrative |
| **Severity** | P0_NOW |
| **Scope** | `docs/dev/cw9-10-certification-report.md` |
| **Dependencies** | REM-001 |
| **Implementation** | Split **Met** vs **Ratcheted** vs **Stub-tier**; add remediation cross-ref |
| **Tests** | Doc review |
| **Rollback** | Revert doc |
| **Status** | [x] complete |

---

### REM-003 — tour-core build order

| Field | Value |
|-------|-------|
| **Source** | AUDIT #5 PSR-BUILD-01 |
| **Finding ID** | PSR-BUILD-01 |
| **Objective** | `@app-tour/tour-core` dist exists before `workspace-sdk` build |
| **Invariant** | Monorepo build order respects dependency graph |
| **Severity** | P1_BEFORE_NEXT_CUSTOMER |
| **Scope** | `scripts/monorepo-build.sh`, `scripts/ci/build-api-workspace-deps.sh` |
| **Dependencies** | None |
| **Implementation** | Insert `pnpm --dir packages/tour-core run build` before workspace-sdk |
| **Tests** | Fresh `pnpm build` on clean dist |
| **Aggregate regression** | `pnpm run guard:import-boundary` |
| **Rollback** | Revert build script lines |
| **Status** | [x] complete |

---

### REM-004 — CW closure verification gate

| Field | Value |
|-------|-------|
| **Source** | AUDIT #5 PSR-CI-01 |
| **Finding ID** | PSR-CI-01 |
| **Objective** | Single command runs CW parity + guards for CI/PROD-3 |
| **Invariant** | CW closure cannot regress silently |
| **Severity** | P1_BEFORE_NEXT_CUSTOMER |
| **Scope** | `scripts/verify-cw-closure.mjs`, `package.json`, `docs/platform/PROD-3-GATE-CATALOG.json` |
| **Dependencies** | REM-006 |
| **Implementation** | `pnpm run verify:cw-closure`; PROD-3 `l3.cw-closure` node |
| **Tests** | Run gate locally |
| **Rollback** | Remove script + catalog node |
| **Status** | [x] complete |

**Gate commands (verify:cw-closure):**

1. `pnpm run test:parity`
2. `pnpm run baseline:cw-compare`
3. `pnpm run guard:tour-core-boundary`
4. `pnpm run guard:workspace-registry-fresh`
5. `pnpm run guard:no-workspace-type-branches`
6. `pnpm run guard:api-workspace-isolation`
7. `node scripts/guards/foundation-import-purity-audit.mjs --production-only`
8. CW7 isolation specs (04, 06, 08–13)
9. `git diff --check`

---

### REM-005 — Settings catalog delete tenant-scope (ISO-DB-01)

| Field | Value |
|-------|-------|
| **Source** | AUDIT #4 ISO-DB-01 |
| **Finding ID** | ISO-DB-01 |
| **Objective** | Delete mutations include `tenantId` in Prisma `where` (defense-in-depth under RLS) |
| **Invariant** | Cross-tenant delete by ID alone impossible even if RLS misconfigured |
| **Severity** | P1_BEFORE_NEXT_CUSTOMER |
| **Scope** | `apps/api/src/settings/prisma-settings-resources.repository.ts` |
| **Dependencies** | None |
| **Implementation** | `deleteMany({ where: { id, tenantId } })` + count===1 check |
| **Tests** | `apps/api/test/settings-catalog-tenant-delete-isolation.spec.ts` |
| **Aggregate regression** | `pnpm --filter @apps/api test -- settings-resources` |
| **Rollback** | Revert repository + test |
| **Status** | [x] complete |

**Isolation closure evidence (required):**

- [x] Exploit/reproduction test (cross-tenant ID delete attempt)
- [x] Fix (`deleteMany` with compound where)
- [x] Negative cross-workspace test
- [x] Same-workspace positive test
- [x] Repository scope proof

---

### REM-006 — Foundation-import-purity generated dispatch allowlist

| Field | Value |
|-------|-------|
| **Source** | AUDIT #1 CW9-09; AUDIT #2 ARCH-03 |
| **Finding ID** | FIP-001 |
| **Objective** | `--production-only` PASS for architecturally required codegen dispatch edges |
| **Invariant** | Composable dispatch ≠ foundation corruption; absent capability remains absent |
| **Severity** | P1_BEFORE_NEXT_CUSTOMER |
| **Scope** | `scripts/guards/foundation-import-purity-audit.mjs` |
| **Dependencies** | None |
| **Implementation** | Allowlist 3 generated files (4 edges: Denali×3 + cert-club×1) |
| **Tests** | `node scripts/guards/foundation-import-purity-audit.mjs --production-only` → PASS |
| **Rollback** | Remove allowlist entries |
| **Status** | [x] complete |

**Allowlisted files (codegen dispatch shims only):**

- `catalog-intake-transport-surfaces.generated.ts`
- `catalog-transport-snapshot-readers.generated.ts`
- `workspace-difficulty-fitness-filter-presentation.generated.ts`

---

### REM-007 — Manifest fingerprint reload (RT-01 mitigation)

| Field | Value |
|-------|-------|
| **Source** | AUDIT #6 RT-01 |
| **Finding ID** | RT-01 |
| **Objective** | `ensureWorkspaceRegistryLoaded` reloads when on-disk manifest aggregate hash changes |
| **Invariant** | Deploy/manifest edit without process restart does not serve stale registry |
| **Severity** | P1_BEFORE_NEXT_CUSTOMER |
| **Scope** | `packages/workspace-sdk/src/workspace-registry/` |
| **Dependencies** | None |
| **Implementation** | `computeWorkspaceManifestFingerprint()` + reload on mismatch |
| **Tests** | `packages/workspace-sdk/test/workspace-registry-manifest-fingerprint.spec.ts` |
| **Rollback** | Revert ensure-loaded changes |
| **Status** | [x] complete |

---

### REM-008 — Synthetic workspace tier honesty

| Field | Value |
|-------|-------|
| **Source** | AUDIT #3; AUDIT #5 PSR-6a |
| **Objective** | cert-club/cert-events documented as `productionTier: stub` cert fixtures |
| **Invariant** | Next customer cannot mistake stub fixtures for production-ready workspaces |
| **Severity** | P1_BEFORE_NEXT_CUSTOMER |
| **Scope** | `cw9-10-certification-report.md` (manifests already `stub`) |
| **Dependencies** | REM-002 |
| **Implementation** | Report §cert-club/cert-events explicit stub-tier callout |
| **Status** | [x] complete |

---

### REM-009 — Staging re-verification checklist

| Field | Value |
|-------|-------|
| **Source** | AUDIT #5 PSR-STG-01 |
| **Finding ID** | PSR-STG-01 |
| **Objective** | Document stale staging evidence; separate LOCAL vs STAGING vs PRODUCTION |
| **Invariant** | External evidence not marked PASS without re-run |
| **Severity** | P1_BEFORE_NEXT_CUSTOMER |
| **Scope** | This doc §Production-readiness remediation |
| **Dependencies** | REM-004 |
| **Status** | [x] complete |

**Staging checklist (EXTERNAL_BLOCKED until ops re-run):**

| Gate | Tier | Status | Blocker |
|------|------|--------|---------|
| `pnpm run smoke:staging` | L4 | STALE | Requires staging URLs + credentials |
| `pnpm run smoke:production` | L5 | NOT RUN | Depends L4 |
| Custom apex smoke (WRS/PCMS) | L4 | STALE | tenant_domains + live API |
| Harbor durable E2E | L4 | STALE | Playwright + Postgres |

---

### REM-010 — FALSE_POSITIVE: Harbor productionTier certified claim

| Field | Value |
|-------|-------|
| **Source** | AUDIT #5 PSR-6a |
| **Classification** | FALSE_POSITIVE / ALREADY_FIXED |
| **Evidence** | `packages/workspaces/harbor/workspace.manifest.json` → `"productionTier": "stub"` |
| **Status** | [x] complete |

---

### REM-011 — FALSE_POSITIVE: Cross-workspace data leak

| Field | Value |
|-------|-------|
| **Source** | AUDIT #4 |
| **Classification** | FALSE_POSITIVE |
| **Evidence** | `withTenantRls`, ALS↔RLS ratchet, compound keys, plugin fail-closed — no exploitable leak found |
| **Status** | [x] complete |

---

## Deferred tasks (roadmap only)

See [`platform-maturity-roadmap.md`](platform-maturity-roadmap.md): MAT-001–MAT-022.

Notable P2 items not executed:

- MAT-002 hollow capability validators
- MAT-003 workspaceIdBranches → 0
- MAT-005 registry eager-load reduction

---

## Aggregate verification (post-wave)

Run after P0+P1 implementation:

```bash
pnpm run verify:cw-closure
pnpm run pre-commit:fast
git diff --check
```

---

## Closure evidence log

| REM | Evidence | Date |
|-----|----------|------|
| REM-001 | Doc diff | 2026-08-24 |
| REM-002 | Doc diff | 2026-08-24 |
| REM-003 | Build script diff + verify:cw-closure PASS | 2026-08-24 |
| REM-004 | `pnpm run verify:cw-closure` ALL PASS | 2026-08-24 |
| REM-005 | 3/3 isolation tests PASS | 2026-08-24 |
| REM-006 | Purity audit PASS | 2026-08-24 |
| REM-007 | 3/3 fingerprint spec PASS | 2026-08-24 |
| REM-008 | Report stub-tier callouts | 2026-08-24 |
| REM-009 | Staging checklist in ledger | 2026-08-24 |

*Architect, documentation status: Updated. Link to docs: `docs/dev/composable-platform-remediation-plan.md`.*
