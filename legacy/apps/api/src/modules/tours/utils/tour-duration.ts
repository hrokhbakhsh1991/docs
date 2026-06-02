/**
 * Tour duration is **derived** from `tripDetails.logistics.departureDate` / `returnDate`
 * (Gregorian `YYYY-MM-DD`). Same date => 1 day, depart 2026-05-01 / return 2026-05-03 => 3 days.
 *
 * Sanity bounds (kept in sync with the web `tour-duration` helper):
 *   1 <= durationDays <= 60
 */
export const TOUR_DURATION_DAYS_MIN = 1;
export const TOUR_DURATION_DAYS_MAX = 60;

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Returns inclusive day count or `undefined` when inputs are missing/invalid/out-of-range. */
export function computeTourDurationDays(depYmd: unknown, retYmd: unknown): number | undefined {
  if (typeof depYmd !== "string" || typeof retYmd !== "string") return undefined;
  const dep = depYmd.trim();
  const ret = retYmd.trim();
  if (!YMD_RE.test(dep) || !YMD_RE.test(ret)) return undefined;
  const depMs = Date.parse(`${dep}T00:00:00Z`);
  const retMs = Date.parse(`${ret}T00:00:00Z`);
  if (Number.isNaN(depMs) || Number.isNaN(retMs)) return undefined;
  if (retMs < depMs) return undefined;
  const days = Math.round((retMs - depMs) / 86_400_000) + 1;
  if (days < TOUR_DURATION_DAYS_MIN || days > TOUR_DURATION_DAYS_MAX) return undefined;
  return days;
}
