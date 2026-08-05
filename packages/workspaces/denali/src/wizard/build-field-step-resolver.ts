import type { RenderStepPlan } from "@app-tour/platform-core";

import { denaliFieldIdForCanonicalPath } from "../denali-plugin-adapter";
import { DENALI_FIELD_DEFINITIONS } from "../field-registry/denaliFieldRegistryData";

/**
 * INV-DENALI-WIZ-011 — composite dependents never appear on the render plan / tenant
 * template field list, but validation still emits their canonical paths. Seed stepId
 * from the Denali field registry so review/submit issue links can navigate.
 *
 * Gap-only: entries already present from the plan/template win. Registry does not
 * override tenant remaps of anchors that appear on the visible step list.
 */
function appendDenaliRegistryStepFallback(
  byCanonicalPath: Map<string, string>,
  byFieldId?: Map<string, string>
): void {
  for (const def of DENALI_FIELD_DEFINITIONS) {
    if (!byCanonicalPath.has(def.canonicalPath)) {
      byCanonicalPath.set(def.canonicalPath, def.stepId);
    }
    const fieldId = denaliFieldIdForCanonicalPath(def.canonicalPath);
    if (byFieldId != null && !byFieldId.has(fieldId)) {
      byFieldId.set(fieldId, def.stepId);
    }
    if (!byCanonicalPath.has(fieldId)) {
      byCanonicalPath.set(fieldId, def.stepId);
    }
  }
}

/** Host / submit hook — resolve validation fieldId → wizard step without a render plan. */
export function resolveDenaliValidationStepId(fieldId: string): string | undefined {
  const byCanonicalPath = new Map<string, string>();
  appendDenaliRegistryStepFallback(byCanonicalPath);
  return byCanonicalPath.get(fieldId);
}

export function buildFieldStepResolverFromTemplate(
  templateSteps: readonly {
    readonly stepId: string;
    readonly enabled?: boolean;
    readonly fields: readonly { readonly canonicalPath: string; readonly hidden?: boolean }[];
  }[]
): (fieldId: string) => string | undefined {
  const byCanonicalPath = new Map<string, string>();
  for (const step of templateSteps) {
    if (step.enabled === false) {
      continue;
    }
    for (const field of step.fields) {
      if (field.hidden === true) {
        continue;
      }
      byCanonicalPath.set(field.canonicalPath, step.stepId);
    }
  }
  appendDenaliRegistryStepFallback(byCanonicalPath);
  return (fieldId: string) => byCanonicalPath.get(fieldId);
}

export function buildFieldStepResolver(
  visibleSteps: readonly RenderStepPlan[]
): (fieldId: string) => string | undefined {
  const byFieldId = new Map<string, string>();
  const byCanonicalPath = new Map<string, string>();
  for (const step of visibleSteps) {
    for (const field of step.fields) {
      byFieldId.set(field.fieldId, step.stepId);
      byCanonicalPath.set(field.canonicalPath, step.stepId);
    }
  }
  appendDenaliRegistryStepFallback(byCanonicalPath, byFieldId);
  return (fieldId: string) => byFieldId.get(fieldId) ?? byCanonicalPath.get(fieldId);
}
