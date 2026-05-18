"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button, FormField, Input } from "@tour/ui";

import { useAuth } from "@/lib/auth/auth-context";
import { mapToUserMessage } from "@/lib/errors/mapToUserMessage";
import { useFinanceModuleAccess } from "@/lib/finance/use-finance-module-access";
import {
  approveReceipt,
  getReceiptPreviewUrl,
  listPendingReceipts,
  rejectReceipt,
  type PaymentReceiptRow,
} from "@/lib/services/payments.service";
import { useAppToast } from "@/lib/use-app-toast";

import styles from "./admin-receipt-review-panel.module.css";

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
      toast.success({ message: "Receipt approved" });
      setReviewNote("");
      await invalidate();
    },
    onError: (err) => toast.error({ message: mapToUserMessage(err) }),
  });

  const rejectMutation = useMutation({
    mutationFn: (receiptId: string) => rejectReceipt(receiptId, reviewNote),
    onSuccess: async () => {
      toast.success({ message: "Receipt rejected" });
      setReviewNote("");
      await invalidate();
    },
    onError: (err) => toast.error({ message: mapToUserMessage(err) }),
  });

  const previewMutation = useMutation({
    mutationFn: (receiptId: string) => getReceiptPreviewUrl(receiptId),
    onSuccess: (url) => {
      window.open(url, "_blank", "noopener,noreferrer");
    },
    onError: (err) => toast.error({ message: mapToUserMessage(err) }),
  });

  if (!enabled) {
    return null;
  }

  const rows = receiptsQuery.data ?? [];

  return (
    <div className={styles.root}>
      <p className={styles.lead}>Review uploaded payment receipts.</p>

      <FormField label="Review note (optional)">
        <Input
          value={reviewNote}
          onChange={(e) => setReviewNote(e.target.value)}
          placeholder="Shown to finance audit"
        />
      </FormField>

      {receiptsQuery.isLoading ? <p className={styles.muted}>Loading queue…</p> : null}
      {receiptsQuery.isError ? (
        <p className={styles.error}>{mapToUserMessage(receiptsQuery.error)}</p>
      ) : null}

      {rows.length === 0 && !receiptsQuery.isLoading ? (
        <p className={styles.muted}>No receipts pending review.</p>
      ) : null}

      <ul className={styles.list}>
        {rows.map((row) => (
          <ReceiptRowItem
            key={row.id}
            row={row}
            busy={approveMutation.isPending || rejectMutation.isPending || previewMutation.isPending}
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
          Receipt {props.row.id.slice(0, 8)}… — {props.row.status}
        </span>
        {payment ? (
          <span className={styles.muted}>
            Payment {payment.amount} {payment.currency} ({payment.id.slice(0, 8)}…)
          </span>
        ) : null}
        {props.row.note ? <span className={styles.muted}>Note: {props.row.note}</span> : null}
      </div>
      <div className={styles.actions}>
        <Button type="button" variant="ghost" size="sm" disabled={props.busy} onClick={props.onPreview}>
          Preview
        </Button>
        <Button type="button" variant="primary" size="sm" disabled={props.busy} onClick={props.onApprove}>
          Approve
        </Button>
        <Button type="button" variant="danger" size="sm" disabled={props.busy} onClick={props.onReject}>
          Reject
        </Button>
      </div>
    </li>
  );
}
