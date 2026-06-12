import type { DenaliWizardDraftEnvelope } from "@app-tour/workspace-denali/draft";

import type { TourWizardDraft } from "@/tours/tour-wizard-draft";

export type NewTourWizardDraftEnvelope = DenaliWizardDraftEnvelope<TourWizardDraft>;

export function mergeDenaliWizardDraftEnvelope(
  local: NewTourWizardDraftEnvelope,
  server: NewTourWizardDraftEnvelope
): NewTourWizardDraftEnvelope {
  return {
    form: {
      data: {
        ...server.form.data,
        ...local.form.data,
      },
    },
    meta: {
      currentStepIndex: local.meta.currentStepIndex,
      wizardSessionId: local.meta.wizardSessionId ?? server.meta.wizardSessionId,
    },
  };
}
