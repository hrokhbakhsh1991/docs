import { DENALI_CREATE_TOUR_DRAFT_KEY } from "./denali-wizard-draft-binding";
import { logDenaliTombstoneShadowMismatch } from "./tombstone-shadow-log";
import { readDenaliDraftFieldValue } from "../wizard/resolve-initial-step-index";

export type DenaliWizardDraftUnificationSurface = {
  readonly createTourDraftKey: typeof DENALI_CREATE_TOUR_DRAFT_KEY;
  readonly logTombstoneShadowMismatch: typeof logDenaliTombstoneShadowMismatch;
  readonly readDraftFieldValue: typeof readDenaliDraftFieldValue;
};

export const denaliWizardDraftUnificationSurface: DenaliWizardDraftUnificationSurface =
  Object.freeze({
    createTourDraftKey: DENALI_CREATE_TOUR_DRAFT_KEY,
    logTombstoneShadowMismatch: logDenaliTombstoneShadowMismatch,
    readDraftFieldValue: readDenaliDraftFieldValue,
  });
