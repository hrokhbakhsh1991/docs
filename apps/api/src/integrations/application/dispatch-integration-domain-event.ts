import { resolveWorkspaceTypeForTenant } from "../../tenant/resolve-workspace-type";
import type { WorkspaceOutboxPublishedRow } from "../../workspace/workspace-outbox-row-context";
import { createIntegrationDeliveryRepository } from "../infrastructure/prisma-integration-delivery.repository";
import {
  createIntegrationPolicyEngine,
  type IntegrationPolicyEngine,
} from "./integration-policy-engine";
import { enqueueIntegrationDeliveryJob } from "./enqueue-integration-delivery-job";

export function isIntegrationDeliveryDispatcherEnabled(): boolean {
  return process.env.INTEGRATION_DELIVERY_ENABLED?.trim().toLowerCase() === "true";
}

export type DispatchIntegrationDomainEventDeps = {
  readonly policyEngine?: IntegrationPolicyEngine;
  readonly deliveryRepository?: ReturnType<typeof createIntegrationDeliveryRepository>;
  readonly resolveWorkspaceType?: typeof resolveWorkspaceTypeForTenant;
};

/**
 * Maps a published domain event to integration delivery jobs via IntegrationPolicyEngine.
 * Called from outbox relay AFTER workspace side effects — never performs provider HTTP.
 */
export async function dispatchIntegrationDomainEvent(
  row: WorkspaceOutboxPublishedRow,
  deps: DispatchIntegrationDomainEventDeps = {}
): Promise<number> {
  if (!isIntegrationDeliveryDispatcherEnabled()) {
    return 0;
  }

  if (!row.domainEventId.trim()) {
    return 0;
  }

  const policyEngine = deps.policyEngine ?? createIntegrationPolicyEngine();
  const deliveryRepository = deps.deliveryRepository ?? createIntegrationDeliveryRepository();
  const resolveWorkspaceType = deps.resolveWorkspaceType ?? resolveWorkspaceTypeForTenant;

  const workspaceType = await resolveWorkspaceType(row.tenantId);
  const payload =
    typeof row.payload === "object" && row.payload !== null
      ? (row.payload as Record<string, unknown>)
      : {};

  const decisions = await policyEngine.evaluate({
    tenantId: row.tenantId,
    eventType: row.eventType,
    workspaceType,
  });

  let enqueued = 0;

  for (const decision of decisions) {
    const inserted = await enqueueIntegrationDeliveryJob(deliveryRepository, {
      tenantId: row.tenantId,
      provider: decision.provider,
      capability: decision.capability,
      domainEventId: row.domainEventId,
      eventType: row.eventType,
      payload: {
        ...payload,
        tenantId: row.tenantId,
        aggregateId: row.aggregateId,
        aggregateType: row.aggregateType,
        workspaceType,
        integrationConnectionId: decision.connectionId,
      },
    });
    if (inserted) {
      enqueued += 1;
    }
  }

  return enqueued;
}
