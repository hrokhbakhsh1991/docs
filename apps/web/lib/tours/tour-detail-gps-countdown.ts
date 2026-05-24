/**
 * Human-readable countdown until GPS unlock for purchased tour detail viewers.
 */

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

function parseUnlockInstant(unlockAt: string): Date | null {
  const ms = Date.parse(unlockAt);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

function formatUnit(value: number, unit: Intl.RelativeTimeFormatUnit, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
  return rtf.format(value, unit);
}

/**
 * Returns a localized relative countdown (e.g. "in 2 days") when unlock is in the future;
 * `null` when already unlocked or unlock time is invalid.
 */
export function formatGpsUnlockCountdown(
  unlockAt: string,
  now: Date = new Date(),
  locale = "fa-IR",
): string | null {
  const unlock = parseUnlockInstant(unlockAt);
  if (!unlock) {
    return null;
  }
  const diffMs = unlock.getTime() - now.getTime();
  if (diffMs <= 0) {
    return null;
  }

  if (diffMs >= MS_PER_DAY) {
    const days = Math.ceil(diffMs / MS_PER_DAY);
    return formatUnit(days, "day", locale);
  }
  if (diffMs >= MS_PER_HOUR) {
    const hours = Math.ceil(diffMs / MS_PER_HOUR);
    return formatUnit(hours, "hour", locale);
  }
  const minutes = Math.max(1, Math.ceil(diffMs / MS_PER_MINUTE));
  return formatUnit(minutes, "minute", locale);
}

export function isGpsUnlockPending(unlockAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!unlockAt?.trim()) {
    return false;
  }
  const unlock = parseUnlockInstant(unlockAt);
  if (!unlock) {
    return false;
  }
  return unlock.getTime() > now.getTime();
}
