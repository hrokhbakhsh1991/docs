"use client";

import { useCallback, useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import type { TourFormLifecycleStatus } from "@/components/tours/tour-lifecycle";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

import { useDenaliWizardFormSnapshot } from "./useDenaliWizardFormSnapshot";
import { getDenaliWizardPublishReadinessIssuesForTargetStatus } from "../validation/denaliWizardPublishReadiness";
import { handleStatusChange, type WizardPublishStatus } from "../validation/handleStatusChange";

type UseWizardStateGuardOptions = {
  disableActiveWhileNotReady?: boolean;
};

/**
 * Single publish guard for wizard review state:
 * - evaluates readiness against target status (`active`)
 * - exposes deterministic status-transition API
 * - centralizes draft fallback behavior
 */
export function useWizardStateGuard(options?: UseWizardStateGuardOptions) {
  const { control, setValue } = useFormContext<DenaliCreateTourWizardForm>();
  const form = useDenaliWizardFormSnapshot({ debounceMs: 0 });

  const publishStatus =
    (useWatch({ control, name: "basicInfo.publishStatus" }) as "draft" | "active" | undefined) ??
    "draft";

  const publishIssues = useMemo(
    () => getDenaliWizardPublishReadinessIssuesForTargetStatus(form, "active"),
    [form],
  );

  const canSetActive = publishIssues.length === 0;
  const publishReadinessBlocked = publishStatus === "active" && !canSetActive;
  const disableActivePublish =
    options?.disableActiveWhileNotReady === true ? !canSetActive : publishReadinessBlocked;
  const effectivePublishStatus = canSetActive && publishStatus === "active" ? "active" : "draft";

  const requestStatus = useCallback(
    (next: TourFormLifecycleStatus) => {
      handleStatusChange({
        currentStatus: publishStatus as WizardPublishStatus,
        nextStatus: next,
        publishIssues,
        setStatus: (status, options) => {
          setValue("basicInfo.publishStatus", status, {
            shouldDirty: options?.shouldDirty,
            shouldValidate: options?.shouldValidate,
          });
        },
      });
    },
    [publishStatus, publishIssues, setValue],
  );

  const enforceSafeStatus = useCallback(() => {
    if (!publishReadinessBlocked) return false;
    setValue("basicInfo.publishStatus", "draft", {
      shouldDirty: true,
      shouldValidate: true,
    });
    return true;
  }, [publishReadinessBlocked, setValue]);

  return {
    publishStatus,
    effectivePublishStatus,
    publishIssues,
    canSetActive,
    publishReadinessBlocked,
    disableActivePublish,
    requestStatus,
    enforceSafeStatus,
  };
}
