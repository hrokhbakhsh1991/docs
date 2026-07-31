# Workspace Host Contract v2 (RFC)

> **Phase:** 10.0 · **Status:** PROPOSED  
> **DEC:** [`appendices/IMPLEMENTATION-DECISIONS.md`](appendices/IMPLEMENTATION-DECISIONS.md) — DEC-P10-001, DEC-P10-002  
> **Schema:** [`appendices/WORKSPACE-MANIFEST.schema.json`](appendices/WORKSPACE-MANIFEST.schema.json)

---

## 1. Problem statement

Foundation (`platform-core`, `workspace-sdk` contract) is healthy. The **platform host** (`apps/api`, `apps/web`) still knows product names at compile time:

```ts
// apps/api/src/workspace/workspace-plugins.ts — today
return [getStarterWorkspacePlugin(), getDenaliWorkspacePlugin(), getUrbanWorkspacePlugin()];
```

This forces **API rebuild** for every new workspace and creates monolith precedents (e.g. Denali finance hook inside `outbox-relay.ts`).

---

## 2. Goals / non-goals

### Goals

- New workspace: `packages/workspaces/<name>/` + `workspace.manifest.json` + `generate:workspace-registry` + tenant row
- `outbox-relay.ts`: transport only (no `@app-tour/workspace-denali` imports)
- Urban HTTP: registrable from workspace package (Phase 3)
- **Zero** changes to `packages/platform-core`

### Non-goals (Phase 10)

- Runtime plugin marketplace / external npm load
- Per-tenant plugin toggles (future DEC)
- Prisma schema split (Phase 6 of remediation roadmap)

---

## 3. Phase 0 code re-read notes (2026-06-08)

Mandatory read completed before this RFC:

| Finding | Implication |
| ------- | ----------- |
| `WorkspacePlugin` is complete for wizard/tours | No change to interface in Phase 10.0 — manifest is **adjacent** metadata |
| `resolveWorkspacePluginForType` is already data-driven | Bindings array is the only closed part — **codegen replaces hand-edited array** |
| `listApiWorkspacePlugins` eager-imports three packages | Generated loader is the single allowed import site |
| GAP-3.3-04 deferred dynamic resolution | Phase 10 closes it via **build-time** discovery (DEC-P10-001) |
| `platform-core-no-workspaces` in depcruise | Confirms core must not be touched |

**Answers to Phase 0 questions:**

1. **Manifest vs extend `WorkspacePlugin`?** — Separate JSON + optional future `plugin.http`/`events` modules; do not bloat `WorkspacePlugin` until Phase 3+.
2. **Codegen vs runtime scan?** — **Codegen** (DEC-P10-001).
3. **Files forbidden in Phase 0?** — All of `apps/api/src`, `workspace-sdk/src`, `platform-core/`.

---

## 4. `workspace.manifest.json`

One file per package under `packages/workspaces/<name>/workspace.manifest.json`.

### Example — starter

```json
{
  "id": "starter",
  "version": 1,
  "package": "@app-tour/workspace-starter",
  "workspaceTypes": ["starter"],
  "plugin": {
    "entry": ".",
    "export": "getStarterWorkspacePlugin"
  },
  "web": {
    "entry": ".",
    "export": "getStarterWorkspacePlugin"
  }
}
```

### Example — denali

```json
{
  "id": "denali",
  "version": 1,
  "package": "@app-tour/workspace-denali",
  "workspaceTypes": ["denali"],
  "plugin": {
    "entry": "./plugin",
    "export": "getDenaliWorkspacePlugin"
  },
  "web": {
    "entry": "./plugin",
    "export": "getDenaliWorkspacePlugin"
  },
  "events": [
    {
      "eventType": "TourCreated",
      "module": "./finance/tour-created-ledger",
      "export": "handleTourCreatedLedgerEvent",
      "workspaceTypes": ["denali"]
    }
  ]
}
```

### Example — urban

```json
{
  "id": "urban",
  "version": 1,
  "package": "@app-tour/workspace-urban",
  "workspaceTypes": ["urban"],
  "plugin": {
    "entry": "./plugin",
    "export": "getUrbanWorkspacePlugin"
  },
  "web": {
    "entry": "./plugin",
    "export": "getUrbanWorkspacePlugin"
  },
  "http": {
    "prefix": "/urban",
    "module": "./http/routes"
  }
}
```

Validation: [`WORKSPACE-MANIFEST.schema.json`](appendices/WORKSPACE-MANIFEST.schema.json).

---

## 5. Codegen output (sketch)

`scripts/generate-workspace-registry.mjs` emits:

```ts
// apps/api/src/workspace/workspace-registry.generated.ts (generated — do not edit)
export const WORKSPACE_MANIFEST_BINDINGS = [
  { workspaceType: "starter", pluginId: "starter", packageName: "@app-tour/workspace-starter", ... },
  ...
] as const;

export async function loadWorkspacePluginById(id: string): Promise<WorkspacePlugin> { ... }
```

Consumers migrate:

| Consumer | Today | After Phase 2 |
| -------- | ----- | ------------- |
| `workspace-plugins.ts` | manual imports | `return loadAllPluginsFromRegistry()` |
| `DEFAULT_WORKSPACE_TYPE_BINDINGS` | hardcoded 3 rows | `export const DEFAULT_* = WORKSPACE_MANIFEST_BINDINGS` |
| `load-workspace-plugin.ts` (web) | if denali/urban | `loadWorkspacePluginById` from generated |

---

## 6. Event dispatch (Phase 1 — DEC-P10-002)

```text
publishClaimedOutboxRow
  → publishDomainEvent (unchanged)
  → dispatchTourCreatedSideEffects(row)   // new host module
       → resolve workspace_type for tenant
       → invoke manifest event handlers (denali finance first)
  → markOutboxDoneWithRetry (unchanged)
```

**Invariant:** `apps/api/src/outbox/outbox-relay.ts` does not import `denali-finance/` or `@app-tour/workspace-denali`.

---

## 7. HTTP dispatch (Phase 3 — sketch)

```text
app.ts dispatchRequest
  → ... generic /tours ...
  → workspaceRouteRegistrar.tryDispatch(req, res)  // urban, future products
  → 404
```

Urban paths today (must remain behavior-identical):

- `GET|PATCH /urban/settings`
- `GET /urban/catalog`
- `GET /urban/catalog/:tourId`
- `POST /urban/registrations`

See [`appendices/MIGRATION-MAP-PLUGIN-HOST.md`](appendices/MIGRATION-MAP-PLUGIN-HOST.md).

---

## 8. Migration & specs

- File-level migration: [`appendices/MIGRATION-MAP-PLUGIN-HOST.md`](appendices/MIGRATION-MAP-PLUGIN-HOST.md)
- Specs that must stay green: [`appendices/SPEC-PRESERVATION-MATRIX.md`](appendices/SPEC-PRESERVATION-MATRIX.md)

---

## 9. Execution order

```text
P0 doc (this RFC) → P1 events → P2 manifest → P3 HTTP → P4+ (see TEMP roadmap)
```

Detailed tasks: `TEMP/platform-plugin-native-remediation-roadmap.md` (historical local scratch `platform-plugin-native-remediation-roadmap.md`; not fresh-clone authority — see docs/audits/snapshots/2026-07-31/psr-2b-temp-authority-inventory.yaml).

---

## 10. Architect sign-off (P0-T05)

| Item | Status |
| ---- | ------ |
| DEC-P10-001 PROPOSED | [ ] Architect APPROVED |
| DEC-P10-002 PROPOSED | [ ] Architect APPROVED |
| Phase 1 code start authorized | [ ] |

*Until P0-T05 checked, implementation PRs for Phase 1+ should not merge.*
