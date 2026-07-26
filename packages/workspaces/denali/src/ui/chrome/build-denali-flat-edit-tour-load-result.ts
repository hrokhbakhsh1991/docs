import type {
  DenaliFlatEditTourDetail,
  DenaliFlatEditTourLoadResult,
} from "./use-flat-edit-page-core";
import type { DenaliTourWizardDraft } from "../../draft/denali-tour-wizard-draft";
import {
  toDenaliFlatEditTourDetail,
  type TourProjectionForFlatEditDetail,
} from "./to-denali-flat-edit-tour-detail";

export function denaliFlatEditHydratorUnavailableResult(): Extract<
  DenaliFlatEditTourLoadResult,
  { readonly ok: false }
> {
  return { ok: false, kind: "error", code: "TOUR_EDIT_HYDRATOR_UNAVAILABLE" };
}

export function buildDenaliFlatEditTourLoadSuccess(input: {
  readonly detail: DenaliFlatEditTourDetail;
  readonly baseline: DenaliTourWizardDraft;
  readonly rowVersion: number;
}): Extract<DenaliFlatEditTourLoadResult, { readonly ok: true }> {
  return {
    ok: true,
    detail: input.detail,
    baseline: input.baseline,
    rowVersion: input.rowVersion,
  };
}

/**
 * After host hydrate: map null baseline → unavailable, else success with chrome detail.
 */
export function finalizeDenaliFlatEditTourLoad(input: {
  readonly tourDetail: {
    readonly projection: TourProjectionForFlatEditDetail;
    readonly rowVersion: number;
  };
  readonly baseline: DenaliTourWizardDraft | null;
}): DenaliFlatEditTourLoadResult {
  if (input.baseline == null) {
    return denaliFlatEditHydratorUnavailableResult();
  }
  return buildDenaliFlatEditTourLoadSuccess({
    detail: toDenaliFlatEditTourDetail(input.tourDetail),
    baseline: input.baseline,
    rowVersion: input.tourDetail.rowVersion,
  });
}
