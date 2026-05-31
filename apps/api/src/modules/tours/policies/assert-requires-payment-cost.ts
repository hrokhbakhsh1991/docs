import { BadRequestException } from "@nestjs/common";

import { DECIMAL_MAJOR_REGEX } from "@repo/shared-contracts";

import type { CostContextDto } from "../dto/cost-context.dto";
import { isPositiveDecimalString, listPriceMinorFromCostContext } from "../utils/commercial-fields";

export const PAID_TOUR_REQUIRES_AMOUNT = {
  error: {
    code: "PAID_TOUR_REQUIRES_AMOUNT",
    message:
      "Tours with requiresPayment must have totalCost (or list price) greater than zero before Open."
  }
} as const;

function costContextRecord(
  costContext: CostContextDto | Record<string, unknown> | null | undefined
): Record<string, unknown> | undefined {
  if (!costContext || typeof costContext !== "object") {
    return undefined;
  }
  return costContext as Record<string, unknown>;
}

function hasPositiveTotalCost(totalCost: unknown): boolean {
  if (typeof totalCost === "string" && DECIMAL_MAJOR_REGEX.test(totalCost.trim())) {
    return isPositiveDecimalString(totalCost.trim());
  }
  if (typeof totalCost === "number" && Number.isFinite(totalCost) && totalCost > 0) {
    return true;
  }
  return false;
}

export function assertRequiresPaymentHasPositiveAmount(input: {
  costContext?: CostContextDto | Record<string, unknown> | null;
  listPriceMinor?: string | null;
}): void {
  const ctx = costContextRecord(input.costContext);
  if (ctx?.requiresPayment !== true) {
    return;
  }

  const hasTotalCost = hasPositiveTotalCost(ctx.totalCost);
  const minor = input.listPriceMinor ?? listPriceMinorFromCostContext(ctx);
  const hasListPrice =
    minor != null && minor !== "" && minor !== "0" && Number(minor) > 0;

  if (hasTotalCost || hasListPrice) {
    return;
  }

  throw new BadRequestException(PAID_TOUR_REQUIRES_AMOUNT);
}
