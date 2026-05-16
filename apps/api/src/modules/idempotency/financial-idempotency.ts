import { BadRequestException } from "@nestjs/common";
import { getIdempotentEntityManager } from "./idempotent-transaction.context";

/**
 * Validates a non-blank idempotency key for financial mutations (header or body-supplied).
 */
export function assertFinancialIdempotencyKey(
  key: string | undefined | null,
  fieldLabel = "Idempotency-Key"
): string {
  const t = typeof key === "string" ? key.trim() : "";
  if (t.length === 0) {
    throw new BadRequestException({
      error: {
        code: "VALIDATION_REQUIRED_FIELD_MISSING",
        message: `${fieldLabel} is required for this financial mutation`
      }
    });
  }
  return t;
}

/**
 * Ensures the call runs inside {@link runWithIdempotentEntityManager} (HTTP Idempotency-Key flow
 * or manual `executeWithIdempotency` + ALS wiring) so duplicate requests replay the same outcome.
 */
export function assertFinancialMutationRunsInIdempotentScope(operation: string): void {
  if (!getIdempotentEntityManager()) {
    throw new BadRequestException({
      error: {
        code: "FINANCIAL_IDEMPOTENCY_CONTEXT_REQUIRED",
        message: `${operation} must run with a valid Idempotency-Key so duplicate requests return the same result.`
      }
    });
  }
}
