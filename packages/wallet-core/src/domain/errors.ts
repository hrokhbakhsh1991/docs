/**
 * Stable wallet domain error codes (Phase 2B MVP).
 */
export const WALLET_ERROR_CODES = [
  "WALLET_INVALID_AMOUNT",
  "WALLET_INVALID_CURRENCY",
  "WALLET_CURRENCY_MISMATCH",
  "WALLET_INSUFFICIENT_FUNDS",
  "WALLET_ACCOUNT_NOT_ACTIVE",
  "WALLET_TRANSACTION_ALREADY_POSTED",
  "WALLET_REVERSAL_INVALID",
  "WALLET_OWNERSHIP_MISMATCH",
  "WALLET_IDEMPOTENCY_CONFLICT",
] as const;

export type WalletErrorCode = (typeof WALLET_ERROR_CODES)[number];

export type WalletDomainError = {
  readonly code: WalletErrorCode;
  readonly message: string;
};

export type WalletResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: WalletDomainError };

export function walletOk<T>(value: T): WalletResult<T> {
  return { ok: true, value };
}

export function walletErr<T>(
  code: WalletErrorCode,
  message: string,
): WalletResult<T> {
  return { ok: false, error: { code, message } };
}

export function isWalletErrorCode(value: string): value is WalletErrorCode {
  return (WALLET_ERROR_CODES as readonly string[]).includes(value);
}
