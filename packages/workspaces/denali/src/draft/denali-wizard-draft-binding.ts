/** Phase 11.5 — operator create-tour draft envelope (DEC-P11-006). */

export const DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE = "operator.wizard" as const;
export const DENALI_CREATE_TOUR_DRAFT_KEY = "denali-create" as const;

export type DenaliWizardDraftMeta = {
  readonly currentStepIndex: number;
  readonly wizardSessionId?: string;
};

export type DenaliWizardDraftEnvelope<TForm> = {
  readonly form: TForm;
  readonly meta: DenaliWizardDraftMeta;
};

export function denaliPrepareDraftEnvelope<TForm>(
  form: TForm,
  meta: DenaliWizardDraftMeta
): DenaliWizardDraftEnvelope<TForm> {
  return {
    form: structuredClone(form),
    meta: {
      currentStepIndex: meta.currentStepIndex,
      ...(meta.wizardSessionId !== undefined ? { wizardSessionId: meta.wizardSessionId } : {}),
    },
  };
}

export function denaliHydrateDraftEnvelope<TForm>(
  remote: DenaliWizardDraftEnvelope<TForm> | null | undefined,
  fallbackForm: TForm,
  fallbackMeta?: Partial<DenaliWizardDraftMeta>
): DenaliWizardDraftEnvelope<TForm> {
  if (remote === null || remote === undefined) {
    return denaliPrepareDraftEnvelope(fallbackForm, {
      currentStepIndex: fallbackMeta?.currentStepIndex ?? 0,
      ...(fallbackMeta?.wizardSessionId !== undefined
        ? { wizardSessionId: fallbackMeta.wizardSessionId }
        : {}),
    });
  }

  return {
    form: structuredClone(remote.form),
    meta: {
      currentStepIndex: remote.meta.currentStepIndex ?? fallbackMeta?.currentStepIndex ?? 0,
      wizardSessionId: remote.meta.wizardSessionId ?? fallbackMeta?.wizardSessionId,
    },
  };
}
