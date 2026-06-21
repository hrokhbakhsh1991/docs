import type { Prisma } from "@prisma/client";

import { PlatformSubscriptionRepository } from "./platform-subscription.repository.ts";

export async function createTenantSubscriptionOnProvision(
  tx: Prisma.TransactionClient,
  tenantId: string
): Promise<void> {
  await new PlatformSubscriptionRepository().createForTenant(tx, { tenantId });
}
