## Summary

- **Phase G:** Modularize `scripts/generate-workspace-registry.mjs` into `scripts/codegen/workspace-registry/` (orchestrator + domain modules). Generated `*.generated.ts` outputs unchanged.
- **Phase H:** Production certification axis (`productionTier: stub | certified`) — manifest schema, codegen registry, SDK resolver, `provisionTenantProduction` + platform saga fail-closed gates, `guard:workspace-certification` + proof matrix, Super Admin UX (badges + disabled stub onboarding).
- **Phase I:** Scale hardening — `guard:theme-import-budget` (admin ≤1, guest ≤2 CSS imports per path) + `workspace-plugin-load-cache.ts` (promise cache, revision bust, max entries = trunk plugin count).

Closes architecture risk **R10** (stub workspaces falsely equal to reference in prod matrix).

## Verification (closure bundle — PASS on DEV)

```bash
pnpm run phase-i:closure   # G+H regression + I1/I2 guards
```

| Area | Checks |
| ---- | ------ |
| Codegen | `guard:workspace-registry-fresh`, drop-in 28/28 |
| Guards | `phase-10:guard` **11/11**, `guard:guest-plugin-conformance`, `guard:workspace-certification`, `guard:theme-import-budget`, `guard:workspace-plugin-load-cache` |
| H1–H3 | production-certification spec 4/4, certification-guard spec 5/5 |
| H2/H4 integration | provision/list-platform-workspaces/error-interceptor + Super Admin specs — **`phase-i:closure` local** (GHA fast path = guards only) |
| OpenAPI | `guard:openapi-dispatch-parity` |

## Deferred (explicit)

- `ci:integrity` — not run; Architect YES required for full monorepo gate.

## Key docs

- [workspace-registry-codegen-modularization.mdoc](docs/dev/workspace-registry-codegen-modularization.mdoc)
- [workspace-certification.mdoc](docs/dev/workspace-certification.mdoc)
- [workspace-scale-hardening.mdoc](docs/dev/workspace-scale-hardening.mdoc)
- [platform-architecture-v2.md § Phase G/H/I](docs/architecture/platform-architecture-v2.md)

## Test plan

- [x] `pnpm run phase-i:closure` green locally
- [x] GHA `phase-10-guard` green on `DEV` (`61954281`)
- [x] PR [#19](https://github.com/hrokhbakhsh1991/docs/pull/19) merged to `main` (`6b27d9f6`)
- [x] GHA `phase-10-guard` green on PR
- [x] Proof matrix — `guard:workspace-certification` + `workspace-certification-proof-matrix.yaml` (denali certified)
- [x] Super Admin specs — `use-create-club-wizard` rejects stub · badge spec · `smoke-platform-create-club.mjs` structural
- [x] `POST /platform/v1/tenants` urban → 422 — `provision-tenant-production.spec.ts` + `workspace-not-certified-error-interceptor.spec.ts`
- [ ] Manual smoke: Super Admin `/platform/clubs/new` in dev (PLATFORM_OPS_PHONES + local stack)
