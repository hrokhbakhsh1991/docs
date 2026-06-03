import type { WorkspaceWizardSurface } from "@app-tour/workspace-sdk/plugin-types";

import type { StepVisibility } from "../types/step-state";
import { isFieldEffectivelyHidden } from "./field-visibility";
import type { FieldRegistryEngine } from "./field-registry.engine";
import type { RuleEngineScope } from "./rule-engine.scope";

/** §4.4 ordering_logic: wizard.roots order first, then registry discovery order for the rest. */
export function listStepIds(
  wizard: WorkspaceWizardSurface,
  fieldEngine: FieldRegistryEngine,
): readonly string[] {
  const discoveryOrder: string[] = [];
  const seen = new Set<string>();

  for (const field of fieldEngine.listAll()) {
    if (!seen.has(field.stepId)) {
      seen.add(field.stepId);
      discoveryOrder.push(field.stepId);
    }
  }
  for (const stepId of wizard.roots) {
    if (!seen.has(stepId)) {
      seen.add(stepId);
      discoveryOrder.push(stepId);
    }
  }

  const inRoots = new Set(wizard.roots);
  const rooted = wizard.roots.filter((id) => seen.has(id));
  const orphan = discoveryOrder.filter((id) => !inRoots.has(id));
  return [...rooted, ...orphan];
}

export function getStepVisibility(
  wizard: WorkspaceWizardSurface,
  fieldEngine: FieldRegistryEngine,
  stepId: string,
  scope: RuleEngineScope,
): StepVisibility {
  const fields = fieldEngine.listByStep(stepId);
  if (fields.length === 0) {
    return "empty";
  }

  let visibleCount = 0;
  for (const field of fields) {
    if (!isFieldEffectivelyHidden(wizard, fieldEngine, scope, field.id)) {
      visibleCount += 1;
    }
  }

  if (visibleCount === 0) {
    return "hidden";
  }

  return "active";
}

export function listActiveSteps(
  wizard: WorkspaceWizardSurface,
  fieldEngine: FieldRegistryEngine,
  scope: RuleEngineScope,
): readonly string[] {
  return listStepIds(wizard, fieldEngine).filter(
    (stepId) => getStepVisibility(wizard, fieldEngine, stepId, scope) === "active",
  );
}
