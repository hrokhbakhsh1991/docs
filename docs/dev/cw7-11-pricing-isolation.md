# CW7-11 — Pricing isolation test

**Verdict:** Implementation  
**Ledger task:** CW7-11  
**Status:** starter / guest-club / urban / policy-cert zero pricing codegen surface  
**Prepared:** 2026-08-24

---

## Isolation targets

| Workspace | Expected |
| --------- | -------- |
| `starter` | no `workspacePricing` block → zero bindings |
| `guest-club` | same |
| `urban` | same |
| `policy-cert` | same |

## Tests

| Spec | Coverage |
| ---- | -------- |
| `cw7-11-pricing-isolation.spec.mjs` | capability + field-module + wizard-composite codegen isolation |

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw7-11-pricing-isolation.md`.*
