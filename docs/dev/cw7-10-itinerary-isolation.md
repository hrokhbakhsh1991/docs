# CW7-10 — Itinerary isolation test

**Verdict:** Implementation  
**Ledger task:** CW7-10  
**Status:** starter / guest-club / urban / policy-cert zero itinerary codegen surface  
**Prepared:** 2026-08-24

---

## Isolation targets

| Workspace | Expected |
| --------- | -------- |
| `starter` | no `workspaceItinerary` block → zero bindings |
| `guest-club` | same |
| `urban` | same |
| `policy-cert` | same |

## Tests

| Spec | Coverage |
| ---- | -------- |
| `cw7-10-itinerary-isolation.spec.mjs` | capability + field-module + wizard-composite codegen isolation |

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw7-10-itinerary-isolation.md`.*
