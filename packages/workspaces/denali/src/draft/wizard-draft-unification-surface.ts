import { DENALI_CREATE_TOUR_DRAFT_KEY } from "./denali-wizard-draft-binding";
import { logDenaliTombstoneShadowMismatch } from "./tombstone-shadow-log";
import { readDenaliDraftFieldValue } from "../wizard/resolve-initial-step-index";

/**
 * Manifest-bound draft unification surface + named host re-exports.
 * PSR-4b-exports-2: tests/helpers import these named exports instead of `./host/draft`.
 */
export {
  denaliHydrateDraftEnvelope,
  denaliPrepareDraftEnvelope,
} from "./denali-wizard-draft-binding";
export { createDenaliDraftSchemaGate } from "./create-denali-draft-schema-gate";
export { isDenaliFreshStartEnvelope, mergeDenaliWizardDraftEnvelope } from "./merge-envelope";
export { resolveDenaliDraftMerge } from "./resolve-denali-draft-merge";
export { logDenaliTombstoneShadowMismatch } from "./tombstone-shadow-log";

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
