import type { RenderStepPlan } from "../types/render-plan";

export type GenericWizardResumeStepLike = {
  readonly stepId: string;
  readonly fields: readonly { readonly canonicalPath: string }[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readDraftData(draft: Readonly<Record<string, unknown>>): Record<string, unknown> {
  if (draft.data != null && typeof draft.data === "object" && !Array.isArray(draft.data)) {
    return draft.data as Record<string, unknown>;
  }
  return draft as Record<string, unknown>;
}

/** Conservative non-empty check — no workspace-specific phantom scalar filtering. */
export function hasGenericNonEmptyCanonicalValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length > 0 && value.some((entry) => hasGenericNonEmptyCanonicalValue(entry));
  }
  if (isRecord(value)) {
    return Object.values(value).some((entry) => hasGenericNonEmptyCanonicalValue(entry));
  }
  return false;
}

function readCanonicalValueFromDraft(
  draft: Readonly<Record<string, unknown>>,
  canonicalPath: string
): unknown {
  const data = readDraftData(draft);
  const segments = canonicalPath
    .split(".")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    return undefined;
  }

  let cursor: unknown = data;
  for (const segment of segments) {
    if (!isRecord(cursor)) {
      return undefined;
    }
    cursor = cursor[segment];
  }
  return cursor;
}

/** True when every visible step exposes a stable semantic stepId. */
export function stepsHaveStableResumeIdentity(
  steps: readonly GenericWizardResumeStepLike[]
): boolean {
  if (steps.length === 0) {
    return false;
  }
  return steps.every((step) => typeof step.stepId === "string" && step.stepId.trim().length > 0);
}

/**
 * Generic platform resume — infers furthest step with non-empty canonical field data when
 * saved index is 0 and visible steps expose stable stepIds. No workspace-specific phantom rules.
 */
export function resolveGenericInitialStepIndex(
  draft: Readonly<Record<string, unknown>>,
  steps: readonly GenericWizardResumeStepLike[],
  savedStepIndex: number,
  options?: { readonly skipFieldInference?: boolean }
): number {
  const maxIndex = Math.max(0, steps.length - 1);
  const clampedSaved = Math.min(Math.max(savedStepIndex, 0), maxIndex);

  if (clampedSaved > 0 || options?.skipFieldInference === true) {
    return clampedSaved;
  }

  if (!stepsHaveStableResumeIdentity(steps)) {
    return 0;
  }

  let furthestStepWithData = 0;
  for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
    const step = steps[stepIndex];
    if (step == null) {
      continue;
    }
    const hasData = step.fields.some((field) => {
      const path = field.canonicalPath.trim();
      if (path.length === 0) {
        return false;
      }
      const value = readCanonicalValueFromDraft(draft, path);
      return hasGenericNonEmptyCanonicalValue(value);
    });
    if (hasData) {
      furthestStepWithData = stepIndex;
    }
  }

  return furthestStepWithData;
}

export function resolveGenericInitialStepIndexFromHostInput(input: {
  readonly draft: Readonly<Record<string, unknown>>;
  readonly visibleSteps: readonly unknown[];
  readonly savedStepIndex: number;
  readonly skipFieldInference?: boolean;
}): number {
  return resolveGenericInitialStepIndex(
    input.draft,
    input.visibleSteps as readonly RenderStepPlan[],
    input.savedStepIndex,
    { skipFieldInference: input.skipFieldInference }
  );
}
