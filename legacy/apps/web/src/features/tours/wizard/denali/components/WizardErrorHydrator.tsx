"use client";

import { useCallback, useMemo } from "react";

import type { DenaliCreateWizardStepId } from "@/features/tours/wizard/denaliStepConfig";

import type { useDenaliWizardNavigationOptional } from "../DenaliWizardNavigationContext";
import type { DenaliWizardSubmitIssuesByStep } from "../denaliWizardSubmitIssuePresentation";

type OptionalNavigation = ReturnType<typeof useDenaliWizardNavigationOptional>;

type WizardHydratedTarget = {
  stepId: DenaliCreateWizardStepId;
  formPath: string;
};

function fallbackWizardTopNavigation() {
  if (typeof window === "undefined") return;
  window.scrollTo({ top: 0, behavior: "auto" });
  const wizardRoot = document.querySelector<HTMLElement>('[data-testid="workspace-tour-wizard"]');
  wizardRoot?.focus?.();
}

/**
 * Memoized selector for mapping review issues to navigation targets.
 * Recomputes before render when issue groups change.
 */
export function useWizardErrorHydrator(input: {
  byStep: readonly DenaliWizardSubmitIssuesByStep[];
  navigation: OptionalNavigation;
}) {
  const targetMap = useMemo(() => {
    const next = new Map<string, WizardHydratedTarget>();
    for (const group of input.byStep) {
      for (const issue of group.issues) {
        next.set(issue.formPath, { stepId: issue.stepId, formPath: issue.formPath });
      }
    }
    return next;
  }, [input.byStep]);

  const navigateToIssue = useCallback(
    (target: WizardHydratedTarget) => {
      if (input.navigation == null) {
        fallbackWizardTopNavigation();
        return;
      }
      input.navigation.navigateToField(target.stepId, target.formPath);
    },
    [input.navigation],
  );

  const navigateByFormPath = useCallback(
    (fallback: WizardHydratedTarget) => {
      const resolved = targetMap.get(fallback.formPath) ?? fallback;
      navigateToIssue(resolved);
    },
    [navigateToIssue, targetMap],
  );

  return {
    targetMap,
    navigateByFormPath,
  } as const;
}
