/**
 * ISO 4217 minor-unit exponents for catalog / ledger amount conversion.
 * Replaces blind `× 100` when persisting `listPriceMinor` from `cost_context.totalCost`.
 */

/** Backward-compatible default when cost context and workspace omit currency. */
export const DEFAULT_CATALOG_CURRENCY_CODE = "USD";

/** Matches {@link DEFAULT_CATALOG_CURRENCY_CODE} (USD minor units = cents). */
export const DEFAULT_MINOR_UNIT_EXPONENT = 2;

/** PostgreSQL signed bigint upper bound (19 digits). */
export const PG_BIGINT_MAX = 9223372036854775807n;

export const PG_BIGINT_MAX_STR = "9223372036854775807";

export const JS_MAX_SAFE_INTEGER_STR = "9007199254740991";

/** Decimal major-unit string accepted at ingress and for string scaling. */
export const DECIMAL_MAJOR_REGEX = /^\d+(\.\d+)?$/;

export type MajorAmountScaleErrorCode =
  | "INVALID_FORMAT"
  | "FINANCIAL_NUMERIC_OVERFLOW_LIMIT";

export class MajorAmountScaleError extends Error {
  readonly code: MajorAmountScaleErrorCode;

  constructor(code: MajorAmountScaleErrorCode, message: string) {
    super(message);
    this.name = "MajorAmountScaleError";
    this.code = code;
  }
}

/**
 * ISO 4217 minor-unit decimal places for selected codes.
 * Unlisted active codes default to {@link DEFAULT_MINOR_UNIT_EXPONENT}.
 */
const ISO_4217_MINOR_UNIT_EXPONENT: Readonly<Record<string, number>> = {
  // Zero-decimal (major unit = minor unit)
  BIF: 0,
  CLP: 0,
  DJF: 0,
  GNF: 0,
  ISK: 0,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  UYI: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
  /** Iranian Rial / informal Toman entry paths store whole-unit majors in wizard. */
  IRR: 0,
  IRT: 0,

  // Three-decimal
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
};

export function normalizeCurrencyCode(value: string | null | undefined): string {
  const trimmed = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!trimmed) {
    return DEFAULT_CATALOG_CURRENCY_CODE;
  }
  return trimmed.slice(0, 8);
}

/**
 * Returns ISO 4217 minor-unit exponent for `currencyCode` (0, 2, or 3 for supported sets).
 * Unknown codes default to 2 (USD-style) for legacy client parity.
 */
export function getIso4217MinorUnitExponent(currencyCode: string | null | undefined): number {
  const code = normalizeCurrencyCode(currencyCode);
  const exponent = ISO_4217_MINOR_UNIT_EXPONENT[code];
  if (exponent === undefined) {
    const raw = typeof currencyCode === "string" ? currencyCode.trim() : "";
    if (raw && code !== DEFAULT_CATALOG_CURRENCY_CODE) {
      // eslint-disable-next-line no-console -- unknown currency telemetry for finance audit trail
      console.error("[currency-minor-units] unknown ISO4217 code; defaulting exponent", {
        raw: currencyCode,
        normalized: code,
      });
    }
    return DEFAULT_MINOR_UNIT_EXPONENT;
  }
  return exponent;
}

function assertMinorWithinLimits(minorStr: string): void {
  const digits = minorStr.replace(/^0+/, "") || "0";
  if (digits.length > PG_BIGINT_MAX_STR.length) {
    throw new MajorAmountScaleError(
      "FINANCIAL_NUMERIC_OVERFLOW_LIMIT",
      "Computed minor-unit amount exceeds PostgreSQL bigint limit.",
    );
  }
  if (digits.length === PG_BIGINT_MAX_STR.length && digits > PG_BIGINT_MAX_STR) {
    throw new MajorAmountScaleError(
      "FINANCIAL_NUMERIC_OVERFLOW_LIMIT",
      "Computed minor-unit amount exceeds PostgreSQL bigint limit.",
    );
  }
  if (digits.length > JS_MAX_SAFE_INTEGER_STR.length) {
    throw new MajorAmountScaleError(
      "FINANCIAL_NUMERIC_OVERFLOW_LIMIT",
      "Computed minor-unit amount exceeds Number.MAX_SAFE_INTEGER.",
    );
  }
  if (digits.length === JS_MAX_SAFE_INTEGER_STR.length && digits > JS_MAX_SAFE_INTEGER_STR) {
    throw new MajorAmountScaleError(
      "FINANCIAL_NUMERIC_OVERFLOW_LIMIT",
      "Computed minor-unit amount exceeds Number.MAX_SAFE_INTEGER.",
    );
  }
}

/**
 * Converts a major-unit decimal string to integer minor units using fixed-point string scaling.
 * Throws {@link MajorAmountScaleError} on invalid format or overflow.
 */
export function majorAmountStringToMinorUnits(
  majorAmount: string,
  currencyCode: string | null | undefined,
): string {
  const trimmed = majorAmount.trim();
  if (!DECIMAL_MAJOR_REGEX.test(trimmed)) {
    throw new MajorAmountScaleError("INVALID_FORMAT", "totalCost must be a non-negative decimal string.");
  }

  const exponent = getIso4217MinorUnitExponent(currencyCode);
  const [integerPart, fractionalPart = ""] = trimmed.split(".");

  if (exponent === 0) {
    if (fractionalPart.length > 0 && !/^0+$/.test(fractionalPart)) {
      throw new MajorAmountScaleError(
        "INVALID_FORMAT",
        "totalCost must be a whole-number amount for zero-decimal currencies.",
      );
    }
    const minorStr = integerPart.replace(/^0+/, "") || "0";
    assertMinorWithinLimits(minorStr);
    return minorStr;
  }

  const scaledFraction =
    fractionalPart.length > exponent
      ? fractionalPart.slice(0, exponent)
      : fractionalPart.padEnd(exponent, "0");

  const combined = `${integerPart}${scaledFraction}`;
  const minorStr = combined.replace(/^0+/, "") || "0";
  assertMinorWithinLimits(minorStr);
  return minorStr;
}

/** Converts a major-unit amount to integer minor units using the currency exponent. */
export function majorAmountToMinorUnits(
  majorAmount: number,
  currencyCode: string | null | undefined,
): number {
  if (!Number.isFinite(majorAmount)) {
    return NaN;
  }
  const majorStr = Number.isInteger(majorAmount)
    ? String(majorAmount)
    : majorAmount.toFixed(getIso4217MinorUnitExponent(currencyCode));
  try {
    const minorStr = majorAmountStringToMinorUnits(majorStr, currencyCode);
    const minor = Number(minorStr);
    return Number.isFinite(minor) ? minor : NaN;
  } catch {
    return NaN;
  }
}
