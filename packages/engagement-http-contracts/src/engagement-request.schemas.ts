import { z } from "zod";

const uuidSchema = z.string().uuid();

export const operatorReversalBodySchema = z.object({
  originalEventId: uuidSchema,
  reason: z.string().trim().min(3).max(500),
});

export const operatorAdjustmentBodySchema = z.object({
  pointsDelta: z
    .number()
    .int()
    .refine((value) => value !== 0, { message: "pointsDelta must be non-zero" })
    .refine((value) => Math.abs(value) <= 500, { message: "pointsDelta out of range" }),
  reason: z.string().trim().min(3).max(500),
  sourceEntityId: uuidSchema.optional(),
});

export type OperatorReversalBody = z.infer<typeof operatorReversalBodySchema>;
export type OperatorAdjustmentBody = z.infer<typeof operatorAdjustmentBodySchema>;

export function parseOperatorReversalBody(body: unknown): OperatorReversalBody {
  return operatorReversalBodySchema.parse(body);
}

export function parseOperatorAdjustmentBody(body: unknown): OperatorAdjustmentBody {
  return operatorAdjustmentBodySchema.parse(body);
}

export function parseEngagementListLimit(value: string | null): number {
  if (value === null || value.trim().length === 0) {
    return 20;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 20;
  }
  return Math.min(parsed, 100);
}

export function parseOptionalListCursor(value: string | null): string | undefined {
  if (value === null) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
