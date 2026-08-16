import {
  compareIsoDates,
  isoDatetimeToLocalIsoDate,
  todayIsoDate,
} from "../adapters/calendar-format";

/** Canonical path for tour schedule start — minimum selectable calendar date is today. */
export const DENALI_TOUR_START_CANONICAL_PATH = "startDateTime" as const;

/** Canonical path for tour schedule end — min calendar day follows start (when parseable). */
export const DENALI_TOUR_END_CANONICAL_PATH = "endDateTime" as const;

/** Optional draft context when resolving datetime composite min dates. */
export type DenaliDatetimeFieldMinContext = {
  readonly startDateTimeIso?: string;
};

/** Minimum ISO calendar date (`YYYY-MM-DD`) for tour start fields (local timezone). */
export function resolveDenaliTourStartMinIsoDate(referenceDate: Date = new Date()): string {
  return todayIsoDate(referenceDate);
}

/**
 * UI min date for datetime composite fields.
 * - startDateTime → local today
 * - endDateTime → start’s local calendar day when start ISO parses; otherwise unconstrained
 *   (DN-SCHED-DATE-02). Do not clamp end to today: ED-DT-01 grandfathered past starts
 *   must still allow a historical end on/after that start day.
 */
export function resolveDenaliDatetimeFieldMinIsoDate(
  canonicalPath: string,
  referenceDate: Date = new Date(),
  context?: DenaliDatetimeFieldMinContext
): string | undefined {
  if (canonicalPath === DENALI_TOUR_START_CANONICAL_PATH) {
    return resolveDenaliTourStartMinIsoDate(referenceDate);
  }
  if (canonicalPath === DENALI_TOUR_END_CANONICAL_PATH) {
    const startIso = context?.startDateTimeIso?.trim() ?? "";
    if (startIso.length === 0) {
      return undefined;
    }
    return isoDatetimeToLocalIsoDate(startIso) ?? undefined;
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

/**
 * ED-DT-01 — edit grandfather: past start is allowed when its local calendar day
 * matches the loaded tour baseline (operator did not pick a new past day).
 */
export function isDenaliTourStartGrandfatheredPastBaseline(
  startIso: string,
  baselineStartIso: string | undefined,
  minIsoDate: string = resolveDenaliTourStartMinIsoDate()
): boolean {
  const baseline = baselineStartIso?.trim() ?? "";
  if (baseline.length === 0) {
    return false;
  }
  if (!isDenaliTourStartDatetimeBeforeMin(startIso, minIsoDate)) {
    return false;
  }
  const baselineLocal = isoDatetimeToLocalIsoDate(baseline);
  const currentLocal = isoDatetimeToLocalIsoDate(startIso);
  return baselineLocal != null && currentLocal != null && baselineLocal === currentLocal;
}

/**
 * ED-DT-RANGE-01 — true when both instants parse and end is not strictly after start
 * (equal clocks are a zero-length tour). Unparseable values return false so other
 * required/type checks own those cases.
 */
export function isDenaliTourEndDatetimeNotAfterStart(startIso: string, endIso: string): boolean {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return false;
  }
  return end <= start;
}
