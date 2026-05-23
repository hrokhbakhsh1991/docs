const RELATIVE_TIME_DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" }
];

export function formatRelativeActiveTime(
  iso: string | null | undefined,
  nowMs: number = Date.now()
): string | null {
  if (!iso?.trim()) {
    return null;
  }
  const then = Date.parse(iso);
  if (Number.isNaN(then)) {
    return null;
  }
  let delta = (then - nowMs) / 1000;
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const division of RELATIVE_TIME_DIVISIONS) {
    if (Math.abs(delta) < division.amount) {
      return rtf.format(Math.round(delta), division.unit);
    }
    delta /= division.amount;
  }
  return null;
}

export function formatActiveAgoLabel(iso: string | null | undefined): string | null {
  return formatActiveAgoLabelFa(iso, "بدون فعالیت اخیر");
}

function formatRelativeActiveTimeFa(
  iso: string | null | undefined,
  nowMs: number = Date.now()
): string | null {
  if (!iso?.trim()) {
    return null;
  }
  const then = Date.parse(iso);
  if (Number.isNaN(then)) {
    return null;
  }
  let delta = (then - nowMs) / 1000;
  const rtf = new Intl.RelativeTimeFormat("fa-IR", { numeric: "auto" });
  for (const division of RELATIVE_TIME_DIVISIONS) {
    if (Math.abs(delta) < division.amount) {
      return rtf.format(Math.round(delta), division.unit);
    }
    delta /= division.amount;
  }
  return null;
}

/** Persian relative activity label for directory profile cell. */
export function formatActiveAgoLabelFa(iso: string | null | undefined, neverLabel: string): string {
  const relative = formatRelativeActiveTimeFa(iso);
  if (!relative) {
    return neverLabel;
  }
  if (relative === "اکنون") {
    return "همین الان فعال";
  }
  return `فعال در ${relative}`;
}

export function formatTripSummaryLabelFa(
  completedTrips: number | undefined,
  cancelledTrips: number | undefined
): string {
  const ok = completedTrips ?? 0;
  const cancel = cancelledTrips ?? 0;
  return `${ok.toLocaleString("fa-IR")} موفق / ${cancel.toLocaleString("fa-IR")} کنسل شده`;
}

/** Localized pending-invite expiry (relative future or absolute fa-IR). */
export function formatInviteExpiresLabelFa(iso: string, nowMs: number = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) {
    return "—";
  }
  if (then <= nowMs) {
    return "منقضی شده";
  }
  const relative = formatRelativeActiveTimeFa(iso, nowMs);
  if (!relative) {
    const d = new Date(iso);
    return d.toLocaleString("fa-IR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }
  if (relative === "اکنون") {
    return "انقضا به‌زودی";
  }
  if (relative.startsWith("در")) {
    return `انقضا ${relative}`;
  }
  return `انقضا در ${relative}`;
}

const REGISTRATION_STATUS_FA: Record<string, string> = {
  Pending: "در انتظار",
  Accepted: "پذیرفته",
  AcceptedPaid: "پذیرفته (پرداخت شده)",
  Rejected: "رد شده",
  Cancelled: "لغو شده",
  NoShow: "عدم حضور",
  Refunded: "استرداد"
};

const PAYMENT_STATUS_FA: Record<string, string> = {
  NotPaid: "پرداخت نشده",
  Paid: "پرداخت شده",
  Refunded: "استرداد",
  Failed: "ناموفق",
  Partial: "پرداخت جزئی"
};

export function formatRegistrationStatusFa(status: string): string {
  return REGISTRATION_STATUS_FA[status] ?? status;
}

export function formatPaymentStatusFa(status: string): string {
  return PAYMENT_STATUS_FA[status] ?? status;
}

export function formatDepartureDateFa(iso: string | null | undefined): string {
  if (!iso?.trim()) {
    return "—";
  }
  const d = new Date(`${iso.trim().slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  return d.toLocaleDateString("fa-IR", { year: "numeric", month: "short", day: "numeric" });
}

/** Format minor-unit ledger balance (IRR minor rials → Toman; USD minor cents → $). */
export function formatWalletBalanceMinor(
  balanceMinor: string | null | undefined,
  currency: string | null | undefined
): string {
  const raw = (balanceMinor ?? "0").trim() || "0";
  let minor: bigint;
  try {
    minor = BigInt(raw);
  } catch {
    minor = 0n;
  }
  const code = (currency ?? "IRR").trim().toUpperCase() || "IRR";
  if (code === "IRR") {
    const toman = minor / 10n;
    const abs = toman < 0n ? -toman : toman;
    const formatted = abs.toLocaleString("fa-IR");
    const sign = toman > 0n ? "+" : toman < 0n ? "-" : "";
    return `${sign}${formatted} تومان`;
  }
  if (code === "USD") {
    const negative = minor < 0n;
    const absMinor = negative ? -minor : minor;
    const dollars = absMinor / 100n;
    const cents = absMinor % 100n;
    const body =
      cents === 0n
        ? dollars.toLocaleString("en-US")
        : `${dollars.toLocaleString("en-US")}.${cents.toString().padStart(2, "0")}`;
    return negative ? `-$${body}` : `$${body}`;
  }
  return `${minor.toString()} ${code}`;
}

export function formatTripSummaryLabel(
  completedTrips: number | undefined,
  cancelledTrips: number | undefined
): string {
  return formatTripSummaryLabelFa(completedTrips, cancelledTrips);
}
