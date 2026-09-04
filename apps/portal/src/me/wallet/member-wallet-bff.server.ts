/**
 * WALLET-P3A — member wallet BFF view builders (no browser authority fields).
 */
import type {
  MemberWalletBalanceView,
  MemberWalletHistoryView,
  MemberWalletPresentationPolicy,
  MemberWalletTransactionView,
} from "@app-tour/workspace-sdk";
import type {
  WalletMemberSummaryHttpResponse,
  WalletTransactionHistoryHttpResponse,
  WalletTransactionHttpItem,
} from "@app-tour/wallet-http-contracts";

import {
  formatMemberWalletMinorAmount,
  mapWalletTransactionDirection,
} from "./member-wallet-format";

export type MemberWalletBffPayload = {
  readonly ok: true;
  readonly balance: MemberWalletBalanceView;
  readonly history: MemberWalletHistoryView;
};

export type MemberWalletBffError = {
  readonly ok: false;
  readonly code: string;
  readonly status: number;
};

function mapTransactionItem(
  item: WalletTransactionHttpItem,
  locale: string,
  presentation: MemberWalletPresentationPolicy,
): MemberWalletTransactionView {
  return {
    id: item.id,
    kind: item.kind,
    amountMinor: item.amountMinor,
    currency: item.currency,
    postedAt: item.postedAt,
    direction: mapWalletTransactionDirection(item.kind),
    formattedAmount: formatMemberWalletMinorAmount(
      item.amountMinor,
      item.currency,
      locale,
      presentation,
    ),
  };
}

export function buildMemberWalletBalanceView(
  summary: WalletMemberSummaryHttpResponse,
  locale: string,
  presentation: MemberWalletPresentationPolicy,
): MemberWalletBalanceView {
  return {
    accountId: summary.accountId,
    currency: summary.currency,
    balanceMinor: summary.balanceMinor,
    availableBalanceMinor: summary.availableBalanceMinor,
    balanceLabel: formatMemberWalletMinorAmount(
      summary.balanceMinor,
      summary.currency,
      locale,
      presentation,
    ),
    availableLabel: formatMemberWalletMinorAmount(
      summary.availableBalanceMinor,
      summary.currency,
      locale,
      presentation,
    ),
  };
}

export function buildMemberWalletHistoryView(
  page: WalletTransactionHistoryHttpResponse,
  locale: string,
  presentation: MemberWalletPresentationPolicy,
): MemberWalletHistoryView {
  const items = page.items.map((item) => mapTransactionItem(item, locale, presentation));
  const resolvedNextCursor =
    page.nextCursor ??
    (page.hasMore && page.items.length > 0 ? page.items[page.items.length - 1]!.id : null);
  return {
    items,
    nextCursor: resolvedNextCursor,
    hasMore: page.hasMore,
  };
}

export function buildMemberWalletBffPayload(input: {
  readonly summary: WalletMemberSummaryHttpResponse;
  readonly history: WalletTransactionHistoryHttpResponse;
  readonly locale: string;
  readonly presentation: MemberWalletPresentationPolicy;
}): MemberWalletBffPayload {
  return {
    ok: true,
    balance: buildMemberWalletBalanceView(
      input.summary,
      input.locale,
      input.presentation,
    ),
    history: buildMemberWalletHistoryView(
      input.history,
      input.locale,
      input.presentation,
    ),
  };
}
