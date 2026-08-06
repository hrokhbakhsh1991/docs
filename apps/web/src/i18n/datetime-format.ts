import { formatIsoDateLabel } from "./calendar-format";
import { toLocalizedDigits } from "./format-localized-digits";
import type { AppLocale } from "./routing";

/**
 * Convert stored ISO datetime to `datetime-local` wall (local timezone).
 * Product-blind — do not import workspace packages for list/review formatting (Wave H.h).
 */
export function isoToDatetimeLocalInput(iso: string): string {
  const trimmed = iso.trim();
  if (trimmed.length === 0) {
    return "";
  }
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) {
    return trimmed.length >= 16 ? trimmed.slice(0, 16) : trimmed;
  }
  const date = new Date(parsed);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

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
  const normalizedTime = normalizeClockTime(time) || "00:00";
  return `${trimmedDate}T${normalizedTime}`;
}

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
