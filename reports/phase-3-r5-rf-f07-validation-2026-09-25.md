# Phase 3 R5 — RF-F07 validation — 2026-09-25

## Finding

The archived forensic note points to the old starter-only bootstrap registry. The current runtime has a generated manifest-backed loader with per-plugin dynamic imports (`workspace-plugin-loaders.generated.ts`); the starter-only `workspace-plugins.ts` is retained only for the generic bootstrap/reference list and does not serve as the runtime product plugin resolver.

The loader also applies explicit client bundle gates for Denali and Urban and fails closed when the gate is absent.

## Classification

`false-positive / stale historical finding`.

No static Denali import was added to the generic bootstrap path, and no second plugin resolver was created.

## Evidence

- `apps/web/src/bootstrap/workspace-plugin-loaders.generated.ts`
- `apps/web/src/bootstrap/resolve-bootstrap-workspace-plugin.ts`
- `apps/web/test/thin-shell-generated-bootstrap-inventory.spec.ts`
- `apps/web/test/resolve-bootstrap-workspace-plugin.client.spec.ts`

Architect: documentation status Updated. Link: [Phase 3.2 backlog](../docs/backlog/phase-3.2-red-flag-backlog.md).
