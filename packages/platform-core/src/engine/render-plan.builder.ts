import type { WorkspaceWizardSurface } from "@app-tour/workspace-sdk";

import { PlatformCoreError } from "../errors/platform-core.error";
import type { RenderFieldPlan, RenderStepPlan } from "../types/render-plan";
import type { RuleContext } from "../types/rule-context";
import { isFieldEffectivelyHidden } from "./field-visibility";
import { FieldRegistryEngine } from "./field-registry.engine";
import type { RuleEngine } from "./rule.engine";
import type { RuleEngineScope } from "./rule-engine.scope";
import { StepEngine } from "./step.engine";

/**
 * Builds a headless render plan for the wizard UI (phase 3+).
 *
 * Policy: only **active** steps are included; empty/hidden steps are omitted.
 * Hidden fields (inactiveFieldGroups + rule overrides) are excluded from rows.
 */
export class RenderPlanBuilder {
  private readonly stepEngine: StepEngine;

  constructor(
    private readonly wizard: WorkspaceWizardSurface,
    private readonly fieldEngine: FieldRegistryEngine,
    private readonly ruleEngine: RuleEngine,
  ) {
    this.stepEngine = new StepEngine(wizard, fieldEngine);
  }

  build(context: RuleContext): readonly RenderStepPlan[] {
    const scope = this.ruleEngine.createScope(context);
    const plans: RenderStepPlan[] = [];

    const stepUiHints = this.wizard.wizardCapacityStepRedundant
      ? ({ wizardCapacityStepRedundant: "true" } as const)
      : undefined;

    for (const stepId of this.stepEngine.listActiveSteps(scope)) {
      const fields = this.buildFieldsForStep(stepId, scope);
      if (fields.length > 0) {
        plans.push({ stepId, fields, uiHints: stepUiHints });
      }
    }

    return plans;
  }

  private buildFieldsForStep(
    stepId: string,
    scope: RuleEngineScope,
  ): readonly RenderFieldPlan[] {
    const rows: RenderFieldPlan[] = [];

    for (const field of this.fieldEngine.listByStep(stepId)) {
      if (isFieldEffectivelyHidden(this.wizard, this.fieldEngine, scope, field.id)) {
        continue;
      }
      rows.push(this.toRenderFieldPlan(field.id, scope));
    }

    return rows;
  }

  private toRenderFieldPlan(
    fieldId: string,
    scope: RuleEngineScope,
  ): RenderFieldPlan {
    const entry = this.fieldEngine.getById(fieldId);
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
      hidden: false,
      stepId: entry.stepId,
      uiHints:
        entry.kind === "composite" ? { compositeId: entry.id } : undefined,
    };
  }
}
