import type { DraftStatus } from "@app-tour/draft-engine";

import type {
  DenaliWizardDraftEnvelope,
  DenaliWizardDraftMeta,
} from "../../draft/denali-wizard-draft-binding";
import {
  denaliHydrateDraftEnvelope,
  denaliPrepareDraftEnvelope,
  readDenaliWizardSourceRowVersion,
} from "../../draft/denali-wizard-draft-binding";

export type DenaliFlatEditDraftResetSync<TForm> = {
  readonly clearDraftAndReset: (reset: DenaliWizardDraftEnvelope<TForm>) => Promise<void>;
};

/**
 * Stamp the tour rowVersion this envelope was hydrated from (flat-edit only).
 * Goes through `denaliPrepareDraftEnvelope` so Track B allowlisting stays in one place.
 */
export function denaliFlatEditEnvelopeMetaForTour(
  envelopeMeta: DenaliWizardDraftMeta,
  tourRowVersion: number | null
): DenaliWizardDraftMeta {
  const sourceRowVersion = readDenaliWizardSourceRowVersion(tourRowVersion);
  return denaliPrepareDraftEnvelope(
    {},
    {
      ...envelopeMeta,
      ...(sourceRowVersion !== undefined ? { sourceRowVersion } : {}),
    }
  ).meta;
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
 * Unstamped envelopes are handled separately because their source version is
 * unknown and they require an explicit operator decision.
 */
export function isDenaliFlatEditDraftStaleVsTour(
  draft: DenaliWizardDraftEnvelope<unknown>,
  tourRowVersion: number | null
): boolean {
  const tour = readDenaliWizardSourceRowVersion(tourRowVersion);
  const source = readDenaliWizardSourceRowVersion(draft.meta.sourceRowVersion);
  if (tour === undefined || source === undefined) {
    return false;
  }
  return source < tour;
}

/**
 * Legacy edit drafts predate the source-row-version stamp. They cannot be
 * safely compared with the canonical tour, so they require an explicit
 * operator choice instead of silently replacing the current record.
 */
export function isDenaliFlatEditDraftUnstamped(draft: DenaliWizardDraftEnvelope<unknown>): boolean {
  return readDenaliWizardSourceRowVersion(draft.meta.sourceRowVersion) === undefined;
}

export function shouldSeedDenaliFlatEditDraftFromTour(input: {
  readonly remoteDraft: DenaliWizardDraftEnvelope<unknown> | null;
  readonly tourRowVersion: number | null;
  readonly draftStatus: DraftStatus;
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
  /** User explicitly chose to recover an unversioned legacy draft. */
  readonly allowUnstampedRemote?: boolean;
}): DenaliWizardDraftEnvelope<TForm> | null {
  const { remoteDraft, tourBaseline, tourRowVersion, envelopeMeta, allowUnstampedRemote } = input;
  if (tourBaseline === null) {
    return remoteDraft;
  }
  if (
    remoteDraft !== null &&
    !isDenaliFlatEditDraftStaleVsTour(remoteDraft, tourRowVersion) &&
    (!isDenaliFlatEditDraftUnstamped(remoteDraft) || allowUnstampedRemote === true)
  ) {
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
 * Requires `clearDraftAndReset` so React never observes `data=null`.
 */
export async function replaceDenaliFlatEditDraftAfterSuccessfulPatch<TForm>(input: {
  readonly baseline: TForm;
  readonly envelopeMeta: DenaliWizardDraftMeta;
  readonly tourRowVersion: number;
  readonly draftSync: DenaliFlatEditDraftResetSync<TForm>;
}): Promise<void> {
  await input.draftSync.clearDraftAndReset(
    prepareDenaliFlatEditSeedEnvelope(input.baseline, input.envelopeMeta, input.tourRowVersion)
  );
}
