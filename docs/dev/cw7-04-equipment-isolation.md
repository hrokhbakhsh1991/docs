# CW7-04 — Equipment isolation test

**Verdict:** Implementation  
**Ledger task:** CW7-04  
**Status:** starter / guest-club / urban zero equipment codegen surface  
**Prepared:** 2026-08-23

---

## Isolation targets

| Workspace | Expected |
| --------- | -------- |
| `starter` | no `workspaceEquipment` block → zero bindings |
| `guest-club` | same |
| `urban` | same; API `SETTINGS_MODULE_UNKNOWN` covered by `settings-urban-regression.spec.ts` |

## Tests

| Spec | Coverage |
| ---- | -------- |
| `cw7-04-equipment-isolation.spec.mjs` | capability, field-module, icon-validator, settings UI codegen isolation |

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw7-04-equipment-isolation.md`.*
