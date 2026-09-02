import { walletErr, walletOk, type WalletResult } from "./errors";

const POSITIVE_INTEGER_STRING_RE = /^[1-9]\d*$/;
const CURRENCY_CODE_RE = /^[A-Za-z]{3}$/;

/**
 * Validate a positive integer minor-unit amount string.
 * Rejects zero, negatives, decimals, and non-digit characters.
 */
export function validateAmountMinor(raw: string): WalletResult<string> {
  if (typeof raw !== "string") {
    return walletErr("WALLET_INVALID_AMOUNT", "amount must be a string");
  }
  const trimmed = raw.trim();
  if (!POSITIVE_INTEGER_STRING_RE.test(trimmed)) {
    return walletErr(
      "WALLET_INVALID_AMOUNT",
      "amount must be a positive integer string",
    );
  }
  return walletOk(trimmed);
}

/**
 * Normalize currency to uppercase ISO 4217-style 3-letter code.
 */
export function normalizeCurrency(raw: string): WalletResult<string> {
  if (typeof raw !== "string") {
    return walletErr("WALLET_INVALID_CURRENCY", "currency must be a string");
  }
  const trimmed = raw.trim();
  if (!CURRENCY_CODE_RE.test(trimmed)) {
    return walletErr(
      "WALLET_INVALID_CURRENCY",
      "currency must be a 3-letter code",
    );
  }
  return walletOk(trimmed.toUpperCase());
}

/**
 * Assert two normalized currencies match.
 */
export function assertCurrencyMatch(
  left: string,
  right: string,
): WalletResult<void> {
  if (left !== right) {
    return walletErr(
      "WALLET_CURRENCY_MISMATCH",
      `currency mismatch: ${left} vs ${right}`,
    );
  }
  return walletOk(undefined);
}

/**
 * Compare minor amounts using BigInt (no floating-point or Number arithmetic).
 */
export function compareAmountMinor(left: string, right: string): -1 | 0 | 1 {
  const l = BigInt(left);
  const r = BigInt(right);
  if (l < r) return -1;
  if (l > r) return 1;
  return 0;
}

/**
 * Subtract minor amounts; returns null when result would be negative.
 */
export function subtractAmountMinor(
  minuend: string,
  subtrahend: string,
): string | null {
  const result = BigInt(minuend) - BigInt(subtrahend);
  if (result < BigInt(0)) {
    return null;
  }
  return result.toString();
}

/**
 * Sum ledger signed amounts into a balance string (credits add, debits subtract).
 */
export function sumSignedAmountMinor(
  credits: readonly string[],
  debits: readonly string[],
): string {
  let total = BigInt(0);
  for (const amount of credits) {
    total += BigInt(amount);
  }
  for (const amount of debits) {
    total -= BigInt(amount);
  }
  return total.toString();
}
