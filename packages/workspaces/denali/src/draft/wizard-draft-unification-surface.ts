import { DENALI_CREATE_TOUR_DRAFT_KEY } from "./denali-wizard-draft-binding";
import { logDenaliTombstoneShadowMismatch } from "./tombstone-shadow-log";

export type DenaliWizardDraftUnificationSurface = {
  readonly createTourDraftKey: typeof DENALI_CREATE_TOUR_DRAFT_KEY;
  readonly logTombstoneShadowMismatch: typeof logDenaliTombstoneShadowMismatch;
};

export const denaliWizardDraftUnificationSurface: DenaliWizardDraftUnificationSurface =
  Object.freeze({
    createTourDraftKey: DENALI_CREATE_TOUR_DRAFT_KEY,
    logTombstoneShadowMismatch: logDenaliTombstoneShadowMismatch,
  });
