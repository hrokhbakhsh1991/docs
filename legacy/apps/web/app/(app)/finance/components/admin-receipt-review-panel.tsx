"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button, FormField, Input } from "@tour/ui";

import { useAuth } from "@/lib/auth/auth-context";
import { mapFinanceToUserMessage } from "@/lib/finance/map-finance-to-user-message";
import {
  formatFinanceAmountFa,
  formatReceiptStatusFa,
} from "@/lib/finance/format-finance-display";
import { useFinanceModuleAccess } from "@/lib/finance/use-finance-module-access";
import {
  approveReceipt,
  getReceiptPreviewUrl,
  listPendingReceipts,
  rejectReceipt,
  type PaymentReceiptRow,
} from "@/lib/services/payments.service";
import { useAppToast } from "@/lib/use-app-toast";

import { FINANCE_ROUTE_COPY } from "../finance-copy";
import styles from "./admin-receipt-review-panel.module.css";

const copy = FINANCE_ROUTE_COPY.review;

export function AdminReceiptReviewPanel() {
  const { user } = useAuth();
  const { canReviewReceipts } = useFinanceModuleAccess();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const tenantScope = user?.tenantId ?? "anonymous";
  const [reviewNote, setReviewNote] = useState("");

  const enabled = canReviewReceipts;

  const receiptsQuery = useQuery({
    queryKey: ["finance", "pending-receipts", tenantScope],
    queryFn: listPendingReceipts,
    enabled,
    staleTime: 15_000,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["finance", "pending-receipts", tenantScope] });
    await queryClient.invalidateQueries({ queryKey: ["finance", "manual-payments", tenantScope] });
  };

  const approveMutation = useMutation({
    mutationFn: (receiptId: string) => approveReceipt(receiptId, reviewNote),
    onSuccess: async () => {
      toast.success({ message: copy.toastApproved });
      setReviewNote("");
      await invalidate();
    },
    onError: (err) => toast.error({ message: mapFinanceToUserMessage(err) }),
  });

  const rejectMutation = useMutation({
    mutationFn: (receiptId: string) => rejectReceipt(receiptId, reviewNote),
    onSuccess: async () => {
      toast.success({ message: copy.toastRejected });
      setReviewNote("");
      await invalidate();
    },
    onError: (err) => toast.error({ message: mapFinanceToUserMessage(err) }),
  });

  const previewMutation = useMutation({
    mutationFn: (receiptId: string) => getReceiptPreviewUrl(receiptId),
    onSuccess: (url) => {
      window.open(url, "_blank", "noopener,noreferrer");
    },
    onError: (err) => toast.error({ message: mapFinanceToUserMessage(err) }),
  });

  if (!enabled) {
    return null;
  }

  const rows = receiptsQuery.data ?? [];
  const busy =
    approveMutation.isPending || rejectMutation.isPending || previewMutation.isPending;

  return (
    <div className={styles.root}>
      <p className={styles.lead}>{copy.lead}</p>

      <FormField label={copy.reviewNoteLabel}>
        <Input
          value={reviewNote}
          onChange={(e) => setReviewNote(e.target.value)}
          placeholder={copy.reviewNotePlaceholder}
        />
      </FormField>

      {receiptsQuery.isLoading ? <p className={styles.muted}>{copy.loadingQueue}</p> : null}
      {receiptsQuery.isError ? (
        <p className={styles.error}>{mapFinanceToUserMessage(receiptsQuery.error)}</p>
      ) : null}

      {rows.length === 0 && !receiptsQuery.isLoading ? (
        <p className={styles.muted}>{copy.emptyQueue}</p>
      ) : null}

      <ul className={styles.list}>
        {rows.map((row) => (
          <ReceiptRowItem
            key={row.id}
            row={row}
            busy={busy}
            onPreview={() => previewMutation.mutate(row.id)}
            onApprove={() => approveMutation.mutate(row.id)}
            onReject={() => rejectMutation.mutate(row.id)}
          />
        ))}
      </ul>
    </div>
  );
}

function ReceiptRowItem(props: {
  row: PaymentReceiptRow;
  busy: boolean;
  onPreview: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const payment = props.row.payment;
  return (
    <li className={styles.item}>
      <div className={styles.itemMeta}>
        <span>
          {copy.receiptRow(props.row.id.slice(0, 8), formatReceiptStatusFa(props.row.status))}
        </span>
        {payment ? (
          <span className={styles.muted}>
            {copy.paymentRow(
              formatFinanceAmountFa(payment.amount, payment.currency),
              payment.id.slice(0, 8)
            )}
          </span>
        ) : null}
        {props.row.note ? (
          <span className={styles.muted}>
            {copy.notePrefix} {props.row.note}
          </span>
        ) : null}
      </div>
      <div className={styles.actions}>
        <Button type="button" variant="ghost" size="sm" disabled={props.busy} onClick={props.onPreview}>
          {copy.preview}
        </Button>
        <Button type="button" variant="primary" size="sm" disabled={props.busy} onClick={props.onApprove}>
          {copy.approve}
        </Button>
        <Button type="button" variant="danger" size="sm" disabled={props.busy} onClick={props.onReject}>
          {copy.reject}
        </Button>
      </div>
    </li>
  );
}
