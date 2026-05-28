/**
 * Submit validation — canonical schema, active publish gate, and error focus helpers.
 *
 * Runtime: form → {@link denaliFormToCanonical} → {@link ../schemas/denaliCanonicalTourSchema.unified}.
 */

import type { TourFormProfile } from "@repo/types";
import type { DenaliCanonicalTourModel } from "@repo/types/denali";
import type { FieldPath, UseFormSetError } from "react-hook-form";
import { z, ZodError } from "zod";
import { fromError } from "zod-validation-error";

import { scrollTourFormToFirstError } from "@/components/tours/tourFormValidationSummary";
import { denaliFormToCanonical } from "@/features/tours/wizard/denali/denaliCanonicalFormAdapter";
import type { DenaliCreateWizardStepId } from "@/features/tours/wizard/denaliStepConfig";
import {
  buildDenaliSubmitIssueViews,
  type DenaliT,
} from "@/features/tours/wizard/denali/denaliWizardSubmitIssuePresentation";
import type { DenaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";
import { denaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";
import type { DenaliUIContextOptions } from "@/features/tours/wizard/denali/rules/denaliUIAdapter";
import { prepareDenaliWizardFormForSubmit } from "@/features/tours/wizard/denali/validation/denaliRuleAccess";
import { getDenaliWizardSubmitIssues } from "@/features/tours/wizard/denali/validation/denaliWizardFormZod";
import {
  getDenaliWizardPublishReadinessIssues,
  type DenaliWizardPublishReadinessIssue,
} from "@/features/tours/wizard/denali/validation/denaliWizardPublishReadiness";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import { denaliCanonicalTourSchema } from "@/features/tours/wizard/schemas/denaliCanonicalTourSchema.unified";

/** User-facing message for canonical submit validation failures. */
export function formatDenaliCanonicalValidationError(error: ZodError): string {
  return fromError(error, { prefix: "Denali tour validation" }).toString();
}

export function publishReadinessIssueToZodIssue(
  issue: DenaliWizardPublishReadinessIssue,
): z.ZodIssue {
  const path =
    issue.path != null && issue.path.length > 0
      ? issue.path.split(".").filter((segment) => segment.length > 0)
      : [];
  return {
    code: z.ZodIssueCode.custom,
    path,
    message: issue.message,
  };
}

export type DenaliWizardSubmitGateResult = {
  tourStatus: "draft" | "active";
  submitIssues: z.ZodIssue[];
  publishIssues: DenaliWizardPublishReadinessIssue[];
  /** When `tourStatus === "active"`, both submit and publish gates must pass. */
  success: boolean;
};

/**
 * Client submit gate: full form validation applies only for `publishStatus === "active"`.
 * Draft saves skip structural/rule/canonical blocking on the client.
 */
export function evaluateDenaliWizardSubmitGate(
  form: DenaliCreateTourWizardForm,
  options?: {
    uiOptions?: DenaliUIContextOptions;
    ruleSet?: DenaliRuleSet;
    profile?: TourFormProfile;
  },
): DenaliWizardSubmitGateResult {
  const ruleSet = options?.ruleSet ?? denaliRuleSet;
  const tourStatus = form.basicInfo.publishStatus ?? "draft";

  if (tourStatus !== "active") {
    return {
      tourStatus,
      submitIssues: [],
      publishIssues: [],
      success: true,
    };
  }

  const submitIssues = getDenaliWizardSubmitIssues(form, options?.uiOptions, ruleSet);
  const publishIssues = getDenaliWizardPublishReadinessIssues(
    form,
    options?.profile ?? "denali_pilot",
    ruleSet,
  );

  return {
    tourStatus,
    submitIssues,
    publishIssues,
    success: submitIssues.length === 0 && publishIssues.length === 0,
  };
}

export function mergeDenaliActiveSubmitIssues(
  submitIssues: readonly z.ZodIssue[],
  publishIssues: readonly DenaliWizardPublishReadinessIssue[],
): z.ZodIssue[] {
  return [...submitIssues, ...publishIssues.map(publishReadinessIssueToZodIssue)];
}

export function applyDenaliWizardIssuesToForm(
  setError: UseFormSetError<DenaliCreateTourWizardForm>,
  issues: readonly z.ZodIssue[],
): void {
  for (const issue of issues) {
    const path = issue.path.map(String).join(".");
    if (path.length === 0) continue;
    setError(path as FieldPath<DenaliCreateTourWizardForm>, {
      type: "manual",
      message: issue.message,
    });
  }
}

export type DenaliSubmitErrorFocusHandler = (
  stepId: DenaliCreateWizardStepId,
  formPath: string,
) => void;

/**
 * Scroll/focus the first submit or publish-readiness issue.
 * Prefer `onFocusField` (step navigation + field focus); otherwise DOM scroll only.
 */
export function focusDenaliSubmitValidationError(input: {
  form: DenaliCreateTourWizardForm;
  ruleSet: DenaliRuleSet;
  submitIssues: readonly z.ZodIssue[];
  publishIssues?: readonly DenaliWizardPublishReadinessIssue[];
  t: DenaliT;
  onFocusField?: DenaliSubmitErrorFocusHandler;
}): void {
  const merged = mergeDenaliActiveSubmitIssues(input.submitIssues, input.publishIssues ?? []);
  const views = buildDenaliSubmitIssueViews(merged, input.form, input.ruleSet, input.t);
  const first = views[0];
  if (first == null) {
    return;
  }

  if (input.onFocusField != null) {
    input.onFocusField(first.stepId, first.formPath);
    return;
  }

  scrollTourFormToFirstError([
    { path: first.formPath, label: first.label, message: first.message },
  ]);
}

/** @deprecated Alias — use {@link focusDenaliSubmitValidationError}. */
export const scrollToDenaliSubmitError = focusDenaliSubmitValidationError;

/**
 * Canonical validation issues for a wizard form (no throw).
 */
export function safeParseDenaliCanonicalFromWizardForm(
  form: DenaliCreateTourWizardForm,
  ruleSet: DenaliRuleSet = denaliRuleSet,
): ReturnType<typeof denaliCanonicalTourSchema.safeParse> {
  const normalized = prepareDenaliWizardFormForSubmit(form, ruleSet);
  const canonical = denaliFormToCanonical(normalized);
  return denaliCanonicalTourSchema.safeParse(canonical);
}

/**
 * Submit gate: map legacy form shell → canonical, validate with unified canonical schema only.
 * @throws {ValidationError} when canonical validation fails (wraps {@link ZodError} with readable message).
 */
export function parseDenaliCanonicalFromWizardForm(
  form: DenaliCreateTourWizardForm,
): DenaliCanonicalTourModel {
  const result = safeParseDenaliCanonicalFromWizardForm(form);
  if (!result.success) {
    throw fromError(result.error, { prefix: "Denali tour validation" });
  }
  return result.data;
}
