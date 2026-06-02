"use client";

import { useMemo } from "react";
import { useFormContext } from "react-hook-form";

import type { DenaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import { getDenaliWizardSubmitIssues } from "@/features/tours/wizard/denali/validation/denaliWizardFormZod";

import { useDenaliWizardFormSnapshot } from "./useDenaliWizardFormSnapshot";
import { useWizardStateGuard } from "./useWizardStateGuard";

export type PublishButtonDisabledReason =
  | "LOCKED"
  | "SUBMITTING"
  | "PUBLISH_NOT_READY"
  | "FORM_INVALID";

/**
 * Final publish/submit button guard:
 * combines navigation locks, RHF submit state, publish readiness and full submit validity.
 */
export function usePublishButtonGuard(input: {
  navLocked: boolean;
  ruleSet: DenaliRuleSet;
}) {
  const { formState } = useFormContext<DenaliCreateTourWizardForm>();
  const form = useDenaliWizardFormSnapshot({ debounceMs: 0 });
  const { publishStatus, publishIssues } = useWizardStateGuard({
    disableActiveWhileNotReady: true,
  });

  const submitIssues = useMemo(
    () => getDenaliWizardSubmitIssues(form, undefined, input.ruleSet),
    [form, input.ruleSet],
  );

  const wantsActive = publishStatus === "active";
  const disabledReason: PublishButtonDisabledReason | null = input.navLocked
    ? "LOCKED"
    : formState.isSubmitting
      ? "SUBMITTING"
      : wantsActive && publishIssues.length > 0
        ? "PUBLISH_NOT_READY"
        : wantsActive && submitIssues.length > 0
          ? "FORM_INVALID"
          : null;

  return {
    disabled: disabledReason !== null,
    disabledReason,
    publishIssues,
    submitIssues,
  } as const;
}
