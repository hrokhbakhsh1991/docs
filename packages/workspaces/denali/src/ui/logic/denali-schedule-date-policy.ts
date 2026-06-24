import {
  compareIsoDates,
  isoDatetimeToLocalIsoDate,
  todayIsoDate,
} from "../adapters/calendar-format";

/** Canonical path for tour schedule start — minimum selectable calendar date is today. */
export const DENALI_TOUR_START_CANONICAL_PATH = "startDateTime" as const;

/** Minimum ISO calendar date (`YYYY-MM-DD`) for tour start fields (local timezone). */
export function resolveDenaliTourStartMinIsoDate(referenceDate: Date = new Date()): string {
  return todayIsoDate(referenceDate);
}

/** UI min date for datetime composite fields; only tour start is constrained to today+. */
export function resolveDenaliDatetimeFieldMinIsoDate(
  canonicalPath: string,
  referenceDate: Date = new Date()
): string | undefined {
  if (canonicalPath === DENALI_TOUR_START_CANONICAL_PATH) {
    return resolveDenaliTourStartMinIsoDate(referenceDate);
  }
  return undefined;
}

export function isDenaliIsoDateSelectable(isoDate: string, minIsoDate?: string): boolean {
  if (minIsoDate == null || minIsoDate.trim().length === 0) {
    return true;
  }
  return compareIsoDates(isoDate, minIsoDate) >= 0;
}

/** True when stored ISO datetime's local calendar day is strictly before `minIsoDate`. */
export function isDenaliTourStartDatetimeBeforeMin(
  isoDatetime: string,
  minIsoDate: string = resolveDenaliTourStartMinIsoDate()
): boolean {
  const localDate = isoDatetimeToLocalIsoDate(isoDatetime);
  if (localDate == null) {
    return false;
  }
  return compareIsoDates(localDate, minIsoDate) < 0;
}
