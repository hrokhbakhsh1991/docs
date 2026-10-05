# Phase 3.2 R0 validation — 2026-09-25

## Scope

R0 covers the API dev-bearer boundary and production fail-closed authentication contract.

## SHA

- `6df212b29e00ef57370360a7f785e114d6465b30`

## Code finding

The implementation already enforces the intended contract:

- `AUTH_ALLOW_DEV_BEARER=true` is rejected outside `NODE_ENV=test`.
- production requires the configured RS256 JWT verification contract.
- a disabled `dev.*` bearer is rejected before header fallback.
- TenantKernel keeps verified JWT, gated dev bearer, and test-only headers as separate paths.

No production-code change was needed for R0.

## Test finding and bounded fix

The focused security suite initially failed `2/18` cases because `tenant-security.spec.ts` did not reset `NODE_ENV` to `test` before each case. A preceding production-mode case contaminated later header-auth cases. The fix sets the test environment explicitly in the existing `beforeEach`; it does not change runtime authentication behavior.

## Evidence

- focused auth/security suite after fix: `18/18 PASS`
- `pnpm --filter @apps/api run guard:tenant-isolation`: PASS
- `git diff --check`: PASS

## Classification

- R0 implementation: `confirmed-implemented`
- initial failure: `confirmed-test-isolation-regression`, fixed in test setup
- root `pnpm run guard:tenant-isolation`: `false-positive` command-scope issue; canonical guard is the existing `@apps/api` script and is already part of `phase-3:api-gate`

## Remaining closure

The full `phase-3:apps-cert` process is still running on this SHA. R0 is not marked phase-level closed until that report is available.

Architect: documentation status Updated. Link: [Phase 3.2 backlog](../docs/backlog/phase-3.2-red-flag-backlog.md).
