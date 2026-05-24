import type { TourDetailViewHints } from "@repo/types";

/** Hours before departure when purchased users unlock exact GPS. */
export const TOUR_DETAIL_GPS_UNLOCK_HOURS_BEFORE = 48;

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function trimStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function tripDetailsLogistics(tour: Record<string, unknown>): Record<string, unknown> | undefined {
  const details = tour.details;
  if (details == null || typeof details !== "object" || Array.isArray(details)) {
    return undefined;
  }
  const tripDetails = (details as Record<string, unknown>).tripDetails;
  if (tripDetails == null || typeof tripDetails !== "object" || Array.isArray(tripDetails)) {
    return undefined;
  }
  const logistics = (tripDetails as Record<string, unknown>).logistics;
  if (logistics == null || typeof logistics !== "object" || Array.isArray(logistics)) {
    return undefined;
  }
  return logistics as Record<string, unknown>;
}

function parseDepartureInstant(departureDate: string, meetingTime: string): Date | null {
  const datePart = departureDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const fallback = Date.parse(datePart);
    return Number.isFinite(fallback) ? new Date(fallback) : null;
  }
  const timePart = HHMM_RE.test(meetingTime.trim()) ? meetingTime.trim() : "00:00";
  const iso = `${datePart}T${timePart}:00.000Z`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

/** Computes GPS unlock hints from `tripDetails.logistics` departure fields. */
export function computeTourDetailGpsViewHints(
  tour: Record<string, unknown>,
  now: Date = new Date(),
): TourDetailViewHints {
  const logistics = tripDetailsLogistics(tour);
  const departureDate = trimStr(logistics?.departureDate);
  if (!departureDate) {
    return { gpsUnlocked: false, gpsUnlockAt: null };
  }
  const meetingTime = trimStr(logistics?.departureMeetingTime);
  const departure = parseDepartureInstant(departureDate, meetingTime);
  if (!departure) {
    return { gpsUnlocked: false, gpsUnlockAt: null };
  }
  const unlockMs =
    departure.getTime() - TOUR_DETAIL_GPS_UNLOCK_HOURS_BEFORE * 60 * 60 * 1000;
  const unlockAt = new Date(unlockMs);
  return {
    gpsUnlocked: now.getTime() >= unlockMs,
    gpsUnlockAt: unlockAt.toISOString(),
  };
}
