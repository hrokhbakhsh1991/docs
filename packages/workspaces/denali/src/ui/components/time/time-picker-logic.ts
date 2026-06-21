import { normalizeClockTime } from "../../adapters/datetime-format";

/** Tour scheduling — 5-minute slots (common booking UX, faster than 60 rows). */
export const TIME_PICKER_MINUTE_STEP = 5;

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));

const MINUTE_OPTIONS = Array.from(
  { length: 60 / TIME_PICKER_MINUTE_STEP },
  (_, index) => String(index * TIME_PICKER_MINUTE_STEP).padStart(2, "0")
);

export function listTimePickerHours(): readonly string[] {
  return HOUR_OPTIONS;
}

export function listTimePickerMinutes(): readonly string[] {
  return MINUTE_OPTIONS;
}

export function splitClockValue(value: string): { readonly hours: string; readonly minutes: string } {
  const normalized = normalizeClockTime(value.trim());
  if (normalized.length === 0) {
    return { hours: "", minutes: "" };
  }
  const [hours = "", minutes = ""] = normalized.split(":");
  return { hours, minutes: snapMinuteToPickerStep(minutes) };
}

export function snapMinuteToPickerStep(minutes: string): string {
  const parsed = Number.parseInt(minutes, 10);
  if (Number.isNaN(parsed)) {
    return "00";
  }
  const snapped = Math.round(parsed / TIME_PICKER_MINUTE_STEP) * TIME_PICKER_MINUTE_STEP;
  const clamped = Math.min(55, Math.max(0, snapped));
  return String(clamped).padStart(2, "0");
}

export function joinClockParts(hours: string, minutes: string): string {
  if (hours.length === 0 && minutes.length === 0) {
    return "";
  }
  const hh = hours.padStart(2, "0").slice(-2);
  const mm = snapMinuteToPickerStep(minutes);
  return normalizeClockTime(`${hh}:${mm}`);
}
