import { getDenaliFieldCompletionWeight } from "../../field-registry/denaliFieldCompletionWeights";
import type { RenderStepPlan } from "@app-tour/platform-core";

import {
  type DenaliTourWizardDraft,
  getCanonicalValue,
} from "../../draft/denali-tour-wizard-draft";

/** Whether a visible wizard field has operator-provided content (11.7-T9). */
export function isDenaliWizardFieldFilled(
  draft: DenaliTourWizardDraft,
  canonicalPath: string
): boolean {
  const value = getCanonicalValue(draft, canonicalPath);
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (typeof value === "boolean") {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }
  return true;
}

export type DenaliWizardCompletionSnapshot = {
  readonly earned: number;
  readonly total: number;
  readonly percent: number;
};

/** Weighted completion across visible render-plan fields (excludes review step). */
export function computeDenaliWizardCompletion(
  draft: DenaliTourWizardDraft,
  visibleSteps: readonly RenderStepPlan[]
): DenaliWizardCompletionSnapshot {
  let earned = 0;
  let total = 0;

  for (const step of visibleSteps) {
    if (step.stepId === "review") {
      continue;
    }
    for (const field of step.fields) {
      const weight = getDenaliFieldCompletionWeight(field.canonicalPath);
      if (weight <= 0) {
        continue;
      }
      total += weight;
      if (isDenaliWizardFieldFilled(draft, field.canonicalPath)) {
        earned += weight;
      }
    }
  }

  if (total === 0) {
    return { earned: 0, total: 0, percent: 0 };
  }

  return {
    earned,
    total,
    percent: Math.round((earned / total) * 100),
  };
}
