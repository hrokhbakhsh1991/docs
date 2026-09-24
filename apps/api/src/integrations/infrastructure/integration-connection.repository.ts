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
  /**
   * Persists a Telegram forum topic's threadId (create-if-missing / recreate
   * when Telegram reports the stored one is stale). The topic name is only
   * written the first time a key is seen — once stored, a topic's name must
   * never be overwritten by this path.
   */
  upsertTelegramTopicThreadId(input: {
    readonly tenantId: string;
    readonly connectionId: string;
    readonly topicKey: string;
    readonly topicName: string;
    readonly threadId: number;
  }): Promise<void>;
};
