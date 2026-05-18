import { bffBrowserClient } from "@/lib/api/bff-browser-client";
import { BFF } from "@/lib/api-paths";

/** Mirrors OpenAPI `PaymentResponseDto` loosely for client use. */
export type PaymentIntentResponse = {
  id: string;
  tenantId: string;
  registrationId: string;
  amount: string;
  currency: string;
  method: string;
  provider: string;
  providerPaymentId: string | null;
  status: string;
  paidAt: string | null;
  failedAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function pickStr(o: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}

/**
 * Coerces JSON from register flow or webhook mirrors into {@link PaymentIntentResponse} where possible.
 */
export function coercePaymentIntentResponse(raw: unknown): PaymentIntentResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = pickStr(o, "id");
  const registrationId = pickStr(o, "registrationId", "registration_id");
  if (!id || !registrationId) return null;
  const amtRaw = o.amount;
  const amount =
    typeof amtRaw === "number" && Number.isFinite(amtRaw)
      ? String(amtRaw)
      : typeof amtRaw === "string" && amtRaw.trim()
        ? amtRaw.trim()
        : pickStr(o, "amount");
  if (!amount) return null;
  const currency = pickStr(o, "currency");
  const method = pickStr(o, "method") || "Online";
  const provider = pickStr(o, "provider", "paymentProvider", "payment_provider");
  const status = pickStr(o, "status");
  if (!currency || !provider || !status) return null;
  const tenantId = pickStr(o, "tenantId", "tenant_id");
  const ppidRaw = o.providerPaymentId ?? o.provider_payment_id;
  const providerPaymentId =
    ppidRaw === null ? null : ppidRaw != null ? String(ppidRaw) : null;
  const paidAt = o.paidAt != null ? String(o.paidAt) : o.paid_at != null ? String(o.paid_at) : null;
  const failedAt = o.failedAt != null ? String(o.failedAt) : o.failed_at != null ? String(o.failed_at) : null;
  const refundedAt =
    o.refundedAt != null ? String(o.refundedAt) : o.refunded_at != null ? String(o.refunded_at) : null;
  const createdAt = pickStr(o, "createdAt", "created_at");
  const updatedAt = pickStr(o, "updatedAt", "updated_at");
  return {
    id,
    tenantId,
    registrationId,
    amount,
    currency,
    method,
    provider,
    providerPaymentId,
    status,
    paidAt,
    failedAt,
    refundedAt,
    createdAt,
    updatedAt,
  };
}

export type CreatePaymentIntentPayload = {
  registrationId: string;
  amount: number;
  currency: string;
  paymentProvider: string;
  providerPaymentId?: string;
};

export async function createPaymentIntent(
  payload: CreatePaymentIntentPayload,
): Promise<PaymentIntentResponse> {
  return bffBrowserClient.post<PaymentIntentResponse>(BFF.paymentsIntent, payload, {
    idempotencyKey: true,
  });
}

export type ManualPaymentPayload = {
  registrationId: string;
  amount: string;
  currency: string;
};

export type PaymentReceiptRow = {
  id: string;
  tenantId: string;
  paymentId: string;
  fileKey: string;
  status: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  payment?: PaymentIntentResponse;
};

export async function createManualPayment(
  payload: ManualPaymentPayload,
): Promise<PaymentIntentResponse> {
  return bffBrowserClient.post<PaymentIntentResponse>(BFF.financePaymentsManual, payload);
}

export async function listManualPayments(): Promise<PaymentIntentResponse[]> {
  return bffBrowserClient.get<PaymentIntentResponse[]>(BFF.financePayments);
}

export async function submitReceipt(
  paymentId: string,
  file: File,
  note?: string,
): Promise<PaymentReceiptRow> {
  const formData = new FormData();
  formData.append("file", file);
  if (note?.trim()) {
    formData.append("note", note.trim());
  }
  return bffBrowserClient.postForm<PaymentReceiptRow>(
    BFF.financePaymentReceipt(paymentId),
    formData,
  );
}

export async function listPendingReceipts(): Promise<PaymentReceiptRow[]> {
  return bffBrowserClient.get<PaymentReceiptRow[]>(BFF.adminFinanceReceiptsPending);
}

export async function approveReceipt(
  receiptId: string,
  reviewNote?: string,
): Promise<PaymentReceiptRow> {
  return bffBrowserClient.post<PaymentReceiptRow>(
    BFF.adminFinanceReceiptApprove(receiptId),
    reviewNote?.trim() ? { reviewNote: reviewNote.trim() } : {},
  );
}

export async function rejectReceipt(
  receiptId: string,
  reviewNote?: string,
): Promise<PaymentReceiptRow> {
  return bffBrowserClient.post<PaymentReceiptRow>(
    BFF.adminFinanceReceiptReject(receiptId),
    reviewNote?.trim() ? { reviewNote: reviewNote.trim() } : {},
  );
}

export async function getReceiptPreviewUrl(receiptId: string): Promise<string> {
  const res = await bffBrowserClient.get<{ url: string }>(
    BFF.adminFinanceReceiptUrl(receiptId),
  );
  return res.url;
}
