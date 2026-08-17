const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseIsoToYmdAndTime(iso: string): { ymd: string; time: string } {
  const trimmed = iso.trim();
  if (trimmed.length === 0) {
    return { ymd: "", time: "" };
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    const [ymd = "", time = ""] = trimmed.split("T");
    return { ymd: YMD_RE.test(ymd) ? ymd : "", time };
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return { ymd: `${y}-${m}-${d}`, time: `${hh}:${mm}` };
}

function localMidnightMsFromYmd(ymd: string): number | null {
  if (!YMD_RE.test(ymd)) {
    return null;
  }
  const [year, month, day] = ymd.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }
  const ms = new Date(year, month - 1, day).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Inclusive distinct local calendar days between two ISO datetimes.
 * Same local YMD → 1. Next local day → 2. Inverted or unparseable → undefined.
 * INV-DENALI-MULTI-CAL-A — itinerary row count is not a day.
 */
export function countInclusiveLocalCalendarDays(
  startIso: string,
  endIso: string
): number | undefined {
  const start = parseIsoToYmdAndTime(startIso).ymd;
  const end = parseIsoToYmdAndTime(endIso).ymd;
  if (start.length === 0 || end.length === 0) {
    return undefined;
  }
  const startMs = localMidnightMsFromYmd(start);
  const endMs = localMidnightMsFromYmd(end);
  if (startMs == null || endMs == null || endMs < startMs) {
    return undefined;
  }
  return Math.round((endMs - startMs) / 86_400_000) + 1;
}
