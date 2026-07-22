"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { isAdminOrOwnerRole } from "@/features/bookings/bookings-command-center-types";
import { FinanceRegistrationIdentity } from "@/finance/finance-registration-identity";
import { withFinanceListScopeQuery } from "@/finance/finance-registration-context";
import { formatMinorAmount } from "@/finance/finance-prepayments-logic";
import { formatFinanceTimestamp } from "@/finance/finance-reports-logic";
import type { AppLocale } from "@/i18n/routing";
import { localizeFinanceMessage } from "@/i18n/resolve-finance-error-message";
import {
  FINANCE_RECEIPTS_TEST_IDS,
  buildReviewReceiptRequestBody,
  isBrowserReachableReceiptUrl,
  isReceiptImageFileKey,
  parseFinancePendingReceiptsResponse,
  parseFinanceReceiptReviewResponse,
  parseFinanceReceiptUrlPayload,
  receiptFileLabel,
  validateReviewReceiptForm,
  type FinancePendingReceipt,
  type FinancePendingReceiptsResponse,
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
  readonly initialReceipts?: FinancePendingReceiptsResponse | null;
};

function ReceiptProofPreview({
  receiptId,
  fileKey,
}: {
  readonly receiptId: string;
  readonly fileKey: string;
}) {
  const t = useTranslations("finance.receipts");
  const [phase, setPhase] = useState<"loading" | "ready" | "unavailable">("loading");
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const fileName = receiptFileLabel(fileKey);
  const isImage = isReceiptImageFileKey(fileKey);

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    setProofUrl(null);
    void fetch(`/api/finance/receipts/${encodeURIComponent(receiptId)}/url`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("RECEIPT_URL_HTTP");
        }
        return parseFinanceReceiptUrlPayload(await response.json());
      })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        if (payload !== null && isBrowserReachableReceiptUrl(payload.url)) {
          setProofUrl(payload.url);
          setPhase("ready");
          return;
        }
        setPhase("unavailable");
      })
      .catch(() => {
        if (!cancelled) {
          setPhase("unavailable");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [receiptId]);

  return (
    <div
      className="space-y-2 rounded-md border bg-muted/30 p-3"
      data-testid={FINANCE_RECEIPTS_TEST_IDS.preview}
    >
      <p className="text-sm font-medium">{t("previewTitle")}</p>
      <p className="text-xs text-muted-foreground">
        {t("fileName")}: <span className="font-mono">{fileName}</span>
      </p>
      {phase === "loading" ? (
        <p className="text-sm text-muted-foreground">{t("previewLoading")}</p>
      ) : null}
      {phase === "ready" && proofUrl !== null && isImage ? (
        <img
          src={proofUrl}
          alt={fileName}
          className="max-h-64 w-full rounded-md border object-contain bg-background"
        />
      ) : null}
      {phase === "ready" && proofUrl !== null ? (
        <Button asChild type="button" size="sm" variant="outline">
          <a
            href={proofUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={FINANCE_RECEIPTS_TEST_IDS.openProof}
          >
            {t("openProof")}
          </a>
        </Button>
      ) : null}
      {phase === "unavailable" ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t("previewUnavailable")}
        </p>
      ) : null}
    </div>
  );
}

function ReceiptRow({
  receipt,
  canManage,
  onReviewed,
}: {
  readonly receipt: FinancePendingReceipt;
  readonly canManage: boolean;
  readonly onReviewed: (bookingPaymentStatus?: "unpaid" | "partial" | "paid") => void;
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
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (validated.value.decision === "approve") {
        headers["Idempotency-Key"] =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `approve-${receipt.id}-${Date.now()}`;
      }
      const response = await fetch(`/api/finance/receipts/${receipt.id}/review`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(buildReviewReceiptRequestBody(validated.value)),
      });
      const payload = parseFinanceReceiptReviewResponse(await response.json().catch(() => null));
      if (!response.ok) {
        throw new Error(`RECEIPT_REVIEW_HTTP_${response.status}`);
      }
      onReviewed(payload?.bookingPaymentStatus);
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
          <p
            className="text-sm text-muted-foreground"
            data-testid={FINANCE_RECEIPTS_TEST_IDS.submittedAt}
          >
            <span className="font-medium text-foreground">{t("submittedAt")}: </span>
            {formatFinanceTimestamp(receipt.createdAt, locale)}
          </p>
          {receipt.note ? (
            <p className="text-sm text-muted-foreground">{receipt.note}</p>
          ) : null}
          {receipt.payment ? (
            <FinanceRegistrationIdentity
              registrationId={receipt.payment.registrationId}
              context={receipt.registrationContext}
            />
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">{resolveFinanceReceiptStatusLabel(t, receipt.status)}</Badge>
        </div>
      </div>

      <ReceiptProofPreview receiptId={receipt.id} fileKey={receipt.fileKey} />

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

export function FinanceReceiptsPanel({
  session,
  initialReceipts = null,
}: FinanceReceiptsPanelProps) {
  const t = useTranslations("finance.receipts");
  const tCommon = useTranslations("finance.common");
  const tValidation = useTranslations("finance.validation");
  const tErrors = useTranslations("finance.errors");
  const router = useRouter();
  const canManage = isAdminOrOwnerRole(session.role);
  const searchParams = useSearchParams();
  const registrationFilter = searchParams.get("registrationId");
  const tourFilter = searchParams.get("tourId");
  const [items, setItems] = useState<readonly FinancePendingReceipt[]>(initialReceipts?.items ?? []);
  const [loading, setLoading] = useState(initialReceipts === null);
  const [error, setError] = useState<string | null>(null);
  const [fetchNonce, setFetchNonce] = useState(0);
  const skipInitialFetchRef = useRef(initialReceipts !== null);

  useEffect(() => {
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const path = withFinanceListScopeQuery("/api/finance/receipts/pending?limit=50", {
      registrationId: registrationFilter,
      tourId: tourFilter,
    });
    void fetch(path, { cache: "no-store" })
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
  }, [fetchNonce, registrationFilter, tourFilter]);

  const refresh = () => setFetchNonce((value) => value + 1);

  const handleReviewed = (bookingPaymentStatus?: "unpaid" | "partial" | "paid") => {
    refresh();
    if (bookingPaymentStatus === "paid") {
      // Revalidate RSC/bookings surfaces that show paymentStatus without a full navigation.
      router.refresh();
    }
  };

  return (
    <div className="space-y-6" data-testid={FINANCE_RECEIPTS_TEST_IDS.panel}>
      <Card data-operator-surface="card" className="shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">{t("listTitle")}</CardTitle>
            <p className="text-sm font-normal text-muted-foreground">{t("reviewRoleHint")}</p>
          </div>
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
                  onReviewed={handleReviewed}
                />
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
