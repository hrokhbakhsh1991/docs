/**
 * Wallet-owned HTTP request schemas — Phase 2D MVP.
 */
import { z } from "zod";

import {
  currencySchema,
  formatZodError,
  minorAmountSchema,
  parseWithZod,
  uuidSchema,
} from "./wallet-validation";

export const walletReferenceBodySchema = z
  .object({
    type: z.string().min(1).max(64),
    id: z.string().min(1).max(128),
  })
  .strict();

export type WalletReferenceBody = z.infer<typeof walletReferenceBodySchema>;

export const operatorCreditBodySchema = z
  .object({
    amountMinor: minorAmountSchema,
    currency: currencySchema,
    reference: walletReferenceBodySchema.optional(),
    reasonNote: z.string().max(2000).optional(),
  })
  .strict();

export type OperatorCreditBody = z.infer<typeof operatorCreditBodySchema>;

export const operatorDebitBodySchema = z
  .object({
    amountMinor: minorAmountSchema,
    currency: currencySchema,
    reference: walletReferenceBodySchema.optional(),
    reasonNote: z.string().max(2000).optional(),
  })
  .strict();

export type OperatorDebitBody = z.infer<typeof operatorDebitBodySchema>;

export const operatorReversalBodySchema = z
  .object({
    accountId: uuidSchema,
    reference: walletReferenceBodySchema.optional(),
    reasonNote: z.string().max(2000).optional(),
  })
  .strict();

export type OperatorReversalBody = z.infer<typeof operatorReversalBodySchema>;

export function parseOperatorCreditBody(raw: unknown): OperatorCreditBody {
  return parseWithZod(operatorCreditBodySchema, raw, "operatorCredit");
}

export function parseOperatorDebitBody(raw: unknown): OperatorDebitBody {
  return parseWithZod(operatorDebitBodySchema, raw, "operatorDebit");
}

export function parseOperatorReversalBody(raw: unknown): OperatorReversalBody {
  return parseWithZod(operatorReversalBodySchema, raw, "operatorReversal");
}

export function parseWalletTransactionsLimit(raw: string | null): number {
  if (raw === null || raw.trim() === "") {
    return 50;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error("ZOD_VALIDATION_FAILED: limit must be an integer");
  }
  return Math.min(Math.max(parsed, 1), 200);
}

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

export function parseOperatorAccountLookupUserId(raw: string | null): string {
  if (raw === null || raw.trim() === "") {
    throw new Error("ZOD_VALIDATION_FAILED: userId is required");
  }
  const result = uuidSchema.safeParse(raw.trim());
  if (!result.success) {
    throw new Error(
      `ZOD_VALIDATION_FAILED: userId: ${result.error.issues[0]?.message ?? "invalid"}`,
    );
  }
  return result.data;
}

export function parseOptionalCurrencyFilter(raw: string | null): string | undefined {
  if (raw === null || raw.trim() === "") {
    return undefined;
  }
  const result = currencySchema.safeParse(raw.trim());
  if (!result.success) {
    throw new Error(
      `ZOD_VALIDATION_FAILED: currency: ${formatZodError(result.error)}`,
    );
  }
  return result.data;
}

export function parseOptionalWorkspaceFilter(raw: string | null): string | undefined {
  if (raw === null || raw.trim() === "") {
    return undefined;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 128) {
    throw new Error("ZOD_VALIDATION_FAILED: workspaceId invalid");
  }
  return trimmed;
}
