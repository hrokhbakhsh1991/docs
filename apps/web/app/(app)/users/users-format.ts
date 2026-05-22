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
  const relative = formatRelativeActiveTime(iso);
  if (!relative) {
    return null;
  }
  if (relative === "now") {
    return "Active now";
  }
  return `Active ${relative}`;
}

/** Format minor-unit ledger balance for display (IRR shown as whole rials). */
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
    return `${minor.toLocaleString(undefined)} IRR`;
  }
  return `${minor.toString()} ${code}`;
}
