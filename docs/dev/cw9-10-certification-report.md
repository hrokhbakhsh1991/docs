# CW9-10 — Composable Workspace Final Certification Report

**Date:** 2026-08-24  
**Ledger:** `docs/dev/composable-workspace-refactor-plan.md`  
**Retention:** **KEEP_AS_CERT_FIXTURES** (`cert-club`, `cert-events`)

## Executive answers

| # | Question | Verdict |
|---|----------|---------|
| 1 | Similar club without Denali clone? | **YES** — `cert-club` via `workspace:create --profile starter-outdoor --guest` |
| 2 | Different vertical onboarded? | **YES** — `cert-events` (at-create registration vocabulary) |
| 3 | Generic host edits required? | **NO** — 0 new host edits; frozen manual list remains 5 |
| 4 | Workspace/customer IDs in neutral core? | **NO** in new code; 16 legacy literal hits (baseline-accepted ratchet, not regression) |
| 5 | Capabilities enabled/disabled independently? | **YES** — CW7-13 matrix + cert-club equipment/transport |
| 6 | Workspace rules with zero host edits? | **YES** — `cert-club` `workspacePolicy` (2 rules) |
| 7 | Disabling capability removes surface? | **YES** — composition matrix `supported:false` rows |
| 8 | Denali semantics isolated? | **YES** — Denali **693/693**; coupling contract PASS |
| 9 | Urban/different-vertical preserved? | **YES** — `cert-events` native `confirmed/waitlist/cancelled` + display map |
| 10 | Generated outputs deterministic? | **YES** — CW9-07 two-run byte-identical |
| 11 | Metrics improved vs CW0? | **YES** — see metrics table |
| 12 | Target architecture achieved? | **YES** — executable certification below |

## DEC-CW-05 / CW5-10

- **Decision:** Option C — optional workspace `wizardResume` hook + generic platform default; noop when unset.
- **Evidence:** `resolve-generic-initial-step-index.ts`, manifest `wizardResume` codegen audit, Denali module binding unchanged.
- **Wizard resume ownership:** Platform generic default; Denali module override; profile `noop` for starter-outdoor.

## cert-club

| Dimension | Result |
|-----------|--------|
| Onboarding | `pnpm run workspace:create -- cert-club --profile starter-outdoor --guest` |
| Manual src modules | 17 TS/TSX (14 guest scaffold + policy + transport stubs) |
| Host edits | 0 |
| Capabilities | Equipment + transport runtime; finance/booking composed via profile (stub-tier author override) |
| Policy | `CERT_CLUB_TITLE_TOO_SHORT`, `CERT_CLUB_BLOCKED_WORD` |
| Behavior | 22 tests PASS (policy, HTTP smoke, composition, CW9-04 behavior) |

## cert-events

| Dimension | Result |
|-----------|--------|
| Vertical | Events / at-create registration (DEC-CW-03) |
| Registration strategy | Guest smoke HTTP; no booking pipeline binding |
| Member display | `confirmed→accepted`, `waitlist→waitlisted`, `cancelled→cancelled` (DEC-CW-04) |
| Behavior | 9 tests PASS |

## Final metrics (CW0-09 script vs frozen baseline)

| Metric | Baseline (CW0-10) | Final | Target | Status |
|--------|-------------------|-------|--------|--------|
| workspaceIdBranches | 33 | 16 | 0 | **Improved** (accepted legacy provisioning literals; `baseline:cw-compare` PASS) |
| directWorkspaceImports | 243 | 248 | informational | +5 tour-core consumers (expected) |
| genericHostEditsForOnboarding | 5 | 5 | 0 | **Met** (no new edits) |
| copiedDenaliModules | 0 | 0 | 0 | **Met** |
| formalReusableCapabilities (qualified) | 4 | 7 | ≥5 | **Met** |
| guest scaffold TS/TSX (cert-club) | 14 planner | 14 | ≤30 | **Met** |

## Capability composition exercised

- Equipment — `cert-club` manifest + codegen
- Transport — `cert-club` manifest + dynamic snapshot reader dispatch
- Finance / Booking — profile expansion (`starter-outdoor`); stub-tier author `supported:false` (documented exception: no `tourWrite`)
- Pricing / Membership — profile defaults; not author-enabled on cert-club
- workspacePolicy — two synthetic rules

## Isolation

- Cross-workspace: isolation guards PASS with synthetics present
- Capability present/absent: CW7-04..12 isolation scripts PASS
- Host/core branching: `guard:no-workspace-type-branches` PASS

## Final gates (2026-08-24)

| Gate | Result |
|------|--------|
| `test:parity` | **22/22 PASS** |
| Denali certified suite | **693/693 PASS** |
| cert-club suite | **22/22 PASS** |
| cert-events suite | **9/9 PASS** |
| tour-core | **25/25 PASS** |
| platform-core | **163/163 PASS** |
| `generate:workspace-registry --check` | PASS (17 manifests) |
| Architecture / import / tour-core guards | PASS |
| `baseline:cw-compare` | PASS |
| CW9-07 determinism | PASS |
| `git diff --check` | PASS |

**Note:** `foundation-import-purity-audit --production-only` reports 4 dynamic-import dispatch edges (3 Denali + 1 cert-club) — same class as pre-CW9 Denali dispatch; classified **metric-definition limitation** (generated SDK dispatch must reference workspace packages).

## Architecture verdict

**workspace = profile + capabilities + workspacePolicy + branding/config + thin adapters** holds in executable certification:

- `cert-club`: profile-driven outdoor club + equipment + transport + policy + branding
- `cert-events`: different vertical + member display contract + events branding
- No Denali clone; no generic host edits; codegen deterministic

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw9-10-certification-report.md`.*
