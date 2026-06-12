import type { RenderStepPlan } from "@app-tour/platform-core";

import { DENALI_CANONICAL_TO_FORM_PATH_MAP } from "../rules/generated/denaliCanonicalPathMap.generated";
import {
  getCanonicalValueFromDraft,
  type CanonicalWizardDraftEnvelope,
} from "./canonical-draft-access";

export type WizardResumeStepLike = {
  readonly stepId: string;
  readonly fields: readonly { readonly canonicalPath: string; readonly hidden?: boolean }[];
};

export function hasNonEmptyCanonicalValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.length > 0 && value.some((entry) => hasNonEmptyCanonicalValue(entry));
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((entry) =>
      hasNonEmptyCanonicalValue(entry)
    );
  }
  return false;
}

function asDraftEnvelope(draft: Readonly<Record<string, unknown>>): CanonicalWizardDraftEnvelope {
  if (draft.data != null && typeof draft.data === "object" && !Array.isArray(draft.data)) {
    return { data: draft.data as Record<string, unknown> };
  }
  return { data: draft as Record<string, unknown> };
}

/** Read canonical field from flat canonical storage or legacy nested form paths. */
export function readDenaliDraftFieldValue(
  draft: Readonly<Record<string, unknown>>,
  canonicalPath: string,
  canonicalToFormPath: Readonly<Record<string, string>> = DENALI_CANONICAL_TO_FORM_PATH_MAP
): unknown {
  const envelope = asDraftEnvelope(draft);
  const trimmed = canonicalPath.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const candidates = [trimmed];
  const formPath = canonicalToFormPath[trimmed];
  if (formPath != null && formPath !== trimmed) {
    candidates.push(formPath);
  }

  for (const path of candidates) {
    const value = getCanonicalValueFromDraft(envelope, path);
    if (hasNonEmptyCanonicalValue(value)) {
      return value;
    }
  }

  return undefined;
}

/** Resume wizard at saved step, or infer furthest step with user-entered data when saved index is 0. */
export function resolveDenaliInitialStepIndex(
  draft: Readonly<Record<string, unknown>>,
  steps: readonly WizardResumeStepLike[],
  savedStepIndex: number,
  canonicalToFormPath: Readonly<Record<string, string>> = DENALI_CANONICAL_TO_FORM_PATH_MAP
): number {
  const maxIndex = Math.max(0, steps.length - 1);
  const clampedSaved = Math.min(Math.max(savedStepIndex, 0), maxIndex);

  if (clampedSaved > 0) {
    return clampedSaved;
  }

  let furthestStepWithData = 0;
  for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
    const step = steps[stepIndex];
    if (step == null) {
      continue;
    }
    const hasData = step.fields
      .filter((field) => field.hidden !== true)
      .some((field) => {
        const path = field.canonicalPath.trim();
        if (path.length === 0) {
          return false;
        }
        return hasNonEmptyCanonicalValue(
          readDenaliDraftFieldValue(draft, path, canonicalToFormPath)
        );
      });
    if (hasData) {
      furthestStepWithData = stepIndex;
    }
  }

  return furthestStepWithData;
}

export function resolveDenaliInitialStepIndexFromHostInput(input: {
  readonly draft: Readonly<Record<string, unknown>>;
  readonly visibleSteps: readonly unknown[];
  readonly savedStepIndex: number;
}): number {
  return resolveDenaliInitialStepIndex(
    input.draft,
    input.visibleSteps as readonly RenderStepPlan[],
    input.savedStepIndex
  );
}
