import type { DenaliFlatEditTourLoadResult } from "./use-flat-edit-page-core";

export type DenaliFlatEditTourHttpFailure = Extract<
  DenaliFlatEditTourLoadResult,
  { readonly ok: false }
>;

/**
 * Maps tour-detail HTTP status to a flat-edit load failure.
 * Success / body parsing stay in the host loader (BFF + hydrate).
 */
export function mapDenaliFlatEditTourHttpStatus(
  status: number
): DenaliFlatEditTourHttpFailure | null {
  if (status === 404) {
    return { ok: false, kind: "not-found", code: "TOUR_NOT_FOUND" };
  }
  if (status < 200 || status >= 300) {
    return { ok: false, kind: "error", code: `TOUR_EDIT_HTTP_${status}` };
  }
  return null;
}
