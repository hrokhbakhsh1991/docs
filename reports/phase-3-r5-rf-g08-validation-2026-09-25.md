# Phase 3 R5 — RF-G08 validation — 2026-09-25

## Finding

The historical audit says nesting `phase-2:gate` inside `phase-3:gate` can mask
Phase 3 failures behind a green Phase 2 result.

## Current evidence

- `package.json` runs the Phase 3 chain with `&&` and includes both
  `phase-3:guard` and the full `phase-3:apps-cert` after the Phase 2 steps.
- `phase-3:apps-cert` runs the API and Web leaf gates, SDK/starter tests, and
  starter build; a failure cannot be hidden by a prior Phase 2 pass.
- `docs/phase-3/phase-3-ci.md` documents this exact chain and the intentional
  ownership of `doc-gate` by `p3_doc_gate`.

## Classification

`false-positive / stale historical finding`

The current gate is sequential and fail-fast; Phase 2 is a prerequisite, not a
replacement for Phase 3 certification. No code or gate change is made.
