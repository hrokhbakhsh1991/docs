# CW6-07 — Profile authoring guide

**Verdict:** Documentation  
**Ledger task:** CW6-07  
**Status:** Authoring guide for declarative workspace profiles  
**Prepared:** 2026-08-23

---

## 1. When to use a profile

Use `profile: "<id>"` on a workspace author manifest when onboarding a club that shares a known capability bundle (booking, finance, registration flow, catalog presentation, member profile) without cloning Denali/Urban modules.

Profiles are **codegen-time expansion only**. Runtime reads the effective manifest after expansion.

**Do not** use profiles to copy workspace-specific policy, equipment field registries, or host product branches.

---

## 2. Author manifest shape

```json
{
  "id": "my-club",
  "version": 1,
  "profile": "starter-outdoor",
  "package": "@app-tour/workspace-my-club",
  "workspaceTypes": ["my-club"],
  "plugin": { "entry": "./plugin", "export": "getWorkspacePlugin" },
  "web": { "entry": "./plugin", "export": "getWorkspacePlugin" }
}
```

Reserved keys (`id`, `version`, `package`, `workspaceTypes`, `plugin`, `profile`) are not merged from the profile catalog. All other top-level keys are **author overrides**.

---

## 3. Scaffold path (CW6-04)

```bash
pnpm run workspace:create -- my-club --profile starter-outdoor
```

`--profile` implies guest L3 scaffold. The command:

1. Validates profile id against `profiles/*.profile.json`
2. Writes `profile` on author manifest
3. Emits `profile.expanded.snapshot.json` for inspection
4. Runs profile expansion audit codegen (`--check` deterministic)

See [`cw6-04-workspace-create-profile.md`](cw6-04-workspace-create-profile.md).

---

## 4. Override precedence

Merge order: **profile `capabilityDefaults` → author manifest** (author wins leaves).

| Value kind | Rule |
| ---------- | ---- |
| Scalar | Author replaces profile |
| Object | Deep merge; author leaves win |
| Array | Author replaces profile entirely |

Codegen records overridden paths in `workspace-profile-expansion-audit.generated.ts`.

---

## 5. Allowed override seams (CW6-05A)

Synthetic `profile-cert` proves declarative overrides without host edits:

| Seam | Example override |
| ---- | ---------------- |
| Theme | `tenantBrandingDefaults`, `themeStylesheets` |
| Intake | `catalogRegistrationFlow.steps.components.intake` |
| Config | `catalogPresentation`, `memberProfile` |

Evidence: [`cw6-05a-profile-override-proof.md`](cw6-05a-profile-override-proof.md).

---

## 6. Workspace policy seam (CW6-05B)

`workspacePolicy` is **author-manifest only**. Profile catalog must not embed policy modules.

```json
"workspacePolicy": {
  "module": "./policy/tour-policy",
  "export": "createTourWorkspacePolicyValidator"
}
```

Rules run in `workspacePolicyValidation` after shared + capability stages (CW8-03). `profile-cert` joins `starter-outdoor` profile with a two-rule policy module.

Evidence: [`cw6-05b-profile-policy-override-proof.md`](cw6-05b-profile-policy-override-proof.md).

---

## 7. Certification (CW6-06)

After expansion, assert exact capability keys:

**`starter-outdoor` certified set:** `workspaceBooking`, `workspaceFinance`, `catalogRegistrationFlow`, `catalogPresentation`, `memberProfile`, `tenantBrandingDefaults`.

Excludes by default: `workspaceEquipment`, `workspacePolicy` (unless author adds them).

Run: `node --test scripts/test/profile-certification.spec.mjs`

---

## 8. Profile catalog authoring

Add profiles under `profiles/<slug>.profile.json`:

```json
{
  "id": "starter-outdoor",
  "version": 1,
  "description": "Outdoor club preset",
  "capabilityDefaults": {
    "workspaceBooking": { "supported": true },
    "workspaceFinance": { "supported": true }
  }
}
```

**Forbidden in `capabilityDefaults`:** `workspacePolicy` (author-only).

Bump `version` on breaking default changes. Optional future `profileVersionPin` on workspace manifest.

Contract: [`cw6-01-starter-profile-contract.md`](cw6-01-starter-profile-contract.md).

---

## 9. Verification checklist

| Step | Command / artifact |
| ---- | ------------------ |
| Expansion determinism | `pnpm run generate:workspace-registry --check` |
| Profile certification | `scripts/test/profile-certification.spec.mjs` |
| Theme/intake/config proof | `scripts/test/profile-cert-override.spec.mjs` |
| Policy join proof | `scripts/test/profile-policy-override.spec.mjs` |
| Manifest validity | `pnpm run guard:workspace-manifests` |

---

## 10. Anti-patterns

| Anti-pattern | Why |
| ------------ | --- |
| Copy Denali wizard modules into profile catalog | Violates composition model; use capability blocks |
| Embed `workspacePolicy` in profile file | Forbidden — workspace-specific policy |
| Host `if (workspaceType)` branches for profile clubs | Use manifest codegen bindings |
| RHF mirror of profile state | Canonical document is SoT |

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw6-07-profile-authoring-guide.md`.*
