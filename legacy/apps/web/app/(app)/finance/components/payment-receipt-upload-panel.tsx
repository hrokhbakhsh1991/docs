"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button, FormField, Input } from "@tour/ui";

import { useAuth } from "@/lib/auth/auth-context";
import { mapFinanceToUserMessage } from "@/lib/finance/map-finance-to-user-message";
import { formatFinanceAmountFa } from "@/lib/finance/format-finance-display";
import { useFinanceModuleAccess } from "@/lib/finance/use-finance-module-access";
import {
  listManualPayments,
  submitReceipt,
  type PaymentIntentResponse,
} from "@/lib/services/payments.service";
import { useAppToast } from "@/lib/use-app-toast";

import { FINANCE_ROUTE_COPY } from "../finance-copy";
import styles from "./payment-receipt-upload-panel.module.css";

const copy = FINANCE_ROUTE_COPY.upload;

function pendingManualPayments(rows: PaymentIntentResponse[]): PaymentIntentResponse[] {
  return rows.filter((p) => p.method === "Manual" && p.status === "Pending");
}

export function PaymentReceiptUploadPanel() {
  const { user } = useAuth();
  const { canListManualPayments, canUploadReceipt } = useFinanceModuleAccess();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const tenantScope = user?.tenantId ?? "anonymous";

  const [paymentId, setPaymentId] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const enabled = canListManualPayments && canUploadReceipt;

  const paymentsQuery = useQuery({
    queryKey: ["finance", "manual-payments", tenantScope],
    queryFn: listManualPayments,
    enabled,
    staleTime: 30_000,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const id = paymentId.trim();
      if (!id) {
        throw new Error(copy.errors.paymentIdRequired);
      }
      if (!file) {
        throw new Error(copy.errors.fileRequired);
      }
      return submitReceipt(id, file, note);
    },
    onSuccess: async () => {
      toast.success({ message: copy.toastUploaded });
      setFile(null);
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["finance", "manual-payments", tenantScope] });
    },
    onError: (err) => {
      toast.error({ message: mapFinanceToUserMessage(err) });
    },
  });

  if (!enabled) {
    return null;
  }

  const pending = pendingManualPayments(paymentsQuery.data ?? []);

  return (
    <div className={styles.root}>
      <p className={styles.lead}>{copy.lead}</p>
      <p className={styles.description}>{copy.description}</p>

      {paymentsQuery.isLoading ? <p className={styles.muted}>{copy.loadingPayments}</p> : null}
      {paymentsQuery.isError ? (
        <p className={styles.error}>{mapFinanceToUserMessage(paymentsQuery.error)}</p>
      ) : null}

      {pending.length > 0 ? (
        <div className={styles.pendingList}>
          <p className={styles.muted}>{copy.pendingPaymentsLabel}</p>
          <ul>
            {pending.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={styles.pickPayment}
                  onClick={() => setPaymentId(p.id)}
                >
                  {formatFinanceAmountFa(p.amount, p.currency)} — {p.id.slice(0, 8)}…
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <FormField label={copy.paymentIdLabel}>
        <Input
          value={paymentId}
          onChange={(e) => setPaymentId(e.target.value)}
          placeholder={copy.paymentIdPlaceholder}
          autoComplete="off"
        />
      </FormField>

      <FormField label={copy.receiptFileLabel}>
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </FormField>

      <FormField label={copy.noteLabel}>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={copy.notePlaceholder} />
      </FormField>

      <Button
        type="button"
        variant="primary"
        disabled={uploadMutation.isPending || !paymentId.trim() || !file}
        onClick={() => uploadMutation.mutate()}
      >
        {uploadMutation.isPending ? copy.submitting : copy.submit}
      </Button>
    </div>
  );
}
