import type { IntegrationCapability } from "../platform/integration-capability";
import type { IntegrationProviderId } from "../platform/integration-provider.types";

export type IntegrationEventPolicyRecord = {
  readonly id: string;
  readonly tenantId: string;
  readonly integrationConnectionId: string;
  readonly eventType: string;
  readonly enabled: boolean;
};

export type IntegrationPolicyTarget = {
  readonly connectionId: string;
  readonly tenantId: string;
  readonly provider: IntegrationProviderId;
  readonly workspaceType: string | null;
  readonly capabilities: readonly IntegrationCapability[];
  readonly config: Record<string, unknown>;
  readonly secretRef: string | null;
  readonly credentials: Record<string, unknown>;
};

export type IntegrationPolicyRepository = {
  listEnabledConnectionsForScope(input: {
    readonly tenantId: string;
    readonly workspaceType: string | null;
  }): Promise<readonly IntegrationPolicyTarget[]>;
  listPoliciesForConnection(input: {
    readonly tenantId: string;
    readonly integrationConnectionId: string;
  }): Promise<readonly IntegrationEventPolicyRecord[]>;
  isEventEnabledForConnection(input: {
    readonly tenantId: string;
    readonly integrationConnectionId: string;
    readonly eventType: string;
  }): Promise<boolean>;
};
