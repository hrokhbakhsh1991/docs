# CW7-06 — Workspace transport capability codegen

**Verdict:** Implementation  
**Ledger task:** CW7-06  
**Status:** `workspaceTransport` manifest block + codegen domain `transport.mjs`  
**Prepared:** 2026-08-24 (Wave 7A)  
**Design contract:** [`cw7-05-workspace-transport-contract.md`](cw7-05-workspace-transport-contract.md)

---

## Scope

| Artifact | Path |
| -------- | ---- |
| Capability flags | `packages/workspace-sdk/src/catalog/workspace-transport-capabilities.generated.ts` |
| Snapshot reader dispatch | `packages/workspace-sdk/src/catalog/catalog-transport-snapshot-readers.generated.ts` |
| Registration initializer dispatch | `packages/workspace-plugin-host/src/workspace-registration-transport-initializers.generated.ts` |
| Intake transport surface dispatch | `packages/workspace-sdk/src/catalog/catalog-intake-transport-surfaces.generated.ts` |
| Registration normalizer dispatch | `apps/api/src/catalog/registration-transport-normalizers.generated.ts` |
| Codegen domain | `scripts/codegen/workspace-registry/domains/transport.mjs` |
| Manifest Zod | `packages/workspace-sdk/src/manifest.schema.ts` — `WorkspaceTransportBlockSchema` |

## Generic layer

- `supported` master switch + per-surface `capabilities.*` flags (default false).
- Codegen emits bindings only when `supported: true` and the surface flag is true.
- Legacy Denali-only compat: when `workspaceTransport` absent, synthesize `registrationInitializer` from `catalogRegistrationFlow.transportInitializerExport` (same pattern as equipment aliases). **No fallback for starter/urban/guest-club.**

## Denali adapter (CW7-06)

Denali `workspace.manifest.json` declares `workspaceTransport` with snapshot, intake, initializer, and normalizer bindings. `catalogRegistrationFlow.transportInitializerExport` removed — codegen reads `workspaceTransport.registrationInitializer` first.

Field module + wizard composite remain **CW7-07** (not migrated here).

## Tests

| Spec | Coverage |
| ---- | -------- |
| `workspace-transport-codegen.spec.mjs` | manifest → flags + initializer + snapshot bindings |
| `cw7-06-transport-isolation.spec.mjs` | starter / guest-club / urban → zero transport codegen surface |

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw7-06-workspace-transport-codegen.md`.*
