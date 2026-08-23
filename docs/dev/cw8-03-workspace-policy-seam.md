# CW8-03 — Workspace policy hook seam (implementation)

**Verdict:** Implementation  
**Ledger task:** CW8-03  
**Status:** Manifest `workspacePolicy` → codegen bindings → `workspacePolicyValidation` stage  
**Prepared:** 2026-08-23  
**Design contract:** [`cw8-01-validation-pipeline-contract.md`](cw8-01-validation-pipeline-contract.md)

---

## 1. Scope

| Deliverable | Location |
| ----------- | -------- |
| Manifest schema | `manifest.schema.ts` — `workspacePolicy: { module, export }` |
| Codegen domain | `validation-pipeline.mjs` — `generateWorkspacePolicyValidationBindings` |
| Generated bindings | `apps/api/src/tours/workspace-policy-validation-bindings.generated.ts` |
| Pipeline runner | `run-workspace-validation-pipeline.ts` — policy module after flat hooks + publish gate |
| Synthetic proof | `packages/workspaces/policy-cert` — two custom rules, zero host product branches |

**Semantics:**

- Optional policy module; absent binding → deterministic noop (flat hooks only).
- One workspace manifest may declare one `workspacePolicy` block (author-only; profile catalog forbids policy modules).
- Dispatch by generated `workspaceType` row — **no** `if (workspaceId === "denali")` in generic runner.
- Policy `validate(ctx)` is additive; cannot skip shared/capability stages.
- Stage order within `workspacePolicyValidation`: flat hooks → `validatePublishReadiness` → manifest policy module.

**Out of scope:** Denali/Urban migration (CW8-04/05), CW6-05B full proof, legacy flat-hook removal (CW8-06).

---

## 2. Binding shape

```json
"workspacePolicy": {
  "module": "./policy/tour-policy",
  "export": "createTourWorkspacePolicyValidator"
}
```

Factory returns `WorkspacePolicyValidator` (`validate?: (ctx) => WorkspaceViolation | null`).

---

## 3. Tests

| Spec | Coverage |
| ---- | -------- |
| `workspace-policy-module.spec.ts` | policy-cert two-rule short-circuit + stage metadata |
| `unified-manifest-composition.spec.mjs` | profile + `workspaceEquipment` + `workspacePolicy` coexistence |

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw8-03-workspace-policy-seam.md`.*
