import type { FinanceRegistrationContext } from "@/finance/finance-registration-context";
import {
  parseFinanceRegistrationContext,
  withFinanceRegistrationQuery,
} from "@/finance/finance-registration-context";

export const FINANCE_PAYMENTS_TEST_IDS = {
  panel: "finance-payments-panel",
  list: "finance-payments-list",
  row: "finance-payment-row",
  rowAdvanced: "finance-payment-row-advanced",
  createOpen: "finance-payments-create-open",
  createForm: "finance-manual-payment-form",
  createDetails: "finance-manual-payment-create-details",
  receiptForm: "finance-submit-receipt-form",
  receiptUploadInput: "finance-receipt-upload-input",
  createResult: "finance-manual-payment-create-result",
  obligationGlance: "finance-payments-obligation-glance",
  scopedIdentity: "finance-payments-scoped-identity",
  settlementHint: "finance-payments-settlement-hint",
  pendingMeaning: "finance-payment-pending-meaning",
  openReceipts: "finance-payment-open-receipts",
  usePaymentForReceipt: "finance-payment-use-for-receipt",
  emptyFiltered: "finance-payments-empty-filtered",
  emptyRegistration: "finance-payments-empty-registration",
  cancelOpen: "finance-payment-cancel-open",
  cancelDialog: "finance-payment-cancel-dialog",
  cancelReason: "finance-payment-cancel-reason",
  cancelNote: "finance-payment-cancel-note",
  cancelConfirm: "finance-payment-cancel-confirm",
  cancelError: "finance-payment-cancel-error",
  cancelSuccess: "finance-payment-cancel-success",
} as const;

/** Domain reason codes — must match cancel HTTP/domain contract (PR23-A.1/A2). */
export const MANUAL_PAYMENT_CANCEL_REASON_CODES = [
  "abandoned",
  "wrong_amount",
  "superseded",
  "other",
] as const;

export type ManualPaymentCancelReasonCode =
  (typeof MANUAL_PAYMENT_CANCEL_REASON_CODES)[number];

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
  readonly registrationContext: FinanceRegistrationContext | null;
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

function parseFinancePaymentRow(entry: Record<string, unknown>): FinancePaymentRow | null {
  const id = String(entry.id ?? "");
  if (id.length === 0) {
    return null;
  }
  return {
    id,
    registrationId: String(entry.registrationId ?? ""),
    amount: String(entry.amount ?? "0"),
    currency: String(entry.currency ?? "IRR"),
    method: String(entry.method ?? "Manual"),
    status: String(entry.status ?? ""),
    provider: String(entry.provider ?? ""),
    paidAt: typeof entry.paidAt === "string" ? entry.paidAt : null,
    createdAt: String(entry.createdAt ?? ""),
    registrationContext: parseFinanceRegistrationContext(entry.registrationContext),
  };
}

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
    .map((entry) => parseFinancePaymentRow(entry))
    .filter((entry): entry is FinancePaymentRow => entry !== null);
  return { items };
}

/** Manual create returns a payment row (or wrapped). Presentation-only parse. */
export function parseFinanceManualPaymentCreateResponse(raw: unknown): FinancePaymentRow | null {
  if (raw === null || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.id === "string" && record.id.length > 0) {
    return parseFinancePaymentRow(record);
  }
  if (typeof record.payment === "object" && record.payment !== null) {
    return parseFinancePaymentRow(record.payment as Record<string, unknown>);
  }
  return null;
}

export function isFinancePaymentPendingStatus(status: string): boolean {
  return status.trim().toLowerCase() === "pending";
}

export function isFinancePaymentPaidStatus(status: string): boolean {
  return status.trim().toLowerCase() === "paid";
}

export function isFinancePaymentCancelledStatus(status: string): boolean {
  return status.trim().toLowerCase() === "cancelled";
}

export function isFinancePaymentManualMethod(method: string): boolean {
  return method.trim().toLowerCase() === "manual";
}

/**
 * Presentation gate for cancel action — mirrors domain preconditions without
 * re-implementing debt gate / audit. Pending receipt set comes from receipts list.
 */
export function isManualPendingPaymentCancellable(input: {
  readonly method: string;
  readonly status: string;
  readonly hasPendingReceipt: boolean;
}): boolean {
  return (
    isFinancePaymentManualMethod(input.method) &&
    isFinancePaymentPendingStatus(input.status) &&
    input.hasPendingReceipt === false
  );
}

export type CancelPendingManualPaymentFormState = {
  readonly reasonCode: ManualPaymentCancelReasonCode | "";
  readonly reasonNote: string;
};

export function validateCancelPendingManualPaymentForm(
  input: CancelPendingManualPaymentFormState
):
  | { ok: true; value: { reasonCode: ManualPaymentCancelReasonCode; reasonNote?: string } }
  | { ok: false; error: "REASON_REQUIRED" | "REASON_NOTE_REQUIRED" } {
  if (
    !(MANUAL_PAYMENT_CANCEL_REASON_CODES as readonly string[]).includes(input.reasonCode)
  ) {
    return { ok: false, error: "REASON_REQUIRED" };
  }
  const reasonCode = input.reasonCode as ManualPaymentCancelReasonCode;
  const note = input.reasonNote.trim();
  if (reasonCode === "other" && note.length === 0) {
    return { ok: false, error: "REASON_NOTE_REQUIRED" };
  }
  if (note.length > 2000) {
    return { ok: false, error: "REASON_NOTE_REQUIRED" };
  }
  return {
    ok: true,
    value: {
      reasonCode,
      ...(note.length > 0 ? { reasonNote: note } : {}),
    },
  };
}

export function buildCancelPendingManualPaymentRequestBody(value: {
  readonly reasonCode: ManualPaymentCancelReasonCode;
  readonly reasonNote?: string;
}): Record<string, unknown> {
  return {
    reasonCode: value.reasonCode,
    ...(value.reasonNote !== undefined ? { reasonNote: value.reasonNote } : {}),
  };
}

export function buildCancelPendingManualPaymentPath(paymentId: string): string {
  return `/api/finance/payments/${encodeURIComponent(paymentId)}/cancel`;
}

export type CancelPendingManualPaymentResult = {
  readonly paymentId: string;
  readonly status: string;
  readonly cancellationEventId: string;
  readonly occurredAt: string;
  readonly reasonCode: string;
  readonly replay: boolean;
};

export function parseCancelPendingManualPaymentResponse(
  raw: unknown
): CancelPendingManualPaymentResult | null {
  if (raw === null || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const paymentId = String(record.paymentId ?? "");
  const status = String(record.status ?? "");
  if (paymentId.length === 0 || status.length === 0) {
    return null;
  }
  return {
    paymentId,
    status,
    cancellationEventId: String(record.cancellationEventId ?? ""),
    occurredAt: String(record.occurredAt ?? ""),
    reasonCode: String(record.reasonCode ?? ""),
    replay: record.replay === true,
  };
}

export type CancelPendingManualPaymentClientError =
  | "PAYMENT_NOT_FOUND"
  | "PAYMENT_NOT_CANCELLABLE"
  | "PAYMENT_HAS_PENDING_RECEIPT"
  | "PAYMENT_CANCEL_ONLY_MANUAL"
  | "PAYMENT_CANCEL_REASON_INVALID"
  | "CANCEL_PAYMENT_FAILED";

export function mapCancelPendingManualPaymentHttpError(
  status: number,
  raw: unknown
): CancelPendingManualPaymentClientError {
  const code =
    raw !== null && typeof raw === "object"
      ? String((raw as Record<string, unknown>).code ?? (raw as Record<string, unknown>).error ?? "")
      : "";
  if (status === 404 || code === "PAYMENT_NOT_FOUND") {
    return "PAYMENT_NOT_FOUND";
  }
  if (code === "PAYMENT_HAS_PENDING_RECEIPT") {
    return "PAYMENT_HAS_PENDING_RECEIPT";
  }
  if (code === "PAYMENT_CANCEL_ONLY_MANUAL") {
    return "PAYMENT_CANCEL_ONLY_MANUAL";
  }
  if (code === "PAYMENT_CANCEL_REASON_INVALID" || status === 400) {
    return "PAYMENT_CANCEL_REASON_INVALID";
  }
  if (code === "PAYMENT_NOT_CANCELLABLE" || status === 409) {
    return "PAYMENT_NOT_CANCELLABLE";
  }
  return "CANCEL_PAYMENT_FAILED";
}

export function createFinanceIdempotencyKey(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}`;
}

export function buildFinancePaymentReceiptsHref(registrationId: string): string {
  return withFinanceRegistrationQuery("/finance?tab=receipts", registrationId);
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
  // Cancelled — intentional abandon; must not share Failed (destructive) tone.
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

export type FinanceReceiptCreateResponse = {
  readonly id: string;
  readonly paymentId: string;
  readonly fileKey: string;
  readonly status: string;
  readonly note: string | null;
  readonly createdAt: string;
};

export type FinanceRegistrationPaymentActionEvent =
  | {
      readonly kind: "manual_payment_created";
      readonly registrationId: string;
      readonly paymentId: string | null;
    }
  | {
      readonly kind: "receipt_submitted";
      readonly registrationId: string;
      readonly paymentId: string;
      readonly receiptId: string | null;
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

export function parseFinanceReceiptCreateResponse(
  raw: unknown
): FinanceReceiptCreateResponse | null {
  if (raw === null || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const id = String(record.id ?? "").trim();
  const paymentId = String(record.paymentId ?? "").trim();
  if (id.length === 0 || paymentId.length === 0) {
    return null;
  }
  return {
    id,
    paymentId,
    fileKey: String(record.fileKey ?? ""),
    status: String(record.status ?? ""),
    note: typeof record.note === "string" ? record.note : null,
    createdAt: String(record.createdAt ?? ""),
  };
}

export async function uploadFinanceReceiptProof(input: {
  readonly registrationId: string;
  readonly file: File;
}): Promise<string | null> {
  const registrationId = input.registrationId.trim();
  if (!UUID_PATTERN.test(registrationId)) {
    return null;
  }
  const params = new URLSearchParams({ registrationId });
  const response = await fetch(`/api/finance/receipts/upload?${params.toString()}`, {
    method: "POST",
    headers: {
      "Content-Type": input.file.type || "application/octet-stream",
      "X-Receipt-File-Name": input.file.name,
    },
    body: input.file,
  });
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const fileKey = payload?.fileKey;
  return typeof fileKey === "string" && fileKey.trim().length > 0 ? fileKey.trim() : null;
}
