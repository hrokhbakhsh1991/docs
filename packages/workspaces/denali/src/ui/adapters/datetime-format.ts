import { formatIsoDateLabel } from "./calendar-format";
import { toLocalizedDigits, type AppLocale } from "./i18n-format";

/** Default wall clock invented by {@link joinDatetimeLocal} when time is empty. */
export const DATETIME_LOCAL_INVENTED_MIDNIGHT = "00:00" as const;

export function splitDatetimeLocal(value: string): { readonly date: string; readonly time: string } {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { date: "", time: "" };
  }
  const separator = trimmed.indexOf("T");
  if (separator === -1) {
    return { date: trimmed.slice(0, 10), time: "" };
  }
  return {
    date: trimmed.slice(0, separator),
    time: trimmed.slice(separator + 1, separator + 6),
  };
}

export function joinDatetimeLocal(date: string, time: string): string {
  const trimmedDate = date.trim();
  if (trimmedDate.length === 0) {
    return "";
  }
  const normalizedTime = normalizeClockTime(time) || DATETIME_LOCAL_INVENTED_MIDNIGHT;
  return `${trimmedDate}T${normalizedTime}`;
}

/**
 * True when `own` is empty or the invent sentinel from {@link joinDatetimeLocal}, while a
 * meaningful non-midnight fallback (e.g. tour start clock) is available.
 */
export function isUnsetOrInventedMidnightClock(
  currentTime: string,
  fallbackTime?: string
): boolean {
  const own = currentTime.trim();
  const fallback = fallbackTime?.trim() ?? "";
  if (fallback.length === 0 || fallback === DATETIME_LOCAL_INVENTED_MIDNIGHT) {
    return false;
  }
  return own.length === 0 || own === DATETIME_LOCAL_INVENTED_MIDNIGHT;
}

/**
 * ED-DT-END-01 — when committing a date change, keep an explicit non-midnight clock; otherwise
 * inherit fallback before {@link joinDatetimeLocal} invents midnight.
 */
export function resolveDatetimePickerTimeForDateCommit(
  currentTime: string,
  fallbackTime?: string
): string {
  const own = currentTime.trim();
  const fallback = fallbackTime?.trim() ?? "";
  if (isUnsetOrInventedMidnightClock(own, fallback)) {
    return fallback;
  }
  if (own.length > 0) {
    return own;
  }
  return fallback;
}

/**
 * ED-DT-CLOCK-01 — date pickers may re-emit the current day on remount (tour-kind change).
 * A complete ISO clock must not be rewritten just because the calendar day is unchanged.
 */
export function isDatetimePickerDateUnchanged(nextDate: string, currentDate: string): boolean {
  return nextDate.trim() === currentDate.trim();
}

/**
 * Repair an end datetime-local wall that still carries invented midnight while start has a real clock.
 * Returns the repaired local string, or `null` when no repair is needed.
 */
export function repairInventedMidnightDatetimeLocal(
  endDatetimeLocal: string,
  startDatetimeLocal: string
): string | null {
  const endParts = splitDatetimeLocal(endDatetimeLocal);
  const startParts = splitDatetimeLocal(startDatetimeLocal);
  if (endParts.date.length === 0) {
    return null;
  }
  if (!isUnsetOrInventedMidnightClock(endParts.time, startParts.time)) {
    return null;
  }
  return joinDatetimeLocal(endParts.date, startParts.time);
}

export function formatDatetimeLocalLabel(value: string, locale: AppLocale): string {
  const { date, time } = splitDatetimeLocal(value);
  if (date.length === 0) {
    return "";
  }
  const dateLabel = formatIsoDateLabel(date, locale);
  if (time.length === 0) {
    return dateLabel;
  }
  const clockLabel = locale === "fa" ? toLocalizedDigits(time, locale) : time;
  return `${dateLabel} · ${clockLabel}`;
}

/** Normalize clock input to `HH:mm` (24h). Empty string stays empty. */
export function normalizeClockTime(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "";
  }
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(trimmed);
  if (!match) {
    return trimmed;
  }
  const hours = Number.parseInt(match[1]!, 10);
  const minutes = Number.parseInt(match[2]!, 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return trimmed;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}`;
}
