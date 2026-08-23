# CW7-03 — Equipment field-registry fragment module (implementation)

**Verdict:** Implementation  
**Ledger task:** CW7-03  
**Status:** Optional `workspaceEquipment.fieldModule` → codegen bindings + Denali adapter fragment  
**Prepared:** 2026-08-23  
**Design contract:** [`cw7-01-workspace-equipment-contract.md`](cw7-01-workspace-equipment-contract.md)

---

## 1. Scope

| Deliverable | Location |
| ----------- | -------- |
| Generic fragment builder | `packages/workspace-sdk/src/equipment/workspace-equipment-field-module.ts` |
| Denali adapter fragment | `denali-equipment-field-module.ts` — `participants.gearItems` row |
| Manifest binding | Denali `workspaceEquipment.fieldModule` |
| Codegen | `equipment.mjs` — `generateWorkspaceEquipmentFieldModuleBindings` |
| Generated registry | `apps/web/src/bootstrap/workspace-equipment-field-module-bindings.generated.ts` |
| Merge seam | `packages/workspace-sdk/src/registry/merge-workspace-field-registry-with-equipment-fragments.ts` |
| Golden parity | `denali-equipment-field-parity.spec.ts` |

**Integration flow:**

```text
workspaceEquipment.capabilities.wizardTourField === true
  → manifest fieldModule binding required at codegen assert
  → generated import table keyed by workspaceType
  → Denali adapter consumes generic `defineWorkspaceEquipmentFieldFragment`
```

**Out of scope:** CW7-04 isolation suite, CW8 equipment id capability validators, Urban equipment surfaces.

---

## 2. Fragment contract

Workspace adapters export a frozen `WorkspaceEquipmentFieldFragment` via `defineWorkspaceEquipmentFieldFragment(config)`. Generic layer owns fragment shape; workspace owns paths, step ids, tags, wire metadata, and zod kind strings.

---

## 3. Tests

| Spec | Coverage |
| ---- | -------- |
| `denali-equipment-parity.golden.spec.ts` | Fragment canonical path + tags match `denaliFieldRegistryData` gear row |
| `workspace-equipment-codegen.spec.mjs` | Denali fieldModule binding emitted in generated registry |

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw7-03-equipment-field-module.md`.*
