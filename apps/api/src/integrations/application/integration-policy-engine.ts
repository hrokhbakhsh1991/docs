import { integrationMappingsForEvent } from "../platform/integration-event-mapping";
import { isDefaultIntegrationEventEnabled } from "../platform/resolve-integration-surface";
import type { IntegrationCapability } from "../platform/integration-capability";
import type { IntegrationProviderId } from "../platform/integration-provider.types";
import type { ExposureIntent } from "../../exposure/exposure-intent";
import type { FieldExposureRuntimeCoordinate } from "../../exposure/resolve-runtime-truth-source";
import { resolveConnectionExposureIntentForRoute } from "../../exposure/connection-exposure-intent-scope";
import {
  resolveDeliveryExposureProfileContext,
  resolveRegistrySeededExposureProfile,
} from "../../exposure/resolve-registry-seeded-exposure-profile";
import type { ExposureIntentRepository } from "../../exposure/exposure-intent.repository";
import { createExposureIntentRepository } from "../../exposure/prisma-exposure-intent.repository";
import type { IntegrationPolicyRepository } from "../infrastructure/integration-policy.repository";
import { createIntegrationPolicyRepository } from "../infrastructure/prisma-integration-policy.repository";

export type IntegrationPolicyDecision = {
  readonly connectionId: string;
  readonly tenantId: string;
  readonly provider: IntegrationProviderId;
  readonly capability: IntegrationCapability;
  readonly workspaceType: string | null;
  /** Effective exposure coordinate used by native intent/profile lookup for this route. */
  readonly exposureCoordinate: FieldExposureRuntimeCoordinate;
  /** Native exposure intent — single authoritative field-selection source (Phase 7i). */
  readonly exposureIntent: ExposureIntent | null;
};

type ConnectionEventResolution = {
  readonly allowed: boolean;
  readonly exposureCoordinate: FieldExposureRuntimeCoordinate;
  readonly exposureIntent: ExposureIntent | null;
};

export type IntegrationPolicyEngineDeps = {
  readonly policyRepository?: IntegrationPolicyRepository;
  readonly exposureIntentRepository?: ExposureIntentRepository;
};

/**
 * Data-driven routing: enabled connection + event policy + native exposure intent + capability mapping.
 */
export class IntegrationPolicyEngine {
  constructor(private readonly deps: IntegrationPolicyEngineDeps = {}) {}

  private repository(): IntegrationPolicyRepository {
    return this.deps.policyRepository ?? createIntegrationPolicyRepository();
  }

  private exposureRepository(): ExposureIntentRepository {
    return this.deps.exposureIntentRepository ?? createExposureIntentRepository();
  }

  async evaluate(input: {
    readonly tenantId: string;
    readonly eventType: string;
    readonly workspaceType: string | null;
  }): Promise<readonly IntegrationPolicyDecision[]> {
    const repository = this.repository();
    const exposureIntentRepository = this.exposureRepository();
    const mappings = await integrationMappingsForEvent(input.eventType, input.workspaceType);
    if (mappings.length === 0) {
      return [];
    }

    const connections = await repository.listEnabledConnectionsForScope({
      tenantId: input.tenantId,
      workspaceType: input.workspaceType,
    });

    const decisions: IntegrationPolicyDecision[] = [];

    for (const connection of connections) {
      const resolution = await this.resolveEventForConnection(
        repository,
        exposureIntentRepository,
        input.tenantId,
        connection,
        input.eventType,
      );
      if (!resolution.allowed) {
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
            exposureCoordinate: resolution.exposureCoordinate,
            exposureIntent: resolution.exposureIntent,
          });
        }
      }
    }

    return decisions;
  }

  private async resolveEventForConnection(
    repository: IntegrationPolicyRepository,
    exposureIntentRepository: ExposureIntentRepository,
    tenantId: string,
    connection: {
      readonly connectionId: string;
      readonly provider: IntegrationProviderId;
      readonly workspaceType: string | null;
      readonly syntheticLegacyConnection?: boolean;
    },
    eventType: string,
  ): Promise<ConnectionEventResolution> {
    const exposureCoordinate = resolveIntegrationPolicyExposureCoordinate({
      eventType,
      provider: connection.provider,
    });

    if (connection.syntheticLegacyConnection === true) {
      return {
        allowed: await isDefaultIntegrationEventEnabled({
          workspaceType: connection.workspaceType,
          providerId: connection.provider,
          eventType,
        }),
        exposureCoordinate,
        exposureIntent: null,
      };
    }

    const policies = await repository.listPoliciesForConnection({
      tenantId,
      integrationConnectionId: connection.connectionId,
    });
    const exposureResolution = await this.findExposureIntentForConnectionEvent(
      exposureIntentRepository,
      {
        tenantId,
        connectionId: connection.connectionId,
        eventType,
        exposureCoordinate,
        workspaceType: connection.workspaceType,
      },
    );

    if (policies.length === 0) {
      return {
        allowed: await isDefaultIntegrationEventEnabled({
          workspaceType: connection.workspaceType,
          providerId: connection.provider,
          eventType,
        }),
        exposureCoordinate: exposureResolution.exposureCoordinate,
        exposureIntent: exposureResolution.exposureIntent,
      };
    }
    const match = policies.find((policy) => policy.eventType === eventType);
    return {
      allowed: match?.enabled === true,
      exposureCoordinate: exposureResolution.exposureCoordinate,
      exposureIntent: exposureResolution.exposureIntent,
    };
  }

  private async findExposureIntentForConnectionEvent(
    exposureIntentRepository: ExposureIntentRepository,
    input: {
      readonly tenantId: string;
      readonly connectionId: string;
      readonly eventType: string;
      readonly exposureCoordinate: FieldExposureRuntimeCoordinate;
      readonly workspaceType: string | null;
    },
  ): Promise<{
    readonly exposureIntent: ExposureIntent | null;
    readonly exposureCoordinate: FieldExposureRuntimeCoordinate;
  }> {
    const profile = await resolveRegistrySeededExposureProfile({
      workspaceType: input.workspaceType,
      entityType: "tour",
      surface: input.exposureCoordinate.surface,
      audience: input.exposureCoordinate.audience,
      trigger: input.exposureCoordinate.trigger,
    });
    const resolution = await resolveConnectionExposureIntentForRoute(exposureIntentRepository, {
      tenantId: input.tenantId,
      connectionId: input.connectionId,
      eventType: input.eventType,
      defaultCoordinate: input.exposureCoordinate,
      ...(profile === null ? {} : { legacyProfileId: profile.id }),
    });
    return {
      exposureIntent: resolution.exposureIntent,
      exposureCoordinate: resolution.effectiveContext,
    };
  }
}

export function resolveIntegrationPolicyExposureCoordinate(input: {
  readonly eventType: string;
  readonly provider: string;
}): FieldExposureRuntimeCoordinate {
  const context = resolveDeliveryExposureProfileContext(input.eventType);

  return {
    surface: input.provider,
    audience: context.audience ?? "external_channel",
    trigger: context.trigger ?? input.eventType,
  };
}

export function createIntegrationPolicyEngine(
  deps: IntegrationPolicyEngineDeps = {},
): IntegrationPolicyEngine {
  return new IntegrationPolicyEngine(deps);
}
