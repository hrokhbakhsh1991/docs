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
  /** Canonical object roots intentionally removed — 409 merge must not resurrect. */
  readonly deletedRoots?: readonly string[];
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
      ...(meta.freshStart === true ? { freshStart: true } : {}),
      ...(meta.deletedRoots !== undefined && meta.deletedRoots.length > 0
        ? { deletedRoots: [...meta.deletedRoots] }
        : {}),
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
      ...(fallbackMeta?.freshStart === true ? { freshStart: true } : {}),
      ...(fallbackMeta?.deletedRoots !== undefined && fallbackMeta.deletedRoots.length > 0
        ? { deletedRoots: [...fallbackMeta.deletedRoots] }
        : {}),
    });
  }

  return {
    form: structuredClone(remote.form),
    meta: {
      currentStepIndex: remote.meta.currentStepIndex ?? fallbackMeta?.currentStepIndex ?? 0,
      wizardSessionId: remote.meta.wizardSessionId ?? fallbackMeta?.wizardSessionId,
      ...(remote.meta.freshStart === true ? { freshStart: true } : {}),
      ...(remote.meta.deletedRoots !== undefined && remote.meta.deletedRoots.length > 0
        ? { deletedRoots: [...remote.meta.deletedRoots] }
        : {}),
    },
  };
}
