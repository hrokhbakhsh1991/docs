## Summary

- **Phase G:** Modularize `scripts/generate-workspace-registry.mjs` into `scripts/codegen/workspace-registry/` (orchestrator + domain modules). Generated `*.generated.ts` outputs unchanged.
- **Phase H:** Production certification axis (`productionTier: stub | certified`) — manifest schema, codegen registry, SDK resolver, `provisionTenantProduction` + platform saga fail-closed gates, `guard:workspace-certification` + proof matrix, Super Admin UX (badges + disabled stub onboarding).

Closes architecture risk **R10** (stub workspaces falsely equal to reference in prod matrix).

## Verification (fast-track — PASS on DEV)

```bash
pnpm run phase-g-h:fast-track
```

| Area | Checks |
| ---- | ------ |
| Codegen | `guard:workspace-registry-fresh`, drop-in 27/27 |
| Guards | `phase-10:guard`, `guard:guest-plugin-conformance`, `guard:workspace-certification` |
| H1–H3 | production-certification spec 4/4, certification-guard spec 5/5 |
| H2 API | provision-tenant-production 7/7, error-interceptor 422 |
| H4 | list-platform-workspaces 4/4, Super Admin specs, smoke-platform-create-club |
| OpenAPI | `guard:openapi-dispatch-parity` |

## Deferred (explicit)

- `ci:integrity` — not run; Architect YES required for full monorepo gate.

## Key docs

- [workspace-registry-codegen-modularization.mdoc](docs/dev/workspace-registry-codegen-modularization.mdoc)
- [workspace-certification.mdoc](docs/dev/workspace-certification.mdoc)
- [platform-architecture-v2.md § Phase G/H](docs/architecture/platform-architecture-v2.md)

## Test plan

- [ ] CI `phase-10-guard` green on this PR
- [ ] Proof matrix: `docs/dev/workspace-certification-proof-matrix.yaml` (denali certified)
- [ ] Super Admin `/platform/clubs/new` — urban/guest-club disabled; denali certified badge
- [ ] `POST /platform/v1/tenants` with `workspaceType: urban` returns 422 `WORKSPACE_NOT_CERTIFIED_FOR_PRODUCTION`
