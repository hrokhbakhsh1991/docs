import { BadRequestException } from "@nestjs/common";
import { ZodError } from "zod";

import { toFinanceContract } from "../finance/finance.adapter";

/**
 * Strict enforcement — {@link PaymentIntentSchema} must pass before any payment intent write
 * (create, webhook/status transition, refund, timeout).
 */
export function enforcePaymentIntentFinanceContract(payload: unknown, operation: string): void {
  try {
    toFinanceContract(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestException({
        error: {
          code: "FINANCE_CONTRACT_VALIDATION_FAILED",
          message: `Payment intent failed finance contract validation (${operation})`,
          details: error.issues,
        },
      });
    }
    throw error;
  }
}
