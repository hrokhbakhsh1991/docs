# Phase 10 — Implementation decisions (Workspace Host)

```yaml
decision_doc_version: "2026-06-08-v1"
extends_pek: docs/phase-9/appendices/IMPLEMENTATION-DECISIONS.md
contract: docs/phase-10/workspace-host-contract-v2.md
schema: appendices/WORKSPACE-MANIFEST.schema.json
```

> Resolves plugin-host remediation ambiguities. **Phase 10 doc wins** over TEMP prose when they conflict after merge.

---

## DEC-P10-001 — Build-time workspace manifest codegen (not runtime scan)

```yaml
id: DEC-P10-001
status: DONE
locked: true
date: 2026-06-08
phase: 10.0
closes_gap: GAP-3.3-04
```

### Context

Trunk today uses:

- `apps/api/src/workspace/workspace-plugins.ts` — eager imports of denali/urban/starter
- `packages/workspace-sdk/src/plugin/workspace-type-binding.ts` — closed `DEFAULT_WORKSPACE_TYPE_BINDINGS`
- `apps/web/src/wizard/load-workspace-plugin.ts` — `if (pluginId === denali|urban)`

Adding a fourth workspace requires editing SDK bindings, API registry, depcruise allowlists, and web loader branches. This violates the Phase 7 research target: _new workspace = plugin + theme + bootstrap — no core touch_.

### Decision

1. Each `packages/workspaces/<name>/workspace.manifest.json` conforms to [`WORKSPACE-MANIFEST.schema.json`](WORKSPACE-MANIFEST.schema.json).
2. Root script `pnpm run generate:workspace-registry` scans manifests and emits:
   - `apps/api/src/workspace/workspace-plugin-registry.generated.ts`
   - `apps/web/src/bootstrap/workspace-plugin-loaders.generated.ts` (optional same commit)
3. **Build-time codegen only** for Phase 10–11 — no `fs.readdir` at API runtime in production.
4. `DEFAULT_WORKSPACE_TYPE_BINDINGS` becomes a **re-export** of generated bindings (backward compat for existing contract specs) until Phase 5 neutralizes product constants.
5. `listApiWorkspacePlugins()` delegates to generated loader — no direct `@app-tour/workspace-*` imports outside generated file + depcruise allowlist for that file only.
6. Generated files are **committed**; CI fails if manifest changes without regenerated output.

### Non-goals (Phase 10)

- Per-tenant dynamic plugin enablement (Phase 7+ advanced — separate DEC)
- Runtime npm install of external workspace packages
- Changes to `packages/platform-core`

### Consequences

| Pro | Con |
| --- | --- |
| New workspace = package + manifest + codegen | Still requires API `pnpm` dep on workspace package in monorepo |
| Type-safe imports in generated TS | Script maintenance |
| Closes GAP-3.3-04 honestly | One-time migration of three existing workspaces |

### Verification

```bash
pnpm run generate:workspace-registry
pnpm run guard:architecture
rg "getDenaliWorkspacePlugin" apps/api/src/workspace/workspace-plugins.ts  # → 0 after Phase 2
```

---

## DEC-P10-002 — Outbox relay remains transport-only (Phase 1)

```yaml
id: DEC-P10-002
status: DONE
locked: true
date: 2026-06-08
phase: 10.1
implementation: docs/phase-10/subphases/10.1-outbox-side-effects.md
```

### Context

`apps/api/src/outbox/outbox-relay.ts` calls `processDenaliFinanceTourCreatedRow` after `publishDomainEvent` for every `TourCreated` row.

### Decision

1. After `publishDomainEvent`, invoke a **host dispatcher** (`workspace-tour-created-dispatcher.ts`) — not inline product imports in relay.
2. Phase 1 dispatcher may still call existing denali-finance adapter; relay file must not import `denali-finance/` or `@app-tour/workspace-denali`.
3. Ledger business logic stays in `packages/workspaces/denali`; Prisma `OutboxWriter` adapter may stay in `apps/api` until Phase 4.

### Verification

```bash
rg "workspace-denali|denali-finance" apps/api/src/outbox/  # → 0 after Phase 1-S3
pnpm --filter @apps/api exec node --import tsx --test test/denali-finance-outbox.integration.spec.ts
```

---

## DEC-P10-006 — Data schema ownership (defer rename)

```yaml
id: DEC-P10-006
status: LOCKED
date: 2026-06-08
phase: 10.6
```

Keep namespaced urban/finance Prisma models until a workspace requests generic tables. See [`subphases/10.6-data-layer-policy.md`](../subphases/10.6-data-layer-policy.md).
