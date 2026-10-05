# Phase 3 R5 — RF-G06 validation — 2026-09-25

## Finding

The historical audit says starter/SDK parity is tautological because it only
checks reference equality.

## Current evidence

- `packages/workspaces/starter/src/starter.plugin.ts` obtains the SDK plugin
  and returns a new frozen object with starter-owned `exposureSurface` and
  `wizardHost` capabilities.
- `packages/workspaces/starter/test/sdk-reference-parity.spec.ts` compares the
  contract fields with `deepEqual`; it does not assert object identity.
- The same test separately asserts starter-owned wizard-host behavior and
  function shape.

## Classification

`false-positive / stale historical finding`

The current test can fail when SDK metadata drifts and also verifies the
starter-specific extension. No code change is made.
