# Architecture (Infrastructure Bible)

**Purpose:** Describe *how* the registry-driven wizard stack works.  
**Not here:** product rules, workspace profiles, field catalogs, or domain copy.

**Deeper ops:** [`denali/`](./denali/) (troubleshooting, visibility audit, adapter detail).

---

## 1. The Field Lifecycle

Every form field passes through five layers. Skip a layer and the field will misbehave (invisible, empty on navigation, or wrong on submit).

| Step | What | Owner |
|------|------|--------|
| **1. Registry** | Declare canonical path, RHF path, step, Zod kind, visibility tags, wire projection, `inRuleModel`. | `denaliFieldRegistryData.ts` |
| **2. Codegen** | Emit rule set, path map, Zod schema, conditional-required lists. | `pnpm --filter web generate:denali-wizard` |
| **3. Canonical model** | Typed normalized tour shape used for sync, validation, and templates. | `@repo/types` + `denaliCanonicalFromForm` |
| **4. Adapter sync** | Bidirectional map between RHF form and canonical (round-trip). | `denaliCanonicalFormAdapter.ts` |
| **5. UI binding** | Step component mounts control + visibility gate; RHF holds user input. | `steps/*.tsx` + `useDenaliStepFieldRules` |

```text
Registry → Codegen → Canonical Model ↔ Adapter Sync ↔ RHF ← UI Binding
```

---

## 2. The Visibility Rule

**Registry entry ≠ rendered field.**

| `inRuleModel` | Rule matrix | UI responsibility |
|---------------|-------------|-------------------|
| `true` | Field appears in generated `denaliRuleSet` (`hidden` / `step` per category×duration). | Mount control; gate with `isVisible(path, form)` on the owning step. |
| `false` | **Not** in the matrix. Defaults to hidden unless `contextualVisibility` is set. | **Mandatory:** manual JSX on the registry `stepId` + `useDenaliStepFieldRules(stepId)`. |

If `inRuleModel: false` and there is no `contextualVisibility`, `isVisible` returns **false** on steps (registry-only fields are invisible by design).

Capability / form-state gates use `contextualVisibility` on the registry row; the step must still render the control when `isVisible` is true.

---

## 3. The Data Sinkhole

Two stores exist: **RHF form state** (what the user edits) and **canonical state** (what invariants, step navigation, and submit normalization use).

Without adapter mapping:

- Form → canonical sync drops unmapped paths.
- Canonical → form sync does not restore them.
- `reset(..., { keepDefaultValues: true })` on step change can surface stale defaults instead of user input.

**Adapter sync is mandatory** for any value that must survive step navigation, draft restore, or submit sanitization. Map both directions (or shared helpers used by both).

Hidden leaves are cleared by `clearDenaliNonVisibleFormValues` (via `normalizeDenaliWizardForm` / invariant pass) so invisible data does not reach the API. That pass operates on RHF; canonical is re-derived from the cleaned form.

---

## 4. Adding a Field (Checklist)

1. **Registry** — Add row: `canonicalPath`, `rhfPath`, `zodPath`, `stepId`, `zodKind`, `inRuleModel`, tags, `contextualVisibility` if registry-only, `wire`.
2. **Codegen** — `pnpm --filter web generate:denali-wizard` then `pnpm --filter web audit:denali-registry`.
3. **Canonical** — Extend `DenaliCanonicalTourModel` (+ `denaliCanonicalFromForm` if submit/template reads it).
4. **Adapter** — Map in `denaliFormToCanonical` and `denaliCanonicalToForm` (round-trip test).
5. **UI** — Mount on the correct step; `useDenaliStepFieldRules(stepId)` + `isVisible(path, form)`; bind with `useController` / `register`.
6. **Defaults** — Ensure Zod defaults / `buildDenaliTourCreateDefaultValues` include the path.
7. **Payload** — If `wire` is not auto-applied, add explicit projection to create/update DTO builders.
8. **Sanitization** — Confirm hidden-state clearing does not wipe the field when it should be visible (pass `workspaceFormProfile` where capability gates apply).

---

*Business rules live in the registry matrix, templates, and API contracts—not in this document.*
