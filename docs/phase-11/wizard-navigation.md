# Wizard navigation (Phase 11.4)

> **Package:** `@app-tour/wizard-navigation`  
> **Decision:** [DEC-P11-005](appendices/IMPLEMENTATION-DECISIONS.md#dec-p11-005--wizard-navigation-package-114)

## Purpose

Generic **focus** and **scroll-to-first-error** for multi-step wizards — no Denali imports in core. Works with `platform-core` `ValidationResult` via mapper.

## DOM convention (11.4-T4)

| Attribute | Meaning |
| --------- | ------- |
| `data-field-path` | Canonical / form path (primary lookup) |
| `data-field-id` | Render plan `fieldId` (fallback) |

Primitives and composites should expose `data-field-path` on a stable wrapper (see `wizardFieldPathAttributes`).

Default registry selector order:

1. `[data-field-path="{path}"]`
2. `[data-field-id="{path}"]`
3. `[name="{path}"]`

## Core API

```typescript
type ValidationIssue = {
  path: string;
  message: string;
  stepId?: string;
};

interface FieldFocusRegistry {
  resolveSelectors(path: string): readonly string[];
}

function focusWizardField(path, registry, options?): boolean;
function scrollToFirstIssue(issues, registry, goToStep?, options?): Promise<boolean>;
function mapValidationResultToIssues(result, options?): ValidationIssue[];
```

### `focusWizardField`

- Finds first matching element under `options.root` (default `document`)
- Focuses first focusable descendant (`input`, `select`, `textarea`, `button`, `[tabindex]`)
- Scrolls into view unless `scroll: false`

### `scrollToFirstIssue`

1. Takes first issue in array (caller may sort by step order)
2. If `stepId` set and `goToStep` provided → `await goToStep(stepId)` (allows step panel swap)
3. Calls `focusWizardField(issue.path, …)`

### `mapValidationResultToIssues`

Maps `ValidationViolation.fieldId` → `path`. Optional `resolveStepId(fieldId)` attaches wizard step for navigation.

## Web bridge (11.4-T2)

`apps/web/src/wizard/use-wizard-step-validation.ts`:

```typescript
const { focusField, focusFirstFromResult } = useWizardStepValidation({
  goToStep: (stepId) => setActiveStep(stepId),
  resolveStepId: (fieldId) => plan.findStepForField(fieldId),
});
```

Wired on submit + Continue in **11.7** — see [`denali-review-step.md`](denali-review-step.md).

## Verification

- `packages/wizard-navigation/test/*.spec.ts` — happy-dom, mock registry
- `apps/web/test/wizard-field-path-attributes.spec.ts` — attribute helper contract

## Out of scope

- Review step UX → **11.6+**
- Denali-specific focus maps → workspace package if needed later
