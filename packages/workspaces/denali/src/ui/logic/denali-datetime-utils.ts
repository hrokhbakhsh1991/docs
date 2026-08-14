/**
 * Convert stored ISO datetime to `datetime-local` input value (local timezone).
 * Wizard/host SoT — the web thin-shell keeps a product-blind twin for list formatting
 * (Wave H.h forbids importing this package from shell app source).
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

/** Normalize approximate return clock time to `HH:mm`. */
export function normalizeApproximateReturnTime(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "";
  }
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(trimmed);
  if (match) {
    const hours = Number.parseInt(match[1]!, 10);
    const minutes = Number.parseInt(match[2]!, 10);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  }
  return trimmed;
}

/** Convert `datetime-local` input value to ISO string for canonical storage. */
export function datetimeLocalInputToIso(local: string): string {
  const trimmed = local.trim();
  if (trimmed.length === 0) {
    return "";
  }
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) {
    return trimmed;
  }
  return new Date(parsed).toISOString();
}
