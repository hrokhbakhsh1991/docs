"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { isAdminOrOwnerRole } from "@/features/bookings/bookings-command-center-types";
import { formatMinorAmount } from "@/finance/finance-prepayments-logic";
import { formatFinanceTimestamp } from "@/finance/finance-reports-logic";
import type { AppLocale } from "@/i18n/routing";
import { localizeFinanceMessage } from "@/i18n/resolve-finance-error-message";
import {
  FINANCE_RECEIPTS_TEST_IDS,
  buildReviewReceiptRequestBody,
  parseFinancePendingReceiptsResponse,
  receiptFileLabel,
  validateReviewReceiptForm,
  type FinancePendingReceipt,
} from "@/finance/finance-receipts-logic";

function resolveFinanceReceiptStatusLabel(t: (key: string) => string, status: string): string {
  try {
    return t(`status.${status}`);
  } catch {
    return status;
  }
}

type FinanceReceiptsPanelProps = {
  readonly session: OperatorSessionContext;
};

function ReceiptRow({
  receipt,
  canManage,
  onReviewed,
}: {
  readonly receipt: FinancePendingReceipt;
  readonly canManage: boolean;
  readonly onReviewed: () => void;
}) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("finance.receipts");
  const tCommon = useTranslations("finance.common");
  const tValidation = useTranslations("finance.validation");
  const tErrors = useTranslations("finance.errors");
  const [reviewNote, setReviewNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitReview = async (decision: "approve" | "reject") => {
    if (!canManage) {
      return;
    }
    setError(null);
    const validated = validateReviewReceiptForm({ decision, reviewNote });
    if (!validated.ok) {
      setError(validated.error);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/finance/receipts/${receipt.id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildReviewReceiptRequestBody(validated.value)),
      });
      if (!response.ok) {
        throw new Error(`RECEIPT_REVIEW_HTTP_${response.status}`);
      }
      onReviewed();
    } catch (reviewError: unknown) {
      setError(reviewError instanceof Error ? reviewError.message : "RECEIPT_REVIEW_FAILED");
    } finally {
      setBusy(false);
    }
  };

  const amount =
    receipt.payment !== null
      ? formatMinorAmount(receipt.payment.amount, receipt.payment.currency, locale)
      : "—";

  return (
    <li className="space-y-3 border-b p-4 last:border-b-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="font-medium">{amount}</p>
          <p className="text-sm text-muted-foreground">{receiptFileLabel(receipt.fileKey)}</p>
          {receipt.note ? (
            <p className="text-sm text-muted-foreground">{receipt.note}</p>
          ) : null}
          {receipt.payment ? (
            <p className="font-mono text-xs text-muted-foreground">
              {receipt.payment.registrationId}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">{resolveFinanceReceiptStatusLabel(t, receipt.status)}</Badge>
          <span>{formatFinanceTimestamp(receipt.createdAt, locale)}</span>
        </div>
      </div>

      {canManage ? (
        <div className="space-y-2" data-testid={FINANCE_RECEIPTS_TEST_IDS.reviewForm}>
          <Label htmlFor={`review-note-${receipt.id}`}>{tCommon("reviewNote")}</Label>
          <Input
            id={`review-note-${receipt.id}`}
            value={reviewNote}
            onChange={(event) => setReviewNote(event.target.value)}
            placeholder={t("reviewPlaceholder")}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void submitReview("approve")}
            >
              {tCommon("approve")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void submitReview("reject")}
            >
              {tCommon("reject")}
            </Button>
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {localizeFinanceMessage(tValidation, tErrors, error)}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function FinanceReceiptsPanel({ session }: FinanceReceiptsPanelProps) {
  const t = useTranslations("finance.receipts");
  const tCommon = useTranslations("finance.common");
  const tValidation = useTranslations("finance.validation");
  const tErrors = useTranslations("finance.errors");
  const canManage = isAdminOrOwnerRole(session.role);
  const [items, setItems] = useState<readonly FinancePendingReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchNonce, setFetchNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetch("/api/finance/receipts/pending?limit=50", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`RECEIPTS_LIST_HTTP_${response.status}`);
        }
        return parseFinancePendingReceiptsResponse(await response.json());
      })
      .then((payload) => {
        if (!cancelled) {
          setItems(payload.items);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "RECEIPTS_FETCH_FAILED");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fetchNonce]);

  const refresh = () => setFetchNonce((value) => value + 1);

  return (
    <div className="space-y-6" data-testid={FINANCE_RECEIPTS_TEST_IDS.panel}>
      <Card data-denali-surface="card" className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t("listTitle")}</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={refresh} disabled={loading}>
            {tCommon("refresh")}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : null}
          {!loading && error ? (
            <p className="text-sm text-destructive" role="alert">
              {localizeFinanceMessage(tValidation, tErrors, error)}
            </p>
          ) : null}
          {!loading && !error && items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : null}
          {!loading && !error && items.length > 0 ? (
            <ul className="rounded-md border" data-testid={FINANCE_RECEIPTS_TEST_IDS.list}>
              {items.map((receipt) => (
                <ReceiptRow
                  key={receipt.id}
                  receipt={receipt}
                  canManage={canManage}
                  onReviewed={refresh}
                />
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
