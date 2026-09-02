/**
 * Stable wallet HTTP error envelope (Phase 2D).
 */

export const WALLET_HTTP_ERROR_CODES = [
  "WALLET_INVALID_AMOUNT",
  "WALLET_INVALID_CURRENCY",
  "WALLET_CURRENCY_MISMATCH",
  "WALLET_INSUFFICIENT_FUNDS",
  "WALLET_ACCOUNT_NOT_ACTIVE",
  "WALLET_TRANSACTION_ALREADY_POSTED",
  "WALLET_REVERSAL_INVALID",
  "WALLET_OWNERSHIP_MISMATCH",
  "WALLET_IDEMPOTENCY_CONFLICT",
  "WALLET_WORKSPACE_UNSUPPORTED",
  "FORBIDDEN_WALLET_MODULE_DISABLED",
  "FORBIDDEN_OPERATOR_FORBIDDEN",
  "FORBIDDEN_MEMBER_MODULE_WALLET",
  "IDEMPOTENCY_KEY_REQUIRED",
  "ZOD_VALIDATION_FAILED",
] as const;

export type WalletHttpErrorCode = (typeof WALLET_HTTP_ERROR_CODES)[number];

export type WalletHttpErrorResponse = {
  readonly error: string;
  readonly code: WalletHttpErrorCode | string;
  readonly correlationId: string;
};

export function isWalletHttpErrorCode(value: string): value is WalletHttpErrorCode {
  return (WALLET_HTTP_ERROR_CODES as readonly string[]).includes(value);
}
