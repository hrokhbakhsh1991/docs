"use client";

import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import { useDenaliCanonical } from "../DenaliCanonicalContext";
import {
  getDenaliWizardPublishReadinessIssues,
  type DenaliWizardPublishReadinessIssue,
} from "../validation/denaliWizardPublishReadiness";

export type UseDenaliPublishReadinessOptions = {
  /**
   * When true, `disableActivePublish` is set whenever there are readiness issues (review step).
   * When false, `publishReadinessBlocked` is only true when status is already `active` (edit shell).
   */
  disableActiveWhileNotReady?: boolean;
};

/**
 * OPEN/publish gate for Denali forms — backed by {@link getDenaliWizardPublishReadinessIssues}
 * (rule engine required fields + API geo parity).
 */
export function useDenaliPublishReadiness(options?: UseDenaliPublishReadinessOptions) {
  const { control, getValues } = useFormContext<DenaliCreateTourWizardForm>();
  const { ruleSet } = useDenaliCanonical();
  const publishStatus =
    (useWatch({ control, name: "basicInfo.publishStatus" }) as "draft" | "active" | undefined) ??
    "draft";
  const formSnapshot = useWatch({ control }) as DenaliCreateTourWizardForm | undefined;

  const issues = useMemo((): DenaliWizardPublishReadinessIssue[] => {
    const form = formSnapshot ?? getValues();
    return getDenaliWizardPublishReadinessIssues(form, "denali_pilot", ruleSet);
  }, [formSnapshot, getValues, ruleSet]);

  const publishReadinessBlocked = publishStatus === "active" && issues.length > 0;
  const disableActivePublish =
    options?.disableActiveWhileNotReady === true
      ? issues.length > 0
      : publishReadinessBlocked;

  return {
    publishStatus,
    issues,
    publishReadinessBlocked,
    disableActivePublish,
  };
}
