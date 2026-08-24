# LOOP #3 — Production Readiness Reconciliation

**Date:** 2026-08-24  
**Assumption:** CW architecture certified (LOOP #1).  
**Canonical gates:** [`docs/platform/PROD-3-GATE-CATALOG.json`](../platform/PROD-3-GATE-CATALOG.json), [`docs/platform/PROD-3-GATE-MODEL.md`](../platform/PROD-3-GATE-MODEL.md), [`docs/security/prod6-security-operations.md`](../security/prod6-security-operations.md)

---

## PROD program map (PROD-0..PROD-9)

| Phase | Scope | Evidence source | LOOP #3 status |
| ----- | ----- | --------------- | -------------- |
| **PROD-0** | Inventory / script catalog | `scripts/ops/psr-0a-inventory.mjs`, `PROD-3-INVENTORY.json` | **STILL_VALID** — regenerate via `pnpm run gate:inventory` |
| **PROD-1** | Command front doors | `docs/platform/ROOT_COMMAND_FRONT_DOORS.mdoc`, PSR-3a | **STILL_VALID** |
| **PROD-2** | CI reuse / boundaries | PSR-3b, `guard:import-boundary` | **STILL_VALID** |
| **PROD-3** | Release gate catalog L0–L5 | `release:verify`, `.github/workflows/prod-3-release-gate.yml` | **RETEST_REQUIRED** → L0–L2 + L3 (non-DB) green post-remediation |
| **PROD-4** | Workspace admission / configure neutrality | harbor/alpine/cert fixtures, PSR-4b | **STILL_VALID** (post-CW export aliases LOOP #1) |
| **PROD-5** | Data authority / admin ports | PSR-5* smokes | **STILL_VALID** |
| **PROD-6** | Security release | `prod6:security-release`, `.github/workflows/prod-6-security-release.yml` | **RETEST_REQUIRED** → **PASS** after static-security fix |
| **PROD-7** | Secret scan / SBOM / branch protection | PSR-7a–7g | **STILL_VALID** (SBOM tooling present; provenance incomplete by policy) |
| **PROD-8** | Legacy boundary ratchet | PSR-8a–8c | **STILL_VALID** |
| **PROD-9** | Closure scorecard (measure-only) | `psr-9-closure-scorecard-collect.mjs` | **STILL_VALID** — does not claim program closed |

---

## Post-CW build inclusion

| Component | In monorepo build | In generated registry | Verified |
| --------- | ----------------- | ------------------- | -------- |
| tour-core | yes (before workspace-sdk) | N/A | `pnpm build` PASS |
| capability modules | yes (CW7 codegen bindings) | `generate:workspace-registry` | `verify:cw-closure` PASS |
| profile / codegen | cert-club, profile-cert, policy-cert | manifest rows | build PASS |
| workspacePolicy | policy validators generated | API bindings | `guard:validation-pipeline` PASS |
| workspace registries | 17 manifests → 102 outputs | `--check` in verify:cw-closure | PASS |

---

## Evidence classification (prior PASS → LOOP #3)

| Evidence | Prior | LOOP #3 |
| -------- | ----- | ------- |
| `verify:cw-closure` | PASS (REM-004) | **STILL_VALID** — 16/16 |
| `pnpm build` / `monorepo-build.sh` | FAIL on main pre-LOOP1 | **STILL_VALID** — PASS post-LOOP1 |
| `prod6:security-release` | FAIL (static-security self-match) | **RETEST_REQUIRED** → PASS |
| `product-neutral-core` contract | FAIL (codegen shim path) | **INVALIDATED** → fixed |
| Urban REQ-P7-007 digest | STALE (103-file baseline) | **STALE** → digest refreshed 105 files |
| `l3.postgres` / `l3.migration` | NOT RUN locally | **BLOCKED_EXTERNAL** (needs DATABASE_URL + staging DB) |
| `l4.staging-smoke` / `l5.production-smoke` | STALE / NOT RUN | **BLOCKED_EXTERNAL** (no staging/prod URLs in agent env) |
| SBOM CDX generator | PASS (PSR-7c) | **STILL_VALID** |
| Provenance attestations | incomplete by policy | **BLOCKED_EXTERNAL** (forbid_provenance_attest_claim) |
| Migration head preflight | PASS | **STILL_VALID** — no CW prisma migrations |

---

## LOOP #3 remediation log

| ID | Severity | Fix |
| -- | -------- | --- |
| LOOP3-001 | P0 | `prod6-static-security` self-match + secret-scan log allowlist |
| LOOP3-002 | P1 | `product-neutral-core` allowlist for codegen dispatch `.d.ts` shim |
| LOOP3-003 | P1 | Remove duplicate `package.json` script keys (`guard:workspace-policy-no-core-branching`, `lint-staged`) |
| LOOP3-004 | P1 | Refresh `platform_core_tree_digest` (103→105 files) in phase-7/8 baselines |
| LOOP3-005 | P1 | `schema-version-policy` test — alpine now registered; use `zz-unknown-workspace` |
| LOOP3-006 | P1 | BK-B1.2 — route repo lifecycle imports via `booking-status-transitions.ts` facade |
| LOOP3-007 | P1 | API `package-boundary` — add CW workspace deps + `tour-core` |
| LOOP3-008 | P1 | `canonical-integrity` — allowlist tour-list projection dispatch codegen |
| LOOP3-009 | P1 | `catalog-ref-integrity` VAL-03e — assert via validation pipeline module |
| LOOP3-010 | P1 | Web thin-shell bootstrap inventory — CW7 capability codegen files |

---

## External blockers (not faked)

- Staging smoke (`pnpm run smoke:staging`) — requires live staging hosts + credentials
- Production smoke (`pnpm run smoke:production`) — requires production hosts
- `l3.postgres` (`phase-5:runtime-proof`) — requires Postgres `DATABASE_URL`
- `l3.migration` (`db:migrate:deploy`) — requires target database
- VPS TLS edge templates / four-process HTTPS smoke (P10) — ops infrastructure
- SSH `StrictHostKeyChecking=no` in staging probe scripts — **documented debt**; prod6 checker allowlists checker self only; staging scripts remain BLOCKED_EXTERNAL for strict SSH policy

---

## Re-certification bundle (local/CI)

```bash
pnpm run verify:cw-closure          # CW + guards
pnpm run prod6:security-release     # security
pnpm run guard:artifact-surface     # package surface
node scripts/ops/run-gate-catalog.mjs --tier=L2   # build + integration
node apps/api/scripts/guard-migration-head-preflight.mjs
node scripts/ops/psr-7c-sbom-provenance-smoke.mjs
```

---

_Architect, documentation status: Updated. Link to docs: `docs/dev/loop-3-production-readiness.md`._
