import { BadRequestException } from "@nestjs/common";

import type { CostContextDto } from "../dto/cost-context.dto";
import { listPriceMinorFromCostContext } from "../utils/commercial-fields";

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

export function assertRequiresPaymentHasPositiveAmount(input: {
  costContext?: CostContextDto | Record<string, unknown> | null;
  listPriceMinor?: string | null;
}): void {
  const ctx = costContextRecord(input.costContext);
  if (ctx?.requiresPayment !== true) {
    return;
  }

  const totalCost = ctx.totalCost;
  const hasTotalCost =
    typeof totalCost === "number" && Number.isFinite(totalCost) && totalCost > 0;
  const minor = input.listPriceMinor ?? listPriceMinorFromCostContext(ctx);
  const hasListPrice =
    minor != null && minor !== "" && minor !== "0" && Number(minor) > 0;

  if (hasTotalCost || hasListPrice) {
    return;
  }

  throw new BadRequestException(PAID_TOUR_REQUIRES_AMOUNT);
}
