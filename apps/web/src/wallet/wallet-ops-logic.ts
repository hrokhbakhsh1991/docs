/**
 * WALLET-P3B — operator wallet ops client logic (validation, parsing, idempotency).
 */
import { createClientSafeId } from "@app-tour/draft-engine";
import type {
  WalletMutationHttpResponse,
  WalletOperatorAccountHttpItem,
  WalletOperatorAccountsHttpResponse,
  WalletTransactionHistoryHttpResponse,
  WalletTransactionHttpItem,
} from "@app-tour/wallet-http-contracts";

export const WALLET_OPS_TEST_IDS = {
  page: "wallet-ops-page",
  searchForm: "wallet-ops-search-form",
  searchInput: "wallet-ops-search-input",
  searchSubmit: "wallet-ops-search-submit",
  accountsList: "wallet-ops-accounts-list",
  accountsPagination: "wallet-ops-accounts-pagination",
  accountRow: "wallet-ops-account-row",
  balanceCard: "wallet-ops-balance-card",
  balanceAmount: "wallet-ops-balance-amount",
  historyList: "wallet-ops-history-list",
  historyPagination: "wallet-ops-history-pagination",
  historyRow: "wallet-ops-history-row",
  creditButton: "wallet-ops-credit-button",
  debitButton: "wallet-ops-debit-button",
  reverseButton: "wallet-ops-reverse-button",
  mutationDialog: "wallet-ops-mutation-dialog",
  mutationConfirm: "wallet-ops-mutation-confirm",
  mutationCancel: "wallet-ops-mutation-cancel",
  mutationReason: "wallet-ops-mutation-reason",
  mutationAmount: "wallet-ops-mutation-amount",
  mutationFeedback: "wallet-ops-mutation-feedback",
  loading: "wallet-ops-loading",
  empty: "wallet-ops-empty",
  error: "wallet-ops-error",
  retry: "wallet-ops-retry",
} as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type WalletAccountRow = WalletOperatorAccountHttpItem;
export type WalletTransactionRow = WalletTransactionHttpItem;

export type WalletMutationKind = "credit" | "debit" | "reverse";

export type WalletMutationFormState = {
  readonly amountMinor: string;
  readonly reasonNote: string;
};

export type WalletReversalFormState = {
  readonly reasonNote: string;
};

export function createWalletIdempotencyKey(prefix: string): string {
  return createClientSafeId(prefix);
}

export function validateMemberUserIdSearch(
  value: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!UUID_PATTERN.test(trimmed)) {
    return { ok: false, error: "MEMBER_USER_ID_INVALID" };
  }
  return { ok: true, value: trimmed };
}

export function validateWalletMutationForm(
  input: WalletMutationFormState,
  accountCurrency: string,
): { ok: true; value: WalletMutationFormState & { currency: string } } | { ok: false; error: string } {
  const amountMinor = input.amountMinor.trim();
  if (!/^[1-9][0-9]*$/.test(amountMinor)) {
    return { ok: false, error: "AMOUNT_POSITIVE_INTEGER" };
  }
  const reasonNote = input.reasonNote.trim();
  if (reasonNote.length === 0) {
    return { ok: false, error: "REASON_REQUIRED" };
  }
  if (reasonNote.length > 2000) {
    return { ok: false, error: "REASON_TOO_LONG" };
  }
  const currency = accountCurrency.trim().toUpperCase();
  if (currency.length < 3 || currency.length > 8) {
    return { ok: false, error: "CURRENCY_INVALID" };
  }
  return {
    ok: true,
    value: { amountMinor, reasonNote, currency },
  };
}

export function validateWalletReversalForm(
  input: WalletReversalFormState,
): { ok: true; value: WalletReversalFormState } | { ok: false; error: string } {
  const reasonNote = input.reasonNote.trim();
  if (reasonNote.length === 0) {
    return { ok: false, error: "REASON_REQUIRED" };
  }
  if (reasonNote.length > 2000) {
    return { ok: false, error: "REASON_TOO_LONG" };
  }
  return { ok: true, value: { reasonNote } };
}

export function buildWalletCreditRequestBody(input: {
  readonly amountMinor: string;
  readonly currency: string;
  readonly reasonNote: string;
}): string {
  return JSON.stringify({
    amountMinor: input.amountMinor,
    currency: input.currency,
    reasonNote: input.reasonNote,
  });
}

export function buildWalletDebitRequestBody(input: {
  readonly amountMinor: string;
  readonly currency: string;
  readonly reasonNote: string;
}): string {
  return JSON.stringify({
    amountMinor: input.amountMinor,
    currency: input.currency,
    reasonNote: input.reasonNote,
  });
}

export function buildWalletReversalRequestBody(input: {
  readonly accountId: string;
  readonly reasonNote: string;
}): string {
  return JSON.stringify({
    accountId: input.accountId,
    reasonNote: input.reasonNote,
  });
}

export function parseWalletAccountsResponse(raw: unknown): WalletOperatorAccountsHttpResponse | null {
  if (raw === null || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record.items)) {
    return null;
  }
  return raw as WalletOperatorAccountsHttpResponse;
}

export function parseWalletTransactionHistoryResponse(
  raw: unknown,
): WalletTransactionHistoryHttpResponse | null {
  if (raw === null || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record.items)) {
    return null;
  }
  return raw as WalletTransactionHistoryHttpResponse;
}

export function parseWalletMutationResponse(raw: unknown): WalletMutationHttpResponse | null {
  if (raw === null || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.transactionId !== "string" || typeof record.replay !== "boolean") {
    return null;
  }
  return raw as WalletMutationHttpResponse;
}

export function readWalletErrorCode(raw: unknown): string {
  if (raw === null || typeof raw !== "object") {
    return "UNKNOWN";
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.code === "string") {
    return record.code;
  }
  const error = record.error;
  if (error !== null && typeof error === "object") {
    const nested = error as Record<string, unknown>;
    if (typeof nested.code === "string") {
      return nested.code;
    }
  }
  return "UNKNOWN";
}

export function mapWalletMutationHttpError(status: number, raw: unknown): string {
  const code = readWalletErrorCode(raw);
  if (code === "WALLET_INSUFFICIENT_FUNDS") {
    return "WALLET_INSUFFICIENT_FUNDS";
  }
  if (code === "WALLET_IDEMPOTENCY_CONFLICT") {
    return "WALLET_IDEMPOTENCY_CONFLICT";
  }
  if (code === "WALLET_REVERSAL_INVALID" || code === "WALLET_TRANSACTION_ALREADY_POSTED") {
    return "WALLET_REVERSAL_INVALID";
  }
  if (code === "IDEMPOTENCY_KEY_REQUIRED") {
    return "IDEMPOTENCY_KEY_REQUIRED";
  }
  if (code === "FORBIDDEN_OPERATOR_FORBIDDEN" || status === 403) {
    return "FORBIDDEN_OPERATOR_FORBIDDEN";
  }
  if (code === "ZOD_VALIDATION_FAILED" || status === 400) {
    return "VALIDATION_FAILED";
  }
  return "MUTATION_FAILED";
}

export function paginateWalletAccounts<T>(
  items: readonly T[],
  page: number,
  pageSize: number,
): { readonly pageItems: readonly T[]; readonly totalPages: number; readonly page: number } {
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(items.length / safePageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * safePageSize;
  return {
    pageItems: items.slice(start, start + safePageSize),
    totalPages,
    page: safePage,
  };
}

export function canReverseWalletTransaction(item: WalletTransactionRow): boolean {
  return item.kind !== "reversal" && item.reversesTransactionId === null;
}

export function walletTransactionKindLabelKey(kind: WalletTransactionRow["kind"]): string {
  return `kind.${kind}`;
}

export function buildWalletAccountsSearchPath(userId: string, currency?: string): string {
  const params = new URLSearchParams({ userId });
  if (currency !== undefined && currency.trim().length > 0) {
    params.set("currency", currency.trim().toUpperCase());
  }
  return `/api/wallet/accounts?${params.toString()}`;
}

export function buildWalletAccountBalancePath(accountId: string): string {
  return `/api/wallet/accounts/${encodeURIComponent(accountId)}/balance`;
}

export function buildWalletAccountTransactionsPath(
  accountId: string,
  options?: { readonly limit?: number; readonly cursor?: string },
): string {
  const params = new URLSearchParams();
  if (options?.limit !== undefined) {
    params.set("limit", String(options.limit));
  }
  if (options?.cursor !== undefined && options.cursor.trim().length > 0) {
    params.set("cursor", options.cursor.trim());
  }
  const query = params.toString();
  const base = `/api/wallet/accounts/${encodeURIComponent(accountId)}/transactions`;
  return query.length > 0 ? `${base}?${query}` : base;
}

export function buildWalletCreditPath(accountId: string): string {
  return `/api/wallet/accounts/${encodeURIComponent(accountId)}/credit`;
}

export function buildWalletDebitPath(accountId: string): string {
  return `/api/wallet/accounts/${encodeURIComponent(accountId)}/debit`;
}

export function buildWalletReversalPath(transactionId: string): string {
  return `/api/wallet/transactions/${encodeURIComponent(transactionId)}/reverse`;
}

/** Guard: wallet UI must not accept browser authority fields. */
export function walletUiMustNotSendAuthorityFields(source: string): boolean {
  const forbidden = [
    /tenantId/,
    /workspaceId.*authority/,
    /userId.*authority/,
    /postedAt/,
    /ledgerDirection/,
    /transactionStatus/,
  ];
  return !forbidden.some((pattern) => pattern.test(source));
}
