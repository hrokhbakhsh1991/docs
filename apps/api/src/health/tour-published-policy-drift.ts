import { getPrisma } from "../db/prisma";

import type { PersistedIntegrationEventPolicy } from "../integrations/platform/resolve-effective-integration-event-catalog";

export const TOUR_PUBLISHED_ROLLOUT_GATE_FATAL_ENV =
  "TOUR_PUBLISHED_ROLLOUT_GATE_FATAL" as const;

export function isTourPublishedRolloutGateFatalEnabled(
  value: string | null | undefined = process.env[TOUR_PUBLISHED_ROLLOUT_GATE_FATAL_ENV],
): boolean {
  return value?.trim().toLowerCase() === "true";
}

export function shouldWarnTourPublishedPolicyDrift(input: {
  readonly workspaceType: string | null;
  readonly provider: string;
  readonly enabled: boolean;
  readonly status: string;
  readonly persistedPolicies: readonly PersistedIntegrationEventPolicy[];
}): boolean {
  if (input.workspaceType !== "denali" || input.provider !== "telegram") {
    return false;
  }
  if (!input.enabled || input.status !== "enabled") {
    return false;
  }
  return !input.persistedPolicies.some(
    (policy) => policy.eventType === "TourPublished" && policy.enabled,
  );
}

export async function countTourPublishedPolicyDriftConnections(): Promise<number> {
  const rows = await getPrisma().$queryRaw<Array<{ drift_count: bigint }>>`
    SELECT COUNT(*)::bigint AS drift_count
    FROM integration_connections ic
    WHERE ic.provider = 'telegram'
      AND ic.workspace_type = 'denali'
      AND ic.enabled = true
      AND ic.status = 'enabled'
      AND NOT EXISTS (
        SELECT 1
        FROM integration_event_policies ep
        WHERE ep.integration_connection_id = ic.id
          AND ep.event_type = 'TourPublished'
          AND ep.enabled = true
      )
  `;
  return Number(rows[0]?.drift_count ?? 0n);
}
