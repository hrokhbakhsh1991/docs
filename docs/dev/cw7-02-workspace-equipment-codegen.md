# CW7-02 — Workspace equipment codegen (implementation)

**Verdict:** Implementation  
**Ledger task:** CW7-02  
**Status:** `workspaceEquipment` block codegen + Denali manifest migration  
**Prepared:** 2026-08-23  
**Design contract:** [`cw7-01-workspace-equipment-contract.md`](cw7-01-workspace-equipment-contract.md)

---

## 1. Scope

| Deliverable | Location |
| ----------- | -------- |
| Equipment domain | `scripts/codegen/workspace-registry/domains/equipment.mjs` |
| Capability flags | `packages/workspace-sdk/src/catalog/workspace-equipment-capabilities.generated.ts` |
| Icon validator dispatch | `apps/api/src/settings/workspace-equipment-icon-key-validator-bindings.generated.ts` (via equipment reader) |
| Settings enricher | `apps/api/src/settings/workspace-settings-enrichers.generated.ts` (block `settingsEnricher`) |
| Schema | `manifest.schema.ts` — `WorkspaceEquipmentBlockSchema` |
| Denali adapter | `packages/workspaces/denali/workspace.manifest.json` — `workspaceEquipment` block |

**Generic layer:** enabled/disabled + surface flags only — **no** platform icon defaults.  
**Denali adapter:** icon registry, enricher, settings UI, theme filter modules stay in Denali package.

**Out of scope:** CW7-03 field-registry fragment, CW7-04 isolation proof suite, CW8 capability validators for equipment ids.

---

## 2. Legacy alias (transition)

`resolveWorkspaceEquipmentManifest` falls back to Denali top-level `equipmentIconKeyValidator` / `settingsEnrichers[]` / `settingsEquipmentUi` only when `workspaceEquipment` absent. Denali manifest migrated to block; other workspaces remain isolated when block absent.

---

## 3. Isolation

Workspaces without `workspaceEquipment` or with `supported: false` emit **zero** equipment capability rows and **no** icon-validator binding.

---

## 4. Tests

| Spec | Coverage |
| ---- | -------- |
| `scripts/test/workspace-equipment-codegen.spec.mjs` | Denali flags, starter/urban/guest-club isolation |

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw7-02-workspace-equipment-codegen.md`.*
