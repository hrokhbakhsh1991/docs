import type { WorkspaceWizardSurface } from "@app-tour/workspace-sdk";

import type { StepVisibility } from "../types/step-state";
import { isFieldEffectivelyHidden } from "./field-visibility";
import type { FieldRegistryEngine } from "./field-registry.engine";
import type { RuleEngineScope } from "./rule-engine.scope";

export class StepEngine {
  constructor(
    private readonly wizard: WorkspaceWizardSurface,
    private readonly fieldEngine: FieldRegistryEngine,
  ) {}

  listStepIds(): readonly string[] {
    const discoveryOrder: string[] = [];
    const seen = new Set<string>();

    for (const field of this.fieldEngine.listAll()) {
      if (!seen.has(field.stepId)) {
        seen.add(field.stepId);
        discoveryOrder.push(field.stepId);
      }
    }

    for (const stepId of this.wizard.roots) {
      if (!seen.has(stepId)) {
        seen.add(stepId);
        discoveryOrder.push(stepId);
      }
    }

    const rootsIndex = new Map(
      this.wizard.roots.map((stepId, index) => [stepId, index] as const),
    );

    const rooted: string[] = [];
    const orphan: string[] = [];

    for (const stepId of discoveryOrder) {
      if (rootsIndex.has(stepId)) {
        rooted.push(stepId);
      } else {
        orphan.push(stepId);
      }
    }

    rooted.sort((a, b) => rootsIndex.get(a)! - rootsIndex.get(b)!);

    return [...rooted, ...orphan];
  }

  getStepVisibility(stepId: string, scope: RuleEngineScope): StepVisibility {
    const fields = this.fieldEngine.listByStep(stepId);
    if (fields.length === 0) {
      return "empty";
    }

    let visibleCount = 0;
    for (const field of fields) {
      if (!isFieldEffectivelyHidden(this.wizard, this.fieldEngine, scope, field.id)) {
        visibleCount += 1;
      }
    }

    if (visibleCount === 0) {
      return "hidden";
    }

    return "active";
  }

  listActiveSteps(scope: RuleEngineScope): readonly string[] {
    return this.listStepIds().filter(
      (stepId) => this.getStepVisibility(stepId, scope) === "active",
    );
  }
}
