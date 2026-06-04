import type { WorkspaceWizardSurface } from "@app-tour/workspace-sdk/plugin-types";

import { PlatformCoreError } from "../errors/platform-core.error";
import type { RenderFieldPlan, RenderStepPlan } from "../types/render-plan";
import type { RuleContextResolution } from "../types/rule-context-resolution";
import { isFieldEffectivelyHidden } from "./field-visibility";
import type { FieldRegistryEngine } from "./field-registry.engine";
import type { RuleEngine } from "./rule.engine";
import type { RuleEngineScope } from "./rule-engine.scope";
import { listActiveSteps } from "./render-plan.steps";

export type RenderPlanBuildOptions = {
  /** Default false — workspace product flags must not leak into headless plan. */
  readonly includeWorkspaceStepUiHints?: boolean;
};

/**
 * Builds a headless render plan for the wizard UI (phase 3+).
 *
 * Policy: only **active** steps are included; empty/hidden steps are omitted.
 * Hidden fields (inactiveFieldGroups + rule overrides) are excluded from rows.
 */
export function buildRenderPlan(
  wizard: WorkspaceWizardSurface,
  fieldEngine: FieldRegistryEngine,
  ruleEngine: RuleEngine,
  context: RuleContextResolution,
  options: RenderPlanBuildOptions = {},
): readonly RenderStepPlan[] {
  const scope = ruleEngine.createScope(context);
  const plans: RenderStepPlan[] = [];

  const stepUiHints =
    options.includeWorkspaceStepUiHints === true && wizard.wizardCapacityStepRedundant
      ? ({ wizardCapacityStepRedundant: "true" } as const)
      : undefined;

  for (const stepId of listActiveSteps(wizard, fieldEngine, scope)) {
    const fields = buildFieldsForStep(wizard, fieldEngine, stepId, scope);
    if (fields.length > 0) {
      plans.push({ stepId, fields, uiHints: stepUiHints });
    }
  }

  return plans;
}

function buildFieldsForStep(
  wizard: WorkspaceWizardSurface,
  fieldEngine: FieldRegistryEngine,
  stepId: string,
  scope: RuleEngineScope,
): readonly RenderFieldPlan[] {
  const rows: RenderFieldPlan[] = [];

  for (const field of fieldEngine.listByStep(stepId)) {
    if (isFieldEffectivelyHidden(wizard, fieldEngine, scope, field.id)) {
      continue;
    }
    rows.push(toRenderFieldPlan(fieldEngine, field.id, scope));
  }

  return rows;
}

function toRenderFieldPlan(
  fieldEngine: FieldRegistryEngine,
  fieldId: string,
  scope: RuleEngineScope,
): RenderFieldPlan {
  const entry = fieldEngine.getById(fieldId);
  if (!entry) {
    throw new PlatformCoreError(
      "UNKNOWN_FIELD_ID",
      `Unknown field id "${fieldId}" while building render plan`,
    );
  }
  const effective = scope.resolveEffectiveField(fieldId);

  return {
    fieldId: entry.id,
    kind: entry.kind,
    canonicalPath: entry.canonicalPath,
    required: effective.required,
    // Omitted hidden fields are excluded above; row.hidden is not the visibility authority (BL-04).
    hidden: false,
    stepId: entry.stepId,
    uiHints: entry.kind === "composite" ? { compositeId: entry.id } : undefined,
  };
}

/**
 * @internal Re-export for step visibility unit tests in
 * `test/unit/engine/render-plan.steps.spec.ts`.
 */
export { getStepVisibility, listActiveSteps, listStepIds } from "./render-plan.steps";
