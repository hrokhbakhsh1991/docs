import { integrationMappingsForEvent } from "../platform/integration-event-mapping";
import { isDefaultIntegrationEventEnabled } from "../platform/resolve-integration-surface";
import type { IntegrationCapability } from "../platform/integration-capability";
import type { IntegrationProviderId } from "../platform/integration-provider.types";
import type { IntegrationPolicyRepository } from "../infrastructure/integration-policy.repository";
import { createIntegrationPolicyRepository } from "../infrastructure/prisma-integration-policy.repository";

export type IntegrationPolicyDecision = {
  readonly connectionId: string;
  readonly tenantId: string;
  readonly provider: IntegrationProviderId;
  readonly capability: IntegrationCapability;
  readonly workspaceType: string | null;
};

export type IntegrationPolicyEngineDeps = {
  readonly policyRepository?: IntegrationPolicyRepository;
};

/**
 * Data-driven routing: enabled connection + event policy + capability mapping.
 */
export class IntegrationPolicyEngine {
  constructor(private readonly deps: IntegrationPolicyEngineDeps = {}) {}

  private repository(): IntegrationPolicyRepository {
    return this.deps.policyRepository ?? createIntegrationPolicyRepository();
  }

  async evaluate(input: {
    readonly tenantId: string;
    readonly eventType: string;
    readonly workspaceType: string | null;
  }): Promise<readonly IntegrationPolicyDecision[]> {
    const repository = this.repository();
    const mappings = integrationMappingsForEvent(input.eventType, input.workspaceType);
    if (mappings.length === 0) {
      return [];
    }

    const connections = await repository.listEnabledConnectionsForScope({
      tenantId: input.tenantId,
      workspaceType: input.workspaceType,
    });

    const decisions: IntegrationPolicyDecision[] = [];

    for (const connection of connections) {
      const eventAllowed = await this.isEventAllowedForConnection(
        repository,
        input.tenantId,
        connection.connectionId,
        input.eventType,
        connection.provider,
        input.workspaceType
      );
      if (!eventAllowed) {
        continue;
      }

      for (const mapping of mappings) {
        if (mapping.providers.includes(connection.provider)) {
          if (!connection.capabilities.includes(mapping.capability)) {
            continue;
          }
          decisions.push({
            connectionId: connection.connectionId,
            tenantId: connection.tenantId,
            provider: connection.provider,
            capability: mapping.capability,
            workspaceType: connection.workspaceType,
          });
        }
      }
    }

    return decisions;
  }

  private async isEventAllowedForConnection(
    repository: IntegrationPolicyRepository,
    tenantId: string,
    connectionId: string,
    eventType: string,
    provider: IntegrationProviderId,
    workspaceType: string | null
  ): Promise<boolean> {
    if (connectionId.startsWith("legacy-telegram:")) {
      return isDefaultIntegrationEventEnabled({
        workspaceType,
        providerId: provider,
        eventType,
      });
    }

    const policies = await repository.listPoliciesForConnection({
      tenantId,
      integrationConnectionId: connectionId,
    });
    if (policies.length === 0) {
      return isDefaultIntegrationEventEnabled({
        workspaceType,
        providerId: provider,
        eventType,
      });
    }
    const match = policies.find((policy) => policy.eventType === eventType);
    return match?.enabled === true;
  }
}

export function createIntegrationPolicyEngine(
  deps: IntegrationPolicyEngineDeps = {}
): IntegrationPolicyEngine {
  return new IntegrationPolicyEngine(deps);
}
