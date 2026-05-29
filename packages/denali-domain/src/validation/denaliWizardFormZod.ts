/**
 * Denali wizard form — validation orchestration (structural Zod + rules + canonical).
 *
 * Required / visibility: {@link ../rules/denaliRuleRequired.ts}.
 * API invariants: {@link assertCreateTourInvariants}.
 */

import { z } from "zod";

import type { DenaliCreateWizardStepId } from "../layout/stepIds";
import {
  canonicalZodPathToFormFieldPath,
  collectDenaliRuleRequiredIssues,
  denaliRuleSet,
  mapFormPathToCanonical,
  type DenaliRuleModel,
  type DenaliRuleSet,
  type DenaliRuleValidationScope,
  type DenaliUIContextOptions,
} from "../rules/core";
import { getDenaliStepPickShape, resolveDenaliRuleModelFromForm } from "../normalize/resolveRuleModel";
import { isDenaliFieldVisibleOnStep } from "../rules/denaliUIAdapter";
import { safeParseDenaliCanonicalFromWizardForm } from "../validation/safeParseCanonical";
import { buildDenaliTourCreateDefaultValues } from "../schemas/denaliCore.schema";
import {
  denaliTourCreateBaseSchema,
  type DenaliCreateTourWizardForm,
} from "../schemas/denaliTourCreateBaseSchema";
import { normalizeDenaliWizardForm } from "../normalize/clearHiddenFormValues";
import { assertDenaliLegacySchemaAllowed } from "../schemas/denaliLegacySchemaGuard";

/** Legacy wizard form — shapes, enums, ISO format only (no product requiredness). */
export const denaliTourCreateFormSchema = denaliTourCreateBaseSchema;

/** @deprecated Use {@link ../schemas/denaliCanonicalTourSchema.unified} on submit. Tests only. */
export const denaliTourCreateSchema = denaliTourCreateFormSchema;

/** @deprecated Alias for tests. */
export const denaliTourCreateSchemaRuleAware = denaliTourCreateFormSchema;

export type DenaliWizardValidationOptions = {
  /** Step: structural + rules for one rail step. Submit: full form + canonical. */
  scope: DenaliRuleValidationScope;
  uiOptions?: DenaliUIContextOptions;
};

function canonicalIssuesToFormIssues(issues: z.ZodIssue[]): z.ZodIssue[] {
  return issues.map((issue) => ({
    ...issue,
    path: canonicalZodPathToFormFieldPath(issue.path as (string | number)[]).split("."),
  })) as z.ZodIssue[];
}

function issuePathKey(path: readonly (string | number)[]): string {
  return path.map(String).join(".");
}

function dedupeIssuesByPath(issues: z.ZodIssue[]): z.ZodIssue[] {
  const byPath = new Map<string, z.ZodIssue>();
  for (const issue of issues) {
    byPath.set(issuePathKey(issue.path as (string | number)[]), issue);
  }
  return [...byPath.values()];
}

function mergeValidationIssues(
  normalized: DenaliCreateTourWizardForm,
  model: DenaliRuleModel | null,
  options: DenaliWizardValidationOptions,
): z.ZodIssue[] {
  const structural = denaliTourCreateFormSchema.safeParse(normalized);
  const structuralIssues = structural.success ? [] : structural.error.issues;

  const ruleIssues =
    model == null
      ? []
      : collectDenaliRuleRequiredIssues(normalized, model, options.scope, options.uiOptions).map(
          (issue) => ({
            ...issue,
            code: z.ZodIssueCode.custom,
          }),
        );

  const includeCanonical = options.scope.mode === "submit";
  let canonicalIssues: z.ZodIssue[] = [];
  if (includeCanonical) {
    // Canonical validation depends on `basicInfo.tourType` being classified.
    // When it's missing/invalid, `denaliFormToCanonical` may throw (even though the
    // function name is "safeParse"). We treat that case as "no canonical issues".
    try {
      const canonicalParsed = safeParseDenaliCanonicalFromWizardForm(normalized);
      canonicalIssues = !canonicalParsed.success
        ? canonicalIssuesToFormIssues(canonicalParsed.error.issues)
        : [];
    } catch {
      canonicalIssues = [];
    }
  }

  return dedupeIssuesByPath([
    ...structuralIssues,
    ...ruleIssues,
    ...canonicalIssues,
  ] as z.ZodIssue[]);
}

const TOUR_TYPE_REQUIRED_ISSUE: z.ZodIssue = {
  code: z.ZodIssueCode.custom,
  path: ["basicInfo", "tourType"],
  message: "نوع تور را انتخاب کنید.",
};

/**
 * Single validation pipeline for submit + RHF resolver.
 * Includes denali_pricing participant rules, multi-day end, dong, price, and canonical MVP checks.
 */
export function getDenaliWizardSubmitIssues(
  form: DenaliCreateTourWizardForm,
  uiOptions?: DenaliUIContextOptions,
  ruleSet: DenaliRuleSet = denaliRuleSet,
): z.ZodIssue[] {
  const normalized = normalizeDenaliWizardForm(form, uiOptions, ruleSet);
  const model = resolveDenaliRuleModelFromForm(normalized, ruleSet);
  if (model == null) {
    // Without classification we still want to surface rule-engine requiredness for
    // contextual fields (e.g. `transport.dongAmount` for `shared_cars`), but we can't
    // run canonical validation.
    const fallbackModel = ruleSet.mountain.single_day;
    const issues = mergeValidationIssues(normalized, fallbackModel, {
      scope: { mode: "submit" },
      uiOptions,
    });
    return [...issues, TOUR_TYPE_REQUIRED_ISSUE];
  }

  return mergeValidationIssues(normalized, model, { scope: { mode: "submit" }, uiOptions });
}

/**
 * @deprecated Throws in development if called from product code. Tests may use freely.
 */
export function parseDenaliTourCreateForm(input: unknown): DenaliCreateTourWizardForm {
  assertDenaliLegacySchemaAllowed("parseDenaliTourCreateForm");
  const normalized =
    input != null && typeof input === "object"
      ? normalizeDenaliWizardForm(input as DenaliCreateTourWizardForm)
      : input;
  const result = validateDenaliWizardForm(normalized as DenaliCreateTourWizardForm);
  if (!result.success) {
    throw new z.ZodError(result.issues);
  }
  return normalized as DenaliCreateTourWizardForm;
}

export { buildDenaliTourCreateDefaultValues };

function issueBelongsToWizardStep(
  issue: z.ZodIssue,
  form: DenaliCreateTourWizardForm,
  stepId: DenaliCreateWizardStepId,
  uiOptions?: DenaliUIContextOptions,
  ruleSet: DenaliRuleSet = denaliRuleSet,
): boolean {
  const model = resolveDenaliRuleModelFromForm(form, ruleSet);
  if (model == null) return true;

  const pathStr = mapFormPathToCanonical(issue.path.join("."));
  if (!isDenaliFieldVisibleOnStep(model, stepId, pathStr, form, uiOptions)) {
    return false;
  }

  const section = issue.path[0] as keyof DenaliCreateTourWizardForm | undefined;
  if (section == null) return true;

  const pick = getDenaliStepPickShape(model, stepId);
  return pick[section] === true;
}

/** Issues that block leaving `stepId` (fields owned by that rail step only). */
export function getDenaliWizardStepIssues(
  form: DenaliCreateTourWizardForm,
  stepId: DenaliCreateWizardStepId,
  uiOptions?: DenaliUIContextOptions,
  ruleSet: DenaliRuleSet = denaliRuleSet,
): z.ZodIssue[] {
  const normalized = normalizeDenaliWizardForm(form, uiOptions, ruleSet);
  const model = resolveDenaliRuleModelFromForm(normalized, ruleSet);
  if (model == null) {
    return [TOUR_TYPE_REQUIRED_ISSUE];
  }

  const issues = mergeValidationIssues(normalized, model, {
    scope: { mode: "step", stepId },
    uiOptions,
  });
  return issues.filter((issue) =>
    issueBelongsToWizardStep(issue, normalized, stepId, uiOptions, ruleSet),
  );
}

/** Full-form validation: structural + rules + canonical (single submit gate). */
export function validateDenaliWizardForm(form: DenaliCreateTourWizardForm): {
  success: boolean;
  issues: z.ZodIssue[];
} {
  const issues = getDenaliWizardSubmitIssues(form);
  return { success: issues.length === 0, issues };
}
