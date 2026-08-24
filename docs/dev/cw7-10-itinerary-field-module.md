# CW7-10 — Itinerary field-registry fragment module (implementation)

**Verdict:** Implementation  
**Ledger task:** CW7-10  
**Status:** Optional `workspaceItinerary.fieldModule` → codegen bindings + Denali adapter fragment  
**Prepared:** 2026-08-24  
**Design contract:** [`cw7-10-workspace-itinerary-contract.md`](cw7-10-workspace-itinerary-contract.md)

---

## 1. Scope

| Deliverable | Location |
| ----------- | -------- |
| Generic fragment builder | `packages/workspace-sdk/src/itinerary/workspace-itinerary-field-module.ts` |
| Neutral egress types | `packages/workspace-sdk/src/tour/public-catalog-itinerary.ts` |
| Denali adapter fragment | `denali-itinerary-field-module.ts` — `program.itinerary` row |
| Denali wizard composite binding | `denali-itinerary-composite-binding.ts` — `denali.itinerary` metadata |
| Manifest binding | Denali `workspaceItinerary.fieldModule` + `wizardComposite` |
| Codegen | `itinerary.mjs` — capabilities, field module, wizard composite bindings |
| Generated registries | `workspace-itinerary-*-bindings.generated.ts` |
| Merge seam | `merge-workspace-field-registry-with-itinerary-fragments.ts` |
| Golden parity | `denali-itinerary-field-parity.spec.ts` |

**Integration flow:**

```text
workspaceItinerary.capabilities.wizardTourField === true
  → manifest fieldModule + wizardComposite required at codegen assert
  → generated import tables keyed by workspaceType
  → Denali adapter consumes generic defineWorkspaceItineraryFieldFragment
```

**Out of scope:** Urban itinerary policy (CW8), full composite registry migration, marketing display logic changes.

---

## 2. Fragment contract

Workspace adapters export a frozen `WorkspaceItineraryFieldRegistryFragment` via `defineWorkspaceItineraryFieldFragment(config)`. Generic layer owns fragment shape; workspace owns paths, step ids, tags, wire metadata, and zod kind strings.

---

## 3. Tests

| Spec | Coverage |
| ---- | -------- |
| `denali-itinerary-field-parity.spec.ts` | Fragment canonical path + tags match `denaliFieldRegistryData` itinerary row |
| `workspace-itinerary-codegen.spec.mjs` | Denali fieldModule + wizardComposite bindings emitted |
| `cw7-10-itinerary-isolation.spec.mjs` | Zero bindings for isolated workspaces |

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw7-10-itinerary-field-module.md`.*
