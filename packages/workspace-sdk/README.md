# @app-tour/workspace-sdk

**Phase 0 foundation** — workspace plugin contract, canonical documents, ingress parsers, and shared authority types.

## Central documentation

| Doc | Link |
|-----|------|
| **Phase 0 guide** | [`docs/phase-0-foundation.md`](../../docs/phase-0-foundation.md) · [Markdoc](../../docs/phase-0-foundation.mdoc) |
| Migration map | [`docs/MIGRATION-MAP.md`](../../docs/MIGRATION-MAP.md) |
| Docs-as-Code hub | [`docs/README.md`](../../docs/README.md) |

## Phase 0 optional policy (P2)

| Topic | Decision |
|-------|----------|
| **CASL (`P0-SDK-01`)** | `@casl/ability` is an **optional peer** — consumers that call `buildTenantAuthz` install it; not in `dependencies` until a published package strategy is chosen. |
| **Tour on root barrel (`P0-SDK-02`)** | `TourClient` types and `buildTourAuthHeaders` are exported from `src/index.ts` for Phase 3 API/web transport — guarded by `contract.spec.ts` allowlist; migrate to `@app-tour/workspace-sdk/tours` in a later phase. |
| **Root export allowlist (`P0-GATE-04`)** | `test/contract.spec.ts` freezes runtime exports from `dist/index.js`; adding a root export requires updating the allowlist. |

See [`reports/phase-0-optional-closure-2026-06-03.md`](../../reports/phase-0-optional-closure-2026-06-03.md).

## Commands

```bash
pnpm --filter @app-tour/workspace-sdk run build
pnpm --filter @app-tour/workspace-sdk run test
pnpm run test:phase-0
```
