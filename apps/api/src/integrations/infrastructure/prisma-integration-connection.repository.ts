import { Prisma } from "@prisma/client";

import { withTenantRls } from "../../db/with-tenant-rls";
import type { IntegrationCapability } from "../platform/integration-capability";
import { isIntegrationCapability } from "../platform/integration-capability";
import type { IntegrationConnectionRecord } from "../platform/integration-connection.types";
import type { IntegrationProviderId } from "../platform/integration-provider.types";
import type { IntegrationConnectionRepository } from "./integration-connection.repository";
import { resolveLegacyTelegramConnectionRecord } from "./resolve-legacy-telegram-connection";

function parseCapabilities(raw: unknown): IntegrationCapability[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(
    (entry): entry is IntegrationCapability =>
      typeof entry === "string" && isIntegrationCapability(entry)
  );
}

function mapRow(row: {
  id: string;
  tenantId: string;
  workspaceType: string | null;
  provider: string;
  status: string;
  enabled: boolean;
  capabilities: Prisma.JsonValue;
  config: Prisma.JsonValue;
  credentials: Prisma.JsonValue;
  secretRef: string | null;
}): IntegrationConnectionRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    workspaceType: row.workspaceType,
    provider: row.provider as IntegrationProviderId,
    status: row.status as IntegrationConnectionRecord["status"],
    enabled: row.enabled,
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

export class PrismaIntegrationConnectionRepository implements IntegrationConnectionRepository {
  async findEnabledForTenant(input: {
    readonly tenantId: string;
    readonly provider: IntegrationProviderId;
    readonly workspaceType: string | null;
  }): Promise<IntegrationConnectionRecord | null> {
    const row = await withTenantRls(input.tenantId, async (tx) => {
      const scoped = await tx.integrationConnection.findFirst({
        where: {
          tenantId: input.tenantId,
          provider: input.provider,
          workspaceType: input.workspaceType,
          enabled: true,
          status: "enabled",
        },
      });
      if (scoped !== null) {
        return scoped;
      }
      if (input.workspaceType === null) {
        return null;
      }
      return tx.integrationConnection.findFirst({
        where: {
          tenantId: input.tenantId,
          provider: input.provider,
          workspaceType: null,
          enabled: true,
          status: "enabled",
        },
      });
    });

    if (row !== null) {
      return mapRow(row);
    }

    if (input.provider !== "telegram") {
      return null;
    }
    const legacy = await resolveLegacyTelegramConnectionRecord(input.tenantId, input.workspaceType);
    return legacy;
  }

  async findById(
    tenantId: string,
    connectionId: string
  ): Promise<IntegrationConnectionRecord | null> {
    return withTenantRls(tenantId, async (tx) => {
      const row = await tx.integrationConnection.findFirst({
        where: { id: connectionId, tenantId },
      });
      return row === null ? null : mapRow(row);
    });
  }

  async listForWorkspace(input: {
    readonly tenantId: string;
    readonly workspaceType: string | null;
  }): Promise<readonly IntegrationConnectionRecord[]> {
    const rows = await withTenantRls(input.tenantId, async (tx) => {
      return tx.integrationConnection.findMany({
        where: {
          tenantId: input.tenantId,
          OR: [
            { workspaceType: input.workspaceType },
            ...(input.workspaceType !== null ? [{ workspaceType: null }] : []),
          ],
        },
        orderBy: { createdAt: "asc" },
      });
    });
    return rows.map(mapRow);
  }
}

export function createIntegrationConnectionRepository(): IntegrationConnectionRepository {
  return new PrismaIntegrationConnectionRepository();
}
