import type { IntegrationConnectionRecord } from "../platform/integration-connection.types";
import type { IntegrationProviderId } from "../platform/integration-provider.types";

export type IntegrationConnectionRepository = {
  findEnabledForTenant(input: {
    readonly tenantId: string;
    readonly provider: IntegrationProviderId;
    readonly workspaceType: string | null;
  }): Promise<IntegrationConnectionRecord | null>;
  findByTenantAndId(tenantId: string, connectionId: string): Promise<IntegrationConnectionRecord | null>;
  listForWorkspace(input: {
    readonly tenantId: string;
    readonly workspaceType: string | null;
  }): Promise<readonly IntegrationConnectionRecord[]>;
};
