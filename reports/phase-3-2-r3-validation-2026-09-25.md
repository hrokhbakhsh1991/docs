# Phase 3.2 R3 validation — 2026-09-25

## Scope

R3 covers the Web → API tour-create vertical slice and its authentication boundary.

## SHA

- `6df212b29e00ef57370360a7f785e114d6465b30`

## Code evidence

- `createTourAction` is a server action and posts to the existing API `/tours` route.
- The action reads the session JWT from the server cookie and forwards it as a bearer token; it does not use env-only bootstrap headers.
- The wizard submit path calls the action and redirects using the persisted API record id.
- `FetchTourClient` preserves the existing API contract for create/get and error correlation.
- Workspace plugin loading remains capability- and manifest-gated; no unsafe client fallback was added.

## Test finding

The first focused run failed one capability assertion because the test process did not set `ALLOW_DENALI_WEB_PLUGIN` / `ALLOW_URBAN_WEB_PLUGIN`. The loader correctly failed closed. Re-running with the repository's explicit development plugin gates enabled produced `7/7 PASS`.

## Classification

- Web → API bridge: `confirmed-implemented`
- initial focused failure: `config issue`, not a product defect
- no endpoint, auth path, state machine, or plugin fallback was added

## Remaining closure

The focused suite proves the source contract only. Full `phase-3:apps-cert` and the final phase gate remain required before phase-level closure.

Architect: documentation status Updated. Link: [Phase 3.2 backlog](../docs/backlog/phase-3.2-red-flag-backlog.md).
