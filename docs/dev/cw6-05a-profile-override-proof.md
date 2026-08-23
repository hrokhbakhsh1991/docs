# CW6-05A — Theme/intake/config override proof

**Verdict:** Implementation  
**Ledger task:** CW6-05A  
**Status:** Synthetic `profile-cert` workspace proves declarative overrides on `starter-outdoor`  
**Prepared:** 2026-08-23

---

## Proof workspace

`scripts/test/fixtures/profile-cert.manifest.json` — `profile: "starter-outdoor"` with author overrides:

| Seam | Override |
| ---- | -------- |
| Theme | `tenantBrandingDefaults.primaryColor` + `theme/tokens.css` |
| Intake | `catalogRegistrationFlow.steps.components.intake` |
| Config | `catalogPresentation`, `memberProfile` |

No `workspacePolicy`. No host/core edits.

## Tests

| Spec | Coverage |
| ---- | -------- |
| `profile-override-cert.spec.mjs` | expansion audit + codegen bindings |

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw6-05a-profile-override-proof.md`.*
