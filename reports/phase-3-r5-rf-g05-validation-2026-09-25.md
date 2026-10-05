# Phase 3 R5 — RF-G05 validation — 2026-09-25

## Finding

The historical audit says the Select/Checkbox check is optional and can stay
green when those subpaths are absent.

## Current evidence

- `scripts/guards/phase-3-guard.mjs` intentionally marks
  `p3_ui_select_checkbox_optional` as `required: false`.
- `packages/ui-primitives/src/Select/Select.tsx` and
  `packages/ui-primitives/src/Checkbox/Checkbox.tsx` exist.
- Both components have focused specs.
- `packages/ui-primitives/package.json` exports `./select` and `./checkbox`.
- The phase state machine explicitly defines `3.3.x` as optional and
  non-blocking for 3.4.

## Classification

`false-positive / intentional optional contract`

There is no missing UI primitive in the current tree. Making this check
blocking would change the documented phase transition policy rather than fix a
real runtime defect. No code change is made.
