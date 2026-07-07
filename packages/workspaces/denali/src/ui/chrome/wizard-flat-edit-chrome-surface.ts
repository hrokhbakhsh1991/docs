import { loadDenaliSubmitCatalogIds } from "../adapters/submit-catalog-fetch";
import {
  useDenaliFlatEditPageCore,
  type DenaliFlatEditTourDetail,
  type DenaliFlatEditTourLoadResult,
} from "./use-flat-edit-page-core";

export type DenaliWizardFlatEditChromeSurface = {
  readonly useFlatEditPageCore: typeof useDenaliFlatEditPageCore;
  readonly loadSubmitCatalog: typeof loadDenaliSubmitCatalogIds;
};

export type { DenaliFlatEditTourDetail, DenaliFlatEditTourLoadResult };

export const denaliWizardFlatEditChromeSurface: DenaliWizardFlatEditChromeSurface = Object.freeze({
  useFlatEditPageCore: useDenaliFlatEditPageCore,
  loadSubmitCatalog: loadDenaliSubmitCatalogIds,
});
