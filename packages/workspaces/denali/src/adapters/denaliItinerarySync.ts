import { denaliTourKindToIsMultiDay, type DenaliTourKind } from "../types/legacy/repo-types";

import { parseIsoToYmdAndTime } from "./denaliDatetime";

export type DenaliItineraryDayRow = {
  day: number;
  activities: string;
  locationText?: string;
};

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function localMidnightMsFromYmd(ymd: string): number | null {
  if (!YMD_RE.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return null;
  const ms = new Date(y, m - 1, d).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function computeDenaliTourDayCount(
  startIso: string,
  endIso: string | undefined,
  isMultiDay: boolean
): number {
  if (!isMultiDay) return 1;
  const start = parseIsoToYmdAndTime(startIso).ymd;
  const end = parseIsoToYmdAndTime(endIso ?? "").ymd;
  if (!start || !end) return 1;
  const startMs = localMidnightMsFromYmd(start);
  const endMs = localMidnightMsFromYmd(end);
  if (startMs == null || endMs == null || endMs < startMs) return 1;
  return Math.max(1, Math.round((endMs - startMs) / 86_400_000) + 1);
}

export function computeDenaliTourDayCountFromKind(
  tourType: DenaliTourKind | undefined,
  startIso: string,
  endIso: string | undefined
): number {
  if (tourType == null || !denaliTourKindToIsMultiDay(tourType)) return 1;
  return computeDenaliTourDayCount(startIso, endIso, true);
}

export function syncDenaliItineraryRows(
  itinerary: DenaliItineraryDayRow[] | undefined,
  dayCount: number
): DenaliItineraryDayRow[] {
  const safeCount = Math.max(1, Math.min(dayCount, 60));
  const byDay = new Map((itinerary ?? []).map((row) => [row.day, row] as const));
  const next: DenaliItineraryDayRow[] = [];
  for (let day = 1; day <= safeCount; day += 1) {
    const prev = byDay.get(day);
    next.push({
      day,
      activities: prev?.activities ?? "",
      locationText: prev?.locationText,
    });
  }
  return next;
}
