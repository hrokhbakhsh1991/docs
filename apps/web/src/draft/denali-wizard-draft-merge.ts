import type { DenaliWizardDraftEnvelope } from "@app-tour/workspace-denali/draft";

import type { TourWizardDraft } from "@/tours/tour-wizard-draft";

export type NewTourWizardDraftEnvelope = DenaliWizardDraftEnvelope<TourWizardDraft>;

type WizardDraftMeta = NewTourWizardDraftEnvelope["meta"];

/** Same-session step 0 is an explicit navigation — do not restore a stale server index from resume inference. */
export function resolveMergedWizardStepIndex(
  local: WizardDraftMeta,
  server: WizardDraftMeta
): number {
  if (local.currentStepIndex > 0) {
    return local.currentStepIndex;
  }
  const localSession = local.wizardSessionId?.trim() ?? "";
  const serverSession = server.wizardSessionId?.trim() ?? "";
  if (
    localSession.length > 0 &&
    serverSession.length > 0 &&
    localSession === serverSession
  ) {
    return local.currentStepIndex;
  }
  return server.currentStepIndex;
}

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
      currentStepIndex: resolveMergedWizardStepIndex(local.meta, server.meta),
      wizardSessionId: local.meta.wizardSessionId ?? server.meta.wizardSessionId,
    },
  };
}
