# Production Closure Ledger

**Program:** Production Closure Coordinator — close current platform state before new work  
**Updated:** 2026-08-24  
**Branch under closure:** `cursor/loop-4-enterprise-certification-02a5` (includes LOOP #3 remediation)  
**Canonical gates:** [`docs/platform/PROD-3-GATE-CATALOG.json`](../platform/PROD-3-GATE-CATALOG.json)

Status keys: `[x]` COMPLETE · `[v]` IMPLEMENTED / EXTERNAL VERIFICATION PENDING · `[!]` BLOCKED_EXTERNAL · `[ ]` NOT STARTED · `FAIL`

---

## Stage 1 — Merge pending closure PRs

| Item | Status | Evidence |
|------|--------|----------|
| PR #100 (LOOP #3 remediation) | **FAIL** — merge stopped | `mergeStateStatus: UNSTABLE`; CI install failed `ERR_PNPM_OUTDATED_LOCKFILE` (guest-workspace-runtime vs lockfile) |
| PR #101 (LOOP #4 docs) | **FAIL** — merge stopped | Same CI blocker; depends on #100 ancestry |
| Lockfile sync fix | `[x]` | `pnpm install` — lockfile updated 2026-08-24; `pnpm install --frozen-lockfile` PASS locally |
| Post-fix CI re-run | `[v]` | Push required; GHA must re-execute |

**Merge policy:** Do not merge until CI install + mandatory gates green or explicitly waived by Architect.

---

## Stage 2 — Database readiness

| Item | Status | Evidence |
|------|--------|----------|
| `DATABASE_URL` available | `[!]` | UNSET in closure agent environment |
| Connectivity check | `[!]` | BLOCKED_EXTERNAL |
| `phase-4:guard` | **FAIL** (expected without DB) | `p4_rls_integration_tests` — `DATABASE_URL unset` |
| RLS / tenant isolation DB proofs | `[!]` | BLOCKED_EXTERNAL |
| Migration head preflight | `[x]` | `guard-migration-head-preflight: PASS` |
| Connection pool checks | `[!]` | BLOCKED_EXTERNAL |

---

## Stage 3 — Release verify (L3)

| Item | Status | Evidence |
|------|--------|----------|
| `release:verify` full L3 | `[!]` | Requires `l2.integration` + `l3.postgres` (DATABASE_URL) |
| Local non-DB L3 nodes | `[x]` | `verify:cw-closure` 16/16; `l3.package` PASS (LOOP #3) |
| `pnpm test` | `[x]` | 1795/1795 PASS on closure branch (LOOP #3) |

---

## Stage 4 — Migration deploy

| Item | Status | Evidence |
|------|--------|----------|
| `db:migrate:deploy` | `[!]` | BLOCKED_EXTERNAL — no target DATABASE_URL |
| Target DB class | — | Not authorized in agent env |
| Pre-migration backup | `[!]` | BLOCKED_EXTERNAL |

---

## Stage 5 — Staging smoke

| Item | Status | Evidence |
|------|--------|----------|
| `STAGING_BASE_URL` | `[!]` | UNSET |
| `pnpm run smoke:staging` | `[!]` | SKIP — `.artifacts/gates/staging-smoke.json` |
| Real staging hosts | `[!]` | BLOCKED_EXTERNAL |

---

## Stage 6 — Backup / restore

| Item | Status | Evidence |
|------|--------|----------|
| Backup mechanism | `[v]` | `.github/workflows/restore-drill-monthly.yml` exists |
| Backup drill evidence | `[!]` | BLOCKED_EXTERNAL — provider/ops access required |
| Restore drill | `[!]` | BLOCKED_EXTERNAL |
| RPO/RTO measured evidence | `[!]` | BLOCKED_EXTERNAL |

---

## Stage 7 — Production read-only smoke

| Item | Status | Evidence |
|------|--------|----------|
| `PRODUCTION_BASE_URL` | `[!]` | UNSET |
| `pnpm run smoke:production` | `[!]` | SKIP — `.artifacts/gates/production-smoke.json` |
| Read-only prod verification | `[!]` | BLOCKED_EXTERNAL |

---

## Stage 8 — SBOM / provenance / attestation

| Item | Status | Classification |
|------|--------|----------------|
| SBOM generated | `[x]` | PASS — PSR-7c CDX 1.5 |
| Checksums | `[x]` | PASS — `prod6-release-evidence.json` lockfile/package/sbom sha256 |
| Provenance metadata | `[v]` | IMPLEMENTED_NOT_EXTERNALLY_ATTESTED — local checksum only |
| Signed attestation | `[!]` | BLOCKED_EXTERNAL — policy + clean worktree required |
| Same-artifact digest | `[v]` | Dirty worktree blocks clean RC attestation |

---

## Stage 9 — Denali existing flow (certified coverage, not new features)

| Flow | Status | Evidence |
|------|--------|----------|
| Create Tour / wizard | `[x]` | Denali workspace tests; web smoke specs; cw closure |
| Save / resume | `[x]` | Portal SMK-PTL-07 resume (spec exists); memory driver tests |
| Publish | `[x]` | Canonical validation pipeline; publish visibility codegen |
| Catalog | `[x]` | Marketing/catalog registration tests |
| Registration | `[x]` | `catalog-registration-dispatch` contract tests |
| Operator approval / waitlist | `[x]` | Booking lifecycle specs |
| Member / portal | `[x]` | Portal entitlement specs |
| Finance linkage | `[x]` | Finance routes + registration wallet credit XOR |

**Product gaps (NOT regressions):** payment deadline after approval, member wallet (DL-15), driver settlement, live weather, ticketing.

---

## Local closure gates (re-run 2026-08-24)

```text
verify:cw-closure          PASS (16/16)
prod6:security-release     PASS
guard-migration-head       PASS
psr-7c-sbom                PASS (provenance=false by policy)
pnpm install --frozen-lockfile  PASS (post lockfile sync)
phase-4:guard              FAIL — DATABASE_URL unset (expected)
smoke:staging              SKIP — STAGING_BASE_URL unset
smoke:production           SKIP — PRODUCTION_BASE_URL unset
```

---

## Completed baseline (do not redo unnecessarily)

- [x] CW architecture certified (LOOP #1)
- [x] Enterprise foundation certified (LOOP #4)
- [x] Local test baseline 1795/1795
- [x] `verify:cw-closure` 16/16
- [x] `prod6:security-release`
- [x] Architecture / isolation guards

---

_Architect, documentation status: Updated. Link to docs: `docs/dev/production-closure-ledger.md`._
