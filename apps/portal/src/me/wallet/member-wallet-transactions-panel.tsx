"use client";

import { useCallback, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import type { MemberWalletHistoryView, MemberWalletTransactionView } from "@app-tour/workspace-sdk";

type MemberWalletTransactionsPanelProps = {
  readonly initialHistory: MemberWalletHistoryView;
};

type HistoryResponse =
  | { readonly ok: true; readonly history: MemberWalletHistoryView }
  | { readonly ok: false; readonly code: string };

export function MemberWalletTransactionsPanel({
  initialHistory,
}: MemberWalletTransactionsPanelProps) {
  const t = useTranslations("portalMember.wallet");
  const [items, setItems] = useState<readonly MemberWalletTransactionView[]>(
    initialHistory.items,
  );
  const [nextCursor, setNextCursor] = useState<string | null>(initialHistory.nextCursor);
  const [hasMore, setHasMore] = useState(initialHistory.hasMore);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadMore = useCallback(() => {
    if (nextCursor === null || isPending) {
      return;
    }
    startTransition(async () => {
      setErrorCode(null);
      try {
        const params = new URLSearchParams({ limit: "20", cursor: nextCursor });
        const res = await fetch(`/api/me/wallet/transactions?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
        });
        const body = (await res.json()) as HistoryResponse;
        if (!res.ok || !body.ok) {
          setErrorCode(!body.ok ? body.code : "WALLET_HISTORY_FAILED");
          return;
        }
        setItems((current) => [...current, ...body.history.items]);
        setNextCursor(body.history.nextCursor);
        setHasMore(body.history.hasMore);
      } catch {
        setErrorCode("BACKEND_UNREACHABLE");
      }
    });
  }, [isPending, nextCursor]);

  if (items.length === 0) {
    return (
      <section data-portal-member-wallet-empty aria-live="polite">
        <p>{t("emptyHistory")}</p>
      </section>
    );
  }

  return (
    <section data-portal-member-wallet-transactions aria-labelledby="member-wallet-tx-heading">
      <h2 id="member-wallet-tx-heading">{t("historyTitle")}</h2>
      <ol data-portal-member-wallet-transaction-list>
        {items.map((item) => (
          <li
            key={item.id}
            data-portal-member-wallet-transaction
            data-transaction-kind={item.kind}
            data-transaction-direction={item.direction}
          >
            <div data-portal-member-wallet-transaction-main>
              <span data-portal-member-wallet-transaction-label>
                {t(`transactionKinds.${item.kind}`)}
              </span>
              <time dateTime={item.postedAt} data-portal-member-wallet-transaction-date>
                {new Date(item.postedAt).toLocaleString()}
              </time>
            </div>
            <span
              data-portal-member-wallet-transaction-amount
              data-direction={item.direction}
              aria-label={t(`transactionKinds.${item.kind}`)}
            >
              {item.direction === "incoming" ? "+" : "−"}
              {item.formattedAmount}
            </span>
          </li>
        ))}
      </ol>
      {errorCode !== null ? (
        <p role="alert" data-portal-member-wallet-history-error>
          {t("historyError")}
        </p>
      ) : null}
      {hasMore ? (
        <button
          type="button"
          data-portal-member-wallet-load-more
          onClick={loadMore}
          disabled={isPending}
          aria-busy={isPending}
        >
          {isPending ? t("loadingMore") : t("loadMore")}
        </button>
      ) : null}
    </section>
  );
}
