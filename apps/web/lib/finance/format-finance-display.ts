const RECEIPT_STATUS_FA: Record<string, string> = {
  Pending: "در انتظار بررسی",
  Approved: "تایید شده",
  Rejected: "رد شده",
};

/** Localize receipt_status_enum values for finance panels. */
export function formatReceiptStatusFa(status: string): string {
  return RECEIPT_STATUS_FA[status] ?? status;
}

/**
 * Format payment.amount (positive integer minor string) for finance UI.
 * IRR minor rials → fa-IR Toman; other currencies use fa-IR digits + unit label.
 */
export function formatFinanceAmountFa(
  amount: string | null | undefined,
  currency: string | null | undefined
): string {
  const raw = (amount ?? "0").trim().replace(/,/g, "") || "0";
  let minor: bigint;
  try {
    minor = BigInt(raw.split(".")[0] ?? "0");
  } catch {
    minor = 0n;
  }
  const code = (currency ?? "IRR").trim().toUpperCase() || "IRR";
  if (code === "IRR") {
    const toman = minor / 10n;
    const formatted = toman.toLocaleString("fa-IR");
    return `${formatted} تومان`;
  }
  if (code === "USD") {
    const dollars = minor / 100n;
    const cents = minor % 100n;
    const body =
      cents === 0n
        ? dollars.toLocaleString("fa-IR")
        : `${dollars.toLocaleString("fa-IR")}.${cents.toString().padStart(2, "0")}`;
    return `${body} دلار`;
  }
  const formatted = minor.toLocaleString("fa-IR");
  return `${formatted} ریال`;
}
