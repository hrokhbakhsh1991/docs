import type { PlatformPlan, TenantSubscription } from "@prisma/client";

export type TenantSubscriptionDto = {
  readonly planId: string;
  readonly planDisplayName: string;
  readonly status: "active" | "past_due" | "canceled";
  readonly currentPeriodEnd: string | null;
};

export function toTenantSubscriptionDto(
  sub: TenantSubscription,
  plan: PlatformPlan
): TenantSubscriptionDto {
  return {
    planId: sub.planId,
    planDisplayName: plan.displayName,
    status: sub.status as TenantSubscriptionDto["status"],
    currentPeriodEnd: sub.currentPeriodEnd ? sub.currentPeriodEnd.toISOString() : null,
  };
}
