import { Prisma } from "@prisma/client";

import { withTenantRls } from "../../db/with-tenant-rls";
import type { IntegrationCapability } from "../platform/integration-capability";
import { isIntegrationCapability } from "../platform/integration-capability";
import type { IntegrationProviderId } from "../platform/integration-provider.types";
import { defaultIntegrationEventTypesForProvider } from "../platform/resolve-integration-surface";
import type {
  IntegrationEventPolicyRecord,
  IntegrationPolicyRepository,
  IntegrationPolicyTarget,
} from "./integration-policy.repository";
import {
  INTEGRATION_CONNECTION_LIST_SELECT,
  INTEGRATION_EVENT_POLICY_LIST_SELECT,
  MAX_INTEGRATION_CONNECTIONS_PER_WORKSPACE,
  MAX_INTEGRATION_EVENT_POLICIES_PER_CONNECTION,
} from "./integration-list-projection";
import { resolveLegacyTelegramConnection } from "./resolve-legacy-telegram-connection";

function parseCapabilities(raw: unknown): IntegrationCapability[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(
    (entry): entry is IntegrationCapability =>
      typeof entry === "string" && isIntegrationCapability(entry)
  );
}

function mapConnectionRow(row: {
  id: string;
  tenantId: string;
  workspaceType: string | null;
  provider: string;
  capabilities: Prisma.JsonValue;
  config: Prisma.JsonValue;
  credentials: Prisma.JsonValue;
  secretRef: string | null;
}): IntegrationPolicyTarget {
  return {
    connectionId: row.id,
    tenantId: row.tenantId,
    provider: row.provider as IntegrationProviderId,
    workspaceType: row.workspaceType,
    capabilities: parseCapabilities(row.capabilities),
    config:
      typeof row.config === "object" && row.config !== null
        ? (row.config as Record<string, unknown>)
        : {},
    credentials:
      typeof row.credentials === "object" && row.credentials !== null
        ? (row.credentials as Record<string, unknown>)
        : {},
    secretRef: row.secretRef,
  };
}

function mapEventPolicyRow(row: {
  id: string;
  tenantId: string;
  integrationConnectionId: string;
  eventType: string;
  enabled: boolean;
}): IntegrationEventPolicyRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    integrationConnectionId: row.integrationConnectionId,
    eventType: row.eventType,
    enabled: row.enabled,
  };
}

function mapPolicyListRow(
  row: Prisma.IntegrationConnectionGetPayload<{ select: typeof INTEGRATION_CONNECTION_LIST_SELECT }>
): IntegrationPolicyTarget {
  return mapConnectionRow({ ...row, credentials: {} });
}

export class PrismaIntegrationPolicyRepository implements IntegrationPolicyRepository {
  async listEnabledConnectionsForScope(input: {
    readonly tenantId: string;
    readonly workspaceType: string | null;
  }): Promise<readonly IntegrationPolicyTarget[]> {
    const fromDb = await withTenantRls(input.tenantId, async (tx) => {
      const rows = await tx.integrationConnection.findMany({
        where: {
          tenantId: input.tenantId,
          enabled: true,
          status: "enabled",
          OR: [
            { workspaceType: input.workspaceType },
            ...(input.workspaceType !== null ? [{ workspaceType: null }] : []),
          ],
        },
        select: INTEGRATION_CONNECTION_LIST_SELECT,
        take: MAX_INTEGRATION_CONNECTIONS_PER_WORKSPACE,
      });
      return rows.map(mapPolicyListRow);
    });

    if (fromDb.length > 0) {
      return fromDb;
    }

    const legacy = await resolveLegacyTelegramConnection(input.tenantId, input.workspaceType);
    return legacy === null ? [] : [legacy];
  }

  async listPoliciesForConnection(input: {
    readonly tenantId: string;
    readonly integrationConnectionId: string;
  }): Promise<readonly IntegrationEventPolicyRecord[]> {
    return withTenantRls(input.tenantId, async (tx) => {
      const rows = await tx.integrationEventPolicy.findMany({
        where: {
          tenantId: input.tenantId,
          integrationConnectionId: input.integrationConnectionId,
        },
        select: INTEGRATION_EVENT_POLICY_LIST_SELECT,
        take: MAX_INTEGRATION_EVENT_POLICIES_PER_CONNECTION,
      });
      return rows.map(mapEventPolicyRow);
    });
  }

  async isEventEnabledForConnection(input: {
    readonly tenantId: string;
    readonly integrationConnectionId: string;
    readonly eventType: string;
  }): Promise<boolean> {
    return withTenantRls(input.tenantId, async (tx) => {
      const row = await tx.integrationEventPolicy.findUnique({
        where: {
          integrationConnectionId_eventType: {
            integrationConnectionId: input.integrationConnectionId,
            eventType: input.eventType,
          },
        },
      });
      if (row === null) {
        return false;
      }
      return row.enabled;
    });
  }

  async updateEventPolicy(
    input: import("./integration-policy.repository").UpdateIntegrationEventPolicyInput
  ): Promise<IntegrationEventPolicyRecord> {
    return withTenantRls(input.tenantId, async (tx) => {
      const row = await tx.integrationEventPolicy.upsert({
        where: {
          integrationConnectionId_eventType: {
            integrationConnectionId: input.integrationConnectionId,
            eventType: input.eventType,
          },
        },
        create: {
          tenantId: input.tenantId,
          integrationConnectionId: input.integrationConnectionId,
          eventType: input.eventType,
          enabled: input.enabled ?? true,
        },
        update: {
          ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
        },
      });
      return mapEventPolicyRow(row);
    });
  }
}

export function createIntegrationPolicyRepository(): IntegrationPolicyRepository {
  return new PrismaIntegrationPolicyRepository();
}

export async function seedDefaultEventPoliciesForConnection(input: {
  readonly tenantId: string;
  readonly integrationConnectionId: string;
  readonly provider: IntegrationProviderId;
  readonly workspaceType: string | null;
}): Promise<void> {
  await withTenantRls(input.tenantId, async (tx) => {
    await seedDefaultEventPoliciesForConnectionInTransaction(tx, input);
  });
}

export async function seedDefaultEventPoliciesForConnectionInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    readonly tenantId: string;
    readonly integrationConnectionId: string;
    readonly provider: IntegrationProviderId;
    readonly workspaceType: string | null;
  }
): Promise<void> {
  const defaults = await defaultIntegrationEventTypesForProvider({
    workspaceType: input.workspaceType,
    providerId: input.provider,
  });

  if (defaults.length === 0) {
    return;
  }

  for (const eventType of defaults) {
    await tx.integrationEventPolicy.upsert({
      where: {
        integrationConnectionId_eventType: {
          integrationConnectionId: input.integrationConnectionId,
          eventType,
        },
      },
      create: {
        tenantId: input.tenantId,
        integrationConnectionId: input.integrationConnectionId,
        eventType,
        enabled: true,
      },
      update: {},
    });
  }
}
