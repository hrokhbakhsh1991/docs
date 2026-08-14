/**
 * Finance-owned HTTP request schemas — Phase 1.4 SoT.
 * Moved verbatim from Denali `http/schemas/finance-request.schemas.ts` (validation unchanged).
 */
import { z } from "zod";

const uuidSchema = z.string().uuid();
const minorAmountSchema = z.string().regex(/^\d+$/, "amount must be minor-unit integer string");
const currencySchema = z.string().min(3).max(8);

export const createManualPaymentBodySchema = z
  .object({
    registrationId: uuidSchema,
    amount: minorAmountSchema,
    currency: currencySchema,
  })
  .strict();

export type CreateManualPaymentBody = z.infer<typeof createManualPaymentBodySchema>;

export const submitReceiptBodySchema = z
  .object({
    paymentId: uuidSchema,
    fileKey: z.string().min(1).max(512),
    note: z.string().max(2000).optional(),
  })
  .strict();

export type SubmitReceiptBody = z.infer<typeof submitReceiptBodySchema>;

export const reviewReceiptBodySchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    reviewNote: z.string().max(2000).optional(),
  })
  .strict();

export type ReviewReceiptBody = z.infer<typeof reviewReceiptBodySchema>;

/** PR23-A3 — transport shape for Pending → Cancelled (Manual). */
export const cancelPendingManualPaymentBodySchema = z
  .object({
    reasonCode: z.enum(["abandoned", "wrong_amount", "superseded", "other"]),
    reasonNote: z.string().max(2000).optional(),
  })
  .strict();

export type CancelPendingManualPaymentBody = z.infer<
  typeof cancelPendingManualPaymentBodySchema
>;

/** PR23-E3 — request offline refund. */
export const requestRefundBodySchema = z
  .object({
    registrationId: uuidSchema,
    sourceKind: z.enum(["payment", "prepayment"]),
    paymentId: uuidSchema.optional(),
    amountMinor: z.string().min(1).max(64),
    reasonCode: z.enum(["member_withdrawal", "overpayment", "ops_correction", "other"]),
    reasonNote: z.string().max(2000).optional(),
    evidenceFileKey: z.string().max(512).optional(),
    evidenceNote: z.string().max(2000).optional(),
  })
  .strict();

export type RequestRefundBody = z.infer<typeof requestRefundBodySchema>;

export const rejectRefundBodySchema = z
  .object({
    rejectNote: z.string().max(2000).optional(),
  })
  .strict();

export type RejectRefundBody = z.infer<typeof rejectRefundBodySchema>;

export const completeRefundBodySchema = z
  .object({
    completionNote: z.string().max(2000).optional(),
  })
  .strict();

export type CompleteRefundBody = z.infer<typeof completeRefundBodySchema>;

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
    .join("; ");
}

export function parseCreateManualPaymentBody(raw: unknown): CreateManualPaymentBody {
  const result = createManualPaymentBodySchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`ZOD_VALIDATION_FAILED: ${formatZodError(result.error)}`);
  }
  return result.data;
}

export function parseSubmitReceiptBody(raw: unknown): SubmitReceiptBody {
  const result = submitReceiptBodySchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`ZOD_VALIDATION_FAILED: ${formatZodError(result.error)}`);
  }
  return result.data;
}

export function parseReviewReceiptBody(raw: unknown): ReviewReceiptBody {
  const result = reviewReceiptBodySchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`ZOD_VALIDATION_FAILED: ${formatZodError(result.error)}`);
  }
  return result.data;
}

export function parseCancelPendingManualPaymentBody(
  raw: unknown
): CancelPendingManualPaymentBody {
  const result = cancelPendingManualPaymentBodySchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`ZOD_VALIDATION_FAILED: ${formatZodError(result.error)}`);
  }
  return result.data;
}

export function parseRequestRefundBody(raw: unknown): RequestRefundBody {
  const result = requestRefundBodySchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`ZOD_VALIDATION_FAILED: ${formatZodError(result.error)}`);
  }
  return result.data;
}

export function parseRejectRefundBody(raw: unknown): RejectRefundBody {
  const result = rejectRefundBodySchema.safeParse(raw ?? {});
  if (!result.success) {
    throw new Error(`ZOD_VALIDATION_FAILED: ${formatZodError(result.error)}`);
  }
  return result.data;
}

export function parseCompleteRefundBody(raw: unknown): CompleteRefundBody {
  const result = completeRefundBodySchema.safeParse(raw ?? {});
  if (!result.success) {
    throw new Error(`ZOD_VALIDATION_FAILED: ${formatZodError(result.error)}`);
  }
  return result.data;
}

export function parseOptionalRefundStatus(
  raw: string | null
): "Requested" | "Approved" | "Completed" | "Rejected" | "Cancelled" | undefined {
  if (raw === null || raw.trim() === "") {
    return undefined;
  }
  const value = raw.trim();
  if (
    value === "Requested" ||
    value === "Approved" ||
    value === "Completed" ||
    value === "Rejected" ||
    value === "Cancelled"
  ) {
    return value;
  }
  throw new Error("ZOD_VALIDATION_FAILED: status invalid");
}

export function parseLedgerEventsLimit(raw: string | null): number {
  if (raw === null || raw.trim() === "") {
    return 50;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error("ZOD_VALIDATION_FAILED: limit must be an integer");
  }
  return Math.min(Math.max(parsed, 1), 200);
}

export function parseOpenPaymentsLimit(raw: string | null): number {
  if (raw === null || raw.trim() === "") {
    return 100;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error("ZOD_VALIDATION_FAILED: limit must be an integer");
  }
  return Math.min(Math.max(parsed, 1), 200);
}

/** Optional UUID filter for finance list endpoints (Phase B). Empty → undefined. */
export function parseOptionalRegistrationId(raw: string | null): string | undefined {
  if (raw === null || raw.trim() === "") {
    return undefined;
  }
  const result = uuidSchema.safeParse(raw.trim());
  if (!result.success) {
    throw new Error(`ZOD_VALIDATION_FAILED: registrationId: ${result.error.issues[0]?.message ?? "invalid"}`);
  }
  return result.data;
}

/** Optional UUID filter for tour-scoped finance lists (FC-3). Empty → undefined. */
export function parseOptionalTourId(raw: string | null): string | undefined {
  if (raw === null || raw.trim() === "") {
    return undefined;
  }
  const result = uuidSchema.safeParse(raw.trim());
  if (!result.success) {
    throw new Error(`ZOD_VALIDATION_FAILED: tourId: ${result.error.issues[0]?.message ?? "invalid"}`);
  }
  return result.data;
}

/** Host read-model scope for finance list endpoints (FC-3). */
export type FinanceListScope = {
  readonly registrationId?: string;
  readonly tourId?: string;
};

export function parseFinanceListScope(searchParams: {
  get(name: string): string | null;
}): FinanceListScope {
  return {
    registrationId: parseOptionalRegistrationId(searchParams.get("registrationId")),
    tourId: parseOptionalTourId(searchParams.get("tourId")),
  };
}

/** Opaque keyset cursor for finance list pagination (PR23-B2). Empty → undefined. */
export function parseOptionalListCursor(raw: string | null): string | undefined {
  if (raw === null || raw.trim() === "") {
    return undefined;
  }
  const trimmed = raw.trim();
  if (trimmed.length > 1024) {
    throw new Error("ZOD_VALIDATION_FAILED: cursor length exceeded");
  }
  return trimmed;
}

export const recordPrepaymentBodySchema = z
  .object({
    registrationId: uuidSchema,
    amountMinor: minorAmountSchema,
    currency: currencySchema,
    method: z.string().min(1).max(64),
    note: z.string().max(2000).optional(),
  })
  .strict();

export type RecordPrepaymentBody = z.infer<typeof recordPrepaymentBodySchema>;

export const generateScheduleBodySchema = z
  .object({
    registrationId: uuidSchema,
    template: z
      .object({
        depositPercent: z.number().min(0).max(100),
        installmentCount: z.number().int().min(1).max(24),
        graceDays: z.number().int().min(0).max(90).optional(),
        firstDueAt: z.string().datetime(),
        invoiceTotalMinor: minorAmountSchema,
        currency: currencySchema,
      })
      .strict(),
  })
  .strict();

export type GenerateScheduleBody = z.infer<typeof generateScheduleBodySchema>;

export const patchScheduleItemBodySchema = z
  .discriminatedUnion("action", [
    z
      .object({
        action: z.literal("waive"),
        reason: z.string().min(1).max(2000),
      })
      .strict(),
    z
      .object({
        action: z.literal("reschedule"),
        dueAt: z.string().datetime(),
      })
      .strict(),
  ]);

export type PatchScheduleItemBody = z.infer<typeof patchScheduleItemBodySchema>;

export function parseRecordPrepaymentBody(raw: unknown): RecordPrepaymentBody {
  const result = recordPrepaymentBodySchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`ZOD_VALIDATION_FAILED: ${formatZodError(result.error)}`);
  }
  return result.data;
}

export function parseGenerateScheduleBody(raw: unknown): GenerateScheduleBody {
  const result = generateScheduleBodySchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`ZOD_VALIDATION_FAILED: ${formatZodError(result.error)}`);
  }
  return result.data;
}

export function parsePatchScheduleItemBody(raw: unknown): PatchScheduleItemBody {
  const result = patchScheduleItemBodySchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`ZOD_VALIDATION_FAILED: ${formatZodError(result.error)}`);
  }
  return result.data;
}

export const setObligationOverrideBodySchema = z
  .object({
    obligationMinor: minorAmountSchema,
    reason: z.string().max(2000).optional(),
  })
  .strict();

export type SetObligationOverrideBody = z.infer<typeof setObligationOverrideBodySchema>;

export function parseSetObligationOverrideBody(raw: unknown): SetObligationOverrideBody {
  const result = setObligationOverrideBodySchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`ZOD_VALIDATION_FAILED: ${formatZodError(result.error)}`);
  }
  return result.data;
}
