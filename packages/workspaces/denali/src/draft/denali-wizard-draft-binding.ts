/** Phase 11.5 — operator create-tour draft envelope (DEC-P11-006). */

export const DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE = "operator.wizard" as const;
export const DENALI_CREATE_TOUR_DRAFT_KEY = "denali-create" as const;

/** Namespace + draftKey for Denali operator create-tour remote draft. */
export type DenaliCreateTourRemoteDraftIdentity = {
  readonly namespace: typeof DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE;
  readonly draftKey: typeof DENALI_CREATE_TOUR_DRAFT_KEY;
};

export function denaliCreateTourRemoteDraftIdentity(): DenaliCreateTourRemoteDraftIdentity {
  return {
    namespace: DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE,
    draftKey: DENALI_CREATE_TOUR_DRAFT_KEY,
  };
}

/**
 * Input for host `createCreateTourPostSubmitDiscardRemoteDraft` after successful create.
 */
export function buildDenaliCreateTourDiscardRemoteDraftInput(
  workspaceId: string
): DenaliCreateTourRemoteDraftIdentity & { readonly workspaceId: string } {
  return {
    workspaceId,
    ...denaliCreateTourRemoteDraftIdentity(),
  };
}

export const DENALI_CREATE_TOUR_SUPPORTS_CLONE = true as const;

export function denaliEditTourDraftKey(tourId: string): string {
  const trimmed = tourId.trim();
  return trimmed.length > 0 ? `denali-edit:${trimmed}` : "denali-edit:unknown";
}

/** Namespace + per-tour draftKey for Denali operator flat-edit remote draft. */
export type DenaliEditTourRemoteDraftIdentity = {
  readonly namespace: typeof DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE;
  readonly draftKey: string;
};

export function denaliEditTourRemoteDraftIdentity(
  tourId: string
): DenaliEditTourRemoteDraftIdentity {
  return {
    namespace: DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE,
    draftKey: denaliEditTourDraftKey(tourId),
  };
}

export type DenaliWizardDraftMeta = {
  readonly currentStepIndex: number;
  readonly wizardSessionId?: string;
  /** Set after explicit clear — conflict merge must prefer local template over stale server. */
  readonly freshStart?: boolean;
  /** Server-persisted only — stripped on client hydrate/prepare (Track B). */
  readonly deletedRoots?: readonly string[];
  /**
   * Flat-edit only — tour `rowVersion` this envelope was hydrated from.
   * Unsaved edits keep the stamp; a newer GET tour makes the draft stale.
   */
  readonly sourceRowVersion?: number;
};

/**
 * Step-0 meta for create preset prefill, flat-edit envelope, and clone hydrate apply.
 */
export function buildDenaliWizardStepZeroMeta(wizardSessionId: string): DenaliWizardDraftMeta {
  return { currentStepIndex: 0, wizardSessionId };
}

/**
 * Step-0 + freshStart for seed prefill, clear-draft reset, and empty-draft reset.
 */
export function buildDenaliWizardFreshStartMeta(wizardSessionId: string): DenaliWizardDraftMeta {
  return { currentStepIndex: 0, wizardSessionId, freshStart: true };
}

export type DenaliWizardDraftEnvelope<TForm> = {
  readonly form: TForm;
  readonly meta: DenaliWizardDraftMeta;
};

/**
 * Clear-draft / fresh-start envelope: prepare with step-0 + `freshStart: true` meta.
 */
export function prepareDenaliCreateTourFreshStartEnvelope<TForm>(
  prepareEnvelope: (
    form: TForm,
    meta: DenaliWizardDraftMeta
  ) => DenaliWizardDraftEnvelope<TForm>,
  form: TForm,
  wizardSessionId: string
): DenaliWizardDraftEnvelope<TForm> {
  return prepareEnvelope(form, buildDenaliWizardFreshStartMeta(wizardSessionId));
}

/**
 * Flat-edit `meta.sourceRowVersion` — integer ≥ 0. Non-integers (NaN, 1.5, Infinity) are absent.
 */
export function readDenaliWizardSourceRowVersion(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function clientMetaFromInput(meta: DenaliWizardDraftMeta): DenaliWizardDraftMeta {
  const sourceRowVersion = readDenaliWizardSourceRowVersion(meta.sourceRowVersion);
  return {
    currentStepIndex: meta.currentStepIndex,
    ...(meta.wizardSessionId !== undefined ? { wizardSessionId: meta.wizardSessionId } : {}),
    ...(meta.freshStart === true ? { freshStart: true } : {}),
    ...(sourceRowVersion !== undefined ? { sourceRowVersion } : {}),
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
    const fallbackSource = readDenaliWizardSourceRowVersion(fallbackMeta?.sourceRowVersion);
    return denaliPrepareDraftEnvelope(fallbackForm, {
      currentStepIndex: fallbackMeta?.currentStepIndex ?? 0,
      ...(fallbackMeta?.wizardSessionId !== undefined
        ? { wizardSessionId: fallbackMeta.wizardSessionId }
        : {}),
      ...(fallbackMeta?.freshStart === true ? { freshStart: true } : {}),
      ...(fallbackSource !== undefined ? { sourceRowVersion: fallbackSource } : {}),
    });
  }

  const remoteSource = readDenaliWizardSourceRowVersion(remote.meta.sourceRowVersion);
  const fallbackSource = readDenaliWizardSourceRowVersion(fallbackMeta?.sourceRowVersion);
  return {
    form: structuredClone(remote.form),
    meta: {
      currentStepIndex: remote.meta.currentStepIndex ?? fallbackMeta?.currentStepIndex ?? 0,
      wizardSessionId: remote.meta.wizardSessionId ?? fallbackMeta?.wizardSessionId,
      ...(remote.meta.freshStart === true ? { freshStart: true } : {}),
      ...(remoteSource !== undefined
        ? { sourceRowVersion: remoteSource }
        : fallbackSource !== undefined
          ? { sourceRowVersion: fallbackSource }
          : {}),
    },
  };
}
