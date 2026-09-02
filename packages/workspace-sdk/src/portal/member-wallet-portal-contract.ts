/**
 * WALLET-P3A — workspace-neutral member wallet portal presentation contract.
 * Visual policy only — balances and history come from portal BFF + wallet HTTP API.
 */

export type MemberWalletPresentationPolicy = {
  readonly defaultCurrency: string;
  readonly zeroDecimalCurrency: boolean;
};

const ZERO_DECIMAL_CURRENCIES = new Set(["IRR", "JPY", "KRW"]);

/** Workspace commerce currency hints — presentation only, not authority. */
const WORKSPACE_WALLET_PRESENTATION: Readonly<
  Record<string, MemberWalletPresentationPolicy>
> = Object.freeze({
  denali: Object.freeze({ defaultCurrency: "IRR", zeroDecimalCurrency: true }),
  "wallet-ws1": Object.freeze({ defaultCurrency: "USD", zeroDecimalCurrency: false }),
});

const DEFAULT_PRESENTATION: MemberWalletPresentationPolicy = Object.freeze({
  defaultCurrency: "USD",
  zeroDecimalCurrency: false,
});

export function resolveMemberWalletPresentation(
  pluginId: string,
): MemberWalletPresentationPolicy {
  return WORKSPACE_WALLET_PRESENTATION[pluginId] ?? DEFAULT_PRESENTATION;
}

export function isZeroDecimalWalletCurrency(currency: string): boolean {
  return ZERO_DECIMAL_CURRENCIES.has(currency.trim().toUpperCase());
}

export type MemberWalletTransactionViewKind =
  | "operator_credit"
  | "operator_debit"
  | "reversal";

export type MemberWalletTransactionView = {
  readonly id: string;
  readonly kind: MemberWalletTransactionViewKind;
  readonly amountMinor: string;
  readonly currency: string;
  readonly postedAt: string;
  readonly direction: "incoming" | "outgoing";
  readonly formattedAmount: string;
};

export type MemberWalletBalanceView = {
  readonly accountId: string | null;
  readonly currency: string;
  readonly balanceMinor: string;
  readonly availableBalanceMinor: string;
  readonly balanceLabel: string;
  readonly availableLabel: string;
};

export type MemberWalletHistoryView = {
  readonly items: readonly MemberWalletTransactionView[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
};
