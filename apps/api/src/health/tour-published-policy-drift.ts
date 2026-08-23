import { Prisma } from "@prisma/client";

import { getPrisma } from "../db/prisma";

import type { PersistedIntegrationEventPolicy } from "../integrations/platform/resolve-effective-integration-event-catalog";
import {
  listTourPublishedPolicyDriftCheckTargets,
  requiresTourPublishedPolicyDriftCheck,
} from "../integrations/platform/workspace-integration-capabilities.generated.ts";

export const TOUR_PUBLISHED_ROLLOUT_GATE_FATAL_ENV = "TOUR_PUBLISHED_ROLLOUT_GATE_FATAL" as const;

export function isTourPublishedRolloutGateFatalEnabled(
  value: string | null | undefined = process.env[TOUR_PUBLISHED_ROLLOUT_GATE_FATAL_ENV]
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
  if (!requiresTourPublishedPolicyDriftCheck(input.workspaceType, input.provider)) {
    return false;
  }
  if (!input.enabled || input.status !== "enabled") {
    return false;
  }
  return !input.persistedPolicies.some(
    (policy) => policy.eventType === "TourPublished" && policy.enabled
  );
}

export async function countTourPublishedPolicyDriftConnections(): Promise<number> {
  const targets = listTourPublishedPolicyDriftCheckTargets();
  if (targets.length === 0) {
    return 0;
  }
  const targetRows = Prisma.join(
    targets.map((target) => Prisma.sql`(${target.workspaceType}, ${target.providerId})`),
    ","
  );
  const rows = await getPrisma().$queryRaw<Array<{ drift_count: bigint }>>`
    WITH drift_targets(workspace_type, provider) AS (
      VALUES ${targetRows}
    )
    SELECT COUNT(*)::bigint AS drift_count
    FROM integration_connections ic
    INNER JOIN drift_targets dt
      ON dt.workspace_type = ic.workspace_type
     AND dt.provider = ic.provider
    WHERE ic.enabled = true
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
