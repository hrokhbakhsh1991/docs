import { PlatformFeatureForbidden } from "./platform.errors.ts";
import { PlatformPlanRepository } from "./platform-plan.repository.ts";
import { PlatformSubscriptionRepository } from "./platform-subscription.repository.ts";

function featureEnabled(features: unknown, featureKey: string): boolean {
  if (typeof features !== "object" || features === null || Array.isArray(features)) {
    return false;
  }
  return (features as Record<string, unknown>)[featureKey] === true;
}

export async function assertTenantPlatformFeature(
  tenantId: string,
  featureKey: string,
  deps: {
    subscriptionRepository?: PlatformSubscriptionRepository;
    planRepository?: PlatformPlanRepository;
  } = {}
): Promise<void> {
  const subscriptionRepository = deps.subscriptionRepository ?? new PlatformSubscriptionRepository();
  const planRepository = deps.planRepository ?? new PlatformPlanRepository();

  const sub = await subscriptionRepository.getByTenantId(tenantId);
  const features = sub
    ? sub.plan.features
    : (await planRepository.getById("standard"))?.features;

  if (features === undefined) {
    throw new Error("PLATFORM_PLANS_NOT_SEEDED");
  }

  if (!featureEnabled(features, featureKey)) {
    throw new PlatformFeatureForbidden();
  }
}
