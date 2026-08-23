# CW6-03 — `starter-outdoor` profile (implementation)

**Verdict:** Implementation  
**Ledger task:** CW6-03  
**Status:** Platform catalog profile composing certified RC capability defaults  
**Prepared:** 2026-08-23  
**Design contract:** [`cw6-01-starter-profile-contract.md`](cw6-01-starter-profile-contract.md)

---

## 1. Profile catalog entry

`profiles/starter-outdoor.profile.json` composes **existing RC capability blocks** only:

| Block | Profile default |
| ----- | --------------- |
| `workspaceBooking` | `supported: true`, `defaultModuleEnabledWhenUnset: true` |
| `workspaceFinance` | `supported: true`, `defaultModuleEnabledWhenUnset: true` |
| `catalogRegistrationFlow` | `steps.mode: "shared"` |
| `catalogPresentation` | outdoor detail sections; no city filter; no IRR/toman |
| `memberProfile` | reduced `displayName` / `email` / `mobile` OTP set |
| `tenantBrandingDefaults` | `primaryColor: #2563eb` |

**Excluded:** Denali equipment, transport dong rules, publish matrix, nationalId fields, equipment icons, Denali branding.

---

## 2. Override precedence

Author manifest wins over profile defaults (CW6-02 merge). Profile catalog never embeds `workspacePolicy`.

---

## 3. Tests

| Spec | Coverage |
| ---- | -------- |
| `starter-outdoor-profile.spec.mjs` | capability keys, excluded Denali semantics, override precedence |
| `profile-expansion-merge.spec.mjs` | catalog resolve (existing) |

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw6-03-starter-outdoor-profile.md`.*
