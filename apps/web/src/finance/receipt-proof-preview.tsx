"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import {
  FINANCE_RECEIPTS_TEST_IDS,
  isBrowserReachableReceiptUrl,
  isReceiptImageFileKey,
  parseFinanceReceiptUrlPayload,
  receiptFileLabel,
} from "@/finance/finance-receipts-logic";

type ReceiptProofPreviewProps = {
  readonly receiptId: string;
  readonly fileKey: string;
  readonly expanded: boolean;
  readonly className?: string;
};

export function ReceiptProofPreview({
  receiptId,
  fileKey,
  expanded,
  className,
}: ReceiptProofPreviewProps) {
  const t = useTranslations("finance.receipts");
  const [phase, setPhase] = useState<"loading" | "ready" | "unavailable">("loading");
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const fileName = receiptFileLabel(fileKey);
  const isImage = isReceiptImageFileKey(fileKey);

  useEffect(() => {
    if (!expanded) {
      return;
    }
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
  }, [expanded, receiptId]);

  if (!expanded) {
    return null;
  }

  return (
    <div
      className={className ?? "space-y-2 rounded-md border bg-muted/30 p-3"}
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
          className="max-h-72 w-full rounded-md border bg-background object-contain"
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
