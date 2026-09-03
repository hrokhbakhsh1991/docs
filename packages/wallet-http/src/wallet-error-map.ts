import type { WalletDomainError, WalletErrorCode } from "@app-tour/wallet-core";

const WALLET_DOMAIN_HTTP_STATUS: Readonly<Record<WalletErrorCode, number>> = {
  WALLET_INVALID_AMOUNT: 400,
  WALLET_INVALID_CURRENCY: 400,
  WALLET_CURRENCY_MISMATCH: 400,
  WALLET_INSUFFICIENT_FUNDS: 409,
  WALLET_ACCOUNT_NOT_ACTIVE: 409,
  WALLET_TRANSACTION_ALREADY_POSTED: 409,
  WALLET_REVERSAL_INVALID: 409,
  WALLET_OWNERSHIP_MISMATCH: 404,
  WALLET_IDEMPOTENCY_CONFLICT: 409,
};

export function mapWalletDomainErrorToHttp(error: WalletDomainError): {
  readonly status: number;
  readonly code: WalletErrorCode;
} {
  return {
    status: WALLET_DOMAIN_HTTP_STATUS[error.code] ?? 422,
    code: error.code,
  };
}

export function throwWalletDomainError(error: WalletDomainError): never {
  throw new Error(error.code);
}
