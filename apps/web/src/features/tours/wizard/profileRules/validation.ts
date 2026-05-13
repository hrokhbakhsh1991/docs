import type { TourFormProfile } from "@repo/types";

import type { TourCreateFormValues } from "@/components/tours/wizard/schemas/tourCreateSchema";
import type { TourCreateWizardStepId } from "@/features/tours/wizard/stepConfig";

import {
  getProfileRules,
  getStepRule,
  getStepRules,
  getVisibleStepIds,
  isFieldRequiredAtLevel,
} from "./getProfileRules";
import type { WizardFieldPath } from "./types";

/**
 * Pure 3-level validation for the Tour Creation Wizard. Each level consults the rules table
 * via {@link isFieldRequiredAtLevel} / {@link getStepRules} — there is no hard-coded list of
 * required fields here.
 *
 * Levels:
 *
 * - **Autosave** — never enforces `required`. Uses `getStepRule` / `getStepRules` so the
 *   caller is scoped to the **current** wizard step; returns `isValid: true` in v1 so legacy
 *   drafts are never blocked. Reserved for visibility-aware shape-only checks.
 *
 * - **Step navigation** — required fields whose `belongsToStep` matches the step being left,
 *   when that step is visible for the profile. Uses `isFieldRequiredAtLevel(..., "stepNav", ...)`.
 *
 * - **Final submit** — every profile-visible required field at `"submit"` level.
 *
 * Cross-field invariants (e.g. `private_car` + `supplementalPrivateCar`) stay in Zod only until M6.
 */

export type ValidationIssueCode = "required" | "shape";

export type ValidationIssue = {
  readonly path: WizardFieldPath;
  /** Dotted path pre-split for callers that need a `react-hook-form` style array. */
  readonly pathSegments: readonly string[];
  readonly code: ValidationIssueCode;
  readonly message: string;
};

export type ValidationResult = {
  /** `true` when there are zero field `issues` and zero top-level `messages`. */
  readonly isValid: boolean;
  /**
   * Back-compat alias for `isValid` (older call sites / tests). Always identical to `isValid`.
   * Prefer `isValid` in new code.
   */
  readonly ok: boolean;
  /** First error message per dotted field path. */
  readonly fieldErrors: Readonly<Record<string, string>>;
  readonly issues: readonly ValidationIssue[];
  /** Non-field messages (e.g. whole-form); empty for rules-only validation today. */
  readonly messages: readonly string[];
};

const EMPTY_MESSAGES: readonly string[] = Object.freeze([]);

function buildResult(
  issues: readonly ValidationIssue[],
  messages: readonly string[] = EMPTY_MESSAGES,
): ValidationResult {
  const fieldErrors: Record<string, string> = {};
  for (const i of issues) {
    if (fieldErrors[i.path] == null) {
      fieldErrors[i.path] = i.message;
    }
  }
  const isValid = issues.length === 0 && messages.length === 0;
  return Object.freeze({
    isValid,
    ok: isValid,
    fieldErrors: Object.freeze(fieldErrors) as Readonly<Record<string, string>>,
    issues: Object.freeze([...issues]) as readonly ValidationIssue[],
    messages: Object.freeze([...messages]) as readonly string[],
  });
}

/**
 * Persian required messages, keyed by field path. The Zod schema's own copy is the
 * authoritative wording today; these mirror it 1:1 for the four currently-required fields.
 *
 * TODO (M4): when the schema is generated from the rules table, both sources should pull
 * messages from a shared i18n map under `apps/web/messages/`.
 */
const REQUIRED_MESSAGES: Readonly<Record<string, string>> = {
  "overview.title": "عنوان تور را وارد کنید.",
  "pricing.basePrice": "قیمت تور را وارد کنید.",
  "itinerary.days": "حداقل یک روز برای برنامه سفر تعریف کنید.",
  "logistics.primaryTransportMode": "حمل‌ونقل اصلی سفر را انتخاب کنید.",
};

const GENERIC_REQUIRED_MESSAGE = "این فیلد الزامی است.";

function requiredMessageFor(path: string): string {
  return REQUIRED_MESSAGES[path] ?? GENERIC_REQUIRED_MESSAGE;
}

/** Read a dotted path off an arbitrary object, returning `undefined` on any miss. */
function readPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const seg of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

/**
 * "Empty for required-ness" predicate. Mirrors what every required field in the Zod schema
 * effectively rejects today:
 *   - `undefined` / `null`            → empty
 *   - `""` or whitespace-only string  → empty (matches `.trim().min(...)`)
 *   - `[]`                            → empty (matches `.array(...).min(1, ...)`)
 *   - `NaN`                           → empty (matches `valueAsNumber` form-input edge case)
 *   - `0`, `false`, non-empty objects → NOT empty (a `basePrice` of `0` is a valid number).
 */
function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "number") return Number.isNaN(value);
  return false;
}

function buildIssue(path: WizardFieldPath, code: ValidationIssueCode, message: string): ValidationIssue {
  return { path, pathSegments: path.split("."), code, message };
}

/**
 * Autosave-level validation (minimal, never `required`).
 *
 * - Consults {@link getStepRule} / {@link getStepRules} so validation is scoped to the
 *   **current** `stepId` and respects profile step visibility (hidden rail → no-op).
 * - Does **not** inspect `isFieldRequiredAtLevel` — drafts must stay persistable while half-filled.
 * - v1 returns `isValid: true` with no issues; reserved for future shape-only checks on visible
 *   fields of `stepId` (e.g. strip invalid enum tokens before `serializeWizardDraft`).
 */
export function validateForAutosave(
  profile: TourFormProfile,
  stepId: TourCreateWizardStepId,
  data: Partial<TourCreateFormValues>,
): ValidationResult {
  const stepRule = getStepRule(profile, stepId);
  if (!stepRule || stepRule.visibility === "hidden") {
    return buildResult([]);
  }
  void data;
  void getStepRules(profile, stepId);
  return buildResult([]);
}

/**
 * Step-navigation validation.
 *
 * Enforces required-ness for every field owned by `stepId` (`belongsToStep === stepId`) when
 * the step is visible for the profile. Hidden steps short-circuit to "ok".
 *
 * `visibleSteps` is forwarded to {@link isFieldRequiredAtLevel} so position-aware relaxation
 * (the legacy `relaxItineraryMinDays` / `relaxLogisticsPrimary` flags) behaves correctly when
 * the caller is leaving an earlier step.
 */
export function validateForStepNavigation(
  profile: TourFormProfile,
  stepId: TourCreateWizardStepId,
  data: TourCreateFormValues,
  visibleSteps: readonly TourCreateWizardStepId[],
): ValidationResult {
  const stepRule = getStepRule(profile, stepId);
  if (!stepRule || stepRule.visibility !== "visible") return buildResult([]);

  const rules = getProfileRules(profile);
  const issues: ValidationIssue[] = [];
  for (const rule of rules.fields.values()) {
    if (rule.belongsToStep !== stepId) continue;
    if (!isFieldRequiredAtLevel(profile, rule.path, "stepNav", stepId, visibleSteps)) continue;
    if (isEmptyValue(readPath(data, rule.path))) {
      issues.push(buildIssue(rule.path, "required", requiredMessageFor(rule.path)));
    }
  }
  return buildResult(issues);
}

/**
 * Final submit validation.
 *
 * Iterates the rules table once and collects an issue for every required field that is
 * effectively required at `"submit"` level. The Zod schema is still the canonical *enforcement*
 * path today, so this is run **alongside** Zod by the wizard shell.
 */
export function validateForSubmit(
  profile: TourFormProfile,
  data: TourCreateFormValues,
): ValidationResult {
  const rules = getProfileRules(profile);
  const issues: ValidationIssue[] = [];
  for (const rule of rules.fields.values()) {
    if (!isFieldRequiredAtLevel(profile, rule.path, "submit")) continue;
    if (isEmptyValue(readPath(data, rule.path))) {
      issues.push(buildIssue(rule.path, "required", requiredMessageFor(rule.path)));
    }
  }
  return buildResult(issues);
}

/**
 * Convenience: list the required fields for a step at submit level. Useful for tests and
 * for "what's still missing on this step?" hints in the UI.
 */
export function requiredFieldsForStep(
  profile: TourFormProfile,
  stepId: TourCreateWizardStepId,
): readonly WizardFieldPath[] {
  const rules = getProfileRules(profile);
  const out: WizardFieldPath[] = [];
  for (const rule of rules.fields.values()) {
    if (rule.belongsToStep !== stepId) continue;
    if (!isFieldRequiredAtLevel(profile, rule.path, "submit")) continue;
    out.push(rule.path);
  }
  return out;
}

/**
 * Convenience: list every required field for the profile (across all visible steps).
 * Equivalent to filtering the rules table by `isFieldRequiredAtLevel(p, path, "submit")`.
 */
export function requiredFieldsForProfile(profile: TourFormProfile): readonly WizardFieldPath[] {
  const rules = getProfileRules(profile);
  const out: WizardFieldPath[] = [];
  for (const rule of rules.fields.values()) {
    if (!isFieldRequiredAtLevel(profile, rule.path, "submit")) continue;
    out.push(rule.path);
  }
  return out;
}

/**
 * Convenience: list every visible step id for the profile. Re-exported from this module so
 * validation callers don't need to import from `getProfileRules` separately.
 */
export const visibleStepIdsForProfile = getVisibleStepIds;
