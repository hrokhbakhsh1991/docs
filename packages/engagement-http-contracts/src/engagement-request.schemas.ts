import { z } from "zod";

const uuidSchema = z.string().uuid();

export const operatorReversalBodySchema = z.object({
  originalEventId: uuidSchema,
  reason: z.string().trim().min(3).max(500),
});

export type OperatorReversalBody = z.infer<typeof operatorReversalBodySchema>;

export function parseOperatorReversalBody(body: unknown): OperatorReversalBody {
  return operatorReversalBodySchema.parse(body);
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
