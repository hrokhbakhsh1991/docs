"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useRef, useState } from "react";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { isOwnerRole } from "@/admin/require-operator-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LocalizedNumericInput } from "@/components/i18n/localized-numeric-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppLocale } from "@/i18n/routing";
import {
  WALLET_OPS_TEST_IDS,
  buildWalletAccountBalancePath,
  buildWalletAccountTransactionsPath,
  buildWalletAccountsSearchPath,
  buildWalletCreditPath,
  buildWalletDebitPath,
  buildWalletCreditRequestBody,
  buildWalletDebitRequestBody,
  buildWalletReversalPath,
  buildWalletReversalRequestBody,
  canReverseWalletTransaction,
  createWalletIdempotencyKey,
  mapWalletMutationHttpError,
  paginateWalletAccounts,
  parseWalletAccountsResponse,
  parseWalletMutationResponse,
  parseWalletTransactionHistoryResponse,
  readWalletErrorCode,
  validateMemberUserIdSearch,
  validateWalletMutationForm,
  validateWalletReversalForm,
  walletTransactionKindLabelKey,
  type WalletAccountRow,
  type WalletMutationKind,
  type WalletTransactionRow,
} from "@/wallet/wallet-ops-logic";
import { formatWalletMinorAmount, formatWalletTimestamp } from "@/wallet/wallet-format";

type WalletOpsPanelProps = {
  readonly session: OperatorSessionContext;
};

const ACCOUNTS_PAGE_SIZE = 5;
const HISTORY_PAGE_SIZE = 10;

type LoadState = "idle" | "loading" | "error" | "ready";

type MutationDialogState = {
  readonly kind: WalletMutationKind;
  readonly account: WalletAccountRow;
  readonly transaction?: WalletTransactionRow;
};

const EMPTY_MUTATION_FORM = { amountMinor: "", reasonNote: "" };
const EMPTY_REVERSAL_FORM = { reasonNote: "" };

export function WalletOpsPanel({ session }: WalletOpsPanelProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("wallet.ops");
  const canManage = isOwnerRole(session.role);

  const [memberUserId, setMemberUserId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [accounts, setAccounts] = useState<readonly WalletAccountRow[]>([]);
  const [accountsPage, setAccountsPage] = useState(1);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [balanceMinor, setBalanceMinor] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<readonly WalletTransactionRow[]>([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [accountsState, setAccountsState] = useState<LoadState>("idle");
  const [balanceState, setBalanceState] = useState<LoadState>("idle");
  const [historyState, setHistoryState] = useState<LoadState>("idle");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [mutationDialog, setMutationDialog] = useState<MutationDialogState | null>(null);
  const [mutationForm, setMutationForm] = useState(EMPTY_MUTATION_FORM);
  const [reversalForm, setReversalForm] = useState(EMPTY_REVERSAL_FORM);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [mutationFeedback, setMutationFeedback] = useState<string | null>(null);
  const [mutationPending, setMutationPending] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId],
  );

  const accountsPageData = useMemo(
    () => paginateWalletAccounts(accounts, accountsPage, ACCOUNTS_PAGE_SIZE),
    [accounts, accountsPage],
  );

  const resolveErrorMessage = useCallback(
    (code: string): string => {
      switch (code) {
        case "MEMBER_USER_ID_INVALID":
          return t("errorMemberUserIdInvalid");
        case "WALLET_INSUFFICIENT_FUNDS":
          return t("errorInsufficientFunds");
        case "WALLET_IDEMPOTENCY_CONFLICT":
          return t("errorIdempotencyConflict");
        case "WALLET_REVERSAL_INVALID":
          return t("errorReversalInvalid");
        case "REASON_REQUIRED":
          return t("errorReasonRequired");
        case "AMOUNT_POSITIVE_INTEGER":
          return t("errorAmountInvalid");
        case "FORBIDDEN_OPERATOR_FORBIDDEN":
          return t("errorForbidden");
        case "VALIDATION_FAILED":
          return t("errorValidation");
        default:
          return t("errorGeneric");
      }
    },
    [t],
  );

  const loadAccountDetails = useCallback(
    async (account: WalletAccountRow) => {
      setSelectedAccountId(account.id);
      setBalanceState("loading");
      setHistoryState("loading");
      setLoadError(null);
      setBalanceMinor(null);
      setHistoryItems([]);
      setHistoryCursor(null);
      setHistoryHasMore(false);

      try {
        const [balanceRes, historyRes] = await Promise.all([
          fetch(buildWalletAccountBalancePath(account.id), { cache: "no-store" }),
          fetch(
            buildWalletAccountTransactionsPath(account.id, { limit: HISTORY_PAGE_SIZE }),
            { cache: "no-store" },
          ),
        ]);

        if (!balanceRes.ok) {
          setBalanceState("error");
          setHistoryState("error");
          setLoadError(resolveErrorMessage(readWalletErrorCode(await balanceRes.json().catch(() => null))));
          return;
        }
        if (!historyRes.ok) {
          setBalanceState("error");
          setHistoryState("error");
          setLoadError(resolveErrorMessage(readWalletErrorCode(await historyRes.json().catch(() => null))));
          return;
        }

        const balancePayload = (await balanceRes.json()) as { balanceMinor?: string };
        const historyPayload = parseWalletTransactionHistoryResponse(await historyRes.json());
        setBalanceMinor(String(balancePayload.balanceMinor ?? account.balanceMinor));
        setBalanceState("ready");
        if (historyPayload !== null) {
          setHistoryItems(historyPayload.items);
          setHistoryCursor(historyPayload.nextCursor);
          setHistoryHasMore(historyPayload.hasMore);
          setHistoryState("ready");
        } else {
          setHistoryState("error");
          setLoadError(t("errorGeneric"));
        }
      } catch {
        setBalanceState("error");
        setHistoryState("error");
        setLoadError(t("errorGeneric"));
      }
    },
    [resolveErrorMessage, t],
  );

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) {
      return;
    }
    setSearchError(null);
    setLoadError(null);
    setMutationFeedback(null);
    const validated = validateMemberUserIdSearch(searchInput);
    if (!validated.ok) {
      setSearchError(resolveErrorMessage(validated.error));
      return;
    }
    setMemberUserId(validated.value);
    setAccountsState("loading");
    setAccounts([]);
    setSelectedAccountId(null);
    setBalanceMinor(null);
    setHistoryItems([]);
    setAccountsPage(1);

    try {
      const response = await fetch(buildWalletAccountsSearchPath(validated.value), {
        cache: "no-store",
      });
      const raw = await response.json().catch(() => null);
      if (!response.ok) {
        setAccountsState("error");
        setSearchError(resolveErrorMessage(readWalletErrorCode(raw)));
        return;
      }
      const parsed = parseWalletAccountsResponse(raw);
      if (parsed === null) {
        setAccountsState("error");
        setSearchError(t("errorGeneric"));
        return;
      }
      setAccounts(parsed.items);
      setAccountsState(parsed.items.length === 0 ? "ready" : "ready");
      if (parsed.items.length === 1) {
        await loadAccountDetails(parsed.items[0]!);
      }
    } catch {
      setAccountsState("error");
      setSearchError(t("errorGeneric"));
    }
  };

  const loadMoreHistory = async () => {
    if (selectedAccount === null || historyCursor === null || historyState === "loading") {
      return;
    }
    setHistoryState("loading");
    try {
      const response = await fetch(
        buildWalletAccountTransactionsPath(selectedAccount.id, {
          limit: HISTORY_PAGE_SIZE,
          cursor: historyCursor,
        }),
        { cache: "no-store" },
      );
      const raw = await response.json().catch(() => null);
      if (!response.ok) {
        setHistoryState("error");
        setLoadError(resolveErrorMessage(readWalletErrorCode(raw)));
        return;
      }
      const parsed = parseWalletTransactionHistoryResponse(raw);
      if (parsed === null) {
        setHistoryState("error");
        setLoadError(t("errorGeneric"));
        return;
      }
      setHistoryItems((current) => [...current, ...parsed.items]);
      setHistoryCursor(parsed.nextCursor);
      setHistoryHasMore(parsed.hasMore);
      setHistoryState("ready");
    } catch {
      setHistoryState("error");
      setLoadError(t("errorGeneric"));
    }
  };

  const openMutationDialog = (
    kind: WalletMutationKind,
    account: WalletAccountRow,
    transaction?: WalletTransactionRow,
  ) => {
    if (!canManage || mutationPending) {
      return;
    }
    setMutationError(null);
    setMutationFeedback(null);
    setMutationForm(EMPTY_MUTATION_FORM);
    setReversalForm(EMPTY_REVERSAL_FORM);
    idempotencyKeyRef.current = createWalletIdempotencyKey(`${kind}-${account.id}`);
    setMutationDialog({ kind, account, transaction });
  };

  const closeMutationDialog = () => {
    if (mutationPending) {
      return;
    }
    setMutationDialog(null);
    setMutationError(null);
  };

  const refreshSelectedAccount = async () => {
    if (selectedAccount === null) {
      return;
    }
    await loadAccountDetails(selectedAccount);
    if (memberUserId.length > 0) {
      const response = await fetch(buildWalletAccountsSearchPath(memberUserId), {
        cache: "no-store",
      });
      const raw = await response.json().catch(() => null);
      const parsed = parseWalletAccountsResponse(raw);
      if (parsed !== null) {
        setAccounts(parsed.items);
      }
    }
  };

  const handleMutationConfirm = async () => {
    if (!canManage || mutationDialog === null || mutationPending) {
      return;
    }
    setMutationError(null);
    setMutationFeedback(null);

    const idempotencyKey = idempotencyKeyRef.current ?? createWalletIdempotencyKey("wallet-mutation");
    idempotencyKeyRef.current = idempotencyKey;

    let path = "";
    let body = "";

    if (mutationDialog.kind === "reverse") {
      const validated = validateWalletReversalForm(reversalForm);
      if (!validated.ok) {
        setMutationError(resolveErrorMessage(validated.error));
        return;
      }
      if (mutationDialog.transaction === undefined) {
        setMutationError(t("errorGeneric"));
        return;
      }
      path = buildWalletReversalPath(mutationDialog.transaction.id);
      body = buildWalletReversalRequestBody({
        accountId: mutationDialog.account.id,
        reasonNote: validated.value.reasonNote,
      });
    } else {
      const validated = validateWalletMutationForm(mutationForm, mutationDialog.account.currency);
      if (!validated.ok) {
        setMutationError(resolveErrorMessage(validated.error));
        return;
      }
      path =
        mutationDialog.kind === "credit"
          ? buildWalletCreditPath(mutationDialog.account.id)
          : buildWalletDebitPath(mutationDialog.account.id);
      body =
        mutationDialog.kind === "credit"
          ? buildWalletCreditRequestBody(validated.value)
          : buildWalletDebitRequestBody(validated.value);
    }

    setMutationPending(true);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body,
      });
      const raw = await response.json().catch(() => null);
      if (!response.ok) {
        setMutationError(resolveErrorMessage(mapWalletMutationHttpError(response.status, raw)));
        return;
      }
      const parsed = parseWalletMutationResponse(raw);
      if (parsed === null) {
        setMutationError(t("errorGeneric"));
        return;
      }
      setMutationFeedback(
        parsed.replay ? t("mutationReplaySuccess") : t("mutationSuccess"),
      );
      setMutationDialog(null);
      idempotencyKeyRef.current = null;
      await refreshSelectedAccount();
    } catch {
      setMutationError(t("errorGeneric"));
    } finally {
      setMutationPending(false);
    }
  };

  const dialogTitle =
    mutationDialog?.kind === "credit"
      ? t("confirmCreditTitle")
      : mutationDialog?.kind === "debit"
        ? t("confirmDebitTitle")
        : t("confirmReverseTitle");

  const dialogDescription =
    mutationDialog?.kind === "credit"
      ? t("confirmCreditDescription")
      : mutationDialog?.kind === "debit"
        ? t("confirmDebitDescription")
        : t("confirmReverseDescription");

  return (
    <div data-wallet-ops data-testid={WALLET_OPS_TEST_IDS.page}>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("lede")}</p>
      </header>

      {!canManage ? (
        <p role="alert" className="text-destructive" data-testid={WALLET_OPS_TEST_IDS.error}>
          {t("errorForbidden")}
        </p>
      ) : null}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t("searchTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSearch}
            className="flex flex-col gap-4 sm:flex-row sm:items-end"
            data-testid={WALLET_OPS_TEST_IDS.searchForm}
          >
            <div className="flex-1 space-y-2">
              <Label htmlFor="wallet-member-user-id">{t("searchLabel")}</Label>
              <Input
                id="wallet-member-user-id"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t("searchPlaceholder")}
                autoComplete="off"
                disabled={!canManage || accountsState === "loading"}
                data-testid={WALLET_OPS_TEST_IDS.searchInput}
              />
            </div>
            <Button
              type="submit"
              disabled={!canManage || accountsState === "loading"}
              data-testid={WALLET_OPS_TEST_IDS.searchSubmit}
            >
              {accountsState === "loading" ? t("searching") : t("searchAction")}
            </Button>
          </form>
          {searchError !== null ? (
            <p role="alert" className="mt-3 text-sm text-destructive" data-testid={WALLET_OPS_TEST_IDS.error}>
              {searchError}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {accountsState === "loading" ? (
        <Skeleton className="mb-6 h-32 w-full" data-testid={WALLET_OPS_TEST_IDS.loading} />
      ) : null}

      {accountsState === "ready" && accounts.length === 0 && memberUserId.length > 0 ? (
        <p className="mb-6 text-muted-foreground" data-testid={WALLET_OPS_TEST_IDS.empty}>
          {t("noAccounts")}
        </p>
      ) : null}

      {accounts.length > 0 ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t("accountsTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul
              className="space-y-2"
              data-testid={WALLET_OPS_TEST_IDS.accountsList}
              aria-label={t("accountsTitle")}
            >
              {accountsPageData.pageItems.map((account) => {
                const selected = account.id === selectedAccountId;
                return (
                  <li key={account.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-start hover:bg-muted/40"
                      data-testid={WALLET_OPS_TEST_IDS.accountRow}
                      data-wallet-account-selected={selected ? "true" : "false"}
                      onClick={() => void loadAccountDetails(account)}
                      disabled={balanceState === "loading"}
                    >
                      <span>
                        <span className="font-medium">{account.currency}</span>
                        <span className="ms-2 text-sm text-muted-foreground">{account.status}</span>
                      </span>
                      <span className="tabular-nums" dir="ltr">
                        {formatWalletMinorAmount(account.balanceMinor, account.currency, locale)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {accountsPageData.totalPages > 1 ? (
              <div
                className="mt-4 flex items-center justify-between"
                data-testid={WALLET_OPS_TEST_IDS.accountsPagination}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={accountsPageData.page <= 1}
                  onClick={() => setAccountsPage((page) => Math.max(1, page - 1))}
                >
                  {t("paginationPrevious")}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {t("paginationPage", {
                    page: accountsPageData.page,
                    total: accountsPageData.totalPages,
                  })}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={accountsPageData.page >= accountsPageData.totalPages}
                  onClick={() => setAccountsPage((page) => page + 1)}
                >
                  {t("paginationNext")}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {selectedAccount !== null ? (
        <>
          <Card className="mb-6" data-testid={WALLET_OPS_TEST_IDS.balanceCard}>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle>{t("balanceTitle")}</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => openMutationDialog("credit", selectedAccount)}
                  disabled={!canManage || mutationPending}
                  data-testid={WALLET_OPS_TEST_IDS.creditButton}
                >
                  {t("creditAction")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => openMutationDialog("debit", selectedAccount)}
                  disabled={!canManage || mutationPending}
                  data-testid={WALLET_OPS_TEST_IDS.debitButton}
                >
                  {t("debitAction")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {balanceState === "loading" ? (
                <Skeleton className="h-10 w-48" data-testid={WALLET_OPS_TEST_IDS.loading} />
              ) : balanceState === "error" ? (
                <div className="flex items-center gap-3">
                  <p role="alert" className="text-destructive" data-testid={WALLET_OPS_TEST_IDS.error}>
                    {loadError ?? t("errorGeneric")}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid={WALLET_OPS_TEST_IDS.retry}
                    onClick={() => void loadAccountDetails(selectedAccount)}
                  >
                    {t("retry")}
                  </Button>
                </div>
              ) : balanceMinor !== null ? (
                <p
                  className="text-3xl font-semibold tabular-nums"
                  dir="ltr"
                  data-testid={WALLET_OPS_TEST_IDS.balanceAmount}
                  aria-live="polite"
                >
                  {formatWalletMinorAmount(balanceMinor, selectedAccount.currency, locale)}
                </p>
              ) : null}
              <p className="mt-2 text-sm text-muted-foreground">
                {t("currencyLabel", { currency: selectedAccount.currency })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("historyTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              {historyState === "loading" && historyItems.length === 0 ? (
                <Skeleton className="h-24 w-full" data-testid={WALLET_OPS_TEST_IDS.loading} />
              ) : null}
              {historyState === "error" && historyItems.length === 0 ? (
                <div className="flex items-center gap-3">
                  <p role="alert" className="text-destructive" data-testid={WALLET_OPS_TEST_IDS.error}>
                    {loadError ?? t("errorGeneric")}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid={WALLET_OPS_TEST_IDS.retry}
                    onClick={() => void loadAccountDetails(selectedAccount)}
                  >
                    {t("retry")}
                  </Button>
                </div>
              ) : null}
              {historyItems.length === 0 && historyState === "ready" ? (
                <p className="text-muted-foreground" data-testid={WALLET_OPS_TEST_IDS.empty}>
                  {t("noTransactions")}
                </p>
              ) : null}
              {historyItems.length > 0 ? (
                <ul
                  className="space-y-3"
                  data-testid={WALLET_OPS_TEST_IDS.historyList}
                  aria-label={t("historyTitle")}
                >
                  {historyItems.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-md border px-3 py-2"
                      data-testid={WALLET_OPS_TEST_IDS.historyRow}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{t(walletTransactionKindLabelKey(item.kind))}</Badge>
                            <span className="text-sm text-muted-foreground" dir="ltr">
                              {formatWalletTimestamp(item.postedAt, locale)}
                            </span>
                          </div>
                          {item.reference !== null ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {t("referenceLabel", {
                                type: item.reference.type,
                                id: item.reference.id,
                              })}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium tabular-nums" dir="ltr">
                            {formatWalletMinorAmount(item.amountMinor, item.currency, locale)}
                          </span>
                          {canReverseWalletTransaction(item) ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={!canManage || mutationPending}
                              data-testid={WALLET_OPS_TEST_IDS.reverseButton}
                              onClick={() =>
                                openMutationDialog("reverse", selectedAccount, item)
                              }
                            >
                              {t("reverseAction")}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
              {historyHasMore ? (
                <div className="mt-4" data-testid={WALLET_OPS_TEST_IDS.historyPagination}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={historyState === "loading"}
                    onClick={() => void loadMoreHistory()}
                  >
                    {historyState === "loading" ? t("loadingMore") : t("loadMore")}
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}

      {mutationFeedback !== null ? (
        <p
          className="mt-4 text-sm text-emerald-700 dark:text-emerald-400"
          role="status"
          data-testid={WALLET_OPS_TEST_IDS.mutationFeedback}
        >
          {mutationFeedback}
        </p>
      ) : null}

      <Dialog open={mutationDialog !== null} onOpenChange={(open) => !open && closeMutationDialog()}>
        <DialogContent data-testid={WALLET_OPS_TEST_IDS.mutationDialog}>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>
          {mutationDialog?.kind === "reverse" ? (
            <div className="space-y-2">
              <Label htmlFor="wallet-reversal-reason">{t("reasonLabel")}</Label>
              <Input
                id="wallet-reversal-reason"
                value={reversalForm.reasonNote}
                onChange={(event) =>
                  setReversalForm({ reasonNote: event.target.value })
                }
                disabled={mutationPending}
                data-testid={WALLET_OPS_TEST_IDS.mutationReason}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="wallet-mutation-amount">{t("amountLabel")}</Label>
                <LocalizedNumericInput
                  id="wallet-mutation-amount"
                  mode="digits"
                  value={mutationForm.amountMinor}
                  onChange={(amount) =>
                    setMutationForm((current) => ({ ...current, amountMinor: amount }))
                  }
                  disabled={mutationPending}
                  data-testid={WALLET_OPS_TEST_IDS.mutationAmount}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wallet-mutation-reason">{t("reasonLabel")}</Label>
                <Input
                  id="wallet-mutation-reason"
                  value={mutationForm.reasonNote}
                  onChange={(event) =>
                    setMutationForm((current) => ({ ...current, reasonNote: event.target.value }))
                  }
                  disabled={mutationPending}
                  data-testid={WALLET_OPS_TEST_IDS.mutationReason}
                />
              </div>
            </div>
          )}
          {mutationError !== null ? (
            <p role="alert" className="text-sm text-destructive">
              {mutationError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeMutationDialog}
              disabled={mutationPending}
              data-testid={WALLET_OPS_TEST_IDS.mutationCancel}
            >
              {t("cancelAction")}
            </Button>
            <Button
              type="button"
              onClick={() => void handleMutationConfirm()}
              disabled={mutationPending}
              data-testid={WALLET_OPS_TEST_IDS.mutationConfirm}
            >
              {mutationPending ? t("submitting") : t("confirmAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
