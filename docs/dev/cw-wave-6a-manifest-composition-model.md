# CW Wave 6A — Unified manifest composition model

**Status:** Reconciliation complete — **no material conflicts**; shared schema/codegen integration deferred to Wave 6B  
**Prepared:** 2026-08-23 (Wave 6A coordinator)  
**Inputs:** [`cw6-01-starter-profile-contract.md`](cw6-01-starter-profile-contract.md), [`cw7-01-workspace-equipment-contract.md`](cw7-01-workspace-equipment-contract.md), [`cw8-01-validation-pipeline-contract.md`](cw8-01-validation-pipeline-contract.md), [`decisions/DEC-CW-05-evidence.md`](decisions/DEC-CW-05-evidence.md)

---

## 1. Conceptual model (three roles)

```text
workspace manifest (author)
├── profile          optional string ref → platform catalog preset
├── capabilities     top-level extension blocks (repo convention)
└── policy           workspacePolicy module binding (author-only)
```

**Binding rule:** profile + capabilities + policy are **conceptually** three layers, but **capabilities are not nested** under a `capabilities` namespace. Each capability is a **top-level manifest extension block** matching the existing `workspaceBooking` / `workspaceFinance` pattern. Profile catalog entries use the same keys inside `capabilityDefaults`.

---

## 2. Role definitions

### 2.1 Profile (`profile: "<id>"`)

| Property  | Rule                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------- |
| Syntax    | Singular string slug on workspace manifest; reject `extends`, plural `profiles`, profile-on-profile chains v1 |
| Ownership | Platform catalog `profiles/<id>.profile.json`; workspaces reference by id                                     |
| Semantics | Named composition preset — deterministic bundle of capability defaults expanded **at codegen**                |
| Not       | Inheritance, superclass, runtime merge, deploy-profile (`WORKSPACE_DEPLOY_PROFILE`)                           |

Profile file shape:

```json
{
  "id": "starter-outdoor",
  "version": 1,
  "capabilityDefaults": {
    "workspaceBooking": { "supported": true },
    "workspaceFinance": { "supported": true },
    "catalogRegistrationFlow": { "steps": { "mode": "shared" } }
  }
}
```

`capabilityDefaults` keys must be **known manifest extension blocks** already consumed by workspace-registry codegen domains.

### 2.2 Capabilities (top-level blocks)

Distributed top-level blocks — **not** a nested `capabilities` object:

| Block                     | Phase           | Role                                                                   |
| ------------------------- | --------------- | ---------------------------------------------------------------------- |
| `workspaceBooking`        | existing        | Booking pipeline binding                                               |
| `workspaceFinance`        | existing        | Finance capability                                                     |
| `workspaceEquipment`      | CW7-01          | Equipment reference data + surfaces (first new formal tour capability) |
| `workspaceTransport`      | CW7-05 (future) | Transport snapshot contract                                            |
| `catalogPresentation`     | existing        | Catalog/detail presentation gates                                      |
| `catalogRegistrationFlow` | existing        | Registration flow steps                                                |
| `memberProfile`           | existing        | Member profile field policy                                            |
| `tenantBrandingDefaults`  | existing        | Branding defaults (also profile-defaultable)                           |

Each block declares: `supported`, optional module/export bindings, capability-specific flags. Codegen domains emit dispatch tables from **effective manifest** (post-profile expansion).

**CW7 boundary:** `workspaceEquipment` is top-level like `workspaceBooking` — **not** under a `capabilities` namespace. Nested `workspaceEquipment.capabilities.operatorSettings` is **surface flags inside the block**, not a manifest namespace.

### 2.3 Policy (`workspacePolicy`)

| Property      | Rule                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------- |
| Syntax        | Top-level block with `module` + `export` factory binding                                          |
| Runtime stage | `workspacePolicyValidation` (third pipeline stage, CW8)                                           |
| Ownership     | Workspace package policy module; **never** embedded in profile catalog                            |
| Scope         | Workspace-specific product rules (Urban capacity range, Denali publish matrix, custom cert rules) |

```json
"workspacePolicy": {
  "module": "./policy/tour-policy",
  "export": "createTourWorkspacePolicyValidator"
}
```

Flat `WorkspaceValidationHooks` map into policy stage until CW8-06 retires legacy path.

---

## 3. Override precedence

Codegen expansion order (CW6-01 binding):

```text
1. Load author workspace.manifest.json
2. If profile absent → effective = author manifest
3. If profile present:
   a. Resolve profiles/<id>.profile.json (fail PROFILE_NOT_FOUND)
   b. effective = deepMerge(profile.capabilityDefaults, authorManifest) — author wins leaves
   c. Strip profile key from effective output
4. Validate effective manifest (Zod + semantics)
5. Emit codegen from effective manifest
```

| Layer                                      | Precedence  |
| ------------------------------------------ | ----------- |
| Workspace manifest (author)                | **Highest** |
| Profile `capabilityDefaults`               | Middle      |
| Workspace package plugin built-in defaults | Lowest      |

**Merge rules:**

- Objects: recursive merge; author leaf replaces profile leaf
- Arrays: author replaces profile entirely (no element-wise merge)
- Scalars: author wins
- `null` in author: explicit author intent

**Policy exception:** `workspacePolicy` is **author-manifest only**. Profile catalog must **not** embed workspace-specific policy modules. CW6-05B proof uses author manifest `workspacePolicy` on a profile-scaffolded workspace.

**Capability vs profile interaction:** Profile seeds capability blocks; author overrides any leaf. `capabilityValidation` stage dispatches from **enabled blocks on effective manifest** after expansion — not from raw author manifest alone.

---

## 4. Validation pipeline alignment (CW8)

Ordered stages on effective manifest + plugin:

```text
sharedValidation → capabilityValidation → workspacePolicyValidation
```

| Stage                       | Source                                                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `sharedValidation`          | platform-core canonical / structural checks                                                                                      |
| `capabilityValidation`      | Generated bindings from enabled capability blocks (`workspaceBooking`, `workspaceEquipment`, publish ports, capacity strategies) |
| `workspacePolicyValidation` | `workspacePolicy` module + flat plugin hooks (`checkCapacity`, `validatePublishReadiness`)                                       |

Short-circuit: first violation wins. `validationMode: draft` skips publish-only policy substeps.

---

## 5. Conflict assessment

| Candidate conflict                                           | Resolution                                                                                   |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Profile `capabilityDefaults` vs top-level capability blocks  | **Aligned** — same keys, profile is preset layer                                             |
| `workspaceEquipment` namespace vs `workspaceBooking` pattern | **Aligned** — top-level block; inner `capabilities` object is surface flags only             |
| `workspacePolicy` vs profile composition                     | **Aligned** — policy author-only; profile never carries policy modules                       |
| Three independent extension syntaxes                         | **Rejected** — one syntax family: top-level extension blocks + optional `profile` string ref |
| Nested `capabilities` namespace                              | **Not adopted** — preserves repo convention                                                  |

**Verdict:** **PASS** — no material conflict. Wave 6B may proceed with coordinator-owned schema/codegen integration.

---

## 6. Codegen ownership (coordinator-owned files)

Workers must not edit concurrently without coordinator merge:

| File                                                                                 | Wave 6B task                                                            |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `packages/workspace-sdk/src/manifest.schema.ts`                                      | CW6-02 `profile`; CW7-02 `workspaceEquipment`; CW8-03 `workspacePolicy` |
| `scripts/generate-workspace-registry.mjs`                                            | Profile expansion hook before domain sync                               |
| `scripts/codegen/workspace-registry/orchestrator.mjs`                                | Effective manifest input                                                |
| `scripts/codegen/workspace-registry/domains/profile-expansion.mjs`                   | **New** CW6-02                                                          |
| `scripts/codegen/workspace-registry/domains/equipment.mjs`                           | **New** CW7-02                                                          |
| `scripts/codegen/workspace-registry/domains/validation-pipeline.mjs`                 | **New** CW8-02                                                          |
| `profiles/*.profile.json`                                                            | CW6-03 catalog                                                          |
| `packages/workspace-sdk/src/manifest/workspace-profile-expansion-audit.generated.ts` | CW6-02                                                                  |
| `packages/workspace-sdk/src/catalog/workspace-equipment-capabilities.generated.ts`   | CW7-02                                                                  |
| `packages/workspace-sdk/src/plugin/workspace-validation-pipeline.ts`                 | CW8-02                                                                  |
| `packages/workspace-sdk/src/public-api.ts`                                           | Coordinator export barrel                                               |
| `apps/api/src/tours/run-workspace-validation-pipeline.ts`                            | CW8-02                                                                  |
| `docs/dev/workspace-registry-codegen-modularization.mdoc`                            | Domain index                                                            |

Domain workers add outputs **through** orchestrator domain modules only.

---

## 7. DEC-CW-05 status

**OPEN** — no Architect approval. Blocks **CW5-10 only**. Does not block Wave 6B profile/equipment/pipeline implementation.

**Evidence recommendation:** Option D (hybrid) — platform noop default + optional manifest `wizardResume` with `mode: "noop"` or `mode: "module"` binding. Defer generic `fieldInference` until second workspace needs shared inference.

---

## 8. Wave 6A closure

| Task      | Ledger | Closure                                               |
| --------- | ------ | ----------------------------------------------------- |
| CW6-01    | `[x]`  | Design contract PASS; CW6-02 implements expansion     |
| CW7-01    | `[x]`  | Design contract PASS; CW7-02 implements codegen       |
| CW8-01    | `[x]`  | Design contract PASS; CW8-02 implements runner        |
| CW5-10    | `[!]`  | Deferred — DEC-CW-05 OPEN                             |
| DEC-CW-05 | OPEN   | Evidence packet published; Architect approval pending |

**Tests:** No additive contract/type tests in Wave 6A (design-only). Worker specs deferred to CW6-02+, CW7-02+, CW8-02+.

---

_Architect, documentation status: Updated. Link to docs: `docs/dev/cw-wave-6a-manifest-composition-model.md`._
