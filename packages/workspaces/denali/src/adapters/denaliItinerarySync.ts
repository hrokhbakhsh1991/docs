import { denaliTourKindToIsMultiDay, type DenaliTourKind } from "../types/legacy/repo-types";
import {
  syncDenaliItineraryRows,
  type DenaliItineraryDay,
  type DenaliItineraryDayRow,
} from "../schemas/denaliItineraryDaySchema";

import { countInclusiveLocalCalendarDays } from "./denaliDatetime";

export type { DenaliItineraryDay, DenaliItineraryDayRow };
export { syncDenaliItineraryRows };

export function computeDenaliTourDayCount(
  startIso: string,
  endIso: string | undefined,
  isMultiDay: boolean
): number {
  if (!isMultiDay) {
    return 1;
  }
  return countInclusiveLocalCalendarDays(startIso, endIso ?? "") ?? 1;
}

export function computeDenaliTourDayCountFromKind(
  tourType: DenaliTourKind | undefined,
  startIso: string,
  endIso: string | undefined
): number {
  if (tourType == null || !denaliTourKindToIsMultiDay(tourType)) {
    return 1;
  }
  return computeDenaliTourDayCount(startIso, endIso, true);
}
