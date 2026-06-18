import type { TourWizardDraft } from "@/tours/tour-wizard-draft";

export type { WizardResumeStepLike } from "@app-tour/workspace-denali/wizard/resolve-initial-step-index";

export {
  hasNonEmptyCanonicalValue,
  isDraftEssentiallyEmpty,
  readDenaliDraftFieldValue,
  resolveDenaliInitialStepIndex,
} from "@app-tour/workspace-denali/wizard/resolve-initial-step-index";

import {
  resolveDenaliInitialStepIndex,
  type WizardResumeStepLike,
} from "@app-tour/workspace-denali/wizard/resolve-initial-step-index";

/** Web envelope adapter — keeps TourWizardDraft typing for draft merge tests. */
export function resolveDenaliWizardResumeStepIndex(
  draft: TourWizardDraft,
  steps: readonly WizardResumeStepLike[],
  savedStepIndex: number
): number {
  return resolveDenaliInitialStepIndex(
    draft as unknown as Record<string, unknown>,
    steps,
    savedStepIndex
  );
}
