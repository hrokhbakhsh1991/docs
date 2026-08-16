import type {
  DenaliWizardDraftEnvelope,
  DenaliWizardDraftMeta,
} from "../../draft/denali-wizard-draft-binding";
import {
  denaliHydrateDraftEnvelope,
  denaliPrepareDraftEnvelope,
} from "../../draft/denali-wizard-draft-binding";

export type DenaliFlatEditDraftResetSync<TForm> = {
  readonly setData: (envelope: DenaliWizardDraftEnvelope<TForm>) => void;
  readonly clearDraft: () => Promise<void>;
  readonly clearDraftAndReset?: (reset: DenaliWizardDraftEnvelope<TForm>) => Promise<void>;
};

/** Stamp the tour rowVersion this envelope was hydrated from (flat-edit only). */
export function denaliFlatEditEnvelopeMetaForTour(
  envelopeMeta: DenaliWizardDraftMeta,
  tourRowVersion: number | null
): DenaliWizardDraftMeta {
  return {
    currentStepIndex: envelopeMeta.currentStepIndex,
    ...(envelopeMeta.wizardSessionId !== undefined
      ? { wizardSessionId: envelopeMeta.wizardSessionId }
      : {}),
    ...(envelopeMeta.freshStart === true ? { freshStart: true } : {}),
    ...(tourRowVersion != null ? { sourceRowVersion: tourRowVersion } : {}),
  };
}

export function prepareDenaliFlatEditSeedEnvelope<TForm>(
  form: TForm,
  envelopeMeta: DenaliWizardDraftMeta,
  tourRowVersion: number | null
): DenaliWizardDraftEnvelope<TForm> {
  return denaliPrepareDraftEnvelope(
    form,
    denaliFlatEditEnvelopeMetaForTour(envelopeMeta, tourRowVersion)
  );
}

/**
 * True when the remote edit draft was hydrated from an older tour version than
 * the GET we just loaded — leftover autosave after a successful PATCH.
 * Unstamped envelopes are kept so pre-stamp unsaved work is not discarded.
 */
export function isDenaliFlatEditDraftStaleVsTour(
  draft: DenaliWizardDraftEnvelope<unknown>,
  tourRowVersion: number | null
): boolean {
  if (tourRowVersion == null) {
    return false;
  }
  const source = draft.meta.sourceRowVersion;
  if (typeof source !== "number") {
    return false;
  }
  return source < tourRowVersion;
}

export function shouldSeedDenaliFlatEditDraftFromTour(input: {
  readonly remoteDraft: DenaliWizardDraftEnvelope<unknown> | null;
  readonly tourRowVersion: number | null;
  readonly draftStatus: string;
}): boolean {
  if (input.draftStatus === "SYNCING" || input.draftStatus === "CONFLICT_RESOLVING") {
    return false;
  }
  if (input.remoteDraft === null) {
    return true;
  }
  return isDenaliFlatEditDraftStaleVsTour(input.remoteDraft, input.tourRowVersion);
}

export function resolveDenaliFlatEditWorkingEnvelope<TForm>(input: {
  readonly remoteDraft: DenaliWizardDraftEnvelope<TForm> | null;
  readonly tourBaseline: TForm | null;
  readonly tourRowVersion: number | null;
  readonly envelopeMeta: DenaliWizardDraftMeta;
}): DenaliWizardDraftEnvelope<TForm> | null {
  const { remoteDraft, tourBaseline, tourRowVersion, envelopeMeta } = input;
  if (tourBaseline === null) {
    return remoteDraft;
  }
  if (remoteDraft !== null && !isDenaliFlatEditDraftStaleVsTour(remoteDraft, tourRowVersion)) {
    return remoteDraft;
  }
  return denaliHydrateDraftEnvelope(
    null,
    tourBaseline,
    denaliFlatEditEnvelopeMetaForTour(envelopeMeta, tourRowVersion)
  );
}

/**
 * After a successful tour PATCH: persist the GET snapshot as the edit draft.
 * Prefer `clearDraftAndReset` so React never observes `data=null` and cannot
 * re-PUT the pre-PATCH baseline (create-wizard already uses this primitive).
 */
export async function replaceDenaliFlatEditDraftAfterSuccessfulPatch<TForm>(input: {
  readonly baseline: TForm;
  readonly envelopeMeta: DenaliWizardDraftMeta;
  readonly tourRowVersion: number;
  readonly draftSync: DenaliFlatEditDraftResetSync<TForm>;
}): Promise<void> {
  const next = prepareDenaliFlatEditSeedEnvelope(
    input.baseline,
    input.envelopeMeta,
    input.tourRowVersion
  );
  if (input.draftSync.clearDraftAndReset !== undefined) {
    await input.draftSync.clearDraftAndReset(next);
    return;
  }
  await input.draftSync.clearDraft();
  input.draftSync.setData(next);
}
