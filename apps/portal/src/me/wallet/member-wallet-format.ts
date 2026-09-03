/**
 * WALLET-P3A — format wallet minor-unit amounts for member portal display.
 */
import {
  isZeroDecimalWalletCurrency,
  type MemberWalletPresentationPolicy,
} from "@app-tour/workspace-sdk";

function parseMinorUnits(amountMinor: string): bigint {
  const trimmed = amountMinor.trim();
  if (!/^[0-9]+$/.test(trimmed)) {
    return 0n;
  }
  return BigInt(trimmed);
}

export function formatMemberWalletMinorAmount(
  amountMinor: string,
  currency: string,
  locale: string,
  presentation: MemberWalletPresentationPolicy,
): string {
  const normalizedCurrency = currency.trim().toUpperCase();
  const minor = parseMinorUnits(amountMinor);
  const zeroDecimal =
    presentation.zeroDecimalCurrency || isZeroDecimalWalletCurrency(normalizedCurrency);

  if (zeroDecimal) {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: 0,
    }).format(Number(minor));
  }

  const major = Number(minor) / 100;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: normalizedCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(major);
}

export function mapWalletTransactionDirection(
  kind: "operator_credit" | "operator_debit" | "reversal",
): "incoming" | "outgoing" {
  if (kind === "operator_debit") {
    return "outgoing";
  }
  return "incoming";
}
