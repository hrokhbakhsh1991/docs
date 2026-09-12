/**
 * @app-tour/wallet-core — pure Member Wallet domain (Phase 2B MVP).
 *
 * Framework-independent. No persistence, HTTP, Prisma, or workspace imports.
 */

/* ─── Application services ─────────────────────────────────────────────── */
export {
  buildMemberBalanceView,
  buildMemberTransactionHistory,
  computeCommandFingerprint,
  createOperatorCredit,
  createOperatorDebit,
  createReversal,
  operatorCreditFingerprint,
  operatorDebitFingerprint,
  resolveIdempotencyReplay,
  reversalFingerprint,
} from "./application/index";
export type {
  OperatorCreditCommand,
  OperatorDebitCommand,
  ReversalCommand,
  WalletIdempotencyRecord,
  WalletMutationResult,
} from "./application/index";

/* ─── Domain (pure) ────────────────────────────────────────────────────── */
export {
  assertAccountActive,
  assertAccountOwnership,
  assertAccountScope,
  assertCurrencyMatch,
  assertEntriesBelongToTransaction,
  assertLedgerEntryBelongsToAccount,
  assertSufficientFunds,
  assertTransactionBelongsToAccount,
  assertTransactionIsPosted,
  assertTransactionNotPosted,
  calculateBalance,
  compareAmountMinor,
  directionForKind,
  isWalletErrorCode,
  normalizeCurrency,
  oppositeDirection,
  subtractAmountMinor,
  sumSignedAmountMinor,
  validateAmountMinor,
  walletErr,
  walletOk,
  WALLET_ERROR_CODES,
  WALLET_ACCOUNT_STATUSES,
  WALLET_ACTOR_ROLES,
  WALLET_TRANSACTION_KINDS,
  WALLET_TRANSACTION_STATUSES,
  LEDGER_DIRECTIONS,
} from "./domain/index";
export type {
  LedgerDirection,
  WalletAccount,
  WalletAccountStatus,
  WalletActor,
  WalletActorRole,
  WalletBalance,
  WalletDomainError,
  WalletErrorCode,
  WalletHistoryItem,
  WalletHistoryPage,
  WalletLedgerEntry,
  WalletOwnershipScope,
  WalletReference,
  WalletResult,
  WalletTransaction,
  WalletTransactionKind,
  WalletTransactionStatus,
} from "./domain/index";

/* ─── Ports (adapters implement later) ─────────────────────────────────── */
export type {
  MemberReadAccountAuthzInput,
  OperatorCreditAuthzInput,
  OperatorDebitAuthzInput,
  TransactionReversalAuthzInput,
  WalletAccountRepository,
  WalletAuditEvent,
  WalletAuditPort,
  WalletAuthorizationPort,
  WalletIdempotencyPort,
  WalletLedgerRepository,
  WalletReferencePort,
  WalletTransactionRepository,
} from "./ports/index";
