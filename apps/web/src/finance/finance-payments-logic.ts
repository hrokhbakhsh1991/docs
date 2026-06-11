export const FINANCE_PAYMENTS_TEST_IDS = {
  panel: "finance-payments-panel",
  list: "finance-payments-list",
  createForm: "finance-manual-payment-form",
  receiptForm: "finance-submit-receipt-form",
} as const;

export type FinancePaymentRow = {
  readonly id: string;
  readonly registrationId: string;
  readonly amount: string;
  readonly currency: string;
  readonly method: string;
  readonly status: string;
  readonly provider: string;
  readonly paidAt: string | null;
  readonly createdAt: string;
};

export type FinancePaymentsListResponse = {
  readonly items: readonly FinancePaymentRow[];
};

export type CreateManualPaymentFormState = {
  readonly registrationId: string;
  readonly amount: string;
  readonly currency: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseFinancePaymentsListResponse(raw: unknown): FinancePaymentsListResponse {
  if (raw === null || typeof raw !== "object") {
    return { items: [] };
  }
  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record.items)) {
    return { items: [] };
  }
  const items = record.items
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .map((entry) => ({
      id: String(entry.id ?? ""),
      registrationId: String(entry.registrationId ?? ""),
      amount: String(entry.amount ?? "0"),
      currency: String(entry.currency ?? "IRR"),
      method: String(entry.method ?? "Manual"),
      status: String(entry.status ?? ""),
      provider: String(entry.provider ?? ""),
      paidAt: typeof entry.paidAt === "string" ? entry.paidAt : null,
      createdAt: String(entry.createdAt ?? ""),
    }))
    .filter((entry) => entry.id.length > 0);
  return { items };
}

export function validateCreateManualPaymentForm(
  input: CreateManualPaymentFormState
): { ok: true; value: CreateManualPaymentFormState } | { ok: false; error: string } {
  const registrationId = input.registrationId.trim();
  if (!UUID_PATTERN.test(registrationId)) {
    return { ok: false, error: "REGISTRATION_ID_INVALID" };
  }
  const amount = input.amount.trim();
  if (!/^\d+$/.test(amount) || amount === "0") {
    return { ok: false, error: "AMOUNT_POSITIVE_INTEGER" };
  }
  const currency = input.currency.trim().toUpperCase();
  if (currency.length < 3 || currency.length > 8) {
    return { ok: false, error: "CURRENCY_LENGTH" };
  }
  return {
    ok: true,
    value: { registrationId, amount, currency },
  };
}

export function paymentStatusTone(status: string): "default" | "warning" | "success" | "destructive" {
  if (status === "Paid") {
    return "success";
  }
  if (status === "Failed") {
    return "destructive";
  }
  if (status === "Pending") {
    return "warning";
  }
  return "default";
}

export function buildCreateManualPaymentRequestBody(
  value: CreateManualPaymentFormState
): Record<string, unknown> {
  return {
    registrationId: value.registrationId,
    amount: value.amount,
    currency: value.currency,
  };
}

export type SubmitReceiptFormState = {
  readonly paymentId: string;
  readonly fileKey: string;
  readonly note: string;
};

export function validateSubmitReceiptForm(
  input: SubmitReceiptFormState
): { ok: true; value: SubmitReceiptFormState } | { ok: false; error: string } {
  const paymentId = input.paymentId.trim();
  if (!UUID_PATTERN.test(paymentId)) {
    return { ok: false, error: "PAYMENT_ID_INVALID" };
  }
  const fileKey = input.fileKey.trim();
  if (fileKey.length === 0 || fileKey.length > 512) {
    return { ok: false, error: "FILE_KEY_REQUIRED" };
  }
  const note = input.note.trim();
  if (note.length > 2000) {
    return { ok: false, error: "NOTE_MAX_LENGTH" };
  }
  return {
    ok: true,
    value: { paymentId, fileKey, note },
  };
}

export function buildSubmitReceiptRequestBody(
  value: SubmitReceiptFormState
): Record<string, unknown> {
  return {
    paymentId: value.paymentId,
    fileKey: value.fileKey,
    ...(value.note.length > 0 ? { note: value.note } : {}),
  };
}
