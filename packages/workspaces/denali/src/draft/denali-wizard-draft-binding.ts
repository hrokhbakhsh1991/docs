/** Phase 11.5 — operator create-tour draft envelope (DEC-P11-006). */

export const DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE = "operator.wizard" as const;
export const DENALI_CREATE_TOUR_DRAFT_KEY = "denali-create" as const;

export function denaliEditTourDraftKey(tourId: string): string {
  const trimmed = tourId.trim();
  return trimmed.length > 0 ? `denali-edit:${trimmed}` : "denali-edit:unknown";
}

export type DenaliWizardDraftMeta = {
  readonly currentStepIndex: number;
  readonly wizardSessionId?: string;
  /** Set after explicit clear — conflict merge must prefer local template over stale server. */
  readonly freshStart?: boolean;
  /** Server-persisted only — stripped on client hydrate/prepare (Track B). */
  readonly deletedRoots?: readonly string[];
};

export type DenaliWizardDraftEnvelope<TForm> = {
  readonly form: TForm;
  readonly meta: DenaliWizardDraftMeta;
};

function clientMetaFromInput(meta: DenaliWizardDraftMeta): DenaliWizardDraftMeta {
  return {
    currentStepIndex: meta.currentStepIndex,
    ...(meta.wizardSessionId !== undefined ? { wizardSessionId: meta.wizardSessionId } : {}),
    ...(meta.freshStart === true ? { freshStart: true } : {}),
  };
}

export function denaliPrepareDraftEnvelope<TForm>(
  form: TForm,
  meta: DenaliWizardDraftMeta
): DenaliWizardDraftEnvelope<TForm> {
  return {
    form: structuredClone(form),
    meta: clientMetaFromInput(meta),
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
      ...(fallbackMeta?.freshStart === true ? { freshStart: true } : {}),
    });
  }

  return {
    form: structuredClone(remote.form),
    meta: {
      currentStepIndex: remote.meta.currentStepIndex ?? fallbackMeta?.currentStepIndex ?? 0,
      wizardSessionId: remote.meta.wizardSessionId ?? fallbackMeta?.wizardSessionId,
      ...(remote.meta.freshStart === true ? { freshStart: true } : {}),
    },
  };
}
