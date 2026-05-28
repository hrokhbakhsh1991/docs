import type { TourFormLifecycleStatus } from "@/components/tours/tour-lifecycle";

import type { DenaliWizardPublishReadinessIssue } from "./denaliWizardPublishReadiness";

export type WizardPublishStatus = "draft" | "active";

export type HandleStatusChangeReason = "NOOP" | "BLOCKED_NOT_READY" | "APPLIED";

export type HandleStatusChangeResult = {
  appliedStatus: WizardPublishStatus;
  blocked: boolean;
  reason: HandleStatusChangeReason;
  issues: DenaliWizardPublishReadinessIssue[];
};

type HandleStatusChangeInput = {
  currentStatus: WizardPublishStatus;
  nextStatus: TourFormLifecycleStatus;
  publishIssues: DenaliWizardPublishReadinessIssue[];
  setStatus: (
    _next: WizardPublishStatus,
    _options?: { shouldDirty?: boolean; shouldValidate?: boolean },
  ) => void;
};

/**
 * Atomic status transition guard for wizard publish status.
 * Applies deterministic draft fallback when active readiness is blocked.
 */
export function handleStatusChange({
  currentStatus,
  nextStatus,
  publishIssues,
  setStatus,
}: HandleStatusChangeInput): HandleStatusChangeResult {
  if (nextStatus === "archived") {
    return {
      appliedStatus: currentStatus,
      blocked: false,
      reason: "NOOP",
      issues: [],
    };
  }

  const normalizedNext: WizardPublishStatus = nextStatus === "active" ? "active" : "draft";
  if (normalizedNext === currentStatus) {
    return {
      appliedStatus: currentStatus,
      blocked: false,
      reason: "NOOP",
      issues: [],
    };
  }

  if (normalizedNext === "active" && publishIssues.length > 0) {
    setStatus("draft", { shouldDirty: true, shouldValidate: true });
    return {
      appliedStatus: "draft",
      blocked: true,
      reason: "BLOCKED_NOT_READY",
      issues: publishIssues,
    };
  }

  setStatus(normalizedNext, { shouldDirty: true, shouldValidate: true });
  return {
    appliedStatus: normalizedNext,
    blocked: false,
    reason: "APPLIED",
    issues: [],
  };
}
