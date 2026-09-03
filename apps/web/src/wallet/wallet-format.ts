/**
 * WALLET-P3B — minor-unit amount formatting for operator wallet UI.
 */

const ZERO_DECIMAL_CURRENCIES = new Set(["IRR", "JPY", "KRW", "VND"]);

function parseMinorUnits(amountMinor: string): bigint {
  const trimmed = amountMinor.trim();
  if (!/^[0-9]+$/.test(trimmed)) {
    return 0n;
  }
  return BigInt(trimmed);
}

export function isZeroDecimalWalletCurrency(currency: string): boolean {
  return ZERO_DECIMAL_CURRENCIES.has(currency.trim().toUpperCase());
}

export function formatWalletMinorAmount(
  amountMinor: string,
  currency: string,
  locale: string,
): string {
  const normalizedCurrency = currency.trim().toUpperCase();
  const minor = parseMinorUnits(amountMinor);
  const zeroDecimal = isZeroDecimalWalletCurrency(normalizedCurrency);

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

export function formatWalletTimestamp(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
