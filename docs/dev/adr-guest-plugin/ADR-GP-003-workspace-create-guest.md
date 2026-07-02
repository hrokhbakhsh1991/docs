# ADR-GP-003 — `workspace:create --guest`

## Status

Accepted.

## Context

The default scaffold creates an L0 workspace plugin. Guest-ready workspaces need a larger static contract: catalog HTTP routes, registration flow, presentation gates, member profile visibility, guest themes, and dev smoke tenant ids.

## Decision

`pnpm run workspace:create -- <id> --guest` emits an L3 manifest and minimal package stubs:

- catalog list/detail and registration HTTP stubs;
- shared-auth compose registration flow;
- intake surface;
- member profile visibility;
- guest marketing theme;
- smoke tenant exports.

The command does not claim product readiness. HTTP handlers return explicit stub responses until product logic is implemented.

## Consequences

The scaffold is suitable for registry/codegen verification and package build checks. Production adoption still requires real HTTP/storage behavior and E2E canary runs (see [guest-plugin-conformance](../../guest-plugin-conformance.md) — G4 closed 2026-07-02).

Guest packages use a **split TypeScript project**: `tsconfig.json` excludes `catalog/registration-flow/react.ts` and `*.tsx` flow steps; `tsconfig.flow.json` compiles them with `jsx: react-jsx` (same pattern as `@app-tour/workspace-urban`).

After promoting a guest workspace to trunk, wire `@app-tour/workspace-<id>` on codegen consumers — see [10.7 — consumer dependencies](../../phase-10/subphases/10.7-enforcement-dx.md#guest-workspace-scaffold-guest-pf-3). Enforced by `guard-guest-consumer-deps.mjs`.

