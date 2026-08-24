# CW7-15 — Capability package Denali coupling guard

**Verdict:** **PASS**  
**Ledger task:** CW7-15  
**Status:** Extended `denali-coupling.contract.spec.ts` to capability module roots  
**Prepared:** 2026-08-24 (CW-7 final closure)  
**Deps satisfied:** CW7-02 (equipment), CW7-04..11 capability extractions

---

## 1. Scope

Reusable tour capability packages under `packages/workspace-sdk/src/{equipment,transport,itinerary,difficulty-fitness,pricing}` must remain **workspace-neutral**. The guard extends H-01 (`no-denali-product-ids` depcruise) plus AST pattern proofs for:

| Violation class | Detection |
|-----------------|-----------|
| Import from Denali workspace package | depcruise `no-denali-product-ids` on capability roots |
| Literal workspace IDs (`"denali"`, etc.) | AST scan — `workspaceType` / `pluginId` equality |
| Fallback-to-Denali (`?? "denali"`, ternary default) | Regex pattern scan |
| `manifest.id === "denali"` alias fallback | Forbidden in capability modules (CW7-13 matrix proves synthetic-only) |

**Allowed:** Denali adapters inside `packages/workspaces/denali/**`; generated registry bindings importing workspace adapters as designed.

**Negative proof:** `packages/workspace-sdk/test/__fixtures__/capability-denali-breach.ts` — intentional violations detected by guard, excluded from production depcruise via allowlist.

---

## 2. Capability roots under scan

```
packages/workspace-sdk/src/equipment
packages/workspace-sdk/src/transport
packages/workspace-sdk/src/itinerary
packages/workspace-sdk/src/difficulty-fitness
packages/workspace-sdk/src/pricing
```

---

## 3. Verification

| Check | Location |
|-------|----------|
| depcruise clean on capability roots | `denali-coupling.contract.spec.ts` |
| Negative fixture trips AST proofs | `capability-denali-breach.ts` |
| No false positive on generated registry | `workspace-pricing-capabilities.generated.ts` excluded |
| Import boundary unchanged | `guard:import-boundary` |

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw7-15-capability-coupling-guard.md`.*
