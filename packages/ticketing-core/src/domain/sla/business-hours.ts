import type { BusinessHoursConfig, WeekdayKey } from "./types";
import { DEFAULT_BUSINESS_HOURS } from "./types";

const WEEKDAY_KEYS: readonly WeekdayKey[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

function parseHm(value: string): number {
  const [h, m] = value.split(":");
  const hours = Number.parseInt(h ?? "", 10);
  const minutes = Number.parseInt(m ?? "", 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    throw new Error("INVALID_BUSINESS_HOURS");
  }
  return hours * 60 + minutes;
}

function weekdayKey(date: Date, timezone: string): WeekdayKey {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(date);
  switch (weekday) {
    case "Mon":
      return "mon";
    case "Tue":
      return "tue";
    case "Wed":
      return "wed";
    case "Thu":
      return "thu";
    case "Fri":
      return "fri";
    case "Sat":
      return "sat";
    default:
      return "sun";
  }
}

function wallClockMinutes(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number.parseInt(parts.find((part) => part.type === "hour")?.value ?? "0", 10);
  const minute = Number.parseInt(parts.find((part) => part.type === "minute")?.value ?? "0", 10);
  return hour * 60 + minute;
}

function isWithinWindow(minuteOfDay: number, window: { start: string; end: string }): boolean {
  const start = parseHm(window.start);
  const end = parseHm(window.end);
  return minuteOfDay >= start && minuteOfDay < end;
}

export function normalizeBusinessHoursConfig(raw: unknown): BusinessHoursConfig {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return DEFAULT_BUSINESS_HOURS;
  }
  const record = raw as Record<string, unknown>;
  const timezone =
    typeof record.timezone === "string" && record.timezone.trim().length > 0
      ? record.timezone.trim()
      : DEFAULT_BUSINESS_HOURS.timezone;
  const weeklyRaw =
    record.weekly !== null && typeof record.weekly === "object" && !Array.isArray(record.weekly)
      ? (record.weekly as Record<string, unknown>)
      : {};
  const weekly = {} as Record<WeekdayKey, readonly { start: string; end: string }[]>;
  for (const key of WEEKDAY_KEYS) {
    const dayValue = weeklyRaw[key];
    if (!Array.isArray(dayValue)) {
      weekly[key] = DEFAULT_BUSINESS_HOURS.weekly[key];
      continue;
    }
    weekly[key] = dayValue
      .filter((entry) => entry !== null && typeof entry === "object" && !Array.isArray(entry))
      .map((entry) => {
        const row = entry as Record<string, unknown>;
        return {
          start: String(row.start ?? "09:00"),
          end: String(row.end ?? "17:00"),
        };
      });
  }
  return { timezone, weekly };
}

export function addBusinessMinutes(
  anchorIso: string,
  minutesToAdd: number,
  config: BusinessHoursConfig,
): string {
  if (minutesToAdd <= 0) {
    return anchorIso;
  }
  let remaining = minutesToAdd;
  let cursor = new Date(anchorIso);
  let guard = 0;
  while (remaining > 0 && guard < 500_000) {
    guard += 1;
    const dayKey = weekdayKey(cursor, config.timezone);
    const windows = config.weekly[dayKey] ?? [];
    const minuteOfDay = wallClockMinutes(cursor, config.timezone);
    let advanced = false;
    for (const window of windows) {
      const start = parseHm(window.start);
      const end = parseHm(window.end);
      if (minuteOfDay >= end) {
        continue;
      }
      const effectiveStart = Math.max(minuteOfDay, start);
      const available = end - effectiveStart;
      if (available <= 0) {
        continue;
      }
      const consume = Math.min(available, remaining);
      cursor = new Date(cursor.getTime() + consume * 60_000);
      remaining -= consume;
      advanced = true;
      if (remaining === 0) {
        break;
      }
    }
    if (remaining > 0) {
      if (!advanced) {
        cursor = new Date(cursor.getTime() + 60_000);
      }
      const nextMinute = wallClockMinutes(cursor, config.timezone);
      const dayWindows = config.weekly[weekdayKey(cursor, config.timezone)] ?? [];
      const inside = dayWindows.some((window) => isWithinWindow(nextMinute, window));
      if (!inside) {
        cursor = new Date(cursor.getTime() + 60_000);
      }
    }
  }
  return cursor.toISOString();
}

export function warningThresholdInstant(
  anchorIso: string,
  dueIso: string,
  warningThresholdPercent: number,
): string {
  const anchor = Date.parse(anchorIso);
  const due = Date.parse(dueIso);
  if (!Number.isFinite(anchor) || !Number.isFinite(due) || due <= anchor) {
    return dueIso;
  }
  const ratio = Math.min(Math.max(warningThresholdPercent, 1), 99) / 100;
  return new Date(anchor + (due - anchor) * ratio).toISOString();
}
