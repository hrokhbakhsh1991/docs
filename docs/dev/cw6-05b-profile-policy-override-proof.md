# CW6-05B — Workspace-policy override proof (CW-6/CW-8 join)

**Verdict:** Implementation  
**Ledger task:** CW6-05B  
**Status:** `profile-cert` proves `profile: "starter-outdoor"` + author `workspacePolicy` via CW8-03 seam  
**Prepared:** 2026-08-23

---

## Proof workspace

`packages/workspaces/profile-cert` — extends CW6-05A proof with author-only policy:

| Seam | Mechanism |
| ---- | --------- |
| Profile | `profile: "starter-outdoor"` — capability defaults from catalog |
| Policy | `workspacePolicy.module` → `./policy/tour-policy` factory |

Profile catalog **forbids** `workspacePolicy` in `capabilityDefaults`. Author manifest wins after expansion.

## Policy rules

Two ordered custom rules in `workspacePolicyValidation` (after capability stage):

1. `PROFILE_CERT_POLICY_TITLE_TOO_SHORT` — title length &lt; 3
2. `PROFILE_CERT_POLICY_BLOCKED_WORD` — title contains `blocked`

Zero host/core edits. No interim hook.

## Tests

| Spec | Coverage |
| ---- | -------- |
| `profile-policy-override.spec.mjs` | expansion preserves `workspacePolicy`; catalog forbids profile-embedded policy |
| `profile-policy-override.spec.ts` | codegen binding + pipeline stage metadata + short-circuit |

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw6-05b-profile-policy-override-proof.md`.*
