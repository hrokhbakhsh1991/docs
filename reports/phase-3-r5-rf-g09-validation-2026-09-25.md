# Phase 3 R5 — RF-G09 validation — 2026-09-25

## Finding

The historical audit says the Phase 3 test-count floors can pass without
proving behavioral coverage.

## Current evidence

- `scripts/guards/lib/phase-3-check-helpers.mjs` parses the package test count
  and compares it with a threshold; the count check alone cannot distinguish a
  tautological test from a behavioral test.
- The repository already has behavioral contracts:
  - `packages/workspace-sdk/test/invariant-manifest.contract.spec.ts` imports
    and executes the five foundation invariant suites.
  - `packages/workspaces/starter/test/sdk-reference-parity.spec.ts` and
    `starter-exposure-surfaces.spec.ts` exercise starter contract behavior.
- The existing package test command runs those files, but the Phase 3 report
  previously exposed only the count-floor evidence.

## Classification

`confirmed-gap`

This is a gate-evidence gap, not proof of a current production defect. The
minimal remediation is to bind the existing behavioral contract tests as
required checks in `phase-3:apps-cert`, while retaining the count floors as
regression-growth signals.

## Remediation boundary

No new test framework, duplicated assertions, package API, or runtime code is
needed. The gate will invoke the existing contract suites directly and report
them separately from count floors.
