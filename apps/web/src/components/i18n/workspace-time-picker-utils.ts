import { normalizeClockTime } from "@/i18n/datetime-format";

export type ClockSegments = {
  readonly hours: string;
  readonly minutes: string;
};

export function parseClockSegments(value: string): ClockSegments {
  const [hours = "", minutes = ""] = value.split(":");
  return { hours, minutes };
}

export function buildClockTime(hours: string, minutes: string): string {
  if (hours.length === 0 && minutes.length === 0) {
    return "";
  }
  const hh = hours.padStart(2, "0").slice(-2);
  const mm = minutes.padStart(2, "0").slice(-2);
  return normalizeClockTime(`${hh}:${mm}`);
}

export function clampClockSegment(segment: "hours" | "minutes", raw: string): string {
  if (raw.length === 0) {
    return "";
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    return "";
  }
  if (segment === "hours") {
    return String(Math.min(23, Math.max(0, parsed))).padStart(2, "0");
  }
  return String(Math.min(59, Math.max(0, parsed))).padStart(2, "0");
}

export function normalizeClockSegmentsOnBlur(segments: ClockSegments): ClockSegments {
  const hours =
    segments.hours.length > 0 ? clampClockSegment("hours", segments.hours) : segments.hours;
  const minutes =
    segments.minutes.length > 0 ? clampClockSegment("minutes", segments.minutes) : segments.minutes;
  return { hours, minutes };
}
