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

/** Sanitize / template scalars that must not advance step-inference past basics. */
const PHANTOM_CANONICAL_STRINGS = new Set([
  "",
  "none",
  "false",
  "true",
  "0",
  "draft",
  "mountain_day",
]);

const EMPTY_DRAFT_SKIP_PATHS = new Set([
  "category",
  "publishStatus",
  "leaderUserIds",
  "startDateTime",
  "endDateTime",
  "approximateReturnTime",
  "requiresLocalGuide",
  "requiresManualAdminApproval",
]);

const EMPTY_DRAFT_SEED_TITLE_PATTERNS = [/^تور جدید$/i, /^new tour$/i] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** True for sanitize/template defaults that look non-empty but are not user progress. */
export function isPhantomCanonicalScalar(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (value === false) {
    return true;
  }
  if (value === true) {
    return false;
  }
  if (typeof value === "number") {
    return value === 0;
  }
  if (typeof value === "string") {
    return PHANTOM_CANONICAL_STRINGS.has(value.trim().toLowerCase());
  }
  return false;
}

/**
 * Step inference treats only meaningful user input as non-empty.
 * Ignores phantom defaults (e.g. pricing.requiresPayment "false", transport "none").
 */
export function hasNonEmptyCanonicalValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return !isPhantomCanonicalScalar(value);
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

function isSeedTemplateTitle(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return true;
  }
  return EMPTY_DRAFT_SEED_TITLE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function draftDataHasUserProgress(data: Record<string, unknown>, pathPrefix = ""): boolean {
  for (const [key, value] of Object.entries(data)) {
    const path = pathPrefix.length > 0 ? `${pathPrefix}.${key}` : key;
    if (key === "basics" || key === "details") {
      continue;
    }
    if (EMPTY_DRAFT_SKIP_PATHS.has(path)) {
      continue;
    }
    if (value === null || value === undefined) {
      continue;
    }
    if (path === "title") {
      if (!isSeedTemplateTitle(value) && hasNonEmptyCanonicalValue(value)) {
        return true;
      }
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length > 0 && value.some((entry) => hasNonEmptyCanonicalValue(entry))) {
        return true;
      }
      continue;
    }
    if (isRecord(value)) {
      if (draftDataHasUserProgress(value, path)) {
        return true;
      }
      continue;
    }
    if (hasNonEmptyCanonicalValue(value)) {
      return true;
    }
  }
  return false;
}

/** True when the envelope has only template/sanitize defaults — safe to open at step 0. */
export function isDraftEssentiallyEmpty(draft: Readonly<Record<string, unknown>>): boolean {
  return !draftDataHasUserProgress(asDraftEnvelope(draft).data);
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

/** True when a canonical path should advance resume step inference (excludes template defaults). */
export function shouldCountCanonicalPathForResumeInference(
  canonicalPath: string,
  value: unknown
): boolean {
  const path = canonicalPath.trim();
  if (path.length === 0 || EMPTY_DRAFT_SKIP_PATHS.has(path)) {
    return false;
  }
  if (path === "title" && isSeedTemplateTitle(value)) {
    return false;
  }
  return true;
}

/** Resume wizard at saved step, or infer furthest step with user-entered data when saved index is 0. */
export function resolveDenaliInitialStepIndex(
  draft: Readonly<Record<string, unknown>>,
  steps: readonly WizardResumeStepLike[],
  savedStepIndex: number,
  canonicalToFormPath: Readonly<Record<string, string>> = DENALI_CANONICAL_TO_FORM_PATH_MAP,
  options?: { readonly skipFieldInference?: boolean }
): number {
  const maxIndex = Math.max(0, steps.length - 1);
  const clampedSaved = Math.min(Math.max(savedStepIndex, 0), maxIndex);

  if (clampedSaved > 0 || options?.skipFieldInference === true) {
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
        const value = readDenaliDraftFieldValue(draft, path, canonicalToFormPath);
        if (!shouldCountCanonicalPathForResumeInference(path, value)) {
          return false;
        }
        return hasNonEmptyCanonicalValue(value);
      });
    if (hasData) {
      furthestStepWithData = stepIndex;
    }
  }

  return furthestStepWithData;
}

/** Resume alias for draft envelope tests — delegates to {@link resolveDenaliInitialStepIndex}. */
export function resolveDenaliWizardResumeStepIndex(
  draft: Readonly<Record<string, unknown>>,
  steps: readonly WizardResumeStepLike[],
  savedStepIndex: number
): number {
  return resolveDenaliInitialStepIndex(draft, steps, savedStepIndex);
}

export function resolveDenaliInitialStepIndexFromHostInput(input: {
  readonly draft: Readonly<Record<string, unknown>>;
  readonly visibleSteps: readonly unknown[];
  readonly savedStepIndex: number;
  readonly skipFieldInference?: boolean;
}): number {
  return resolveDenaliInitialStepIndex(
    input.draft,
    input.visibleSteps as readonly RenderStepPlan[],
    input.savedStepIndex,
    DENALI_CANONICAL_TO_FORM_PATH_MAP,
    { skipFieldInference: input.skipFieldInference }
  );
}
