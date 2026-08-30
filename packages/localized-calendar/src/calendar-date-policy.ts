import { compareIsoDates } from "./calendar-format";

/** True when `isoDate` is on or after `minIsoDate` (Gregorian YYYY-MM-DD). */
export function isIsoDateSelectable(isoDate: string, minIsoDate?: string): boolean {
  if (minIsoDate == null || minIsoDate.trim().length === 0) {
    return true;
  }
  return compareIsoDates(isoDate, minIsoDate) >= 0;
}
