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
