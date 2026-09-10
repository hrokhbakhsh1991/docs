import type { EngagementServicePort } from "@app-tour/engagement-http";

import { createEngagementService, type EngagementService } from "../workspace-engagement/engagement.service";
import { assertEngagementWorkspaceGate } from "../workspace-engagement/engagement-module-enabled";

let engagementServiceSingleton: EngagementService | null = null;

export function resetLazyEngagementServiceForTests(): void {
  engagementServiceSingleton = null;
}

export function resolveEngagementService(
  injected?: EngagementServicePort,
): EngagementServicePort {
  if (injected !== undefined) {
    return injected;
  }
  if (engagementServiceSingleton === null) {
    engagementServiceSingleton = createEngagementService();
  }
  return engagementServiceSingleton;
}

export async function resolveEngagementServiceForTenant(
  tenantId: string,
  injected?: EngagementServicePort,
): Promise<EngagementServicePort> {
  if (injected !== undefined) {
    return injected;
  }
  await assertEngagementWorkspaceGate(tenantId);
  return resolveEngagementService();
}
