import { loadDenaliSubmitCatalogIds } from "../adapters/submit-catalog-fetch";
import {
  buildDenaliFlatEditTourLoadSuccess,
  denaliFlatEditHydratorUnavailableResult,
} from "./build-denali-flat-edit-tour-load-result";
import { buildDenaliFlatEditMetaLine } from "./build-denali-flat-edit-meta-line";
import { mapDenaliFlatEditTourHttpStatus } from "./map-denali-flat-edit-tour-http-status";
import {
  toDenaliFlatEditTourDetail,
  type TourProjectionForFlatEditDetail,
} from "./to-denali-flat-edit-tour-detail";
import {
  useDenaliFlatEditPageCore,
  type DenaliFlatEditTourDetail,
  type DenaliFlatEditTourLoadResult,
} from "./use-flat-edit-page-core";

export type DenaliWizardFlatEditChromeSurface = {
  readonly useFlatEditPageCore: typeof useDenaliFlatEditPageCore;
  readonly loadSubmitCatalog: typeof loadDenaliSubmitCatalogIds;
  readonly toFlatEditTourDetail: typeof toDenaliFlatEditTourDetail;
  readonly mapTourHttpStatus: typeof mapDenaliFlatEditTourHttpStatus;
  readonly buildMetaLine: typeof buildDenaliFlatEditMetaLine;
  readonly buildTourLoadSuccess: typeof buildDenaliFlatEditTourLoadSuccess;
  readonly hydratorUnavailableResult: typeof denaliFlatEditHydratorUnavailableResult;
};

export type { DenaliFlatEditTourDetail, DenaliFlatEditTourLoadResult, TourProjectionForFlatEditDetail };
export {
  toDenaliFlatEditTourDetail,
  mapDenaliFlatEditTourHttpStatus,
  buildDenaliFlatEditMetaLine,
  buildDenaliFlatEditTourLoadSuccess,
  denaliFlatEditHydratorUnavailableResult,
};

export const denaliWizardFlatEditChromeSurface: DenaliWizardFlatEditChromeSurface = Object.freeze({
  useFlatEditPageCore: useDenaliFlatEditPageCore,
  loadSubmitCatalog: loadDenaliSubmitCatalogIds,
  toFlatEditTourDetail: toDenaliFlatEditTourDetail,
  mapTourHttpStatus: mapDenaliFlatEditTourHttpStatus,
  buildMetaLine: buildDenaliFlatEditMetaLine,
  buildTourLoadSuccess: buildDenaliFlatEditTourLoadSuccess,
  hydratorUnavailableResult: denaliFlatEditHydratorUnavailableResult,
});
