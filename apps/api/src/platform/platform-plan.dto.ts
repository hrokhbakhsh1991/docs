import type { PlatformPlan } from "@prisma/client";

export type PlatformPlanDto = {
  readonly id: string;
  readonly displayName: string;
  readonly priceMonthly: number | null;
  readonly currency: string;
  readonly features: Record<string, unknown>;
};

export function toPlatformPlanDto(row: PlatformPlan): PlatformPlanDto {
  const features =
    typeof row.features === "object" && row.features !== null && !Array.isArray(row.features)
      ? (row.features as Record<string, unknown>)
      : {};
  return {
    id: row.id,
    displayName: row.displayName,
    priceMonthly: row.priceMonthly,
    currency: row.currency,
    features,
  };
}
