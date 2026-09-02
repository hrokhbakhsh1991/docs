/**
 * Wallet-owned HTTP contracts (Phase 2D).
 */
export {
  minorAmountSchema,
  currencySchema,
  uuidSchema,
  formatZodError,
  parseWithZod,
} from "./wallet-validation";

export {
  walletReferenceBodySchema,
  operatorCreditBodySchema,
  operatorDebitBodySchema,
  operatorReversalBodySchema,
  parseOperatorCreditBody,
  parseOperatorDebitBody,
  parseOperatorReversalBody,
  parseWalletTransactionsLimit,
  parseOptionalListCursor,
  parseOperatorAccountLookupUserId,
  parseOptionalCurrencyFilter,
  parseOptionalWorkspaceFilter,
  type WalletReferenceBody,
  type OperatorCreditBody,
  type OperatorDebitBody,
  type OperatorReversalBody,
} from "./wallet-request.schemas";

export type {
  WalletBalanceHttpResponse,
  WalletMemberSummaryHttpResponse,
  WalletTransactionHttpItem,
  WalletTransactionHistoryHttpResponse,
  WalletOperatorAccountHttpItem,
  WalletOperatorAccountsHttpResponse,
  WalletMutationHttpResponse,
} from "./wallet-response.schemas";

export {
  WALLET_HTTP_ERROR_CODES,
  isWalletHttpErrorCode,
  type WalletHttpErrorCode,
  type WalletHttpErrorResponse,
} from "./wallet-error.schemas";

export {
  WALLET_IDEMPOTENCY_HEADER,
  WALLET_IDEMPOTENCY_CONTRACT,
  assertWalletIdempotencyKeyPresent,
  type WalletIdempotencyHeaderContract,
} from "./wallet-idempotency.contract";

export type {
  WalletHttpActorRole,
  WalletHttpActorContext,
  WalletHttpTenantContext,
} from "./wallet-actor.types";
